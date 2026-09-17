/**
 * Cockcroft-Walton gerilim carpani (diyot-kondansator merdiveni).
 * PHYSICS.md bolum 1.A.
 *
 *   V_ideal = 2*N*V_tepe
 *   dV      = (I/(f*C)) * (2N^3/3 + N^2/2 - N/6)      yuk altinda dusum
 *   ripple  = (I/(f*C)) * N(N+1)/2
 *   N_opt   = sqrt(V_tepe*f*C/I)
 *
 * Ogretici nokta: dusum N ile KUPLE buyur. "Daha cok kademe = daha cok
 * gerilim" sezgisi bir noktadan sonra tersine doner; `optimalStages` tam o
 * noktayi verir. Kullanici kademe kaydiricisini cekerken cikis once yukselip
 * sonra dusmeli.
 */

export interface CockcroftWaltonParams {
  /** Kademe sayisi N. */
  readonly stages: number;
  /** Besleme tepe gerilimi V_tepe, V. */
  readonly inputPeakV: number;
  /** Surus frekansi, Hz. */
  readonly frequencyHz: number;
  /** Kademe kapasitansi, F. */
  readonly capacitanceF: number;
}

/** Yuksuz ideal cikis, V. */
export function idealOutputV(p: CockcroftWaltonParams): number {
  return 2 * p.stages * p.inputPeakV;
}

/** Yuk akimina bagli gerilim dusumu, V. */
export function voltageDropV(p: CockcroftWaltonParams, loadCurrentA: number): number {
  if (p.frequencyHz <= 0 || p.capacitanceF <= 0) return 0;
  const n = p.stages;
  const poly = (2 * n * n * n) / 3 + (n * n) / 2 - n / 6;
  return (loadCurrentA / (p.frequencyHz * p.capacitanceF)) * poly;
}

/** Tepeden tepeye dalgalanma, V. */
export function rippleV(p: CockcroftWaltonParams, loadCurrentA: number): number {
  if (p.frequencyHz <= 0 || p.capacitanceF <= 0) return 0;
  const n = p.stages;
  return (loadCurrentA / (p.frequencyHz * p.capacitanceF)) * ((n * (n + 1)) / 2);
}

/** Yuk altinda gercek cikis, V. Negatife dusemez. */
export function outputVoltageV(p: CockcroftWaltonParams, loadCurrentA: number): number {
  return Math.max(0, idealOutputV(p) - voltageDropV(p, loadCurrentA));
}

/**
 * Verilen yuk icin cikisi maksimize eden kademe sayisi (tam sayi degil).
 * `N_opt = sqrt(V_tepe*f*C/I)`. Yuksuzken Infinity.
 */
export function optimalStages(p: CockcroftWaltonParams, loadCurrentA: number): number {
  if (loadCurrentA <= 0) return Infinity;
  return Math.sqrt((p.inputPeakV * p.frequencyHz * p.capacitanceF) / loadCurrentA);
}

/**
 * Her kondansator ve diyotun gordugu gerilim stresi, V. Merdivenin her
 * elemani 2*V_tepe gorur — semada etiketlenmeli.
 */
export function componentStressV(p: CockcroftWaltonParams): number {
  return 2 * p.inputPeakV;
}

/**
 * Kademe kademe gerilim profili, V. Uzunluk = 2N (her diyot dugumu).
 * Sematik animasyonu bunu dogrudan tuketir: merdivende gerilimin nasil
 * tirmandigini gosterir.
 */
export function stageVoltageProfileV(
  p: CockcroftWaltonParams,
  loadCurrentA: number,
): Float64Array {
  const out = new Float64Array(2 * p.stages);
  const ideal = 2 * p.inputPeakV;
  const total = outputVoltageV(p, loadCurrentA);
  const idealTotal = idealOutputV(p);
  const scale = idealTotal > 0 ? total / idealTotal : 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = ideal * ((i + 1) / 2) * scale;
  }
  return out;
}

export const DEFAULT_COCKCROFT_WALTON: CockcroftWaltonParams = {
  stages: 4,
  inputPeakV: 100e3,
  frequencyHz: 50e3,
  capacitanceF: 10e-9,
};
