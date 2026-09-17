/**
 * Carpismasal durdurma gucu: Bethe-Bloch (agir yuklu) ve Berger-Seltzer
 * (elektron). PHYSICS.md bolum 1.D.
 *
 * Cikti birimi her yerde MeV*cm^2/g (KUTLE durdurma gucu). Dogrusal durdurma
 * gucu icin yogunlukla carpin: `dE/dx [MeV/cm] = S * rho [g/cm^3]`.
 *
 * Yogunluk etkisi duzeltmesi delta icin tam Sternheimer parametrizasyonu
 * malzeme basina 6 katsayi ister; burada yuksek enerji asimptotu kullanilir
 * ve asagida 0'a kirpilir. Bu, beta*gamma ~ 2-6 araliginda durdurma gucunu
 * %1-2 fazla tahmin eder. Veri hatti ESTAR/PSTAR tablolarini getirdiginde bu
 * fonksiyonlar tablo aramasina devreder ve analitik hal yedek kalir.
 */

import { BETHE_K, ELECTRON_MASS_MEV } from '../constants.ts';
import { beta as betaOf, gamma as gammaOf } from '../kinematics.ts';

/**
 * Ortalama uyarilma enerjisi I, eV. `I ~ 16*Z^0.9` (Z > 1).
 * Gercek tablo degerleri %10'a kadar sapar; veri hatti bunlari gecersiz kilar.
 */
export function meanExcitationEnergyEv(Z: number): number {
  if (Z <= 0) return 0;
  if (Z === 1) return 19.2;
  if (Z === 2) return 41.8;
  return 16 * Math.pow(Z, 0.9);
}

/** Plazma enerjisi hbar*omega_p, eV. `28.816*sqrt(rho*Z/A)`. */
export function plasmaEnergyEv(densityGPerCm3: number, Z: number, A: number): number {
  if (A <= 0) return 0;
  return 28.816 * Math.sqrt((densityGPerCm3 * Z) / A);
}

/**
 * Yogunluk etkisi duzeltmesi delta (yuksek enerji asimptotu, 0'a kirpilmis).
 * `delta -> 2*ln(hbar*omega_p/I) + 2*ln(beta*gamma) - 1`
 */
export function densityEffect(
  betaGamma: number,
  densityGPerCm3: number,
  Z: number,
  A: number,
  iEv: number,
): number {
  if (betaGamma <= 0 || iEv <= 0) return 0;
  const hwp = plasmaEnergyEv(densityGPerCm3, Z, A);
  if (hwp <= 0) return 0;
  return Math.max(0, 2 * Math.log(hwp / iEv) + 2 * Math.log(betaGamma) - 1);
}

export interface Medium {
  /** Etkin atom numarasi. Bilesikler icin agirlikli ortalama. */
  readonly Z: number;
  /** Etkin kutle numarasi, g/mol. */
  readonly A: number;
  readonly densityGPerCm3: number;
  /** Ortalama uyarilma enerjisi, eV. Verilmezse `meanExcitationEnergyEv`. */
  readonly meanExcitationEv?: number;
}

function iOf(m: Medium): number {
  return m.meanExcitationEv ?? meanExcitationEnergyEv(m.Z);
}

/**
 * Agir yuklu parcacik icin Bethe-Bloch kutle durdurma gucu, MeV*cm^2/g.
 * Elektron/pozitron icin KULLANMAYIN — onlar icin `electronCollisionStopping`.
 *
 * @param kineticMeV kinetik enerji
 * @param restMeV mermi durgun enerjisi (proton 938.27, alfa 3727.38)
 * @param z mermi yuk sayisi
 */
export function betheBloch(
  kineticMeV: number,
  restMeV: number,
  z: number,
  medium: Medium,
): number {
  if (kineticMeV <= 0 || medium.A <= 0) return 0;
  const b = betaOf(kineticMeV, restMeV);
  const g = gammaOf(kineticMeV, restMeV);
  const b2 = b * b;
  if (b2 <= 0) return 0;

  const massRatio = ELECTRON_MASS_MEV / restMeV;
  // T_max: tek carpismada elektrona aktarilabilecek azami enerji, MeV.
  const tMax =
    (2 * ELECTRON_MASS_MEV * b2 * g * g) / (1 + 2 * g * massRatio + massRatio * massRatio);

  const iMeV = iOf(medium) * 1e-6;
  const delta = densityEffect(b * g, medium.densityGPerCm3, medium.Z, medium.A, iOf(medium));

  const bracket =
    0.5 * Math.log((2 * ELECTRON_MASS_MEV * b2 * g * g * tMax) / (iMeV * iMeV)) - b2 - delta / 2;

  const s = BETHE_K * z * z * (medium.Z / medium.A) * (1 / b2) * bracket;
  return Math.max(0, s);
}

/**
 * Elektron icin Berger-Seltzer carpismasal kutle durdurma gucu, MeV*cm^2/g.
 * Ozdes parcacik saciliminin (Moller) getirdigi F^-(tau) terimi dahil.
 */
export function electronCollisionStopping(kineticMeV: number, medium: Medium): number {
  if (kineticMeV <= 0 || medium.A <= 0) return 0;
  const tau = kineticMeV / ELECTRON_MASS_MEV;
  const g = 1 + tau;
  const b2 = 1 - 1 / (g * g);
  if (b2 <= 0) return 0;

  const iRel = iOf(medium) * 1e-6 / ELECTRON_MASS_MEV;
  const fMinus =
    1 - b2 + ((tau * tau) / 8 - (2 * tau + 1) * Math.LN2) / ((tau + 1) * (tau + 1));
  const delta = densityEffect(
    Math.sqrt(b2) * g,
    medium.densityGPerCm3,
    medium.Z,
    medium.A,
    iOf(medium),
  );

  const bracket =
    Math.log((tau * tau * (tau + 2)) / (2 * iRel * iRel)) + fMinus - delta;

  const s = (BETHE_K / 2) * (medium.Z / medium.A) * (1 / b2) * bracket;
  return Math.max(0, s);
}

/**
 * Isimasal/carpismasal durdurma orani. `~ Z*E[MeV]/700`.
 *
 * "Neden anot tungsten?" sorusunun tek satirlik cevabi: Z=74 ile bu oran
 * Z=13 aluminyuma gore ~6 kat buyuk.
 */
export function radiativeToCollisionRatio(Z: number, kineticMeV: number): number {
  return (Z * kineticMeV) / 700;
}

/** Elektron icin isimasal kutle durdurma gucu, MeV*cm^2/g (yaklasik). */
export function electronRadiativeStopping(kineticMeV: number, medium: Medium): number {
  return (
    electronCollisionStopping(kineticMeV, medium) *
    radiativeToCollisionRatio(medium.Z, kineticMeV)
  );
}

/** Toplam elektron durdurma gucu (carpismasal + isimasal), MeV*cm^2/g. */
export function electronTotalStopping(kineticMeV: number, medium: Medium): number {
  return (
    electronCollisionStopping(kineticMeV, medium) + electronRadiativeStopping(kineticMeV, medium)
  );
}

/** Hazir ortamlar. */
export const WATER: Medium = { Z: 7.42, A: 13.0, densityGPerCm3: 1.0, meanExcitationEv: 75 };
export const AIR_MEDIUM: Medium = { Z: 7.31, A: 14.7, densityGPerCm3: 1.205e-3, meanExcitationEv: 85.7 };
