import type { DeviceKind, ParamValue } from './model.ts';
import { specOf } from './catalog.ts';

/**
 * Cihazlarin sematik cizimleri. Teknik cizim estetigi: ince cizgi, az dolgu,
 * fiziksel olarak dogru parcalar (kayis, taraklar, kure; katot/anot; hedef).
 * Origin cihazin sol ust kosesi; parent <g transform> ile tasir.
 */

export interface GlyphProps {
  readonly kind: DeviceKind;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly selected: boolean;
  /** Enerjili/aktif: kure yuklu, tupte demet, hedef isiniyor. */
  readonly active: boolean;
  /** 0..1 isinma gostergesi (hedef/anot). */
  readonly heat?: number;
}

const STROKE = '#9aa3b5';
const STROKE_DIM = '#4a5262';
const FILL = '#151922';

export function DeviceGlyph(props: GlyphProps) {
  const spec = specOf(props.kind);
  return (
    <g>
      {props.selected ? (
        <rect x={-6} y={-6} width={spec.w + 12} height={spec.h + 12} rx={10} fill="none" stroke="#4da3ff" strokeDasharray="4 4" />
      ) : null}
      {props.kind === 'vandegraaff' ? <VanDeGraaff {...props} /> : null}
      {props.kind === 'tube' ? <Tube {...props} /> : null}
      {props.kind === 'target' ? <Target {...props} /> : null}
      {props.kind === 'ground' ? <Ground /> : null}
    </g>
  );
}

function VanDeGraaff(p: GlyphProps) {
  const r = 44;
  const cx = 60;
  const cy = 52;
  const glow = p.active ? 0.55 : 0.15;
  return (
    <g>
      {/* taban ve sutun */}
      <rect x={30} y={196} width={60} height={12} rx={2} fill={FILL} stroke={STROKE} />
      <rect x={52} y={96} width={16} height={100} fill={FILL} stroke={STROKE} />
      {/* kayis: iki makara, hareketli cizgiler */}
      <ellipse cx={60} cy={104} rx={9} ry={4} fill="none" stroke={STROKE_DIM} />
      <ellipse cx={60} cy={188} rx={9} ry={4} fill="none" stroke={STROKE_DIM} />
      <line x1={51} y1={104} x2={51} y2={188} stroke={STROKE_DIM} strokeDasharray="3 5" className={p.active ? 'belt-run' : ''} />
      <line x1={69} y1={104} x2={69} y2={188} stroke={STROKE_DIM} strokeDasharray="3 5" className={p.active ? 'belt-run-rev' : ''} />
      {/* taraklar (korona tarak ucu) */}
      <path d="M42 182 l7 -3 l-7 -3" fill="none" stroke={STROKE} />
      <path d="M78 110 l-7 3 l7 3" fill="none" stroke={STROKE} />
      {/* kure */}
      <circle cx={cx} cy={cy} r={r + 6} fill="#4da3ff" opacity={glow * 0.25} />
      <circle cx={cx} cy={cy} r={r} fill="url(#sphereGrad)" stroke={STROKE} />
      <circle cx={cx - 14} cy={cy - 14} r={10} fill="#ffffff" opacity={0.08} />
    </g>
  );
}

function Tube(p: GlyphProps) {
  const heat = p.heat ?? 0;
  return (
    <g>
      {/* cam govde */}
      <rect x={10} y={22} width={220} height={52} rx={26} fill="rgba(120,160,220,0.06)" stroke={STROKE} />
      <rect x={16} y={28} width={208} height={40} rx={20} fill="none" stroke="rgba(255,255,255,0.05)" />
      {/* katot (sol) */}
      <line x1={22} y1={14} x2={22} y2={34} stroke={STROKE} />
      <rect x={16} y={34} width={12} height={28} rx={2} fill={heat > 0 ? `rgba(255,${Math.round(170 - heat * 120)},60,${0.3 + heat * 0.7})` : FILL} stroke={STROKE} />
      {/* anot (sag): halka */}
      <line x1={218} y1={14} x2={218} y2={34} stroke={STROKE} />
      <circle cx={218} cy={48} r={12} fill="none" stroke={STROKE} strokeWidth={2} />
      {/* demet (aktifse) */}
      {p.active ? (
        <g>
          <line x1={30} y1={48} x2={240} y2={48} stroke="#8fd3ff" strokeWidth={6} opacity={0.18} />
          <line x1={30} y1={48} x2={240} y2={48} stroke="#dff3ff" strokeWidth={1.5} strokeDasharray="2 10" className="beam-run" />
        </g>
      ) : null}
      {/* etiketler */}
      <text x={22} y={90} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">−</text>
      <text x={218} y={90} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">+</text>
    </g>
  );
}

function Target(p: GlyphProps) {
  const el = typeof p.params['element'] === 'string' ? p.params['element'] : 'W';
  const heat = p.heat ?? 0;
  return (
    <g>
      <rect x={30} y={14} width={36} height={68} rx={3} fill={FILL} stroke={STROKE} />
      {heat > 0 ? <rect x={30} y={14} width={36} height={68} rx={3} fill={`rgba(255,120,40,${heat * 0.55})`} /> : null}
      <text x={48} y={54} fill="#dde3ee" fontSize={16} fontWeight={600} textAnchor="middle" fontFamily="system-ui, sans-serif">
        {el}
      </text>
      {/* tutucu */}
      <line x1={48} y1={82} x2={48} y2={92} stroke={STROKE_DIM} />
      <line x1={36} y1={92} x2={60} y2={92} stroke={STROKE_DIM} />
    </g>
  );
}

function Ground() {
  return (
    <g>
      <line x1={32} y1={4} x2={32} y2={24} stroke={STROKE} />
      <line x1={14} y1={24} x2={50} y2={24} stroke={STROKE} strokeWidth={2} />
      <line x1={20} y1={32} x2={44} y2={32} stroke={STROKE} strokeWidth={2} />
      <line x1={26} y1={40} x2={38} y2={40} stroke={STROKE} strokeWidth={2} />
    </g>
  );
}

/** Tek sefer tanimlanan SVG gradyanlari; Canvas <defs> icine koyar. */
export function GlyphDefs() {
  return (
    <defs>
      <radialGradient id="sphereGrad" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#5b6472" />
        <stop offset="100%" stopColor="#1c2028" />
      </radialGradient>
    </defs>
  );
}
