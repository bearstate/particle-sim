import { useEffect, useMemo, useRef, useState } from 'react';
import { bohrShells, neutronCount, nuclideLabel, type NuclideId } from '../physics/data/nuclides.ts';
import { decayOf, type FissionOutcome } from '../physics/nuclear/nuclideTable.ts';
import { followUps, phaseAt, planNext, shownNuclide, type ActKind, type ActPhase, type ActPlan, type AtomMode, type Pending, type Pt } from './atomActs.ts';

export type { AtomMode, ActKind, ActPhase } from './atomActs.ts';

/**
 * Bohr atom modeli + olay koreografisi. DESIGN.md "Mikro gorunum".
 *
 * Perdeleri atomActs.ts planlar (sacilma, fren isimasi, fotonotron, yakalama,
 * ic kabuk iyonlasmasi + karakteristik X-isini, alfa/beta/EK bozunmasi,
 * fisyon, Be-8 parcalanmasi). Burasi yalnizca cizer: her karede perdenin
 * gecen suresinden parcacik konumlari, cekirdek geri tepmesi/rezonansi,
 * kabuk bosluklari ve foton yollari hesaplanir.
 *
 * Kabuklar JS ile doner (CSS degil) ki bir kabuk elektronunun dunya acisi
 * bilinsin: iyonlasmada tam o elektron kopar, ust kabuktan tam o bosluga
 * elektron duser.
 */

export interface ActInfo {
  readonly act: ActKind;
  readonly phase: ActPhase;
  readonly from: NuclideId;
  readonly to: NuclideId;
  readonly waitS: number | null;
  readonly halfLifeS: number | null;
  readonly fission: FissionOutcome | null;
  readonly depth: number;
}

interface Running { plan: ActPlan; t0: number }
interface Nucleon { x: number; y: number; p: boolean }
interface HoleState { t0: number; kIdx: number; jIdx: number; ejectDir: number; from: Pt }

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const SHELL_PERIOD_MS = [14000, 22000, 31000, 40000, 52000, 61000, 70000];
const NEUTRON = '#a7b0c0';
const PROTON = '#ff6b6b';

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function bezier(p0: Pt, p1: Pt, p2: Pt, s: number): Pt {
  const u = 1 - s;
  return { x: u * u * p0.x + 2 * u * s * p1.x + s * s * p2.x, y: u * u * p0.y + 2 * u * s * p1.y + s * s * p2.y };
}

/** Hiz profili: uzakta yavas, cekirdek yaninda hizli (Coulomb). */
function coulombEase(t: number): number {
  return t - 0.1 * Math.sin(TAU * t);
}

function ease(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

function polar(dir: number, r: number): Pt {
  return { x: Math.cos(dir) * r, y: Math.sin(dir) * r };
}

function angleLerp(a: number, b: number, t: number): number {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + d * t;
}

function nearestIndex(angle: number, count: number, rot: number): number {
  if (count <= 0) return 0;
  const rel = (((angle - rot) % TAU) + TAU) % TAU;
  return Math.round(rel / (TAU / count)) % count;
}

function packNucleons(A: number, Z: number, r: number): Nucleon[] {
  const out: Nucleon[] = [];
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

function Cluster(props: { nucleons: Nucleon[]; r: number }) {
  return <>{props.nucleons.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={props.r} fill={n.p ? PROTON : NEUTRON} stroke="#0a0c10" strokeWidth={0.4} />)}</>;
}

/** Alfa parcacigi: 2p2n, sikisik elmas. */
function Alpha(props: { at: Pt; r: number }) {
  const d = props.r * 0.95;
  return (
    <g transform={`translate(${props.at.x.toFixed(1)} ${props.at.y.toFixed(1)})`}>
      <circle r={d * 2.4} fill="#ffd27a" opacity={0.18} />
      <circle cx={-d} cy={0} r={props.r} fill={PROTON} stroke="#0a0c10" strokeWidth={0.4} />
      <circle cx={d} cy={0} r={props.r} fill={PROTON} stroke="#0a0c10" strokeWidth={0.4} />
      <circle cx={0} cy={-d} r={props.r} fill={NEUTRON} stroke="#0a0c10" strokeWidth={0.4} />
      <circle cx={0} cy={d} r={props.r} fill={NEUTRON} stroke="#0a0c10" strokeWidth={0.4} />
    </g>
  );
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
  const key = nuclideLabel(props.nuclide);

  const [run, setRun] = useState<Running | null>(null);
  const [rest, setRest] = useState<NuclideId | null>(null);
  const [now, setNow] = useState(0);
  const onActRef = useRef(props.onAct);
  onActRef.current = props.onAct;
  const modeRef = useRef(props.mode);
  modeRef.current = props.mode;
  const nuclideRef = useRef(props.nuclide);
  nuclideRef.current = props.nuclide;

  const base = rest ?? props.nuclide;
  const plan = run?.plan ?? null;
  const e = run ? now - run.t0 : 0;
  const phase: ActPhase = plan ? phaseAt(plan, e) : 'done';
  const t = plan ? Math.min(1, e / plan.dur) : 0;
  const drawn = plan ? shownNuclide(plan, phase) : base;
  const isBeta = plan !== null && (plan.kind === 'betaMinus' || plan.kind === 'betaPlus' || plan.kind === 'ec');
  const packed = isBeta && plan ? plan.from : drawn;

  const shells = useMemo(() => bohrShells(base.Z), [base.Z]);
  const nucleonR = base.A > 60 ? 2.4 : base.A > 12 ? 3.6 : 5.5;
  const clusterR = nucleonR * Math.sqrt(base.A) * 1.08 + 2;
  const geomRef = useRef({ c, clusterR });
  geomRef.current = { c, clusterR };
  const shellR = (i: number) => clusterR + 26 + i * ((c - clusterR - 34) / Math.max(1, shells.length));
  const rot = shells.map((_, i) => (props.reduce ? 0 : ((now / (SHELL_PERIOD_MS[i % 7] ?? 30000)) * TAU) * (i % 2 ? -1 : 1)));

  // Zamanlayici: perde biter -> kuyruk (zincir) veya rastgele bosluk -> yeni perde.
  useEffect(() => {
    setRest(null);
    if (props.reduce) {
      setRun(null);
      return;
    }
    let raf = 0;
    let current: Running | null = null;
    let lastPhase: ActPhase = 'done';
    const queue: Pending[] = [];
    let nextStart = performance.now() + 250;
    const emit = (r: Running, ph: ActPhase) =>
      onActRef.current?.({ act: r.plan.kind, phase: ph, from: r.plan.from, to: r.plan.to, waitS: r.plan.waitS, halfLifeS: r.plan.halfLifeS, fission: r.plan.fission, depth: r.plan.depth });
    const start = (tt: number) => {
      const p = planNext(modeRef.current, nuclideRef.current, queue, geomRef.current);
      if (!p) { nextStart = tt + 900; return; }
      current = { plan: p, t0: tt };
      lastPhase = phaseAt(p, 0);
      setRun(current);
      emit(current, lastPhase);
    };
    const tick = (tt: number) => {
      if (!current) {
        if (tt >= nextStart) start(tt);
      } else {
        const el = tt - current.t0;
        const ph = phaseAt(current.plan, el);
        if (ph !== lastPhase) { lastPhase = ph; emit(current, ph); }
        if (el >= current.plan.dur) {
          queue.push(...followUps(current.plan));
          const chained = queue.length > 0;
          const fragmented = current.plan.kind === 'fission' || current.plan.kind === 'breakup';
          setRest(chained ? current.plan.to : null);
          nextStart = tt + (chained ? rnd(700, 1100) : modeRef.current === 'idle' ? rnd(2200, 4000) : fragmented ? rnd(900, 1400) : rnd(350, 1100));
          current = null;
          setRun(null);
        }
      }
      setNow(tt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.mode, props.reduce, key]);

  const nucleons = useMemo(() => packNucleons(packed.A, packed.Z, nucleonR), [packed.A, packed.Z, nucleonR]);
  const fragL = useMemo(() => (plan?.fission ? packNucleons(plan.fission.light.A, plan.fission.light.Z, nucleonR) : null), [plan?.fission, nucleonR]);
  const fragH = useMemo(() => (plan?.fission ? packNucleons(plan.fission.heavy.A, plan.fission.heavy.Z, nucleonR) : null), [plan?.fission, nucleonR]);
  const holeRef = useRef<HoleState | null>(null);
  const count0 = shells[0] ?? 0;
  const count1 = shells[1] ?? 0;
  const R0 = shellR(0);
  const R1 = shellR(1);
  const kAngle = (h: HoleState) => (h.kIdx / Math.max(1, count0)) * TAU + (rot[0] ?? 0);
  const lAngle = (h: HoleState) => (h.jIdx / Math.max(1, count1)) * TAU + (rot[1] ?? 0);

  // --- perde geometrisi ---
  let projectile: Pt | null = null;
  let trail: Pt[] = [];
  let photon: string | null = null;
  let photonOpacity = 0;
  let photonColor = '#b98cff';
  let photonWidth = 1.8;
  let wobble = 0;
  let recoil: Pt = { x: 0, y: 0 };
  let neutrons: { at: Pt; trail: Pt[] }[] = [];
  let flash = 0;
  let stretch: { sx: number; sy: number; deg: number } | null = null;
  let fragments: { L: Pt; H: Pt } | null = null;
  let gammas: { d: string; o: number }[] = [];
  let alphaAt: Pt | null = null;
  let marker: { at: Pt; color: string; pulse: number } | null = null;
  let beta: { at: Pt; color: string; trail: Pt[] } | null = null;
  let neutrino: { a: Pt; b: Pt; label: string; o: number } | null = null;
  let hole: { shell: number; idx: number } | null = null;
  let dropping: Pt | null = null;
  let ejected: { at: Pt; trail: Pt[] } | null = null;
  let hitFlash: Pt | null = null;

  if (plan && run) {
    const k = plan.kind;
    const dur = plan.dur;
    const approachDur = k === 'scatter' ? dur : k === 'brems' ? dur * 0.55 : k === 'photoneutron' ? 900 : k === 'capture' ? 900 : dur;

    if (k === 'scatter' || k === 'brems' || k === 'photoneutron') {
      const tt = Math.min(1, e / approachDur);
      const s = coulombEase(tt);
      const slow = k !== 'scatter' && s > 0.5 ? 0.5 + (s - 0.5) * 0.75 : s;
      projectile = bezier(plan.p0, plan.p1, plan.p2, slow);
      trail = [0.06, 0.12, 0.18].map((d) => bezier(plan.p0, plan.p1, plan.p2, Math.max(0, slow - d)));
      if (k !== 'scatter') {
        const bend = bezier(plan.p0, plan.p1, plan.p2, 0.5);
        const tPhoton = (e - approachDur * 0.5) / 320;
        if (tPhoton > 0) {
          const heading = Math.atan2(plan.p2.y - bend.y, plan.p2.x - bend.x);
          if (k === 'brems') {
            photon = wavy(bend, heading + plan.photonDir, Math.min(1, tPhoton) * (c + 20));
            photonOpacity = tPhoton < 1 ? 1 : Math.max(0, 1 - (tPhoton - 1) * 0.9);
          } else {
            const dir = Math.atan2(-bend.y, -bend.x);
            const dist = Math.hypot(bend.x, bend.y) - clusterR * 0.4;
            photon = wavy(bend, dir, Math.min(1, tPhoton) * dist, 3, 4);
            photonOpacity = tPhoton < 1 ? 1 : 0;
            const tGdr = e - (approachDur * 0.5 + 320);
            if (tGdr > 0) {
              wobble = 0.16 * Math.exp(-tGdr / 260) * Math.sin(tGdr / 18);
              flash = Math.exp(-tGdr / 300);
              const tN = tGdr - 260;
              if (tN > 0) {
                const d = tN * 0.28;
                neutrons = [{ at: polar(plan.neutronDir, clusterR * 0.6 + d), trail: [18, 36, 54].map((back) => polar(plan.neutronDir, clusterR * 0.6 + Math.max(0, d - back))) }];
                recoil = polar(plan.neutronDir + Math.PI, 4 * Math.exp(-tN / 220));
              }
            }
          }
        }
      }
    } else if (k === 'capture') {
      const tt = Math.min(1, e / approachDur);
      if (tt < 1) {
        neutrons = [{ at: { x: plan.p0.x * (1 - tt), y: plan.p0.y * (1 - tt) }, trail: [0.05, 0.1].map((d) => ({ x: plan.p0.x * (1 - Math.max(0, tt - d)), y: plan.p0.y * (1 - Math.max(0, tt - d)) })) }];
      } else {
        const tg = e - approachDur;
        wobble = 0.08 * Math.exp(-tg / 220) * Math.sin(tg / 20);
        flash = Math.exp(-tg / 260);
        // Yakalama gamasi: baglanma enerjisi foton olarak cikar.
        const tp = tg / 350;
        photon = wavy({ x: 0, y: 0 }, plan.emitDir, Math.min(1, tp) * (c + 20), 3, 6);
        photonOpacity = tp < 1 ? 0.9 : Math.max(0, 0.9 - (tp - 1) * 1.2);
      }
    } else if (k === 'photonPass') {
      const dir = Math.atan2(plan.p2.y - plan.p0.y, plan.p2.x - plan.p0.x);
      photon = wavy(plan.p0, dir, Math.hypot(plan.p2.x - plan.p0.x, plan.p2.y - plan.p0.y) * t, 3.5, 7);
      photonOpacity = 0.9;
    } else if (k === 'ionize' || k === 'ec') {
      const holeT = k === 'ionize' ? 0.42 : 0;
      const dropT = k === 'ionize' ? 0.62 : 0.55;
      const dropLen = 220 / dur;
      const hit: Pt = k === 'ec'
        ? polar(plan.emitDir, R0)
        : plan.projectile === 'photon'
          ? { x: -R0 * Math.cos(0.35), y: plan.side * R0 * Math.sin(0.35) }
          : bezier(plan.p0, plan.p1, plan.p2, 0.5);
      if (t >= holeT && holeRef.current?.t0 !== run.t0) {
        const ang = Math.atan2(hit.y, hit.x);
        const kIdx = nearestIndex(ang, count0, rot[0] ?? 0);
        const jIdx = nearestIndex(ang, count1, rot[1] ?? 0);
        const kA = (kIdx / Math.max(1, count0)) * TAU + (rot[0] ?? 0);
        holeRef.current = { t0: run.t0, kIdx, jIdx, ejectDir: kA + rnd(-0.6, 0.6), from: polar(kA, R0) };
      }
      const h = holeRef.current?.t0 === run.t0 ? holeRef.current : null;
      if (k === 'ionize') {
        if (plan.projectile === 'photon') {
          if (t < holeT) {
            const dir = Math.atan2(hit.y - plan.p0.y, hit.x - plan.p0.x);
            photon = wavy(plan.p0, dir, Math.hypot(hit.x - plan.p0.x, hit.y - plan.p0.y) * (t / holeT), 3.5, 7);
            photonOpacity = 0.9;
          }
        } else {
          const s = t < holeT ? 0.5 * (t / holeT) : 0.5 + 0.5 * ((t - holeT) / (1 - holeT));
          projectile = bezier(plan.p0, plan.p1, plan.p2, s);
          trail = [0.06, 0.12, 0.18].map((d) => bezier(plan.p0, plan.p1, plan.p2, Math.max(0, s - d)));
        }
      }
      if (h) {
        const sinceHole = e - holeT * dur;
        if (k === 'ionize') {
          const d = sinceHole * 0.22;
          const at = { x: h.from.x + Math.cos(h.ejectDir) * d, y: h.from.y + Math.sin(h.ejectDir) * d };
          if (Math.hypot(at.x, at.y) < c + 14) ejected = { at, trail: [10, 20, 30].map((b) => ({ x: h.from.x + Math.cos(h.ejectDir) * Math.max(0, d - b), y: h.from.y + Math.sin(h.ejectDir) * Math.max(0, d - b) })) };
          if (sinceHole < 220) hitFlash = h.from;
        } else {
          // Elektron yakalama: K elektronu cekirdege duser, bir proton notrona doner.
          if (t < 0.35) dropping = polar(kAngle(h), R0 + (clusterR * 0.5 - R0) * ease(t / 0.35));
          const edge = polar(plan.emitDir, clusterR * 0.75);
          const flipped = t >= 0.35;
          marker = { at: edge, color: flipped ? NEUTRON : PROTON, pulse: flipped ? 1 : 0.5 + 0.5 * Math.sin(e / 60) };
          if (flipped) {
            const te = e - 0.35 * dur;
            neutrino = { a: edge, b: polar(plan.emitDir + plan.side * 2.2, clusterR * 0.75 + Math.min(1, te / 600) * (c + 10)), label: 'ν', o: 0.55 * Math.max(0, 1 - Math.max(0, te - 600) / 500) };
            flash = 0.5 * Math.exp(-te / 250);
          }
        }
        const dropEnd = dropT + dropLen;
        if (t < dropEnd) hole = { shell: 0, idx: h.kIdx };
        else if (count1 > 0) hole = { shell: 1, idx: h.jIdx };
        if (count1 > 0 && t >= dropT && t < dropEnd) {
          const u = ease((t - dropT) / dropLen);
          dropping = polar(angleLerp(lAngle(h), kAngle(h), u), R1 + (R0 - R1) * u);
        }
        if (count1 > 0 && t >= dropEnd) {
          const tp = (e - dropEnd * dur) / 380;
          const from = polar(kAngle(h), R0);
          photon = wavy(from, plan.emitDir + 0.4, Math.min(1, tp) * (c + 20), 2.4, 9);
          photonOpacity = tp < 1 ? 1 : Math.max(0, 1 - (tp - 1) * 1.2);
          photonColor = base.Z >= 30 ? '#f2ecff' : '#c9a6ff';
          photonWidth = base.Z >= 30 ? 2.2 : 1.8;
          if (tp < 0.6) hitFlash = from;
        }
      }
    } else if (k === 'alpha') {
      const edge = polar(plan.emitDir, clusterR * 0.75);
      if (t < 0.3) {
        marker = { at: edge, color: '#ffd27a', pulse: 0.5 + 0.5 * Math.sin(e / 55) };
        wobble = 0.04 * Math.sin(e / 40);
      } else {
        const te = e - 0.3 * dur;
        alphaAt = polar(plan.emitDir, clusterR * 0.75 + te * 0.17);
        recoil = polar(plan.emitDir + Math.PI, 3 * Math.exp(-te / 250));
        flash = 0.6 * Math.exp(-te / 200);
      }
    } else if (k === 'betaMinus' || k === 'betaPlus') {
      const minus = k === 'betaMinus';
      const edge = polar(plan.emitDir, clusterR * 0.75);
      const flipped = t >= 0.3;
      marker = { at: edge, color: flipped ? (minus ? PROTON : NEUTRON) : minus ? NEUTRON : PROTON, pulse: flipped ? 1 : 0.5 + 0.5 * Math.sin(e / 60) };
      if (flipped) {
        const te = e - 0.3 * dur;
        const end = polar(plan.emitDir, c + 24);
        const ctrl = { x: (edge.x + end.x) / 2 - Math.sin(plan.emitDir) * plan.side * 45, y: (edge.y + end.y) / 2 + Math.cos(plan.emitDir) * plan.side * 45 };
        const s = Math.min(1, te / 520);
        beta = { at: bezier(edge, ctrl, end, s), color: minus ? '#dff3ff' : '#ffe07a', trail: [0.05, 0.1, 0.15].map((d) => bezier(edge, ctrl, end, Math.max(0, s - d))) };
        neutrino = { a: edge, b: polar(plan.emitDir + plan.side * 2.2, clusterR * 0.75 + Math.min(1, te / 600) * (c + 10)), label: minus ? 'ν̄' : 'ν', o: 0.55 * Math.max(0, 1 - Math.max(0, te - 600) / 500) };
        recoil = polar(plan.emitDir + Math.PI, 1.5 * Math.exp(-te / 200));
        flash = 0.5 * Math.exp(-te / 220);
      }
    } else if (k === 'fission' || k === 'breakup') {
      const splitT = k === 'fission' ? 0.28 : 0.2;
      if (t < splitT) {
        const u = ease(t / splitT);
        stretch = { sx: 1 + 0.55 * u, sy: 1 - 0.28 * u, deg: (plan.emitDir * 180) / Math.PI };
        wobble = 0.05 * Math.sin(e / 30) * u;
      } else {
        const ts = e - splitT * dur;
        const s = ts / (dur * (1 - splitT));
        const dist = 8 + 120 * ease(Math.min(1, s * 1.1));
        fragments = { L: polar(plan.emitDir, dist * 1.15), H: polar(plan.emitDir + Math.PI, dist * 0.85) };
        neutrons = plan.neutronDirs.map((dir) => {
          const d = ts * 0.3;
          return { at: polar(dir, 6 + d), trail: [14, 28].map((b) => polar(dir, 6 + Math.max(0, d - b))) };
        });
        if (k === 'fission') {
          const o = ts < 400 ? 1 : Math.max(0, 1 - (ts - 400) / 400);
          gammas = [plan.emitDir + 1.2, plan.emitDir - 2.0].map((dir) => ({ d: wavy({ x: 0, y: 0 }, dir, Math.min(1, ts / 400) * (c + 20), 3, 7), o }));
        }
        flash = Math.exp(-ts / 350);
      }
    }
  }

  const unstableBase = (() => { const d = decayOf(base); return d !== null && d.mode !== 'stable'; })();
  const N = neutronCount(drawn);
  const isProton = plan?.projectile === 'proton';
  const nucleusTransform = `translate(${recoil.x.toFixed(2)} ${recoil.y.toFixed(2)})` + (stretch
    ? ` rotate(${stretch.deg.toFixed(1)}) scale(${(stretch.sx * (1 + wobble)).toFixed(4)} ${(stretch.sy * (1 - wobble)).toFixed(4)})`
    : ` scale(${(1 + wobble).toFixed(4)} ${(1 - wobble).toFixed(4)})`);
  const b = beta;
  const ej = ejected;
  const fr = fragments;
  const fis = plan?.fission ?? null;
  const mono = 'ui-monospace, monospace';

  return (
    <svg className="atom" width={size} height={size} viewBox={`${-c} ${-c} ${size} ${size}`} role="img">
      {shells.map((count, i) => {
        const r = shellR(i);
        return (
          <g key={i}>
            <circle r={r} fill="none" stroke="#2a3140" strokeWidth={1} />
            {Array.from({ length: count }, (_, k) => {
              if (hole && hole.shell === i && hole.idx === k) return null;
              const a = (k / count) * TAU + (rot[i] ?? 0);
              return <circle key={k} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={2.6} fill="#8fd3ff" />;
            })}
          </g>
        );
      })}

      {neutrino ? (
        <g opacity={neutrino.o}>
          <line x1={neutrino.a.x} y1={neutrino.a.y} x2={neutrino.b.x} y2={neutrino.b.y} stroke="#9aa5b8" strokeWidth={1} strokeDasharray="2 4" />
          <text x={neutrino.b.x} y={neutrino.b.y - 4} fill="#9aa5b8" fontSize={10} textAnchor="middle" fontFamily={mono}>{neutrino.label}</text>
        </g>
      ) : null}

      {fr && fragL && fragH && fis ? (
        <g>
          {flash > 0 ? <circle r={clusterR + 14} fill="#fff1c2" opacity={0.35 * flash} /> : null}
          <g transform={`translate(${fr.L.x.toFixed(1)} ${fr.L.y.toFixed(1)})`}>
            <Cluster nucleons={fragL} r={nucleonR} />
            <text y={-(nucleonR * Math.sqrt(fis.light.A) * 1.1 + 5)} fill="#ffd27a" fontSize={9} textAnchor="middle" fontFamily={mono}>{nuclideLabel(fis.light)}</text>
          </g>
          <g transform={`translate(${fr.H.x.toFixed(1)} ${fr.H.y.toFixed(1)})`}>
            <Cluster nucleons={fragH} r={nucleonR} />
            <text y={-(nucleonR * Math.sqrt(fis.heavy.A) * 1.1 + 5)} fill="#ffd27a" fontSize={9} textAnchor="middle" fontFamily={mono}>{nuclideLabel(fis.heavy)}</text>
          </g>
        </g>
      ) : (
        <g transform={nucleusTransform}>
          {flash > 0 ? <circle r={clusterR + 8} fill="#ffd27a" opacity={0.3 * flash} /> : null}
          <Cluster nucleons={nucleons} r={nucleonR} />
          {marker ? <circle cx={marker.at.x} cy={marker.at.y} r={nucleonR + 0.6} fill={marker.color} stroke="#fff6d5" strokeWidth={1.2} opacity={0.55 + 0.45 * marker.pulse} /> : null}
        </g>
      )}

      {gammas.map((g, i) => <path key={i} d={g.d} fill="none" stroke="#b98cff" strokeWidth={1.6} opacity={g.o} strokeLinecap="round" />)}
      {photon ? <path d={photon} fill="none" stroke={photonColor} strokeWidth={photonWidth} opacity={photonOpacity} strokeLinecap="round" /> : null}
      {hitFlash ? <circle cx={hitFlash.x} cy={hitFlash.y} r={7} fill="#ffffff" opacity={0.35} /> : null}

      {projectile ? (
        <g>
          {trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 - i * 0.7} fill={isProton ? '#ff8a3d' : '#8fd3ff'} opacity={0.35 - i * 0.1} />)}
          <circle cx={projectile.x} cy={projectile.y} r={isProton ? 5 : 3.6} fill={isProton ? '#ff9a5a' : '#dff3ff'} />
          <circle cx={projectile.x} cy={projectile.y} r={isProton ? 9 : 7} fill={isProton ? '#ff8a3d' : '#8fd3ff'} opacity={0.18} />
        </g>
      ) : null}

      {ej ? (
        <g>
          {ej.trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.4 - i * 0.5} fill="#8fd3ff" opacity={0.35 - i * 0.1} />)}
          <circle cx={ej.at.x} cy={ej.at.y} r={2.8} fill="#dff3ff" />
        </g>
      ) : null}
      {dropping ? <circle cx={dropping.x} cy={dropping.y} r={2.8} fill="#dff3ff" /> : null}

      {b ? (
        <g>
          {b.trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.4 - i * 0.5} fill={b.color} opacity={0.35 - i * 0.1} />)}
          <circle cx={b.at.x} cy={b.at.y} r={2.8} fill={b.color} />
          <circle cx={b.at.x} cy={b.at.y} r={6} fill={b.color} opacity={0.2} />
        </g>
      ) : null}

      {alphaAt ? <Alpha at={alphaAt} r={nucleonR} /> : null}

      {neutrons.map((n, i) => (
        <g key={i}>
          {n.trail.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={nucleonR + 0.5 - j * 0.5} fill={NEUTRON} opacity={0.3 - j * 0.08} />)}
          <circle cx={n.at.x} cy={n.at.y} r={nucleonR + 1} fill={NEUTRON} stroke="#46d6c4" strokeWidth={1.2} />
        </g>
      ))}

      {unstableBase ? <text x={-c + 8} y={-c + 16} fill="#ffcf5a" fontSize={12} opacity={0.85}>☢</text> : null}
      <text x={0} y={c - 10} fill="#868fa1" fontSize={11} textAnchor="middle" fontFamily={mono}>
        {drawn.Z}p · {N}n
      </text>
    </svg>
  );
}
