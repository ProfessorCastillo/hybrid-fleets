import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, Download, FlaskConical, Play, RotateCcw, Square } from 'lucide-react';
import { CV_LEVELS, paperParams } from '../../../packages/core/src';
import type { Experiment, ScenarioParams, SweepCell } from '../../../packages/core/src';
import { csv, download, money, num } from '../lib';
import { color, tip } from './Charts';

const experiments: { id: Experiment; name: string; figure: string; text: string }[] = [
  { id: 'base', name: 'Two-sided uncertainty', figure: 'Figure 4', text: 'Vary demand and crowd supply uncertainty across a 5 × 5 factorial design.' },
  { id: 'correlation', name: 'Supply synchronization', figure: 'Figure 5', text: 'Add the shared-supply mixture across independent, partially synchronized, and synchronized tiers.' },
  { id: 'failure', name: 'Missed-delivery cost', figure: 'Figure 6', text: 'Explore three failure penalties alongside uncertainty and supply synchronization.' },
  { id: 'private', name: 'Private delivery cost', figure: 'Figure S4.1 · extension', text: 'Change private unit cost while scaling its labor and operating components proportionally.' },
  { id: 'fleets', name: 'Fleet comparison', figure: 'Figure S3.1 · extension', text: 'Compare fixed hybrid, private-only, and crowd-only fleets on common simulated days.' },
];
type Cached = { cells: SweepCell[]; params: ScenarioParams };
const cache = new Map<string, Cached>();

function panelsFor(cells: SweepCell[]) {
  return [...new Set(cells.map(c => `${c.costFactor}|${c.rho}`))].map(k => {
    const [factor, rho] = k.split('|').map(Number);
    return { factor, rho, cells: cells.filter(c => c.costFactor === factor && c.rho === rho) };
  });
}
function exportPng(cells: SweepCell[], experiment: Experiment): Promise<string> {
  const panels = panelsFor(cells), width = 1600, cols = Math.min(3, panels.length), rows = Math.ceil(panels.length / cols);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 140 + rows * 400;
  const c = canvas.getContext('2d')!; c.fillStyle = '#f7f8f2'; c.fillRect(0, 0, width, canvas.height);
  c.fillStyle = '#274d3e'; c.font = 'bold 30px system-ui'; c.fillText(`Fleet Lab · ${experiments.find(e => e.id === experiment)!.name}`, 40, 48);
  c.font = '17px system-ui'; c.fillText('Browser reconstruction · validation against published results is in progress.', 40, 82);
  panels.forEach((p, i) => {
    const x = 40 + i % cols * (width - 60) / cols, y = 160 + Math.floor(i / cols) * 400, w = (width - 100) / cols - 40, h = 260;
    c.font = 'bold 19px system-ui'; c.fillText(`ρ = ${p.rho}${p.factor ? ` · cost R$ ${p.factor}` : ''}`, x + 30, y - 15);
    const fleet = experiment === 'fleets', max = Math.max(1, ...p.cells.flatMap(d => fleet ? Object.values(d.costs!) : [d.q])) * 1.15;
    c.strokeStyle = '#d1dacd'; c.lineWidth = 1;
    for (let j = 0; j <= 4; j++) { const yy = y + h - j / 4 * h; c.beginPath(); c.moveTo(x + 45, yy); c.lineTo(x + w, yy); c.stroke(); c.font = '13px system-ui'; c.fillStyle = '#5f7167'; c.fillText(num(j / 4 * max), x, yy + 4); }
    const series = fleet ? ['hybrid', 'pdOnly', 'cdOnly'] : CV_LEVELS.map(String);
    series.forEach((key, j) => {
      const points = fleet ? p.cells.map(d => [d.supplyCV, d.costs![key as keyof NonNullable<SweepCell['costs']>]]) : p.cells.filter(d => d.supplyCV === +key).map(d => [d.demandCV, d.q]);
      c.strokeStyle = color[j]; c.lineWidth = 3; c.setLineDash(j === 0 ? [] : [8 + j * 2, 4]); c.beginPath(); points.forEach(([xx, yy], n) => n ? c.lineTo(x + 45 + xx / 0.8 * (w - 45), y + h - yy / max * h) : c.moveTo(x + 45 + xx / 0.8 * (w - 45), y + h - yy / max * h)); c.stroke(); c.setLineDash([]);
      c.font = '12px system-ui'; c.fillStyle = color[j]; c.fillText(fleet ? key : `Supply CV ${key}`, x + (j % 3) * 125, y + h + 55 + Math.floor(j / 3) * 18);
    });
    c.fillStyle = '#65766b'; c.font = '14px system-ui'; c.fillText(fleet ? 'Supply variability (CV)' : 'Demand variability (CV)', x + 70, y + h + 30);
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) { reject(new Error('The chart image could not be generated.')); return; }
    resolve(URL.createObjectURL(blob));
  }, 'image/png'));
}
export default function Experiments({ params, initialExperiment, onLoad }: { params: ScenarioParams; initialExperiment: Experiment; onLoad: (p: Partial<ScenarioParams>) => void }) {
  const [experiment, setExperiment] = useState<Experiment>(initialExperiment), [data, setData] = useState<Cached | null>(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const [iterations, setIterations] = useState(300), [source, setSource] = useState('Paper inputs'), worker = useRef<Worker | null>(null), generation = useRef(0);
  const [current, setCurrent] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  useEffect(() => () => { if (exportUrl) URL.revokeObjectURL(exportUrl); }, [exportUrl]);
  useEffect(() => { setExportUrl(''); }, [experiment]);
  useEffect(() => { setExperiment(initialExperiment); }, [initialExperiment]);
  useEffect(() => {
    worker.current?.terminate(); setBusy(false); setProgress(0); setError(''); const id = ++generation.current;
    const stored = cache.get(experiment);
    if (stored) { setData(stored); setSource('Paper inputs · precomputed'); return; }
    setData(null);
    fetch(`${import.meta.env.BASE_URL}precomputed/${experiment}.json`).then(r => { if (!r.ok) throw new Error('Precomputed results are unavailable. Run this experiment to calculate them.'); return r.json(); }).then((d: Cached) => { if (id === generation.current) { cache.set(experiment, d); setData(d); setSource('Paper inputs · precomputed'); } }).catch(e => { if (id === generation.current) setError(e.message); });
    return () => { generation.current++; worker.current?.terminate(); };
  }, [experiment]);
  const run = () => {
    worker.current?.terminate(); generation.current++; setError(''); setProgress(0); setBusy(true);
    const runParams = current ? { ...params, iterations } : paperParams({ iterations });
    const w = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' }); worker.current = w;
    w.onmessage = e => { if (e.data.kind === 'progress') setProgress(e.data.progress); else if (e.data.kind === 'sweep') { setData({ cells: e.data.cells, params: runParams }); setSource(current ? 'Your inputs' : 'Paper inputs'); setBusy(false); } else if (e.data.kind === 'error') { setError(e.data.message); setBusy(false); } };
    w.onerror = () => { setError('The experiment worker could not run.'); setBusy(false); };
    w.postMessage({ kind: 'sweep', params: runParams, experiment });
  };
  const meta = experiments.find(e => e.id === experiment)!, panels = data ? panelsFor(data.cells) : [];
  return <div className="experiments-page"><div className="experiment-tabs" role="group" aria-label="Experiment">{experiments.map(e => <button className={experiment === e.id ? 'active' : ''} key={e.id} onClick={() => setExperiment(e.id)}>{e.name}</button>)}</div><section className="card experiment-toolbar"><div><span className="eyebrow">{meta.figure.toUpperCase()}</span><h2>{meta.name}</h2><p>{meta.text}</p></div><div className="experiment-options"><label><input type="checkbox" checked={current} onChange={e => setCurrent(e.target.checked)}/> Use my sandbox inputs</label><select value={iterations} aria-label="Iterations per experiment cell" onChange={e => setIterations(+e.target.value)}><option value={300}>300 days / cell · fast</option><option value={1000}>1,000 days / cell</option></select><button className="primary-button" onClick={busy ? () => { worker.current?.terminate(); setBusy(false); setError('Run cancelled. Previous completed results remain below.'); } : run}>{busy ? <Square size={14}/> : <Play size={14}/>} {busy ? `Cancel · ${num(progress * 100)}%` : 'Run experiment'}</button></div></section>
    {busy && <div className="experiment-progress"><span style={{ width: `${progress * 100}%` }}/></div>}{error && <div className="inline-error" role="alert">{error}</div>}
    <div className="experiment-note"><FlaskConical size={18}/><p>{experiment === 'private' ? 'Sensitivity extension: the cost split scales proportionally. This split is an app assumption; the published experiment’s cost split has not yet been confirmed.' : experiment === 'fleets' ? 'Fixed hybrid planning extension. Private-only capacity uses μ + 2.33σ by default; all alternatives use the same draws.' : 'These are outputs from the current browser reconstruction. Published results are the validation reference; the implementation has not yet reproduced every benchmark.'}</p></div>
    {exportUrl && <section className="card chart-export"><div><strong>Your chart image is ready</strong><a href={exportUrl} download={`fleet-lab-${experiment}.png`} className="secondary-button"><Download size={14}/> Save PNG</a><button className="text-button" onClick={() => setExportUrl('')}>Close preview</button></div><p>Save the PNG, or right-click the image to save it from the preview.</p><img src={exportUrl} alt="Exported Fleet Lab experiment chart"/></section>}
    {data && <><div className="sweep-meta"><span>{source} · {num(data.params.iterations)} days / cell · seed {data.params.seed} · {data.params.convention}</span><div><button className="text-button" onClick={() => download(`fleet-lab-${experiment}.csv`, csv([['demand_cv', 'supply_cv', 'rho', 'cost_factor', 'mean_conditional_q', 'ci95_lo', 'ci95_hi', 'hybrid_cost', 'pd_only_cost', 'cd_only_cost', 'seed', 'iterations', 'convention'], ...data.cells.map(d => [d.demandCV, d.supplyCV, d.rho, d.costFactor, d.q, d.lo, d.hi, d.costs?.hybrid ?? '', d.costs?.pdOnly ?? '', d.costs?.cdOnly ?? '', data.params.seed, data.params.iterations, data.params.convention])]))}><Download size={14}/> CSV</button><button className="text-button" onClick={() => { exportPng(data.cells, experiment).then(setExportUrl).catch(e => setError(e.message)); }}><Download size={14}/> PNG</button><button className="text-button" onClick={() => download(`fleet-lab-${experiment}-parameters.json`, JSON.stringify(data.params, null, 2), 'application/json')}>Parameters</button></div></div><div className="sweep-grid">{panels.map((panel, i) => {
      const fleet = experiment === 'fleets';
      const chartData = CV_LEVELS.map(cv => {
        if (fleet) return { cv, ...panel.cells.find(d => d.supplyCV === cv)?.costs };
        return Object.fromEntries([['cv', cv], ...CV_LEVELS.map(s => [`s${s}`, panel.cells.find(d => d.supplyCV === s && d.demandCV === cv)?.q])]);
      });
      const series = fleet ? [{ key: 'hybrid', name: 'Fixed hybrid' }, { key: 'pdOnly', name: 'Private only' }, { key: 'cdOnly', name: 'Crowd only' }] : CV_LEVELS.map(cv => ({ key: `s${cv}`, name: `Supply CV ${cv.toFixed(1)}` }));
      return <section className="card sweep-panel" key={i}><div className="chart-heading"><h3>ρ = {panel.rho.toFixed(1)} <span>{panel.rho === 0 ? 'Independent' : panel.rho === 1 ? 'Synchronized' : 'Shared mix'}</span></h3>{panel.factor > 0 && <span className="pill">{experiment === 'failure' ? 'u' : 'a'} = R$ {panel.factor}</span>}</div><span className="axis-note">{fleet ? 'Expected daily cost (R$)' : 'Mean conditional Q* (deliveries / day)'}</span><div className="sweep-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 18, left: 3, bottom: 22 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis dataKey="cv" type="number" domain={[0, 0.8]} ticks={CV_LEVELS} tickLine={false} axisLine={false} fontSize={10} label={{ value: `${fleet ? 'Supply' : 'Demand'} variability (CV)`, position: 'insideBottom', offset: -13, fontSize: 10 }}/><YAxis tickLine={false} axisLine={false} width={48} fontSize={10} tickFormatter={v => fleet ? `${num(v / 1000, 1)}k` : num(v)}/><Tooltip contentStyle={tip} labelFormatter={v => `CV = ${v}`} formatter={(v, name) => [fleet ? money(+v) : num(+v, 1), name]}/>{series.map((s, j) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={color[j]} strokeWidth={2} strokeDasharray={j ? `${j * 2 + 3} 3` : undefined} dot={{ r: 3, strokeWidth: 1, fill: 'var(--card)' }} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div><div className="series-legend">{series.map((s, j) => <span key={s.key}><i style={{ background: color[j] }}/>{s.name}</span>)}</div><button className="text-button explore-panel" onClick={() => onLoad({ ...data.params, supplyCorrelation: panel.rho, demandCV: fleet ? 0.34 : 0.4, supplyCV: 0.4, ...(experiment === 'failure' ? { failedDeliveryCost: panel.factor } : experiment === 'private' ? { pdUnitCost: panel.factor, operatingCost: data.params.operatingCost * panel.factor / data.params.pdUnitCost } : {}) })}>Explore this panel at CV = 0.4 <ArrowUpRight size={14}/></button></section>;
    })}</div><details className="card inspector"><summary>Inspect all {data.cells.length} experiment cells and confidence intervals</summary><div className="table-scroll"><table><thead><tr>{['Demand CV', 'Supply CV', 'ρ', 'Cost factor', 'Mean Q*', '95% CI'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{data.cells.map((d, i) => <tr key={i}><td>{d.demandCV}</td><td>{d.supplyCV}</td><td>{d.rho}</td><td>{d.costFactor || '—'}</td><td>{num(d.q, 1)}</td><td>{num(d.lo, 1)}–{num(d.hi, 1)}</td></tr>)}</tbody></table></div></details></>}
  </div>;
}
