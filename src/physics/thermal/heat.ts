/**
 * Isil denge: birikme, iletim, isima ve faz degisimi.
 * PHYSICS.md bolum 1.K.
 *
 * Zaman entegrasyonu YARI-ORTUK. Isima terimi T^4 oldugu icin acik Euler
 * 3000 K civarinda salinip patlar. Burada T^4 her adimda calisma noktasinda
 * dogrusallastirilir ve kalan dogrusal sistem TAM USTEL cozumle ilerletilir.
 * Boylece dt ne olursa olsun kararli kalir — kullanici zaman olcegini
 * degistirdiginde katot sicakligi zıplamaz.
 *
 * Katot geri beslemesi buradan gecer: demet isitir -> Richardson akimi ustel
 * buyur -> demet guclenir. Tungstende goz alici bir akkorlukta dengelenir;
 * indiyumda (erime 430 K) katot daha kizarmadan erir.
 */

import { STEFAN_BOLTZMANN } from '../constants.ts';

export interface ThermalBody {
  readonly massKg: number;
  readonly specificHeatJPerKgK: number;
  /** Isima yapan yuzey alani, m^2. */
  readonly surfaceAreaM2: number;
  /** Yayma katsayisi (emissivity), 0..1. */
  readonly emissivity: number;
  /** Isil iletim yolunun iletkenligi, W/K. Sogutucuya baglanti. */
  readonly conductanceWPerK: number;
  readonly ambientTempK: number;
  readonly meltingPointK: number;
  readonly boilingPointK: number;
  /** Erime gizli isisi, J/kg. */
  readonly latentHeatFusionJPerKg: number;
  readonly latentHeatVaporJPerKg: number;
}

export interface ThermalState {
  readonly tempK: number;
  /** Erimis kutle kesri, 0..1. Erime noktasinda gizli isi burada birikir. */
  readonly meltFraction: number;
  /** Buharlasmis kutle kesri, 0..1. */
  readonly vaporFraction: number;
}

/** Isima ile kaybedilen guc, W. `P = eps*sigma*A*(T^4 - T_ortam^4)`. */
export function radiativePowerW(body: ThermalBody, tempK: number): number {
  const t4 = tempK * tempK * tempK * tempK;
  const a4 = body.ambientTempK ** 4;
  return body.emissivity * STEFAN_BOLTZMANN * body.surfaceAreaM2 * (t4 - a4);
}

/** Iletim ile kaybedilen guc, W. */
export function conductionPowerW(body: ThermalBody, tempK: number): number {
  return body.conductanceWPerK * (tempK - body.ambientTempK);
}

/** Toplam kayip gucu, W. */
export function lossPowerW(body: ThermalBody, tempK: number): number {
  return radiativePowerW(body, tempK) + conductionPowerW(body, tempK);
}

/**
 * Denge sicakligi: verilen guc girdisinde kayiplarin esitlendigi T, K.
 * Ikili arama; T^4 monoton oldugu icin garantili yakinsar.
 */
export function equilibriumTempK(body: ThermalBody, inputPowerW: number): number {
  if (inputPowerW <= 0) return body.ambientTempK;
  let lo = body.ambientTempK;
  let hi = 20000;
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    if (lossPowerW(body, mid) < inputPowerW) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Bir zaman adimi ilerlet. Yari-ortuk: kayip terimi T etrafinda
 * dogrusallastirilir (G = dP_kayip/dT), sonra tam ustel adim atilir.
 *
 * Erime/buharlasma noktalarinda sicaklik SABIT KALIR ve enerji gizli isiya
 * gider — kullanici "neden isinmayi durdurdu?" diye sorunca cevap budur.
 */
export function step(
  state: ThermalState,
  body: ThermalBody,
  inputPowerW: number,
  dtS: number,
): ThermalState {
  if (body.massKg <= 0 || dtS <= 0) return state;
  const heatCapacity = body.massKg * body.specificHeatJPerKgK; // J/K
  let { tempK, meltFraction, vaporFraction } = state;

  const netAtT = inputPowerW - lossPowerW(body, tempK);

  // --- Faz gecisi platolari ---
  if (meltFraction > 0 && meltFraction < 1) {
    const latent = body.massKg * body.latentHeatFusionJPerKg;
    if (latent > 0) {
      meltFraction = Math.min(1, Math.max(0, meltFraction + (netAtT * dtS) / latent));
      return { tempK: body.meltingPointK, meltFraction, vaporFraction };
    }
  }
  if (vaporFraction > 0 && vaporFraction < 1) {
    const latent = body.massKg * body.latentHeatVaporJPerKg;
    if (latent > 0) {
      vaporFraction = Math.min(1, Math.max(0, vaporFraction + (netAtT * dtS) / latent));
      return { tempK: body.boilingPointK, meltFraction, vaporFraction };
    }
  }

  // --- Duyulur isi, yari-ortuk ustel adim ---
  // dP_kayip/dT = 4*eps*sigma*A*T^3 + G_iletim
  const dLossdT =
    4 * body.emissivity * STEFAN_BOLTZMANN * body.surfaceAreaM2 * tempK * tempK * tempK +
    body.conductanceWPerK;

  let next: number;
  if (dLossdT > 0) {
    const tau = heatCapacity / dLossdT;
    const tEq = tempK + netAtT / dLossdT;
    next = tEq + (tempK - tEq) * Math.exp(-dtS / tau);
  } else {
    next = tempK + (netAtT * dtS) / heatCapacity;
  }
  if (next < body.ambientTempK) next = body.ambientTempK;

  // --- Faz esiklerini gecerken platoya kilitle ---
  if (meltFraction < 1 && next >= body.meltingPointK) {
    return { tempK: body.meltingPointK, meltFraction: Math.max(meltFraction, 1e-6), vaporFraction };
  }
  if (meltFraction >= 1 && vaporFraction < 1 && next >= body.boilingPointK) {
    return { tempK: body.boilingPointK, meltFraction: 1, vaporFraction: Math.max(vaporFraction, 1e-6) };
  }
  return { tempK: next, meltFraction, vaporFraction };
}

/** Basit sicaklik artisi (faz degisimi yok), K. `dT = Q/(m*c_p)`. */
export function temperatureRiseK(energyJ: number, massKg: number, specificHeatJPerKgK: number): number {
  if (massKg <= 0 || specificHeatJPerKgK <= 0) return 0;
  return energyJ / (massKg * specificHeatJPerKgK);
}

/** Erimeye kadar gereken toplam enerji, J (duyulur + gizli). */
export function energyToMeltJ(body: ThermalBody, fromTempK: number): number {
  const sensible = body.massKg * body.specificHeatJPerKgK * Math.max(0, body.meltingPointK - fromTempK);
  return sensible + body.massKg * body.latentHeatFusionJPerKg;
}

export const INITIAL_THERMAL_STATE: ThermalState = {
  tempK: 293.15,
  meltFraction: 0,
  vaporFraction: 0,
};
