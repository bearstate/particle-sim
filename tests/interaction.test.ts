import { describe, it, expect } from 'vitest';
import {
  electronCollisionStopping,
  betheBloch,
  radiativeToCollisionRatio,
  WATER,
} from '../src/physics/interaction/stopping.ts';
import {
  radiationLengthGPerCm2,
  criticalEnergyMeV,
  practicalRangeGPerCm2,
  electronCsdaRangeGPerCm2,
  cherenkovThresholdMeV,
  cherenkovAngleRad,
} from '../src/physics/interaction/range.ts';
import {
  productionEfficiency,
  duaneHuntWavelengthNm,
  characteristicLines,
  kramersSpectrum,
  addCharacteristicLines,
  meanEnergyKeV,
} from '../src/physics/interaction/bremsstrahlung.ts';
import { PROTON_MASS_MEV, ELECTRON_MASS_MEV } from '../src/physics/constants.ts';

describe('durdurma gucu', () => {
  it('1 MeV elektron suda ~1.85 MeV cm2/g (ESTAR)', () => {
    const s = electronCollisionStopping(1, WATER);
    expect(s).toBeGreaterThan(1.75);
    expect(s).toBeLessThan(1.98);
  });

  it('Bethe-Bloch 1/beta^2 ile dusuk enerjide buyur', () => {
    const low = betheBloch(1, PROTON_MASS_MEV, 1, WATER);
    const high = betheBloch(100, PROTON_MASS_MEV, 1, WATER);
    expect(low).toBeGreaterThan(high);
  });

  it('alfa, ayni hizdaki protondan z^2 = 4 kat fazla durdurulur', () => {
    const tP = 10;
    const tA = tP * (3727.379412 / PROTON_MASS_MEV);
    const sP = betheBloch(tP, PROTON_MASS_MEV, 1, WATER);
    const sA = betheBloch(tA, 3727.379412, 2, WATER);
    expect(sA / sP).toBeCloseTo(4, 0);
  });

  it('isimasal/carpismasal oran Z ve E ile dogrusal', () => {
    expect(radiativeToCollisionRatio(74, 10)).toBeCloseTo(74 / 70, 6);
    expect(radiativeToCollisionRatio(74, 1) / radiativeToCollisionRatio(13, 1)).toBeCloseTo(5.69, 1);
  });
});

describe('menzil ve isima boyu', () => {
  it('tungsten isima boyu 6.76 g/cm2', () => {
    expect(radiationLengthGPerCm2(74, 183.84)).toBeCloseTo(6.76, 1);
  });

  it('kursun isima boyu 6.37 g/cm2', () => {
    expect(radiationLengthGPerCm2(82, 207.2)).toBeCloseTo(6.37, 1);
  });

  it('tungsten kritik enerjisi ~8 MeV', () => {
    expect(criticalEnergyMeV(74)).toBeCloseTo(8.1, 1);
  });

  it('Katz-Penfold PRATIK menzili 1 MeV icin 0.412 g/cm2', () => {
    expect(practicalRangeGPerCm2(1)).toBeCloseTo(0.412, 3);
  });

  it('CSDA menzili pratik menzilden buyuktur (dolambac carpani)', () => {
    const csda = electronCsdaRangeGPerCm2(1, WATER);
    expect(csda).toBeGreaterThan(practicalRangeGPerCm2(1));
    expect(csda).toBeGreaterThan(0.35);
    expect(csda).toBeLessThan(0.55);
  });

  it('menzil enerjiyle monoton artar', () => {
    let prev = 0;
    for (const e of [0.1, 0.5, 1, 5, 10]) {
      const r = electronCsdaRangeGPerCm2(e, WATER);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });

  it('Cherenkov esigi suda 0.26 MeV elektron', () => {
    expect(cherenkovThresholdMeV(ELECTRON_MASS_MEV, 1.33)).toBeCloseTo(0.264, 2);
    expect(cherenkovAngleRad(0.1, ELECTRON_MASS_MEV, 1.33)).toBeNull();
    expect(cherenkovAngleRad(10, ELECTRON_MASS_MEV, 1.33)).toBeGreaterThan(0);
  });
});

describe('bremsstrahlung ve X-isini', () => {
  it('tungsten anot 100 kV icin verim yaklasik yuzde 0.8', () => {
    expect(productionEfficiency(74, 1e5)).toBeCloseTo(0.00814, 5);
  });

  it('Duane-Hunt 100 kV icin 12.4 pm', () => {
    expect(duaneHuntWavelengthNm(1e5) * 1000).toBeCloseTo(12.398, 2);
  });

  it('olculmus cizgiler: Cu K-alfa 8.05 keV, W K-alfa 59.3 keV', () => {
    expect(characteristicLines(29).kAlphaKeV).toBeCloseTo(8.048, 3);
    expect(characteristicLines(74).kAlphaKeV).toBeCloseTo(59.318, 3);
    expect(characteristicLines(74).kEdgeKeV).toBeCloseTo(69.525, 3);
  });

  it('spektrum normalize ve ortalama enerji endpoint altinda', () => {
    const s = kramersSpectrum(74, 100e3);
    const sum = s.weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(s.endpointKeV).toBe(100);
    expect(meanEnergyKeV(s)).toBeLessThan(100);
  });

  it('karakteristik cizgiler K kenarinin ALTINDA cikmaz', () => {
    const base = kramersSpectrum(74, 60e3);
    const withLines = addCharacteristicLines(base, 74, 60e3);
    expect(withLines.weights).toBe(base.weights);
  });

  it('karakteristik cizgiler K kenarinin USTUNDE belirir', () => {
    const base = kramersSpectrum(74, 120e3, 128);
    const withLines = addCharacteristicLines(base, 74, 120e3);
    const dE = 120 / 128;
    const idx = Math.floor(59.318 / dE);
    expect(withLines.weights[idx]!).toBeGreaterThan(base.weights[idx]! * 2);
    expect(withLines.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});
