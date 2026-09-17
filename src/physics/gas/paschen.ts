/**
 * Paschen yasasi, Townsend iyonlasmasi ve delinme. PHYSICS.md bolum 1.C.
 *
 *     V_b = B*(p*d) / ( ln(A*p*d) - ln(ln(1 + 1/gamma_se)) )
 *
 * Bu simulasyonun en ogretici grafigi: egrinin SOL dali, basinc dustukce
 * delinme geriliminin TEKRAR yukselmesidir (carpisacak molekul kalmaz).
 * Basinc kaydiricisini cekince tup once parlar, sonra soner.
 *
 * Elektronegatif gazlar (SF6, O2) elektron yakaladigi icin saf Townsend alfa
 * yetmez; bunlar icin kritik indirgenmis alan (E/N)_kritik yaklasimina duseriz.
 */

import { numberDensity, gasProperties, type GasId } from './gases.ts';

/** 1 Townsend = 1e-21 V*m^2. */
const TOWNSEND_UNIT = 1e-21;

/**
 * Townsend birinci iyonlasma katsayisi alpha, 1/m.
 * `alpha = A*p*exp(-B*p/E)`. Elektronegatif gazda 0 doner.
 */
export function townsendAlpha(id: GasId, pressurePa: number, fieldVPerM: number): number {
  const g = gasProperties(id);
  if (g.townsendA === 0 || fieldVPerM <= 0 || pressurePa <= 0) return 0;
  return g.townsendA * pressurePa * Math.exp((-g.townsendB * pressurePa) / fieldVPerM);
}

/**
 * Duzgun alanda delinme gerilimi, V. Delinme mumkun degilse Infinity.
 *
 * Sol dal asimptotu: `A*p*d <= ln(1 + 1/gamma)` oldugunda payda sifira veya
 * negatife gider — fiziksel anlami "carpisma sayisi yeterli degil, hicbir
 * gerilimde catkin delinme olmaz"dir. Cagiran taraf Infinity'yi bu sekilde
 * yorumlamalidir (vakum rejimi).
 */
export function breakdownVoltageV(
  id: GasId,
  pressurePa: number,
  gapM: number,
  tempK = 293.15,
): number {
  const g = gasProperties(id);
  if (gapM <= 0) return 0;
  if (pressurePa <= 0) return Infinity;

  if (g.isElectronegative || g.townsendA === 0) {
    // Kritik indirgenmis alan yaklasimi: E_kritik = (E/N)_kritik * N
    const en = g.criticalReducedFieldTd;
    if (en === undefined) return Infinity;
    const n = numberDensity(pressurePa, tempK);
    return en * TOWNSEND_UNIT * n * gapM;
  }

  const pd = pressurePa * gapM;
  const k = Math.log(1 + 1 / g.gammaSe);
  const denom = Math.log(g.townsendA * pd) - Math.log(k);
  if (denom <= 0) return Infinity;
  return (g.townsendB * pd) / denom;
}

/** Delinme alani E_b = V_b/d, V/m. */
export function breakdownFieldVPerM(
  id: GasId,
  pressurePa: number,
  gapM: number,
  tempK = 293.15,
): number {
  if (gapM <= 0) return Infinity;
  return breakdownVoltageV(id, pressurePa, gapM, tempK) / gapM;
}

export interface PaschenMinimum {
  /** En dusuk delinme gerilimi, V. */
  readonly voltageV: number;
  /** Bu gerilimin olustugu p*d carpimi, Pa*m. */
  readonly pdPaM: number;
}

/**
 * Paschen egrisinin analitik minimumu.
 *     (p*d)_min = (e/A)*ln(1 + 1/gamma)
 *     V_min     = (e*B/A)*ln(1 + 1/gamma)
 *
 * Not: Yayinlanmis hava degerleri 300-360 V bandinda ve 0.5-1.2 Pa*m arasinda
 * degisir; fark katsayi setinden ve katot malzemesinin gamma'sindan gelir.
 * Buradaki deger kullandigimiz katsayilarla TAM tutarlidir.
 */
export function paschenMinimum(id: GasId): PaschenMinimum | null {
  const g = gasProperties(id);
  if (g.townsendA === 0 || g.isElectronegative) return null;
  const k = Math.log(1 + 1 / g.gammaSe);
  const pd = (Math.E / g.townsendA) * k;
  return { voltageV: g.townsendB * pd, pdPaM: pd };
}

/**
 * Townsend catkin delinme kriteri saglandi mi: `gamma*(e^(alpha*d) - 1) >= 1`.
 * Esdeger olarak `alpha*d >= ln(1 + 1/gamma)`.
 */
export function townsendCriterionMet(
  id: GasId,
  pressurePa: number,
  gapM: number,
  fieldVPerM: number,
): boolean {
  const g = gasProperties(id);
  if (g.townsendA === 0) return false;
  const alpha = townsendAlpha(id, pressurePa, fieldVPerM);
  return alpha * gapM >= Math.log(1 + 1 / g.gammaSe);
}

/**
 * Meek streamer kriteri: `integral(alpha_etkin) ~ 18-20`. Yuksek basincta
 * (atmosferik) delinme Townsend catkini yerine streamer ile olur; bu ayrim
 * gorsel rejimi belirler (yaygin parilti mi, dar kanal mi).
 */
export const MEEK_CRITERION = 18.4;

export function meekCriterionMet(
  id: GasId,
  pressurePa: number,
  gapM: number,
  fieldVPerM: number,
): boolean {
  return townsendAlpha(id, pressurePa, fieldVPerM) * gapM >= MEEK_CRITERION;
}
