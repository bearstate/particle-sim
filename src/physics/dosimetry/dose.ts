/**
 * Sogurulan doz, esdeger doz ve etkin doz. PHYSICS.md bolum 1.J.
 *
 * !!! EGITIM AMACLIDIR !!!
 * Bu modul radyasyon korunmasi, klinik dozimetri, kalkan tasarimi veya
 * herhangi bir gercek maruziyet degerlendirmesi icin KULLANILAMAZ. Basitlestirilmis
 * geometri (nokta kaynak, ters kare), sacilma ve birikme (build-up) ihmali ve
 * yaklasik tesir kesitleri iceren bir ogretim modelidir. Arayuzde bu uyari
 * gorunur bicimde yer almalidir.
 *
 *   D = E_sogurulan/m   [Gy = J/kg]
 *   H = sum(w_R * D_R)  [Sv]
 *   E = sum(w_T * H_T)  [Sv]
 */

import { MEV_TO_J } from '../constants.ts';
import type { ParticleSpecies } from '../types.ts';

/** Sogurulan doz, Gy. */
export function absorbedDoseGy(energyJ: number, massKg: number): number {
  if (massKg <= 0) return 0;
  return energyJ / massKg;
}

/** MeV cinsinden biriken enerjiden doz, Gy. */
export function doseFromMeVGy(energyMeV: number, massKg: number): number {
  return absorbedDoseGy(energyMeV * MEV_TO_J, massKg);
}

/**
 * ICRP 103 notron isinim agirlik faktoru w_R, enerjiye bagli.
 * ~1 MeV'de 20.7 ile tepe yapar: "ayni joule, 20 kat hasar".
 */
export function neutronWeightingFactor(energyMeV: number): number {
  if (energyMeV <= 0) return 2.5;
  if (energyMeV < 1) {
    const l = Math.log(energyMeV);
    return 2.5 + 18.2 * Math.exp((-l * l) / 6);
  }
  if (energyMeV <= 50) {
    const l = Math.log(2 * energyMeV);
    return 5.0 + 17.0 * Math.exp((-l * l) / 6);
  }
  const l = Math.log(0.04 * energyMeV);
  return 2.5 + 3.25 * Math.exp((-l * l) / 6);
}

/** Tur ve enerjiye gore w_R (ICRP 103). */
export function radiationWeightingFactor(species: ParticleSpecies, energyMeV = 1): number {
  switch (species) {
    case 'photon':
    case 'electron':
    case 'positron':
      return 1;
    case 'proton':
    case 'deuteron':
      return 2;
    case 'alpha':
    case 'ion':
      return 20;
    case 'neutron':
      return neutronWeightingFactor(energyMeV);
  }
}

/** Esdeger doz, Sv. */
export function equivalentDoseSv(
  absorbedGy: number,
  species: ParticleSpecies,
  energyMeV = 1,
): number {
  return absorbedGy * radiationWeightingFactor(species, energyMeV);
}

/** ICRP 103 doku agirlik faktorleri w_T. Toplam 1.00. */
export const TISSUE_WEIGHTS = {
  redBoneMarrow: 0.12,
  colon: 0.12,
  lung: 0.12,
  stomach: 0.12,
  breast: 0.12,
  gonads: 0.08,
  bladder: 0.04,
  oesophagus: 0.04,
  liver: 0.04,
  thyroid: 0.04,
  boneSurface: 0.01,
  brain: 0.01,
  salivaryGlands: 0.01,
  skin: 0.01,
  remainder: 0.12,
} as const;

export type TissueId = keyof typeof TISSUE_WEIGHTS;

/** Etkin doz, Sv. Doku basina esdeger dozlarin w_T ile agirlikli toplami. */
export function effectiveDoseSv(equivalentByTissue: Partial<Record<TissueId, number>>): number {
  let sum = 0;
  for (const [tissue, h] of Object.entries(equivalentByTissue)) {
    sum += (TISSUE_WEIGHTS[tissue as TissueId] ?? 0) * (h ?? 0);
  }
  return sum;
}

/** Tum vucut esit isinlanma: etkin doz esdeger doza esittir. */
export function wholeBodyEffectiveDoseSv(equivalentSv: number): number {
  return equivalentSv;
}

/**
 * Nokta kaynaktan doz hizi, Sv/s. Ters kare yasasi.
 * Sacilma ve birikme YOK — ciplak kaynak yaklasimi.
 */
export function pointSourceDoseRateSvPerS(
  gammaConstantSvM2PerBqS: number,
  activityBq: number,
  distanceM: number,
): number {
  if (distanceM <= 0) return Infinity;
  return (gammaConstantSvM2PerBqS * activityBq) / (distanceM * distanceM);
}

/** Ters kare olcegi: d1'deki dozdan d2'deki doza. */
export function inverseSquare(doseAtD1: number, d1M: number, d2M: number): number {
  if (d2M <= 0) return Infinity;
  return doseAtD1 * ((d1M * d1M) / (d2M * d2M));
}

/** Tipik LET degerleri, keV/um. RBE egrisinin girdisi. */
export const TYPICAL_LET_KEV_PER_UM: Record<string, number> = {
  'x-ray-250kvp': 2.0,
  'cobalt-60-gamma': 0.3,
  'electron-1MeV': 0.25,
  'proton-1MeV': 25,
  'proton-10MeV': 4.7,
  'alpha-5MeV': 90,
  'neutron-fast': 35,
  'carbon-ion': 150,
};

/**
 * Referans doz esikleri. Arayuzde kullanicinin hesapladigi dozu
 * konumlandirmak icin; hicbiri tibbi tavsiye degildir.
 */
export const DOSE_BENCHMARKS_GY = {
  /** Dogal fon, yillik. */
  naturalBackgroundAnnual: 0.0024,
  /** Kan sayiminda olculebilir degisim. */
  bloodCountChange: 0.5,
  /** Lens opasitesi esigi. */
  lensOpacity: 0.5,
  /** Bulanti/kusma. */
  nausea: 1.0,
  /** Cilt eritemi. */
  skinErythema: 2.0,
  /** Gecici sac dokulmesi. */
  temporaryEpilation: 3.0,
  /** Tedavisiz LD50/60. */
  ld50_60: 4.5,
  /** Gastrointestinal sendrom. */
  giSyndrome: 6.0,
  /** Merkezi sinir sistemi sendromu. */
  cnsSyndrome: 10.0,
  /** Cilt nekrozu. */
  skinNecrosis: 20.0,
} as const;

/** ICRP 103 nominal stokastik risk katsayisi, 1/Sv (tum nufus). */
export const STOCHASTIC_RISK_PER_SV = 0.055;

/** Verilen etkin doz icin nominal olumcul kanser riski (dogrusal, esiksiz). */
export function nominalRisk(effectiveSv: number): number {
  return Math.min(1, effectiveSv * STOCHASTIC_RISK_PER_SV);
}
