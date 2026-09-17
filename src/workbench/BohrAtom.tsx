import { useEffect, useMemo, useRef, useState } from 'react';
import { bohrShells, neutronCount, type NuclideId } from '../physics/data/nuclides.ts';

/**
 * Bohr atom modeli + olay oynatici. DESIGN.md "Mikro gorunum" ve "Bohr modeli".
 *
 * Olay zamanlari (ms):
 *   photoneutron / below_threshold:
 *     0-700     elektron soldan gelir, cekirdek yaninda kivrilir
 *     700-1100  fren fotonu (dalgali cizgi) cekirdege
 *     1100-1700 cekirdek sallanir (GDR); esik altindaysa hafif
 *     1700-2500 notron firlar (yalnizca photoneutron)
 *   capture:
 *     0-900     notron soldan gelir
 *     900-1400  cekirdek parlar, kume bir nukleon buyur
 */
export type AtomEvent = 'photoneutron' | 'below_threshold' | 'capture';

export interface AtomPhase {
  readonly t: number;
  readonly label: 'idle' | 'electron' | 'photon' | 'gdr' | 'neutron' | 'capture' | 'done';
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const DURATION: Record<AtomEvent, number> = { photoneutron: 2500, below_threshold: 1900, capture: 1400 };

function phaseOf(ev: AtomEvent | null, ms: number): AtomPhase {
  if (!ev) return { t: 0, label: 'idle' };
  const t = Math.min(1, ms / DURATION[ev]);
  if (ev === 'capture') return { t, label: ms < 900 ? 'capture' : ms < 1400 ? 'gdr' : 'done' };
  if (ms < 700) return { t, label: 'electron' };
  if (ms < 1100) return { t, label: 'photon' };
  if (ms < 1700) return { t, label: 'gdr' };
  if (ev === 'photoneutron' && ms < 2500) return { t, label: 'neutron' };
  return { t: 1, label: 'done' };
}

/** Aycicegi spirali: A nukleonu dairesel kumeye paketler; Z tanesi proton, esit dagilmis. */
function packNucleons(A: number, Z: number, r: number): { x: number; y: number; p: boolean }[] {
  const out: { x: number; y: number; p: boolean }[] = [];
  for (let i = 0; i < A; i++) {
    const rad = r * Math.sqrt(i + 0.5) * 1.05;
    const a = i * GOLDEN;
    const p = Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A);
    out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, p });
  }
  return out;
}

function wavy(x1: number, y1: number, x2: number, y2: number, t: number): string {
  const n = 9;
  const pts: string[] = [`M${x1},${y1}`];
  const ex = x1 + (x2 - x1) * t;
  const ey = y1 + (y2 - y1) * t;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    pts.push(`L${x1 + (ex - x1) * f},${y1 + (ey - y1) * f + Math.sin(f * Math.PI * 4) * 4}`);
  }
  return pts.join(' ');
}

export function BohrAtom(props: {
  nuclide: NuclideId;
  event: AtomEvent | null;
  /** Her degisiminde olay bastan oynar. */
  playKey: number;
  size?: number;
  onPhase?: (p: AtomPhase) => void;
}) {
  const size = props.size ?? 280;
  const c = size / 2;
  const [ms, setMs] = useState(0);
  const onPhaseRef = useRef(props.onPhase);
  onPhaseRef.current = props.onPhase;

  useEffect(() => {
    if (!props.event) {
      setMs(0);
      onPhaseRef.current?.({ t: 0, label: 'idle' });
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = DURATION[props.event];
    const tick = () => {
      const e = performance.now() - start;
      setMs(e);
      onPhaseRef.current?.(phaseOf(props.event, e));
      if (e < dur) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.event, props.playKey]);

  const phase = phaseOf(props.event, ms);
  const { A, Z } = props.nuclide;
  const N = neutronCount(props.nuclide);
  const shells = useMemo(() => bohrShells(Z), [Z]);

  const nucleonR = A > 60 ? 2.4 : A > 12 ? 3.6 : 5.5;
  const clusterR = nucleonR * Math.sqrt(A) * 1.08 + 2;
  const ejected = props.event === 'photoneutron' && (phase.label === 'neutron' || phase.label === 'done');
  const captured = props.event === 'capture' && (phase.label === 'gdr' || phase.label === 'done');
  const drawA = A + (captured ? 1 : 0) - (ejected ? 1 : 0);
  const nucleons = useMemo(() => packNucleons(drawA, Z, nucleonR), [drawA, Z, nucleonR]);
  const wobble = phase.label === 'gdr' ? (props.event === 'below_threshold' ? 0.05 : 0.14) * Math.sin(ms / 45) : 0;
  const shellR = (i: number) => clusterR + 26 + i * ((c - clusterR - 34) / Math.max(1, shells.length));

  // Olay gorselleri
  const bendX = -clusterR - 18;
  const eT = Math.min(1, ms / 700);
  const electron =
    phase.label === 'electron'
      ? { x: -c + (bendX + c) * eT, y: 40 * (1 - eT) - 22 * Math.sin(eT * Math.PI) }
      : null;
  const afterPhoton = phase.label === 'gdr' || phase.label === 'neutron' || phase.label === 'done';
  const photonT = phase.label === 'photon' ? (ms - 700) / 400 : afterPhoton ? 1 : 0;
  const neutronT = phase.label === 'neutron' ? (ms - 1700) / 800 : phase.label === 'done' && ejected ? 1 : 0;
  const inNeutronT = props.event === 'capture' ? Math.min(1, ms / 900) : 0;
  const flash = (phase.label === 'gdr' || captured) && props.event !== 'below_threshold';

  return (
    <svg className="atom" width={size} height={size} viewBox={`${-c} ${-c} ${size} ${size}`} role="img">
      {shells.map((count, i) => {
        const r = shellR(i);
        return (
          <g key={i} className={`shell shell-${i % 3}`}>
            <circle r={r} fill="none" stroke="#2a3140" strokeWidth={1} />
            {Array.from({ length: count }, (_, k) => {
              const a = (k / count) * Math.PI * 2;
              return <circle key={k} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={2.6} fill="#8fd3ff" />;
            })}
          </g>
        );
      })}

      <g transform={`scale(${1 + wobble} ${1 - wobble})`}>
        {flash ? <circle r={clusterR + 8} fill="#ffd27a" opacity={0.18 + 0.12 * Math.abs(Math.sin(ms / 60))} /> : null}
        {nucleons.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={nucleonR} fill={n.p ? '#ff6b6b' : '#a7b0c0'} stroke="#0a0c10" strokeWidth={0.4} />
        ))}
      </g>

      {electron ? (
        <g>
          <line x1={-c} y1={40} x2={electron.x} y2={electron.y} stroke="#8fd3ff" strokeWidth={1} opacity={0.35} />
          <circle cx={electron.x} cy={electron.y} r={4} fill="#dff3ff" />
        </g>
      ) : null}

      {photonT > 0 && props.event !== 'capture' ? (
        <path
          d={wavy(bendX, -10, -clusterR * 0.6, 0, photonT)}
          fill="none"
          stroke="#b98cff"
          strokeWidth={1.8}
          opacity={phase.label === 'photon' ? 1 : 0.35}
        />
      ) : null}

      {neutronT > 0 ? (
        <circle
          cx={clusterR * 0.5 + neutronT * (c - 20)}
          cy={-clusterR * 0.5 - neutronT * (c - 30)}
          r={nucleonR + 1}
          fill="#a7b0c0"
          stroke="#46d6c4"
          strokeWidth={1.2}
        />
      ) : null}

      {props.event === 'capture' && inNeutronT < 1 ? (
        <circle cx={-c + inNeutronT * (c - clusterR * 0.4)} cy={6} r={nucleonR + 1} fill="#a7b0c0" stroke="#46d6c4" strokeWidth={1.2} />
      ) : null}

      <text x={0} y={c - 10} fill="#868fa1" fontSize={11} textAnchor="middle" fontFamily="ui-monospace, monospace">
        {Z}p · {N + (captured ? 1 : 0) - (ejected ? 1 : 0)}n
      </text>
    </svg>
  );
}
