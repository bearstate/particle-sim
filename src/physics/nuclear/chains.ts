/**
 * Notron tepkimeleri ve bozunma zincirleri. PHYSICS.md bolum 1.H.
 *
 * Amiral gemisi senaryo kullanicinin istedigi toryum dongusudur:
 *   Th-232 + n -> Th-233 -(21.8 dk)-> Pa-233 -(27 gun)-> U-233
 *
 * Yari omurler NNDC/ENSDF, termal tesir kesitleri ENDF/B-VIII.0'dan
 * kuratorlenmistir. Veri hatti devreye girince bu dosya nuklides.bin'e
 * devreder; arayuz degismez.
 */

import { DAY_S, YEAR_S } from '../constants.ts';
import type { ChainNode } from './bateman.ts';

export type DecayMode = 'stable' | 'beta-' | 'beta+' | 'alpha' | 'ec' | 'it' | 'sf';

export interface ChainMember {
  readonly id: string;
  readonly Z: number;
  readonly A: number;
  /** Yari omur, s. Kararli icin Infinity. */
  readonly halfLifeS: number;
  readonly mode: DecayMode;
  /** Bozunma enerjisi Q, MeV. Doz hesabinin girdisi. */
  readonly qValueMeV: number;
}

export type ReactionType = 'capture' | 'fission' | 'n,alpha' | 'n,p' | 'n,2n';

export interface NeutronReaction {
  readonly id: string;
  readonly targetSymbol: string;
  readonly targetZ: number;
  readonly targetA: number;
  readonly type: ReactionType;
  /** 0.0253 eV'de tesir kesiti, barn. */
  readonly thermalBarn: number;
  /** Rezonans integrali, barn. Epitermal akiyla carpilir. */
  readonly resonanceIntegralBarn?: number;
  /** Hizli (~1 MeV) tesir kesiti, barn. */
  readonly fastBarn?: number;
  /**
   * Tepkimeden dogan zincir. Indeks 0 = anlik urun. Son uye kararli veya
   * pratik olarak kararli olmalidir.
   */
  readonly chain: readonly ChainMember[];
  /** Tepkime Q degeri, MeV. */
  readonly qValueMeV?: number;
}

const MIN = 60;
const HOUR = 3600;

export const REACTIONS: readonly NeutronReaction[] = [
  {
    id: 'th232-capture',
    targetSymbol: 'Th',
    targetZ: 90,
    targetA: 232,
    type: 'capture',
    thermalBarn: 7.34,
    resonanceIntegralBarn: 85,
    fastBarn: 0.15,
    qValueMeV: 4.786,
    chain: [
      { id: 'Th-233', Z: 90, A: 233, halfLifeS: 21.83 * MIN, mode: 'beta-', qValueMeV: 1.245 },
      { id: 'Pa-233', Z: 91, A: 233, halfLifeS: 26.975 * DAY_S, mode: 'beta-', qValueMeV: 0.571 },
      { id: 'U-233', Z: 92, A: 233, halfLifeS: 1.592e5 * YEAR_S, mode: 'alpha', qValueMeV: 4.909 },
      { id: 'Th-229', Z: 90, A: 229, halfLifeS: 7917 * YEAR_S, mode: 'alpha', qValueMeV: 5.168 },
    ],
  },
  {
    id: 'u238-capture',
    targetSymbol: 'U',
    targetZ: 92,
    targetA: 238,
    type: 'capture',
    thermalBarn: 2.68,
    resonanceIntegralBarn: 277,
    fastBarn: 0.14,
    qValueMeV: 4.806,
    chain: [
      { id: 'U-239', Z: 92, A: 239, halfLifeS: 23.45 * MIN, mode: 'beta-', qValueMeV: 1.262 },
      { id: 'Np-239', Z: 93, A: 239, halfLifeS: 2.356 * DAY_S, mode: 'beta-', qValueMeV: 0.722 },
      { id: 'Pu-239', Z: 94, A: 239, halfLifeS: 24110 * YEAR_S, mode: 'alpha', qValueMeV: 5.245 },
    ],
  },
  {
    id: 'co59-capture',
    targetSymbol: 'Co',
    targetZ: 27,
    targetA: 59,
    type: 'capture',
    thermalBarn: 37.18,
    resonanceIntegralBarn: 74,
    qValueMeV: 7.492,
    chain: [
      { id: 'Co-60', Z: 27, A: 60, halfLifeS: 5.2714 * YEAR_S, mode: 'beta-', qValueMeV: 2.824 },
      { id: 'Ni-60', Z: 28, A: 60, halfLifeS: Infinity, mode: 'stable', qValueMeV: 0 },
    ],
  },
  {
    id: 'au197-capture',
    targetSymbol: 'Au',
    targetZ: 79,
    targetA: 197,
    type: 'capture',
    thermalBarn: 98.65,
    resonanceIntegralBarn: 1550,
    qValueMeV: 6.512,
    chain: [
      { id: 'Au-198', Z: 79, A: 198, halfLifeS: 2.6941 * DAY_S, mode: 'beta-', qValueMeV: 1.372 },
      { id: 'Hg-198', Z: 80, A: 198, halfLifeS: Infinity, mode: 'stable', qValueMeV: 0 },
    ],
  },
  {
    id: 'w186-capture',
    targetSymbol: 'W',
    targetZ: 74,
    targetA: 186,
    type: 'capture',
    thermalBarn: 38.1,
    resonanceIntegralBarn: 485,
    qValueMeV: 5.467,
    chain: [
      { id: 'W-187', Z: 74, A: 187, halfLifeS: 23.72 * HOUR, mode: 'beta-', qValueMeV: 1.312 },
      { id: 'Re-187', Z: 75, A: 187, halfLifeS: 4.12e10 * YEAR_S, mode: 'beta-', qValueMeV: 0.0026 },
    ],
  },
  {
    id: 'cu63-capture',
    targetSymbol: 'Cu',
    targetZ: 29,
    targetA: 63,
    type: 'capture',
    thermalBarn: 4.5,
    resonanceIntegralBarn: 5.0,
    qValueMeV: 7.916,
    chain: [
      { id: 'Cu-64', Z: 29, A: 64, halfLifeS: 12.701 * HOUR, mode: 'beta+', qValueMeV: 1.675 },
      { id: 'Ni-64', Z: 28, A: 64, halfLifeS: Infinity, mode: 'stable', qValueMeV: 0 },
    ],
  },
  {
    id: 'li6-n-alpha',
    targetSymbol: 'Li',
    targetZ: 3,
    targetA: 6,
    type: 'n,alpha',
    thermalBarn: 940,
    qValueMeV: 4.78,
    chain: [{ id: 'H-3', Z: 1, A: 3, halfLifeS: 12.32 * YEAR_S, mode: 'beta-', qValueMeV: 0.0186 }],
  },
  {
    id: 'b10-n-alpha',
    targetSymbol: 'B',
    targetZ: 5,
    targetA: 10,
    type: 'n,alpha',
    thermalBarn: 3840,
    qValueMeV: 2.79,
    chain: [{ id: 'Li-7', Z: 3, A: 7, halfLifeS: Infinity, mode: 'stable', qValueMeV: 0 }],
  },
  {
    id: 'u235-fission',
    targetSymbol: 'U',
    targetZ: 92,
    targetA: 235,
    type: 'fission',
    thermalBarn: 585,
    fastBarn: 1.2,
    qValueMeV: 202.5,
    chain: [],
  },
];

export function reactionById(id: string): NeutronReaction | undefined {
  return REACTIONS.find((r) => r.id === id);
}

/** Hedef elementin (Z) tum tepkimeleri. */
export function reactionsForZ(Z: number): readonly NeutronReaction[] {
  return REACTIONS.filter((r) => r.targetZ === Z);
}

/**
 * Bir tepkimenin zincirini Bateman cozucusunun bekledigi `ChainNode[]`
 * bicimine cevirir. Dogrusal zincir varsayilir; her uye bir sonrakine gider.
 */
export function toChainNodes(reaction: NeutronReaction): ChainNode[] {
  return reaction.chain.map((m, i) => ({
    id: m.id,
    lambda: Number.isFinite(m.halfLifeS) && m.halfLifeS > 0 ? Math.LN2 / m.halfLifeS : 0,
    branches: i + 1 < reaction.chain.length ? [{ to: i + 1, fraction: 1 }] : [],
  }));
}

/** U-235 fisyonu basina ortalama ani notron sayisi. */
export const FISSION_NU_U235 = 2.43;
/** Fisyon basina serbest kalan toplam enerji, MeV. */
export const FISSION_ENERGY_U235_MEV = 202.5;
