/**
 * Fotonukleer tepki: dev dipol rezonansi ve (gamma,n) notron uretimi.
 * PHYSICS.md bolum 1.F.
 *
 * Kullanicinin istedigi "tungstende 6 MeV'de notron firlamasi" bu modulde
 * yasar. Mekanizma zinciri:
 *     elektron -> bremsstrahlung fotonu -> dev dipol rezonansi -> (gamma,n)
 *
 * Esik SERT bir kesimdir: S_n'in 1 keV altinda hicbir notron yoktur. Bu,
 * simulasyonun en net "esik" deneyimidir ve asla yumusatilmamalidir.
 */

import { neutronSeparationEnergyMeV } from '../nuclear/semf.ts';

/**
 * Olculmus notron ayrilma enerjileri S_n, MeV. Anahtar: Z*1000 + A.
 * Kaynak: AME2020.
 */
const MEASURED_SN: Record<number, number> = {
  1002: 2.2246, // H-2  (agir su fotonotron kaynagi)
  3007: 7.2501, // Li-7
  4009: 1.6645, // Be-9 <- en dusuk pratik esik
  6012: 18.7216, // C-12
  6013: 4.9463, // C-13
  8016: 15.6638, // O-16
  13027: 13.0577, // Al-27
  22048: 11.6266, // Ti-48
  26056: 11.1972, // Fe-56
  28058: 12.2166, // Ni-58
  29063: 10.8642, // Cu-63
  29065: 9.9108, // Cu-65
  42098: 8.6427, // Mo-98
  47107: 9.5349, // Ag-107
  48113: 6.5402, // Cd-113
  73181: 7.5769, // Ta-181
  74182: 8.0671, // W-182
  74183: 6.1910, // W-183 <- dogal W'nin etkin esigi
  74184: 7.4118, // W-184
  74186: 7.1930, // W-186
  79197: 8.0715, // Au-197
  82206: 8.0870, // Pb-206
  82207: 6.7381, // Pb-207
  82208: 7.3679, // Pb-208
  90232: 6.4383, // Th-232
  92235: 5.2979, // U-235
  92238: 6.1541, // U-238
};

/**
 * Dogal elementin ETKIN fotonotron esigi, MeV: bol bulunan izotoplar arasinda
 * en dusuk S_n. Dogal tungstende bu W-183'tur (%14.3 bolluk) ve 6.19 MeV'dir.
 */
const NATURAL_THRESHOLD: Record<number, number> = {
  4: 1.6645, // Be
  6: 18.7216, // C
  13: 13.0577, // Al
  26: 11.1972, // Fe
  29: 9.9108, // Cu
  42: 8.2900, // Mo
  47: 9.1900, // Ag
  48: 6.5402, // Cd
  73: 7.5769, // Ta
  74: 6.1910, // W
  79: 8.0715, // Au
  82: 6.7381, // Pb
  90: 6.4383, // Th
  92: 6.1541, // U
};

/** Belirli bir nuklidin (gamma,n) esigi, MeV. Tabloda yoksa SEMF kestirimi. */
export function thresholdMeV(Z: number, A: number): number {
  const measured = MEASURED_SN[Z * 1000 + A];
  if (measured !== undefined) return measured;
  return Math.max(0, neutronSeparationEnergyMeV(Z, A));
}

/**
 * Dogal elementin etkin (gamma,n) esigi, MeV. Hedef izotop ayrimi yapilmadigi
 * durumda kullanilir — UI'da element secildiginde bu gecerlidir.
 */
export function naturalThresholdMeV(Z: number, massNumber: number): number {
  const t = NATURAL_THRESHOLD[Z];
  if (t !== undefined) return t;
  return thresholdMeV(Z, Math.round(massNumber));
}

/**
 * Dev dipol rezonansi tepe enerjisi, MeV (Berman-Fultz sistematigi).
 * `E_GDR = 31.2*A^(-1/3) + 20.6*A^(-1/6)`
 * W (A=184) -> 14.1 MeV, Al (A=27) -> 22.3 MeV.
 */
export function gdrPeakEnergyMeV(A: number): number {
  if (A <= 0) return 0;
  return 31.2 * Math.pow(A, -1 / 3) + 20.6 * Math.pow(A, -1 / 6);
}

/**
 * GDR genisligi Gamma, MeV. Agir cekirdeklerde ~4-5, hafiflerde ~8-10.
 * Deforme cekirdeklerde rezonans ikiye yarilir; burada tek Lorentz kullanilir.
 */
export function gdrWidthMeV(A: number): number {
  return 4.5 + 6.0 * Math.exp(-A / 40);
}

/**
 * Thomas-Reiche-Kuhn toplam kurali: `integral(sigma_abs dE) = 60*N*Z/A` MeV*mb.
 * @param enhancement agir cekirdeklerde kural 1.2-1.5 kat asilir.
 */
export function trkSumRuleMeVmb(Z: number, A: number, enhancement = 1.3): number {
  const N = A - Z;
  if (A <= 0 || N < 0) return 0;
  return (60 * N * Z * enhancement) / A;
}

/** Lorentz profilinin tepe tesir kesiti, mb. TRK integralinden turetilir. */
export function gdrPeakCrossSectionMb(Z: number, A: number): number {
  const gamma = gdrWidthMeV(A);
  if (gamma <= 0) return 0;
  // Lorentz icin integral ~ (pi/2)*sigma_m*Gamma
  return (2 * trkSumRuleMeVmb(Z, A)) / (Math.PI * gamma);
}

/**
 * (gamma,abs) tesir kesiti, mb. Standart Lorentz profili:
 *   `sigma(E) = sigma_m / (1 + ((E^2 - E_m^2)/(E*Gamma))^2)`
 * Esigin altinda tam sifir.
 */
export function photoabsorptionMb(Z: number, A: number, photonEnergyMeV: number): number {
  const th = thresholdMeV(Z, A);
  if (photonEnergyMeV <= th) return 0;
  const em = gdrPeakEnergyMeV(A);
  const gamma = gdrWidthMeV(A);
  const sm = gdrPeakCrossSectionMb(Z, A);
  const e = photonEnergyMeV;
  const x = (e * e - em * em) / (e * gamma);
  return sm / (1 + x * x);
}

/**
 * Ince hedefte notron verimi: `Y = N_foton * n_hedef * sigma * x`.
 * @param photonsPerS gelen foton akisi
 * @param atomDensityPerM3 hedef atom yogunlugu
 * @param thicknessM hedef kalinligi
 */
export function thinTargetYieldPerS(
  photonsPerS: number,
  atomDensityPerM3: number,
  crossSectionMb: number,
  thicknessM: number,
): number {
  const sigmaM2 = crossSectionMb * 1e-31; // 1 mb = 1e-31 m^2
  return photonsPerS * atomDensityPerM3 * sigmaM2 * thicknessM;
}

/**
 * Kalin hedef doyum verimleri, notron/(s*kW) elektron demeti gucu basina.
 * Swanson'un ampirik kurali (NCRP/IAEA hizlandirici kalkanlama literaturu).
 */
const THICK_TARGET_SATURATION: Record<number, number> = {
  74: 1.2e12, // W
  82: 0.9e12, // Pb
  73: 0.5e12, // Ta
  92: 1.6e12, // U (fotofisyon katkisiyla)
  90: 1.1e12, // Th
  4: 0.05e12, // Be (dusuk Z: bremsstrahlung verimi dusuk)
};

/**
 * Kalin yuksek-Z hedefte elektron demetinden notron verimi, notron/s.
 *
 * Esik altinda TAM SIFIR; ustunde doyuma giden ustel:
 *   `Y = Y_doyum * P[kW] * (1 - exp(-(E - E_esik)/k))`
 *
 * W icin 15 MeV'de doyumun ~%83'une ulasilir — literaturdeki "15-20 MeV
 * uzerinde verim doyar" gozlemiyle uyumlu.
 *
 * @param electronEnergyMeV demet kinetik enerjisi
 * @param beamPowerW demet gucu
 */
export function thickTargetNeutronYieldPerS(
  Z: number,
  massNumber: number,
  electronEnergyMeV: number,
  beamPowerW: number,
): number {
  const th = naturalThresholdMeV(Z, massNumber);
  if (electronEnergyMeV <= th || beamPowerW <= 0) return 0;
  const saturation = THICK_TARGET_SATURATION[Z] ?? 0.3e12 * (Z / 74);
  const k = 5.0; // MeV, doyum olcegi
  const shape = 1 - Math.exp(-(electronEnergyMeV - th) / k);
  return saturation * (beamPowerW / 1000) * shape;
}

/**
 * Fotofisyon esigi, MeV. U ve Th icin ~5.5 MeV; bu esik (gamma,n) esiginden
 * DUSUK oldugu icin uranyumda once fisyon, sonra fotonotron baslar.
 */
export function photofissionThresholdMeV(Z: number): number | null {
  if (Z === 92) return 5.5;
  if (Z === 90) return 5.9;
  if (Z === 94) return 5.3;
  return null;
}

/** Ortalama fotonotron enerjisi, MeV. Buharlasma spektrumu, kT ~ 0.5-1 MeV. */
export function meanPhotoneutronEnergyMeV(A: number): number {
  // Agir cekirdekler daha sogut notron yayar.
  return 2.0 * Math.pow(A, -0.15);
}
