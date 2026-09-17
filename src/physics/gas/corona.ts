/**
 * Korona baslangici (Peek yasasi) ve korona kacak akimi.
 * PHYSICS.md bolum 1.A.
 *
 *   silindir:  E_c = 31*delta*(1 + 0.308/sqrt(delta*r_cm))  kV/cm
 *   kure:      E_c = 30*delta*(1 + 0.54 /sqrt(delta*r_cm))  kV/cm
 *
 * Yaricap kucukken ikinci terim buyur: ince teller cok daha dusuk alanda
 * korona baslatir. Van de Graaff'in taraklarinin neden sivri oldugu budur —
 * yuku tasimak icin bilerek korona uretirler.
 */

export type ElectrodeGeometry = 'cylinder' | 'sphere';

/**
 * Peek korona baslangic alani, V/m.
 * @param radiusM egrilik yaricapi, m
 * @param delta bagil gaz yogunlugu (gases.relativeDensity)
 */
export function peekOnsetFieldVPerM(
  radiusM: number,
  delta: number,
  geometry: ElectrodeGeometry = 'cylinder',
): number {
  if (radiusM <= 0 || delta <= 0) return Infinity;
  const rCm = radiusM * 100;
  const arg = Math.sqrt(delta * rCm);
  return geometry === 'sphere'
    ? 3.0e6 * delta * (1 + 0.54 / arg)
    : 3.1e6 * delta * (1 + 0.308 / arg);
}

/**
 * Yalitilmis bir kurenin korona baslangic gerilimi, V.
 * Kure yuzeyinde E = V/R oldugu icin V_onset = E_c * R.
 */
export function sphereCoronaOnsetVoltageV(radiusM: number, delta: number): number {
  return peekOnsetFieldVPerM(radiusM, delta, 'sphere') * radiusM;
}

/**
 * Korona kacak akimi, A. Townsend'in kuadratik korona yasasi:
 *     I = k * V * (V - V_onset),  V > V_onset
 * Baslangicin altinda tam sifir degil ama ihmal edilebilir; burada 0 alinir.
 *
 * @param k geometriye bagli katsayi, A/V^2. Tipik laboratuvar Van de Graaff
 *          icin 1e-16 .. 1e-14 mertebesinde; cihaz descriptor'unda ayarlanir.
 */
export function coronaCurrentA(voltageV: number, onsetV: number, k: number): number {
  const v = Math.abs(voltageV);
  if (v <= onsetV) return 0;
  return k * v * (v - onsetV);
}

/**
 * Korona akiminin gorunur yogunlugu (0..1). Gorsel katman bunu filaman
 * sayisina ve parlakliga baglar. Doygunluk icin yumusak tavan.
 */
export function coronaIntensity(voltageV: number, onsetV: number): number {
  if (onsetV <= 0 || !Number.isFinite(onsetV)) return 0;
  const over = Math.abs(voltageV) / onsetV - 1;
  if (over <= 0) return 0;
  return 1 - Math.exp(-2 * over);
}
