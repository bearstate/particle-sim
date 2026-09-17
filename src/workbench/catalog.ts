import type { DeviceKind, ParamValue, PortKind } from './model.ts';

/**
 * Cihaz katalogu: her turun boyutu, portlari ve parametre semasi.
 * DESIGN.md "Portlar ve baglanti kurallari".
 *
 * Yeni cihaz eklemek = buraya bir DeviceSpec + palete bir giris.
 * Dock kontrolleri `params` semasindan OTOMATIK uretilir; ayrica panel yazilmaz.
 */

export interface PortSpec {
  readonly id: string;
  readonly kind: PortKind;
  readonly labelKey: string;
  /** Cihaz kutusuna gore konum, px. */
  readonly x: number;
  readonly y: number;
}

export type ParamSpec =
  | {
      readonly key: string;
      readonly labelKey: string;
      readonly kind: 'number';
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly log?: boolean;
      readonly unit: string;
      /** Gosterim carpani: metre -> cm icin 100. */
      readonly displayScale?: number;
      readonly digits?: number;
    }
  | {
      readonly key: string;
      readonly labelKey: string;
      readonly kind: 'enum';
      readonly options: readonly { readonly value: string; readonly labelKey: string }[];
    }
  | {
      readonly key: string;
      readonly labelKey: string;
      readonly kind: 'element';
      /** Secilebilir semboller. */
      readonly options: readonly string[];
    };

export interface DeviceSpec {
  readonly kind: DeviceKind;
  readonly w: number;
  readonly h: number;
  readonly ports: readonly PortSpec[];
  readonly params: readonly ParamSpec[];
}

export interface PaletteEntry {
  readonly id: string;
  readonly kind: DeviceKind;
  readonly labelKey: string;
  readonly defaults: Readonly<Record<string, ParamValue>>;
}

const GAS_OPTIONS = ['vacuum', 'air', 'n2', 'ar', 'ne', 'he', 'sf6', 'co2'].map((g) => ({
  value: g,
  labelKey: `gas.${g}`,
}));

const TARGET_ELEMENTS = ['Be', 'C', 'Al', 'Cu', 'Mo', 'Ta', 'W', 'Au', 'Pb', 'Th', 'U'];
const ELECTRODE_ELEMENTS = ['W', 'Ta', 'Mo', 'Ni', 'Cu', 'Al', 'Pb', 'Sn', 'In'];

export const DEVICE_SPECS: Readonly<Record<DeviceKind, DeviceSpec>> = {
  vandegraaff: {
    kind: 'vandegraaff',
    w: 120,
    h: 210,
    ports: [{ id: 'hv', kind: 'hv', labelKey: 'port.hv', x: 60, y: 8 }],
    params: [
      { key: 'voltage', labelKey: 'param.voltage', kind: 'number', min: 1e4, max: 2e6, step: 0.01, log: true, unit: 'V' },
      { key: 'radius', labelKey: 'param.radius', kind: 'number', min: 0.05, max: 0.6, step: 0.01, unit: 'cm', displayScale: 100, digits: 0 },
      { key: 'gas', labelKey: 'param.gas', kind: 'enum', options: GAS_OPTIONS.filter((g) => g.value !== 'vacuum') },
      { key: 'pressure', labelKey: 'param.pressure', kind: 'number', min: 1e2, max: 1e6, step: 0.02, log: true, unit: 'Pa' },
    ],
  },
  tube: {
    kind: 'tube',
    w: 240,
    h: 96,
    ports: [
      { id: 'cathode', kind: 'ground', labelKey: 'port.cathode', x: 22, y: 12 },
      { id: 'anode', kind: 'hv', labelKey: 'port.anode', x: 218, y: 12 },
      { id: 'beam_out', kind: 'beam', labelKey: 'port.beam_out', x: 240, y: 48 },
    ],
    params: [
      { key: 'gas', labelKey: 'param.gas', kind: 'enum', options: GAS_OPTIONS },
      { key: 'pressure', labelKey: 'param.pressure', kind: 'number', min: 1e-5, max: 1e5, step: 0.02, log: true, unit: 'Pa' },
      { key: 'cathodeElement', labelKey: 'param.cathodeElement', kind: 'element', options: ELECTRODE_ELEMENTS },
      { key: 'anodeElement', labelKey: 'param.anodeElement', kind: 'element', options: ELECTRODE_ELEMENTS },
    ],
  },
  target: {
    kind: 'target',
    w: 96,
    h: 96,
    ports: [
      { id: 'beam_in', kind: 'beam', labelKey: 'port.beam_in', x: 0, y: 48 },
      { id: 'beam_out', kind: 'beam', labelKey: 'port.beam_out', x: 96, y: 48 },
    ],
    params: [
      { key: 'element', labelKey: 'param.element', kind: 'element', options: TARGET_ELEMENTS },
      { key: 'thickness', labelKey: 'param.thickness', kind: 'number', min: 0.1, max: 50, step: 0.1, unit: 'mm', digits: 1 },
    ],
  },
  ground: {
    kind: 'ground',
    w: 64,
    h: 52,
    ports: [{ id: 'gnd', kind: 'ground', labelKey: 'port.ground', x: 32, y: 4 }],
    params: [],
  },
};

export const PALETTE: readonly PaletteEntry[] = [
  {
    id: 'vandegraaff',
    kind: 'vandegraaff',
    labelKey: 'device.vandegraaff',
    defaults: { voltage: 300e3, radius: 0.15, gas: 'air', pressure: 101325 },
  },
  {
    id: 'tube',
    kind: 'tube',
    labelKey: 'device.tube',
    defaults: { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' },
  },
  { id: 'target', kind: 'target', labelKey: 'device.target', defaults: { element: 'W', thickness: 2 } },
  { id: 'target_be', kind: 'target', labelKey: 'device.target_be', defaults: { element: 'Be', thickness: 5 } },
  { id: 'target_th', kind: 'target', labelKey: 'device.target_th', defaults: { element: 'Th', thickness: 20 } },
  { id: 'ground', kind: 'ground', labelKey: 'device.ground', defaults: {} },
];

export function specOf(kind: DeviceKind): DeviceSpec {
  return DEVICE_SPECS[kind];
}

export function portOf(kind: DeviceKind, portId: string): PortSpec | undefined {
  return DEVICE_SPECS[kind].ports.find((p) => p.id === portId);
}
