import { describe, it, expect } from 'vitest';
import { decayConstant, remaining, activityBq } from '../src/physics/nuclear/decay.ts';
import { solveAt, batemanClosedForm, type ChainNode } from '../src/physics/nuclear/bateman.ts';
import { REACTIONS, reactionById, toChainNodes } from '../src/physics/nuclear/chains.ts';
import { irradiateThenCool, saturationActivityBq, buildActivationChain } from '../src/physics/nuclear/activation.ts';
import { xi, collisionsToSlowDown, oneOverVCrossSectionBarn, maxEnergyLossFraction } from '../src/physics/nuclear/moderation.ts';
import { DAY_S } from '../src/physics/constants.ts';

const node = (lambda: number, to?: number): ChainNode => ({
  id: 'n',
  lambda,
  branches: to === undefined ? [] : [{ to, fraction: 1 }],
});

describe('bozunma yasasi', () => {
  it('bir yari omurde yarisi kalir', () => {
    expect(remaining(1000, 60, 60)).toBeCloseTo(500, 9);
    expect(remaining(1000, 60, 120)).toBeCloseTo(250, 9);
  });

  it('kararli nuklid icin lambda sifir', () => {
    expect(decayConstant(Infinity)).toBe(0);
    expect(activityBq(1e20, Infinity)).toBe(0);
  });
});

describe('zincir cozucu (matris usteli)', () => {
  it('tek nuklid analitik bozunmayi tutturur', () => {
    const lambda = 1e-3;
    const out = solveAt([node(lambda)], [1000], 1000);
    expect(out[0]!).toBeCloseTo(1000 * Math.exp(-1), 9);
  });

  it('ayrik lambdali zincirde kapali Bateman ile ayni sonucu verir', () => {
    const l = [1e-2, 1e-3, 1e-4];
    const nodes = [node(l[0]!, 1), node(l[1]!, 2), node(l[2]!)];
    for (const t of [10, 100, 1000, 1e4]) {
      const matrix = solveAt(nodes, [1e6, 0, 0], t)[2]!;
      const closed = batemanClosedForm(l, 1e6, t);
      expect(matrix).toBeCloseTo(closed, 3);
    }
  });

  it('OZDES lambda tuzaginda dogru calisir (kapali form NaN verir)', () => {
    // Tam cozum: N2 = N0*lambda*t*exp(-lambda*t)
    const lambda = 1e-3;
    const t = 1000;
    const nodes = [node(lambda, 1), node(lambda)];
    const out = solveAt(nodes, [1000, 0], t);
    expect(out[0]!).toBeCloseTo(1000 * Math.exp(-1), 6);
    expect(out[1]!).toBeCloseTo(1000 * lambda * t * Math.exp(-1), 6);

    // Kapali form burada sifira bolup patlar.
    expect(Number.isFinite(batemanClosedForm([lambda, lambda], 1000, t))).toBe(false);
  });

  it('cok yakin lambdalarda da sonlu ve surekli kalir', () => {
    const t = 1000;
    const base = solveAt([node(1e-3, 1), node(1e-3)], [1000, 0], t)[1]!;
    const near = solveAt([node(1e-3, 1), node(1.0000001e-3)], [1000, 0], t)[1]!;
    expect(Number.isFinite(near)).toBe(true);
    expect(near).toBeCloseTo(base, 4);
  });

  it('kararli sonla biten zincirde toplam atom korunur', () => {
    const nodes = [node(1e-2, 1), node(1e-3, 2), node(0)];
    for (const t of [0, 100, 1e4, 1e8]) {
      const out = solveAt(nodes, [1e6, 0, 0], t);
      const total = out[0]! + out[1]! + out[2]!;
      expect(total).toBeCloseTo(1e6, 0);
    }
  });

  it('zaman olcegi ne olursa olsun t dogrudan degerlendirilir', () => {
    // Adim atmadigimiz icin "10^9 kat hizlandirma" bir seyi bozmaz.
    const nodes = [node(1e-9, 1), node(1e-11)];
    const a = solveAt(nodes, [1e6, 0], 1e12);
    expect(Number.isFinite(a[0]!)).toBe(true);
    expect(Number.isFinite(a[1]!)).toBe(true);
    expect(a[0]!).toBeGreaterThanOrEqual(0);
  });
});

describe('toryum dongusu (amiral gemisi senaryo)', () => {
  const th = reactionById('th232-capture')!;

  it('zincir Th-233 -> Pa-233 -> U-233 seklinde kurulur', () => {
    expect(th.chain.map((c) => c.id)).toEqual(['Th-233', 'Pa-233', 'U-233', 'Th-229']);
    expect(th.chain[0]!.halfLifeS).toBeCloseTo(21.83 * 60, 6);
    expect(th.chain[1]!.halfLifeS).toBeCloseTo(26.975 * DAY_S, 6);
  });

  it('100 gun sonra Th-233 tamamen, Pa-233 buyuk olcude U-233 olur', () => {
    const nodes = toChainNodes(th);
    const out = solveAt(nodes, [1e6, 0, 0, 0], 100 * DAY_S);
    // Th-233 (22 dk) coktan bitti.
    expect(out[0]! / 1e6).toBeLessThan(1e-9);
    // Pa-233 (27 gun): 100/26.975 = 3.71 yari omur -> 2^-3.71
    expect(out[1]! / 1e6).toBeCloseTo(0.0766, 3);
    // Gerisi U-233.
    expect(out[2]! / 1e6).toBeCloseTo(0.9234, 3);
  });

  it('bir Pa-233 yari omrunde tam yarisi donusur', () => {
    const nodes = toChainNodes(th);
    const out = solveAt(nodes, [0, 1e6, 0, 0], 26.975 * DAY_S);
    expect(out[1]! / 1e6).toBeCloseTo(0.5, 3);
    expect(out[2]! / 1e6).toBeCloseTo(0.5, 3);
  });

  it('tum tepkimelerde pozitif tesir kesiti ve tutarli zincir var', () => {
    for (const r of REACTIONS) {
      expect(r.thermalBarn).toBeGreaterThan(0);
      for (const m of r.chain) {
        expect(m.halfLifeS).toBeGreaterThan(0);
        expect(m.Z).toBeGreaterThan(0);
        expect(m.A).toBeGreaterThanOrEqual(m.Z);
      }
    }
  });
});

describe('aktivasyon', () => {
  const co = reactionById('co59-capture')!;

  it('hedef zincirin basina eklenir ve lambda = sigma*phi olur', () => {
    const chain = buildActivationChain(co, 1e18);
    expect(chain[0]!.id).toBe('Co-59');
    expect(chain[0]!.lambda).toBeCloseTo(37.18 * 1e-28 * 1e18, 12);
  });

  it('uzun isinlamada aktivite doyuma gider, daha fazlasi ise yaramaz', () => {
    const atoms = 1e22;
    const flux = 1e16;
    const sat = saturationActivityBq(atoms, co.thermalBarn, flux);
    const long = irradiateThenCool(co, atoms, flux, 40 * 365.25 * DAY_S);
    // Co-60 yari omru 5.27 yil; 40 yil = 7.6 yari omur -> %99.5 doyum
    expect(long.activitiesBq[1]! / sat).toBeGreaterThan(0.99);
    expect(long.activitiesBq[1]! / sat).toBeLessThanOrEqual(1.001);
  });

  it('sogutma suresinde aktivite bozunma yasasina uyar', () => {
    const atoms = 1e22;
    const flux = 1e16;
    const irr = 365.25 * DAY_S;
    const a0 = irradiateThenCool(co, atoms, flux, irr).activitiesBq[1]!;
    const a1 = irradiateThenCool(co, atoms, flux, irr, 5.2714 * 365.25 * DAY_S).activitiesBq[1]!;
    expect(a1 / a0).toBeCloseTo(0.5, 2);
  });
});

describe('notron yavaslatma', () => {
  it('hidrojen tek carpismada tum enerjiyi alabilir', () => {
    expect(maxEnergyLossFraction(1)).toBeCloseTo(1, 9);
    expect(xi(1)).toBe(1);
  });

  it('2 MeV -> termal icin carpisma sayilari literaturle uyumlu', () => {
    const e0 = 2e6;
    expect(collisionsToSlowDown(1, e0)).toBeCloseTo(18.2, 0);
    expect(collisionsToSlowDown(12, e0)).toBeGreaterThan(110);
    expect(collisionsToSlowDown(12, e0)).toBeLessThan(120);
    expect(collisionsToSlowDown(238, e0)).toBeGreaterThan(2100);
    expect(collisionsToSlowDown(238, e0)).toBeLessThan(2250);
  });

  it('1/v yasasi: moderasyon yakalama tesir kesitini binlerce kat buyutur', () => {
    const thermal = oneOverVCrossSectionBarn(7.34, 0.0253);
    const fast = oneOverVCrossSectionBarn(7.34, 1e6);
    expect(thermal).toBeCloseTo(7.34, 6);
    expect(thermal / fast).toBeGreaterThan(5000);
  });
});
