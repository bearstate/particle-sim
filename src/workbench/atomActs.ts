import type { NuclideId } from '../physics/data/nuclides.ts';
import { afterNeutronCapture, afterNeutronEmission } from '../physics/data/nuclides.ts';
import { decayOf, decayProduct, fissionFragments, isFissile, isPromptWithin, type DecayKind, type FissionOutcome } from '../physics/nuclear/nuclideTable.ts';
import { YEAR_S } from '../physics/constants.ts';

/**
 * Mikro gorunum perde planlayicisi. BohrAtom yalnizca cizer; hangi perdenin
 * ne zaman geldigi, perdenin ardindan hangi perdenin geldigi (yakalama ->
 * beta zinciri, Be-9(gamma,n)Be-8 -> iki alfa, U-235 + n -> fisyon) burada.
 *
 *   below   : sacilma / fren isimasi / ic kabuk iyonlasmasi
 *   above   : + fotonotron
 *   neutrons: yakalama (fissile hedefte fisyona gider)
 *   photons : gecis / fotoelektrik iyonlasma
 *   protons : sacilma / iyonlasma
 *   idle    : hedef kararsizsa kendi bozunmasi
 * Kararsiz hedeflerde her modda %12 kendi bozunmasi karisir.
 *
 * Gorsel zaman gercek zaman degildir: U-238'in 4.5 milyar yillik alfa
 * bozunmasi birkac saniyede bir oynar. Anlati yari omru soyler.
 */

export type AtomMode = 'idle' | 'below' | 'above' | 'neutrons' | 'photons' | 'protons';
export type ActKind = 'scatter' | 'brems' | 'photoneutron' | 'capture' | 'photonPass' | 'ionize' | 'alpha' | 'betaMinus' | 'betaPlus' | 'ec' | 'fission' | 'breakup';
export type ActPhase = 'start' | 'photon' | 'gdr' | 'neutron' | 'hole' | 'xray' | 'stretch' | 'split' | 'emit' | 'done';
export type Projectile = 'electron' | 'proton' | 'photon' | 'neutron' | null;

export interface Pt { x: number; y: number }

export interface ActPlan {
  readonly kind: ActKind;
  readonly projectile: Projectile;
  readonly from: NuclideId;
  readonly to: NuclideId;
  /** Bu perdeye gelene kadar gecen sim zamani (onceki nuklidin yari omru), s. */
  readonly waitS: number | null;
  readonly halfLifeS: number | null;
  readonly qMeV: number;
  readonly fission: FissionOutcome | null;
  readonly dur: number;
  readonly p0: Pt;
  readonly p1: Pt;
  readonly p2: Pt;
  readonly side: number;
  readonly photonDir: number;
  readonly neutronDir: number;
  readonly emitDir: number;
  readonly neutronDirs: readonly number[];
  readonly depth: number;
}

export interface Pending {
  readonly from: NuclideId;
  readonly kind: ActKind | 'decay';
  readonly waitS: number | null;
  readonly depth: number;
}

export interface Geometry { readonly c: number; readonly clusterR: number }

/** Bundan uzun yari omurlu bozunmalar zincirde oynatilmaz (U-233, Pa-231...). */
export const CHAIN_LIMIT_S = 100 * YEAR_S;
const MAX_DEPTH = 10;

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function decayKindOf(n: NuclideId): { kind: ActKind; mode: DecayKind } | null {
  const d = decayOf(n);
  if (!d || d.mode === 'stable') return null;
  const mode = d.branch && Math.random() < d.branch.fraction ? d.branch.mode : d.mode;
  switch (mode) {
    case 'alpha': return { kind: 'alpha', mode };
    case 'beta-': return { kind: 'betaMinus', mode };
    case 'beta+': return { kind: 'betaPlus', mode };
    case 'ec': return { kind: 'ec', mode };
    case '2alpha': return { kind: 'breakup', mode };
    case 'sf': return { kind: 'fission', mode };
    default: return null;
  }
}

function pickKind(mode: AtomMode, nuclide: NuclideId): ActKind | 'decay' | null {
  const d = decayOf(nuclide);
  const unstable = d !== null && d.mode !== 'stable';
  const r = Math.random();
  if (mode === 'idle') return unstable ? 'decay' : null;
  if (unstable && r > 0.88) return 'decay';
  const s = r / 0.88;
  switch (mode) {
    case 'below': return s < 0.5 ? 'scatter' : s < 0.74 ? 'brems' : 'ionize';
    case 'above': return s < 0.34 ? 'scatter' : s < 0.54 ? 'brems' : s < 0.68 ? 'ionize' : 'photoneutron';
    case 'neutrons': return 'capture';
    case 'photons': return s < 0.68 ? 'photonPass' : 'ionize';
    case 'protons': return s < 0.7 ? 'scatter' : 'ionize';
  }
}

/** Elektron yolu: sol taraftan girer, cekirdegin yanindan kivrilarak cikar. */
function electronPath(c: number, clusterR: number, strong: boolean, heavy: boolean): { p0: Pt; p1: Pt; p2: Pt; side: number } {
  const entryAngle = rnd(-0.55, 0.55);
  const side = Math.random() < 0.5 ? 1 : -1;
  const b = clusterR * rnd(0.5, 1.6) * side;
  const p0: Pt = { x: -c - 10, y: Math.tan(entryAngle) * c * 0.6 + b * 0.4 };
  const p1: Pt = { x: -clusterR * 0.2, y: b };
  const deflect = ((strong ? 1.6 : 1.0) * (clusterR * 1.4)) / Math.max(clusterR * 0.5, Math.abs(b)) * (heavy ? 0.25 : 1);
  const p2: Pt = { x: c + 10, y: b + side * deflect * 0.5 * c * 0.35 };
  return { p0, p1, p2, side };
}

function durationOf(kind: ActKind): number {
  switch (kind) {
    case 'scatter': return rnd(700, 1000);
    case 'brems': return rnd(1300, 1700);
    case 'photoneutron': return rnd(2300, 2800);
    case 'capture': return rnd(1400, 1800);
    case 'photonPass': return rnd(600, 800);
    case 'ionize': return rnd(2100, 2400);
    case 'alpha': return rnd(1500, 1800);
    case 'betaMinus': case 'betaPlus': return rnd(1400, 1700);
    case 'ec': return rnd(1700, 1900);
    case 'fission': return rnd(2500, 2800);
    case 'breakup': return rnd(1500, 1700);
  }
}

function projectileOf(kind: ActKind, mode: AtomMode): Projectile {
  if (kind === 'capture') return 'neutron';
  if (kind === 'photonPass') return 'photon';
  if (kind === 'scatter' || kind === 'brems' || kind === 'photoneutron' || kind === 'ionize') {
    return mode === 'protons' ? 'proton' : mode === 'photons' ? 'photon' : 'electron';
  }
  return null;
}

/** Perdeyi somutlastir: nuklid aritmetigi, gecis geometrisi, sure. */
export function makePlan(kind: ActKind, from: NuclideId, mode: AtomMode, geom: Geometry, waitS: number | null, depth: number): ActPlan {
  const { c, clusterR } = geom;
  const d = decayOf(from);
  let to = from;
  let fission: FissionOutcome | null = null;
  switch (kind) {
    case 'photoneutron': to = afterNeutronEmission(from); break;
    case 'capture': to = afterNeutronCapture(from); break;
    case 'alpha': to = decayProduct(from, 'alpha'); break;
    case 'betaMinus': to = decayProduct(from, 'beta-'); break;
    case 'betaPlus': to = decayProduct(from, 'beta+'); break;
    case 'ec': to = decayProduct(from, 'ec'); break;
    case 'fission': fission = fissionFragments(from, Math.random()); to = fission.heavy; break;
    case 'breakup': fission = { light: { Z: 2, A: 4 }, heavy: { Z: 2, A: 4 }, neutrons: 0 }; to = fission.heavy; break;
    default: break;
  }
  const projectile = projectileOf(kind, mode);
  const heavy = projectile === 'proton';
  const strong = kind !== 'scatter';
  const path = projectile === 'neutron' || projectile === 'photon'
    ? { p0: { x: -c - 10, y: rnd(-clusterR * 0.5, clusterR * 0.5) }, p1: { x: 0, y: 0 }, p2: { x: c + 10, y: rnd(-clusterR, clusterR) }, side: 1 }
    : projectile ? electronPath(c, clusterR, strong, heavy) : { p0: { x: 0, y: 0 }, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, side: 1 };
  const emitDir = rnd(0, Math.PI * 2);
  const nu = fission?.neutrons ?? 0;
  const neutronDirs = Array.from({ length: nu }, () => rnd(0, Math.PI * 2));
  const isDecay = DECAY_KINDS.has(kind) && !(kind === 'fission' && waitS !== null);
  return {
    kind, projectile, from, to, waitS, fission, depth,
    halfLifeS: isDecay && d ? d.halfLifeS : null,
    qMeV: isDecay && d ? d.qMeV : 0,
    dur: durationOf(kind),
    ...path,
    photonDir: rnd(-0.6, 0.6),
    neutronDir: rnd(-2.6, 0.6),
    emitDir,
    neutronDirs,
  };
}

/** Kuyrukta bekleyen varsa onu, yoksa moda gore rastgele perde. */
export function planNext(mode: AtomMode, nuclide: NuclideId, queue: Pending[], geom: Geometry): ActPlan | null {
  const pending = queue.shift();
  if (pending) {
    const kind = pending.kind === 'decay' ? decayKindOf(pending.from)?.kind ?? null : pending.kind;
    if (kind) return makePlan(kind, pending.from, mode, geom, pending.waitS, pending.depth);
  }
  const k = pickKind(mode, nuclide);
  if (!k) return null;
  if (k === 'decay') {
    const dk = decayKindOf(nuclide);
    return dk ? makePlan(dk.kind, nuclide, mode, geom, null, 0) : null;
  }
  return makePlan(k, nuclide, mode, geom, null, 0);
}

/** Perde bitince kuyruga eklenecekler: zincirin devami. */
export function followUps(plan: ActPlan): Pending[] {
  if (plan.depth >= MAX_DEPTH) return [];
  const depth = plan.depth + 1;
  const p = plan.to;
  switch (plan.kind) {
    case 'capture':
      if (isFissile(plan.from)) return [{ from: p, kind: 'fission', waitS: 1e-14, depth }];
      break;
    case 'fission':
    case 'breakup':
    case 'scatter':
    case 'brems':
    case 'photonPass':
    case 'ionize':
      return [];
    default:
      break;
  }
  const d = decayOf(p);
  if (!d || d.mode === 'stable') return [];
  if (d.mode === '2alpha') return [{ from: p, kind: 'breakup', waitS: d.halfLifeS, depth }];
  if (isPromptWithin(p, CHAIN_LIMIT_S)) return [{ from: p, kind: 'decay', waitS: d.halfLifeS, depth }];
  return [];
}

export function phaseAt(plan: ActPlan, e: number): ActPhase {
  if (e >= plan.dur) return 'done';
  const t = e / plan.dur;
  switch (plan.kind) {
    case 'scatter': return 'start';
    case 'brems': return e < plan.dur * 0.275 ? 'start' : 'photon';
    case 'photoneutron': return e < 450 ? 'start' : e < 770 ? 'photon' : e < 1030 ? 'gdr' : 'neutron';
    case 'capture': return e < 900 ? 'start' : 'gdr';
    case 'photonPass': return 'photon';
    case 'ionize': return t < 0.42 ? 'start' : t < 0.62 ? 'hole' : 'xray';
    case 'alpha': case 'betaMinus': case 'betaPlus': return t < 0.3 ? 'start' : 'emit';
    case 'ec': return t < 0.35 ? 'start' : t < 0.55 ? 'emit' : 'xray';
    case 'fission': return t < 0.28 ? 'stretch' : 'split';
    case 'breakup': return t < 0.2 ? 'stretch' : 'split';
  }
}

/** Perdenin bu aninda cizilecek nuklid (donusum aninda degisir). */
export function shownNuclide(plan: ActPlan, phase: ActPhase): NuclideId {
  switch (plan.kind) {
    case 'photoneutron': return phase === 'neutron' || phase === 'done' ? plan.to : plan.from;
    case 'capture': return phase === 'gdr' || phase === 'done' ? plan.to : plan.from;
    case 'alpha': case 'betaMinus': case 'betaPlus': return phase === 'emit' || phase === 'done' ? plan.to : plan.from;
    case 'ec': return phase === 'start' ? plan.from : plan.to;
    default: return plan.from;
  }
}

export const DECAY_KINDS: ReadonlySet<ActKind> = new Set(['alpha', 'betaMinus', 'betaPlus', 'ec', 'fission', 'breakup']);
