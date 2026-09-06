export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return (((t ^ t >>> 14) >>> 0) + 0.5) / 4294967296;
  };
}
export function fork(seed: number, stream: number): Rng {
  let h = (seed ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ h >>> 16, 0x85ebca6b);
  h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
  return rng((h ^ h >>> 16) >>> 0);
}
export const normalSample = (r: Rng) => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r());
export const normalPdf = (z: number) => Number.isFinite(z) ? Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) : 0;
// West's rational approximation; absolute error is below 1e-7.
export function normalCdf(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const y = Math.abs(z);
  let tail = 0;
  if (y < 37) {
    const e = Math.exp(-y * y / 2);
    if (y < 7.07106781186547) {
      let a = 0.0352624965998911 * y + 0.700383064443688;
      a = a * y + 6.37396220353165; a = a * y + 33.912866078383;
      a = a * y + 112.079291497871; a = a * y + 221.213596169931;
      a = a * y + 220.206867912376;
      let b = 0.0883883476483184 * y + 1.75566716318264;
      b = b * y + 16.064177579207; b = b * y + 86.7807322029461;
      b = b * y + 296.564248779674; b = b * y + 637.333633378831;
      b = b * y + 793.826512519948; b = b * y + 440.413735824752;
      tail = e * a / b;
    } else {
      tail = e / (y + 1 / (y + 2 / (y + 3 / (y + 4 / (y + 0.65))))) / Math.sqrt(2 * Math.PI);
    }
  }
  return z > 0 ? 1 - tail : tail;
}
export function betaParams(mean: number, sd: number) {
  if (!(mean > 0 && mean < 1) || !(sd > 0) || !Number.isFinite(sd)) throw new Error('Beta mean must be between 0 and 1, and its standard deviation must be positive.');
  const maxVar = mean * (1 - mean);
  const clamped = sd * sd >= maxVar;
  const variance = clamped ? maxVar * 0.998001 : sd * sd;
  const k = maxVar / variance - 1;
  return { alpha: mean * k, beta: (1 - mean) * k, clamped };
}
function logGamma(shape: number, r: Rng): number {
  if (shape < 1) return logGamma(shape + 1, r) + Math.log(r()) / shape;
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normalSample(r), root = 1 + c * x;
    if (root <= 0) continue;
    const v = root ** 3, u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return Math.log(d) + Math.log(v);
  }
}
export function betaSample(alpha: number, beta: number, r: Rng): number {
  if (!(alpha > 0 && beta > 0)) throw new Error('Beta shapes must be positive.');
  const delta = logGamma(beta, r) - logGamma(alpha, r);
  return 1 / (1 + Math.exp(delta));
}
export function quantile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const at = (sorted.length - 1) * p, i = Math.floor(at);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (at - i);
}
export function stats(values: number[]) {
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...values].sort((a, b) => a - b), half = 1.96 * sd / Math.sqrt(Math.max(1, n));
  return { mean, sd, p05: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), ci95: [mean - half, mean + half] as [number, number] };
}
