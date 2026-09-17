/**
 * Sinkrotron: yorunge, dolanma frekansi ve sinkrotron isimasi.
 * PHYSICS.md bolum 1.B.
 *
 *   p[GeV/c] = 0.299792458 * B[T] * rho[m] * z
 *   dE_tur   = q^2 * beta^3 * gamma^4 / (3*eps0*rho)        [J]
 *
 * DIKKAT: Yaygin "elektron icin 88.46*E^4/rho keV" kisayolu SADECE elektron
 * icindir ve kutleye gore E0^-4 olcekler. Proton icin dogru katsayi
 * 7.78e-12 keV'dir (yaygin olarak yanlislikla 7.78e-3 diye yazilir). Burada
 * kisayol degil, SI formulu kullanilir; boyle bir hata yapilamaz.
 *
 * Elektronla protonun ayni halkada neden bambaska davrandigi (m^-4) bu
 * moduldeki tek satirda gorunur.
 */

import { ELEMENTARY_CHARGE, EPSILON_0, C, HBAR, MEV_TO_J, J_TO_MEV } from '../constants.ts';
import { beta as betaOf, gamma as gammaOf } from '../kinematics.ts';

/** Dolanma frekansi, Hz. `f = beta*c/(2*pi*R)`. */
export function revolutionFrequencyHz(kineticMeV: number, restEnergyMeV: number, ringRadiusM: number): number {
  if (ringRadiusM <= 0) return 0;
  return (betaOf(kineticMeV, restEnergyMeV) * C) / (2 * Math.PI * ringRadiusM);
}

/**
 * Tur basina sinkrotron isima kaybi, MeV.
 * `dE = q^2 * beta^3 * gamma^4 / (3*eps0*rho)`
 */
export function energyLossPerTurnMeV(
  kineticMeV: number,
  restEnergyMeV: number,
  bendRadiusM: number,
  z = 1,
): number {
  if (bendRadiusM <= 0 || restEnergyMeV <= 0) return 0;
  const b = betaOf(kineticMeV, restEnergyMeV);
  const g = gammaOf(kineticMeV, restEnergyMeV);
  const q = Math.abs(z) * ELEMENTARY_CHARGE;
  const joules = (q * q * b * b * b * g * g * g * g) / (3 * EPSILON_0 * bendRadiusM);
  return joules * J_TO_MEV;
}

/** Isima gucu, W. `P = (q^2*c/(6*pi*eps0)) * beta^4*gamma^4/rho^2`. */
export function radiatedPowerW(
  kineticMeV: number,
  restEnergyMeV: number,
  bendRadiusM: number,
  z = 1,
): number {
  if (bendRadiusM <= 0) return 0;
  const b = betaOf(kineticMeV, restEnergyMeV);
  const g = gammaOf(kineticMeV, restEnergyMeV);
  const q = Math.abs(z) * ELEMENTARY_CHARGE;
  return ((q * q * C) / (6 * Math.PI * EPSILON_0)) * ((b * b * b * b * g * g * g * g) / (bendRadiusM * bendRadiusM));
}

/**
 * Sinkrotron isimasinin kritik foton enerjisi, eV.
 * `E_c = 3*hbar*c*gamma^3/(2*rho)`. Isinim spektrumunun yarisi bunun altinda.
 */
export function criticalPhotonEnergyEv(
  kineticMeV: number,
  restEnergyMeV: number,
  bendRadiusM: number,
): number {
  if (bendRadiusM <= 0) return 0;
  const g = gammaOf(kineticMeV, restEnergyMeV);
  const joules = (3 * HBAR * C * g * g * g) / (2 * bendRadiusM);
  return joules / 1.602176634e-19;
}

/**
 * Isimanin kaybettirdigini karsilamak icin gereken RF gucu, W.
 * Bu, sinkrotronun neden bu kadar cok elektrik yedigini gosteren sayidir.
 */
export function rfPowerToSustainW(
  kineticMeV: number,
  restEnergyMeV: number,
  bendRadiusM: number,
  ringRadiusM: number,
  beamCurrentA: number,
  z = 1,
): number {
  const lossMeV = energyLossPerTurnMeV(kineticMeV, restEnergyMeV, bendRadiusM, z);
  const fRev = revolutionFrequencyHz(kineticMeV, restEnergyMeV, ringRadiusM);
  const particlesPerS = beamCurrentA / (Math.abs(z) * ELEMENTARY_CHARGE);
  // Tur basina kayip * tur/s * parcacik/(tur*s) -> parcacik basina kayip * debi
  void fRev;
  return lossMeV * MEV_TO_J * particlesPerS;
}

/** Verilen momentumu tutmak icin gereken dipol alani, T. */
export function requiredFieldT(pcMeV: number, bendRadiusM: number, z = 1): number {
  if (bendRadiusM <= 0 || z === 0) return Infinity;
  return pcMeV / (299.792458 * Math.abs(z) * bendRadiusM);
}
