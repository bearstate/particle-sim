import type { DeviceKind, ParamValue, PortKind } from './model.ts';

/**
 * Cihaz katalogu: boyut, portlar, parametre semasi ve GEOMETRI.
 * DESIGN.md "Portlar ve baglanti kurallari".
 *
 * Kablo yalnizca elektrikte vardir (hv, ground). Demet bir port DEGILDIR:
 * tup cikisindan sag yone ucar, onune ne gelirse ona carpar (solve.ts).
 *
 * Tezgah olcegi PX_PER_M: kure yaricapi ve ark uzunlugu buradan px'e doner.
 * Boylece "kureyi buyut -> daha yuksek gerilim -> daha uzun ark" zinciri
 * gozle gorulur.
 */

export const PX_PER_M = 400;

export interface PortSpec {
  readonly id: string;
  readonly kind: PortKind;
  readonly labelKey: string;
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
      readonly options: readonly string[];
    };

export interface DeviceSpec {
  readonly kind: DeviceKind;
  readonly w: number;
  readonly h: number;
  readonly ports: readonly PortSpec[];
  readonly params: readonly ParamSpec[];
  /** Demet cikis noktasi (cihaz kutusuna gore). Yoksa cihaz yaymaz. */
  readonly emitter?: { readonly x: number; readonly y: number };
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

/** Van de Graaff kure merkezi (cihaz kutusuna gore). */
export const VDG_SPHERE = { cx: 60, cy: 64 } as const;
/** Tup ekseni ve elektrot konumlari. */
export const TUBE = { axisY: 48, cathodeX: 28, anodeX: 218 } as const;

/** Kure cizim yaricapi, px. 15 cm -> 44 px, 60 cm -> 88 px (karekok: kutu tasmasin). */
export function sphereRadiusPx(radiusM: number): number {
  return 44 * Math.sqrt(Math.max(0.02, radiusM) / 0.15);
}

export const DEVICE_SPECS: Readonly<Record<DeviceKind, DeviceSpec>> = {
  vandegraaff: {
    kind: 'vandegraaff',
    w: 120,
    h: 210,
    ports: [{ id: 'hv', kind: 'hv', labelKey: 'port.hv', x: VDG_SPHERE.cx, y: VDG_SPHERE.cy - 44 }],
    params: [
      { key: 'voltage', labelKey: 'param.voltage', kind: 'number', min: 1e4, max: 3e6, step: 0.01, log: true, unit: 'V' },
      { key: 'radius', labelKey: 'param.radius', kind: 'number', min: 0.05, max: 1.0, step: 0.01, unit: 'cm', displayScale: 100, digits: 0 },
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
    ],
    params: [
      { key: 'gas', labelKey: 'param.gas', kind: 'enum', options: GAS_OPTIONS },
      { key: 'pressure', labelKey: 'param.pressure', kind: 'number', min: 1e-5, max: 1e5, step: 0.02, log: true, unit: 'Pa' },
      { key: 'cathodeElement', labelKey: 'param.cathodeElement', kind: 'element', options: ELECTRODE_ELEMENTS },
      { key: 'anodeElement', labelKey: 'param.anodeElement', kind: 'element', options: ELECTRODE_ELEMENTS },
    ],
    emitter: { x: 240, y: TUBE.axisY },
  },
  target: {
    kind: 'target',
    w: 96,
    h: 96,
    ports: [],
    params: [
      { key: 'element', labelKey: 'param.element', kind: 'element', options: TARGET_ELEMENTS },
      { key: 'thickness', labelKey: 'param.thickness', kind: 'number', min: 0.1, max: 50, step: 0.1, unit: 'mm', digits: 1 },
    ],
    emitter: { x: 48, y: 48 },
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
  { id: 'vandegraaff', kind: 'vandegraaff', labelKey: 'device.vandegraaff', defaults: { voltage: 300e3, radius: 0.15, gas: 'air', pressure: 101325 } },
  { id: 'tube', kind: 'tube', labelKey: 'device.tube', defaults: { gas: 'vacuum', pressure: 1e-3, cathodeElement: 'W', anodeElement: 'W' } },
  { id: 'target', kind: 'target', labelKey: 'device.target', defaults: { element: 'W', thickness: 2 } },
  { id: 'target_be', kind: 'target', labelKey: 'device.target_be', defaults: { element: 'Be', thickness: 5 } },
  { id: 'target_th', kind: 'target', labelKey: 'device.target_th', defaults: { element: 'Th', thickness: 20 } },
  { id: 'ground', kind: 'ground', labelKey: 'device.ground', defaults: {} },
];

export function specOf(kind: DeviceKind): DeviceSpec {
  return DEVICE_SPECS[kind];
}

/**
 * Port konumu (cihaz kutusuna gore). Van de Graaff'in hv portu kurenin
 * tepesini izler; kure buyuyunce port da yukari kayar.
 */
export function portOf(
  kind: DeviceKind,
  portId: string,
  params?: Readonly<Record<string, ParamValue>>,
): PortSpec | undefined {
  const p = DEVICE_SPECS[kind].ports.find((x) => x.id === portId);
  if (!p) return undefined;
  if (kind === 'vandegraaff' && portId === 'hv') {
    const r = typeof params?.['radius'] === 'number' ? (params['radius'] as number) : 0.15;
    return { ...p, y: VDG_SPHERE.cy - sphereRadiusPx(r) };
  }
  return p;
}
