/**
 * Rolativistik kinematik. PHYSICS.md bolum 1.0.
 *
 * Sayisal not: beta'yi `sqrt(1 - 1/gamma^2)` ile hesaplamak dusuk enerjide
 * feci sadelesmeye girer (T/E0 ~ 1e-17 oldugunda 1 - 1/gamma^2 tamamen
 * yuvarlama gurultusudur). Burada her yerde kararli yol kullanilir:
 *     pc    = sqrt(T*(T + 2*E0))
 *     beta  = pc / (T + E0)
 *     gamma = 1 + T/E0
 */

import {
  C,
  ELECTRON_MASS_MEV,
  PROTON_MASS_MEV,
  NEUTRON_MASS_MEV,
  DEUTERON_MASS_MEV,
  ALPHA_MASS_MEV,
  HBAR,
  MEV_TO_J,
  HC_EV_NM,
} from './constants.ts';
import type { ParticleSpecies } from './types.ts';

/** Durgun enerji, MeV. Foton 0 dondurur. */
export function restEnergyMeV(kind: ParticleSpecies): number {
  switch (kind) {
    case 'electron':
    case 'positron':
      return ELECTRON_MASS_MEV;
    case 'proton':
      return PROTON_MASS_MEV;
    case 'deuteron':
      return DEUTERON_MASS_MEV;
    case 'neutron':
      return NEUTRON_MASS_MEV;
    case 'alpha':
      return ALPHA_MASS_MEV;
    case 'photon':
      return 0;
    case 'ion':
      // Iyonun kutlesi A'ya bagli; cagiran taraf acikca vermelidir.
      return NaN;
  }
}

/** Yuk sayisi z. Iyon icin cagiran taraf belirler. */
export function chargeNumber(kind: ParticleSpecies): number {
  switch (kind) {
    case 'electron':
      return -1;
    case 'positron':
    case 'proton':
    case 'deuteron':
      return 1;
    case 'alpha':
      return 2;
    case 'neutron':
    case 'photon':
      return 0;
    case 'ion':
      return NaN;
  }
}

/** Momentum * c, MeV. `pc = sqrt(T*(T + 2*E0))`. Foton icin pc = T. */
export function momentumMeV(kineticMeV: number, restMeV: number): number {
  if (restMeV === 0) return kineticMeV;
  return Math.sqrt(kineticMeV * (kineticMeV + 2 * restMeV));
}

/** Lorentz carpani. Foton icin Infinity. */
export function gamma(kineticMeV: number, restMeV: number): number {
  if (restMeV === 0) return Infinity;
  return 1 + kineticMeV / restMeV;
}

/** beta = v/c. `pc / E_toplam` — her enerjide kararli. Foton icin 1. */
export function beta(kineticMeV: number, restMeV: number): number {
  if (restMeV === 0) return 1;
  return momentumMeV(kineticMeV, restMeV) / (kineticMeV + restMeV);
}

/** Hiz, m/s. */
export function speedMs(kineticMeV: number, restMeV: number): number {
  return beta(kineticMeV, restMeV) * C;
}

/** Toplam enerji E = T + E0, MeV. */
export function totalEnergyMeV(kineticMeV: number, restMeV: number): number {
  return kineticMeV + restMeV;
}

/** pc'den kinetik enerjiye ters donusum, MeV. */
export function kineticFromMomentumMeV(pcMeV: number, restMeV: number): number {
  if (restMeV === 0) return pcMeV;
  return Math.hypot(pcMeV, restMeV) - restMeV;
}

/** gamma'dan kinetik enerjiye, MeV. */
export function kineticFromGammaMeV(g: number, restMeV: number): number {
  return (g - 1) * restMeV;
}

/**
 * Manyetik sertlik B*rho, T*m. `Brho = pc[MeV] / (299.792458 * z)`.
 * Yuksuz parcacik icin Infinity (manyetik alanla saptirilamaz).
 */
export function rigidityTm(pcMeV: number, z: number): number {
  if (z === 0) return Infinity;
  return pcMeV / (299.792458 * Math.abs(z));
}

/** B*rho'dan momentuma, MeV. Siklotron/sinkrotron yaricap hesabinin tersi. */
export function momentumFromRigidityMeV(bTesla: number, rhoM: number, z: number): number {
  return 299.792458 * bTesla * rhoM * Math.abs(z);
}

/** Verilen B ve momentumda yorunge yaricapi, m. */
export function gyroradiusM(pcMeV: number, bTesla: number, z: number): number {
  if (z === 0 || bTesla === 0) return Infinity;
  return pcMeV / (299.792458 * Math.abs(z) * bTesla);
}

/** de Broglie dalga boyu, m. */
export function deBroglieWavelengthM(pcMeV: number): number {
  if (pcMeV <= 0) return Infinity;
  // lambda = h/p = 2*pi*hbar*c / (pc)
  return (2 * Math.PI * HBAR * C) / (pcMeV * MEV_TO_J);
}

/** Foton enerjisi (eV) -> dalga boyu (nm). */
export function photonWavelengthNm(energyEv: number): number {
  return HC_EV_NM / energyEv;
}

/** Foton dalga boyu (nm) -> enerji (eV). */
export function photonEnergyEv(wavelengthNm: number): number {
  return HC_EV_NM / wavelengthNm;
}
