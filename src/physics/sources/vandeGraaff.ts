/**
 * Van de Graaff jeneratoru. PHYSICS.md bolum 1.A.
 *
 *   I     = sigma * w * v          kayis yuk akimi
 *   C     = 4*pi*eps0*R            terminal kapasitansi (R=0.15 m -> 16.7 pF)
 *   dV/dt = (I - I_kacak(V)) / C
 *   V_max = E_delinme * R
 *   U     = 0.5*C*V^2
 *
 * Zaman entegrasyonu SAYISAL DEGIL. Her adimda kacak akim yerel iletkenlige
 * (G = I_kacak/V) dogrusallastirilir ve tam ustel cozum uygulanir:
 *     V <- V_f + (V - V_f)*exp(-dt*G/C)
 * Bu, dt ne olursa olsun kararlidir; tau << dt olsa bile patlamaz. Kullanici
 * zaman olcegini degistirdiginde gerilim egrisi bozulmaz.
 */

import { EPSILON_0 } from '../constants.ts';
import { gasProperties, relativeDensity, type GasId } from '../gas/gases.ts';
import { sphereCoronaOnsetVoltageV, coronaCurrentA } from '../gas/corona.ts';

export interface VanDeGraaffParams {
  /** Terminal kure yaricapi, m. */
  readonly sphereRadiusM: number;
  /** Kayis genisligi, m. */
  readonly beltWidthM: number;
  /** Kayis hizi, m/s. */
  readonly beltSpeedMs: number;
  /** Kayis yuzey yuk yogunlugu, C/m^2. */
  readonly chargeDensityCPerM2: number;
  /** Korona kacak katsayisi, A/V^2. */
  readonly coronaK: number;
  readonly gasId: GasId;
  readonly pressurePa: number;
  readonly tempK: number;
}

export interface VanDeGraaffState {
  readonly voltageV: number;
}

/** Kayisin tasidigi yuk akimi, A. */
export function beltCurrentA(params: VanDeGraaffParams): number {
  return params.chargeDensityCPerM2 * params.beltWidthM * params.beltSpeedMs;
}

/** Yalitilmis kurenin kapasitansi, F. `C = 4*pi*eps0*R`. */
export function sphereCapacitanceF(radiusM: number): number {
  return 4 * Math.PI * EPSILON_0 * radiusM;
}

/**
 * Terminal kure yuzeyinin kendi delinmesiyle sinirli azami gerilim, V.
 * Kure yuzeyinde E = V/R oldugundan V_max = E_delinme * R.
 */
export function maxTerminalVoltageV(params: VanDeGraaffParams): number {
  const g = gasProperties(params.gasId);
  const delta = relativeDensity(params.pressurePa, params.tempK);
  return g.breakdownFieldVPerM * delta * params.sphereRadiusM;
}

/** Korona baslangic gerilimi, V. Bunun altinda kacak yok. */
export function coronaOnsetVoltageV(params: VanDeGraaffParams): number {
  const delta = relativeDensity(params.pressurePa, params.tempK);
  return sphereCoronaOnsetVoltageV(params.sphereRadiusM, delta);
}

/** Terminalden cekilen toplam kacak akim (korona + harici yuk), A. */
export function leakageCurrentA(
  params: VanDeGraaffParams,
  voltageV: number,
  loadCurrentA = 0,
): number {
  const onset = coronaOnsetVoltageV(params);
  return coronaCurrentA(voltageV, onset, params.coronaK) + Math.abs(loadCurrentA);
}

/**
 * Bir zaman adimi ilerlet. Tam ustel cozum; `dtS` istenildigi kadar buyuk
 * olabilir.
 *
 * @param loadCurrentA demet veya harici yuk tarafindan cekilen akim, A.
 */
export function step(
  state: VanDeGraaffState,
  params: VanDeGraaffParams,
  dtS: number,
  loadCurrentA = 0,
): VanDeGraaffState {
  const c = sphereCapacitanceF(params.sphereRadiusM);
  const iCharge = beltCurrentA(params);
  const v = state.voltageV;
  const iLeak = leakageCurrentA(params, v, loadCurrentA);

  let next: number;
  if (v > 0 && iLeak > 0) {
    // Yerel iletkenlige dogrusallastir, sonra tam ustel adim at.
    const g = iLeak / v; // S
    const vFinal = iCharge / g;
    next = vFinal + (v - vFinal) * Math.exp((-dtS * g) / c);
  } else {
    // Kacak yok: dogrusal rampa, kesin cozum.
    next = v + (iCharge * dtS) / c;
  }

  // Kurenin kendi delinmesi sert tavan: asilirsa bosalir.
  const vMax = maxTerminalVoltageV(params);
  if (next > vMax) next = vMax;
  if (next < 0) next = 0;
  return { voltageV: next };
}

/** Terminalde depolanan enerji, J. */
export function storedEnergyJ(params: VanDeGraaffParams, voltageV: number): number {
  return 0.5 * sphereCapacitanceF(params.sphereRadiusM) * voltageV * voltageV;
}

export const DEFAULT_VAN_DE_GRAAFF: VanDeGraaffParams = {
  sphereRadiusM: 0.15,
  beltWidthM: 0.05,
  beltSpeedMs: 20,
  chargeDensityCPerM2: 2.5e-5,
  coronaK: 2e-16,
  gasId: 'air',
  pressurePa: 101325,
  tempK: 293.15,
};
