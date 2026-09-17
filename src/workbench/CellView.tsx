import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellSolution } from './solve.ts';
import { survivalLQ, damageProfile, LQ_PRESETS } from '../physics/dosimetry/survival.ts';
import { DOSE_BENCHMARKS_GY } from '../physics/dosimetry/dose.ts';
import { si } from '../ui/Controls.tsx';
import { formatSimTime } from './clock.ts';

/**
 * Hucre yakin plani. PHYSICS.md 1.J. EGITIM MODELI.
 *
 * Zar, sitoplazma, cekirdek ve DNA seridi. Isinim carptikca flaslar; biriken
 * doza gore DNA'da kirik isaretleri: dusuk LET'te dagimik tekil noktalar,
 * yuksek LET'te iz boyunca KUMELENMIS cift kiriklar. Hayatta kalma LQ
 * modelinden; S < %1 olunca hucre "olur" (gri, zar bozulur).
 */

const SIZE = 260;
const R_CELL = 112;
const R_NUC = 52;

interface Mark { x: number; y: number; ang: number }

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function helix(sign: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 27; i++) {
    const x = -R_NUC * 0.85 + (i / 26) * R_NUC * 1.7;
    const y = sign * Math.sin(i * 0.45) * 10;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

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

  const marks = useMemo<Mark[]>(() => {
    const n = Math.min(320, dsbBucket * 4);
    const rnd = seeded(7);
    const out: Mark[] = [];
    if (clustered) {
      const tracks = Math.max(1, Math.round(n / 12));
      for (let k = 0; k < tracks; k++) {
        const ang = rnd() * Math.PI * 2;
        const off = (rnd() - 0.5) * R_NUC * 1.2;
        for (let j = 0; j < 12 && out.length < n; j++) {
          const s = -R_NUC + (2 * R_NUC * (j + rnd() * 0.6)) / 12;
          out.push({ x: Math.cos(ang) * s - Math.sin(ang) * off, y: Math.sin(ang) * s + Math.cos(ang) * off, ang });
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(rnd()) * R_NUC * 0.92;
        const a = rnd() * Math.PI * 2;
        out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, ang: 0 });
      }
    }
    return out.filter((m) => Math.hypot(m.x, m.y) < R_NUC * 0.95);
  }, [dsbBucket, clustered]);

  const [flashes, setFlashes] = useState<{ id: number; x: number; y: number; born: number }[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    if (reduce || sol.doseRateGyPerS <= 0) { setFlashes([]); return; }
    const rate = Math.min(24, 2 + Math.log10(1 + sol.doseRateGyPerS * 1e3) * 4);
    let raf = 0;
    let next = performance.now();
    const loop = (now: number) => {
      if (now >= next) {
        next = now + (-Math.log(1 - Math.random()) / rate) * 1000;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * R_CELL * 0.9;
        setFlashes((f) => [...f.filter((x) => now - x.born < 260), { id: idRef.current++, x: Math.cos(a) * r, y: Math.sin(a) * r, born: now }]);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce, sol.doseRateGyPerS]);

  const color = sol.incoming === 'neutrons' ? '#b8c0cc' : sol.incoming === 'protons' ? '#ffb36b' : sol.incoming === 'photons' ? '#c9a6ff' : '#dff3ff';
  const ld50S = sol.doseRateGyPerS > 0 ? DOSE_BENCHMARKS_GY.ld50_60 / sol.doseRateGyPerS : Infinity;

  return (
    <div>
      <svg className="atom" width={SIZE} height={SIZE} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} role="img">
        <circle r={R_CELL} fill={dead ? '#2a2d33' : '#3a2f4a'} stroke={dead ? '#4a4f5a' : '#b98cff'} strokeWidth={2} strokeDasharray={dead ? '6 5' : undefined} opacity={0.9} />
        {!dead
          ? [[-60, 30], [40, -55], [55, 45], [-30, -70]].map(([x, y], i) => (
              <ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill="#5a4a7a" opacity={0.7} transform={`rotate(${i * 40} ${x} ${y})`} />
            ))
          : null}
        <circle r={R_NUC} fill={dead ? '#3a3d45' : '#5b3f8a'} stroke="#c9a6ff" strokeWidth={1.2} />
        <g opacity={dead ? 0.35 : 1}>
          {Array.from({ length: 14 }, (_, i) => {
            const x = -R_NUC * 0.85 + (i / 13) * R_NUC * 1.7;
            const y1 = Math.sin(i * 0.9) * 10;
            return <line key={i} x1={x} y1={-y1 - 3} x2={x} y2={y1 + 3} stroke="#e8dcff" strokeWidth={1.4} />;
          })}
          <path d={helix(1)} fill="none" stroke="#e8dcff" strokeWidth={1.6} />
          <path d={helix(-1)} fill="none" stroke="#e8dcff" strokeWidth={1.6} />
        </g>
        {marks.map((m, i) => (
          <g key={i} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) rotate(${((m.ang * 180) / Math.PI).toFixed(0)})`}>
            <line x1={-2.2} y1={-2.2} x2={2.2} y2={2.2} stroke="#ff5a5a" strokeWidth={1.3} />
            <line x1={-2.2} y1={2.2} x2={2.2} y2={-2.2} stroke="#ff5a5a" strokeWidth={1.3} />
          </g>
        ))}
        {flashes.map((f) => <circle key={f.id} cx={f.x} cy={f.y} r={5} fill={color} opacity={0.8} />)}
        <text x={0} y={SIZE / 2 - 10} fill={dead ? '#ff5a5a' : '#868fa1'} fontSize={11} textAnchor="middle" fontFamily="ui-monospace, monospace">
          {dead ? t('cell.dead') : `S = ${(survival * 100).toFixed(survival > 0.1 ? 0 : 2)} %`}
        </text>
      </svg>
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
