import { describe, it, expect } from 'vitest';
import { solveBench } from '../src/workbench/solve.ts';
import type { DeviceInstance, Wire } from '../src/workbench/model.ts';

const dev = (id: string, kind: DeviceInstance['kind'], x: number, y: number, params: Record<string, number | string>): DeviceInstance => ({ id, kind, x, y, params });
const wire = (id: string, kind: Wire['kind'], a: [string, string], b: [string, string]): Wire => ({ id, kind, from: { device: a[0], port: a[1] }, to: { device: b[0], port: b[1] } });
const VDG = dev('vdg', 'vandegraaff', 0, 300, { voltage: 3e5, radius: 0.15, gas: 'air', pressure: 101325 });
const TUBE = dev('tube', 'tube', 0, 100, { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' });
const GND = dev('gnd', 'ground', 0, 600, {});
const ELECTRIC = [wire('w1', 'hv', ['vdg', 'hv'], ['tube', 'anode']), wire('w2', 'ground', ['gnd', 'gnd'], ['tube', 'cathode'])];
const cell = (id: string, x: number, y: number) => dev(id, 'cell', x, y, { tissue: 'earlyResponding' });

describe('hucre dozu', () => {
  it('isinim gelmiyorsa doz sifir', () => {
    const s = solveBench([cell('c', 400, 400)], []);
    expect(s.cells['c']!.doseRateGyPerS).toBe(0);
    expect(s.cells['c']!.incoming).toBeNull();
  });

  it('demet dogrudan carparsa doz = demet gucu / 1 g', () => {
    const s = solveBench([VDG, TUBE, GND, cell('c', 420, 100)], ELECTRIC);
    const c = s.cells['c']!;
    expect(c.incoming).toBe('electrons');
    expect(c.doseRateGyPerS).toBeCloseTo(s.tubes['tube']!.beamPowerW / 1e-3, 6);
    expect(c.wR).toBe(1);
  });

  it('X-isini konisindeki hucre foton dozu alir, koni disindaki almaz', () => {
    const w = dev('w', 'target', 420, 100, { element: 'W', thickness: 2 });
    const inCone = solveBench([VDG, TUBE, GND, w, cell('c', 700, 120)], ELECTRIC).cells['c']!;
    expect(inCone.incoming).toBe('photons');
    expect(inCone.doseRateGyPerS * 60).toBeGreaterThan(0.1);
    expect(inCone.doseRateGyPerS * 60).toBeLessThan(100);
    const outCone = solveBench([VDG, TUBE, GND, w, cell('c', 500, 500)], ELECTRIC).cells['c']!;
    expect(outCone.incoming).toBeNull();
  });

  it('notron kaynagi yaninda hucre w_R=17 ile esdeger doz alir', () => {
    const big = dev('vdg', 'vandegraaff', 0, 300, { voltage: 2e6, radius: 0.6, gas: 'air', pressure: 101325 });
    const be = dev('be', 'target', 420, 100, { element: 'Be', thickness: 5 });
    const c = solveBench([big, TUBE, GND, be, cell('c', 470, 300)], ELECTRIC).cells['c']!;
    expect(c.incoming).toBe('neutrons');
    expect(c.wR).toBe(17);
    expect(c.doseRateSvPerS).toBeCloseTo(c.doseRateGyPerS * 17, 12);
    expect(c.doseRateSvPerS * 3600).toBeGreaterThan(1e-4);
    expect(c.doseRateSvPerS * 3600).toBeLessThan(10);
  });
});
