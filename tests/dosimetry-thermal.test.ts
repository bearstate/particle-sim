import { describe, it, expect } from 'vitest';
import {
  neutronWeightingFactor,
  radiationWeightingFactor,
  equivalentDoseSv,
  effectiveDoseSv,
  TISSUE_WEIGHTS,
  absorbedDoseGy,
  inverseSquare,
  nominalRisk,
} from '../src/physics/dosimetry/dose.ts';
import {
  survivalLQ,
  doseForSurvivalGy,
  biologicallyEffectiveDoseGy,
  rbeFromLet,
  clusteredDamageFraction,
  damageProfile,
} from '../src/physics/dosimetry/survival.ts';
import { step, equilibriumTempK, INITIAL_THERMAL_STATE, type ThermalBody } from '../src/physics/thermal/heat.ts';
import {
  peakWavelengthM,
  blackbodySrgb255,
  glowIntensity,
  DRAPER_POINT_K,
  radiantExitanceWPerM2,
} from '../src/physics/thermal/blackbody.ts';
import { elementBySymbol } from '../src/physics/data/elements.ts';

describe('dozimetri', () => {
  it('notron w_R 1 MeV civarinda ~20.7 ile tepe yapar', () => {
    expect(neutronWeightingFactor(1)).toBeCloseTo(20.69, 1);
    expect(neutronWeightingFactor(1)).toBeGreaterThan(neutronWeightingFactor(0.001));
    expect(neutronWeightingFactor(1)).toBeGreaterThan(neutronWeightingFactor(100));
  });

  it('w_R parcalari sinirlarda neredeyse sureklidir', () => {
    // ICRP 103'un yayimlanmis parcali fonksiyonu 1 MeV'de ~0.008, 50 MeV'de
    // ~0.004 siciar. Bu kaynagin kendisinde vardir, bizim hatamiz degil.
    expect(Math.abs(neutronWeightingFactor(0.999999) - neutronWeightingFactor(1.000001))).toBeLessThan(0.01);
    expect(Math.abs(neutronWeightingFactor(49.99999) - neutronWeightingFactor(50.00001))).toBeLessThan(0.01);
  });

  it('tur bazli w_R degerleri ICRP 103 ile uyumlu', () => {
    expect(radiationWeightingFactor('photon')).toBe(1);
    expect(radiationWeightingFactor('electron')).toBe(1);
    expect(radiationWeightingFactor('proton')).toBe(2);
    expect(radiationWeightingFactor('alpha')).toBe(20);
  });

  it('ayni joule, notronda 20 kat esdeger doz', () => {
    const d = 0.01;
    const photon = equivalentDoseSv(d, 'photon');
    const neutron = equivalentDoseSv(d, 'neutron', 1);
    expect(neutron / photon).toBeCloseTo(20.69, 1);
  });

  it('doku agirlik faktorleri toplami 1.00', () => {
    const sum = Object.values(TISSUE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 9);
  });

  it('etkin doz agirlikli toplamdir', () => {
    expect(effectiveDoseSv({ lung: 1, gonads: 1 })).toBeCloseTo(0.12 + 0.08, 9);
  });

  it('sogurulan doz J/kg', () => {
    expect(absorbedDoseGy(2, 4)).toBe(0.5);
    expect(absorbedDoseGy(1, 0)).toBe(0);
  });

  it('ters kare yasasi', () => {
    expect(inverseSquare(100, 1, 2)).toBeCloseTo(25, 9);
  });

  it('nominal risk 1 Sv icin yuzde 5.5', () => {
    expect(nominalRisk(1)).toBeCloseTo(0.055, 9);
  });
});

describe('hucre hayatta kalma', () => {
  it('LQ: alpha=0.3, beta=0.03, D=2 Gy -> S = 0.487', () => {
    expect(survivalLQ(2, 0.3, 0.03)).toBeCloseTo(0.4868, 4);
  });

  it('LQ tersine cevrilebilir', () => {
    for (const d of [0.5, 2, 5, 10]) {
      const s = survivalLQ(d, 0.3, 0.03);
      expect(doseForSurvivalGy(s, 0.3, 0.03)).toBeCloseTo(d, 6);
    }
  });

  it('BED alfa/beta orani ile buyur', () => {
    expect(biologicallyEffectiveDoseGy(2, 10)).toBeCloseTo(2.4, 9);
    expect(biologicallyEffectiveDoseGy(2, 3)).toBeGreaterThan(biologicallyEffectiveDoseGy(2, 10));
  });

  it('RBE ~100 keV/um civarinda tepe yapar, sonra duser (overkill)', () => {
    const peak = rbeFromLet(100);
    expect(peak).toBeGreaterThan(rbeFromLet(1));
    expect(peak).toBeGreaterThan(rbeFromLet(1000));
    expect(rbeFromLet(0.25)).toBeCloseTo(1, 2);
  });

  it('yuksek LET kumelenmis hasar uretir', () => {
    expect(clusteredDamageFraction(90)).toBeGreaterThan(clusteredDamageFraction(0.25));
    expect(clusteredDamageFraction(0.25)).toBeCloseTo(0.3, 1);
    expect(clusteredDamageFraction(1000)).toBeLessThanOrEqual(0.9);
  });

  it('ayni dozda alfa, X-isinindan daha cok DSB birakir', () => {
    const xray = damageProfile(1, 2);
    const alpha = damageProfile(1, 90);
    expect(alpha.doubleStrandBreaks).toBeGreaterThan(xray.doubleStrandBreaks);
    expect(alpha.clusteredFraction).toBeGreaterThan(xray.clusteredFraction);
  });
});

describe('isil model', () => {
  const tungsten = elementBySymbol('W')!;
  const body: ThermalBody = {
    massKg: 1e-3,
    specificHeatJPerKgK: tungsten.specificHeatJPerKgK,
    surfaceAreaM2: 1e-4,
    emissivity: 1,
    conductanceWPerK: 0,
    ambientTempK: 293.15,
    meltingPointK: tungsten.meltingPointK,
    boilingPointK: tungsten.boilingPointK,
    latentHeatFusionJPerKg: tungsten.latentHeatFusionKJPerKg * 1000,
    latentHeatVaporJPerKg: tungsten.latentHeatVaporKJPerKg * 1000,
  };

  it('saf isimali denge Stefan-Boltzmann ile tutarli', () => {
    const t = equilibriumTempK(body, 100);
    expect(t).toBeCloseTo(2049, 0);
    expect(radiantExitanceWPerM2(t) * body.surfaceAreaM2).toBeCloseTo(100, 0);
  });

  it('cok buyuk zaman adiminda salinmaz, dengeye oturur', () => {
    const s = step(INITIAL_THERMAL_STATE, body, 100, 1e6);
    expect(s.tempK).toBeCloseTo(equilibriumTempK(body, 100), 0);
    expect(Number.isFinite(s.tempK)).toBe(true);
  });

  it('kucuk adimlarla ilerleyip ayni dengeye ulasir', () => {
    let s = INITIAL_THERMAL_STATE;
    for (let i = 0; i < 20000; i++) s = step(s, body, 100, 1e-3);
    expect(s.tempK).toBeCloseTo(equilibriumTempK(body, 100), 0);
  });

  it('erime noktasinda sicaklik platoya girer, gizli isi birikir', () => {
    let s = { tempK: body.meltingPointK - 1, meltFraction: 0, vaporFraction: 0 };
    s = step(s, body, 1e6, 1e-3);
    expect(s.tempK).toBeCloseTo(body.meltingPointK, 6);
    const before = s.meltFraction;
    s = step(s, body, 1e6, 1e-3);
    expect(s.tempK).toBeCloseTo(body.meltingPointK, 6);
    expect(s.meltFraction).toBeGreaterThan(before);
  });

  it('dusuk erime noktali metal cok daha erken erir', () => {
    const indium = elementBySymbol('In')!;
    expect(indium.meltingPointK).toBeLessThan(DRAPER_POINT_K);
    // Indiyum daha kizarmadan erir; tungsten 3000 K'de hala kati.
    expect(tungsten.meltingPointK).toBeGreaterThan(3000);
  });
});

describe('kara cisim rengi', () => {
  it('Wien tepesi 3000 K icin 966 nm', () => {
    expect(peakWavelengthM(3000) * 1e9).toBeCloseTo(966, 0);
  });

  it('1000 K belirgin kirmizi', () => {
    const [r, g, b] = blackbodySrgb255(1000);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(200);
  });

  it('6500 K neredeyse notr', () => {
    const [r, , b] = blackbodySrgb255(6500);
    expect(b / r).toBeGreaterThan(0.6);
  });

  it('sicaklik arttikca mavi bileseni yukselir', () => {
    const cool = blackbodySrgb255(1500);
    const hot = blackbodySrgb255(5000);
    expect(hot[2] / hot[0]).toBeGreaterThan(cool[2] / cool[0]);
  });

  it('Draper noktasinin altinda gorunur parilti yok', () => {
    expect(glowIntensity(500)).toBe(0);
    expect(glowIntensity(DRAPER_POINT_K)).toBe(0);
    expect(glowIntensity(1500)).toBeCloseTo(1, 6);
    expect(glowIntensity(3000)).toBeGreaterThan(10);
  });
});
