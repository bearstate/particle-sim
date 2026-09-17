/**
 * Bremsstrahlung (fren isimasi) ve karakteristik X-isini cizgileri.
 * PHYSICS.md bolum 1.E.
 *
 *   Duane-Hunt  lambda_min[nm] = 1.2398 / V[kV]
 *   Kramers     I(E) dE = K*Z*(E_max - E) dE
 *   Verim       eta ~ 1.1e-9 * Z * V[V]
 *
 * Simulasyonun en tatmin edici etkilesimi burada: hizlandirma gerilimi K
 * kabuk baglanma enerjisini gecince spektrumda karakteristik DIKEN aniden
 * belirir. W icin bu esik 69.5 kV'dir — surekli spektrum cok once baslamistir
 * ama cizgiler tam o noktada dogar.
 */

import { HC_EV_NM } from '../constants.ts';

/** Duane-Hunt kisa dalga boyu siniri, nm. */
export function duaneHuntWavelengthNm(tubeVoltageV: number): number {
  if (tubeVoltageV <= 0) return Infinity;
  return HC_EV_NM / tubeVoltageV;
}

/** Spektrumun ust sinir enerjisi, keV. Elektronun tum enerjisi tek fotona. */
export function endpointEnergyKeV(tubeVoltageV: number): number {
  return tubeVoltageV / 1000;
}

/**
 * X-isini uretim verimi (yayilan isima gucu / demet gucu), boyutsuz.
 * `eta ~ 1.1e-9 * Z * V`. W anot @ 100 kV -> ~0.8 %. Geri kalan ISI olur.
 */
export function productionEfficiency(Z: number, tubeVoltageV: number): number {
  return Math.min(1, 1.1e-9 * Z * tubeVoltageV);
}

/** Anotta isiya donusen guc, W. Verimin dusuklugu anot sogutmasinin sebebidir. */
export function anodeHeatW(beamPowerW: number, Z: number, tubeVoltageV: number): number {
  return beamPowerW * (1 - productionEfficiency(Z, tubeVoltageV));
}

export interface XraySpectrum {
  /** Bin merkez enerjileri, keV. */
  readonly energiesKeV: Float64Array;
  /** Bin basina bagil foton akisi (toplami 1'e normalize). */
  readonly weights: Float64Array;
  readonly endpointKeV: number;
}

/**
 * Kramers ince-hedef surekli spektrumu, opsiyonel filtrasyonla.
 * `I(E) ~ Z*(E_max - E)`, foton SAYISI icin `N(E) ~ Z*(E_max/E - 1)`.
 *
 * Burada FOTON SAYISI dagilimi uretilir (dedektor ve doz hesaplarinin
 * bekledigi sey budur), enerji akisi degil.
 *
 * @param attenuation opsiyonel filtre gecirgenligi: (E_keV) => 0..1.
 *        Icsel filtrasyon (cam pencere, anot kendisi) ve harici filtre
 *        (Al, Cu) bununla modellenir; dusuk enerjili kuyrugu kirpar.
 */
export function kramersSpectrum(
  Z: number,
  tubeVoltageV: number,
  bins = 128,
  attenuation?: (energyKeV: number) => number,
): XraySpectrum {
  const endpoint = endpointEnergyKeV(tubeVoltageV);
  const energies = new Float64Array(bins);
  const weights = new Float64Array(bins);
  if (endpoint <= 0) return { energiesKeV: energies, weights, endpointKeV: 0 };

  const dE = endpoint / bins;
  let total = 0;
  for (let i = 0; i < bins; i++) {
    const e = (i + 0.5) * dE;
    energies[i] = e;
    // Foton sayisi dagilimi: N(E) dE ~ Z*(E_max/E - 1) dE
    let w = e > 0 ? Z * (endpoint / e - 1) : 0;
    if (w < 0) w = 0;
    if (attenuation) w *= attenuation(e);
    weights[i] = w;
    total += w;
  }
  if (total > 0) {
    for (let i = 0; i < bins; i++) weights[i]! /= total;
  }
  return { energiesKeV: energies, weights, endpointKeV: endpoint };
}

/** Moseley yasasi: K-alfa enerjisi, eV. `E = (3/4)*13.606*(Z-1)^2`. */
export function moseleyKAlphaEv(Z: number): number {
  return 0.75 * 13.605693 * (Z - 1) * (Z - 1);
}

/** Moseley K-beta, eV. `E = (8/9)*13.606*(Z-1)^2`. */
export function moseleyKBetaEv(Z: number): number {
  return (8 / 9) * 13.605693 * (Z - 1) * (Z - 1);
}

/** Moseley L-alfa, eV. `E = 13.606*(5/36)*(Z-7.4)^2`. */
export function moseleyLAlphaEv(Z: number): number {
  const s = Z - 7.4;
  return 13.605693 * (5 / 36) * s * s;
}

export interface CharacteristicLines {
  readonly kEdgeKeV: number;
  readonly kAlphaKeV: number;
  readonly kBetaKeV: number;
  readonly lAlphaKeV: number;
}

/**
 * Yaygin anot malzemeleri icin OLCULMUS cizgi enerjileri, keV.
 * Kaynak: NIST X-Ray Transition Energies Database.
 *
 * Moseley yaklasimi yuksek Z'de %6'ya kadar sapar (W icin 54.4 keV verir,
 * gercegi 59.3 keV) cunku perdeleme sabiti sigma=1 varsayimi orada bozulur.
 * Tabloda olan element icin daima olculmus deger kullanilir.
 */
const MEASURED_LINES: Record<number, CharacteristicLines> = {
  24: { kEdgeKeV: 5.989, kAlphaKeV: 5.415, kBetaKeV: 5.947, lAlphaKeV: 0.573 },
  26: { kEdgeKeV: 7.112, kAlphaKeV: 6.404, kBetaKeV: 7.058, lAlphaKeV: 0.705 },
  27: { kEdgeKeV: 7.709, kAlphaKeV: 6.93, kBetaKeV: 7.649, lAlphaKeV: 0.776 },
  29: { kEdgeKeV: 8.979, kAlphaKeV: 8.048, kBetaKeV: 8.905, lAlphaKeV: 0.93 },
  42: { kEdgeKeV: 20.0, kAlphaKeV: 17.479, kBetaKeV: 19.608, lAlphaKeV: 2.293 },
  45: { kEdgeKeV: 23.22, kAlphaKeV: 20.216, kBetaKeV: 22.724, lAlphaKeV: 2.697 },
  47: { kEdgeKeV: 25.514, kAlphaKeV: 22.163, kBetaKeV: 24.942, lAlphaKeV: 2.984 },
  74: { kEdgeKeV: 69.525, kAlphaKeV: 59.318, kBetaKeV: 67.244, lAlphaKeV: 8.398 },
  79: { kEdgeKeV: 80.725, kAlphaKeV: 68.804, kBetaKeV: 77.984, lAlphaKeV: 9.713 },
};

/** Elementin karakteristik cizgileri. Tabloda yoksa Moseley'e duser. */
export function characteristicLines(Z: number): CharacteristicLines {
  const measured = MEASURED_LINES[Z];
  if (measured) return measured;
  const ka = moseleyKAlphaEv(Z) / 1000;
  return {
    // K kenari ~ Kbeta'nin biraz ustunde; kaba yaklasim.
    kEdgeKeV: (moseleyKBetaEv(Z) / 1000) * 1.04,
    kAlphaKeV: ka,
    kBetaKeV: moseleyKBetaEv(Z) / 1000,
    lAlphaKeV: moseleyLAlphaEv(Z) / 1000,
  };
}

/**
 * Karakteristik cizgileri surekli spektruma ekler.
 * Cizgiler SADECE tup gerilimi K kenarini gectiyse uyarilir.
 *
 * @param lineFraction esik cok uzerindeyken cizgilerin toplam foton
 *        akisindaki payi. Tungsten tuplerde %10-30 mertebesinde.
 * @returns yeni spektrum; girdi degistirilmez.
 */
export function addCharacteristicLines(
  spectrum: XraySpectrum,
  Z: number,
  tubeVoltageV: number,
  lineFraction = 0.2,
): XraySpectrum {
  const lines = characteristicLines(Z);
  const kv = tubeVoltageV / 1000;
  if (kv <= lines.kEdgeKeV) return spectrum;

  // Uyarilma verimi esigin hemen ustunde sifirdan baslar, ~2x esikte doyar.
  const overvoltage = kv / lines.kEdgeKeV;
  const strength = lineFraction * (1 - Math.exp(-2 * (overvoltage - 1)));

  const weights = Float64Array.from(spectrum.weights, (w) => w * (1 - strength));
  const bins = spectrum.energiesKeV.length;
  const dE = spectrum.endpointKeV / bins;

  // Kalfa:Kbeta yogunluk orani tipik olarak ~5:1.
  const deposit = (energyKeV: number, share: number) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(energyKeV / dE)));
    weights[idx]! += strength * share;
  };
  deposit(lines.kAlphaKeV, 5 / 6);
  deposit(lines.kBetaKeV, 1 / 6);

  return { energiesKeV: spectrum.energiesKeV, weights, endpointKeV: spectrum.endpointKeV };
}

/** Spektrumun akiyla agirliklandirilmis ortalama enerjisi, keV. */
export function meanEnergyKeV(spectrum: XraySpectrum): number {
  let sum = 0;
  for (let i = 0; i < spectrum.weights.length; i++) {
    sum += spectrum.energiesKeV[i]! * spectrum.weights[i]!;
  }
  return sum;
}
