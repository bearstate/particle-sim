/**
 * Notron yavaslatma ve tasinim. PHYSICS.md bolum 1.I.
 *
 * Bu modul, simulasyonun Bolum 3'unu ezberden gercek anlayisa ceviren yerdir:
 * hizli fotonotronu dogrudan toryuma carptirirsan yakalama tesir kesiti
 * minik (0.15 barn); araya su/parafin moderator koyarsan 1/v yasasi sayesinde
 * sigma 7.34 barn'a cikar ve U-233 uretimi patlar.
 */

import { BARN_TO_M2, THERMAL_NEUTRON_EV } from '../constants.ts';

/** Elastik carpismada minimum enerji orani `alpha = ((A-1)/(A+1))^2`. */
export function alphaCollision(A: number): number {
  if (A <= 0) return 0;
  const r = (A - 1) / (A + 1);
  return r * r;
}

/** Tek carpismada azami bagil enerji kaybi `4A/(1+A)^2`. H icin 1 (tumu). */
export function maxEnergyLossFraction(A: number): number {
  if (A <= 0) return 0;
  return (4 * A) / ((1 + A) * (1 + A));
}

/**
 * Ortalama logaritmik enerji azalimi ksi.
 * `ksi = 1 + alpha*ln(alpha)/(1 - alpha)`; A=1 icin tam olarak 1.
 */
export function xi(A: number): number {
  if (A <= 0) return 0;
  if (A === 1) return 1;
  const a = alphaCollision(A);
  if (a >= 1) return 0;
  return 1 + (a * Math.log(a)) / (1 - a);
}

/**
 * E0'dan Ef'e yavaslamak icin gereken ortalama carpisma sayisi.
 * 2 MeV -> 0.0253 eV: H ~18, C ~115, U ~2172.
 */
export function collisionsToSlowDown(A: number, e0Ev: number, efEv = THERMAL_NEUTRON_EV): number {
  const x = xi(A);
  if (x <= 0 || e0Ev <= efEv) return 0;
  return Math.log(e0Ev / efEv) / x;
}

/**
 * Yavaslatma orani `ksi*Sigma_s/Sigma_a`. Iyi bir moderator hem cok
 * yavaslatmali hem az yutmali; suyun (~71) agir suya (~5700) gore neden
 * daha kotu oldugu buradan gorunur.
 */
export function moderatingRatio(A: number, scatterBarn: number, absorbBarn: number): number {
  if (absorbBarn <= 0) return Infinity;
  return (xi(A) * scatterBarn) / absorbBarn;
}

/**
 * 1/v yasasi: termal bolgede yakalama tesir kesiti hiza ters orantilidir.
 * `sigma(E) = sigma_0 * sqrt(E_0/E)`, E_0 = 0.0253 eV.
 *
 * Moderasyonun etkisini tek satirda gosteren formul: 1 MeV notron icin
 * sqrt(0.0253/1e6) = 1.6e-4 carpani; termalize edince 1'e cikar.
 */
export function oneOverVCrossSectionBarn(thermalBarn: number, energyEv: number): number {
  if (energyEv <= 0) return Infinity;
  return thermalBarn * Math.sqrt(THERMAL_NEUTRON_EV / energyEv);
}

/** Makroskopik tesir kesiti Sigma = n*sigma, 1/m. */
export function macroscopicPerM(atomDensityPerM3: number, crossSectionBarn: number): number {
  return atomDensityPerM3 * crossSectionBarn * BARN_TO_M2;
}

/** Carpismasiz (uncollided) gecirgenlik `exp(-Sigma*x)`. */
export function uncollidedTransmission(macroscopicPerMValue: number, thicknessM: number): number {
  return Math.exp(-macroscopicPerMValue * thicknessM);
}

/** Ortalama serbest yol 1/Sigma, m. */
export function neutronMeanFreePathM(macroscopicPerMValue: number): number {
  if (macroscopicPerMValue <= 0) return Infinity;
  return 1 / macroscopicPerMValue;
}

/** Difuzyon katsayisi D = 1/(3*Sigma_tr), m. */
export function diffusionCoefficientM(transportMacroscopicPerM: number): number {
  if (transportMacroscopicPerM <= 0) return Infinity;
  return 1 / (3 * transportMacroscopicPerM);
}

/** Difuzyon boyu L = sqrt(D/Sigma_a), m. */
export function diffusionLengthM(diffusionM: number, absorptionPerM: number): number {
  if (absorptionPerM <= 0) return Infinity;
  return Math.sqrt(diffusionM / absorptionPerM);
}

/**
 * N carpisma sonrasi ortalama enerji, eV. `E_n = E_0 * exp(-n*ksi)`.
 * Log-ortalama oldugu icin tek tek carpismalari izlemeye gerek yok.
 */
export function energyAfterCollisionsEv(e0Ev: number, A: number, collisions: number): number {
  return e0Ev * Math.exp(-collisions * xi(A));
}

/** Yaygin moderatorler: (A, elastik sacilma barn, sogurma barn). */
export const MODERATORS = {
  h1: { A: 1, scatterBarn: 20.5, absorbBarn: 0.332, label: 'H' },
  d2: { A: 2, scatterBarn: 3.4, absorbBarn: 0.00052, label: 'D' },
  be9: { A: 9, scatterBarn: 6.15, absorbBarn: 0.0092, label: 'Be' },
  c12: { A: 12, scatterBarn: 4.75, absorbBarn: 0.0035, label: 'C' },
  water: { A: 18, scatterBarn: 44.8, absorbBarn: 0.664, label: 'H2O' },
  heavyWater: { A: 20, scatterBarn: 10.6, absorbBarn: 0.0013, label: 'D2O' },
  paraffin: { A: 14, scatterBarn: 58, absorbBarn: 0.8, label: 'CH2' },
} as const;

export type ModeratorId = keyof typeof MODERATORS;
