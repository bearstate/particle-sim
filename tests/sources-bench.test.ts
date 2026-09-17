import { describe, it, expect } from 'vitest';
import { solveBench } from '../src/workbench/solve.ts';
import type { DeviceInstance, Wire } from '../src/workbench/model.ts';

const dev = (id: string, kind: DeviceInstance['kind'], x: number, y: number, params: Record<string, number | string>): DeviceInstance => ({ id, kind, x, y, params });
const wire = (id: string, kind: Wire['kind'], a: [string, string], b: [string, string]): Wire => ({ id, kind, from: { device: a[0], port: a[1] }, to: { device: b[0], port: b[1] } });

const GND = dev('gnd', 'ground', 0, 600, {});
const TUBE = dev('tube', 'tube', 0, 100, { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' });
const target = (id: string, x: number, y: number, element: string) => dev(id, 'target', x, y, { element, thickness: 5 });

describe('Cockcroft-Walton kaynak', () => {
  const CW = dev('cw', 'cockcroftwalton', 0, 300, { stages: 4, inputPeakV: 1e5, frequency: 5e4, capacitance: 1e-8 });
  it('yuksuz 2NV verir, tupe baglaninca yuk altinda duser', () => {
    const idle = solveBench([CW], []).hv['cw']!;
    expect(idle.idealV).toBe(8e5);
    expect(idle.voltageV).toBeCloseTo(8e5, 0);
    const loaded = solveBench([CW, TUBE, GND], [wire('a', 'hv', ['cw', 'hv'], ['tube', 'anode']), wire('b', 'ground', ['gnd', 'gnd'], ['tube', 'cathode'])]);
    expect(loaded.hv['cw']!.loadCurrentA).toBeGreaterThan(0);
    expect(loaded.hv['cw']!.voltageV).toBeLessThan(8e5);
    expect(loaded.tubes['tube']!.regime).toBe('vacuum');
    expect(loaded.tubes['tube']!.electronEnergyMeV).toBeCloseTo(loaded.hv['cw']!.voltageV / 1e6, 9);
  });
});

describe('Marx kaynak', () => {
  const MARX = dev('mx', 'marx', 0, 300, { stages: 10, stageVoltage: 1e5, capacitance: 1e-7 });
  it('N*V0 idealinin verim kadar altinda, darbeli', () => {
    const s = solveBench([MARX, TUBE, GND], [wire('a', 'hv', ['mx', 'hv'], ['tube', 'anode']), wire('b', 'ground', ['gnd', 'gnd'], ['tube', 'cathode'])]);
    const m = s.hv['mx']!;
    expect(m.idealV).toBe(1e6);
    expect(m.voltageV).toBeGreaterThan(0.85e6);
    expect(m.voltageV).toBeLessThan(1e6);
    expect(m.pulsed).toBe(true);
    expect(s.tubes['tube']!.pulsed).toBe(true);
  });
});

describe('Klistron + LINAC', () => {
  const KL = dev('kl', 'klystron', 0, 400, { rfPower: 1e6 });
  const LINAC = dev('ln', 'linac', 0, 100, { particle: 'electron', mode: 'alvarez', frequency: 2e8, gapVoltage: 5e5, gapCount: 20 });
  const WIRED = [wire('a', 'rf', ['kl', 'rf'], ['ln', 'rf']), wire('b', 'ground', ['gnd', 'gnd'], ['ln', 'cathode'])];

  it('RF kablosu yoksa demet yok', () => {
    const s = solveBench([KL, LINAC, GND], [wire('b', 'ground', ['gnd', 'gnd'], ['ln', 'cathode'])]);
    expect(s.linacs['ln']!.powered).toBe(false);
    expect(s.linacs['ln']!.beamCurrentA).toBe(0);
  });

  it('kablolu LINAC ~8 MeV elektron verir; tungstenden NOTRON cikar', () => {
    const w = target('w', 420, 100, 'W');
    const s = solveBench([KL, LINAC, GND, w], WIRED);
    const l = s.linacs['ln']!;
    expect(l.arcing).toBe(false);
    expect(l.energyMeV).toBeGreaterThan(6.19);
    expect(l.energyMeV).toBeLessThan(12);
    expect(l.driftTubeLengthsM.length).toBe(20);
    expect(l.beamCurrentA).toBeGreaterThan(0);
    // Demet gucu RF gucunun yarisini asamaz.
    expect(l.beamPowerW).toBeLessThanOrEqual(0.5e6 + 1);
    expect(s.targets['w']!.incoming).toBe('electrons');
    expect(s.targets['w']!.aboveThreshold).toBe(true);
    expect(s.targets['w']!.product).toEqual({ Z: 74, A: 183 });
    expect(s.targets['w']!.neutronYieldPerS).toBeGreaterThan(1e12);
  });

  it('bosluk gradyani Kilpatrick sinirini asarsa ark: demet kesilir', () => {
    const hot = dev('ln', 'linac', 0, 100, { particle: 'electron', mode: 'alvarez', frequency: 2e8, gapVoltage: 2e6, gapCount: 20 });
    const s = solveBench([KL, hot, GND], WIRED);
    expect(s.linacs['ln']!.arcing).toBe(true);
    expect(s.linacs['ln']!.beamCurrentA).toBe(0);
  });

  it('proton demeti hedefi isitir ama fotonotron uretmez', () => {
    const pl = dev('ln', 'linac', 0, 100, { particle: 'proton', mode: 'alvarez', frequency: 2e8, gapVoltage: 5e5, gapCount: 20 });
    const w = target('w', 420, 100, 'W');
    const s = solveBench([KL, pl, GND, w], WIRED);
    expect(s.linacs['ln']!.species).toBe('proton');
    expect(s.beams[0]!.kind).toBe('proton');
    expect(s.targets['w']!.incoming).toBe('protons');
    expect(s.targets['w']!.event).toBe('proton_heat');
    expect(s.targets['w']!.neutronYieldPerS).toBe(0);
    expect(s.targets['w']!.heatW).toBeGreaterThan(0);
  });
});
