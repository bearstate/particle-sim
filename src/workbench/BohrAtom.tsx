import { useEffect, useMemo, useRef, useState } from 'react';
import { bohrShells, neutronCount, type NuclideId } from '../physics/data/nuclides.ts';

/**
 * Bohr atom modeli + olay koreografisi. DESIGN.md "Mikro gorunum".
 *
 * Tek bir sabit zaman cizelgesi YOK. Bir zamanlayici, moda gore rastgele
 * "perde"ler secer ve her perdenin geometrisi (carpma parametresi, giris
 * acisi, foton yonu, notron cikis acisi) rastgeledir:
 *   below   : sacilma %65, fren isimasi %35
 *   above   : sacilma %45, fren isimasi %25, fotonotron %30
 *   neutrons: yakalama
 *   photons : foton gecisi
 * Cogu elektron sadece sacilir — gercekte de oyle; nadir olay nadir gorunur.
 *
 * Hareket rAF ile parametrik yol uzerinden: elektron cekirdege yaklastikca
 * hizlanir (Coulomb), rezonans sonumlu sinuzoit, notron cikinca cekirdek geri
 * teper. Azaltilmis harekette koreografi yok; atom ve sonuc etiketi kalir.
 */

export type AtomMode = 'idle' | 'below' | 'above' | 'neutrons' | 'photons';
export type ActKind = 'scatter' | 'brems' | 'photoneutron' | 'capture' | 'photonPass';
export type ActPhase = 'start' | 'photon' | 'gdr' | 'neutron' | 'done';

export interface ActInfo {
  readonly act: ActKind;
  readonly phase: ActPhase;
}

interface Pt { x: number; y: number }

interface Act {
  kind: ActKind;
  t0: number;
  dur: number;
  /** Elektron/notron/foton yolu: giris, kontrol, cikis. */
  p0: Pt; p1: Pt; p2: Pt;
  /** Fren fotonu yonu (rad) ve cikis noktasi. */
  photonDir: number;
  /** Notron cikis yonu (rad). */
  neutronDir: number;
  /** Cekirdek geri tepme yonu (rad). */
  recoilDir: number;
  phase: ActPhase;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function pickAct(mode: AtomMode): ActKind | null {
  const r = Math.random();
  switch (mode) {
    case 'below': return r < 0.65 ? 'scatter' : 'brems';
    case 'above': return r < 0.45 ? 'scatter' : r < 0.7 ? 'brems' : 'photoneutron';
    case 'neutrons': return 'capture';
    case 'photons': return 'photonPass';
    default: return null;
  }
}

/** Elektron yolu: sol taraftan girer, cekirdegin yanindan kivrilarak cikar. */
function electronPath(c: number, clusterR: number, strong: boolean): { p0: Pt; p1: Pt; p2: Pt } {
  const entryAngle = rnd(-0.55, 0.55); // sol kenardan, yatayin cevresinde
  const side = Math.random() < 0.5 ? 1 : -1;
  const b = clusterR * rnd(0.5, 1.6) * side; // carpma parametresi
  const p0: Pt = { x: -c - 10, y: Math.tan(entryAngle) * c * 0.6 + b * 0.4 };
  // Kontrol noktasi cekirdegin yaninda: ne kadar yakin, o kadar keskin kivrim.
  const p1: Pt = { x: -clusterR * 0.2, y: b };
  const deflect = (strong ? 1.6 : 1.0) * (clusterR * 1.4) / Math.max(clusterR * 0.5, Math.abs(b));
  const p2: Pt = { x: c + 10, y: b + side * deflect * 0.5 * c * 0.35 };
  return { p0, p1, p2 };
}

function bezier(p0: Pt, p1: Pt, p2: Pt, s: number): Pt {
  const u = 1 - s;
  return { x: u * u * p0.x + 2 * u * s * p1.x + s * s * p2.x, y: u * u * p0.y + 2 * u * s * p1.y + s * s * p2.y };
}

/** Hiz profili: uzakta yavas, cekirdek yaninda hizli (Coulomb). */
function coulombEase(t: number): number {
  return t - 0.1 * Math.sin(TAU * t);
}

function packNucleons(A: number, Z: number, r: number): { x: number; y: number; p: boolean }[] {
  const out: { x: number; y: number; p: boolean }[] = [];
  for (let i = 0; i < A; i++) {
    const rad = r * Math.sqrt(i + 0.5) * 1.05;
    const a = i * GOLDEN;
    out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, p: Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A) });
  }
  return out;
}

function wavy(from: Pt, dir: number, len: number, amp = 3.5, waves = 5): string {
  const n = 14;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const along = len * f;
    const off = Math.sin(f * Math.PI * waves) * amp * (1 - f * 0.3);
    const x = from.x + Math.cos(dir) * along - Math.sin(dir) * off;
    const y = from.y + Math.sin(dir) * along + Math.cos(dir) * off;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function BohrAtom(props: {
  nuclide: NuclideId;
  mode: AtomMode;
  reduce: boolean;
  size?: number;
  onAct?: (info: ActInfo) => void;
}) {
  const size = props.size ?? 280;
  const c = size / 2;
  const { A, Z } = props.nuclide;
  const N = neutronCount(props.nuclide);
  const shells = useMemo(() => bohrShells(Z), [Z]);
  const nucleonR = A > 60 ? 2.4 : A > 12 ? 3.6 : 5.5;
  const clusterR = nucleonR * Math.sqrt(A) * 1.08 + 2;

  const [act, setAct] = useState<Act | null>(null);
  const [now, setNow] = useState(0);
  const onActRef = useRef(props.onAct);
  onActRef.current = props.onAct;
  const modeRef = useRef(props.mode);
  modeRef.current = props.mode;
  const geomRef = useRef({ c, clusterR });
  geomRef.current = { c, clusterR };

  // Zamanlayici: perde biter -> rastgele bosluk -> yeni perde.
  useEffect(() => {
    if (props.reduce || props.mode === 'idle') {
      setAct(null);
      return;
    }
    let raf = 0;
    let current: Act | null = null;
    let nextStart = performance.now() + 250;

    const start = (t: number) => {
      const kind = pickAct(modeRef.current);
      if (!kind) return;
      const { c: cc, clusterR: cr } = geomRef.current;
      const strong = kind !== 'scatter';
      const path = kind === 'capture' || kind === 'photonPass'
        ? { p0: { x: -cc - 10, y: rnd(-cr * 0.5, cr * 0.5) }, p1: { x: 0, y: 0 }, p2: { x: cc + 10, y: rnd(-cr, cr) } }
        : electronPath(cc, cr, strong);
      const dur = kind === 'scatter' ? rnd(700, 1000) : kind === 'brems' ? rnd(1300, 1700) : kind === 'photoneutron' ? rnd(2300, 2800) : kind === 'capture' ? rnd(1400, 1800) : rnd(600, 800);
      current = { kind, t0: t, dur, ...path, photonDir: rnd(-0.6, 0.6), neutronDir: rnd(-2.6, 0.6), recoilDir: 0, phase: 'start' };
      current.recoilDir = current.neutronDir + Math.PI;
      setAct(current);
      onActRef.current?.({ act: kind, phase: 'start' });
    };

    const tick = (t: number) => {
      if (!current) {
        if (t >= nextStart) start(t);
      } else {
        const e = t - current.t0;
        const ph = phaseAt(current, e);
        if (ph !== current.phase) {
          current.phase = ph;
          onActRef.current?.({ act: current.kind, phase: ph });
        }
        if (e >= current.dur) {
          current = null;
          nextStart = t + rnd(350, 1100);
        }
      }
      setNow(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.mode, props.reduce]);

  const e = act ? now - act.t0 : 0;
  const phase = act ? phaseAt(act, e) : 'done';
  const ejected = act?.kind === 'photoneutron' && (phase === 'neutron' || phase === 'done');
  const captured = act?.kind === 'capture' && (phase === 'gdr' || phase === 'done');
  const drawA = A + (captured ? 1 : 0) - (ejected ? 1 : 0);
  const nucleons = useMemo(() => packNucleons(drawA, Z, nucleonR), [drawA, Z, nucleonR]);
  const nucleusEl = useMemo(
    () => nucleons.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={nucleonR} fill={n.p ? '#ff6b6b' : '#a7b0c0'} stroke="#0a0c10" strokeWidth={0.4} />),
    [nucleons, nucleonR],
  );
  const shellR = (i: number) => clusterR + 26 + i * ((c - clusterR - 34) / Math.max(1, shells.length));

  // --- perde geometrisi ---
  let electron: Pt | null = null;
  let trail: Pt[] = [];
  let photon: string | null = null;
  let photonOpacity = 0;
  let wobble = 0;
  let recoil: Pt = { x: 0, y: 0 };
  let neutron: Pt | null = null;
  let neutronTrail: Pt[] = [];
  let flash = 0;

  if (act) {
    const k = act.kind;
    const approachDur = k === 'scatter' ? act.dur : k === 'brems' ? act.dur * 0.55 : k === 'photoneutron' ? 900 : k === 'capture' ? 900 : act.dur;
    if (k === 'scatter' || k === 'brems' || k === 'photoneutron') {
      const t = Math.min(1, e / approachDur);
      const s = coulombEase(t);
      // Fren isimasi/fotonotronda elektron kivrimda enerji kaybeder: daha yavas cikar.
      const slow = k !== 'scatter' && s > 0.5 ? 0.5 + (s - 0.5) * 0.75 : s;
      electron = bezier(act.p0, act.p1, act.p2, slow);
      trail = [0.06, 0.12, 0.18].map((d) => bezier(act.p0, act.p1, act.p2, Math.max(0, slow - d)));
      if (k !== 'scatter') {
        const bend = bezier(act.p0, act.p1, act.p2, 0.5);
        const tPhoton = (e - approachDur * 0.5) / 320;
        if (tPhoton > 0) {
          const heading = Math.atan2(act.p2.y - bend.y, act.p2.x - bend.x);
          if (k === 'brems') {
            // Foton ileriye dogru (rolativistik demet), cekirdegi ISKALAR ve uzaklasir.
            const dir = heading + act.photonDir;
            const len = Math.min(1, tPhoton) * (c + 20);
            photon = wavy(bend, dir, len);
            photonOpacity = tPhoton < 1 ? 1 : Math.max(0, 1 - (tPhoton - 1) * 0.9);
          } else {
            // Fotonotron: foton cekirdege dogru, sogurulur.
            const dir = Math.atan2(-bend.y, -bend.x);
            const dist = Math.hypot(bend.x, bend.y) - clusterR * 0.4;
            const len = Math.min(1, tPhoton) * dist;
            photon = wavy(bend, dir, len, 3, 4);
            photonOpacity = tPhoton < 1 ? 1 : 0;
            const tGdr = e - (approachDur * 0.5 + 320);
            if (tGdr > 0) {
              // Sonumlu rezonans: ~9 Hz, tau 260 ms.
              wobble = 0.16 * Math.exp(-tGdr / 260) * Math.sin(tGdr / 18);
              flash = Math.exp(-tGdr / 300);
              const tN = tGdr - 260;
              if (tN > 0) {
                const speed = 0.28; // px/ms
                const d = tN * speed;
                neutron = { x: Math.cos(act.neutronDir) * (clusterR * 0.6 + d), y: Math.sin(act.neutronDir) * (clusterR * 0.6 + d) };
                neutronTrail = [18, 36, 54].map((back) => ({ x: Math.cos(act.neutronDir) * (clusterR * 0.6 + Math.max(0, d - back)), y: Math.sin(act.neutronDir) * (clusterR * 0.6 + Math.max(0, d - back)) }));
                const kick = 4 * Math.exp(-tN / 220);
                recoil = { x: Math.cos(act.recoilDir) * kick, y: Math.sin(act.recoilDir) * kick };
              }
            }
          }
        }
      }
    } else if (k === 'capture') {
      const t = Math.min(1, e / approachDur);
      const p = { x: act.p0.x + (0 - act.p0.x) * t, y: act.p0.y + (0 - act.p0.y) * t };
      if (t < 1) {
        neutron = p;
        neutronTrail = [0.05, 0.1].map((d) => ({ x: act.p0.x + (0 - act.p0.x) * Math.max(0, t - d), y: act.p0.y + (0 - act.p0.y) * Math.max(0, t - d) }));
      } else {
        const tg = e - approachDur;
        wobble = 0.08 * Math.exp(-tg / 220) * Math.sin(tg / 20);
        flash = Math.exp(-tg / 260);
      }
    } else if (k === 'photonPass') {
      const t = Math.min(1, e / act.dur);
      const dir = Math.atan2(act.p2.y - act.p0.y, act.p2.x - act.p0.x);
      photon = wavy(act.p0, dir, Math.hypot(act.p2.x - act.p0.x, act.p2.y - act.p0.y) * t, 3.5, 7);
      photonOpacity = 0.9;
    }
  }

  const shownN = N + (captured ? 1 : 0) - (ejected ? 1 : 0);

  return (
    <svg className="atom" width={size} height={size} viewBox={`${-c} ${-c} ${size} ${size}`} role="img">
      {shells.map((count, i) => {
        const r = shellR(i);
        return (
          <g key={i} className={props.reduce ? '' : `shell shell-${i % 3}`}>
            <circle r={r} fill="none" stroke="#2a3140" strokeWidth={1} />
            {Array.from({ length: count }, (_, k) => {
              const a = (k / count) * TAU;
              return <circle key={k} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={2.6} fill="#8fd3ff" />;
            })}
          </g>
        );
      })}

      <g transform={`translate(${recoil.x.toFixed(2)} ${recoil.y.toFixed(2)}) scale(${(1 + wobble).toFixed(4)} ${(1 - wobble).toFixed(4)})`}>
        {flash > 0 ? <circle r={clusterR + 8} fill="#ffd27a" opacity={0.3 * flash} /> : null}
        {nucleusEl}
      </g>

      {photon ? <path d={photon} fill="none" stroke="#b98cff" strokeWidth={1.8} opacity={photonOpacity} strokeLinecap="round" /> : null}

      {electron ? (
        <g>
          {trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 - i * 0.7} fill="#8fd3ff" opacity={0.35 - i * 0.1} />)}
          <circle cx={electron.x} cy={electron.y} r={3.6} fill="#dff3ff" />
          <circle cx={electron.x} cy={electron.y} r={7} fill="#8fd3ff" opacity={0.18} />
        </g>
      ) : null}

      {neutron ? (
        <g>
          {neutronTrail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={nucleonR + 0.5 - i * 0.5} fill="#a7b0c0" opacity={0.3 - i * 0.08} />)}
          <circle cx={neutron.x} cy={neutron.y} r={nucleonR + 1} fill="#a7b0c0" stroke="#46d6c4" strokeWidth={1.2} />
        </g>
      ) : null}

      <text x={0} y={c - 10} fill="#868fa1" fontSize={11} textAnchor="middle" fontFamily="ui-monospace, monospace">
        {Z}p · {shownN}n
      </text>
    </svg>
  );
}

function phaseAt(act: Act, e: number): ActPhase {
  if (e >= act.dur) return 'done';
  switch (act.kind) {
    case 'scatter': return 'start';
    case 'brems': return e < act.dur * 0.275 ? 'start' : 'photon';
    case 'photoneutron': {
      if (e < 450) return 'start';
      if (e < 770) return 'photon';
      if (e < 1030) return 'gdr';
      return 'neutron';
    }
    case 'capture': return e < 900 ? 'start' : 'gdr';
    case 'photonPass': return 'photon';
  }
}
