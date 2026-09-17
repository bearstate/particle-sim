import { describe, it, expect } from 'vitest';
import {
  kleinNishinaBarn,
  THOMSON_BARN,
  comptonScatteredEnergyMeV,
  comptonEdgeMeV,
  PAIR_THRESHOLD_MEV,
  pairProductionBarnApprox,
  halfValueLayerCm,
  transmission,
} from '../src/physics/interaction/attenuation.ts';
import {
  thresholdMeV,
  naturalThresholdMeV,
  gdrPeakEnergyMeV,
  thickTargetNeutronYieldPerS,
  photoabsorptionMb,
  photofissionThresholdMeV,
} from '../src/physics/interaction/photoneutron.ts';
import { neutronSeparationEnergyMeV, bindingEnergyPerNucleonMeV } from '../src/physics/nuclear/semf.ts';

describe('foton etkilesimleri', () => {
  it('Klein-Nishina dusuk enerjide Thomson limitine gider', () => {
    expect(THOMSON_BARN).toBeCloseTo(0.6652, 4);
    expect(kleinNishinaBarn(1e-6)).toBeCloseTo(THOMSON_BARN, 4);
  });

  it('Klein-Nishina enerjiyle monoton azalir', () => {
    let prev = Infinity;
    for (const e of [0.01, 0.1, 1, 10]) {
      const s = kleinNishinaBarn(e);
      expect(s).toBeLessThan(prev);
      prev = s;
    }
  });

  it('Compton: 180 derecede geri sacilma en buyuk kaybi verir', () => {
    const e = 1;
    expect(comptonScatteredEnergyMeV(e, 0)).toBeCloseTo(e, 9);
    const back = comptonScatteredEnergyMeV(e, Math.PI);
    expect(back).toBeLessThan(e);
    expect(comptonEdgeMeV(e)).toBeCloseTo(e - back, 9);
  });

  it('1 MeV foton icin Compton kenari 0.796 MeV', () => {
    expect(comptonEdgeMeV(1)).toBeCloseTo(0.7962, 3);
  });

  it('cift olusumu 1.022 MeV altinda tam sifir', () => {
    expect(PAIR_THRESHOLD_MEV).toBeCloseTo(1.022, 3);
    expect(pairProductionBarnApprox(82, 1.0)).toBe(0);
    expect(pairProductionBarnApprox(82, 5.0)).toBeGreaterThan(0);
  });

  it('HVL ln2/mu ve gecirgenlik tutarli', () => {
    expect(halfValueLayerCm(1)).toBeCloseTo(Math.LN2, 9);
    expect(halfValueLayerCm(0)).toBe(Infinity);
    expect(transmission(1, halfValueLayerCm(1))).toBeCloseTo(0.5, 9);
  });
});

describe('SEMF', () => {
  it('Fe-56 civarinda nukleon basina baglanma ~8.8 MeV ile zirve yapar', () => {
    const fe = bindingEnergyPerNucleonMeV(26, 56);
    expect(fe).toBeGreaterThan(8.5);
    expect(fe).toBeLessThan(9.0);
    expect(fe).toBeGreaterThan(bindingEnergyPerNucleonMeV(92, 238));
    expect(fe).toBeGreaterThan(bindingEnergyPerNucleonMeV(6, 12));
  });

  it('notron ayrilma enerjisi kestirimi makul bandda', () => {
    // Olculmus W-183: 6.19 MeV. SEMF ciftlenme terimiyle +-2 MeV isabet eder.
    const sn = neutronSeparationEnergyMeV(74, 183);
    expect(sn).toBeGreaterThan(3);
    expect(sn).toBeLessThan(10);
  });
});

describe('fotonukleer esik ve notron uretimi', () => {
  it('W-183 esigi 6.191 MeV, dogal W etkin esigi de odur', () => {
    expect(thresholdMeV(74, 183)).toBeCloseTo(6.191, 3);
    expect(naturalThresholdMeV(74, 183.84)).toBeCloseTo(6.191, 3);
  });

  it('Be-9 esigi en dusuk, C-12 en yuksek', () => {
    expect(thresholdMeV(4, 9)).toBeCloseTo(1.6645, 4);
    expect(thresholdMeV(6, 12)).toBeCloseTo(18.7216, 4);
    expect(thresholdMeV(4, 9)).toBeLessThan(thresholdMeV(74, 183));
  });

  it('esigin ALTINDA hicbir notron yok, ustunde var', () => {
    expect(thickTargetNeutronYieldPerS(74, 183.84, 5.9, 1000)).toBe(0);
    expect(thickTargetNeutronYieldPerS(74, 183.84, 6.19, 1000)).toBe(0);
    expect(thickTargetNeutronYieldPerS(74, 183.84, 7.0, 1000)).toBeGreaterThan(0);
  });

  it('kalin W hedefte 15 MeV ve 1 kW icin verim ~1e12 n/s', () => {
    const y = thickTargetNeutronYieldPerS(74, 183.84, 15, 1000);
    expect(y).toBeGreaterThan(5e11);
    expect(y).toBeLessThan(1.3e12);
  });

  it('verim demet gucuyle dogrusal', () => {
    const a = thickTargetNeutronYieldPerS(74, 183.84, 20, 1000);
    const b = thickTargetNeutronYieldPerS(74, 183.84, 20, 2000);
    expect(b / a).toBeCloseTo(2, 6);
  });

  it('GDR tepesi W icin ~14 MeV, Al icin ~22 MeV', () => {
    expect(gdrPeakEnergyMeV(184)).toBeCloseTo(14.1, 0);
    expect(gdrPeakEnergyMeV(27)).toBeCloseTo(22.3, 0);
  });

  it('foton sogurma esikte sifir, GDR tepesinde maksimum', () => {
    expect(photoabsorptionMb(74, 184, 5.0)).toBe(0);
    const atPeak = photoabsorptionMb(74, 184, gdrPeakEnergyMeV(184));
    const offPeak = photoabsorptionMb(74, 184, 30);
    expect(atPeak).toBeGreaterThan(offPeak);
    expect(atPeak).toBeGreaterThan(100);
  });

  it('uranyumda fotofisyon esigi (gamma,n) esiginden dusuk', () => {
    const fission = photofissionThresholdMeV(92);
    expect(fission).not.toBeNull();
    expect(fission!).toBeLessThan(thresholdMeV(92, 238));
  });
});
