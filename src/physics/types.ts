/**
 * Bolumler arasi akan ortak tipler. PHYSICS.md bolum 3 "Bolumler arasi sozlesme".
 *
 * Kural: Bolum 1 -> 2 -> 3 arasinda SADECE `BeamPacket` akar. Bir asama paket
 * alir, paket dondurur. Yeni bir parcacik turu eklemek `ParticleSpecies`'i
 * genisletmekten ibarettir; TypeScript switch tamlik denetimi eksik kalan
 * yerleri derleme zamaninda gosterir.
 *
 * Tamami `structuredClone` uyumludur: sinif yok, fonksiyon yok, Symbol yok.
 * Boylece worker sinirindan degistirilmeden gecer.
 */

export type ParticleSpecies =
  | 'electron'
  | 'positron'
  | 'proton'
  | 'deuteron'
  | 'alpha'
  | 'neutron'
  | 'photon'
  | 'ion';

/** 1: elektrik kaynagi, 2: etkilesim hucresi, 3: sonuc/downstream. */
export type StageId = 1 | 2 | 3;

export interface Nuclide {
  readonly Z: number;
  readonly A: number;
  /** Izomerik durum; 0/undefined taban durum. */
  readonly isomer?: number;
}

/** Paylasilan log-enerji izgaralarinin kimligi. Histogramlar bunlara dayanir. */
export type EnergyGridId = 'log_1keV_20MeV_128' | 'log_1meV_20MeV_100g';

/**
 * Enerji dagilimi. Uc temsil, hepsi birbirine cevrilebilir (beam/spectrum.ts).
 * - `mono`: elektrostatik hizlandirici cikisi.
 * - `histogram`: bin basina GERCEK parcacik/s; toplami bilesenin rate'ine esit.
 * - `analytic`: kapali form; ornekleme uretici fonksiyonla yapilir.
 */
export type EnergySpectrum =
  | { readonly kind: 'mono'; readonly energyMeV: number; readonly spreadFrac: number }
  | {
      readonly kind: 'histogram';
      readonly gridId: EnergyGridId;
      /** Uzunluk = izgara bin sayisi. Birim: parcacik/s. */
      readonly binRate: Float64Array;
    }
  | {
      readonly kind: 'analytic';
      readonly model: 'kramers' | 'maxwellian' | 'watt' | 'betaAllowed' | 'evaporation';
      readonly endpointMeV: number;
      readonly params: Readonly<Record<string, number>>;
    };

/**
 * Demetin tek turden bileseni. Bir paket birden cok bilesen tasir: Bolum 2
 * ayni anda bremsstrahlung fotonu + sacilmis elektron + fotonotron uretir.
 */
export interface BeamComponent {
  readonly species: ParticleSpecies;
  readonly nuclide?: Nuclide;
  readonly chargeStateE?: number;
  /** GERCEK parcacik/s. Tum telemetrinin kaynagi; makro-parcacik degil. */
  readonly ratePerS: number;
  readonly spectrum: EnergySpectrum;
  /** Turetilmis ama onbelleklenmis; her tuketici yeniden hesaplamasin. */
  readonly meanEnergyMeV: number;
  readonly powerW: number;
  /** Yuksuz turler icin 0. */
  readonly currentA: number;
  /** UI etiketi: "bremsstrahlung", "fotonotron", "sacilan elektron". */
  readonly label?: string;
}

export interface BeamOptics {
  readonly originM: readonly [number, number, number];
  /** Birim vektor. Izotropik yayilimda anlamsizdir (solidAngleSr = 4*pi). */
  readonly direction: readonly [number, number, number];
  readonly sigmaXMm: number;
  readonly sigmaYMm: number;
  readonly divergenceMrad: number;
  readonly emittanceMmMrad: number;
  /** Ikincil isinim icin 4*pi; kolimeli demet icin kucuk. */
  readonly solidAngleSr: number;
}

export type TemporalStructure =
  | { readonly kind: 'cw' }
  | {
      readonly kind: 'pulsed';
      readonly pulseWidthS: number;
      readonly repRateHz: number;
      readonly dutyCycle: number;
    }
  | { readonly kind: 'single'; readonly tStartS: number; readonly pulseWidthS: number };

export interface BeamPacket {
  readonly schemaVersion: 1;
  readonly id: string;
  /** Bolum 3 buna DEGIL, components[].species'e bakar. Tani icin tasinir. */
  readonly producedBy: { readonly stage: StageId; readonly deviceId: string };
  readonly simTimeS: number;
  readonly components: readonly BeamComponent[];
  readonly optics: BeamOptics;
  readonly temporal: TemporalStructure;
  /** Bilesenlerden turetilir; tutarlilik testi bunu dogrular. */
  readonly totals: {
    readonly powerW: number;
    readonly currentA: number;
    readonly ratePerS: number;
  };
  /**
   * Genisletme kapisi: deneysel cihazlar `any` kullanmadan ek bilgi tasir.
   * Anahtar 'saglayici.ozellik' formatinda; bilinmeyen anahtar yok sayilir.
   */
  readonly ext?: Readonly<Record<string, Readonly<Record<string, number | string | boolean>>>>;
}

/** Bos paket: hicbir sey yayilmiyor. Zincirin baslangic/kesinti degeri. */
export const EMPTY_TOTALS = { powerW: 0, currentA: 0, ratePerS: 0 } as const;

/** Bilesenlerden toplamlari turetir. Paket kurarken her zaman bununla doldurun. */
export function deriveTotals(components: readonly BeamComponent[]): BeamPacket['totals'] {
  let powerW = 0;
  let currentA = 0;
  let ratePerS = 0;
  for (const c of components) {
    powerW += c.powerW;
    currentA += c.currentA;
    ratePerS += c.ratePerS;
  }
  return { powerW, currentA, ratePerS };
}
