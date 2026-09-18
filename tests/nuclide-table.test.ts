import { describe, it, expect } from 'vitest';
import { decayOf, decayProduct, fissionFragments, isFissile, isPromptWithin, isUnstable } from '../src/physics/nuclear/nuclideTable.ts';
import { nuclideLabel } from '../src/physics/data/nuclides.ts';
import { YEAR_S } from '../src/physics/constants.ts';
import { followUps, makePlan, phaseAt, shownNuclide, CHAIN_LIMIT_S } from '../src/workbench/atomActs.ts';

const geom = { c: 130, clusterR: 30 };

describe('nuklid tablosu', () => {
  it('W-184 kararli, U-238 alfa, Th-233 beta-, Be-8 iki alfa', () => {
    expect(decayOf({ Z: 74, A: 184 })?.mode).toBe('stable');
    expect(decayOf({ Z: 92, A: 238 })?.mode).toBe('alpha');
    expect(decayOf({ Z: 92, A: 238 })!.halfLifeS / YEAR_S).toBeCloseTo(4.468e9, -6);
    expect(decayOf({ Z: 90, A: 233 })?.mode).toBe('beta-');
    expect(decayOf({ Z: 4, A: 8 })?.mode).toBe('2alpha');
    expect(isUnstable({ Z: 4, A: 9 })).toBe(false);
    expect(decayOf({ Z: 50, A: 999 })).toBeNull();
  });

  it('bozunma aritmetigi: alfa Z-2 A-4, beta- Z+1, EK Z-1', () => {
    expect(nuclideLabel(decayProduct({ Z: 92, A: 238 }, 'alpha'))).toBe('Th-234');
    expect(nuclideLabel(decayProduct({ Z: 90, A: 233 }, 'beta-'))).toBe('Pa-233');
    expect(nuclideLabel(decayProduct({ Z: 79, A: 196 }, 'ec'))).toBe('Pt-196');
  });

  it('fisyon parcalari kutle ve yuku korur', () => {
    for (const u of [0, 0.2, 0.5, 0.99]) {
      const f = fissionFragments({ Z: 92, A: 236 }, u);
      expect(f.light.Z + f.heavy.Z).toBe(92);
      expect(f.light.A + f.heavy.A + f.neutrons).toBe(236);
      expect(f.neutrons).toBeGreaterThanOrEqual(2);
    }
    expect(isFissile({ Z: 92, A: 235 })).toBe(true);
    expect(isFissile({ Z: 92, A: 238 })).toBe(false);
  });

  it('zincir esigi: Pa-233 (27 g) oynar, U-233 (1.6e5 y) durur', () => {
    expect(isPromptWithin({ Z: 91, A: 233 }, CHAIN_LIMIT_S)).toBe(true);
    expect(isPromptWithin({ Z: 92, A: 233 }, CHAIN_LIMIT_S)).toBe(false);
  });
});

describe('perde planlayici', () => {
  it('Th-232 yakalama -> Th-233 -> beta zinciri Pa-233 -> U-233 ile durur', () => {
    const cap = makePlan('capture', { Z: 90, A: 232 }, 'neutrons', geom, null, 0);
    expect(nuclideLabel(cap.to)).toBe('Th-233');
    const f1 = followUps(cap);
    expect(f1).toHaveLength(1);
    expect(f1[0]!.kind).toBe('decay');
    expect(nuclideLabel(f1[0]!.from)).toBe('Th-233');
    expect(f1[0]!.waitS).toBeCloseTo(21.83 * 60, 3);
    const b1 = makePlan('betaMinus', f1[0]!.from, 'neutrons', geom, f1[0]!.waitS, 1);
    expect(nuclideLabel(b1.to)).toBe('Pa-233');
    const f2 = followUps(b1);
    expect(nuclideLabel(f2[0]!.from)).toBe('Pa-233');
    const b2 = makePlan('betaMinus', f2[0]!.from, 'neutrons', geom, f2[0]!.waitS, 2);
    expect(nuclideLabel(b2.to)).toBe('U-233');
    expect(followUps(b2)).toHaveLength(0);
  });

  it('U-235 yakalama fisyona gider; parcalar + notronlar', () => {
    const cap = makePlan('capture', { Z: 92, A: 235 }, 'neutrons', geom, null, 0);
    const f = followUps(cap);
    expect(f[0]!.kind).toBe('fission');
    const fis = makePlan('fission', f[0]!.from, 'neutrons', geom, f[0]!.waitS, 1);
    expect(fis.fission).not.toBeNull();
    expect(fis.neutronDirs).toHaveLength(fis.fission!.neutrons);
    expect(followUps(fis)).toHaveLength(0);
  });

  it('Be-9 fotonotron -> Be-8 -> iki alfa', () => {
    const pn = makePlan('photoneutron', { Z: 4, A: 9 }, 'above', geom, null, 0);
    expect(nuclideLabel(pn.to)).toBe('Be-8');
    const f = followUps(pn);
    expect(f[0]!.kind).toBe('breakup');
    const br = makePlan('breakup', f[0]!.from, 'above', geom, f[0]!.waitS, 1);
    expect(br.fission?.light).toEqual({ Z: 2, A: 4 });
    expect(br.fission?.neutrons).toBe(0);
  });

  it('U-238 alfa serisi: Th-234 -> Pa-234 -> U-234 ile durur', () => {
    const a = makePlan('alpha', { Z: 92, A: 238 }, 'idle', geom, null, 0);
    expect(nuclideLabel(a.to)).toBe('Th-234');
    expect(a.halfLifeS).toBeCloseTo(4.468e9 * YEAR_S, -15);
    const f1 = followUps(a);
    expect(nuclideLabel(f1[0]!.from)).toBe('Th-234');
    const b = makePlan('betaMinus', f1[0]!.from, 'idle', geom, f1[0]!.waitS, 1);
    const b2 = makePlan('betaMinus', followUps(b)[0]!.from, 'idle', geom, null, 2);
    expect(nuclideLabel(b2.to)).toBe('U-234');
    expect(followUps(b2)).toHaveLength(0);
  });

  it('fazlar sirali ve gosterilen nuklid donusum aninda degisir', () => {
    const a = makePlan('alpha', { Z: 92, A: 238 }, 'idle', geom, null, 0);
    expect(phaseAt(a, 0)).toBe('start');
    expect(phaseAt(a, a.dur * 0.5)).toBe('emit');
    expect(phaseAt(a, a.dur)).toBe('done');
    expect(nuclideLabel(shownNuclide(a, 'start'))).toBe('U-238');
    expect(nuclideLabel(shownNuclide(a, 'emit'))).toBe('Th-234');
    const io = makePlan('ionize', { Z: 74, A: 184 }, 'below', geom, null, 0);
    expect(phaseAt(io, io.dur * 0.5)).toBe('hole');
    expect(phaseAt(io, io.dur * 0.7)).toBe('xray');
    expect(io.projectile).toBe('electron');
  });
});
