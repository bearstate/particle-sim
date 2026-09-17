/**
 * Foton etkilesimleri: fotoelektrik, Compton, cift olusumu, zayiflama.
 * PHYSICS.md bolum 1.E.
 *
 * DURUSTLUK NOTU: Bu modulun uc bileseninden yalnizca Compton ANALITIK OLARAK
 * KESINDIR (Klein-Nishina). Fotoelektrik tesir kesitinin kapali formu yoktur:
 * K/L/M kenarlarindaki sicramalar hicbir duz `Z^n/E^3` ifadesiyle yakalanamaz
 * (Pb'de 88 keV K kenari tesir kesitini bir anda ~5 kat zipratir). Buradaki
 * analitik fotoelektrik ifadesi SADECE veri hatti XCOM tablolarini getirene
 * kadar gecerli bir yer tutucudur ve mertebe dogrulugundadir.
 *
 * Bu yuzden modul LUT-ONCELIKLI tasarlanmistir: `PhotonCrossSectionSource`
 * saglanirsa daima o kullanilir, yoksa analitik yedege dusulur.
 */

import { CLASSICAL_ELECTRON_RADIUS, ELECTRON_MASS_MEV, AVOGADRO, M2_TO_BARN, COMPTON_WAVELENGTH } from '../constants.ts';

/** Thomson tesir kesiti, barn/elektron. `sigma_T = (8/3)*pi*r_e^2`. */
export const THOMSON_BARN = (8 / 3) * Math.PI * CLASSICAL_ELECTRON_RADIUS * CLASSICAL_ELECTRON_RADIUS * M2_TO_BARN;

/** Cift olusumu esigi, MeV. */
export const PAIR_THRESHOLD_MEV = 2 * ELECTRON_MASS_MEV;

/**
 * Klein-Nishina toplam tesir kesiti, barn/elektron. KESIN.
 * eps = E/(m_e*c^2).
 */
export function kleinNishinaBarn(energyMeV: number): number {
  const eps = energyMeV / ELECTRON_MASS_MEV;
  if (eps <= 0) return THOMSON_BARN;
  if (eps < 1e-4) {
    // Kucuk eps'te seri acilim; dogrudan formul sadelesme kaybina girer.
    return THOMSON_BARN * (1 - 2 * eps + 5.2 * eps * eps);
  }
  const r2 = CLASSICAL_ELECTRON_RADIUS * CLASSICAL_ELECTRON_RADIUS;
  const a = 1 + 2 * eps;
  const lnA = Math.log(a);
  const term1 = ((1 + eps) / (eps * eps)) * ((2 * (1 + eps)) / a - lnA / eps);
  const term2 = lnA / (2 * eps);
  const term3 = (1 + 3 * eps) / (a * a);
  return 2 * Math.PI * r2 * (term1 + term2 - term3) * M2_TO_BARN;
}

/** Compton sacilmasi sonrasi foton enerjisi, MeV. KESIN. */
export function comptonScatteredEnergyMeV(energyMeV: number, thetaRad: number): number {
  const eps = energyMeV / ELECTRON_MASS_MEV;
  return energyMeV / (1 + eps * (1 - Math.cos(thetaRad)));
}

/** Compton dalga boyu kaymasi, m. `dLambda = lambda_C*(1 - cos theta)`. KESIN. */
export function comptonWavelengthShiftM(thetaRad: number): number {
  return COMPTON_WAVELENGTH * (1 - Math.cos(thetaRad));
}

/** Geri tepen elektronun kinetik enerjisi, MeV. */
export function comptonElectronEnergyMeV(energyMeV: number, thetaRad: number): number {
  return energyMeV - comptonScatteredEnergyMeV(energyMeV, thetaRad);
}

/** Compton kenari: elektronun alabilecegi azami enerji (theta = pi), MeV. */
export function comptonEdgeMeV(energyMeV: number): number {
  return comptonElectronEnergyMeV(energyMeV, Math.PI);
}

/**
 * Fotoelektrik tesir kesiti, barn/atom. YAKLASIK — kabuk kenarlari YOK.
 * `tau ~ C * Z^4.5 / E_keV^3`, C kurşun/bakir ortalamasina kabaca oturtulmus.
 *
 * Kenar yapisi olmadigi icin bir kenarin hemen ustunde 5 kata kadar dusuk,
 * hemen altinda ayni oranda yuksek olabilir. Spektrum filtreleme ve kalkan
 * hesaplarinda XCOM tablosu gelene kadar sonuclar niteldir.
 */
export function photoelectricBarnApprox(Z: number, energyMeV: number): number {
  const eKeV = energyMeV * 1000;
  if (eKeV <= 0) return 0;
  return (1.0 * Math.pow(Z, 4.5)) / (eKeV * eKeV * eKeV);
}

/**
 * Cift olusumu tesir kesiti, barn/atom. YAKLASIK.
 * Esigin uzerinde `sigma ~ a*Z^2*ln(E/E_esik)`, yuksek enerjide `(7/9)*A/(N_A*X0)`
 * degerine doyar.
 */
export function pairProductionBarnApprox(Z: number, energyMeV: number): number {
  if (energyMeV <= PAIR_THRESHOLD_MEV) return 0;
  const x = Math.log(energyMeV / PAIR_THRESHOLD_MEV);
  return 0.0089 * Z * Z * x * x / (1 + 0.12 * x * x);
}

/** Bir atomun tum kanallarinin toplami, barn/atom (yaklasik). */
export function totalCrossSectionBarnApprox(Z: number, energyMeV: number): number {
  return (
    photoelectricBarnApprox(Z, energyMeV) +
    Z * kleinNishinaBarn(energyMeV) +
    pairProductionBarnApprox(Z, energyMeV)
  );
}

/**
 * Tesir kesiti kaynagi soyutlamasi. Veri hatti XCOM tablosunu getirdiginde
 * bunu uygulayan bir nesne enjekte edilir ve analitik yedek devre disi kalir.
 */
export interface PhotonCrossSectionSource {
  /** barn/atom. */
  totalBarn(Z: number, energyMeV: number): number;
}

/**
 * Kutle zayiflatma katsayisi mu/rho, cm^2/g.
 * `mu/rho = sigma[cm^2/atom] * N_A / A`
 */
export function massAttenuationCm2PerG(
  Z: number,
  A: number,
  energyMeV: number,
  source?: PhotonCrossSectionSource,
): number {
  if (A <= 0) return 0;
  const barn = source ? source.totalBarn(Z, energyMeV) : totalCrossSectionBarnApprox(Z, energyMeV);
  const cm2PerAtom = barn * 1e-24;
  return (cm2PerAtom * AVOGADRO) / A;
}

/** Dogrusal zayiflatma katsayisi mu, 1/cm. */
export function linearAttenuationPerCm(
  Z: number,
  A: number,
  densityGPerCm3: number,
  energyMeV: number,
  source?: PhotonCrossSectionSource,
): number {
  return massAttenuationCm2PerG(Z, A, energyMeV, source) * densityGPerCm3;
}

/** Zayiflatma: `I/I0 = exp(-mu*x)`. */
export function transmission(muPerCm: number, thicknessCm: number): number {
  return Math.exp(-muPerCm * thicknessCm);
}

/** Yari deger kalinligi HVL, cm. `HVL = ln2/mu`. */
export function halfValueLayerCm(muPerCm: number): number {
  if (muPerCm <= 0) return Infinity;
  return Math.LN2 / muPerCm;
}

/** Onda bir deger kalinligi TVL, cm. */
export function tenthValueLayerCm(muPerCm: number): number {
  if (muPerCm <= 0) return Infinity;
  return Math.log(10) / muPerCm;
}

/**
 * Bir spektrumun tamamini bir filtreden gecirir; her bin kendi enerjisinde
 * zayiflar. Spektrumun SERTLESMESI (beam hardening) burada dogal olarak
 * ortaya cikar: dusuk enerjiler daha cok soğurulur, ortalama enerji yukselir.
 */
export function filterTransmissionFn(
  Z: number,
  A: number,
  densityGPerCm3: number,
  thicknessCm: number,
  source?: PhotonCrossSectionSource,
): (energyKeV: number) => number {
  return (energyKeV: number) => {
    const mu = linearAttenuationPerCm(Z, A, densityGPerCm3, energyKeV / 1000, source);
    return transmission(mu, thicknessCm);
  };
}
