import { describe, it, expect } from 'vitest';
import { solveBench } from '../src/workbench/solve.ts';
import type { DeviceInstance, Wire } from '../src/workbench/model.ts';

const dev = (id: string, kind: DeviceInstance['kind'], params: Record<string, number | string>): DeviceInstance => ({
  id, kind, x: 0, y: 0, params,
});
const wire = (id: string, kind: Wire['kind'], a: [string, string], b: [string, string]): Wire => ({
  id, kind, from: { device: a[0], port: a[1] }, to: { device: b[0], port: b[1] },
});

const VDG = (v: number) => dev('vdg', 'vandegraaff', { voltage: v, radius: 0.5, gas: 'sf6', pressure: 5e5 });
const TUBE = dev('tube', 'tube', { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' });
const GND = dev('gnd', 'ground', {});
const FULL_WIRING = [
  wire('w1', 'hv', ['vdg', 'hv'], ['tube', 'anode']),
  wire('w2', 'ground', ['gnd', 'gnd'], ['tube', 'cathode']),
  wire('w3', 'beam', ['tube', 'beam_out'], ['tgt', 'beam_in']),
];

describe('tezgah cozucu', () => {
  it('kablosuz tup enerjisizdir, kablosuz terminal ark atar', () => {
    const s = solveBench([VDG(3e5), TUBE, GND], []);
    expect(s.tubes['tube']!.regime).toBe('off');
    expect(s.tubes['tube']!.beamCurrentA).toBe(0);
    expect(s.vdgs['vdg']!.delivered).toBe(false);
    expect(s.vdgs['vdg']!.sparkM).toBeGreaterThan(0);
  });

  it('anot bagli ama katot topraksizsa demet yok', () => {
    const s = solveBench([VDG(3e5), TUBE, GND], [wire('w1', 'hv', ['vdg', 'hv'], ['tube', 'anode'])]);
    expect(s.tubes['tube']!.voltageV).toBeGreaterThan(0);
    expect(s.tubes['tube']!.grounded).toBe(false);
    expect(s.tubes['tube']!.regime).toBe('off');
  });

  it('tam kablolu vakum tupunde demet akar ve kaynak akimiyla sinirlidir', () => {
    const tgt = dev('tgt', 'target', { element: 'W', thickness: 2 });
    const s = solveBench([VDG(3e5), TUBE, GND, tgt], FULL_WIRING);
    const t = s.tubes['tube']!;
    expect(t.regime).toBe('vacuum');
    expect(t.beamCurrentA).toBeGreaterThan(0);
    // Van de Graaff belt akimi 25 uA: demet bunu asamaz.
    expect(t.beamCurrentA).toBeLessThanOrEqual(2.5e-5 + 1e-12);
    expect(t.electronEnergyMeV).toBeCloseTo(0.3, 6);
  });

  it('300 kV ile tungstenden notron CIKMAZ (esik 6.19 MeV)', () => {
    const tgt = dev('tgt', 'target', { element: 'W', thickness: 2 });
    const s = solveBench([VDG(3e5), TUBE, GND, tgt], FULL_WIRING);
    const r = s.targets['tgt']!;
    expect(r.incoming).toBe('electrons');
    expect(r.aboveThreshold).toBe(false);
    expect(r.neutronYieldPerS).toBe(0);
    expect(r.event).toBe('below_threshold');
    expect(r.product).toBeNull();
  });

  it('2 MV ile berilyumdan notron CIKAR (esik 1.66 MeV) ve urun Be-8', () => {
    const tgt = dev('tgt', 'target', { element: 'Be', thickness: 5 });
    const s = solveBench([VDG(2e6), TUBE, GND, tgt], FULL_WIRING);
    const r = s.targets['tgt']!;
    expect(r.electronEnergyMeV).toBeCloseTo(2.0, 6);
    expect(r.aboveThreshold).toBe(true);
    expect(r.neutronYieldPerS).toBeGreaterThan(0);
    expect(r.event).toBe('photoneutron');
    expect(r.product).toEqual({ Z: 4, A: 8 });
  });

  it('notron alan toryum yakalama olayi verir: Th-232 -> Th-233', () => {
    const be = dev('tgt', 'target', { element: 'Be', thickness: 5 });
    const th = dev('th', 'target', { element: 'Th', thickness: 20 });
    const wires = [...FULL_WIRING, wire('w4', 'beam', ['tgt', 'beam_out'], ['th', 'beam_in'])];
    const s = solveBench([VDG(2e6), TUBE, GND, be, th], wires);
    const r = s.targets['th']!;
    expect(r.incoming).toBe('neutrons');
    expect(r.event).toBe('capture');
    expect(r.product).toEqual({ Z: 90, A: 233 });
  });

  it('gazli tupte gerilim delinmeyi asarsa parilti/ark, asmazsa tikanir', () => {
    const glowTube = dev('tube', 'tube', { gas: 'ne', pressure: 200, cathodeElement: 'W', anodeElement: 'W' });
    const s1 = solveBench([VDG(3e5), glowTube, GND], FULL_WIRING.slice(0, 2));
    expect(['glow', 'arc']).toContain(s1.tubes['tube']!.regime);
    expect(s1.tubes['tube']!.beamCurrentA).toBe(0);

    const blocked = dev('tube', 'tube', { gas: 'sf6', pressure: 5e5, cathodeElement: 'W', anodeElement: 'W' });
    const s2 = solveBench([VDG(1e4), blocked, GND], FULL_WIRING.slice(0, 2));
    expect(s2.tubes['tube']!.regime).toBe('blocked');
  });
});
