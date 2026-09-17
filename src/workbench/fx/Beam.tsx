import { useMemo, type CSSProperties } from 'react';
import type { BeamSegment } from '../solve.ts';

/**
 * Demet parcaciklari: CSS animasyonu (ana is parcacigi disinda, transform +
 * opacity). Her parcacigin suresi, gecikmesi, dikey ofseti ve titremesi
 * tohumlu RNG'den gelir; boylece akis duzensiz gorunur ama her render'da
 * ayni kalir (React yeniden cizdiginde parcaciklar ziplamaz).
 *
 * Elektron: hizli, sik, ince, mavi-beyaz. X-isini: menekse kisa cizgiler,
 * ileri koni. Notron: gri, yavas, her yone (puskurme) veya alici hedefe.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface ParticleStyle extends CSSProperties {
  '--d': string; '--delay': string; '--len': string; '--ang': string; '--y': string; '--op': string; '--jd': string;
}

const STYLE: Record<BeamSegment['kind'], { color: string; r: number; count: number; speedPxPerS: number; jitter: number; glow: string }> = {
  electron: { color: '#dff3ff', r: 1.6, count: 14, speedPxPerS: 210, jitter: 2.2, glow: 'rgba(143,211,255,0.14)' },
  xray: { color: '#c9a6ff', r: 1.2, count: 9, speedPxPerS: 520, jitter: 1, glow: 'rgba(185,140,255,0.10)' },
  neutron: { color: '#b8c0cc', r: 2.6, count: 12, speedPxPerS: 110, jitter: 1.5, glow: 'rgba(70,214,196,0.10)' },
};

export function BeamParticles(props: { segment: BeamSegment; reduce: boolean }) {
  const { segment: s, reduce } = props;
  const st = STYLE[s.kind];
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = s.spray ? 0 : Math.hypot(dx, dy);
  const baseAng = s.spray ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  const count = Math.max(4, Math.round(st.count * (0.4 + 0.6 * s.intensity)));

  const particles = useMemo(() => {
    const rnd = mulberry32(hash(`${s.sourceId}:${s.kind}:${s.spray ? 'spray' : 'dir'}`));
    const out: { key: number; style: ParticleStyle }[] = [];
    for (let i = 0; i < count; i++) {
      const pl = s.spray ? 80 + rnd() * 110 : len;
      const speed = st.speedPxPerS * (0.75 + rnd() * 0.6);
      const d = Math.max(0.12, pl / speed);
      const ang = s.spray ? rnd() * 360 : baseAng + (rnd() - 0.5) * (s.kind === 'xray' ? 26 : 4);
      out.push({
        key: i,
        style: {
          '--d': `${d.toFixed(3)}s`,
          '--delay': `${(-rnd() * d).toFixed(3)}s`,
          '--len': `${pl.toFixed(1)}px`,
          '--ang': `${ang.toFixed(2)}deg`,
          '--y': `${(st.jitter * (0.4 + rnd())).toFixed(2)}px`,
          '--op': `${(0.55 + rnd() * 0.45).toFixed(2)}`,
          '--jd': `${(60 + rnd() * 90).toFixed(0)}ms`,
        },
      });
    }
    return out;
  }, [s.sourceId, s.kind, s.spray, count, len, baseAng, st]);

  if (reduce) {
    if (s.spray) return <circle cx={s.x1} cy={s.y1} r={40} fill="none" stroke={st.color} strokeOpacity={0.35} strokeDasharray="2 5" />;
    return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={st.color} strokeOpacity={0.5 * s.intensity + 0.2} strokeWidth={s.kind === 'electron' ? 2 : 1} strokeDasharray={s.kind === 'xray' ? '6 4' : undefined} />;
  }

  return (
    <g transform={`translate(${s.x1} ${s.y1})`} pointerEvents="none">
      {!s.spray ? (
        <line x1={0} y1={0} x2={dx} y2={dy} stroke={st.glow} strokeWidth={s.kind === 'electron' ? 7 : 5} strokeLinecap="round" />
      ) : null}
      {particles.map((p) => (
        <g key={p.key} className="bp-move" style={p.style}>
          {s.kind === 'xray' ? (
            <line className="bp-jit" x1={-7} y1={0} x2={0} y2={0} stroke={st.color} strokeWidth={1.4} strokeLinecap="round" style={p.style} />
          ) : (
            <circle className="bp-jit" r={st.r} fill={st.color} style={p.style} />
          )}
        </g>
      ))}
    </g>
  );
}

export function BeamLayer(props: { segments: readonly BeamSegment[]; reduce: boolean }) {
  return (
    <g>
      {props.segments.map((s, i) => (
        <BeamParticles key={`${s.sourceId}-${s.kind}-${s.spray ? 's' : 'd'}-${i}`} segment={s} reduce={props.reduce} />
      ))}
    </g>
  );
}
