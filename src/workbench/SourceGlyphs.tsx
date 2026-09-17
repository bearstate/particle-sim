import { LADDER, LINAC } from './catalog.ts';

/**
 * Yeni kaynaklarin sematik cizimleri. Hepsi fizikten olceklenir:
 * merdivenin kademe sayisi, suruklenme tuplerinin boylari (LINAC profili).
 */

const STROKE = '#9aa3b5';
const STROKE_DIM = '#4a5262';
const FILL = '#151922';

export interface LadderProps { stages: number; active: boolean; profile?: Float64Array | undefined }

/** Cockcroft-Walton: iki kondansator sutunu, capraz diyotlar. */
export function CockcroftWaltonGlyph(p: LadderProps) {
  const n = Math.max(1, Math.min(12, p.stages));
  const span = LADDER.bottom - LADDER.top - 20;
  const step = span / n;
  const lx = LADDER.cx - 26;
  const rx = LADDER.cx + 26;
  return (
    <g>
      <rect x={20} y={LADDER.top - 8} width={110} height={LADDER.bottom - LADDER.top + 16} rx={6} fill={FILL} stroke={STROKE_DIM} />
      {Array.from({ length: n }, (_, i) => {
        const y = LADDER.bottom - 12 - i * step;
        const cy = y - step / 2;
        const frac = p.profile && p.profile.length ? Math.min(1, (p.profile[Math.min(p.profile.length - 1, i * 2 + 1)] ?? 0) / (p.profile[p.profile.length - 1] || 1)) : (i + 1) / n;
        return (
          <g key={i}>
            {/* kondansatorler: sol ve sag sutunda iki plaka */}
            <line x1={lx - 8} y1={cy - 2} x2={lx + 8} y2={cy - 2} stroke={p.active ? '#ff8a3d' : STROKE} strokeOpacity={p.active ? 0.4 + 0.6 * frac : 1} strokeWidth={2} />
            <line x1={lx - 8} y1={cy + 3} x2={lx + 8} y2={cy + 3} stroke={STROKE} strokeWidth={2} />
            <line x1={rx - 8} y1={cy - 2 + step / 2} x2={rx + 8} y2={cy - 2 + step / 2} stroke={p.active ? '#ff8a3d' : STROKE} strokeOpacity={p.active ? 0.4 + 0.6 * frac : 1} strokeWidth={2} />
            <line x1={rx - 8} y1={cy + 3 + step / 2} x2={rx + 8} y2={cy + 3 + step / 2} stroke={STROKE} strokeWidth={2} />
            {/* capraz diyotlar */}
            <path d={`M${lx + 2} ${y} L${rx - 2} ${cy} l-5 -3 l0 6 z`} fill={STROKE} stroke="none" />
            <path d={`M${rx - 2} ${cy} L${lx + 2} ${cy - step / 2} l5 3 l0 -6 z`} fill={STROKE} stroke="none" />
          </g>
        );
      })}
      <line x1={lx} y1={LADDER.top} x2={lx} y2={LADDER.bottom} stroke={STROKE_DIM} />
      <line x1={rx} y1={LADDER.top} x2={rx} y2={LADDER.bottom} stroke={STROKE_DIM} />
      <text x={LADDER.cx} y={LADDER.bottom + 4} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">~ {n}×</text>
    </g>
  );
}

/** Marx: dikey kondansator yigini, aralarinda kivilcim araliklari. */
export function MarxGlyph(p: LadderProps & { firing?: boolean }) {
  const n = Math.max(2, Math.min(20, p.stages));
  const span = LADDER.bottom - LADDER.top - 20;
  const step = span / n;
  const cx = LADDER.cx;
  return (
    <g>
      <rect x={20} y={LADDER.top - 8} width={110} height={LADDER.bottom - LADDER.top + 16} rx={6} fill={FILL} stroke={STROKE_DIM} />
      {Array.from({ length: n }, (_, i) => {
        const y = LADDER.bottom - 12 - i * step;
        const cy = y - step * 0.55;
        return (
          <g key={i}>
            <rect x={cx - 22} y={cy - 4} width={44} height={8} rx={2} fill={p.active ? 'rgba(255,138,61,0.35)' : FILL} stroke={STROKE} />
            {/* kivilcim araligi: iki kure */}
            <circle cx={cx + 34} cy={cy - step * 0.25} r={2.6} fill={STROKE} />
            <circle cx={cx + 34} cy={cy + step * 0.25} r={2.6} fill={STROKE} />
            {p.firing ? <line x1={cx + 34} y1={cy - step * 0.25 + 2} x2={cx + 34} y2={cy + step * 0.25 - 2} stroke="#dff3ff" strokeWidth={1.4} className="spark" /> : null}
            <line x1={cx - 40} y1={cy} x2={cx - 22} y2={cy} stroke={STROKE_DIM} />
          </g>
        );
      })}
      <line x1={cx - 40} y1={LADDER.top} x2={cx - 40} y2={LADDER.bottom} stroke={STROKE_DIM} strokeDasharray="2 3" />
      <text x={cx} y={LADDER.bottom + 4} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">{n} kademe</text>
    </g>
  );
}

/** Klistron: silindirik tup + dalga kilavuzu cikisi. */
export function KlystronGlyph(p: { active: boolean }) {
  return (
    <g>
      <rect x={14} y={14} width={64} height={56} rx={8} fill={FILL} stroke={STROKE} />
      {[26, 38, 50, 62].map((x) => <line key={x} x1={x} y1={22} x2={x} y2={62} stroke={STROKE_DIM} />)}
      <rect x={78} y={34} width={30} height={16} fill={FILL} stroke={STROKE} />
      {p.active ? <path d="M82 42 q4 -6 8 0 t8 0 t8 0" fill="none" stroke="#46d6c4" strokeWidth={1.6} className="beam-run" strokeDasharray="3 2" /> : null}
      <text x={46} y={80} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">RF</text>
    </g>
  );
}

/** LINAC: suruklenme tupleri, boylari fizikten (profil) olceklenir. */
export function LinacGlyph(p: { lengthsM: Float64Array; active: boolean; arcing: boolean; species: 'electron' | 'proton' }) {
  const n = p.lengthsM.length;
  const total = p.lengthsM.reduce((a, b) => a + b, 0);
  const usable = LINAC.beamEndX - LINAC.beamStartX;
  const gapPx = Math.min(8, usable / Math.max(1, n) * 0.25);
  const scale = total > 0 ? (usable - gapPx * n) / total : 0;
  let x = LINAC.beamStartX;
  const ay = LINAC.axisY;
  return (
    <g>
      <rect x={10} y={22} width={320} height={52} rx={6} fill="rgba(120,160,220,0.05)" stroke={STROKE} />
      {Array.from(p.lengthsM, (l, i) => {
        const w = Math.max(2, l * scale);
        const el = (
          <g key={i}>
            <rect x={x} y={ay - 9} width={w} height={18} rx={3} fill={p.active ? '#2a3140' : FILL} stroke={p.arcing ? '#ff5a5a' : STROKE} />
            {p.active && !p.arcing ? <rect x={x + w} y={ay - 12} width={gapPx} height={24} fill="#46d6c4" opacity={0.25 + 0.5 * ((i % 2) === 0 ? 1 : 0)} className="beam-run" /> : null}
          </g>
        );
        x += w + gapPx;
        return el;
      })}
      <text x={170} y={90} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">{p.species === 'proton' ? 'p⁺' : 'e⁻'} · {n} boşluk</text>
    </g>
  );
}
