import { describe, it, expect } from 'vitest';
import { breakdownVoltageV, paschenMinimum, townsendAlpha } from '../src/physics/gas/paschen.ts';
import { numberDensity, relativeDensity, meanFreePathM } from '../src/physics/gas/gases.ts';
import { peekOnsetFieldVPerM, coronaCurrentA } from '../src/physics/gas/corona.ts';
import { sparkLengthM, arcRatePerS, storedEnergyJ } from '../src/physics/gas/arc.ts';
import { ATM_TO_PA, AIR_BREAKDOWN_V_PER_M } from '../src/physics/constants.ts';

describe('gaz ortami', () => {
  it('1 atm ve 293 K icin parcacik yogunlugu 2.5e25 /m3', () => {
    expect(numberDensity(ATM_TO_PA, 293.15) / 1e25).toBeCloseTo(2.504, 2);
  });

  it('standart kosullarda bagil yogunluk 1', () => {
    expect(relativeDensity(ATM_TO_PA, 293.15)).toBeCloseTo(1.0, 6);
  });

  it('havada ortalama serbest yol STP icin ~68 nm', () => {
    const l = meanFreePathM('air', ATM_TO_PA, 293.15);
    expect(l * 1e9).toBeGreaterThan(55);
    expect(l * 1e9).toBeLessThan(80);
  });

  it('vakumda serbest yol sonsuz (carpismasiz tasinim)', () => {
    expect(meanFreePathM('vacuum', 1e-6, 293)).toBe(Infinity);
  });
});

describe('Paschen yasasi', () => {
  it('hava minimumu kullanilan katsayilarla tam tutarli', () => {
    const m = paschenMinimum('air');
    expect(m).not.toBeNull();
    // (pd)_min = (e/A)*ln(1+1/gamma),  V_min = B*(pd)_min
    expect(m!.pdPaM).toBeCloseTo(1.1151, 3);
    expect(m!.voltageV).toBeCloseTo(305.3, 0);
    // Yayinlanmis hava minimumlari 300-360 V bandindadir.
    expect(m!.voltageV).toBeGreaterThan(290);
    expect(m!.voltageV).toBeLessThan(370);
  });

  it('minimum gercekten minimumdur: iki yanda da gerilim yukselir', () => {
    const m = paschenMinimum('air')!;
    const gap = 0.01;
    const pAtMin = m.pdPaM / gap;
    const vMin = breakdownVoltageV('air', pAtMin, gap);
    expect(breakdownVoltageV('air', pAtMin * 10, gap)).toBeGreaterThan(vMin);
    expect(breakdownVoltageV('air', pAtMin * 0.1, gap)).toBeGreaterThan(vMin);
  });

  it('sol dalda delinme imkansizlasir (vakum rejimi)', () => {
    // p*d cok kucukse carpisacak molekul kalmaz.
    expect(breakdownVoltageV('air', 1e-6, 1e-3)).toBe(Infinity);
  });

  it('SF6 havadan ~3 kat dayanikli', () => {
    const gap = 0.01;
    const air = breakdownVoltageV('air', ATM_TO_PA, gap);
    const sf6 = breakdownVoltageV('sf6', ATM_TO_PA, gap);
    expect(sf6 / air).toBeGreaterThan(2.0);
    expect(sf6 / air).toBeLessThan(4.5);
  });

  it('SF6 delinme alani basincla dogrusal (~89 kV/cm/bar)', () => {
    const gap = 0.01;
    const v = breakdownVoltageV('sf6', 1e5, gap);
    // 1 kV/cm = 1e5 V/m
    expect(v / gap / 1e5).toBeCloseTo(88.9, 0);
  });

  it('Townsend alfa alanla artar, basincla doyar', () => {
    const a1 = townsendAlpha('air', 1000, 1e6);
    const a2 = townsendAlpha('air', 1000, 5e6);
    expect(a2).toBeGreaterThan(a1);
    expect(townsendAlpha('vacuum', 1000, 1e6)).toBe(0);
  });
});

describe('korona ve ark', () => {
  it('Peek: ince tel daha dusuk alanda korona baslatir', () => {
    const thin = peekOnsetFieldVPerM(1e-4, 1);
    const thick = peekOnsetFieldVPerM(1e-2, 1);
    expect(thin).toBeGreaterThan(thick);
  });

  it('korona akimi baslangicin altinda tam sifir', () => {
    expect(coronaCurrentA(1e5, 2e5, 1e-15)).toBe(0);
    expect(coronaCurrentA(3e5, 2e5, 1e-15)).toBeGreaterThan(0);
  });

  it('kullanicinin kurali: 300 kV -> 10 cm kivilcim', () => {
    expect(sparkLengthM(300e3, AIR_BREAKDOWN_V_PER_M)).toBeCloseTo(0.1, 9);
    expect(sparkLengthM(30e3, AIR_BREAKDOWN_V_PER_M)).toBeCloseTo(0.01, 9);
  });

  it('esigin altinda hicbir ark uretilmez', () => {
    expect(arcRatePerS(1e5, 2e5)).toBe(0);
    expect(arcRatePerS(2e5, 2e5)).toBe(0);
    expect(arcRatePerS(4e5, 2e5)).toBeGreaterThan(0);
  });

  it('depolanan enerji 0.5 C V^2', () => {
    expect(storedEnergyJ(1e-9, 1e5)).toBeCloseTo(5, 9);
  });
});
