import { normalizeParams, paperParams } from '../../packages/core/src';
import type { ScenarioParams } from '../../packages/core/src';
export const num = (n: number, digits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
export const money = (n: number, digits = 0) => `R$ ${num(n, digits)}`;
export const pct = (n: number) => `${num(n * 100, 1)}%`;
export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function csv(rows: (string | number)[][]) {
  return rows.map(row => row.map(v => typeof v === 'string' ? `"${v.replaceAll('"', '""')}"` : v).join(',')).join('\n');
}
export function loadInitial(): { params: ScenarioParams; notice?: string } {
  try {
    const encoded = new URLSearchParams(location.search).get('scenario');
    return { params: encoded ? normalizeParams(JSON.parse(encoded)) : paperParams() };
  } catch { return { params: paperParams(), notice: 'This shared scenario was invalid. Paper inputs have been restored.' }; }
}
export const sourceUrl = 'https://onlinelibrary.wiley.com/doi/full/10.1111/jbl.70038';
