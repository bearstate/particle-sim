/**
 * Marx jeneratoru. PHYSICS.md bolum 1.A.
 *
 * N kademe paralel sarj olur, kivilcim araliklari zincirleme ateslenince
 * seri baglanir ("erection"):
 *   V_ideal  = N * V0
 *   C_erect  = C / N          (enerji ayni, gerilim N kat)
 *   U        = 0.5 * N * C * V0^2
 *   eta      = C_erect / (C_erect + C_yuk)
 *
 * Cikis dalga sekli cift usteldir; standart yildirim darbesi 1.2/50 us.
 */

export interface MarxParams {
  /** Kademe sayisi N. */
  readonly stages: number;
  /** Kademe basina sarj gerilimi V0, V. */
  readonly stageVoltageV: number;
  /** Kademe kapasitansi C, F. */
  readonly stageCapacitanceF: number;
  /** Yuk (burden) kapasitansi, F. */
  readonly loadCapacitanceF: number;
  /** Dalga cephesi direnci, ohm. */
  readonly frontResistanceOhm: number;
  /** Dalga kuyrugu direnci, ohm. */
  readonly tailResistanceOhm: number;
}

/** Yuksuz ideal cikis, V. */
export function idealOutputV(p: MarxParams): number {
  return p.stages * p.stageVoltageV;
}

/** Ayaga kalkmis (seri) kapasitans, F. */
export function erectedCapacitanceF(p: MarxParams): number {
  return p.stageCapacitanceF / p.stages;
}

/** Depolanan toplam enerji, J. Seri baglama enerjiyi ARTIRMAZ, sadece gerilimi. */
export function storedEnergyJ(p: MarxParams): number {
  return 0.5 * p.stages * p.stageCapacitanceF * p.stageVoltageV * p.stageVoltageV;
}

/** Gerilim verimi eta = C_erect/(C_erect + C_yuk). Tipik 0.85 - 0.95. */
export function voltageEfficiency(p: MarxParams): number {
  const ce = erectedCapacitanceF(p);
  return ce / (ce + p.loadCapacitanceF);
}

/** Yuk altinda gercek tepe cikisi, V. */
export function peakOutputV(p: MarxParams): number {
  return idealOutputV(p) * voltageEfficiency(p);
}

/** Cephe suresi T1, s. `T1 ~ 3*R_on*C_esdeger`. */
export function frontTimeS(p: MarxParams): number {
  const ce = erectedCapacitanceF(p);
  const cEq = (ce * p.loadCapacitanceF) / (ce + p.loadCapacitanceF);
  return 3 * p.frontResistanceOhm * cEq;
}

/** Kuyruk (yariya dusme) suresi T2, s. `T2 ~ 0.7*R_kuyruk*(C_erect + C_yuk)`. */
export function tailTimeS(p: MarxParams): number {
  return 0.7 * p.tailResistanceOhm * (erectedCapacitanceF(p) + p.loadCapacitanceF);
}

/** Standart 1.2/50 us yildirim darbesi katsayilari. */
export const LIGHTNING_IMPULSE_1_2_50 = {
  /** Kuyruk sonum sabiti alpha, 1/s. */
  alpha: 1.4667e4,
  /** Cephe sonum sabiti beta, 1/s. */
  beta: 2.467e6,
  /** Tepeyi V0'a normalize eden carpan. */
  k: 1.0372,
} as const;

export interface ImpulseShape {
  readonly alpha: number;
  readonly beta: number;
  readonly k: number;
}

/**
 * Cift ustel darbe: `V(t) = V_tepe * k * (e^(-alpha*t) - e^(-beta*t))`.
 * t < 0 icin 0.
 */
export function impulseVoltageV(
  tS: number,
  peakV: number,
  shape: ImpulseShape = LIGHTNING_IMPULSE_1_2_50,
): number {
  if (tS <= 0) return 0;
  return peakV * shape.k * (Math.exp(-shape.alpha * tS) - Math.exp(-shape.beta * tS));
}

/** Darbenin tepe yaptigi an, s. `t_p = ln(beta/alpha)/(beta - alpha)`. */
export function peakTimeS(shape: ImpulseShape = LIGHTNING_IMPULSE_1_2_50): number {
  return Math.log(shape.beta / shape.alpha) / (shape.beta - shape.alpha);
}

/**
 * Kivilcim araliklarinin zincirleme atesleme suresi, s. Ilk aralik tetiklenince
 * sonrakiler ~ns mertebesinde ardisik delinir; gorsel bu gecikmeyi gostermeli.
 */
export function erectionTimeS(p: MarxParams, perGapNs = 20): number {
  return (p.stages * perGapNs) * 1e-9;
}

export const DEFAULT_MARX: MarxParams = {
  stages: 10,
  stageVoltageV: 100e3,
  stageCapacitanceF: 100e-9,
  loadCapacitanceF: 1e-9,
  frontResistanceOhm: 400,
  tailResistanceOhm: 5000,
};
