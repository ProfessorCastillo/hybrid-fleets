import { mkdirSync, writeFileSync } from 'node:fs';
import { paperParams, runSweepCell, sweepSpecs } from '../packages/core/src/index';
import type { Experiment } from '../packages/core/src/index';
mkdirSync('app/public/precomputed', { recursive: true });
for (const experiment of ['base', 'correlation', 'failure', 'private', 'fleets'] as Experiment[]) {
  const params = paperParams(), start = performance.now();
  const cells = sweepSpecs(params, experiment).map(spec => runSweepCell(spec, experiment === 'fleets'));
  writeFileSync(`app/public/precomputed/${experiment}.json`, JSON.stringify({ params, cells }));
  console.log(`${experiment}: ${cells.length} cells × ${params.iterations} draws, ${(performance.now() - start).toFixed(0)} ms`);
}
