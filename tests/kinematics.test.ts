import { describe, it, expect } from 'vitest';
import {
  beta,
  gamma,
  momentumMeV,
  kineticFromMomentumMeV,
  rigidityTm,
  gyroradiusM,
  speedMs,
  photonWavelengthNm,
} from '../src/physics/kinematics.ts';
import { ELECTRON_MASS_MEV, PROTON_MASS_MEV, C } from '../src/physics/constants.ts';

describe('rolativistik kinematik', () => {
  it('1 MeV elektron referans degerlerini tutturur', () => {
    const t = 1;
    const e0 = ELECTRON_MASS_MEV;
    expect(gamma(t, e0)).toBeCloseTo(2.9569512, 5);
    expect(momentumMeV(t, e0)).toBeCloseTo(1.4219697, 5);
    expect(beta(t, e0)).toBeCloseTo(0.9410792, 6);
  });

  it('250 MeV proton referans degerlerini tutturur', () => {
    const t = 250;
    const e0 = PROTON_MASS_MEV;
    expect(gamma(t, e0)).toBeCloseTo(1.2664472, 6);
    expect(momentumMeV(t, e0)).toBeCloseTo(729.1338, 3);
    expect(beta(t, e0)).toBeCloseTo(0.6136084, 6);
  });

  it('cok dusuk enerjide beta sadelesme kaybina girmez', () => {
    // Naif sqrt(1 - 1/gamma^2) burada tamamen yuvarlama gurultusu dondurur.
    const t = 1e-15; // 1 neV
    const b = beta(t, ELECTRON_MASS_MEV);
    // Klasik limit: beta = sqrt(2T/E0)
    expect(b).toBeCloseTo(Math.sqrt((2 * t) / ELECTRON_MASS_MEV), 12);
    expect(b).toBeGreaterThan(0);
  });

  it('momentum donusumu tersine cevrilebilir', () => {
    for (const t of [0.01, 1, 100, 1e4]) {
      const pc = momentumMeV(t, PROTON_MASS_MEV);
      expect(kineticFromMomentumMeV(pc, PROTON_MASS_MEV)).toBeCloseTo(t, 6);
    }
  });

  it('foton icin beta = 1 ve pc = T', () => {
    expect(beta(5, 0)).toBe(1);
    expect(momentumMeV(5, 0)).toBe(5);
    expect(speedMs(5, 0)).toBe(C);
  });

  it('manyetik sertlik ve yaricap tutarli', () => {
    const pc = 1000;
    const b = 1.5;
    const brho = rigidityTm(pc, 1);
    expect(brho).toBeCloseTo(1000 / 299.792458, 9);
    expect(gyroradiusM(pc, b, 1)).toBeCloseTo(brho / b, 9);
  });

  it('yuksuz parcacik manyetik alanla saptirilamaz', () => {
    expect(rigidityTm(100, 0)).toBe(Infinity);
    expect(gyroradiusM(100, 1.5, 0)).toBe(Infinity);
  });

  it('Duane-Hunt: 100 kV karsiligi 12.398 pm', () => {
    expect(photonWavelengthNm(1e5) * 1000).toBeCloseTo(12.398, 2);
  });
});
