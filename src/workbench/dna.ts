/**
 * DNA yakin plani icin iz planlama. PHYSICS.md 1.J. EGITIM MODELI.
 *
 * Sarmal geometrisi: B-DNA, donus basina 10.5 baz cifti; iki omurga birbirine
 * pi faz farkiyla. Bir iz (foton/elektron/proton/notron) planlanirken hangi
 * baz ciftlerinde hangi lezyonun olusacagi burada kararlastirilir:
 *   dusuk LET (foton, e-): seyrek iyonlasma, cogu hasar OH* radikali ile
 *                          (dolayli), tekil SSB; DSB nadir ve onarilabilir
 *   yuksek LET (p+, notron -> geri tepen proton): yogun iz, iz boyunca
 *                          KUMELENMIS DSB + SSB + baz hasari; kalici
 * Sayimlar telemetri degildir — telemetri survival.ts'den gelir.
 */

export interface DnaGeom {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly amp: number;
  readonly bp: number;
  /** Serit (kirpma) sinirlari. */
  readonly top: number;
  readonly bottom: number;
}

export type LesionKind = 'ssb' | 'dsb' | 'base';
export interface Lesion {
  readonly id: number;
  readonly i: number;
  readonly strand: 0 | 1;
  readonly kind: LesionKind;
  readonly born: number;
  readonly clustered: boolean;
  /** Onarim suresi, ms. Kalici icin Infinity. */
  readonly ttl: number;
}

export interface Pt { readonly x: number; readonly y: number }
export interface Radical { readonly x: number; readonly y: number; readonly tx: number; readonly ty: number; readonly hit: boolean }
export type TrackKind = 'photon' | 'electron' | 'proton' | 'neutron';

export interface Track {
  readonly id: number;
  readonly kind: TrackKind;
  readonly born: number;
  readonly dur: number;
  /** Notr birincil (foton dalgasi / notron kesikli), varsa. */
  readonly primary: readonly Pt[] | null;
  /** Yuklu ikincil iz (elektron/proton). */
  readonly secondary: readonly Pt[];
  /** Sacilan notronun devam yolu. */
  readonly exit: readonly Pt[] | null;
  readonly ions: readonly Pt[];
  readonly radicals: readonly Radical[];
  readonly lesions: readonly Lesion[];
  readonly hitAt: number;
  readonly dense: boolean;
}

export const TWIST = (Math.PI * 2) / 10.5;
export const BASES = ['A', 'T', 'G', 'C'] as const;

export function spacing(g: DnaGeom): number {
  return (g.x1 - g.x0) / (g.bp - 1);
}

/** i. baz ciftinin s omurgasi: x, y ve derinlik z (on taraf z > 0). */
export function helixPoint(g: DnaGeom, i: number, strand: 0 | 1, phase: number): { x: number; y: number; z: number } {
  const th = i * TWIST + phase + strand * Math.PI;
  return { x: g.x0 + i * spacing(g), y: g.y + g.amp * Math.sin(th), z: Math.cos(th) };
}

/** Baz sirasi (deterministik, sozde rastgele). */
export function baseAt(i: number): 0 | 1 | 2 | 3 {
  return ((i * 7 + 3) % 4) as 0 | 1 | 2 | 3;
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Polilinin sarmal eksenini (y = g.y) kestigi ilk baz cifti indeksi. */
export function crossingIndex(g: DnaGeom, pts: readonly Pt[]): number | null {
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[k + 1]!;
    if ((a.y - g.y) * (b.y - g.y) > 0) continue;
    const t = (g.y - a.y) / (b.y - a.y || 1e-9);
    const x = a.x + (b.x - a.x) * t;
    const i = Math.round((x - g.x0) / spacing(g));
    if (i >= 0 && i < g.bp) return i;
  }
  return null;
}

function sample(pts: readonly Pt[], step: number, rnd: () => number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = rnd() * step; d < len; d += step * (0.6 + rnd() * 0.8)) {
      const p = lerp(a, b, d / len);
      out.push({ x: p.x + (rnd() - 0.5) * 2, y: p.y + (rnd() - 0.5) * 2 });
    }
  }
  return out;
}

const SSB_TTL = (rnd: () => number) => 5000 + rnd() * 4000;
const DSB_TTL = (rnd: () => number) => 14000 + rnd() * 6000;

/**
 * Bir iz planla. `rnd` [0,1) uretir. Lezyonlar iz DNA'ya ulastiginda
 * (hitAt) uygulanir; radikaller hedefe yurur, `hit` olanlar SSB birakir.
 */
export function planTrack(kind: TrackKind, g: DnaGeom, now: number, nextId: () => number, rnd: () => number): Track {
  const H = g.bottom - g.top;
  const dense = kind === 'proton' || kind === 'neutron';
  let primary: Pt[] | null = null;
  let secondary: Pt[];
  let exit: Pt[] | null = null;
  if (kind === 'photon') {
    const start: Pt = { x: g.x0 + rnd() * (g.x1 - g.x0) * 0.5, y: g.top - 4 };
    const compton: Pt = { x: start.x + 20 + rnd() * 50, y: g.y + (rnd() < 0.5 ? -1 : 1) * (g.amp + 8 + rnd() * 22) };
    primary = [start, compton];
    const dir = Math.atan2(g.y - compton.y, 1) + (rnd() - 0.5) * 1.4;
    const len = 50 + rnd() * 50;
    const mid: Pt = { x: compton.x + Math.cos(dir) * len * 0.5, y: compton.y + Math.sin(dir) * len * 0.5 };
    secondary = [compton, { x: mid.x + (rnd() - 0.5) * 8, y: mid.y + (rnd() - 0.5) * 8 }, { x: compton.x + Math.cos(dir) * len, y: compton.y + Math.sin(dir) * len }];
  } else if (kind === 'electron') {
    const a: Pt = { x: g.x0 - 6, y: g.top + 10 + rnd() * (H - 20) };
    const dir = Math.atan2(g.y - a.y, g.x1 - g.x0) * (0.4 + rnd() * 0.8);
    const len = 90 + rnd() * 90;
    const m1: Pt = { x: a.x + Math.cos(dir) * len * 0.4, y: a.y + Math.sin(dir) * len * 0.4 + (rnd() - 0.5) * 12 };
    const m2: Pt = { x: a.x + Math.cos(dir) * len * 0.75, y: a.y + Math.sin(dir) * len * 0.75 + (rnd() - 0.5) * 16 };
    secondary = [a, m1, m2, { x: a.x + Math.cos(dir) * len, y: a.y + Math.sin(dir) * len + (rnd() - 0.5) * 20 }];
  } else if (kind === 'proton') {
    const a: Pt = { x: g.x0 - 6, y: g.top + 10 + rnd() * (H - 20) };
    // Eksenin obur tarafinda biter: iz sarmali her zaman keser.
    secondary = [a, { x: g.x1 + 6, y: g.y - (a.y - g.y) * (0.3 + rnd() * 1.2) }];
  } else {
    const a: Pt = { x: g.x0 - 6, y: g.top + 8 + rnd() * (H - 16) };
    const hit: Pt = { x: g.x0 + 30 + rnd() * (g.x1 - g.x0 - 80), y: g.y + (rnd() - 0.5) * (g.amp * 2 + 30) };
    primary = [a, hit];
    const dir = (rnd() - 0.5) * 2.4 + (hit.y > g.y ? -0.6 : 0.6);
    const len = 30 + rnd() * 28;
    secondary = [hit, { x: hit.x + Math.cos(dir) * len, y: hit.y + Math.sin(dir) * len }];
    const ndir = Math.atan2(hit.y - a.y, hit.x - a.x) + (rnd() - 0.5) * 1.2;
    exit = [hit, { x: hit.x + Math.cos(ndir) * 140, y: hit.y + Math.sin(ndir) * 140 }];
  }
  const ions = sample(secondary, dense ? 2.6 : 9, rnd);
  const ci = crossingIndex(g, secondary);
  const lesions: Lesion[] = [];
  const radicals: Radical[] = [];
  if (ci !== null) {
    const s0: 0 | 1 = rnd() < 0.5 ? 0 : 1;
    const s1: 0 | 1 = s0 === 0 ? 1 : 0;
    if (dense) {
      lesions.push({ id: nextId(), i: ci, strand: s0, kind: 'dsb', born: now, clustered: true, ttl: Infinity });
      lesions.push({ id: nextId(), i: Math.max(0, ci - 1 - Math.floor(rnd() * 2)), strand: s1, kind: 'ssb', born: now, clustered: true, ttl: SSB_TTL(rnd) * 2 });
      lesions.push({ id: nextId(), i: Math.min(g.bp - 1, ci + 1 + Math.floor(rnd() * 2)), strand: s0, kind: 'base', born: now, clustered: true, ttl: DSB_TTL(rnd) });
      if (rnd() < 0.5) lesions.push({ id: nextId(), i: Math.min(g.bp - 1, ci + 2 + Math.floor(rnd() * 2)), strand: s1, kind: 'ssb', born: now, clustered: true, ttl: SSB_TTL(rnd) * 2 });
    } else {
      const r = rnd();
      if (r < 0.1) lesions.push({ id: nextId(), i: ci, strand: s0, kind: 'dsb', born: now, clustered: false, ttl: DSB_TTL(rnd) });
      else if (r < 0.6) lesions.push({ id: nextId(), i: ci, strand: s0, kind: 'ssb', born: now, clustered: false, ttl: SSB_TTL(rnd) });
      else if (r < 0.8) lesions.push({ id: nextId(), i: ci, strand: s0, kind: 'base', born: now, clustered: false, ttl: SSB_TTL(rnd) });
    }
  }
  // Su radyolizi: eksene yakin iyonlasmalardan OH* radikalleri; bir kismi omurgaya ulasir.
  for (const ion of ions) {
    const dy = ion.y - g.y;
    if (Math.abs(dy) > g.amp + 16 || Math.abs(dy) < 3 || rnd() > (dense ? 0.25 : 0.45)) continue;
    const i = Math.round((ion.x - g.x0) / spacing(g));
    if (i < 0 || i >= g.bp) continue;
    const hit = rnd() < 0.55;
    const strand: 0 | 1 = rnd() < 0.5 ? 0 : 1;
    radicals.push({ x: ion.x, y: ion.y, tx: g.x0 + i * spacing(g) + (rnd() - 0.5) * 3, ty: g.y + Math.sign(dy) * g.amp * (hit ? 0.6 : 1.4), hit });
    if (hit && rnd() < 0.7 && !dense) lesions.push({ id: nextId(), i, strand, kind: rnd() < 0.85 ? 'ssb' : 'base', born: now, clustered: false, ttl: SSB_TTL(rnd) });
  }
  return { id: nextId(), kind, born: now, dur: 1500, primary, secondary, exit, ions, radicals: radicals.slice(0, 6), lesions, hitAt: 900, dense };
}

/** Suresi dolan lezyonlari at; kapasite asilirsa kalicilar korunur. */
export function stepLesions(lesions: readonly Lesion[], now: number, cap = 26): Lesion[] {
  const alive = lesions.filter((l) => now - l.born < l.ttl);
  if (alive.length <= cap) return alive;
  const perm = alive.filter((l) => !Number.isFinite(l.ttl));
  const temp = alive.filter((l) => Number.isFinite(l.ttl)).sort((a, b) => b.born - a.born);
  return [...perm.slice(-cap), ...temp].slice(0, cap);
}
