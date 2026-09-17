/**
 * Notron aktivasyonu. PHYSICS.md bolum 1.H.
 *
 *   Tepkime hizi / atom = sigma * phi
 *   A(t) = N*phi*sigma*(1 - exp(-lambda*t)),   A_doyum = N*phi*sigma
 *
 * Uygulama numarasi: sabit kaynakli ODE'yi ayri cozmek yerine HEDEFIN KENDISI
 * zincire bir dugum olarak eklenir; "bozunma sabiti" sigma*phi olur. Boylece
 * her sey saf bir bozunma zinciri haline gelir ve `bateman.solveAt` dogrudan
 * kullanilir. Yan fayda: hedef tukenmesi (burn-up) bedavaya modellenmis olur.
 */

import { BARN_TO_M2 } from '../constants.ts';
import type { ChainNode } from './bateman.ts';
import { solveAt } from './bateman.ts';
import { toChainNodes, type NeutronReaction } from './chains.ts';

/** Atom basina tepkime hizi, 1/s. `sigma*phi`, phi 1/(m^2*s). */
export function reactionRatePerAtom(crossSectionBarn: number, fluxPerM2S: number): number {
  return crossSectionBarn * BARN_TO_M2 * fluxPerM2S;
}

/** Toplam tepkime hizi, tepkime/s. */
export function totalReactionRate(
  targetAtoms: number,
  crossSectionBarn: number,
  fluxPerM2S: number,
): number {
  return targetAtoms * reactionRatePerAtom(crossSectionBarn, fluxPerM2S);
}

/**
 * Doyum aktivitesi, Bq. Sonsuz isinlama suresinde ulasilabilecek tavan:
 * uretim hizi = bozunma hizi. Daha uzun isinlama ISE YARAMAZ — bu, kullanicinin
 * zaman olcegini sonuna kadar acinca gorecegi onemli bir ders.
 */
export function saturationActivityBq(
  targetAtoms: number,
  crossSectionBarn: number,
  fluxPerM2S: number,
): number {
  return totalReactionRate(targetAtoms, crossSectionBarn, fluxPerM2S);
}

/** Tek asamali aktivasyon: t sonunda aktivite, Bq. */
export function activityAfterIrradiationBq(
  targetAtoms: number,
  crossSectionBarn: number,
  fluxPerM2S: number,
  halfLifeS: number,
  irradiationTimeS: number,
): number {
  if (!Number.isFinite(halfLifeS) || halfLifeS <= 0) return 0;
  const lambda = Math.LN2 / halfLifeS;
  const sat = saturationActivityBq(targetAtoms, crossSectionBarn, fluxPerM2S);
  return sat * (1 - Math.exp(-lambda * irradiationTimeS));
}

/**
 * Hedefi zincirin basina ekleyerek isinlama + bozunma zincirini kurar.
 * Donen dizinin 0. elemani HEDEFTIR; 1..n tepkimenin urunleridir.
 */
export function buildActivationChain(
  reaction: NeutronReaction,
  fluxPerM2S: number,
  crossSectionBarn?: number,
): ChainNode[] {
  const sigma = crossSectionBarn ?? reaction.thermalBarn;
  const products = toChainNodes(reaction);
  // Urun indeksleri 1 kayar cunku hedef basa eklenir.
  const shifted: ChainNode[] = products.map((p) => ({
    id: p.id,
    lambda: p.lambda,
    branches: p.branches.map((b) => ({ to: b.to + 1, fraction: b.fraction })),
  }));
  const target: ChainNode = {
    id: `${reaction.targetSymbol}-${reaction.targetA}`,
    lambda: reactionRatePerAtom(sigma, fluxPerM2S),
    branches: shifted.length > 0 ? [{ to: 1, fraction: 1 }] : [],
  };
  return [target, ...shifted];
}

export interface IrradiationResult {
  /** Dugum basina atom sayisi. 0. eleman kalan hedef. */
  readonly atoms: Float64Array;
  /** Dugum basina aktivite, Bq. */
  readonly activitiesBq: Float64Array;
  readonly nodes: readonly ChainNode[];
}

/**
 * Isinlama (akili) sonra sogutma (akisiz) senaryosu.
 * Iki asama ayri cozulur: once sigma*phi'li zincir, sonra hedef dugumun
 * lambda'si sifirlanmis zincir.
 */
export function irradiateThenCool(
  reaction: NeutronReaction,
  targetAtoms: number,
  fluxPerM2S: number,
  irradiationTimeS: number,
  coolingTimeS = 0,
  crossSectionBarn?: number,
): IrradiationResult {
  const active = buildActivationChain(reaction, fluxPerM2S, crossSectionBarn);
  const initial = new Float64Array(active.length);
  initial[0] = targetAtoms;

  let atoms = solveAt(active, initial, irradiationTimeS);

  if (coolingTimeS > 0) {
    // Akisiz: hedef artik tepkimeye girmiyor.
    const idle: ChainNode[] = active.map((n, i) =>
      i === 0 ? { id: n.id, lambda: 0, branches: [] } : n,
    );
    atoms = solveAt(idle, atoms, coolingTimeS);
  }

  const activities = new Float64Array(active.length);
  for (let i = 0; i < active.length; i++) {
    // Hedefin "lambda"si tepkime hizidir, bozunma degil: aktivite sayilmaz.
    activities[i] = i === 0 ? 0 : active[i]!.lambda * atoms[i]!;
  }
  return { atoms, activitiesBq: activities, nodes: active };
}
