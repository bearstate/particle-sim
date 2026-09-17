import { AVOGADRO } from '../constants.ts';

/**
 * Kuratorlu element tablosu. PHYSICS.md bolum 1.K.
 *
 * Bu, veri hattinin uretecegi tam 118-elementlik `elements.bin` dosyasinin
 * yerine gecen calisir bir alt kumedir: katot/anot/hedef olarak fiilen
 * secilebilen elementleri kapsar. Hat devreye girince bu dosya ayni arayuzu
 * koruyarak binary okuyucuya devreder.
 *
 * Kaynak: CRC Handbook of Chemistry and Physics; is fonksiyonlari icin
 * CRC + Michaelson (1977). Termofiziksel degerler oda sicakliginda; erime
 * noktasi yakininda c_p belirgin degisir, `thermal/` modulu bunu ele alir.
 *
 * Alan sirasi (compact tuple):
 *   Z, sembol, A, yogunluk[g/cm3], erime[K], kaynama[K],
 *   c_p[J/(kg*K)], k[W/(m*K)], is fonksiyonu[eV] (0 = yok/uygulanmaz),
 *   L_erime[kJ/kg], L_buharlasma[kJ/kg]
 */

export interface Element {
  readonly Z: number;
  readonly symbol: string;
  /** Standart atom agirligi, g/mol. */
  readonly massNumber: number;
  readonly densityGPerCm3: number;
  readonly meltingPointK: number;
  readonly boilingPointK: number;
  readonly specificHeatJPerKgK: number;
  readonly thermalConductivityWPerMK: number;
  /** Is fonksiyonu, eV. 0 = metal degil veya veri yok. */
  readonly workFunctionEv: number;
  readonly latentHeatFusionKJPerKg: number;
  readonly latentHeatVaporKJPerKg: number;
}

type Row = readonly [number, string, number, number, number, number, number, number, number, number, number];

const ROWS: readonly Row[] = [
  [1, 'H', 1.008, 0.00008988, 13.99, 20.27, 14300, 0.1805, 0, 58.6, 449.4],
  [2, 'He', 4.0026, 0.0001785, 0.95, 4.22, 5193, 0.1513, 0, 5.2, 20.7],
  [3, 'Li', 6.94, 0.534, 453.65, 1615, 3582, 84.8, 2.9, 432, 19600],
  [4, 'Be', 9.0122, 1.85, 1560, 2742, 1825, 200, 4.98, 1357, 32450],
  [5, 'B', 10.81, 2.34, 2349, 4200, 1026, 27.4, 4.45, 4644, 34700],
  [6, 'C', 12.011, 2.267, 3915, 4098, 709, 140, 5.0, 117, 29650],
  [7, 'N', 14.007, 0.0012506, 63.15, 77.36, 1040, 0.02583, 0, 25.7, 199.2],
  [8, 'O', 15.999, 0.001429, 54.36, 90.2, 918, 0.02658, 0, 13.9, 213],
  [10, 'Ne', 20.18, 0.0008999, 24.56, 27.07, 1030, 0.0491, 0, 16.6, 85.8],
  [11, 'Na', 22.99, 0.968, 370.94, 1156, 1228, 142, 2.36, 113, 4260],
  [12, 'Mg', 24.305, 1.738, 923, 1363, 1023, 156, 3.66, 349, 5420],
  [13, 'Al', 26.982, 2.7, 933.47, 2792, 897, 237, 4.28, 397, 10500],
  [14, 'Si', 28.085, 2.329, 1687, 3538, 705, 149, 4.85, 1787, 12800],
  [16, 'S', 32.06, 2.07, 388.36, 717.8, 710, 0.205, 0, 53.4, 1400],
  [18, 'Ar', 39.948, 0.0017837, 83.8, 87.3, 520, 0.01772, 0, 29.6, 161.1],
  [19, 'K', 39.098, 0.862, 336.53, 1032, 757, 102.5, 2.29, 59.6, 2020],
  [20, 'Ca', 40.078, 1.55, 1115, 1757, 647, 201, 2.87, 213, 3830],
  [22, 'Ti', 47.867, 4.506, 1941, 3560, 523, 21.9, 4.33, 295, 8880],
  [23, 'V', 50.942, 6.11, 2183, 3680, 489, 30.7, 4.3, 410, 8830],
  [24, 'Cr', 51.996, 7.15, 2180, 2944, 449, 93.9, 4.5, 404, 6620],
  [25, 'Mn', 54.938, 7.21, 1519, 2334, 479, 7.81, 4.1, 235, 4090],
  [26, 'Fe', 55.845, 7.874, 1811, 3134, 449, 80.4, 4.5, 247, 6090],
  [27, 'Co', 58.933, 8.9, 1768, 3200, 421, 100, 5.0, 275, 6460],
  [28, 'Ni', 58.693, 8.908, 1728, 3186, 444, 90.9, 5.15, 298, 6480],
  [29, 'Cu', 63.546, 8.96, 1357.77, 2835, 385, 401, 4.7, 209, 4730],
  [30, 'Zn', 65.38, 7.14, 692.68, 1180, 388, 116, 4.33, 112, 1750],
  [31, 'Ga', 69.723, 5.91, 302.91, 2673, 371, 40.6, 4.2, 80.2, 3690],
  [32, 'Ge', 72.63, 5.323, 1211.4, 3106, 320, 60.2, 5.0, 509, 4600],
  [36, 'Kr', 83.798, 0.003733, 115.79, 119.93, 248, 0.00943, 0, 19.6, 108],
  [38, 'Sr', 87.62, 2.64, 1050, 1655, 301, 35.4, 2.59, 84.8, 1540],
  [40, 'Zr', 91.224, 6.52, 2128, 4682, 278, 22.6, 4.05, 230, 6360],
  [41, 'Nb', 92.906, 8.57, 2750, 5017, 265, 53.7, 4.3, 323, 7490],
  [42, 'Mo', 95.95, 10.28, 2896, 4912, 251, 138, 4.6, 390, 5120],
  [47, 'Ag', 107.87, 10.49, 1234.93, 2435, 235, 429, 4.26, 105, 2360],
  [48, 'Cd', 112.41, 8.65, 594.22, 1040, 232, 96.6, 4.22, 55.1, 890],
  [49, 'In', 114.82, 7.31, 429.75, 2345, 233, 81.8, 4.12, 28.6, 1970],
  [50, 'Sn', 118.71, 7.31, 505.08, 2875, 228, 66.8, 4.42, 59.2, 2490],
  [54, 'Xe', 131.29, 0.005887, 161.4, 165.03, 158, 0.00565, 0, 17.5, 95.6],
  [55, 'Cs', 132.91, 1.873, 301.59, 944, 242, 35.9, 2.14, 16.4, 514],
  [56, 'Ba', 137.33, 3.51, 1000, 2170, 204, 18.4, 2.7, 55.8, 1000],
  [57, 'La', 138.91, 6.162, 1193, 3737, 195, 13.4, 3.5, 44.6, 2980],
  [73, 'Ta', 180.95, 16.69, 3290, 5731, 140, 57.5, 4.25, 174, 4150],
  [74, 'W', 183.84, 19.25, 3695, 6203, 132, 173, 4.55, 192, 4480],
  [75, 'Re', 186.21, 21.02, 3459, 5869, 137, 48, 4.96, 178, 3420],
  [77, 'Ir', 192.22, 22.56, 2719, 4403, 131, 147, 5.27, 214, 3185],
  [78, 'Pt', 195.08, 21.45, 2041.4, 4098, 133, 71.6, 5.65, 101, 2510],
  [79, 'Au', 196.97, 19.3, 1337.33, 3129, 129, 317, 5.1, 64.5, 1700],
  [80, 'Hg', 200.59, 13.534, 234.32, 629.88, 140, 8.3, 4.49, 11.4, 295],
  [81, 'Tl', 204.38, 11.85, 577, 1746, 129, 46.1, 3.84, 20.3, 795],
  [82, 'Pb', 207.2, 11.34, 600.61, 2022, 129, 35.3, 4.25, 23.0, 866],
  [83, 'Bi', 208.98, 9.78, 544.7, 1837, 122, 7.97, 4.22, 54.0, 725],
  [90, 'Th', 232.04, 11.7, 2115, 5061, 118, 54, 3.4, 59.5, 2330],
  [92, 'U', 238.03, 19.1, 1405.3, 4404, 116, 27.5, 3.63, 38.4, 1750],
];

function toElement(r: Row): Element {
  return {
    Z: r[0],
    symbol: r[1],
    massNumber: r[2],
    densityGPerCm3: r[3],
    meltingPointK: r[4],
    boilingPointK: r[5],
    specificHeatJPerKgK: r[6],
    thermalConductivityWPerMK: r[7],
    workFunctionEv: r[8],
    latentHeatFusionKJPerKg: r[9],
    latentHeatVaporKJPerKg: r[10],
  };
}

const BY_Z = new Map<number, Element>(ROWS.map((r) => [r[0], toElement(r)]));
const BY_SYMBOL = new Map<string, Element>(ROWS.map((r) => [r[1], toElement(r)]));

/** Z'ye gore element. Tabloda yoksa undefined. */
export function elementByZ(z: number): Element | undefined {
  return BY_Z.get(z);
}

/** Sembole gore element ('W', 'Cu'). Buyuk/kucuk harf duyarli. */
export function elementBySymbol(symbol: string): Element | undefined {
  return BY_SYMBOL.get(symbol);
}

/** Tablodaki tum elementler, Z'ye gore artan. */
export const ELEMENTS: readonly Element[] = ROWS.map(toElement);

/** Yogunluk, kg/m^3. Termal hesaplarin bekledigi birim. */
export function densityKgPerM3(e: Element): number {
  return e.densityGPerCm3 * 1000;
}

/** Atom yogunlugu n = rho*N_A/M, 1/m^3. Tesir kesiti hesaplarinin girdisi. */
export function atomDensityPerM3(e: Element): number {
  return (densityKgPerM3(e) * AVOGADRO) / (e.massNumber * 1e-3);
}
