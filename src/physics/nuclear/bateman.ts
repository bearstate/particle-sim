/**
 * Bozunma zinciri cozucu. PHYSICS.md bolum 1.H.
 *
 * KLASIK BATEMAN FORMULU BURADA KULLANILMAZ. Kapali form
 *   N_n(t) = N1(0)*prod(lambda_i)*sum_i e^(-lambda_i t)/prod_{j!=i}(lambda_j - lambda_i)
 * iki lambda birbirine yaklastiginda paydayi sifira gonderir ve sayisal olarak
 * patlar. Th-233 (21.8 dk) / Pa-233 (27 gun) gibi cok ayrik yari omurlerde
 * sorun cikmaz ama kullanici serbestce nuklid secebildigi icin yakin ciftler
 * KACINILMAZDIR.
 *
 * Yerine zincir matrisinin USTELI alinir: dN/dt = A*N, cozum N(t) = e^(At)*N0.
 * Olcekle-ve-kare-al + Pade(6) yontemi her lambda dagilimi icin kararlidir,
 * dallanmayi (branching) dogal olarak destekler ve t ne kadar buyurse
 * buyusun bozulmaz. Zincirler <30 nuklid oldugu icin maliyet onemsizdir.
 *
 * Bu, zaman olcegini 1x'ten 10^9x'e cekmenin dogrulugu neden hic bozmadiginin
 * da cevabidir: adim atmiyoruz, t'yi dogrudan degerlendiriyoruz.
 */

export interface ChainNode {
  /** Gosterim/tanilama icin etiket, or. 'Th-233'. */
  readonly id: string;
  /** Bozunma sabiti, 1/s. Kararli nuklid icin 0. */
  readonly lambda: number;
  /**
   * Bu nuklidin bozunma urunleri: hedef indeksi ve dallanma orani.
   * Oranlarin toplami 1'i gecmemelidir; eksik kalan kisim zincirden cikar
   * (or. modellenmeyen bir dal).
   */
  readonly branches: readonly { readonly to: number; readonly fraction: number }[];
}

/**
 * Zincir gecis matrisi A'yi kurar (sutun-oncelikli duz dizi, n x n).
 * `A[i][j]` = j'den i'ye akis. Kosegen -lambda_i.
 */
export function buildMatrix(nodes: readonly ChainNode[]): Float64Array {
  const n = nodes.length;
  const a = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const node = nodes[j]!;
    a[j * n + j] = -node.lambda;
    for (const b of node.branches) {
      if (b.to >= 0 && b.to < n) {
        a[b.to * n + j] += node.lambda * b.fraction;
      }
    }
  }
  return a;
}

function matmul(a: Float64Array, b: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = a[i * n + k]!;
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) {
        out[i * n + j]! += aik * b[k * n + j]!;
      }
    }
  }
  return out;
}

function identity(n: number): Float64Array {
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) m[i * n + i] = 1;
  return m;
}

/** Sonsuz norm ||A||_inf. */
function infNorm(a: Float64Array, n: number): number {
  let max = 0;
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) row += Math.abs(a[i * n + j]!);
    if (row > max) max = row;
  }
  return max;
}

/**
 * Matris usteli e^(A*t), olcekle-ve-kare-al + 6. derece Taylor.
 * Zincir matrisleri kucuk ve alt-ikikosegen oldugu icin Taylor yeterli;
 * olcekleme ||A*t/2^s|| <= 0.5 garantisi verir.
 */
export function expm(a: Float64Array, n: number, tS: number): Float64Array {
  if (n === 0) return new Float64Array(0);
  const scaled = new Float64Array(n * n);
  for (let i = 0; i < a.length; i++) scaled[i] = a[i]! * tS;

  const norm = infNorm(scaled, n);
  let s = 0;
  if (norm > 0.5) s = Math.ceil(Math.log2(norm / 0.5));
  if (s > 0) {
    const f = Math.pow(2, -s);
    for (let i = 0; i < scaled.length; i++) scaled[i]! *= f;
  }

  // Taylor: I + X + X^2/2! + ... + X^9/9!
  let result = identity(n);
  let term = identity(n);
  for (let k = 1; k <= 9; k++) {
    term = matmul(term, scaled, n);
    for (let i = 0; i < term.length; i++) term[i]! /= k;
    for (let i = 0; i < result.length; i++) result[i]! += term[i]!;
  }

  for (let i = 0; i < s; i++) result = matmul(result, result, n);
  return result;
}

/**
 * Zinciri t aninda cozer. `initial` ve donen dizi nuklid SAYILARIDIR (atom).
 * Hicbir adim atilmaz; t dogrudan degerlendirilir.
 */
export function solveAt(
  nodes: readonly ChainNode[],
  initial: readonly number[] | Float64Array,
  tS: number,
): Float64Array {
  const n = nodes.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const e = expm(buildMatrix(nodes), n, tS);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += e[i * n + j]! * (initial[j] ?? 0);
    out[i] = sum;
  }
  return out;
}

/** Her nuklidin t anindaki aktivitesi, Bq. */
export function activitiesAt(
  nodes: readonly ChainNode[],
  initial: readonly number[] | Float64Array,
  tS: number,
): Float64Array {
  const populations = solveAt(nodes, initial, tS);
  const out = new Float64Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) out[i] = nodes[i]!.lambda * populations[i]!;
  return out;
}

/**
 * Klasik Bateman kapali formu. YALNIZCA TEST/DOGRULAMA icindir: matris
 * ustelinin dogrulugunu ayrik lambda'li zincirlerde kontrol etmeye yarar.
 * Yakin lambda'larda kasitli olarak NaN/Infinity uretebilir.
 */
export function batemanClosedForm(lambdas: readonly number[], n0: number, tS: number): number {
  const n = lambdas.length;
  if (n === 0) return 0;
  let prod = 1;
  for (let i = 0; i < n - 1; i++) prod *= lambdas[i]!;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    let denom = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) denom *= lambdas[j]! - lambdas[i]!;
    }
    sum += Math.exp(-lambdas[i]! * tS) / denom;
  }
  return n0 * prod * sum;
}
