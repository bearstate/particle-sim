/**
 * Menzil, isima boyu, kritik enerji ve coklu sacilma. PHYSICS.md bolum 1.D.
 *
 * ONEMLI AYRIM: Katz-Penfold ampirik formulu CSDA MENZILI DEGIL, PRATIK
 * (ekstrapole) MENZILI verir. Elektronlar zikzak ilerledigi icin kat edilen
 * yol ile kat edilen DERINLIK farklidir; orani "dolambac carpani"dir
 * (1 MeV'de ~0.73). Literaturde bu ikisi sik sik karistirilir.
 *
 *   CSDA menzili  R_CSDA = integral(0..T) dE / S(E)      <- yol uzunlugu
 *   Pratik menzil R_p    = 0.412 * E^(1.265 - 0.0954 lnE) <- derinlik, g/cm^2
 */

import { ELECTRON_MASS_MEV } from '../constants.ts';
import { momentumMeV, beta as betaOf } from '../kinematics.ts';
import { electronTotalStopping, betheBloch, type Medium } from './stopping.ts';

/**
 * CSDA menzili, g/cm^2. `S` fonksiyonunun tersini log izgarada Simpson ile
 * integre eder. 1 keV altindaki katki ihmal edilir (menzile katkisi <%0.1).
 */
function integrateRange(
  stopping: (eMeV: number) => number,
  kineticMeV: number,
  eMinMeV = 1e-3,
  steps = 256,
): number {
  if (kineticMeV <= eMinMeV) return 0;
  const lnLo = Math.log(eMinMeV);
  const lnHi = Math.log(kineticMeV);
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (lnHi - lnLo) / n;

  // Degisken donusumu: dE = E*d(lnE), yani integrand = E/S(E).
  const f = (lnE: number) => {
    const e = Math.exp(lnE);
    const s = stopping(e);
    return s > 0 ? e / s : 0;
  };

  let sum = f(lnLo) + f(lnHi);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 1 ? 4 : 2) * f(lnLo + i * h);
  }
  return (h / 3) * sum;
}

/** Elektron CSDA menzili, g/cm^2. Kendi durdurma gucumuzden integre edilir. */
export function electronCsdaRangeGPerCm2(kineticMeV: number, medium: Medium): number {
  return integrateRange((e) => electronTotalStopping(e, medium), kineticMeV);
}

/** Agir yuklu parcacik CSDA menzili, g/cm^2. */
export function heavyCsdaRangeGPerCm2(
  kineticMeV: number,
  restMeV: number,
  z: number,
  medium: Medium,
): number {
  return integrateRange((e) => betheBloch(e, restMeV, z, medium), kineticMeV, 1e-2);
}

/**
 * Katz-Penfold PRATIK menzili, g/cm^2. 0.01 - 3 MeV araligi icin kalibre;
 * 1 - 20 MeV icin dogrusal dal kullanilir.
 */
export function practicalRangeGPerCm2(kineticMeV: number): number {
  if (kineticMeV <= 0) return 0;
  if (kineticMeV <= 2.5) {
    const n = 1.265 - 0.0954 * Math.log(kineticMeV);
    return 0.412 * Math.pow(kineticMeV, n);
  }
  return 0.53 * kineticMeV - 0.106;
}

/** Menzili uzunluga cevir, cm. */
export function toLengthCm(rangeGPerCm2: number, densityGPerCm3: number): number {
  if (densityGPerCm3 <= 0) return Infinity;
  return rangeGPerCm2 / densityGPerCm3;
}

/**
 * Isima boyu X0, g/cm^2.
 * `X0 = 716.4*A / (Z(Z+1)*ln(287/sqrt(Z)))`
 * W icin 6.76, Pb 6.37, Al 24.01, su 36.08 g/cm^2.
 */
export function radiationLengthGPerCm2(Z: number, A: number): number {
  if (Z <= 0) return Infinity;
  return (716.4 * A) / (Z * (Z + 1) * Math.log(287 / Math.sqrt(Z)));
}

/**
 * Kritik enerji, MeV: isimasal kayip carpismasal kaybi gectigi enerji.
 * Kati/sivi icin `610/(Z+1.24)`, gaz icin `710/(Z+0.92)`.
 */
export function criticalEnergyMeV(Z: number, phase: 'solid' | 'gas' = 'solid'): number {
  return phase === 'gas' ? 710 / (Z + 0.92) : 610 / (Z + 1.24);
}

/** Moliere yaricapi, g/cm^2. Elektromanyetik dusun yanal genisligi. */
export function moliereRadiusGPerCm2(Z: number, A: number, phase: 'solid' | 'gas' = 'solid'): number {
  return (21.2 * radiationLengthGPerCm2(Z, A)) / criticalEnergyMeV(Z, phase);
}

/**
 * Highland coklu sacilma acisi theta_0, rad (duzlem projeksiyonu RMS).
 * `theta0 = (13.6 MeV/(beta*pc))*z*sqrt(x/X0)*[1 + 0.038*ln(x/X0)]`
 *
 * @param thicknessGPerCm2 kat edilen kalinlik
 */
export function highlandScatteringRad(
  kineticMeV: number,
  restMeV: number,
  z: number,
  thicknessGPerCm2: number,
  radiationLengthGCm2: number,
): number {
  if (thicknessGPerCm2 <= 0 || radiationLengthGCm2 <= 0) return 0;
  const pc = momentumMeV(kineticMeV, restMeV);
  const b = betaOf(kineticMeV, restMeV);
  if (pc <= 0 || b <= 0) return 0;
  const xOverX0 = thicknessGPerCm2 / radiationLengthGCm2;
  return ((13.6 / (b * pc)) * Math.abs(z) * Math.sqrt(xOverX0)) * (1 + 0.038 * Math.log(xOverX0));
}

/**
 * Cherenkov esigi: `beta > 1/n`. Su (n=1.33) icin elektron esigi 0.26 MeV.
 * Esik altinda null doner.
 */
export function cherenkovAngleRad(
  kineticMeV: number,
  restMeV: number,
  refractiveIndex: number,
): number | null {
  const b = betaOf(kineticMeV, restMeV);
  const x = 1 / (b * refractiveIndex);
  if (x >= 1) return null;
  return Math.acos(x);
}

/** Cherenkov esik kinetik enerjisi, MeV. */
export function cherenkovThresholdMeV(restMeV: number, refractiveIndex: number): number {
  if (refractiveIndex <= 1) return Infinity;
  const gammaThreshold = 1 / Math.sqrt(1 - 1 / (refractiveIndex * refractiveIndex));
  return (gammaThreshold - 1) * restMeV;
}

export { ELECTRON_MASS_MEV };
