/**
 * Elektron/iyon emisyonu: uzay yuku siniri, termiyonik ve alan emisyonu.
 * PHYSICS.md bolum 1.B.
 *
 * Bu modul katot geri besleme dongusunun kalbidir: demet katodu isitir ->
 * Richardson akimi ustel olarak buyur -> demet guclenir -> katot daha cok
 * isinir. Tungstende bu goz alici bir akkorlukla dengelenir; dusuk erime
 * noktali bir metalde katot erir.
 */

import {
  EPSILON_0,
  ELEMENTARY_CHARGE,
  ELECTRON_MASS_KG,
  ATOMIC_MASS_UNIT_KG,
  BOLTZMANN_EV,
  RICHARDSON_A0,
} from '../constants.ts';

/**
 * Child-Langmuir uzay yuku sinirli akim yogunlugu, A/m^2.
 * `J = (4*eps0/9)*sqrt(2q/m)*V^1.5/d^2`
 *
 * Elektron icin katsayi 2.334e-6, tek yuklu agir iyon icin ~5.47e-8/sqrt(A).
 * Bu sinir asilamaz: gerilimi artirmadan akimi artiramazsiniz.
 *
 * @param massKg parcacik durgun kutlesi
 * @param z yuk sayisi
 * @param voltageV hizlandirma gerilimi
 * @param gapM anot-katot araligi
 */
export function childLangmuirCurrentDensity(
  massKg: number,
  z: number,
  voltageV: number,
  gapM: number,
): number {
  if (gapM <= 0 || voltageV <= 0 || massKg <= 0) return 0;
  const k = ((4 * EPSILON_0) / 9) * Math.sqrt((2 * Math.abs(z) * ELEMENTARY_CHARGE) / massKg);
  return (k * Math.pow(voltageV, 1.5)) / (gapM * gapM);
}

/** Elektronlar icin kisayol. */
export function childLangmuirElectron(voltageV: number, gapM: number): number {
  return childLangmuirCurrentDensity(ELECTRON_MASS_KG, 1, voltageV, gapM);
}

/** Kutle sayisi A ve yuk z olan iyon icin kisayol. */
export function childLangmuirIon(massNumber: number, z: number, voltageV: number, gapM: number): number {
  return childLangmuirCurrentDensity(massNumber * ATOMIC_MASS_UNIT_KG, z, voltageV, gapM);
}

/** Perveans P = I/V^1.5, A/V^1.5. Tabancanin geometrik imzasi. */
export function perveance(currentA: number, voltageV: number): number {
  if (voltageV <= 0) return 0;
  return currentA / Math.pow(voltageV, 1.5);
}

/**
 * Richardson-Dushman termiyonik akim yogunlugu, A/m^2.
 * `J = lambda_R * A0 * T^2 * exp(-W/(k*T))`
 *
 * @param workFunctionEv is fonksiyonu, eV
 * @param tempK katot sicakligi
 * @param materialFactor lambda_R malzeme duzeltmesi (gercek metaller 0.3-0.7)
 */
export function richardsonCurrentDensity(
  workFunctionEv: number,
  tempK: number,
  materialFactor = 0.5,
): number {
  if (tempK <= 0) return 0;
  return materialFactor * RICHARDSON_A0 * tempK * tempK * Math.exp(-workFunctionEv / (BOLTZMANN_EV * tempK));
}

/**
 * Schottky etkisi: yuzeydeki alan is fonksiyonunu dusurur.
 * `dW = sqrt(e^3*E/(4*pi*eps0))`, eV cinsinden.
 */
export function schottkyLoweringEv(fieldVPerM: number): number {
  if (fieldVPerM <= 0) return 0;
  const j = Math.sqrt(
    (ELEMENTARY_CHARGE * ELEMENTARY_CHARGE * ELEMENTARY_CHARGE * fieldVPerM) / (4 * Math.PI * EPSILON_0),
  );
  return j / ELEMENTARY_CHARGE;
}

/** Schottky duzeltmeli termiyonik akim yogunlugu, A/m^2. */
export function schottkyCurrentDensity(
  workFunctionEv: number,
  tempK: number,
  fieldVPerM: number,
  materialFactor = 0.5,
): number {
  const effective = Math.max(0, workFunctionEv - schottkyLoweringEv(fieldVPerM));
  return richardsonCurrentDensity(effective, tempK, materialFactor);
}

const FN_A = 1.541434e-6; // A*eV/V^2
const FN_B = 6.83089e9; // eV^-1.5 * V/m

/**
 * Fowler-Nordheim alan emisyonu akim yogunlugu, A/m^2.
 * `J = (a*(beta*E)^2/phi) * exp(-b*phi^1.5*v(y)/(beta*E))`
 *
 * Nordheim fonksiyonu v(y) icin Forbes yaklasimi kullanilir:
 *   v(y) ~ 1 - y^2 + (1/3)*y^2*ln(y),  y = sqrt(schottky)/phi
 *
 * @param betaEnhancement yuzey puruzlulugunun alan artirma carpani (10-1000)
 */
export function fowlerNordheimCurrentDensity(
  workFunctionEv: number,
  fieldVPerM: number,
  betaEnhancement = 1,
): number {
  const e = betaEnhancement * fieldVPerM;
  if (e <= 0 || workFunctionEv <= 0) return 0;
  const y = schottkyLoweringEv(e) / workFunctionEv;
  const v = y > 0 && y < 1 ? 1 - y * y + (y * y * Math.log(y)) / 3 : 1;
  return ((FN_A * e * e) / workFunctionEv) * Math.exp((-FN_B * Math.pow(workFunctionEv, 1.5) * v) / e);
}

/**
 * Katodun gercek akim yogunlugu: termiyonik ve alan emisyonunun toplami,
 * Child-Langmuir uzay yuku siniriyla kirpilmis.
 *
 * Bu, tabanca fizigi icin tek giris noktasidir: uc mekanizmanin hangisinin
 * baskin oldugu calisma noktasina gore kendiliginden belirlenir.
 */
export function cathodeCurrentDensity(args: {
  workFunctionEv: number;
  tempK: number;
  surfaceFieldVPerM: number;
  anodeVoltageV: number;
  gapM: number;
  materialFactor?: number;
  betaEnhancement?: number;
}): number {
  const thermionic = schottkyCurrentDensity(
    args.workFunctionEv,
    args.tempK,
    args.surfaceFieldVPerM,
    args.materialFactor ?? 0.5,
  );
  const field = fowlerNordheimCurrentDensity(
    args.workFunctionEv,
    args.surfaceFieldVPerM,
    args.betaEnhancement ?? 1,
  );
  const limit = childLangmuirElectron(args.anodeVoltageV, args.gapM);
  return Math.min(thermionic + field, limit);
}
