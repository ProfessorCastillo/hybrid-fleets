import { runScenario, runSweepCell, sweepSpecs } from '../../../packages/core/src';
import type { Experiment, ScenarioParams } from '../../../packages/core/src';
self.onmessage = async (e: MessageEvent<{ kind: 'scenario' | 'sweep'; params: ScenarioParams; experiment: Experiment }>) => {
  try {
    if (e.data.kind === 'scenario') self.postMessage({ kind: 'result', result: runScenario(e.data.params) });
    else {
      const specs = sweepSpecs(e.data.params, e.data.experiment), cells = [];
      for (let i = 0; i < specs.length; i++) {
        cells.push(runSweepCell(specs[i], e.data.experiment === 'fleets'));
        self.postMessage({ kind: 'progress', progress: (i + 1) / specs.length });
      }
      self.postMessage({ kind: 'sweep', cells });
    }
  } catch (err) { self.postMessage({ kind: 'error', message: err instanceof Error ? err.message : 'The model could not run.' }); }
};
