import { betaParams, betaSample, fork, normalCdf, normalPdf, normalSample } from './numerics';
import type { Allocation, Draw, ScenarioParams } from './types';

export function normalizeParams(input: ScenarioParams): ScenarioParams {
  const p = { ...input, tiers: input.tiers?.map(t => ({ ...t })) };
  const inRange = (v: number, lo: number, hi: number, name: string) => {
    if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`${name} must be between ${lo} and ${hi}.`);
  };
  inRange(p.demandMean, 1, 100000, 'Average demand');
  inRange(p.demandCV, 0, 1.5, 'Demand variability'); inRange(p.supplyCV, 0, 1.2, 'Supply variability');
  inRange(p.supplyCorrelation, 0, 1, 'Supply synchronization');
  inRange(p.pdReliability, 0.001, 1, 'Private reliability'); inRange(p.cdReliability, 0.001, 1, 'Crowd reliability');
  inRange(p.pdUnitCost, 0.01, 10000, 'Private delivery cost');
  inRange(p.operatingCost, 0, 10000, 'Private operating cost');
  inRange(p.failedDeliveryCost, 0.01, 10000, 'Missed-delivery cost');
  inRange(p.commonMeanCapacity, 0.001, 1000000, 'Common supply mean');
  inRange(p.iterations, 100, 10000, 'Iterations'); inRange(p.seed, 0, 4294967295, 'Seed');
  inRange(p.pdOnlyZ, 0, 4, 'Private-only demand buffer');
  if (!Number.isInteger(p.iterations) || !Number.isInteger(p.seed)) throw new Error('Iterations and seed must be whole numbers.');
  if (!['none', 'zero', 'zeroAnd3Sigma'].includes(p.demandTruncation)) throw new Error('Unknown demand distribution convention.');
  if (!['paper', 'legacyJava'].includes(p.convention)) throw new Error('Unknown model convention.');
  if (p.pdUnitCost >= p.failedDeliveryCost) throw new Error('Private unit cost must be below missed-delivery cost (a < u).');
  if (p.operatingCost > p.pdUnitCost) throw new Error('Operating cost cannot exceed total private cost: negative idle capacity costs produce an unbounded model.');
  if (!Array.isArray(p.tiers) || p.tiers.length < 2 || p.tiers.length > 8) throw new Error('Use between 2 and 8 crowd supply tiers.');
  p.tiers.forEach(t => {
    if (typeof t.name !== 'string' || !t.name.trim() || t.name.length > 80) throw new Error('Each tier needs a name of 1–80 characters.');
    inRange(t.unitCost, 0, p.failedDeliveryCost, `${t.name} cost`);
    inRange(t.meanCapacity, 0.001, 1000000, `${t.name} mean supply`);
  });
  p.tiers.sort((a, b) => a.unitCost - b.unitCost);
  p.tiers = p.tiers.reduce<typeof p.tiers>((out, t) => {
    const prev = out[out.length - 1];
    if (prev && prev.unitCost === t.unitCost) { prev.meanCapacity += t.meanCapacity; prev.name = `${prev.name} + ${t.name}`.slice(0, 80); }
    else out.push(t);
    return out;
  }, []);
  return p;
}

export function prepare(p: ScenarioParams) {
  const legacy = p.convention === 'legacyJava';
  const a = legacy ? p.pdUnitCost : p.pdReliability * p.pdUnitCost + (1 - p.pdReliability) * p.failedDeliveryCost;
  const costs = p.tiers.map(t => legacy ? t.unitCost : p.cdReliability * t.unitCost + (1 - p.cdReliability) * p.failedDeliveryCost);
  const w = legacy ? 0 : p.tiers.filter(t => t.unitCost < p.operatingCost).length;
  const maxMean = Math.max(p.commonMeanCapacity, ...p.tiers.map(t => t.meanCapacity));
  let scale = 1000;
  while (maxMean >= scale) scale *= 10;
  const shapes = p.supplyCV ? [...p.tiers.map(t => t.meanCapacity), p.commonMeanCapacity].map(mean => betaParams(mean / scale, p.supplyCV * mean / scale)) : [];
  const sd = p.demandMean * p.demandCV;
  const lower = p.demandTruncation === 'none' ? -Infinity : 0;
  const upper = p.demandTruncation === 'zeroAnd3Sigma' ? p.demandMean + 3 * sd : Infinity;
  const lowCdf = sd ? normalCdf((lower - p.demandMean) / sd) : 0;
  const highCdf = sd ? normalCdf((upper - p.demandMean) / sd) : 1;
  const mass = highCdf - lowCdf;
  const cdf = (x: number) => {
    if (sd === 0) return x >= p.demandMean ? 1 : 0;
    return Math.max(0, Math.min(1, (normalCdf((x - p.demandMean) / sd) - lowCdf) / mass));
  };
  // E[(D - x)+], exact for the selected normal/truncated-normal distribution, x >= 0.
  const loss = (x: number) => {
    if (!sd) return Math.max(0, p.demandMean - x);
    if (x >= upper) return 0;
    const z = (Math.max(x, lower) - p.demandMean) / sd, zu = (upper - p.demandMean) / sd;
    return Math.max(0, ((p.demandMean - x) * (highCdf - normalCdf(z)) + sd * (normalPdf(z) - normalPdf(zu))) / mass);
  };
  return { p, a, costs, w, scale, shapes, sd, lower, upper, cdf, loss, rhs: (p.failedDeliveryCost - a) / (p.failedDeliveryCost - p.operatingCost) };
}
export type Model = ReturnType<typeof prepare>;

export function sampleDraw(m: Model, k: number): Draw {
  const { p, sd, shapes, scale } = m, r = fork(p.seed, k);
  let rawDemand = p.demandMean;
  if (sd) do { rawDemand = p.demandMean + sd * normalSample(r); } while (rawDemand < m.lower || rawDemand > m.upper);
  const common = p.supplyCV ? scale * betaSample(shapes.at(-1)!.alpha, shapes.at(-1)!.beta, r) : p.commonMeanCapacity;
  const supply = p.tiers.map((t, i) => {
    const individual = p.supplyCV ? scale * betaSample(shapes[i].alpha, shapes[i].beta, r) : t.meanCapacity;
    return (1 - p.supplyCorrelation) * individual + p.supplyCorrelation * common;
  });
  return { day: k + 1, rawDemand, demand: Math.max(0, rawDemand), supply, qStar: 0 };
}

export function h(m: Model, q: number, supply: number[]) {
  let cumulative = supply.slice(0, m.w).reduce((s, x) => s + x, 0);
  let previous = m.p.convention === 'legacyJava' ? 0 : m.p.operatingCost;
  let sum = 0;
  for (let i = m.w; i <= m.costs.length; i++) {
    const next = i === m.costs.length ? m.p.failedDeliveryCost : m.costs[i];
    sum += (next - previous) * m.cdf(q + cumulative);
    cumulative += supply[i] ?? 0; previous = next;
  }
  return sum / (m.p.failedDeliveryCost - m.p.operatingCost);
}
export function findQ(m: Model, supplies: number[][]) {
  const crosses = (q: number) => supplies.reduce((s, b) => s + h(m, q, b), 0) / supplies.length >= m.rhs - 1e-12;
  if (crosses(0)) return 0;
  let lo = 0, hi = Math.ceil(m.p.demandMean + 4 * m.sd) + 1;
  while (!crosses(hi) && hi < 10000000) hi *= 2;
  if (!crosses(hi)) throw new Error('No finite capacity optimum was found for these costs.');
  while (hi - lo > 1) { const mid = Math.floor((hi + lo) / 2); if (crosses(mid)) hi = mid; else lo = mid; }
  return hi;
}

export function allocate(m: Model, q: number, demand: number, supply: number[], privateOnly = false): Allocation {
  if (!Number.isFinite(q) || q < 0 || !Number.isFinite(demand)) throw new Error('Capacity and demand must be finite; capacity must be nonnegative.');
  demand = Math.max(0, demand);
  const tierUsed = supply.map(() => 0);
  let remaining = demand, cheapTierSpend = 0, cdSpend = 0;
  if (!privateOnly) for (let i = 0; i < m.w; i++) { tierUsed[i] = Math.min(remaining, supply[i]); remaining -= tierUsed[i]; cheapTierSpend += tierUsed[i] * m.costs[i]; }
  const remainingDemand = remaining, pd = Math.min(q, remaining), idle = q - pd;
  remaining -= pd;
  if (!privateOnly) for (let i = m.w; i < supply.length; i++) { tierUsed[i] = Math.min(remaining, supply[i]); remaining -= tierUsed[i]; cdSpend += tierUsed[i] * m.costs[i]; }
  const pdFixed = m.a * q, idleSavings = m.p.operatingCost * idle, penalty = m.p.failedDeliveryCost * remaining;
  return { q, demand, remainingDemand, pd, cd: tierUsed.reduce((s, x) => s + x, 0), missed: remaining, idle, tierUsed, pdFixed, idleSavings, cheapTierSpend, cdSpend, penalty, total: pdFixed - idleSavings + cheapTierSpend + cdSpend + penalty };
}

export function expectedCost(m: Model, q: number, supply: number[]) {
  let prefix = 0, cheapSpend = 0;
  for (let i = 0; i < m.w; i++) { cheapSpend += m.costs[i] * (m.loss(prefix) - m.loss(prefix + supply[i])); prefix += supply[i]; }
  let total = m.a * q + m.p.operatingCost * (m.loss(prefix) - q) + cheapSpend;
  let previous = m.p.operatingCost;
  for (let i = m.w; i <= supply.length; i++) {
    const next = i === supply.length ? m.p.failedDeliveryCost : m.costs[i];
    total += (next - previous) * m.loss(prefix + q);
    prefix += supply[i] ?? 0; previous = next;
  }
  return total;
}
