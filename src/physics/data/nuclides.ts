/**
 * Nuklid adlandirma, Bohr kabuk dolumu ve donusum aritmetigi.
 * DESIGN.md "Mikro gorunum" ve "Bohr modeli".
 *
 * Dil bagimsizdir: sembol ve sayi uretir. Insan okunur adlar ("tungsten",
 * "doteryum") i18n sozlugunden gelir; burada sadece anahtar uretilir.
 */

/** Z indeksli semboller. 0 = serbest notron. */
export const ELEMENT_SYMBOLS: readonly string[] = [
  'n',
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
  'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
];

export function elementSymbol(Z: number): string {
  return ELEMENT_SYMBOLS[Z] ?? `Z${Z}`;
}

export interface NuclideId {
  readonly Z: number;
  readonly A: number;
}

/** Kanonik etiket: "W-183", "H-2", "n". */
export function nuclideLabel(n: NuclideId): string {
  if (n.Z === 0) return 'n';
  return `${elementSymbol(n.Z)}-${n.A}`;
}

export function neutronCount(n: NuclideId): number {
  return n.A - n.Z;
}

/**
 * Insan okunur ad icin i18n anahtari. Hidrojen izotoplarinin ozel adi var
 * (protyum/doteryum/trityum); geri kalanlar element adi + A ile kurulur.
 * Donen sey `isotope.deuterium` gibi bir anahtar VEYA null (element adi kullan).
 */
export function specialIsotopeKey(n: NuclideId): string | null {
  if (n.Z === 1) {
    if (n.A === 1) return 'isotope.protium';
    if (n.A === 2) return 'isotope.deuterium';
    if (n.A === 3) return 'isotope.tritium';
  }
  return null;
}

/** Bohr kabuk kapasiteleri K L M N O P Q. Sadelestirilmis dolum (PhET gibi). */
export const SHELL_CAPACITY: readonly number[] = [2, 8, 18, 32, 32, 18, 8];

/** Z elektronu kabuklara sirayla dagit. Ornek: Z=6 -> [2, 4]. */
export function bohrShells(Z: number): number[] {
  const out: number[] = [];
  let left = Math.max(0, Math.floor(Z));
  for (const cap of SHELL_CAPACITY) {
    if (left <= 0) break;
    const take = Math.min(cap, left);
    out.push(take);
    left -= take;
  }
  return out;
}

// --- Donusum aritmetigi: her biri yeni bir NuclideId dondurur ---

/** (gamma,n) veya (n,2n): A bir azalir. Bolum 2'nin olayi. */
export function afterNeutronEmission(n: NuclideId): NuclideId {
  return { Z: n.Z, A: n.A - 1 };
}

/** (n,gamma) yakalama: A bir artar. Bolum 3'un olayi; Th-232 -> Th-233. */
export function afterNeutronCapture(n: NuclideId): NuclideId {
  return { Z: n.Z, A: n.A + 1 };
}

/** beta-: notron protona doner, Z bir artar. Th-233 -> Pa-233. */
export function afterBetaMinus(n: NuclideId): NuclideId {
  return { Z: n.Z + 1, A: n.A };
}

/** beta+ / elektron yakalama: Z bir azalir. */
export function afterBetaPlus(n: NuclideId): NuclideId {
  return { Z: n.Z - 1, A: n.A };
}

/** alfa: Z-2, A-4. */
export function afterAlpha(n: NuclideId): NuclideId {
  return { Z: n.Z - 2, A: n.A - 4 };
}

/**
 * Bir olay zincirini etiket dizisine cevirir; UI "W-184 -> W-183" yazar.
 */
export function transitionLabel(from: NuclideId, to: NuclideId): string {
  return `${nuclideLabel(from)} → ${nuclideLabel(to)}`;
}

/**
 * En bol dogal izotopun kutle numarasi (Bohr cekirdegi cizerken N icin).
 * Tabloda olmayan Z icin element tablosundaki ortalama kutle yuvarlanir.
 */
const MOST_ABUNDANT_A: Record<number, number> = {
  1: 1, 2: 4, 3: 7, 4: 9, 5: 11, 6: 12, 7: 14, 8: 16, 10: 20, 11: 23, 12: 24,
  13: 27, 14: 28, 16: 32, 18: 40, 22: 48, 24: 52, 26: 56, 27: 59, 28: 58,
  29: 63, 30: 64, 42: 98, 47: 107, 48: 114, 49: 115, 50: 120, 73: 181,
  74: 184, 78: 195, 79: 197, 80: 202, 82: 208, 83: 209, 90: 232, 92: 238,
};

export function mostAbundantA(Z: number, fallbackMass?: number): number {
  const a = MOST_ABUNDANT_A[Z];
  if (a !== undefined) return a;
  if (fallbackMass !== undefined) return Math.round(fallbackMass);
  return 2 * Z;
}
