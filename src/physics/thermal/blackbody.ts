/**
 * Kara cisim isimasi ve fiziksel olarak dogru akkor rengi.
 * PHYSICS.md bolum 1.K, 1.L.
 *
 *   B(lambda,T) = (2hc^2/lambda^5) / (exp(hc/(lambda*k*T)) - 1)
 *   Wien:  lambda_max * T = 2.8978e-3 m*K
 *
 * Renk ELLE BOYANMAZ: Planck spektrumu CIE 1931 renk eslestirme
 * fonksiyonlariyla XYZ'ye, oradan sRGB'ye cevrilir. Katot 800 K'de donuk
 * kizil, 3000 K'de sari-beyaz olur cunku FIZIK oyle diyor.
 *
 * CIE eslestirme fonksiyonlari icin Wyman-Sloan-Shirley (2013) coklu-Gauss
 * analitik uyumu kullanilir: tablo tasimadan %1 dogruluk verir.
 */

import { PLANCK, C, BOLTZMANN, STEFAN_BOLTZMANN } from '../constants.ts';

/** Wien yer degistirme sabiti, m*K. */
export const WIEN_CONSTANT = 2.897771955e-3;

/** Draper noktasi: goz ile gorulen ilk kizillik, K. */
export const DRAPER_POINT_K = 798;

/** Planck spektral isima, W/(m^2*sr*m). lambda metre. */
export function planckRadiance(wavelengthM: number, tempK: number): number {
  if (wavelengthM <= 0 || tempK <= 0) return 0;
  const l5 = Math.pow(wavelengthM, 5);
  const x = (PLANCK * C) / (wavelengthM * BOLTZMANN * tempK);
  // Buyuk x'te exp tasar; Wien yaklasimina duz.
  const denom = x > 700 ? Math.exp(x) : Math.exp(x) - 1;
  return (2 * PLANCK * C * C) / (l5 * denom);
}

/** Wien tepe dalga boyu, m. */
export function peakWavelengthM(tempK: number): number {
  if (tempK <= 0) return Infinity;
  return WIEN_CONSTANT / tempK;
}

/** Toplam isima cikisi, W/m^2. `M = sigma*T^4`. */
export function radiantExitanceWPerM2(tempK: number): number {
  return STEFAN_BOLTZMANN * Math.pow(tempK, 4);
}

/** Asimetrik Gauss yardimcisi (Wyman ve ark.). */
function g(x: number, mu: number, s1: number, s2: number): number {
  const s = x < mu ? s1 : s2;
  const t = (x - mu) / s;
  return Math.exp(-0.5 * t * t);
}

/** CIE 1931 x-bar, lambda nanometre. */
export function cieX(lambdaNm: number): number {
  return (
    1.056 * g(lambdaNm, 599.8, 37.9, 31.0) +
    0.362 * g(lambdaNm, 442.0, 16.0, 26.7) -
    0.065 * g(lambdaNm, 501.1, 20.4, 26.2)
  );
}

/** CIE 1931 y-bar. */
export function cieY(lambdaNm: number): number {
  return 0.821 * g(lambdaNm, 568.8, 46.9, 40.5) + 0.286 * g(lambdaNm, 530.9, 16.3, 31.1);
}

/** CIE 1931 z-bar. */
export function cieZ(lambdaNm: number): number {
  return 1.217 * g(lambdaNm, 437.0, 11.8, 36.0) + 0.681 * g(lambdaNm, 459.0, 26.0, 13.8);
}

export interface XYZ {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Bir spektral guc dagilimini XYZ'ye integre eder. 360-830 nm, 5 nm adim.
 * @param spd (lambdaNm) => bagil spektral guc
 */
export function spectrumToXYZ(spd: (lambdaNm: number) => number): XYZ {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let l = 360; l <= 830; l += 5) {
    const p = spd(l);
    x += p * cieX(l);
    y += p * cieY(l);
    z += p * cieZ(l);
  }
  return { x: x * 5, y: y * 5, z: z * 5 };
}

/** Kara cisim spektrumunun XYZ'si. */
export function blackbodyXYZ(tempK: number): XYZ {
  return spectrumToXYZ((lambdaNm) => planckRadiance(lambdaNm * 1e-9, tempK));
}

/** sRGB gama kodlamasi. */
function encodeGamma(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export type RGB = readonly [number, number, number];

/** XYZ -> dogrusal sRGB (D65). Kirpilmamis; negatif deger gamut disi demektir. */
export function xyzToLinearSrgb(c: XYZ): RGB {
  return [
    3.2406 * c.x - 1.5372 * c.y - 0.4986 * c.z,
    -0.9689 * c.x + 1.8758 * c.y + 0.0415 * c.z,
    0.0557 * c.x - 0.204 * c.y + 1.057 * c.z,
  ];
}

/**
 * Sicakliktan normalize dogrusal sRGB rengi (parlaklik 1'e olceklenmis).
 * Shader `emissive` rengi olarak dogrudan kullanilir; parlakligi ayri bir
 * carpanla (bkz. `glowIntensity`) surulur ki bloom dogru calissin.
 */
export function blackbodyLinearRgb(tempK: number): RGB {
  const xyz = blackbodyXYZ(tempK);
  const sum = xyz.x + xyz.y + xyz.z;
  if (sum <= 0) return [0, 0, 0];
  const norm: XYZ = { x: xyz.x / sum, y: xyz.y / sum, z: xyz.z / sum };
  const [r, g2, b] = xyzToLinearSrgb(norm);
  // Gamut disi negatifleri beyaza dogru kaydirarak kurtar.
  const min = Math.min(r, g2, b);
  const shift = min < 0 ? -min : 0;
  const rr = r + shift;
  const gg = g2 + shift;
  const bb = b + shift;
  const max = Math.max(rr, gg, bb);
  if (max <= 0) return [0, 0, 0];
  return [rr / max, gg / max, bb / max];
}

/** Sicakliktan 0-255 sRGB (UI etiketleri, renk ornekleri icin). */
export function blackbodySrgb255(tempK: number): readonly [number, number, number] {
  const [r, g2, b] = blackbodyLinearRgb(tempK);
  return [
    Math.round(encodeGamma(r) * 255),
    Math.round(encodeGamma(g2) * 255),
    Math.round(encodeGamma(b) * 255),
  ];
}

/**
 * Gorsel parlaklik carpani. Draper noktasinda 0'dan baslar, T^4 ile buyur.
 * Bloom esigi 1.0 oldugu icin donuk kizil parlamaz, 3000 K goz alir.
 *
 * @param referenceK bu sicaklikta ciktinin 1.0 olmasi istenen referans.
 */
export function glowIntensity(tempK: number, referenceK = 1500): number {
  if (tempK <= DRAPER_POINT_K) return 0;
  const num = Math.pow(tempK, 4) - Math.pow(DRAPER_POINT_K, 4);
  const den = Math.pow(referenceK, 4) - Math.pow(DRAPER_POINT_K, 4);
  return den > 0 ? num / den : 0;
}
