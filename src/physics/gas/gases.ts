/**
 * Gaz ortami ozellikleri. PHYSICS.md bolum 1.C.
 *
 * Townsend katsayilari literaturde neredeyse her zaman cm^-1 Torr^-1 ve
 * V cm^-1 Torr^-1 biriminde verilir. Burada SI'ya cevrilmis halleri saklanir;
 * her iki katsayi da ayni carpanla olcekler:
 *     A[1/(m*Pa)] = A[1/(cm*Torr)] * 100 / 133.322 = A_cgs * 0.75006
 *     B[V/(m*Pa)] = B[V/(cm*Torr)] * 100 / 133.322 = B_cgs * 0.75006
 *
 * Kaynak: Lieberman & Lichtenberg, "Principles of Plasma Discharges"; Naidu &
 * Kamaraju, "High Voltage Engineering". Katsayi setleri kaynaktan kaynaga
 * %10-20 degisir; burada tek bir tutarli set kullanilir.
 */

import { BOLTZMANN, ATM_TO_PA, T_STANDARD_K } from '../constants.ts';

export type GasId = 'vacuum' | 'air' | 'n2' | 'o2' | 'co2' | 'h2' | 'he' | 'ne' | 'ar' | 'kr' | 'xe' | 'sf6';

export interface GasProperties {
  readonly id: GasId;
  /** Townsend A, 1/(m*Pa). Sifir ise Townsend modeli uygulanmaz (bkz. isElectronegative). */
  readonly townsendA: number;
  /** Townsend B, V/(m*Pa). */
  readonly townsendB: number;
  /**
   * Ikincil elektron emisyon katsayisi gamma_se. Katot malzemesine kuvvetle
   * bagli (0.005 - 0.2); burada metal katot icin tipik deger.
   */
  readonly gammaSe: number;
  /** Duzgun alanda delinme dayanimi, 1 bar ve 20 C'de, V/m. */
  readonly breakdownFieldVPerM: number;
  /** Carpisma capi, m. Ortalama serbest yol icin. */
  readonly molecularDiameterM: number;
  /** Ilk iyonlasma enerjisi, eV. */
  readonly ionizationEnergyEv: number;
  /** Molar kutle, g/mol. */
  readonly molarMassGPerMol: number;
  /**
   * Elektronegatif gazlar (SF6, O2) elektron yakalar; Townsend alfa yerine
   * etkin (alpha - eta) gerekir. Bu bayrak isaretliyse paschen.ts kritik
   * indirgenmis alan yaklasimina duser.
   */
  readonly isElectronegative: boolean;
  /** Kritik indirgenmis alan (E/N)_kritik, Townsend (1 Td = 1e-21 V*m^2). */
  readonly criticalReducedFieldTd?: number;
}

const GAS_TABLE: Record<GasId, GasProperties> = {
  vacuum: {
    id: 'vacuum',
    townsendA: 0,
    townsendB: 0,
    gammaSe: 0,
    // Vakumda Paschen gecersizdir; sinir yuzey flashover'idir (10-30 MV/m).
    breakdownFieldVPerM: 2.0e7,
    molecularDiameterM: 0,
    ionizationEnergyEv: Infinity,
    molarMassGPerMol: 0,
    isElectronegative: false,
  },
  air: {
    id: 'air',
    townsendA: 11.25,
    townsendB: 273.8,
    gammaSe: 0.01,
    breakdownFieldVPerM: 3.0e6,
    molecularDiameterM: 3.7e-10,
    ionizationEnergyEv: 14.5,
    molarMassGPerMol: 28.96,
    isElectronegative: false,
  },
  n2: {
    id: 'n2',
    townsendA: 9.0,
    townsendB: 256.5,
    gammaSe: 0.01,
    breakdownFieldVPerM: 3.4e6,
    molecularDiameterM: 3.75e-10,
    ionizationEnergyEv: 15.58,
    molarMassGPerMol: 28.01,
    isElectronegative: false,
  },
  o2: {
    id: 'o2',
    townsendA: 0,
    townsendB: 0,
    gammaSe: 0.01,
    breakdownFieldVPerM: 2.6e6,
    molecularDiameterM: 3.55e-10,
    ionizationEnergyEv: 12.07,
    molarMassGPerMol: 32.0,
    isElectronegative: true,
    criticalReducedFieldTd: 100,
  },
  co2: {
    id: 'co2',
    townsendA: 15.0,
    townsendB: 349.5,
    gammaSe: 0.01,
    breakdownFieldVPerM: 2.7e6,
    molecularDiameterM: 4.5e-10,
    ionizationEnergyEv: 13.77,
    molarMassGPerMol: 44.01,
    isElectronegative: false,
  },
  h2: {
    id: 'h2',
    townsendA: 3.75,
    townsendB: 97.5,
    gammaSe: 0.02,
    breakdownFieldVPerM: 1.9e6,
    molecularDiameterM: 2.89e-10,
    ionizationEnergyEv: 15.43,
    molarMassGPerMol: 2.016,
    isElectronegative: false,
  },
  he: {
    id: 'he',
    townsendA: 2.25,
    townsendB: 25.5,
    gammaSe: 0.15,
    breakdownFieldVPerM: 1.0e6,
    molecularDiameterM: 2.6e-10,
    ionizationEnergyEv: 24.59,
    molarMassGPerMol: 4.003,
    isElectronegative: false,
  },
  ne: {
    id: 'ne',
    townsendA: 3.0,
    townsendB: 75.0,
    gammaSe: 0.1,
    breakdownFieldVPerM: 1.4e6,
    molecularDiameterM: 2.75e-10,
    ionizationEnergyEv: 21.56,
    molarMassGPerMol: 20.18,
    isElectronegative: false,
  },
  ar: {
    id: 'ar',
    townsendA: 9.0,
    townsendB: 135.0,
    gammaSe: 0.06,
    breakdownFieldVPerM: 1.6e6,
    molecularDiameterM: 3.64e-10,
    ionizationEnergyEv: 15.76,
    molarMassGPerMol: 39.95,
    isElectronegative: false,
  },
  kr: {
    id: 'kr',
    townsendA: 12.0,
    townsendB: 180.0,
    gammaSe: 0.05,
    breakdownFieldVPerM: 1.7e6,
    molecularDiameterM: 4.16e-10,
    ionizationEnergyEv: 14.0,
    molarMassGPerMol: 83.8,
    isElectronegative: false,
  },
  xe: {
    id: 'xe',
    townsendA: 15.0,
    townsendB: 262.5,
    gammaSe: 0.04,
    breakdownFieldVPerM: 1.8e6,
    molecularDiameterM: 4.85e-10,
    ionizationEnergyEv: 12.13,
    molarMassGPerMol: 131.29,
    isElectronegative: false,
  },
  sf6: {
    id: 'sf6',
    townsendA: 0,
    townsendB: 0,
    gammaSe: 0.005,
    // Havanin ~3 kati. Duzgun alanda ~89 kV/(cm*bar).
    breakdownFieldVPerM: 8.9e6,
    molecularDiameterM: 4.77e-10,
    ionizationEnergyEv: 15.32,
    molarMassGPerMol: 146.06,
    isElectronegative: true,
    criticalReducedFieldTd: 360,
  },
};

export function gasProperties(id: GasId): GasProperties {
  return GAS_TABLE[id];
}

export const ALL_GASES: readonly GasId[] = Object.keys(GAS_TABLE) as GasId[];

/** Parcacik yogunlugu n = p/(k_B*T), 1/m^3. */
export function numberDensity(pressurePa: number, tempK: number): number {
  return pressurePa / (BOLTZMANN * tempK);
}

/**
 * Bagil hava yogunlugu delta = (p/p0)*(T0/T), boyutsuz.
 * Peek yasasi ve delinme alani duzeltmelerinde kullanilir.
 */
export function relativeDensity(pressurePa: number, tempK: number): number {
  return (pressurePa / ATM_TO_PA) * (T_STANDARD_K / tempK);
}

/**
 * Ortalama serbest yol, m. `lambda = k_B*T / (sqrt(2)*pi*d^2*p)`.
 * Vakumda (d = 0) Infinity doner — carpismasiz tasinim.
 */
export function meanFreePathM(id: GasId, pressurePa: number, tempK: number): number {
  const d = GAS_TABLE[id].molecularDiameterM;
  if (d <= 0 || pressurePa <= 0) return Infinity;
  return (BOLTZMANN * tempK) / (Math.SQRT2 * Math.PI * d * d * pressurePa);
}
