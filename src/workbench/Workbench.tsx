import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkbench, readSnapshot } from './model.ts';
import { solveBench } from './solve.ts';
import { Palette } from './Palette.tsx';
import { Canvas } from './Canvas.tsx';
import { Dock } from './Dock.tsx';
import { Inspector } from './Inspector.tsx';
import { specOf, type PaletteEntry } from './catalog.ts';
import { DeviceGlyph, GlyphDefs } from './DeviceGlyph.tsx';
import { BenchScene } from '../scene/BenchScene.tsx';
import { useReducedMotion } from '../ui/useReducedMotion.ts';
import { useTranslation } from 'react-i18next';
import { useClock } from './clock.ts';
import { TimeControl } from './TimeControl.tsx';

/**
 * Tezgah duzeni: orta canvas, sagda palet + mikro gorunum, altta dock.
 * Paletten yerlestirme burada: pointer olaylari pencere duzeyinde dinlenir,
 * birakma noktasi canvas icindeyse cihaz eklenir.
 */
interface Placing {
  entry: PaletteEntry;
  x: number;
  y: number;
}

export function Workbench() {
  const devices = useWorkbench((s) => s.devices);
  const wires = useWorkbench((s) => s.wires);
  const addDevice = useWorkbench((s) => s.addDevice);
  const solution = useMemo(() => solveBench(devices, wires), [devices, wires]);
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  const [scene3d, setScene3d] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scene3d') !== 'off' && !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  });
  const toggle3d = () =>
    setScene3d((v) => {
      try { localStorage.setItem('scene3d', v ? 'off' : 'on'); } catch { /* yok say */ }
      return !v;
    });

  const benchRef = useRef<HTMLDivElement | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const placingRef = useRef<Placing | null>(null);
  placingRef.current = placing;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!placingRef.current) return;
      setPlacing({ ...placingRef.current, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const p = placingRef.current;
      if (!p) return;
      setPlacing(null);
      const r = benchRef.current?.getBoundingClientRect();
      if (!r) return;
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      const spec = specOf(p.entry.kind);
      addDevice(
        p.entry.kind,
        Math.max(0, e.clientX - r.left - spec.w / 2),
        Math.max(0, e.clientY - r.top - spec.h / 2),
        { ...p.entry.defaults },
      );
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [addDevice]);

  // Yavas saat: 10 Hz'de ilerler; notron alan hedeflerin akisi maruziyete yazilir.
  const solutionRef = useRef(solution);
  solutionRef.current = solution;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      if (acc >= 0.1) {
        const receiving: Record<string, number> = {};
        for (const [id, tg] of Object.entries(solutionRef.current.targets)) {
          if (tg.incoming === 'neutrons' && tg.neutronFluxPerM2S > 0) receiving[id] = tg.neutronFluxPerM2S;
        }
        for (const [id, cl] of Object.entries(solutionRef.current.cells)) {
          if (cl.doseRateGyPerS > 0) receiving[id] = cl.doseRateGyPerS;
        }
        useClock.getState().tick(acc, receiving);
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const snap = readSnapshot();
    if (snap && useWorkbench.getState().devices.length === 0 && snap.devices.length > 0) useWorkbench.getState().load(snap);
  }, []);

  const beginPlace = (entry: PaletteEntry, e: ReactPointerEvent) => {
    setPlacing({ entry, x: e.clientX, y: e.clientY });
  };

  return (
    <div>
    <TimeControl />
    <div className="bench-layout">
      <div className="bench-main" ref={benchRef}>
        {scene3d ? <BenchScene devices={devices} solution={solution} reduce={reduce} /> : null}
        <Canvas solution={solution} flat={!scene3d} />
        <button type="button" className={`scene-toggle ${scene3d ? 'on' : ''}`} onClick={toggle3d} title={t('app.scene3d')}>
          3D
        </button>
      </div>
      <div className="bench-side">
        <Palette onBeginPlace={beginPlace} />
        <Inspector solution={solution} />
      </div>
      <div className="bench-dock">
        <Dock solution={solution} />
      </div>

      {placing ? (
        <svg
          className="ghost"
          style={{ left: placing.x, top: placing.y }}
          width={specOf(placing.entry.kind).w}
          height={specOf(placing.entry.kind).h}
        >
          <GlyphDefs />
          <DeviceGlyph kind={placing.entry.kind} params={placing.entry.defaults} selected={false} active={false} />
        </svg>
      ) : null}
    </div>
    </div>
  );
}
