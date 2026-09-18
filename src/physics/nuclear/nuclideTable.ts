/**
 * Mikro gorunumde karsilasilabilecek nuklidlerin bozunma verisi.
 * Yari omurler ve modlar NuBase2020 / NNDC ENSDF, Q degerleri AME2020.
 * PHYSICS.md 1.H. Veri hatti devreye girince nuklides.bin'e devreder.
 *
 * Kapsam: paletteki hedef elementlerin bol izotoplari, bunlarin (gamma,n) ve
 * (n,gamma) urunleri, dogal bozunma serileri (Th-232, U-238, U-235) ve
 * chains.ts icindeki zincir uyeleri. Tabloda olmayan nuklid "bilinmiyor"
 * sayilir ve kararli cizilir.
 */

import { DAY_S, YEAR_S } from '../constants.ts';
import type { NuclideId } from '../data/nuclides.ts';
import { afterAlpha, afterBetaMinus, afterBetaPlus, nuclideLabel } from '../data/nuclides.ts';

export type DecayKind = 'stable' | 'beta-' | 'beta+' | 'ec' | 'alpha' | '2alpha' | 'sf';

export interface NuclideDecay {
  readonly halfLifeS: number;
  readonly mode: DecayKind;
  /** Bozunma enerjisi Q, MeV. */
  readonly qMeV: number;
  /** Ikincil dal (orn. Bi-212 %36 alfa). */
  readonly branch?: { readonly mode: DecayKind; readonly fraction: number };
}

const MIN = 60;
const H = 3600;
const STABLE: NuclideDecay = { halfLifeS: Infinity, mode: 'stable', qMeV: 0 };

const T: Record<string, NuclideDecay> = {
  'H-1': STABLE, 'H-2': STABLE, 'H-3': { halfLifeS: 12.32 * YEAR_S, mode: 'beta-', qMeV: 0.0186 },
  'He-3': STABLE, 'He-4': STABLE, 'Li-6': STABLE, 'Li-7': STABLE,
  'Be-7': { halfLifeS: 53.22 * DAY_S, mode: 'ec', qMeV: 0.862 },
  'Be-8': { halfLifeS: 8.19e-17, mode: '2alpha', qMeV: 0.0918 },
  'Be-9': STABLE,
  'Be-10': { halfLifeS: 1.387e6 * YEAR_S, mode: 'beta-', qMeV: 0.556 },
  'B-10': STABLE, 'B-11': STABLE,
  'C-11': { halfLifeS: 20.36 * MIN, mode: 'beta+', qMeV: 1.982 },
  'C-12': STABLE, 'C-13': STABLE,
  'C-14': { halfLifeS: 5700 * YEAR_S, mode: 'beta-', qMeV: 0.156 },
  'N-13': { halfLifeS: 9.965 * MIN, mode: 'beta+', qMeV: 2.220 },
  'N-14': STABLE, 'O-15': { halfLifeS: 122.2, mode: 'beta+', qMeV: 2.754 }, 'O-16': STABLE,
  'Al-26': { halfLifeS: 7.17e5 * YEAR_S, mode: 'beta+', qMeV: 4.004 },
  'Al-27': STABLE,
  'Al-28': { halfLifeS: 2.245 * MIN, mode: 'beta-', qMeV: 4.642 },
  'Co-59': STABLE,
  'Co-60': { halfLifeS: 5.2714 * YEAR_S, mode: 'beta-', qMeV: 2.824 },
  'Ni-60': STABLE, 'Ni-64': STABLE,
  'Cu-62': { halfLifeS: 9.673 * MIN, mode: 'beta+', qMeV: 3.959 },
  'Cu-63': STABLE,
  'Cu-64': { halfLifeS: 12.701 * H, mode: 'beta+', qMeV: 1.675, branch: { mode: 'beta-', fraction: 0.39 } },
  'Cu-65': STABLE,
  'Mo-97': STABLE, 'Mo-98': STABLE,
  'Mo-99': { halfLifeS: 65.94 * H, mode: 'beta-', qMeV: 1.357 },
  'Ta-180': { halfLifeS: 8.154 * H, mode: 'ec', qMeV: 0.854 },
  'Ta-181': STABLE,
  'Ta-182': { halfLifeS: 114.43 * DAY_S, mode: 'beta-', qMeV: 1.814 },
  'W-182': STABLE, 'W-183': STABLE, 'W-184': STABLE,
  'W-185': { halfLifeS: 75.1 * DAY_S, mode: 'beta-', qMeV: 0.433 },
  'W-186': STABLE,
  'W-187': { halfLifeS: 23.72 * H, mode: 'beta-', qMeV: 1.312 },
  'Re-187': { halfLifeS: 4.12e10 * YEAR_S, mode: 'beta-', qMeV: 0.0026 },
  'Au-196': { halfLifeS: 6.167 * DAY_S, mode: 'ec', qMeV: 1.506 },
  'Au-197': STABLE,
  'Au-198': { halfLifeS: 2.6941 * DAY_S, mode: 'beta-', qMeV: 1.372 },
  'Hg-198': STABLE,
  'Pb-206': STABLE, 'Pb-207': STABLE, 'Pb-208': STABLE,
  'Pb-209': { halfLifeS: 3.234 * H, mode: 'beta-', qMeV: 0.644 },
  'Pb-212': { halfLifeS: 10.64 * H, mode: 'beta-', qMeV: 0.570 },
  'Bi-212': { halfLifeS: 60.55 * MIN, mode: 'beta-', qMeV: 2.252, branch: { mode: 'alpha', fraction: 0.3594 } },
  'Po-212': { halfLifeS: 2.99e-7, mode: 'alpha', qMeV: 8.954 },
  'Tl-208': { halfLifeS: 3.053 * MIN, mode: 'beta-', qMeV: 4.999 },
  'Po-216': { halfLifeS: 0.145, mode: 'alpha', qMeV: 6.906 },
  'Rn-220': { halfLifeS: 55.6, mode: 'alpha', qMeV: 6.405 },
  'Ra-224': { halfLifeS: 3.632 * DAY_S, mode: 'alpha', qMeV: 5.789 },
  'Ra-228': { halfLifeS: 5.75 * YEAR_S, mode: 'beta-', qMeV: 0.046 },
  'Ac-228': { halfLifeS: 6.15 * H, mode: 'beta-', qMeV: 2.124 },
  'Th-228': { halfLifeS: 1.9116 * YEAR_S, mode: 'alpha', qMeV: 5.520 },
  'Th-229': { halfLifeS: 7917 * YEAR_S, mode: 'alpha', qMeV: 5.168 },
  'Th-230': { halfLifeS: 7.54e4 * YEAR_S, mode: 'alpha', qMeV: 4.770 },
  'Th-231': { halfLifeS: 25.52 * H, mode: 'beta-', qMeV: 0.392 },
  'Th-232': { halfLifeS: 1.405e10 * YEAR_S, mode: 'alpha', qMeV: 4.083 },
  'Th-233': { halfLifeS: 21.83 * MIN, mode: 'beta-', qMeV: 1.245 },
  'Th-234': { halfLifeS: 24.10 * DAY_S, mode: 'beta-', qMeV: 0.273 },
  'Pa-231': { halfLifeS: 32760 * YEAR_S, mode: 'alpha', qMeV: 5.150 },
  'Pa-233': { halfLifeS: 26.975 * DAY_S, mode: 'beta-', qMeV: 0.571 },
  'Pa-234': { halfLifeS: 1.159 * MIN, mode: 'beta-', qMeV: 2.269 },
  'U-233': { halfLifeS: 1.592e5 * YEAR_S, mode: 'alpha', qMeV: 4.909 },
  'U-234': { halfLifeS: 2.455e5 * YEAR_S, mode: 'alpha', qMeV: 4.858 },
  'U-235': { halfLifeS: 7.04e8 * YEAR_S, mode: 'alpha', qMeV: 4.679 },
  'U-236': { halfLifeS: 2.342e7 * YEAR_S, mode: 'alpha', qMeV: 4.572 },
  'U-237': { halfLifeS: 6.75 * DAY_S, mode: 'beta-', qMeV: 0.519 },
  'U-238': { halfLifeS: 4.468e9 * YEAR_S, mode: 'alpha', qMeV: 4.270 },
  'U-239': { halfLifeS: 23.45 * MIN, mode: 'beta-', qMeV: 1.262 },
  'Np-239': { halfLifeS: 2.356 * DAY_S, mode: 'beta-', qMeV: 0.722 },
  'Pu-239': { halfLifeS: 24110 * YEAR_S, mode: 'alpha', qMeV: 5.245 },
};

/** Bozunma verisi; tabloda yoksa null (UI kararli cizer). */
export function decayOf(n: NuclideId): NuclideDecay | null {
  return T[nuclideLabel(n)] ?? null;
}

export function isUnstable(n: NuclideId): boolean {
  const d = decayOf(n);
  return d !== null && d.mode !== 'stable';
}

/** Termal notronla bolunebilen (fissile) nuklidler. */
export function isFissile(n: NuclideId): boolean {
  const l = nuclideLabel(n);
  return l === 'U-235' || l === 'U-233' || l === 'Pu-239' || l === 'Pu-241';
}

/** Bozunma sonrasi nuklid. 2alpha icin urun He-4 (ikisi de). */
export function decayProduct(n: NuclideId, mode: DecayKind): NuclideId {
  switch (mode) {
    case 'alpha': return afterAlpha(n);
    case '2alpha': return { Z: 2, A: 4 };
    case 'beta-': return afterBetaMinus(n);
    case 'beta+': case 'ec': return afterBetaPlus(n);
    default: return n;
  }
}

/**
 * Yari omru `limitS` altinda olan bozunmalar "izlenebilir" sayilir: koreografi
 * bunlari ardisik oynatir, daha uzunlarinda durur.
 */
export function isPromptWithin(n: NuclideId, limitS: number): boolean {
  const d = decayOf(n);
  return d !== null && d.mode !== 'stable' && d.halfLifeS < limitS;
}

export interface FissionOutcome {
  readonly light: NuclideId;
  readonly heavy: NuclideId;
  readonly neutrons: number;
}

/** U-236* icin tipik asimetrik parca ciftleri (Z_l, A_l, Z_h, A_h, nu). */
const FRAGMENT_PAIRS: readonly (readonly [number, number, number, number, number])[] = [
  [36, 92, 56, 141, 3], // Kr + Ba
  [38, 94, 54, 140, 2], // Sr + Xe
  [37, 90, 55, 143, 3], // Rb + Cs
  [40, 100, 52, 134, 2], // Zr + Te
  [39, 95, 53, 139, 2], // Y + I
  [42, 103, 50, 131, 2], // Mo + Sn
];

/**
 * Bolunme parcalari. `u` [0,1) duzgun sayi (cagiran uretir; fizik cekirdegi
 * rastgelelik uretmez). Kutle ve yuk korunumu bilesik cekirdege gore
 * duzeltilir: A_l + A_h + nu = A, Z_l + Z_h = Z.
 */
export function fissionFragments(compound: NuclideId, u: number): FissionOutcome {
  const k = Math.min(FRAGMENT_PAIRS.length - 1, Math.max(0, Math.floor(u * FRAGMENT_PAIRS.length)));
  const [zl, al, zh, ah, nu] = FRAGMENT_PAIRS[k]!;
  const dz = compound.Z - (zl + zh);
  const da = compound.A - (al + ah + nu);
  return { light: { Z: zl, A: al }, heavy: { Z: zh + dz, A: ah + da }, neutrons: nu };
}
