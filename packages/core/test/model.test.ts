import { describe, expect, it } from 'vitest';
import { allocate, betaParams, betaSample, customPolicy, expectedCost, findQ, fork, h, normalizeParams, normalCdf, normalPdf, normalSample, paperParams, prepare, quantile, rng, runScenario, runSweepCell, sampleDraw, stats, sweepSpecs } from '../src';

describe('numerics', () => {
  it('matches normal CDF reference probabilities and tails', () => {
    for (const [z, expected] of [[0, .5], [1, .841344746068543], [-1, .158655253931457], [1.96, .975002104851780], [3, .99865010196837], [-8, 6.22096057427178e-16], [Infinity, 1], [-Infinity, 0], [-40, 0]]) expect(normalCdf(z)).toBeCloseTo(expected, 10);
    expect(normalPdf(Infinity)).toBe(0); expect(normalPdf(0)).toBeCloseTo(.3989422804, 9);
  });
  it('reproduces Appendix S2.1 shapes', () => {
    const a = betaParams(.3898, .2 * .3898), b = betaParams(.0165, .8 * .0165);
    expect(a.alpha).toBeCloseTo(14.87, 2); expect(a.beta).toBeCloseTo(23.27, 2);
    expect(b.alpha).toBeCloseTo(1.52, 2); expect(b.beta).toBeCloseTo(90.61, 2);
    expect(betaParams(.9, 2).clamped).toBe(true);
    expect(() => betaParams(1, .2)).toThrow(); expect(() => betaParams(.1, 0)).toThrow(); expect(() => betaSample(0, 1, rng(4))).toThrow();
  });
  it('samples correct means and dispersion, including small Beta shapes', () => {
    for (const [alpha, beta] of [[2, 5], [.2, .3], [15, 23], [.0001, .0002]]) {
      const r = rng(45), values = Array.from({ length: 30000 }, () => betaSample(alpha, beta, r)), s = stats(values);
      expect(values.every(x => Number.isFinite(x) && x >= 0 && x <= 1)).toBe(true);
      expect(s.mean).toBeCloseTo(alpha / (alpha + beta), 1);
    }
    const r = rng(445), s = stats(Array.from({ length: 30000 }, () => normalSample(r)));
    expect(Math.abs(s.mean)).toBeLessThan(.025); expect(Math.abs(s.sd - 1)).toBeLessThan(.025);
  });
  it('forks reproduce independent days in any order', () => {
    expect(fork(42, 17)()).toBe(fork(42, 17)()); expect(fork(42, 17)()).not.toBe(fork(42, 18)());
    const m = prepare(paperParams()); expect(sampleDraw(m, 50)).toEqual(sampleDraw(m, 50));
    const values = [10, 5, 100].map(k => sampleDraw(m, k)); expect([100, 10, 5].map(k => sampleDraw(m, k))).toEqual([values[2], values[0], values[1]]);
    expect(quantile([], .5)).toBe(0); expect(quantile([2, 4], .5)).toBe(3); expect(stats([]).mean).toBe(0); expect(stats([3]).sd).toBe(0);
  });
});

describe('source conventions and validation', () => {
  it('uses expected costs, three cheap tiers, and the explicit shared mean', () => {
    const m = prepare(paperParams());
    expect(m.a).toBeCloseTo(20.5072, 8);
    expect(m.costs[0]).toBeCloseTo(9.2997, 7); expect(m.costs[1]).toBeCloseTo(11.2617, 7);
    expect(m.w).toBe(3); expect(m.p.commonMeanCapacity).toBe(322.1);
    expect(m.p.pdUnitCost - m.p.operatingCost).toBeCloseTo(2.7, 7);
  });
  it('preserves the shared mixture at zero CV and synchronizes tiers at rho=1', () => {
    for (const supplyCV of [0, .8]) {
      const m = prepare(paperParams({ supplyCV, supplyCorrelation: 1 })), d = sampleDraw(m, 0);
      d.supply.forEach(x => expect(x).toBe(d.supply[0]));
      if (!supplyCV) expect(d.supply.reduce((s, b) => s + b, 0)).toBeCloseTo(1610.5, 8);
    }
    const m = prepare(paperParams({ supplyCV: 0, supplyCorrelation: .5 }));
    expect(sampleDraw(m, 0).supply[0]).toBeCloseTo((16.5 + 322.1) / 2, 8);
  });
  it('conditions demand consistently and supports untruncated diagnostic draws', () => {
    for (const demandTruncation of ['zero', 'zeroAnd3Sigma', 'none'] as const) {
      const m = prepare(paperParams({ demandCV: 1.5, demandTruncation }));
      for (let k = 0; k < 100; k++) { const d = sampleDraw(m, k); expect(d.rawDemand).toBeGreaterThanOrEqual(m.lower); expect(d.rawDemand).toBeLessThanOrEqual(m.upper); expect(d.demand).toBeGreaterThanOrEqual(0); }
      expect(m.cdf(-100000)).toBe(0); expect(m.cdf(1000000)).toBe(1);
      if (demandTruncation === 'zeroAnd3Sigma') expect(m.loss(m.upper + 10)).toBe(0);
    }
    const m = prepare(paperParams({ demandCV: 0 })); expect(m.cdf(759.8)).toBe(0); expect(m.cdf(759.9)).toBe(1);
  });
  it('rejects invalid and unbounded inputs rather than outputting fake optima', () => {
    for (const patch of [{ demandCV: NaN }, { iterations: 99 }, { iterations: 100.1 }, { seed: -1 }, { seed: 1.2 }, { pdUnitCost: 36 }, { operatingCost: 25 }, { pdReliability: 0 }, { supplyCorrelation: 2 }, { demandMean: 0 }, { commonMeanCapacity: 0 }]) expect(() => normalizeParams(paperParams(patch))).toThrow();
    expect(() => normalizeParams(paperParams({ tiers: [] }))).toThrow();
    expect(() => normalizeParams(paperParams({ tiers: [{ name: '', unitCost: 1, meanCapacity: 1 }, ...paperParams().tiers] }))).toThrow();
    expect(() => normalizeParams(paperParams({ demandTruncation: 'bad' as never }))).toThrow();
    expect(() => normalizeParams(paperParams({ convention: 'bad' as never }))).toThrow();
    const m = prepare(paperParams()); expect(() => allocate(m, -1, 500, [1, 2, 3, 4, 5])).toThrow();
  });
  it('sorts and merges equal-cost tiers without mutating inputs', () => {
    const p = paperParams(); p.tiers[0].unitCost = p.tiers[1].unitCost; p.tiers.reverse();
    const n = normalizeParams(p); expect(n.tiers.length).toBe(4); expect(n.tiers[0].meanCapacity).toBeCloseTo(406.3, 8); expect(p.tiers.length).toBe(5);
  });
  it('increases Beta scale and handles requested variances beyond the bound', () => {
    const p = paperParams({ iterations: 100, supplyCV: 1.2 }); p.tiers[1].meanCapacity = 5000;
    const r = runScenario(p, false); expect(r.warnings.join(' ')).toContain('scale raised'); expect(r.warnings.join(' ')).toContain('clamped');
    expect(r.iterations.every(d => Number.isFinite(d.fixed.total))).toBe(true);
  });
});

describe('capacity optimization and accounting', () => {
  it('reproduces the deterministic baseline of 345 deliveries', () => {
    const r = runScenario(paperParams({ demandCV: 0, supplyCV: 0, iterations: 100 }));
    expect(r.qStar.mean).toBe(345); expect(r.fixedQ).toBe(345);
    expect(r.iterations[0].fixed.cheapTierSpend).toBeGreaterThan(0);
    expect(r.iterations[0].supply.slice(0, 3).reduce((s, b) => s + b, 0)).toBeCloseTo(415.3, 8);
  });
  it('has monotone H and returns the first crossing, including Q=0', () => {
    for (let k = 0; k < 200; k++) {
      const r = fork(11, k), m = prepare(paperParams({ demandCV: r(), supplyCV: r(), supplyCorrelation: r() })), b = sampleDraw(m, k).supply;
      const q = findQ(m, [b]);
      expect(h(m, q, b)).toBeGreaterThanOrEqual(m.rhs - 1e-10);
      if (q) expect(h(m, q - 1, b)).toBeLessThan(m.rhs);
      let previous = h(m, 0, b);
      for (let x = 1; x < 2200; x++) { const next = h(m, x, b); if (next + 1e-12 < previous) throw new Error(`Nonmonotone H at ${x}`); previous = next; }
    }
    const m = prepare(paperParams({ supplyCorrelation: 1, supplyCV: 0, demandCV: 0 })); expect(findQ(m, [sampleDraw(m, 0).supply])).toBe(0);
  });
  it('satisfies the Appendix S1 closed form and conserves allocations for 1,000 random days', () => {
    for (let k = 0; k < 1000; k++) {
      const m = prepare(paperParams({ demandCV: .8, supplyCV: .8 })), d = sampleDraw(m, k), q = Math.floor(fork(66, k)() * 1600), a = allocate(m, q, d.demand, d.supply);
      let closed = m.a * q + (a.remainingDemand - q) * m.p.operatingCost + a.cheapTierSpend, prefix = 0, prev = m.p.operatingCost;
      for (let i = m.w; i <= d.supply.length; i++) { const cost = m.costs[i] ?? m.p.failedDeliveryCost; closed += (cost - prev) * Math.max(a.remainingDemand - q - prefix, 0); prefix += d.supply[i] ?? 0; prev = cost; }
      expect(closed).toBeCloseTo(a.total, 6); expect(a.pd + a.cd + a.missed).toBeCloseTo(d.demand, 8); expect(a.pd + a.idle).toBeCloseTo(q, 8);
      expect(a.tierUsed.every((x, i) => x <= d.supply[i] + 1e-10 && x >= 0)).toBe(true);
    }
  });
  it('matches demand-integrated costs with Monte Carlo and finds the cost curve minimum', () => {
    for (const demandTruncation of ['none', 'zero', 'zeroAnd3Sigma'] as const) {
      const m = prepare(paperParams({ demandCV: .8, supplyCV: 0, demandTruncation })), b = sampleDraw(m, 1).supply;
      const costs = Array.from({ length: 15000 }, (_, k) => allocate(m, 500, sampleDraw(m, k).demand, b).total), s = stats(costs);
      expect(Math.abs(s.mean - expectedCost(m, 500, b))).toBeLessThan(4 * s.sd / Math.sqrt(costs.length));
    }
    for (const seed of [42, 123, 2026]) for (const demandCV of [.2, .4]) {
      const r = runScenario(paperParams({ seed, demandCV, supplyCV: .4, iterations: 300 }));
      const best = r.costCurve.reduce((a, b) => a.cost < b.cost ? a : b); expect(Math.abs(best.q - r.fixedQ)).toBeLessThanOrEqual(10);
    }
  });
  it('uses fixed policies and fair shared draws; custom policy reproduces hybrid', () => {
    const p = paperParams({ iterations: 300 }), r = runScenario(p, false), c = customPolicy(r, r.fixedQ);
    expect(r.iterations.every(d => d.fixed.q === r.fixedQ)).toBe(true);
    expect(c.cost).toEqual(r.policies[0].cost);
    for (const d of r.iterations) { expect(d.pdOnly.cd).toBe(0); expect(d.cdOnly.pd).toBe(0); expect(d.fixed.demand).toBe(d.pdOnly.demand); expect(d.fixed.demand).toBe(d.cdOnly.demand); }
    expect(r.policies[0].cost.mean).toBeLessThan(r.policies[1].cost.mean);
    expect(r.policies[0].cost.mean).toBeLessThan(r.policies[2].cost.mean);
    expect(r.fixedQ).not.toBe(Math.round(r.qStar.mean));
    const repeated = runScenario(p, false); expect(repeated.iterations).toEqual(r.iterations);
  });
  it('accounts for zero demand, all-cheap supply, no cheap supply and the legacy diagnostic', () => {
    for (const operatingCost of [0, 17.6]) {
      const m = prepare(paperParams({ operatingCost })), a = allocate(m, 100, 0, [1, 2, 3, 4, 5]);
      expect(a.cd).toBe(0); expect(a.pd).toBe(0); expect(a.missed).toBe(0); expect(a.total).toBeCloseTo((m.a - operatingCost) * 100, 8);
    }
    const allCheap = paperParams({ iterations: 100 }); allCheap.tiers = allCheap.tiers.map((t, i) => ({ ...t, unitCost: 1 + i }));
    expect(runScenario(allCheap, false).iterations[0].fixed.cdSpend).toBe(0);
    const r = runScenario(paperParams({ convention: 'legacyJava', demandTruncation: 'none', supplyCorrelation: 1, iterations: 100 }));
    expect(r.expectedPdUnitCost).toBe(20.3); expect(r.warnings.length).toBe(3); expect(r.cost.cheapTierSpend.mean).toBe(0);
  });
  it('generates the full experimental designs and finite sensitivity results', () => {
    const p = paperParams({ iterations: 100 });
    for (const [exp, count] of [['base', 25], ['correlation', 75], ['failure', 225], ['private', 225], ['fleets', 15]] as const) {
      const specs = sweepSpecs(p, exp); expect(specs.length).toBe(count);
      const cell = runSweepCell(specs[0], exp === 'fleets'); expect(Number.isFinite(cell.q)).toBe(true);
      if (exp === 'private') expect(specs[0].p.operatingCost).toBeLessThan(specs[0].p.pdUnitCost);
      if (exp === 'fleets') expect(cell.costs!.hybrid).toBeGreaterThan(0);
    }
  });
});
