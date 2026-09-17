import { describe, it, expect } from 'vitest';
import { solveBench, firstHitToRight } from '../src/workbench/solve.ts';
import type { DeviceInstance, Wire } from '../src/workbench/model.ts';

const dev = (id: string, kind: DeviceInstance['kind'], x: number, y: number, params: Record<string, number | string>): DeviceInstance => ({ id, kind, x, y, params });
const wire = (id: string, kind: Wire['kind'], a: [string, string], b: [string, string]): Wire => ({ id, kind, from: { device: a[0], port: a[1] }, to: { device: b[0], port: b[1] } });

// Tup (0,100) kutusu 240x96, ekseni y=148. Hedef ekseni kesecek sekilde saga konur.
const VDG = (v: number, r = 0.15) => dev('vdg', 'vandegraaff', 0, 300, { voltage: v, radius: r, gas: 'air', pressure: 101325 });
const TUBE = dev('tube', 'tube', 0, 100, { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' });
const GND = dev('gnd', 'ground', 0, 520, {});
const ELECTRIC = [wire('w1', 'hv', ['vdg', 'hv'], ['tube', 'anode']), wire('w2', 'ground', ['gnd', 'gnd'], ['tube', 'cathode'])];
const target = (id: string, x: number, y: number, element: string) => dev(id, 'target', x, y, { element, thickness: 5 });

describe('isin kesisimi', () => {
  it('eksendeki en yakin cihazi bulur, eksen disindakini atlar', () => {
    const a = target('a', 400, 100, 'W');
    const b = target('b', 300, 400, 'W');
    const c2 = target('c', 600, 120, 'W');
    expect(firstHitToRight([TUBE, a, b, c2], 'tube', 240, 148)?.id).toBe('a');
    expect(firstHitToRight([TUBE, b], 'tube', 240, 148)).toBeNull();
  });
});

describe('tezgah cozucu', () => {
  it('kablosuz terminal ark atar; bagli terminal atmaz', () => {
    expect(solveBench([VDG(3e5)], []).vdgs['vdg']!.arcRatePerS).toBeGreaterThan(0);
    expect(solveBench([VDG(3e5), TUBE, GND], ELECTRIC).vdgs['vdg']!.arcRatePerS).toBe(0);
  });

  it('istenen gerilim tavani asarsa delinme: gerilim kirpilir, ark artar, buyuk kure kurtarir', () => {
    const v = solveBench([VDG(2e6, 0.15)], []).vdgs['vdg']!;
    expect(v.breakdown).toBe(true);
    expect(v.voltageV).toBeCloseTo(v.maxV, 6);
    expect(v.voltageV).toBeLessThan(2e6);
    expect(v.arcRatePerS).toBeGreaterThan(solveBench([VDG(3e5, 0.15)], []).vdgs['vdg']!.arcRatePerS);
    expect(solveBench([VDG(2e6, 0.8)], []).vdgs['vdg']!.breakdown).toBe(false);
  });

  it('demet kablo istemez: eksendeki hedef elektron alir, eksen disindaki almaz', () => {
    const s = solveBench([VDG(3e5), TUBE, GND, target('a', 420, 100, 'Be'), target('b', 420, 420, 'Be')], ELECTRIC);
    expect(s.tubes['tube']!.regime).toBe('vacuum');
    expect(s.targets['a']!.incoming).toBe('electrons');
    expect(s.targets['b']!.incoming).toBeNull();
    const electronSegs = s.beams.filter((b) => b.kind === 'electron');
    expect(electronSegs.length).toBe(2);
    expect(electronSegs[1]!.targetId).toBe('a');
  });

  it('300 kV: W esik alti, sadece X-isini; 1.8 MV: Be esik ustu, notron', () => {
    const low = solveBench([VDG(3e5), TUBE, GND, target('w', 420, 100, 'W')], ELECTRIC);
    expect(low.targets['w']!.event).toBe('below_threshold');
    expect(low.beams.some((b) => b.kind === 'xray')).toBe(true);
    expect(low.beams.some((b) => b.kind === 'neutron')).toBe(false);

    const high = solveBench([VDG(2e6, 0.6), TUBE, GND, target('be', 420, 100, 'Be')], ELECTRIC);
    expect(high.targets['be']!.electronEnergyMeV).toBeCloseTo(1.8, 6);
    expect(high.targets['be']!.event).toBe('photoneutron');
    expect(high.targets['be']!.product).toEqual({ Z: 4, A: 8 });
    expect(high.beams.some((b) => b.kind === 'neutron' && b.spray)).toBe(true);
  });

  it('yakin toryum notronlari yakalar, uzak toryum yakalamaz', () => {
    const be = target('be', 420, 100, 'Be');
    const s = solveBench([VDG(2e6, 0.6), TUBE, GND, be, target('th', 560, 260, 'Th')], ELECTRIC);
    expect(s.targets['th']!.incoming).toBe('neutrons');
    expect(s.targets['th']!.product).toEqual({ Z: 90, A: 233 });
    const s2 = solveBench([VDG(2e6, 0.6), TUBE, GND, be, target('th', 1200, 800, 'Th')], ELECTRIC);
    expect(s2.targets['th']!.incoming).toBeNull();
  });

  it('X-isini yolundaki ikinci hedef foton alir ama donusmez', () => {
    const s = solveBench([VDG(3e5), TUBE, GND, target('w', 420, 100, 'W'), target('pb', 700, 110, 'Pb')], ELECTRIC);
    expect(s.targets['pb']!.incoming).toBe('photons');
    expect(s.targets['pb']!.product).toBeNull();
  });

  it('gazli tup: delinme ustunde parilti/ark, altinda tikali; demet yok', () => {
    const neon = dev('tube', 'tube', 0, 100, { gas: 'ne', pressure: 200, cathodeElement: 'W', anodeElement: 'W' });
    const s1 = solveBench([VDG(3e5), neon, GND], ELECTRIC);
    expect(['glow', 'arc']).toContain(s1.tubes['tube']!.regime);
    expect(s1.beams.length).toBe(0);
    const sf6 = dev('tube', 'tube', 0, 100, { gas: 'sf6', pressure: 5e5, cathodeElement: 'W', anodeElement: 'W' });
    expect(solveBench([VDG(1e4), sf6, GND], ELECTRIC).tubes['tube']!.regime).toBe('blocked');
  });
});
