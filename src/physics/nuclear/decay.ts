/**
 * Temel bozunma yasasi ve aktivite. PHYSICS.md bolum 1.H.
 *
 *   lambda = ln2 / T_yari
 *   N(t)   = N0 * exp(-lambda*t)
 *   A      = lambda * N          [Bq]
 */

import { CURIE_TO_BQ, DAY_S, YEAR_S } from '../constants.ts';

/** Bozunma sabiti lambda, 1/s. Kararli nuklid icin 0. */
export function decayConstant(halfLifeS: number): number {
  if (!Number.isFinite(halfLifeS) || halfLifeS <= 0) return 0;
  return Math.LN2 / halfLifeS;
}

/** Yari omur, s. lambda = 0 (kararli) icin Infinity. */
export function halfLifeFromLambda(lambda: number): number {
  if (lambda <= 0) return Infinity;
  return Math.LN2 / lambda;
}

/** Ortalama omur tau = 1/lambda, s. */
export function meanLifetimeS(halfLifeS: number): number {
  const l = decayConstant(halfLifeS);
  return l > 0 ? 1 / l : Infinity;
}

/** Kalan cekirdek sayisi. */
export function remaining(n0: number, halfLifeS: number, tS: number): number {
  return n0 * Math.exp(-decayConstant(halfLifeS) * tS);
}

/** Aktivite A = lambda*N, Bq. */
export function activityBq(n: number, halfLifeS: number): number {
  return decayConstant(halfLifeS) * n;
}

/** Aktiviteden cekirdek sayisina. */
export function atomsFromActivity(activityBqValue: number, halfLifeS: number): number {
  const l = decayConstant(halfLifeS);
  return l > 0 ? activityBqValue / l : 0;
}

export function bqToCurie(bq: number): number {
  return bq / CURIE_TO_BQ;
}

export function curieToBq(ci: number): number {
  return ci * CURIE_TO_BQ;
}

/** Insan okunakli yari omur metni icin uygun birim ve deger. */
export function formatHalfLife(halfLifeS: number): { value: number; unit: 's' | 'min' | 'h' | 'd' | 'y' } {
  if (!Number.isFinite(halfLifeS)) return { value: Infinity, unit: 'y' };
  if (halfLifeS < 120) return { value: halfLifeS, unit: 's' };
  if (halfLifeS < 7200) return { value: halfLifeS / 60, unit: 'min' };
  if (halfLifeS < 2 * DAY_S) return { value: halfLifeS / 3600, unit: 'h' };
  if (halfLifeS < 2 * YEAR_S) return { value: halfLifeS / DAY_S, unit: 'd' };
  return { value: halfLifeS / YEAR_S, unit: 'y' };
}
