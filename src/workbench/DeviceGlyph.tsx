import type { DeviceKind, ParamValue } from './model.ts';
import { specOf, sphereRadiusPx, VDG_SPHERE, TUBE } from './catalog.ts';
import type { TubeRegime } from './solve.ts';
import { ArcChannel } from './fx/Sparks.tsx';
import { CockcroftWaltonGlyph, MarxGlyph, KlystronGlyph, LinacGlyph } from './SourceGlyphs.tsx';

/**
 * Cihazlarin sematik cizimleri. Teknik cizim estetigi; fiziksel olarak dogru
 * parcalar. Origin cihazin sol ust kosesi.
 *
 * Demet BURADA cizilmez (fx/Beam.tsx tezgah duzeyinde cizer); tup yalnizca
 * gaz rejimini gosterir: parilti sutunu, katot karanlik uzayi, ark kanali.
 */

export interface GlyphFx {
  readonly regime?: TubeRegime;
  readonly glowColor?: string;
  readonly breakdown?: boolean;
  readonly reduce?: boolean;
  /** Kaynak sematikleri icin fizikten gelen veriler. */
  readonly stageProfile?: Float64Array;
  readonly firing?: boolean;
  readonly linac?: { lengthsM: Float64Array; arcing: boolean; species: 'electron' | 'proton' };
}

export interface GlyphProps {
  readonly kind: DeviceKind;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly selected: boolean;
  readonly active: boolean;
  readonly heat?: number;
  readonly fx?: GlyphFx;
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
      {props.kind === 'cell' ? <Dish active={props.active} /> : null}
      {props.kind === 'cockcroftwalton' ? <CockcroftWaltonGlyph stages={Number(props.params['stages'] ?? 4)} active={props.active} profile={props.fx?.stageProfile} /> : null}
      {props.kind === 'marx' ? <MarxGlyph stages={Number(props.params['stages'] ?? 10)} active={props.active} firing={props.fx?.firing ?? false} /> : null}
      {props.kind === 'klystron' ? <KlystronGlyph active={props.active} /> : null}
      {props.kind === 'linac' ? (
        <LinacGlyph lengthsM={props.fx?.linac?.lengthsM ?? new Float64Array(0)} active={props.active} arcing={props.fx?.linac?.arcing ?? false} species={props.fx?.linac?.species ?? 'electron'} />
      ) : null}
    </g>
  );
}

function VanDeGraaff(p: GlyphProps) {
  const radiusM = typeof p.params['radius'] === 'number' ? (p.params['radius'] as number) : 0.15;
  const r = sphereRadiusPx(radiusM);
  const { cx, cy } = VDG_SPHERE;
  const columnTop = cy + r * 0.75;
  const glow = p.fx?.breakdown ? 0.9 : p.active ? 0.5 : 0.12;
  return (
    <g>
      <rect x={30} y={196} width={60} height={12} rx={2} fill={FILL} stroke={STROKE} />
      <rect x={52} y={columnTop} width={16} height={196 - columnTop} fill={FILL} stroke={STROKE} />
      <ellipse cx={60} cy={columnTop + 8} rx={9} ry={4} fill="none" stroke={STROKE_DIM} />
      <ellipse cx={60} cy={188} rx={9} ry={4} fill="none" stroke={STROKE_DIM} />
      <line x1={51} y1={columnTop + 8} x2={51} y2={188} stroke={STROKE_DIM} strokeDasharray="3 5" className={p.active && !p.fx?.reduce ? 'belt-run' : ''} />
      <line x1={69} y1={columnTop + 8} x2={69} y2={188} stroke={STROKE_DIM} strokeDasharray="3 5" className={p.active && !p.fx?.reduce ? 'belt-run-rev' : ''} />
      <path d="M42 182 l7 -3 l-7 -3" fill="none" stroke={STROKE} />
      <path d={`M78 ${columnTop + 14} l-7 3 l7 3`} fill="none" stroke={STROKE} />
      {/* korona halesi: gerilimle buyur, delinmede sert */}
      <circle cx={cx} cy={cy} r={r + 6 + glow * 10} fill={p.fx?.breakdown ? '#ff8a3d' : '#4da3ff'} opacity={glow * 0.28} />
      <circle cx={cx} cy={cy} r={r} fill="url(#sphereGrad)" stroke={STROKE} />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.32} r={r * 0.22} fill="#ffffff" opacity={0.08} />
      <text x={cx} y={cy + r + 14} fill={STROKE_DIM} fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace">
        R {(radiusM * 100).toFixed(0)} cm
      </text>
    </g>
  );
}

function Tube(p: GlyphProps) {
  const heat = p.heat ?? 0;
  const regime = p.fx?.regime ?? 'off';
  const glowColor = p.fx?.glowColor ?? '#b48cff';
  const ay = TUBE.axisY;
  return (
    <g>
      <defs>
        <clipPath id="tubeClip">
          <rect x={12} y={24} width={216} height={48} rx={24} />
        </clipPath>
        <pattern id="striPat" width={24} height={48} patternUnits="userSpaceOnUse">
          <rect x={0} y={0} width={10} height={48} fill={glowColor} opacity={0.35} />
        </pattern>
      </defs>
      <rect x={10} y={22} width={220} height={52} rx={26} fill="rgba(120,160,220,0.06)" stroke={STROKE} />

      {/* --- gaz rejimleri --- */}
      {regime === 'glow' ? (
        <g clipPath="url(#tubeClip)">
          {/* pozitif sutun: gaz rengi */}
          <rect x={44} y={24} width={190} height={48} fill={glowColor} opacity={0.42} />
          {/* cizgilenme (striation): kayan bantlar */}
          <g className={p.fx?.reduce ? '' : 'striations'}>
            <rect x={44} y={24} width={230} height={48} fill="url(#striPat)" />
          </g>
          {/* katot karanlik uzayi: katodun hemen onu parlamaz */}
          <rect x={28} y={24} width={16} height={48} fill="#05070a" opacity={0.7} />
          {/* negatif parilti: katot onunde ince parlak serit */}
          <rect x={22} y={26} width={6} height={44} fill={glowColor} opacity={0.9} />
          <rect x={12} y={24} width={216} height={48} rx={24} fill={glowColor} opacity={0.1} />
        </g>
      ) : null}
      {regime === 'blocked' ? (
        <rect x={12} y={24} width={216} height={48} rx={24} fill={glowColor} opacity={0.05} />
      ) : null}
      <ArcChannel x1={28} y1={ay} x2={TUBE.anodeX - 12} y2={ay} active={regime === 'arc'} reduce={p.fx?.reduce ?? false} />
      {regime === 'arc' ? <rect x={12} y={24} width={216} height={48} rx={24} fill="#cfe3ff" opacity={0.12} /> : null}

      {/* katot (sol): isinirsa kizarir */}
      <line x1={22} y1={14} x2={22} y2={34} stroke={STROKE} />
      <rect x={16} y={34} width={12} height={28} rx={2} fill={heat > 0 ? `rgba(255,${Math.round(170 - heat * 120)},60,${0.3 + heat * 0.7})` : FILL} stroke={STROKE} />
      {/* anot (sag): halka — elektronlar icinden gecip cikar */}
      <line x1={218} y1={14} x2={218} y2={34} stroke={STROKE} />
      <circle cx={218} cy={ay} r={12} fill="none" stroke={STROKE} strokeWidth={2} />
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
      <line x1={48} y1={82} x2={48} y2={92} stroke={STROKE_DIM} />
      <line x1={36} y1={92} x2={60} y2={92} stroke={STROKE_DIM} />
    </g>
  );
}

function Dish(p: { active: boolean }) {
  return (
    <g>
      <ellipse cx={48} cy={60} rx={34} ry={12} fill="#1a2030" stroke={STROKE} />
      <ellipse cx={48} cy={52} rx={34} ry={12} fill="rgba(185,140,255,0.18)" stroke={STROKE} />
      <circle cx={48} cy={50} r={9} fill="#5b3f8a" stroke="#c9a6ff" strokeWidth={1} />
      <circle cx={48} cy={50} r={4} fill="#c9a6ff" opacity={0.8} />
      {p.active ? <circle cx={48} cy={50} r={14} fill="none" stroke="#ff5a5a" strokeWidth={1} strokeDasharray="2 3" className="spark" /> : null}
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
