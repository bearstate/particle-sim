/**
 * Dogrusal hizlandirici (Wideroe / Alvarez). PHYSICS.md bolum 1.B.
 *
 *   L_n (Wideroe) = beta_n * lambda / 2
 *   L_n (Alvarez) = beta_n * lambda
 *   T (gecis suresi faktoru) = sin(x)/x,  x = pi*g/(beta*lambda)
 *   dW = q * V0 * T * cos(phi_s)
 *
 * Suruklenme tuplerinin gittikce uzamasi bu modulun gorsel imzasidir: tup
 * boylari `driftTubeLengths` ciktisindan birebir cizilir.
 */

import { C } from '../constants.ts';
import { beta as betaOf } from '../kinematics.ts';

export type LinacMode = 'wideroe' | 'alvarez';

export interface LinacParams {
  readonly mode: LinacMode;
  /** RF frekansi, Hz. */
  readonly frequencyHz: number;
  /** Bosluk (gap) tepe gerilimi V0, V. */
  readonly gapVoltageV: number;
  /** Hizlanma boslugunun eksenel uzunlugu g, m. */
  readonly gapLengthM: number;
  /** Senkron faz, rad. Boylamsal odaklama icin tipik -30 deg. */
  readonly synchronousPhaseRad: number;
  readonly gapCount: number;
}

/** RF dalga boyu, m. */
export function rfWavelengthM(frequencyHz: number): number {
  return C / frequencyHz;
}

/**
 * Gecis suresi faktoru T = sin(x)/x, x = pi*g/(beta*lambda).
 * Parcacik bosluktan gecerken alan degistigi icin kazanc bu carpanla azalir.
 */
export function transitTimeFactor(gapLengthM: number, betaVal: number, wavelengthM: number): number {
  if (betaVal <= 0 || wavelengthM <= 0) return 0;
  const x = (Math.PI * gapLengthM) / (betaVal * wavelengthM);
  if (x === 0) return 1;
  return Math.sin(x) / x;
}

/** Tek bosluktaki enerji kazanci, MeV. */
export function energyGainPerGapMeV(
  p: LinacParams,
  z: number,
  betaVal: number,
): number {
  const lambda = rfWavelengthM(p.frequencyHz);
  const t = transitTimeFactor(p.gapLengthM, betaVal, lambda);
  // q*V0 volt cinsinden eV verir; MeV'e cevir.
  return (Math.abs(z) * p.gapVoltageV * t * Math.cos(p.synchronousPhaseRad)) / 1e6;
}

export interface LinacProfile {
  /** Her bosluktan SONRAKI kinetik enerji, MeV. Uzunluk = gapCount. */
  readonly energiesMeV: Float64Array;
  /** Her bosluktan sonraki beta. */
  readonly betas: Float64Array;
  /** Suruklenme tupu boylari, m. Uzunluk = gapCount. */
  readonly driftTubeLengthsM: Float64Array;
  readonly finalEnergyMeV: number;
}

/**
 * Tum hatti cozer: bosluk bosluk enerji kazanci ve ona karsilik gelen tup
 * boylari. Rolativistik; yuksek enerjide tup boylarinin doyuma girmesi
 * (beta -> 1) dogal olarak cikar.
 *
 * @param injectionEnergyMeV enjeksiyon kinetik enerjisi (0 olmamali; 0 ise
 *        beta 0 olur ve ilk tup boyu 0 cikar).
 */
export function solveProfile(
  p: LinacParams,
  restEnergyMeV: number,
  z: number,
  injectionEnergyMeV: number,
): LinacProfile {
  const n = Math.max(0, Math.floor(p.gapCount));
  const energies = new Float64Array(n);
  const betas = new Float64Array(n);
  const lengths = new Float64Array(n);
  const lambda = rfWavelengthM(p.frequencyHz);
  const factor = p.mode === 'alvarez' ? 1 : 0.5;

  let t = injectionEnergyMeV;
  for (let i = 0; i < n; i++) {
    const bBefore = betaOf(t, restEnergyMeV);
    t += energyGainPerGapMeV(p, z, bBefore);
    const bAfter = betaOf(t, restEnergyMeV);
    energies[i] = t;
    betas[i] = bAfter;
    lengths[i] = bAfter * lambda * factor;
  }
  return {
    energiesMeV: energies,
    betas,
    driftTubeLengthsM: lengths,
    finalEnergyMeV: t,
  };
}

/**
 * Kilpatrick delinme siniri: `f[MHz] = 1.64 * E^2 * exp(-8.5/E)`, E MV/m.
 * Verilen frekans icin izin verilen E'yi ikili aramayla cozer.
 * Modern yapilar bu sinirin 1.5-2 katinda calisir, ama asmak ark demektir.
 */
export function kilpatrickFieldMVPerM(frequencyHz: number): number {
  const fMHz = frequencyHz / 1e6;
  const g = (e: number) => 1.64 * e * e * Math.exp(-8.5 / e);
  let lo = 0.1;
  let hi = 200;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (g(mid) < fMHz) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Hatta uygulanan ortalama gradyan, MV/m. */
export function averageGradientMVPerM(p: LinacProfile, totalLengthM: number): number {
  if (totalLengthM <= 0) return 0;
  return p.finalEnergyMeV / totalLengthM;
}

export const DEFAULT_LINAC: LinacParams = {
  mode: 'alvarez',
  frequencyHz: 200e6,
  gapVoltageV: 500e3,
  gapLengthM: 0.02,
  synchronousPhaseRad: -Math.PI / 6,
  gapCount: 30,
};
