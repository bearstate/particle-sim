import { create } from 'zustand';

/**
 * Tezgah durumu. DESIGN.md "Katmanlar" ve "Portlar".
 *
 * Bu store yalnizca TOPOLOJIYI tutar: hangi cihaz nerede, hangi port hangi
 * porta bagli, hangi parametre ne. Fizik sonuclari (gerilim, sicaklik,
 * notron akisi) burada YASAMAZ; onlar her karede topolojiden turetilir
 * (workbench/solve.ts). Boylece kaydet/yukle/URL paylasimi bu store'un
 * serilestirilmesinden ibaret kalir.
 */

export type DeviceKind =
  | 'vandegraaff'
  | 'cockcroftwalton'
  | 'marx'
  | 'klystron'
  | 'linac'
  | 'tube'
  | 'target'
  | 'cell'
  | 'ground';
export type PortKind = 'hv' | 'ground' | 'rf' | 'beam';
export type ParamValue = number | string;

export interface PortRef {
  readonly device: string;
  readonly port: string;
}

export interface DeviceInstance {
  readonly id: string;
  readonly kind: DeviceKind;
  /** Tezgah koordinati, px. Sol ust kose. */
  readonly x: number;
  readonly y: number;
  readonly params: Readonly<Record<string, ParamValue>>;
}

export interface Wire {
  readonly id: string;
  readonly kind: PortKind;
  readonly from: PortRef;
  readonly to: PortRef;
}

export interface WorkbenchState {
  readonly devices: readonly DeviceInstance[];
  readonly wires: readonly Wire[];
  readonly selectedId: string | null;
  readonly nextId: number;

  addDevice(kind: DeviceKind, x: number, y: number, params: Record<string, ParamValue>): string;
  moveDevice(id: string, x: number, y: number): void;
  removeDevice(id: string): void;
  select(id: string | null): void;
  setParam(id: string, key: string, value: ParamValue): void;
  /** Ayni porta ikinci kablo gelirse eskisi kalkar; port tek kablo tasir. */
  addWire(kind: PortKind, from: PortRef, to: PortRef): void;
  removeWire(id: string): void;
  clear(): void;
  /** Kaydedilmis topolojiyi yukler (kaydet/yukle/URL). */
  load(snapshot: BenchSnapshot): void;
}

export interface BenchSnapshot {
  readonly devices: readonly DeviceInstance[];
  readonly wires: readonly Wire[];
  readonly nextId: number;
}

const STORAGE_KEY = 'bench.v1';

export function saveSnapshot(s: BenchSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ozel pencere veya dolu depo: sessizce gec */
  }
}

export function readSnapshot(): BenchSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BenchSnapshot;
    if (!Array.isArray(s.devices) || !Array.isArray(s.wires)) return null;
    return s;
  } catch {
    return null;
  }
}

function samePort(a: PortRef, b: PortRef): boolean {
  return a.device === b.device && a.port === b.port;
}

function touchesPort(w: Wire, p: PortRef): boolean {
  return samePort(w.from, p) || samePort(w.to, p);
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  devices: [],
  wires: [],
  selectedId: null,
  nextId: 1,

  addDevice(kind, x, y, params) {
    const id = `${kind}-${get().nextId}`;
    set((s) => ({
      devices: [...s.devices, { id, kind, x, y, params }],
      nextId: s.nextId + 1,
      selectedId: id,
    }));
    return id;
  },

  moveDevice(id, x, y) {
    set((s) => ({
      devices: s.devices.map((d) => (d.id === id ? { ...d, x, y } : d)),
    }));
  },

  removeDevice(id) {
    set((s) => ({
      devices: s.devices.filter((d) => d.id !== id),
      wires: s.wires.filter((w) => w.from.device !== id && w.to.device !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  select(id) {
    set({ selectedId: id });
  },

  setParam(id, key, value) {
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === id ? { ...d, params: { ...d.params, [key]: value } } : d,
      ),
    }));
  },

  addWire(kind, from, to) {
    if (samePort(from, to) || from.device === to.device) return;
    set((s) => {
      const kept = s.wires.filter((w) => !touchesPort(w, from) && !touchesPort(w, to));
      const id = `w-${s.nextId}`;
      return { wires: [...kept, { id, kind, from, to }], nextId: s.nextId + 1 };
    });
  },

  removeWire(id) {
    set((s) => ({ wires: s.wires.filter((w) => w.id !== id) }));
  },

  clear() {
    set({ devices: [], wires: [], selectedId: null });
  },

  load(snapshot) {
    set({ devices: [...snapshot.devices], wires: [...snapshot.wires], nextId: Math.max(1, snapshot.nextId), selectedId: null });
  },
}));

// Her degisiklikte (kisa gecikmeyle) yerel depoya yaz; yenilemede tezgah kaybolmasin.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useWorkbench.subscribe((s) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSnapshot({ devices: s.devices, wires: s.wires, nextId: s.nextId }), 300);
});

/** Bir portun bagli oldugu karsi ucu bulur (yoksa null). */
export function connectedTo(wires: readonly Wire[], port: PortRef): PortRef | null {
  for (const w of wires) {
    if (samePort(w.from, port)) return w.to;
    if (samePort(w.to, port)) return w.from;
  }
  return null;
}
