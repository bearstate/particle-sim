import { reactionsForZ, type NeutronReaction } from '../physics/nuclear/chains.ts';
import { irradiateThenCool } from '../physics/nuclear/activation.ts';
import { densityKgPerM3, type Element } from '../physics/data/elements.ts';
import { AVOGADRO } from '../physics/constants.ts';
import type { Exposure } from './clock.ts';

/**
 * Hedefin nuklid envanteri: isinlama + sogutma surelerinden Bateman ile.
 * Saf; UI her karede cagirabilir (zincirler kucuk, matris usteli ucuz).
 */

export interface InventoryRow {
  readonly id: string;
  readonly atoms: number;
  readonly activityBq: number;
  readonly halfLifeS: number;
  /** Zincirdeki indeks; 0 hedefin kendisi. */
  readonly index: number;
}

export interface Inventory {
  readonly reaction: NeutronReaction;
  readonly rows: readonly InventoryRow[];
  readonly targetAtoms0: number;
  readonly captureRatePerS: number;
}

/** 1x2 cm levhanin atom sayisi. */
export function slabAtoms(element: Element, thicknessMm: number): number {
  const massKg = densityKgPerM3(element) * 0.01 * 0.02 * (thicknessMm * 1e-3);
  return (massKg / (element.massNumber * 1e-3)) * AVOGADRO;
}

/** Elementin tezgahta modellenen ilk notron tepkimesi (yoksa null). */
export function reactionFor(element: Element, A?: number): NeutronReaction | null {
  const list = reactionsForZ(element.Z).filter((r) => r.chain.length > 0 && (A === undefined || r.targetA === A));
  return list[0] ?? null;
}

export function computeInventory(element: Element, thicknessMm: number, exposure: Exposure | undefined, A?: number): Inventory | null {
  const reaction = reactionFor(element, A);
  if (!reaction) return null;
  const atoms0 = slabAtoms(element, thicknessMm);
  const irr = exposure?.irradiatedS ?? 0;
  const cool = exposure?.cooledS ?? 0;
  const flux = exposure?.fluxPerM2S ?? 0;
  const res = irradiateThenCool(reaction, atoms0, flux, irr, cool);
  const rows: InventoryRow[] = res.nodes.map((n, i) => ({
    id: n.id,
    atoms: res.atoms[i] ?? 0,
    activityBq: res.activitiesBq[i] ?? 0,
    halfLifeS: i === 0 ? Infinity : (reaction.chain[i - 1]?.halfLifeS ?? Infinity),
    index: i,
  }));
  return { reaction, rows, targetAtoms0: atoms0, captureRatePerS: (res.nodes[0]?.lambda ?? 0) * (res.atoms[0] ?? 0) };
}
