import { describe, it, expect } from 'vitest';
import * as vdg from '../src/physics/sources/vandeGraaff.ts';
import * as marx from '../src/physics/sources/marx.ts';
import * as cw from '../src/physics/sources/cockcroftWalton.ts';
import * as cyc from '../src/physics/sources/cyclotron.ts';
import * as linac from '../src/physics/sources/linac.ts';
import * as sync from '../src/physics/sources/synchrotron.ts';
import { childLangmuirElectron, richardsonCurrentDensity } from '../src/physics/sources/emission.ts';
import { ELECTRON_MASS_MEV, PROTON_MASS_MEV } from '../src/physics/constants.ts';

describe('Van de Graaff', () => {
  it('R = 0.15 m icin kapasitans 16.7 pF', () => {
    expect(vdg.sphereCapacitanceF(0.15)).toBeCloseTo(16.69e-12, 14);
  });

  it('kacaksiz gerilim dogrusal rampa cizer', () => {
    const p = { ...vdg.DEFAULT_VAN_DE_GRAAFF, coronaK: 0 };
    const i = vdg.beltCurrentA(p);
    const c = vdg.sphereCapacitanceF(p.sphereRadiusM);
    const s = vdg.step({ voltageV: 0 }, p, 1e-6);
    expect(s.voltageV).toBeCloseTo((i * 1e-6) / c, 6);
  });

  it('gerilim kure delinme tavanini asamaz', () => {
    const p = vdg.DEFAULT_VAN_DE_GRAAFF;
    let s = { voltageV: 0 };
    for (let k = 0; k < 500; k++) s = vdg.step(s, p, 0.01);
    expect(s.voltageV).toBeLessThanOrEqual(vdg.maxTerminalVoltageV(p) + 1e-6);
  });

  it('cok buyuk zaman adiminda patlamaz (tam ustel adim)', () => {
    const p = vdg.DEFAULT_VAN_DE_GRAAFF;
    const s = vdg.step({ voltageV: 1e5 }, p, 1e6);
    expect(Number.isFinite(s.voltageV)).toBe(true);
    expect(s.voltageV).toBeGreaterThanOrEqual(0);
  });
});

describe('Marx jeneratoru', () => {
  const p = marx.DEFAULT_MARX;

  it('ideal cikis N carpi V0', () => {
    expect(marx.idealOutputV(p)).toBe(10 * 100e3);
  });

  it('seri baglama enerjiyi artirmaz, sadece gerilimi', () => {
    expect(marx.storedEnergyJ(p)).toBeCloseTo(0.5 * 10 * 100e-9 * 100e3 * 100e3, 6);
  });

  it('gerilim verimi 0.85 uzerinde', () => {
    const eta = marx.voltageEfficiency(p);
    expect(eta).toBeGreaterThan(0.85);
    expect(eta).toBeLessThan(1.0);
  });

  it('1.2/50 us darbesi tepede V0, 50 us civarinda yariya duser', () => {
    const tp = marx.peakTimeS();
    expect(tp).toBeGreaterThan(1.5e-6);
    expect(tp).toBeLessThan(2.5e-6);
    expect(marx.impulseVoltageV(tp, 1)).toBeCloseTo(1.0, 3);
    expect(marx.impulseVoltageV(50e-6, 1)).toBeCloseTo(0.5, 2);
    expect(marx.impulseVoltageV(-1e-6, 1)).toBe(0);
  });
});

describe('Cockcroft-Walton', () => {
  const p = cw.DEFAULT_COCKCROFT_WALTON;

  it('N=4 ve Vp=100 kV yuksuz iken 800 kV verir', () => {
    expect(cw.outputVoltageV(p, 0)).toBe(800e3);
  });

  it('gerilim dusumu kademe sayisiyla kuple buyur', () => {
    const load = 1e-3;
    const d4 = cw.voltageDropV({ ...p, stages: 4 }, load);
    const d8 = cw.voltageDropV({ ...p, stages: 8 }, load);
    expect(d8 / d4).toBeGreaterThan(6);
  });

  it('daha cok kademe her zaman daha cok gerilim getirmez', () => {
    const load = 5e-3;
    const best = cw.optimalStages(p, load);
    const at = cw.outputVoltageV({ ...p, stages: Math.round(best) }, load);
    const beyond = cw.outputVoltageV({ ...p, stages: Math.round(best) * 3 }, load);
    expect(at).toBeGreaterThan(beyond);
  });

  it('her eleman 2 Vp stresi gorur', () => {
    expect(cw.componentStressV(p)).toBe(200e3);
  });
});

describe('siklotron', () => {
  it('1.5 T alanda proton siklotron frekansi 22.87 MHz', () => {
    const f = cyc.cyclotronFrequencyHz(1.5, PROTON_MASS_MEV, 1, 0);
    expect(f / 1e6).toBeCloseTo(22.869, 2);
  });

  it('gamma buyudukce frekans duser', () => {
    const f0 = cyc.cyclotronFrequencyHz(1.5, PROTON_MASS_MEV, 1, 0);
    const f1 = cyc.cyclotronFrequencyHz(1.5, PROTON_MASS_MEV, 1, 200);
    expect(f1).toBeLessThan(f0);
    expect(f0 / f1).toBeCloseTo(1 + 200 / PROTON_MASS_MEV, 6);
  });

  it('klasik siklotron rolativistik faz kaymasiyla kendiliginden tikanir', () => {
    // Cikarma yaricapi kasitli olarak cok buyuk: tek sinirlayici faz kaymasi.
    const sol = cyc.solve(
      { ...cyc.DEFAULT_CYCLOTRON, deeRadiusM: 100, deeVoltageV: 200e3 },
      PROTON_MASS_MEV,
      1,
    );
    expect(sol.stoppedBy).toBe('phaseSlip');
    expect(sol.finalEnergyMeV).toBeGreaterThan(3);
    expect(sol.finalEnergyMeV).toBeLessThan(80);
  });

  it('izokron modda faz kaymasi yoktur, yaricap sinirlar', () => {
    const sol = cyc.solve(
      { ...cyc.DEFAULT_CYCLOTRON, mode: 'isochronous', deeRadiusM: 0.5 },
      PROTON_MASS_MEV,
      1,
    );
    expect(sol.stoppedBy).toBe('radius');
  });
});

describe('LINAC', () => {
  it('suruklenme tupleri gittikce uzar', () => {
    const prof = linac.solveProfile(linac.DEFAULT_LINAC, PROTON_MASS_MEV, 1, 1);
    const l = prof.driftTubeLengthsM;
    expect(l[0]!).toBeLessThan(l[10]!);
    expect(l[10]!).toBeLessThan(l[29]!);
    expect(prof.betas[29]!).toBeLessThan(1);
    expect(prof.finalEnergyMeV).toBeGreaterThan(1);
  });

  it('gecis suresi faktoru 0 ile 1 arasindadir', () => {
    const t = linac.transitTimeFactor(0.02, 0.5, 1.5);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('Kilpatrick sinirini tersine cozer', () => {
    const e = linac.kilpatrickFieldMVPerM(200e6);
    expect(1.64 * e * e * Math.exp(-8.5 / e)).toBeCloseTo(200, 1);
  });
});

describe('sinkrotron isimasi', () => {
  it('1 GeV elektron ve rho=1 m icin tur basina 88.46 keV', () => {
    const loss = sync.energyLossPerTurnMeV(1000 - ELECTRON_MASS_MEV, ELECTRON_MASS_MEV, 1, 1);
    expect(loss * 1000).toBeCloseTo(88.46, 0);
  });

  it('proton kaybi elektronunkinden devasa kucuk (m^-4 olcegi)', () => {
    const e = sync.energyLossPerTurnMeV(1000, ELECTRON_MASS_MEV, 1, 1);
    const p = sync.energyLossPerTurnMeV(1000, PROTON_MASS_MEV, 1, 1);
    expect(e / p).toBeGreaterThan(1e9);
  });
});

describe('emisyon', () => {
  it('Child-Langmuir elektron katsayisi 2.334e-6', () => {
    expect(childLangmuirElectron(1, 1)).toBeCloseTo(2.334e-6, 9);
  });

  it('Richardson akimi sicaklikla ustel buyur', () => {
    const a = richardsonCurrentDensity(4.55, 2000);
    const b = richardsonCurrentDensity(4.55, 2500);
    expect(b / a).toBeGreaterThan(100);
  });
});
