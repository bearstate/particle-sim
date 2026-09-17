import { useWorkbench, type DeviceKind, type ParamValue } from './model.ts';
import { PALETTE } from './catalog.ts';

/**
 * Hazir kurulumlar: tek tikla anlatilan hikayeyi kurar. Her biri paletteki
 * varsayilanlari kullanir, yalnizca konum ve birkac parametreyi degistirir.
 */

export interface Preset {
  readonly id: string;
  readonly labelKey: string;
  readonly build: () => void;
}

function defaultsOf(entryId: string): Record<string, ParamValue> {
  const e = PALETTE.find((p) => p.id === entryId);
  return e ? { ...e.defaults } : {};
}

function add(kind: DeviceKind, entryId: string, x: number, y: number, override: Record<string, ParamValue> = {}): string {
  return useWorkbench.getState().addDevice(kind, x, y, { ...defaultsOf(entryId), ...override });
}

function wire(kind: 'hv' | 'ground' | 'rf', a: [string, string], b: [string, string]): void {
  useWorkbench.getState().addWire(kind, { device: a[0], port: a[1] }, { device: b[0], port: b[1] });
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'vdg-be-th',
    labelKey: 'preset.vdgBe',
    build() {
      const s = useWorkbench.getState();
      s.clear();
      const vdg = add('vandegraaff', 'vandegraaff', 40, 90, { voltage: 2e6, radius: 0.6 });
      const gnd = add('ground', 'ground', 70, 400);
      const tube = add('tube', 'tube', 215, 130);
      add('target', 'target_be', 500, 130);
      add('target', 'target_th', 560, 290);
      wire('hv', [vdg, 'hv'], [tube, 'anode']);
      wire('ground', [gnd, 'gnd'], [tube, 'cathode']);
      s.select(null);
    },
  },
  {
    id: 'linac-w-th',
    labelKey: 'preset.linacW',
    build() {
      const s = useWorkbench.getState();
      s.clear();
      const kl = add('klystron', 'klystron', 30, 340);
      const ln = add('linac', 'linac', 70, 130);
      const gnd = add('ground', 'ground', 60, 470);
      add('target', 'target', 460, 130);
      add('target', 'target_th', 520, 290);
      wire('rf', [kl, 'rf'], [ln, 'rf']);
      wire('ground', [gnd, 'gnd'], [ln, 'cathode']);
      s.select(null);
    },
  },
  {
    id: 'glow',
    labelKey: 'preset.glow',
    build() {
      const s = useWorkbench.getState();
      s.clear();
      const vdg = add('vandegraaff', 'vandegraaff', 40, 90, { voltage: 3e5 });
      const gnd = add('ground', 'ground', 70, 400);
      const tube = add('tube', 'tube', 215, 130, { gas: 'ne', pressure: 200 });
      wire('hv', [vdg, 'hv'], [tube, 'anode']);
      wire('ground', [gnd, 'gnd'], [tube, 'cathode']);
      s.select(tube);
    },
  },
  {
    id: 'cw-w',
    labelKey: 'preset.cwW',
    build() {
      const s = useWorkbench.getState();
      s.clear();
      const cwd = add('cockcroftwalton', 'cockcroftwalton', 30, 90, { stages: 6, inputPeakV: 1.5e5 });
      const gnd = add('ground', 'ground', 60, 420);
      const tube = add('tube', 'tube', 215, 130);
      add('target', 'target', 500, 130);
      wire('hv', [cwd, 'hv'], [tube, 'anode']);
      wire('ground', [gnd, 'gnd'], [tube, 'cathode']);
      wire('ground', [gnd, 'gnd'], [cwd, 'gnd']);
      s.select(null);
    },
  },
];
