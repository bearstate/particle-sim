/**
 * Siklotron. PHYSICS.md bolum 1.B.
 *
 *   f_c = q*B / (2*pi*gamma*m)
 *   r   = p / (q*B)
 *   T   = sqrt((q*B*R*c)^2 + E0^2) - E0
 *
 * Klasik siklotronun rolativistik tikanmasi BURADA MODELLENIR, elle
 * sinirlanmaz: gamma buyudukce f_c duser, sabit RF ile faz kayar, cos(phi)
 * kucululur ve kazanc kendiliginden sifira iner. Proton icin ~20-25 MeV
 * civarindaki bilinen limit bu donguden dogal olarak cikar.
 */

import { ELEMENTARY_CHARGE, MEV_TO_J, C } from '../constants.ts';
import { momentumMeV, gamma as gammaOf, momentumFromRigidityMeV, kineticFromMomentumMeV } from '../kinematics.ts';

export type CyclotronMode = 'classic' | 'isochronous' | 'synchrocyclotron';

export interface CyclotronParams {
  /** Dipol manyetik alan, T. */
  readonly fieldT: number;
  /** D (dee) yaricapi, m. Parcacik bunu asinca cikarilir. */
  readonly deeRadiusM: number;
  /** Bosluk tepe gerilimi, V. Tur basina 2 bosluktan gecilir. */
  readonly deeVoltageV: number;
  readonly mode: CyclotronMode;
  /** RF harmonik sayisi h. */
  readonly harmonic: number;
  /**
   * Enjeksiyon fazi, rad. Fiziksel optimum -pi/2'dir: parcacik faz
   * penceresinin bir ucundan girer ve tum pi'lik araligi kullanir. Faz 0'dan
   * baslamak kullanilabilir butcenin yarisini harcar ve klasik limiti
   * yapay olarak dusurur.
   */
  readonly injectionPhaseRad: number;
}

/** Durgun enerjiden (MeV) durgun kutle (kg). */
function restMassKg(restEnergyMeV: number): number {
  return (restEnergyMeV * MEV_TO_J) / (C * C);
}

/** Siklotron frekansi, Hz. `f = q*B/(2*pi*gamma*m)`. */
export function cyclotronFrequencyHz(
  fieldT: number,
  restEnergyMeV: number,
  z: number,
  kineticMeV = 0,
): number {
  const g = gammaOf(kineticMeV, restEnergyMeV);
  const m = restMassKg(restEnergyMeV);
  return (Math.abs(z) * ELEMENTARY_CHARGE * fieldT) / (2 * Math.PI * g * m);
}

/** Yorunge yaricapi, m. */
export function orbitRadiusM(kineticMeV: number, restEnergyMeV: number, fieldT: number, z: number): number {
  if (fieldT === 0 || z === 0) return Infinity;
  const pc = momentumMeV(kineticMeV, restEnergyMeV);
  return pc / (299.792458 * Math.abs(z) * fieldT);
}

/**
 * D yaricapinin dayattigi azami kinetik enerji, MeV (rolativistik).
 * Faz kaymasi dikkate ALINMAZ — bu, ust sinirdir.
 */
export function extractionEnergyMeV(
  p: CyclotronParams,
  restEnergyMeV: number,
  z: number,
): number {
  const pc = momentumFromRigidityMeV(p.fieldT, p.deeRadiusM, z);
  return kineticFromMomentumMeV(pc, restEnergyMeV);
}

export interface CyclotronSolution {
  /** Tur basina kinetik enerji, MeV. */
  readonly energiesMeV: Float64Array;
  /** Tur basina yorunge yaricapi, m. Spiral cizimi bunu tuketir. */
  readonly radiiM: Float64Array;
  readonly finalEnergyMeV: number;
  readonly turns: number;
  /** Cikarma yaricapina ulasildi mi, yoksa faz kaymasi mi durdurdu. */
  readonly stoppedBy: 'radius' | 'phaseSlip' | 'turnLimit';
  /** Birikmis faz kaymasi, rad. */
  readonly phaseSlipRad: number;
}

/**
 * Tur tur cozer. RF frekansi enjeksiyon anindaki f_c'ye kilitlenir (klasik).
 * `isochronous` modda B(r) = B0*gamma(r) ile faz kaymasi yok edilir;
 * `synchrocyclotron` modda RF frekansi izlendigi icin yine faz kaymasi yok
 * ama demet surekli yerine darbelidir.
 */
export function solve(
  p: CyclotronParams,
  restEnergyMeV: number,
  z: number,
  maxTurns = 20000,
): CyclotronSolution {
  const energies: number[] = [];
  const radii: number[] = [];
  const tracksPhase = p.mode === 'classic';

  let t = 0;
  let phase = tracksPhase ? p.injectionPhaseRad : 0;
  let stoppedBy: CyclotronSolution['stoppedBy'] = 'turnLimit';
  // Tur basina iki bosluk gecisi.
  const gainPerGapMeV = (Math.abs(z) * p.deeVoltageV) / 1e6;

  let turns = 0;
  for (; turns < maxTurns; turns++) {
    const cosPhi = tracksPhase ? Math.cos(phase) : 1;
    if (tracksPhase && phase > Math.PI / 2) {
      stoppedBy = 'phaseSlip';
      break;
    }
    t += 2 * gainPerGapMeV * cosPhi;

    const r = orbitRadiusM(t, restEnergyMeV, p.fieldT, z);
    energies.push(t);
    radii.push(r);
    if (r >= p.deeRadiusM) {
      stoppedBy = 'radius';
      turns++;
      break;
    }
    if (tracksPhase) {
      // Sabit RF'e gore tur basina faz kaymasi: 2*pi*h*(gamma - 1).
      phase += 2 * Math.PI * p.harmonic * (gammaOf(t, restEnergyMeV) - 1);
    }
  }

  return {
    energiesMeV: Float64Array.from(energies),
    radiiM: Float64Array.from(radii),
    finalEnergyMeV: t,
    turns,
    stoppedBy,
    phaseSlipRad: phase,
  };
}

/** Izokron duzeltme icin gereken alan profili B(r) = B0*gamma(r), T. */
export function isochronousFieldT(
  baseFieldT: number,
  kineticMeV: number,
  restEnergyMeV: number,
): number {
  return baseFieldT * gammaOf(kineticMeV, restEnergyMeV);
}

export const DEFAULT_CYCLOTRON: CyclotronParams = {
  fieldT: 1.5,
  deeRadiusM: 0.5,
  deeVoltageV: 50e3,
  mode: 'classic',
  harmonic: 1,
  injectionPhaseRad: -Math.PI / 2,
};
