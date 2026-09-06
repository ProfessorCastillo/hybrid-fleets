import type { ScenarioParams } from './types';
export const DEFAULTS: ScenarioParams = {
  demandMean: 759.9, demandCV: 0.34, demandTruncation: 'zero',
  pdUnitCost: 20.3, operatingCost: 17.6, pdReliability: 0.986,
  tiers: [
    { name: 'Standard motorcycle', unitCost: 8.8, meanCapacity: 16.5 },
    { name: 'Car', unitCost: 10.8, meanCapacity: 389.8 },
    { name: 'Van', unitCost: 17.3, meanCapacity: 9 },
    { name: 'Premium motorcycle', unitCost: 22, meanCapacity: 67.5 },
    { name: 'Express motorcycle', unitCost: 28.7, meanCapacity: 42 },
  ],
  cdReliability: 0.981, supplyCV: 0.36, supplyCorrelation: 0,
  commonMeanCapacity: 322.1, failedDeliveryCost: 35.1,
  iterations: 1000, seed: 42, convention: 'paper', pdOnlyZ: 2.33,
};
export const PRESETS = [
  { name: 'From the paper', description: 'AffordableMeals · empirical case', patch: {} },
  { name: 'A predictable day', description: 'No demand or supply uncertainty', patch: { demandCV: 0, supplyCV: 0 } },
  { name: 'Uncertainty on both sides', description: 'High demand and supply variability', patch: { demandCV: 0.8, supplyCV: 0.8 } },
  { name: 'Unreliable crowd', description: 'Stable demand, volatile availability', patch: { demandCV: 0.2, supplyCV: 0.8 } },
  { name: 'Costly missed deliveries', description: 'Higher penalty for capacity shortfalls', patch: { failedDeliveryCost: 41.6, demandCV: 0.6 } },
  { name: 'Synchronized supply', description: 'Shared supply mix across tiers', patch: { supplyCorrelation: 0.5 } },
] satisfies { name: string; description: string; patch: Partial<ScenarioParams> }[];
export const CV_LEVELS = [0, 0.2, 0.4, 0.6, 0.8];
export const paperParams = (patch: Partial<ScenarioParams> = {}): ScenarioParams => ({ ...DEFAULTS, tiers: DEFAULTS.tiers.map(t => ({ ...t })), ...patch });
