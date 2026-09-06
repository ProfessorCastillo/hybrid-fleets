import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Shuffle, Route, ArrowUpRight, PackageCheck, Truck, CircleAlert } from 'lucide-react';
import { fork } from '../../../packages/core/src';
import type { Allocation, ScenarioResult } from '../../../packages/core/src';
import { num, money } from '../lib';
import { Slider } from './Controls';

type Point = [number, number];
type Packet = { type: 'pd' | 'cd' | 'missed'; weight: number; points: Point[]; start: number; finish: number; variant: number };
const colors = { pd: '#28775d', cd: '#d28b34', missed: '#bd5850' };
const W = 1100, H = 540;
const depot: Point = [495, 280];

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}
function baseMap(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = W * 2; canvas.height = H * 2;
  const c = canvas.getContext('2d')!; c.scale(2, 2);
  c.fillStyle = '#eff0e7'; c.fillRect(0, 0, W, H);
  const r = fork(789, 1);
  // A synthetic district: blocks and road intersections are generated independently of model supply.
  for (let x = -85; x < W; x += 145) for (let y = -35; y < H; y += 105) {
    const park = r() < 0.17;
    roundRect(c, x + 16, y + 16, 113, 73, 10, park ? '#d5e3cb' : '#e3e5dc', park ? '#cfddc8' : '#dce0d6');
    if (park) {
      c.strokeStyle = '#eaf0e0'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 25, y + 80); c.bezierCurveTo(x + 60, y + 15, x + 85, y + 90, x + 120, y + 25); c.stroke();
      for (let i = 0; i < 8; i++) { const tx = x + 26 + r() * 91, ty = y + 24 + r() * 52; c.beginPath(); c.ellipse(tx + 2, ty + 3, 6, 4, 0, 0, 7); c.fillStyle = '#becfb6'; c.fill(); c.beginPath(); c.arc(tx, ty, 4 + r() * 3, 0, 7); c.fillStyle = r() > 0.5 ? '#a9c69b' : '#b7cfa6'; c.fill(); }
    } else {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const bx = x + 24 + i * 52, by = y + 22 + j * 31, bw = 35 + r() * 11, bh = 19 + r() * 7;
        roundRect(c, bx + 2, by + 3, bw, bh, 3, '#cfd4c9');
        roundRect(c, bx, by, bw, bh, 3, ['#f6f4eb', '#e9e8de', '#dedfd5'][Math.floor(r() * 3)], '#d5d9ce');
        c.fillStyle = '#d1d6cd'; c.fillRect(bx + bw - 12, by + 5, 5, 4);
      }
    }
  }
  const road = (pts: Point[], arterial = false) => {
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.lineWidth = arterial ? 24 : 18; c.strokeStyle = '#d8ddd2'; c.stroke();
    c.lineWidth = arterial ? 21 : 15; c.strokeStyle = '#fafaf4'; c.stroke();
    if (arterial) { c.setLineDash([5, 8]); c.strokeStyle = '#d8ddcd'; c.lineWidth = 1; c.stroke(); c.setLineDash([]); }
  };
  for (let x = 60; x < W; x += 145) road([[x, 0], [x, H]], x === 495);
  for (let y = 70; y < H; y += 105) road([[0, y], [W, y]], y === 280);
  // River at the district's eastern edge, crossed by two illustrative bridges.
  c.beginPath(); c.moveTo(1040, -20); c.bezierCurveTo(970, 160, 1130, 250, 1020, 380); c.bezierCurveTo(980, 450, 900, 450, 910, 560); c.lineTo(1150, 560); c.lineTo(1150, -20); c.closePath(); c.fillStyle = '#c6dfda'; c.fill(); c.strokeStyle = '#abcfc5'; c.lineWidth = 5; c.stroke();
  road([[930, 175], [W, 175]], true); road([[930, 385], [W, 385]], true);
  c.fillStyle = '#85998d'; c.font = '10px system-ui'; c.letterSpacing = '2px';
  c.fillText('JARDIM DISTRICT', 221, 123); c.fillText('CENTRO', 578, 333); c.fillText('RIVERSIDE', 793, 445);
  c.letterSpacing = '0px'; c.fillStyle = '#a4afa1'; c.font = '9px system-ui';
  c.fillText('AVENIDA CENTRAL', 345, 268); c.fillText('RUA DAS FLORES', 70, 373);
  // Depot with an actual symbol at the origin of every animated route.
  c.fillStyle = '#28664f'; c.beginPath(); c.arc(...depot, 19, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(484, 278); c.lineTo(495, 270); c.lineTo(506, 278); c.lineTo(506, 290); c.lineTo(484, 290); c.closePath(); c.stroke(); c.strokeRect(491, 282, 8, 8);
  roundRect(c, 440, 303, 110, 25, 6, '#fffef9', '#dae2d5'); c.font = '600 10px system-ui'; c.fillStyle = '#315443'; c.textAlign = 'center'; c.fillText('DISPATCH HUB', 495, 319); c.textAlign = 'left';
  return canvas;
}

function packetsFor(a: Allocation, seed: number): Packet[] {
  const r = fork(seed, 912), groups: { type: Packet['type']; amount: number; variant: number }[] = [{ type: 'pd', amount: a.pd, variant: 0 }, ...a.tierUsed.map((amount, i) => ({ type: 'cd' as const, amount, variant: i })), { type: 'missed', amount: a.missed, variant: 0 }];
  const packets: Packet[] = [];
  groups.filter(g => g.amount > 1e-9).forEach(g => {
    const n = Math.max(1, Math.round(g.amount / Math.max(1, a.demand) * 72));
    for (let i = 0; i < n; i++) {
      let dest: Point = [60 + Math.floor(r() * 7) * 145, 70 + Math.floor(r() * 5) * 105];
      if (dest[0] === depot[0] && dest[1] === depot[1]) dest = [350, 175];
      const bend: Point = r() > 0.5 ? [depot[0], dest[1]] : [dest[0], depot[1]];
      const start = r() * 0.74, finish = Math.min(0.985, start + 0.10 + r() * 0.16);
      packets.push({ type: g.type, weight: g.amount / n, points: [depot, bend, dest], start, finish, variant: g.variant });
    }
  });
  return packets;
}
function routePosition(points: Point[], t: number): { x: number; y: number; angle: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let distance = Math.max(0, Math.min(1, t)) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) { const f = lengths[i] ? distance / lengths[i] : 0; return { x: points[i][0] + (points[i + 1][0] - points[i][0]) * f, y: points[i][1] + (points[i + 1][1] - points[i][1]) * f, angle: Math.atan2(points[i + 1][1] - points[i][1], points[i + 1][0] - points[i][0]) }; }
    distance -= lengths[i];
  }
  return { x: depot[0], y: depot[1], angle: 0 };
}
export default function Simulation({ result, policy, day, setDay, allocation }: { result: ScenarioResult; policy: string; day: number; setDay: (n: number) => void; allocation: Allocation }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), base = useMemo(baseMap, []);
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [progress, setProgress] = useState(0), [speed, setSpeed] = useState(1), [showRoutes, setShowRoutes] = useState(true);
  const packets = useMemo(() => packetsFor(allocation, result.params.seed + day), [allocation, result.params.seed, day]);
  useEffect(() => { setProgress(0); }, [packets]);
  useEffect(() => {
    if (!playing) return;
    let frame: number, last = performance.now();
    const tick = (now: number) => { const delta = Math.min(now - last, 100); last = now; setProgress(t => Math.min(1, t + delta * speed / 36000)); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => { if (progress >= 1) setPlaying(false); }, [progress]);
  const complete = { pd: 0, cd: 0, missed: 0 }, active = { pd: 0, cd: 0 };
  packets.forEach(p => { if (progress >= p.finish) complete[p.type] += p.weight; else if (progress >= p.start && p.type !== 'missed') active[p.type] += p.weight; });
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const c = canvas.getContext('2d')!; c.clearRect(0, 0, W * 2, H * 2); c.save(); c.scale(2, 2); c.drawImage(base, 0, 0, W, H);
    packets.forEach(p => {
      const end = p.points.at(-1)!;
      if (p.type !== 'missed' && showRoutes && progress >= p.start && progress < p.finish) {
        c.beginPath(); p.points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = colors[p.type] + '32'; c.lineWidth = 3; c.stroke();
      }
      if (progress >= p.finish) {
        c.beginPath(); c.arc(end[0] + (p.variant % 3 - 1) * 5, end[1] - 5, 4, 0, Math.PI * 2); c.fillStyle = colors[p.type]; c.globalAlpha = 0.65; c.fill(); c.globalAlpha = 1;
        if (p.type === 'missed') { c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(end[0] - 2 - 5, end[1] - 7); c.lineTo(end[0] + 2 - 5, end[1] - 3); c.moveTo(end[0] + 2 - 5, end[1] - 7); c.lineTo(end[0] - 2 - 5, end[1] - 3); c.stroke(); }
      } else if (p.type !== 'missed' && progress >= p.start) {
        const pos = routePosition(p.points, (progress - p.start) / (p.finish - p.start));
        c.save(); c.translate(pos.x, pos.y); c.rotate(pos.angle);
        c.shadowColor = '#28443130'; c.shadowBlur = 6; c.shadowOffsetY = 2;
        roundRect(c, -8, -5, 16, 10, 3, colors[p.type], '#fff'); c.shadowBlur = 0; c.shadowOffsetY = 0;
        c.fillStyle = '#f4f7ea'; c.fillRect(3, -3, 3, 6); c.fillStyle = '#253f32'; c.fillRect(-5, -6, 4, 2); c.fillRect(-5, 4, 4, 2); c.restore();
      } else { c.beginPath(); c.arc(end[0], end[1], 2.6, 0, 7); c.strokeStyle = '#97a69788'; c.lineWidth = 1; c.stroke(); }
    });
    c.restore();
  }, [base, packets, progress, showRoutes]);
  const handled = complete.pd + complete.cd;
  const hours = 8 + progress * 10, clock = `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor(hours % 1 * 60)).padStart(2, '0')}`;
  return <section className="simulation card"><div className="simulation-heading"><div><span className="eyebrow">THE DELIVERY DISTRICT</span><h2>Watch your fleet in motion<span className="small-live"><span className={playing ? 'status-dot pulse' : 'status-dot'}/>{playing ? 'RUNNING' : progress === 1 ? 'DAY COMPLETE' : 'PAUSED'}</span></h2></div><div className="sim-day"><span>Simulated day</span><label className="day-field"><span className="sr-only">Simulated day number</span><input type="number" min={1} max={result.iterations.length} value={day + 1} onChange={e => setDay(Math.min(result.iterations.length - 1, Math.max(0, +e.target.value - 1)))}/><span>/ {num(result.iterations.length)}</span></label></div></div>
    <div className="map-stage"><canvas ref={canvasRef} width={W * 2} height={H * 2} role="img" aria-label={`Illustrative delivery district. Day ${day + 1}: ${num(allocation.demand)} orders, ${num(allocation.pd)} assigned to private capacity, ${num(allocation.cd)} to crowd capacity, ${num(allocation.missed)} without capacity.`}/><div className="map-topline"><span className="map-tag"><span className="map-dot"/> SYNTHETIC URBAN DISTRICT</span><button className={showRoutes ? 'map-button active' : 'map-button'} onClick={() => setShowRoutes(!showRoutes)} aria-pressed={showRoutes}><Route size={14}/> Routes</button></div><div className="map-day-card"><span>Today’s demand</span><strong>{num(allocation.demand)} <small>orders</small></strong><div><span className="legend-dot pd"/> {num(allocation.q)} private slots</div><div><span className="legend-dot cd"/> {num(result.iterations[day].supply.reduce((s, b) => s + b, 0))} crowd slots</div></div><div className="map-compass"><ArrowUpRight size={23}/><span>N</span></div><div className="map-bottom"><span>Each vehicle represents a batch of deliveries</span><span className="map-scale">━━  Illustrative map</span></div></div>
    <div className="playback"><button className="play-button" aria-label={playing ? 'Pause simulation' : 'Play simulation'} onClick={() => { if (progress === 1) setProgress(0); setPlaying(!playing); }}>{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button><button className="icon-button" aria-label="Restart simulated day" title="Restart day" onClick={() => { setProgress(0); setPlaying(true); }}><RotateCcw size={16}/></button><span className="clock">{clock}</span><label className="timeline"><span className="sr-only">Day progress</span><input type="range" min={0} max={1} step={0.001} value={progress} onChange={e => { setPlaying(false); setProgress(+e.target.value); }}/></label><span className="end-clock">18:00</span><select className="speed-select" aria-label="Playback speed" value={speed} onChange={e => setSpeed(+e.target.value)}>{[0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}×</option>)}</select><button className="next-day" onClick={() => { setDay((day + 1) % result.iterations.length); setPlaying(true); }}><Shuffle size={15}/><span>Next day</span></button></div>
    <div className="sim-stats"><div><PackageCheck size={17}/><span>Replayed assignments<strong>{num(handled)} <small>/ {num(allocation.demand)}</small></strong></span></div><div><Truck size={17}/><span>In motion<strong>{num(active.pd + active.cd)} <small>orders</small></strong></span></div><div className={allocation.missed > 0 ? 'missed-stat' : ''}><CircleAlert size={17}/><span>Without capacity<strong>{num(complete.missed)} <small>/ {num(allocation.missed)} this day</small></strong></span></div><div><span className="cost-symbol">R$</span><span>Day’s total cost<strong>{money(allocation.total)}</strong></span></div></div>
    <div className="sim-caption"><div className="legend"><span><i className="legend-dot pd"/>Private fleet</span><span><i className="legend-dot cd"/>Crowd fleet</span><span><i className="legend-dot missed"/>Unassigned</span></div><span>{policy === 'custom' ? 'Custom' : policy === 'pdOnly' ? 'Private-only' : policy === 'cdOnly' ? 'Crowd-only' : 'Fixed hybrid'} policy · Routes and clock are illustrative; costs use the model.</span></div>
  </section>;
}
