export interface Tier { name: string; unitCost: number; meanCapacity: number }
export interface ScenarioParams {
  demandMean: number; demandCV: number;
  demandTruncation: 'none' | 'zero' | 'zeroAnd3Sigma';
  pdUnitCost: number; operatingCost: number; pdReliability: number;
  tiers: Tier[]; cdReliability: number; supplyCV: number; supplyCorrelation: number;
  commonMeanCapacity: number; failedDeliveryCost: number;
  iterations: number; seed: number; convention: 'paper' | 'legacyJava';
  pdOnlyZ: number;
}
export interface Stat { mean: number; sd: number; p05: number; p50: number; p95: number; ci95: [number, number] }
export interface Allocation {
  q: number; demand: number; remainingDemand: number; pd: number; cd: number;
  missed: number; idle: number; tierUsed: number[];
  pdFixed: number; idleSavings: number; cheapTierSpend: number; cdSpend: number;
  penalty: number; total: number;
}
export interface Draw { day: number; rawDemand: number; demand: number; supply: number[]; qStar: number }
export interface Iteration extends Draw { fixed: Allocation; conditional: Allocation; pdOnly: Allocation; cdOnly: Allocation }
export interface PolicyResult {
  key: 'hybrid' | 'pdOnly' | 'cdOnly'; name: string; q: number; cost: Stat;
  pd: number; cd: number; missed: number; idle: number; demand: number;
}
export interface CurvePoint { q: number; cost: number; p05: number; p95: number }
export interface ScenarioResult {
  params: ScenarioParams; qStar: Stat; fixedQ: number; iterations: Iteration[];
  policies: PolicyResult[]; costCurve: CurvePoint[];
  cost: Record<'total' | 'pdFixed' | 'idleSavings' | 'cheapTierSpend' | 'cdSpend' | 'penalty', Stat>;
  expectedPdUnitCost: number; avgExpectedCdUnitCost: number;
  supply: Stat[]; warnings: string[]; elapsedMs: number;
}
export interface SweepCell { demandCV: number; supplyCV: number; rho: number; costFactor: number; q: number; lo: number; hi: number; costs?: { hybrid: number; pdOnly: number; cdOnly: number } }
export type Experiment = 'base' | 'correlation' | 'failure' | 'private' | 'fleets';
