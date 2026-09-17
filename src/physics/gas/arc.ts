/**
 * Ark / kivilcim: kanal uzunlugu, enerji, olay hizi. PHYSICS.md bolum 1.A, 1.L.
 *
 * Ark SUREKLI ENTEGRE EDILMEZ; olay tabanlidir. Fizik bir Poisson hizi verir,
 * gorsel katman olayi tuketir. Bu sayede adim boyutundan bagimsizdir ve
 * zaman olcegi degistiginde bozulmaz.
 */

import { AIR_BREAKDOWN_V_PER_M } from '../constants.ts';

/**
 * Kivilcim kanali uzunlugu, m. `d = V / E_delinme`.
 *
 * Varsayilan 3.0e6 V/m (30 kV/cm) duzgun alan, deniz seviyesi havasi icindir:
 * 300 kV -> 10 cm. Uzun cubuk-duzlem aralıklarinda uzay yuku yuzunden gercek
 * deger ~5 kV/cm'e kadar duser; `LONG_GAP_FIELD_V_PER_M` bunun icindir.
 */
export function sparkLengthM(voltageV: number, breakdownFieldVPerM = AIR_BREAKDOWN_V_PER_M): number {
  if (breakdownFieldVPerM <= 0) return 0;
  return Math.abs(voltageV) / breakdownFieldVPerM;
}

/** Gercekci uzun aralik ortalama gradyani, V/m (~5 kV/cm). */
export const LONG_GAP_FIELD_V_PER_M = 5.0e5;

/** Kondansatorde depolanan enerji, J. `U = 0.5*C*V^2`. */
export function storedEnergyJ(capacitanceF: number, voltageV: number): number {
  return 0.5 * capacitanceF * voltageV * voltageV;
}

/** Ark kanali sicakligi, K. Atmosferik kivilcim icin 20 000 - 30 000 K. */
export const ARC_CHANNEL_TEMP_K = 25000;

/**
 * Ark olay hizi, 1/s. Asiri gerilimle dogrusal artar, `maxRateHz`'e doyar.
 * `overvoltage = V/V_delinme - 1`.
 *
 * Gerilim esigin altindaysa 0 doner — hicbir ark ureilmez, rastgele parlama
 * olmaz. Bu, "esigin altinda hicbir sey olmamali" kuralinin tek kaynagidir.
 */
export function arcRatePerS(voltageV: number, breakdownVoltageV: number, maxRateHz = 12): number {
  if (breakdownVoltageV <= 0 || !Number.isFinite(breakdownVoltageV)) return 0;
  const over = Math.abs(voltageV) / breakdownVoltageV - 1;
  if (over <= 0) return 0;
  return maxRateHz * (1 - Math.exp(-3 * over));
}

/**
 * dt suresi icinde en az bir ark olma olasiligi: `1 - exp(-rate*dt)`.
 * Cagiran taraf bunu tohumlu RNG ile karsilastirir (fizik icinde RNG yok).
 */
export function arcProbability(ratePerS: number, dtS: number): number {
  if (ratePerS <= 0 || dtS <= 0) return 0;
  return 1 - Math.exp(-ratePerS * dtS);
}
