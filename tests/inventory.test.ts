import { describe, it, expect } from 'vitest';
import { slabAtoms, reactionFor, computeInventory } from '../src/workbench/inventory.ts';
import { elementBySymbol } from '../src/physics/data/elements.ts';
import { DAY_S } from '../src/physics/constants.ts';

const TH = elementBySymbol('Th')!;
const BE = elementBySymbol('Be')!;

describe('nuklid envanteri', () => {
  it('20 mm toryum levhada ~1.2e23 atom', () => {
    expect(slabAtoms(TH, 20) / 1e23).toBeCloseTo(1.2, 0);
  });

  it('toryumun tepkimesi (n,gamma) zinciri, berilyumun yok', () => {
    expect(reactionFor(TH)?.id).toBe('th232-capture');
    expect(reactionFor(BE)).toBeNull();
    expect(computeInventory(BE, 5, undefined)).toBeNull();
  });

  it('maruziyet yoksa yalnizca hedef vardir', () => {
    const inv = computeInventory(TH, 20, undefined)!;
    expect(inv.rows[0]!.id).toBe('Th-232');
    expect(inv.rows.slice(1).every((r) => r.atoms === 0)).toBe(true);
  });

  it('100 gun isinlamada Pa-233 aktivitesi yakalama hizina yaklasir (denge)', () => {
    const flux = 1e13; // 1/(m^2 s)
    const inv = computeInventory(TH, 20, { irradiatedS: 100 * DAY_S, cooledS: 0, fluxPerM2S: flux })!;
    const pa = inv.rows.find((r) => r.id === 'Pa-233')!;
    const u = inv.rows.find((r) => r.id === 'U-233')!;
    // 100 gun = 3.7 Pa-233 yari omru: aktivite dengenin %92'sinde.
    expect(pa.activityBq / inv.captureRatePerS).toBeGreaterThan(0.9);
    expect(pa.activityBq / inv.captureRatePerS).toBeLessThan(1.0);
    expect(u.atoms).toBeGreaterThan(0);
    // Th-233 (22 dk) neredeyse hemen dengede: aktivitesi yakalama hizina esit.
    const th233 = inv.rows.find((r) => r.id === 'Th-233')!;
    expect(th233.activityBq / inv.captureRatePerS).toBeCloseTo(1, 3);
  });

  it('sogutma sirasinda Pa-233 bozunur, U-233 birikmeye devam eder', () => {
    const flux = 1e13;
    const a = computeInventory(TH, 20, { irradiatedS: 30 * DAY_S, cooledS: 0, fluxPerM2S: flux })!;
    const b = computeInventory(TH, 20, { irradiatedS: 30 * DAY_S, cooledS: 27 * DAY_S, fluxPerM2S: flux })!;
    const pa = (i: typeof a) => i.rows.find((r) => r.id === 'Pa-233')!.atoms;
    const u = (i: typeof a) => i.rows.find((r) => r.id === 'U-233')!.atoms;
    expect(pa(b) / pa(a)).toBeCloseTo(0.5, 1);
    expect(u(b)).toBeGreaterThan(u(a));
  });
});
