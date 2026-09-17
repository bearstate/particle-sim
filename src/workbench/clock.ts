import { create } from 'zustand';

/**
 * Simulasyon saati. Iki zaman olcegi var (PHYSICS.md bolum 3):
 * elektrik aninda (sabit durum, her karede yeniden cozulur), nukleer
 * donusum ise saatlerden yillara uzanir. Bu depo yalnizca YAVAS saati tutar:
 * kullanici 1x..1e9x hizlandirir; bozunma analitik oldugu icin hizlandirma
 * dogruluk kaybettirmez.
 *
 * Hedef basina maruziyet: notron alirken `irradiatedS`, almazken `cooledS`
 * artar. Envanter bu iki sureden Bateman ile turetilir (inventory.ts).
 */

export interface Exposure {
  readonly irradiatedS: number;
  readonly cooledS: number;
  /** Isinlama sirasindaki son aki, 1/(m^2 s). Sogurken bu deger korunur. */
  readonly fluxPerM2S: number;
}

export interface ClockState {
  readonly running: boolean;
  /** Gercek saniye basina sim saniyesi. */
  readonly timeScale: number;
  readonly simTimeS: number;
  readonly exposure: Readonly<Record<string, Exposure>>;
  tick(dtRealS: number, receiving: Readonly<Record<string, number>>): void;
  setTimeScale(scale: number): void;
  setRunning(on: boolean): void;
  reset(): void;
}

export const useClock = create<ClockState>((set) => ({
  running: true,
  timeScale: 1e4,
  simTimeS: 0,
  exposure: {},

  tick(dtRealS, receiving) {
    set((s) => {
      if (!s.running || dtRealS <= 0) return s;
      const dt = dtRealS * s.timeScale;
      const exposure: Record<string, Exposure> = { ...s.exposure };
      const ids = new Set([...Object.keys(exposure), ...Object.keys(receiving)]);
      for (const id of ids) {
        const prev = exposure[id] ?? { irradiatedS: 0, cooledS: 0, fluxPerM2S: 0 };
        const flux = receiving[id] ?? 0;
        exposure[id] = flux > 0
          ? { irradiatedS: prev.irradiatedS + dt, cooledS: 0, fluxPerM2S: flux }
          : { ...prev, cooledS: prev.cooledS + dt };
      }
      return { simTimeS: s.simTimeS + dt, exposure };
    });
  },
  setTimeScale(scale) { set({ timeScale: scale }); },
  setRunning(on) { set({ running: on }); },
  reset() { set({ simTimeS: 0, exposure: {} }); },
}));

/** Sim suresini okunur bicime cevirir: 12.3 s, 4.2 dk, 3.1 sa, 2.5 g, 1.4 y. */
export function formatSimTime(s: number, lang: 'tr' | 'en' = 'tr'): string {
  const u = lang === 'tr'
    ? { s: 's', min: 'dk', h: 'sa', d: 'gün', y: 'yıl' }
    : { s: 's', min: 'min', h: 'h', d: 'd', y: 'y' };
  if (s < 90) return `${s.toFixed(1)} ${u.s}`;
  if (s < 5400) return `${(s / 60).toFixed(1)} ${u.min}`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} ${u.h}`;
  if (s < 2 * 365.25 * 86400) return `${(s / 86400).toFixed(1)} ${u.d}`;
  return `${(s / (365.25 * 86400)).toFixed(2)} ${u.y}`;
}
