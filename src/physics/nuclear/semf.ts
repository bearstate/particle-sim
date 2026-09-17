/**
 * Weizsacker yari-ampirik kutle formulu (SEMF). PHYSICS.md bolum 1.H.
 *
 *   B = a_V*A - a_S*A^(2/3) - a_C*Z(Z-1)/A^(1/3) - a_A*(A-2Z)^2/A + delta
 *
 * Simulasyonda iki isi var:
 *  1. Baglanma enerjisi egrisini cizmek (Fe-56 zirvesi).
 *  2. Olculmus tablo bulunmayan cekirdekler icin notron ayrilma enerjisi
 *     S_n = B(A,Z) - B(A-1,Z) kestirmek. Bu, ad hoc bir tahmin degil;
 *     fizikten turetilmis bir yedektir ve tipik olarak +-1 MeV isabet eder.
 */

export const SEMF_COEFFICIENTS = {
  volume: 15.75,
  surface: 17.8,
  coulomb: 0.711,
  asymmetry: 23.7,
  pairing: 11.18,
} as const;

/** Ciftlenme terimi delta, MeV. Cift-cift +, tek-tek -, tek A icin 0. */
export function pairingTermMeV(Z: number, A: number): number {
  const N = A - Z;
  const evenZ = Z % 2 === 0;
  const evenN = N % 2 === 0;
  if (evenZ !== evenN) return 0; // tek A
  const magnitude = SEMF_COEFFICIENTS.pairing / Math.sqrt(A);
  return evenZ ? magnitude : -magnitude;
}

/** Toplam baglanma enerjisi B(A,Z), MeV. */
export function bindingEnergyMeV(Z: number, A: number): number {
  if (A <= 0 || Z < 0 || Z > A) return 0;
  const c = SEMF_COEFFICIENTS;
  return (
    c.volume * A -
    c.surface * Math.pow(A, 2 / 3) -
    (c.coulomb * Z * (Z - 1)) / Math.pow(A, 1 / 3) -
    (c.asymmetry * (A - 2 * Z) * (A - 2 * Z)) / A +
    pairingTermMeV(Z, A)
  );
}

/** Nukleon basina baglanma enerjisi, MeV. Fe-56 civarinda ~8.8 MeV zirve yapar. */
export function bindingEnergyPerNucleonMeV(Z: number, A: number): number {
  if (A <= 0) return 0;
  return bindingEnergyMeV(Z, A) / A;
}

/**
 * Notron ayrilma enerjisi S_n = B(A,Z) - B(A-1,Z), MeV.
 * SEMF kestirimi; olculmus deger varsa DAIMA o tercih edilmelidir.
 *
 * Ciftlenme terimi sayesinde cift-N cekirdeklerin S_n'inin tek-N olanlardan
 * belirgin yuksek oldugu (~2 MeV) dogal olarak cikar — fotonotron esiginin
 * izotoptan izotopa neden ziplakadigi budur.
 */
export function neutronSeparationEnergyMeV(Z: number, A: number): number {
  return bindingEnergyMeV(Z, A) - bindingEnergyMeV(Z, A - 1);
}

/** Proton ayrilma enerjisi S_p, MeV. */
export function protonSeparationEnergyMeV(Z: number, A: number): number {
  return bindingEnergyMeV(Z, A) - bindingEnergyMeV(Z - 1, A - 1);
}

/** Alfa ayrilma enerjisi (Q_alfa'nin isareti ters), MeV. */
export function alphaSeparationEnergyMeV(Z: number, A: number): number {
  return bindingEnergyMeV(Z, A) - bindingEnergyMeV(Z - 2, A - 4) - 28.296;
}
