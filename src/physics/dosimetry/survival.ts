/**
 * Hucre hayatta kalma, DNA hasari ve LET-RBE iliskisi.
 * PHYSICS.md bolum 1.J. EGITIM AMACLIDIR (bkz. dose.ts uyarisi).
 *
 *   S(D) = exp(-alpha*D - beta*D^2)        Lineer-Kuadratik
 *   BED  = D*(1 + D/(alpha/beta))
 *
 * Bolum 3'teki hucre yakin plani bu modulun ciktisini cizer. Kritik gorsel
 * ayrim: DUSUK LET (X-isini) dagimik tekil kiriklar uretir; YUKSEK LET (alfa,
 * notron) iz boyunca KUMELENMIS cift kiriklar uretir. Ayni dozda, ayni joule
 * — ama onarilabilirlik bambaska. w_R tablosunun gorsel karsiligi budur.
 */

/** Lineer-Kuadratik hayatta kalma kesri. */
export function survivalLQ(doseGy: number, alpha: number, beta: number): number {
  if (doseGy <= 0) return 1;
  return Math.exp(-alpha * doseGy - beta * doseGy * doseGy);
}

/** Verilen hayatta kalma kesrine karsilik gelen doz, Gy (LQ tersi). */
export function doseForSurvivalGy(survival: number, alpha: number, beta: number): number {
  if (survival >= 1) return 0;
  if (survival <= 0) return Infinity;
  const target = -Math.log(survival);
  if (beta <= 0) return target / alpha;
  // beta*D^2 + alpha*D - target = 0
  return (-alpha + Math.sqrt(alpha * alpha + 4 * beta * target)) / (2 * beta);
}

/** Biyolojik etkin doz BED, Gy. */
export function biologicallyEffectiveDoseGy(doseGy: number, alphaBetaRatioGy: number): number {
  if (alphaBetaRatioGy <= 0) return doseGy;
  return doseGy * (1 + doseGy / alphaBetaRatioGy);
}

/** Tipik LQ parametreleri. alpha/beta: erken yanit 10 Gy, gec yanit 3 Gy. */
export const LQ_PRESETS = {
  earlyResponding: { alpha: 0.3, beta: 0.03, alphaBetaGy: 10 },
  lateResponding: { alpha: 0.15, beta: 0.05, alphaBetaGy: 3 },
  radioresistant: { alpha: 0.1, beta: 0.02, alphaBetaGy: 5 },
} as const;

/** Dusuk LET icin Gy basina, hucre basina DNA hasari sayilari. */
export const DNA_DAMAGE_PER_GY = {
  /** Tek zincir kirigi. */
  singleStrandBreaks: 1000,
  /** Cift zincir kirigi — hucre olumunun ana surucusu. */
  doubleStrandBreaks: 35,
  /** Baz hasari. */
  baseDamage: 2000,
  /** DNA-protein capraz bagi. */
  crosslinks: 150,
} as const;

/**
 * LET'e bagli RBE. ~100 keV/um'de tepe yapar, sonra "overkill" ile duser:
 * daha yogun iyonlasma ayni hucreye gereginden fazla enerji birakir, ek
 * oldurme getirmez.
 *
 * Ampirik lognormal uyum; deneysel egriler endpoint'e gore 2-8 arasinda
 * degisir, burada %10 hayatta kalma endpoint'i icin RBE_max = 3.5 alinmistir.
 */
export function rbeFromLet(letKeVPerUm: number, rbeMax = 3.5, peakLet = 100, width = 1.2): number {
  if (letKeVPerUm <= 0) return 1;
  const l = Math.log(letKeVPerUm / peakLet);
  return 1 + (rbeMax - 1) * Math.exp(-(l * l) / (2 * width * width));
}

/**
 * Kumelenmis (karmasik) DSB kesri. Dusuk LET'te ~0.3, yuksek LET'te ~0.9'a
 * doyar. Animasyonda hasar noktalarinin dagimik mi yoksa iz boyunca yogun mu
 * cizilecegini bu belirler.
 */
export function clusteredDamageFraction(letKeVPerUm: number): number {
  if (letKeVPerUm <= 0) return 0.3;
  return 0.3 + 0.6 * (1 - Math.exp(-letKeVPerUm / 40));
}

export interface DamageProfile {
  readonly singleStrandBreaks: number;
  readonly doubleStrandBreaks: number;
  readonly baseDamage: number;
  readonly crosslinks: number;
  /** DSB'lerin kumelenmis olan kesri, 0..1. */
  readonly clusteredFraction: number;
  readonly rbe: number;
  /** RBE ile olceklenmis etkin doz, Gy. */
  readonly effectiveDoseGy: number;
}

/** Bir doz + LET ikilisi icin hasar profili. */
export function damageProfile(doseGy: number, letKeVPerUm: number): DamageProfile {
  const rbe = rbeFromLet(letKeVPerUm);
  // Yuksek LET ayni dozda DAHA AZ ama daha agir iz uretir: iz basina enerji
  // buyudugu icin toplam olay sayisi LET ile ters orantili olcekler.
  const trackScale = 1 / (1 + letKeVPerUm / 20);
  return {
    singleStrandBreaks: DNA_DAMAGE_PER_GY.singleStrandBreaks * doseGy * trackScale,
    doubleStrandBreaks: DNA_DAMAGE_PER_GY.doubleStrandBreaks * doseGy * rbe,
    baseDamage: DNA_DAMAGE_PER_GY.baseDamage * doseGy * trackScale,
    crosslinks: DNA_DAMAGE_PER_GY.crosslinks * doseGy,
    clusteredFraction: clusteredDamageFraction(letKeVPerUm),
    rbe,
    effectiveDoseGy: doseGy * rbe,
  };
}

/**
 * Cok hedefli tek vurus modeli: `S = 1 - (1 - exp(-D/D0))^n`.
 * LQ'nun alternatifi; dusuk dozda "omuz" davranisini farkli tariflar.
 */
export function survivalMultiTarget(doseGy: number, d0Gy: number, n: number): number {
  if (d0Gy <= 0) return 0;
  return 1 - Math.pow(1 - Math.exp(-doseGy / d0Gy), n);
}
