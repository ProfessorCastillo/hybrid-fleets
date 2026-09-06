import { allocate, expectedCost, findQ, normalizeParams, prepare, sampleDraw } from './model';
import { stats } from './numerics';
import type { Allocation, Experiment, ScenarioParams, ScenarioResult, SweepCell } from './types';
import { CV_LEVELS } from './presets';

export function runScenario(input: ScenarioParams, includeCurve = true): ScenarioResult {
  const start = performance.now(), p = normalizeParams(input), m = prepare(p);
  const draws = Array.from({ length: p.iterations }, (_, k) => { const d = sampleDraw(m, k); d.qStar = findQ(m, [d.supply]); return d; });
  const fixedQ = findQ(m, draws.map(d => d.supply)), pdQ = Math.ceil(p.demandMean + p.pdOnlyZ * m.sd);
  const iterations = draws.map(d => ({ ...d, fixed: allocate(m, fixedQ, d.demand, d.supply), conditional: allocate(m, d.qStar, d.demand, d.supply), pdOnly: allocate(m, pdQ, d.demand, d.supply, true), cdOnly: allocate(m, 0, d.demand, d.supply) }));
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const policies = ([['hybrid', 'Hybrid fleet', 'fixed', fixedQ], ['pdOnly', 'Private only', 'pdOnly', pdQ], ['cdOnly', 'Crowd only', 'cdOnly', 0]] as const).map(([key, name, field, q]) => {
    const rows = iterations.map(d => d[field]);
    return { key, name, q, cost: stats(rows.map(d => d.total)), pd: mean(rows.map(d => d.pd)), cd: mean(rows.map(d => d.cd)), missed: mean(rows.map(d => d.missed)), idle: mean(rows.map(d => d.idle)), demand: mean(rows.map(d => d.demand)) };
  });
  const cost = Object.fromEntries((['total', 'pdFixed', 'idleSavings', 'cheapTierSpend', 'cdSpend', 'penalty'] as const).map(k => [k, stats(iterations.map(d => d.fixed[k]))])) as ScenarioResult['cost'];
  const max = Math.max(fixedQ * 1.7, p.demandMean + 2 * m.sd), step = Math.max(10, Math.ceil(max / 80 / 10) * 10);
  const qs = [...new Set([...Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step), fixedQ])].sort((a, b) => a - b);
  const costCurve = includeCurve ? qs.map(q => { const s = stats(draws.map(d => expectedCost(m, q, d.supply))); return { q, cost: s.mean, p05: s.p05, p95: s.p95 }; }) : [];
  const warnings: string[] = [];
  if (m.scale > 1000) warnings.push(`Beta capacity scale raised to ${m.scale.toLocaleString()} to accommodate your supply means.`);
  if (m.shapes.some(s => s.clamped)) warnings.push('At least one requested supply CV exceeds its bounded Beta limit. Its variance was clamped to 99.8% of the maximum.');
  if (p.supplyCorrelation > 0) warnings.push('The paper’s shared-supply mixture changes mean capacity as well as synchronization; ρ is a mixing weight, not measured Pearson correlation.');
  if (p.demandTruncation === 'none') warnings.push('Untruncated normal draws can be negative. Negative draws are retained in exports and represent zero delivery tasks.');
  if (p.convention === 'legacyJava') warnings.push('Legacy diagnostic: raw costs and a zero fractile baseline. This threshold does not optimize the idle-savings cost objective; the curve can disagree.');
  const cd = iterations.reduce((s, d) => s + d.fixed.cd, 0);
  return { params: p, fixedQ, qStar: stats(draws.map(d => d.qStar)), iterations, policies, costCurve, cost, expectedPdUnitCost: m.a,
    avgExpectedCdUnitCost: cd ? iterations.reduce((s, d) => s + d.fixed.cdSpend + d.fixed.cheapTierSpend, 0) / cd : 0,
    supply: p.tiers.map((_, i) => stats(draws.map(d => d.supply[i]))), warnings, elapsedMs: performance.now() - start };
}
export function customPolicy(result: ScenarioResult, q: number) {
  const m = prepare(result.params), allocations = result.iterations.map(d => allocate(m, q, d.demand, d.supply));
  const mean = (field: keyof Pick<Allocation, 'pd' | 'cd' | 'missed' | 'idle' | 'demand'>) => allocations.reduce((s, a) => s + a[field], 0) / allocations.length;
  return { allocations, cost: stats(allocations.map(a => a.total)), pd: mean('pd'), cd: mean('cd'), missed: mean('missed'), idle: mean('idle'), demand: mean('demand'), q };
}
export function sweepSpecs(p: ScenarioParams, experiment: Experiment) {
  const specs: { p: ScenarioParams; meta: Omit<SweepCell, 'q' | 'lo' | 'hi'> }[] = [];
  const rhos = experiment === 'base' ? [0] : [0, 0.5, 1];
  const factors = experiment === 'failure' ? [28.7, 35.1, 41.6] : experiment === 'private' ? [6.6, 20.3, 34] : [0];
  for (const costFactor of factors) for (const rho of rhos) for (const supplyCV of CV_LEVELS) for (const demandCV of experiment === 'fleets' ? [0.34] : CV_LEVELS) {
    const patch: Partial<ScenarioParams> = experiment === 'failure' ? { failedDeliveryCost: costFactor } : experiment === 'private' ? { pdUnitCost: costFactor, operatingCost: p.operatingCost * costFactor / p.pdUnitCost } : {};
    specs.push({ p: { ...p, ...patch, demandCV, supplyCV, supplyCorrelation: rho }, meta: { demandCV, supplyCV, rho, costFactor } });
  }
  return specs;
}
export function runSweepCell(spec: ReturnType<typeof sweepSpecs>[number], fleets = false): SweepCell {
  const p = normalizeParams(spec.p);
  if (fleets) { const r = runScenario(p, false); return { ...spec.meta, q: r.qStar.mean, lo: r.qStar.ci95[0], hi: r.qStar.ci95[1], costs: { hybrid: r.policies[0].cost.mean, pdOnly: r.policies[1].cost.mean, cdOnly: r.policies[2].cost.mean } }; }
  const m = prepare(p), s = stats(Array.from({ length: p.iterations }, (_, k) => findQ(m, [sampleDraw(m, k).supply])));
  return { ...spec.meta, q: s.mean, lo: s.ci95[0], hi: s.ci95[1] };
}
