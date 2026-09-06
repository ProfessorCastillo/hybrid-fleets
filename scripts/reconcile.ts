import { mkdirSync, writeFileSync } from 'node:fs';
import { findQ, normalCdf, paperParams, prepare, sampleDraw } from '../packages/core/src/index';

// Compare explicit source-based conventions using the same supply draws.
// This is an audit, not a calibration search or a change to the app's solver.
const cases = [
  { demandCV: .2, supplyCV: .2, published: 345 },
  { demandCV: .2, supplyCV: .8, published: 371.7 },
  { demandCV: .8, supplyCV: .2, published: 416.9 },
  { demandCV: .8, supplyCV: .8, published: 406.4 },
  { demandCV: .34, supplyCV: .36, published: 345 },
];
const rows = [];
for (const seed of [42, 123, 2026]) for (const c of cases) {
  const params = paperParams({ ...c, seed }), implemented = prepare(params);
  const supplies = Array.from({ length: 1000 }, (_, k) => sampleDraw(implemented, k).supply);
  const meanQ = (model: typeof implemented) => supplies.reduce((s, b) => s + findQ(model, [b]), 0) / supplies.length;
  const javaFractile = prepare({ ...params, convention: 'legacyJava', demandTruncation: 'zeroAnd3Sigma' });
  rows.push({ ...c, seed, initial: meanQ(implemented),
    printedRhs: meanQ({ ...implemented, rhs: (params.failedDeliveryCost - params.pdUnitCost) / (params.failedDeliveryCost - params.operatingCost) }),
    normalCdf: meanQ({ ...implemented, cdf: x => normalCdf((x - params.demandMean) / (params.demandMean * params.demandCV)) }),
    javaFractile: meanQ(javaFractile),
  });
}
const table = rows.map(r => `| ${r.demandCV} | ${r.supplyCV} | ${r.seed} | ${r.published} | ${r.initial.toFixed(2)} | ${r.printedRhs.toFixed(2)} | ${r.normalCdf.toFixed(2)} | ${r.javaFractile.toFixed(2)} |`).join('\n');
const report = `# Implementation audit\n\n## Correction to the initial assessment\n\nThe published results are the reference to reproduce. The initial build did not establish an error in the paper. Its mismatch establishes that this reimplementation is not yet validated against the published model. Unit tests checked numerical behavior and internal consistency; they did not validate the interpretation of the research.\n\nThe initial build made several substantive choices: it replaced the printed raw-a threshold with expected-cost abar, implemented a particular conditioning of transformed demand, selected demand truncation and table values, and added an advance fixed-fleet optimization as the main recommendation. That extension is not the paper's reported mean conditional Q*. Calling the app a direct implementation of the published equations was too strong.\n\n## Controlled convention comparison\n\nEvery column in a row uses the same 1,000 sampled supply vectors. No costs, capacities, or CVs are fitted to reported outcomes. The seed controls both demand sampling and the supply stream.\n\n| Demand CV | Supply CV | Seed | Published Q* | Initial reconstruction | Printed raw-a RHS only | Untruncated CDF only | Java fractile convention |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n\nThe Java-fractile column uses the supplied procFleetSizeFixed structure: raw unit costs, the initial b1-minus-zero term, all CD tiers in the capacity ladder, and F_of_x truncated to [0, mu+3 sigma]. It retains the paper's five-tier calibration and the same Beta samples as the other columns. It uses a mathematically defined integer threshold search, not Java's post-search nudge. It is not a full AnyLogic replay and does not demonstrate which version generated the publication.\n\nThe Java-based results are substantially closer to several reported values than the initial reconstruction. This points to translating and reconciling implementation conventions as the next task. The remaining differences are not explained by this audit.\n\n## What is established\n\n- The initial app included an additional fixed planning objective; its 580 default is not the paper's 345 recommendation.\n- Selecting conventions materially changes the stochastic results, even with identical sampled supply.\n- Rounding and table-selection observations alone do not establish a faulty model or invalid published results.\n- The app must earn a claim of faithful replication by reproducing the published benchmarks and explaining the convention mapping.\n\nThe production calculations have not been switched to whichever column looks closest. The app and documentation now identify the outstanding work as implementation validation.\n`;
mkdirSync('app/public/sources', { recursive: true });
writeFileSync('IMPLEMENTATION_AUDIT.md', report);
writeFileSync('app/public/sources/IMPLEMENTATION_AUDIT.md', report);
console.log(report);
