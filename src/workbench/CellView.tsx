import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellSolution } from './solve.ts';
import { survivalLQ, damageProfile, LQ_PRESETS } from '../physics/dosimetry/survival.ts';
import { DOSE_BENCHMARKS_GY } from '../physics/dosimetry/dose.ts';
import { si } from '../ui/Controls.tsx';
import { formatSimTime } from './clock.ts';
import { baseAt, helixPoint, planTrack, spacing, stepLesions, type DnaGeom, type Lesion, type Track, type TrackKind } from './dna.ts';

/**
 * Hucre yakin plani. PHYSICS.md 1.J. EGITIM MODELI.
 *
 * Ustte hucre (zar, sitoplazma, cekirdek), altta cekirdekten buyutulmus DNA
 * cift sarmali. Isinim izleri seritte oynar (dna.ts planlar): foton Compton
 * elektronu firlatir, elektron seyrek iyonlasir, OH* radikalleri omurgaya
 * yurur; proton / geri tepen proton yogun iz birakir. Lezyonlar sarmalda
 * kalir: SSB tek omurgada bosluk, DSB iki omurga + basamak kopuk ve iki
 * parca birbirinden ayrilir, baz hasari basamak yarisi kararir. Onarim:
 * SSB saniyeler (dakika), DSB uzun; kumelenmis DSB kalici.
 * Sayimlar telemetri degildir; telemetri survival.ts'den gelir.
 */

const W = 260;
const H = 380;
const CELL = { cx: 130, cy: 96, r: 74, rn: 32 } as const;
const STRIP = { x: 6, y: 214, w: 248, h: 136 } as const;
const G: DnaGeom = { x0: 22, x1: 238, y: 282, amp: 20, bp: 40, top: STRIP.y, bottom: STRIP.y + STRIP.h };
const BASE_COLORS = ['#ffb35a', '#5ac8ff', '#7bed9f', '#ff7b9c'] as const;
const COLOR: Record<TrackKind, string> = { photon: '#c9a6ff', electron: '#8fd3ff', proton: '#ffb36b', neutron: '#b8c0cc' };

interface Mark { x: number; y: number; ang: number }

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function poly(pts: readonly { x: number; y: number }[], upTo = 1): string {
  if (pts.length < 2) return '';
  const total = pts.slice(1).reduce((acc, p, i) => acc + Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y), 0);
  let left = total * Math.max(0, Math.min(1, upTo));
  const out = [`M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`];
  for (let i = 1; i < pts.length && left > 0; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const f = Math.min(1, left / len);
    out.push(`L${(a.x + (b.x - a.x) * f).toFixed(1)},${(a.y + (b.y - a.y) * f).toFixed(1)}`);
    left -= len;
  }
  return out.join(' ');
}

function wavyPath(pts: readonly { x: number; y: number }[], upTo: number): string {
  const a = pts[0]!;
  const b = pts[1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) * Math.max(0, Math.min(1, upTo));
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const out: string[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const off = Math.sin(f * Math.PI * 7) * 3;
    out.push(`${i === 0 ? 'M' : 'L'}${(a.x + Math.cos(dir) * len * f - Math.sin(dir) * off).toFixed(1)},${(a.y + Math.sin(dir) * len * f + Math.cos(dir) * off).toFixed(1)}`);
  }
  return out.join(' ');
}

/** Zar: apoptozda kabarciklar (bleb). */
function membranePath(cx: number, cy: number, r: number, dead: boolean, t: number): string {
  const n = 48;
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bump = dead ? 1 + 0.09 * Math.max(0, Math.sin(a * 7 + t * 0.0006)) + 0.05 * Math.sin(a * 3 - t * 0.0004) : 1 + 0.012 * Math.sin(a * 5 + t * 0.0008);
    out.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r * bump).toFixed(1)},${(cy + Math.sin(a) * r * bump).toFixed(1)}`);
  }
  return out.join(' ') + ' Z';
}

interface Live { tracks: Track[]; lesions: Lesion[]; applied: Set<number> }

export function CellView(props: { sol: CellSolution; accumulatedGy: number; irradiatedS: number; tissue: keyof typeof LQ_PRESETS; reduce: boolean; lang: 'tr' | 'en' }) {
  const { sol, accumulatedGy, tissue, reduce } = props;
  const { t } = useTranslation();
  const lq = LQ_PRESETS[tissue];
  const eqGy = accumulatedGy * sol.wR;
  const survival = survivalLQ(eqGy, lq.alpha, lq.beta);
  const dmg = damageProfile(accumulatedGy, sol.letKeVPerUm || 0.25);
  const dead = survival < 0.01;
  const clustered = sol.letKeVPerUm > 10;
  const dsbBucket = Math.round(dmg.doubleStrandBreaks / 4);
  const kind: TrackKind | null = sol.incoming === 'photons' ? 'photon' : sol.incoming === 'electrons' ? 'electron' : sol.incoming === 'protons' ? 'proton' : sol.incoming === 'neutrons' ? 'neutron' : null;
  const rate = sol.doseRateGyPerS > 0 ? Math.min(2.5, 0.35 + Math.log10(1 + sol.doseRateGyPerS * 1e3) * 0.7) : 0;

  // Cekirdek isaretleri: birikmis doza gore, dusuk LET dagimik / yuksek LET iz boyunca.
  const marks = useMemo<Mark[]>(() => {
    const n = Math.min(200, dsbBucket * 3);
    const rnd = seeded(7);
    const out: Mark[] = [];
    const R = CELL.rn;
    if (clustered) {
      const tracks = Math.max(1, Math.round(n / 10));
      for (let k = 0; k < tracks; k++) {
        const ang = rnd() * Math.PI * 2;
        const off = (rnd() - 0.5) * R * 1.2;
        for (let j = 0; j < 10 && out.length < n; j++) {
          const s = -R + (2 * R * (j + rnd() * 0.6)) / 10;
          out.push({ x: Math.cos(ang) * s - Math.sin(ang) * off, y: Math.sin(ang) * s + Math.cos(ang) * off, ang });
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(rnd()) * R * 0.92;
        const a = rnd() * Math.PI * 2;
        out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, ang: 0 });
      }
    }
    return out.filter((m) => Math.hypot(m.x, m.y) < R * 0.95);
  }, [dsbBucket, clustered]);

  // Canli izler ve lezyonlar (ref'te; React yalnizca her ikinci karede cizer).
  const live = useRef<Live>({ tracks: [], lesions: [], applied: new Set() });
  const idRef = useRef(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let next = performance.now() + 400;
    let frame = 0;
    const loop = (tt: number) => {
      const L = live.current;
      if (kind && rate > 0 && tt >= next) {
        next = tt + (-Math.log(1 - Math.random()) / rate) * 1000;
        L.tracks.push(planTrack(kind, G, tt, () => ++idRef.current, Math.random));
      }
      for (const tr of L.tracks) {
        if (!L.applied.has(tr.id) && tt - tr.born >= tr.hitAt) {
          L.applied.add(tr.id);
          L.lesions.push(...tr.lesions.map((l) => ({ ...l, born: tt })));
        }
      }
      L.tracks = L.tracks.filter((tr) => tt - tr.born < tr.dur);
      L.lesions = stepLesions(L.lesions, tt);
      if ((frame++ & 1) === 0) setNow(tt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce, kind, rate]);

  const { tracks, lesions } = live.current;
  const phase = reduce ? 0 : now * 0.0009;
  const pts = [0, 1].map((s) => Array.from({ length: G.bp }, (_, i) => helixPoint(G, i, s as 0 | 1, phase)));
  const cut: [Set<number>, Set<number>] = [new Set(), new Set()];
  const dsbAt = new Map<number, Lesion>();
  const baseDmg = new Map<number, 0 | 1>();
  for (const l of lesions) {
    if (l.kind === 'dsb') { dsbAt.set(l.i, l); cut[0].add(l.i); cut[1].add(l.i); }
    else if (l.kind === 'ssb') cut[l.strand].add(l.i);
    else baseDmg.set(l.i, l.strand);
  }
  const breaks = [...dsbAt.keys()].sort((a, b) => a - b);
  const offY = (i: number): number => {
    let j = 0;
    while (j < breaks.length && breaks[j]! <= i) j++;
    if (j === 0) return 0;
    const b = dsbAt.get(breaks[j - 1]!)!;
    const drift = Math.min(1, (now - b.born) / 600);
    return (j % 2 ? 1 : -1) * 3.5 * drift;
  };
  const P = (s: 0 | 1, i: number) => { const p = pts[s]![i]!; return { x: p.x, y: p.y + offY(i), z: p.z }; };
  const bpX = (i: number) => G.x0 + i * spacing(G);
  const ld50S = sol.doseRateGyPerS > 0 ? DOSE_BENCHMARKS_GY.ld50_60 / sol.doseRateGyPerS : Infinity;
  const mono = 'ui-monospace, monospace';
  const nucleusFrag = useMemo(() => [[-12, -8, 9], [10, -10, 7], [-4, 12, 8], [14, 8, 6], [-16, 6, 5]] as const, []);

  return (
    <div>
      <svg className="atom" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        <defs>
          <clipPath id="dnaClip"><rect x={STRIP.x} y={STRIP.y} width={STRIP.w} height={STRIP.h} rx={8} /></clipPath>
        </defs>
        {/* Hucre */}
        <path d={membranePath(CELL.cx, CELL.cy, CELL.r, dead, now)} fill={dead ? '#2a2d33' : '#3a2f4a'} stroke={dead ? '#4a4f5a' : '#b98cff'} strokeWidth={2} strokeDasharray={dead ? '6 5' : undefined} opacity={0.92} />
        {[[-52, 26], [36, -48], [48, 40], [-26, -60]].map(([x, y], i) => (
          <ellipse key={i} cx={CELL.cx + x!} cy={CELL.cy + y!} rx={9} ry={5} fill="#5a4a7a" opacity={dead ? 0.25 : 0.7} transform={`rotate(${i * 40} ${CELL.cx + x!} ${CELL.cy + y!})`} />
        ))}
        {dead ? (
          nucleusFrag.map(([x, y, r], i) => <circle key={i} cx={CELL.cx + x} cy={CELL.cy + y} r={r} fill="#3a3d45" stroke="#8a7fa8" strokeWidth={1} />)
        ) : (
          <g transform={`translate(${CELL.cx} ${CELL.cy})`}>
            <circle r={CELL.rn} fill="#5b3f8a" stroke="#c9a6ff" strokeWidth={1.2} />
            {marks.map((m, i) => (
              <g key={i} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) rotate(${((m.ang * 180) / Math.PI).toFixed(0)})`}>
                <line x1={-1.6} y1={-1.6} x2={1.6} y2={1.6} stroke="#ff5a5a" strokeWidth={1.1} />
                <line x1={-1.6} y1={1.6} x2={1.6} y2={-1.6} stroke="#ff5a5a" strokeWidth={1.1} />
              </g>
            ))}
            {tracks.filter((tr) => now - tr.born < 260).map((tr) => {
              const a = (tr.id * 2.399) % (Math.PI * 2);
              const r = (((tr.id * 7919) % 100) / 100) * CELL.rn * 0.8;
              return <circle key={tr.id} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={4} fill={COLOR[tr.kind]} opacity={0.8} />;
            })}
          </g>
        )}
        {/* Buyutme konisi */}
        <polygon points={`${CELL.cx - CELL.rn * 0.7},${CELL.cy + CELL.rn * 0.7} ${CELL.cx + CELL.rn * 0.7},${CELL.cy + CELL.rn * 0.7} ${STRIP.x + STRIP.w},${STRIP.y} ${STRIP.x},${STRIP.y}`} fill="#b98cff" opacity={0.06} />
        <line x1={CELL.cx - CELL.rn * 0.7} y1={CELL.cy + CELL.rn * 0.7} x2={STRIP.x} y2={STRIP.y} stroke="#b98cff" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5} />
        <line x1={CELL.cx + CELL.rn * 0.7} y1={CELL.cy + CELL.rn * 0.7} x2={STRIP.x + STRIP.w} y2={STRIP.y} stroke="#b98cff" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5} />
        {/* DNA seridi */}
        <rect x={STRIP.x} y={STRIP.y} width={STRIP.w} height={STRIP.h} rx={8} fill="#1b1230" stroke="#5b3f8a" strokeWidth={1} />
        <g clipPath="url(#dnaClip)" opacity={dead ? 0.55 : 1}>
          {Array.from({ length: G.bp }, (_, i) => {
            if (dsbAt.has(i)) return null;
            const a = P(0, i);
            const b = P(1, i);
            const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const base = baseAt(i);
            const o = 0.5 + 0.4 * ((a.z + 1) / 2);
            const dmgS = baseDmg.get(i);
            return (
              <g key={i} opacity={o}>
                <line x1={a.x} y1={a.y} x2={m.x} y2={m.y} stroke={dmgS === 0 ? '#d94fff' : BASE_COLORS[base]} strokeWidth={dmgS === 0 ? 3 : 2.2} strokeLinecap="round" />
                <line x1={m.x} y1={m.y} x2={b.x} y2={b.y} stroke={dmgS === 1 ? '#d94fff' : BASE_COLORS[base ^ 1]} strokeWidth={dmgS === 1 ? 3 : 2.2} strokeLinecap="round" />
              </g>
            );
          })}
          {([0, 1] as const).map((s) =>
            Array.from({ length: G.bp - 1 }, (_, i) => {
              if (cut[s].has(i) || cut[s].has(i + 1)) return null;
              const a = P(s, i);
              const b = P(s, i + 1);
              const front = (a.z + b.z) / 2 > 0;
              return <line key={`${s}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={front ? '#efe6ff' : '#8f7fb8'} strokeWidth={front ? 2.4 : 1.6} strokeLinecap="round" />;
            }),
          )}
          {lesions.map((l) => {
            const p = P(l.strand, l.i);
            const age = now - l.born;
            const fresh = Math.max(0, 1 - age / 350);
            const col = l.kind === 'dsb' ? '#ff5a5a' : l.kind === 'ssb' ? '#ffb35a' : '#d94fff';
            const cx = l.kind === 'dsb' ? bpX(l.i) : p.x;
            const cy = l.kind === 'dsb' ? G.y + offY(l.i) : p.y;
            return (
              <g key={l.id}>
                {fresh > 0 ? <circle cx={cx} cy={cy} r={4 + 8 * fresh} fill={col} opacity={0.5 * fresh} /> : null}
                {l.kind === 'dsb' ? (
                  <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)})`} opacity={l.clustered ? 0.95 : 0.8}>
                    <line x1={-3} y1={-3} x2={3} y2={3} stroke={col} strokeWidth={1.4} />
                    <line x1={-3} y1={3} x2={3} y2={-3} stroke={col} strokeWidth={1.4} />
                  </g>
                ) : l.kind === 'ssb' ? (
                  <circle cx={cx} cy={cy} r={2} fill="none" stroke={col} strokeWidth={1.2} opacity={0.85} />
                ) : null}
              </g>
            );
          })}
          {tracks.map((tr) => {
            const age = now - tr.born;
            const fade = age < 900 ? 1 : Math.max(0, 1 - (age - 900) / (tr.dur - 900));
            const sec = tr.kind === 'photon' ? COLOR.electron : tr.kind === 'neutron' ? COLOR.proton : COLOR[tr.kind];
            const p1 = Math.min(1, age / 300);
            const p2 = Math.max(0, Math.min(1, (age - 300) / 400));
            const scatter = tr.primary ? tr.primary[tr.primary.length - 1]! : null;
            return (
              <g key={tr.id} opacity={fade}>
                {tr.primary ? (
                  tr.kind === 'photon'
                    ? <path d={wavyPath(tr.primary, p1)} fill="none" stroke={COLOR.photon} strokeWidth={1.6} strokeLinecap="round" />
                    : <path d={poly(tr.primary, p1)} fill="none" stroke={COLOR.neutron} strokeWidth={1.4} strokeDasharray="3 3" />
                ) : null}
                {scatter && age > 280 && age < 700 ? (
                  <g>
                    <circle cx={scatter.x} cy={scatter.y} r={5 * (1 - (age - 280) / 420)} fill="#ffffff" opacity={0.6} />
                    {tr.kind === 'neutron' ? <text x={scatter.x + 6} y={scatter.y - 5} fill="#ffd27a" fontSize={9} fontFamily={mono}>H</text> : null}
                  </g>
                ) : null}
                <path d={poly(tr.secondary, p2)} fill="none" stroke={sec} strokeWidth={tr.dense ? 2.4 : 1.1} strokeLinecap="round" opacity={0.9} />
                {age > 300 ? tr.ions.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={tr.dense ? 1.1 : 1.5} fill={sec} opacity={0.8} />) : null}
                {tr.exit && age > 500 ? <path d={poly(tr.exit, Math.min(1, (age - 500) / 500))} fill="none" stroke={COLOR.neutron} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} /> : null}
                {age > 600 && age < 1350 ? tr.radicals.map((r, i) => {
                  const u = Math.min(1, (age - 600) / 700);
                  const ez = u * u * (3 - 2 * u);
                  const x = r.x + (r.tx - r.x) * ez;
                  const y = r.y + (r.ty - r.y) * ez;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={2} fill="#ffe07a" opacity={0.9} />
                      {i === 0 ? <text x={x + 4} y={y - 3} fill="#ffe07a" fontSize={8} fontFamily={mono}>OH•</text> : null}
                    </g>
                  );
                }) : null}
              </g>
            );
          })}
        </g>
        <text x={STRIP.x + 6} y={STRIP.y + 12} fill="#868fa1" fontSize={9} fontFamily={mono}>{t('cell.dna')}</text>
        <text x={W / 2} y={H - 8} fill={dead ? '#ff5a5a' : '#868fa1'} fontSize={11} textAnchor="middle" fontFamily={mono}>
          {dead ? t('cell.dead') : `S = ${(survival * 100).toFixed(survival > 0.1 ? 0 : 2)} %`}
        </text>
      </svg>
      <div className="legend">
        <span><i style={{ background: '#ffb35a' }} />{t('cell.legend_ssb')}</span>
        <span><i style={{ background: '#ff5a5a' }} />{t('cell.legend_dsb')}</span>
        <span><i style={{ background: '#d94fff' }} />{t('cell.legend_base')}</span>
        <span><i style={{ background: '#ffe07a' }} />{t('cell.legend_radical')}</span>
        <span><i style={{ background: '#8fd3ff' }} />{t('cell.legend_ion')}</span>
      </div>
      <p className="note">{kind === 'proton' || kind === 'neutron' ? t('cell.dense') : kind ? t('cell.sparse') : ''} {t('cell.repair')}{dead ? ` ${t('cell.apoptosis')}` : ''}</p>
      <dl className="facts">
        <dt>{t('cell.doseRate')}</dt><dd className={sol.doseRateGyPerS > 0 ? 'warn' : ''}>{sol.doseRateGyPerS > 0 ? `${si(sol.doseRateGyPerS, 2)}Gy/s` : '—'}</dd>
        <dt>{t('cell.equivalent')}</dt><dd>{sol.doseRateSvPerS > 0 ? `${si(sol.doseRateSvPerS * 3600, 2)}Sv/h · w_R ${sol.wR}` : '—'}</dd>
        <dt>{t('cell.dose')}</dt><dd className={accumulatedGy > DOSE_BENCHMARKS_GY.ld50_60 ? 'warn' : ''}>{si(accumulatedGy, 2)}Gy · {si(eqGy, 2)}Sv</dd>
        <dt>{t('cell.survival')}</dt><dd className={dead ? 'warn' : 'ok'}>{(survival * 100).toPrecision(3)} %</dd>
        <dt>{t('cell.dsb')}</dt><dd>{si(dmg.doubleStrandBreaks, 2)}</dd>
        <dt>{t('cell.ssb')}</dt><dd>{si(dmg.singleStrandBreaks, 2)}</dd>
        <dt>{t('cell.let')}</dt><dd>{sol.letKeVPerUm > 0 ? `${sol.letKeVPerUm.toFixed(1)} keV/µm` : '—'}</dd>
        <dt>{t('cell.lethalIn')}</dt><dd>{Number.isFinite(ld50S) ? formatSimTime(ld50S, props.lang) : '—'}</dd>
      </dl>
      <p className="note" style={{ marginTop: 8 }}>{t('cell.ld50')} · {t('cell.disclaimer')}</p>
    </div>
  );
}
