import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkbench, type PortKind, type PortRef } from './model.ts';
import { specOf, portOf } from './catalog.ts';
import { DeviceGlyph, GlyphDefs } from './DeviceGlyph.tsx';
import type { BenchSolution } from './solve.ts';

/**
 * Tezgah: cihazlar suruklenir, portlar kabloyla baglanir, tiklayinca secilir.
 * DESIGN.md "Portlar ve baglanti kurallari".
 *
 * SVG kullanici birimi = piksel (viewBox yok); cihaz koordinatlari dogrudan px.
 */

const PORT_COLOR: Record<PortKind, string> = { hv: '#ff8a3d', ground: '#9aa3b5', beam: '#46d6c4' };
/** Tezgah olcegi: ark uzunlugunu px'e cevirir. */
const PX_PER_M = 400;

interface DragState {
  id: string;
  dx: number;
  dy: number;
}

interface WireDrag {
  from: PortRef;
  kind: PortKind;
  x0: number;
  y0: number;
  x: number;
  y: number;
}

function portCompatible(a: { kind: PortKind; id: string }, b: { kind: PortKind; id: string }): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'beam') {
    const out = (p: string) => p.endsWith('_out');
    return out(a.id) !== out(b.id);
  }
  return true;
}

export function Canvas(props: { solution: BenchSolution }) {
  const devices = useWorkbench((s) => s.devices);
  const wires = useWorkbench((s) => s.wires);
  const selectedId = useWorkbench((s) => s.selectedId);
  const select = useWorkbench((s) => s.select);
  const moveDevice = useWorkbench((s) => s.moveDevice);
  const addWire = useWorkbench((s) => s.addWire);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wireDrag, setWireDrag] = useState<WireDrag | null>(null);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const portPos = (ref: PortRef) => {
    const d = devices.find((x) => x.id === ref.device);
    const p = d ? portOf(d.kind, ref.port) : undefined;
    if (!d || !p) return null;
    return { x: d.x + p.x, y: d.y + p.y, kind: p.kind };
  };

  const onDevicePointerDown = (e: ReactPointerEvent, id: string) => {
    if ((e.target as Element).closest('[data-port]')) return;
    e.stopPropagation();
    const d = devices.find((x) => x.id === id);
    if (!d) return;
    const { x, y } = toLocal(e);
    select(id);
    setDrag({ id, dx: x - d.x, dy: y - d.y });
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPortPointerDown = (e: ReactPointerEvent, ref: PortRef, kind: PortKind) => {
    e.stopPropagation();
    const p = portPos(ref);
    if (!p) return;
    const { x, y } = toLocal(e);
    setWireDrag({ from: ref, kind, x0: p.x, y0: p.y, x, y });
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag) {
      const { x, y } = toLocal(e);
      moveDevice(drag.id, Math.max(0, x - drag.dx), Math.max(0, y - drag.dy));
    } else if (wireDrag) {
      const { x, y } = toLocal(e);
      setWireDrag({ ...wireDrag, x, y });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (wireDrag) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port]');
      const device = el?.getAttribute('data-device');
      const port = el?.getAttribute('data-port');
      if (device && port) {
        const d = devices.find((x) => x.id === device);
        const spec = d ? portOf(d.kind, port) : undefined;
        const fromDev = devices.find((x) => x.id === wireDrag.from.device);
        const fromSpec = fromDev ? portOf(fromDev.kind, wireDrag.from.port) : undefined;
        if (spec && fromSpec && portCompatible(fromSpec, spec)) {
          addWire(wireDrag.kind, wireDrag.from, { device, port });
        }
      }
    }
    setDrag(null);
    setWireDrag(null);
  };

  const cablePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const sag = 30 + Math.abs(a.x - b.x) * 0.15;
    return `M${a.x},${a.y} C${a.x},${a.y + sag} ${b.x},${b.y + sag} ${b.x},${b.y}`;
  };

  const beamActive = (from: PortRef) =>
    props.solution.tubes[from.device]?.regime === 'vacuum' ||
    (props.solution.targets[from.device]?.neutronYieldPerS ?? 0) > 0;

  return (
    <svg
      ref={svgRef}
      className="bench"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={() => select(null)}
    >
      <GlyphDefs />
      <defs>
        <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#161a22" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* kablolar ve demet hatlari */}
      {wires.map((w) => {
        const a = portPos(w.from);
        const b = portPos(w.to);
        if (!a || !b) return null;
        if (w.kind === 'beam') {
          const active = beamActive(w.from) || beamActive(w.to);
          return (
            <line
              key={w.id}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? '#8fe9dc' : '#2b5a55'}
              strokeWidth={active ? 2 : 1.2}
              strokeDasharray="6 8"
              className={active ? 'beam-run' : ''}
            />
          );
        }
        return (
          <path
            key={w.id}
            d={cablePath(a, b)}
            fill="none"
            stroke={PORT_COLOR[w.kind]}
            strokeWidth={w.kind === 'hv' ? 3 : 1.6}
            opacity={0.85}
          />
        );
      })}

      {wireDrag ? (
        <path
          d={wireDrag.kind === 'beam' ? `M${wireDrag.x0},${wireDrag.y0} L${wireDrag.x},${wireDrag.y}` : cablePath({ x: wireDrag.x0, y: wireDrag.y0 }, { x: wireDrag.x, y: wireDrag.y })}
          fill="none"
          stroke={PORT_COLOR[wireDrag.kind]}
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      ) : null}

      {/* cihazlar */}
      {devices.map((d) => {
        const spec = specOf(d.kind);
        const v = props.solution.vdgs[d.id];
        const t = props.solution.tubes[d.id];
        const g = props.solution.targets[d.id];
        const active = d.kind === 'vandegraaff' ? (v?.voltageV ?? 0) > 0 : d.kind === 'tube' ? t?.regime === 'vacuum' : (g?.incoming ?? null) !== null;
        const heat = g ? Math.min(1, g.heatW / 40) : 0;
        const sparkPx = v ? v.sparkM * PX_PER_M : 0;
        return (
          <g
            key={d.id}
            transform={`translate(${d.x} ${d.y})`}
            onPointerDown={(e) => onDevicePointerDown(e, d.id)}
            style={{ cursor: drag?.id === d.id ? 'grabbing' : 'grab' }}
          >
            <DeviceGlyph kind={d.kind} params={d.params} selected={selectedId === d.id} active={active} heat={heat} />
            {sparkPx > 4 ? (
              <g className="spark" pointerEvents="none">
                <polyline points={sparkFrom(60 + 44, 52, sparkPx, 1)} fill="none" stroke="#dff3ff" strokeWidth={1.4} />
                <polyline points={sparkFrom(60 - 31, 52 - 31, sparkPx, -1)} fill="none" stroke="#9ec8ff" strokeWidth={1.1} />
              </g>
            ) : null}
            {spec.ports.map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                <circle
                  r={7}
                  fill="#0a0c10"
                  stroke={PORT_COLOR[p.kind]}
                  strokeWidth={2}
                  data-device={d.id}
                  data-port={p.id}
                  style={{ cursor: 'crosshair' }}
                  onPointerDown={(e) => onPortPointerDown(e, { device: d.id, port: p.id }, p.kind)}
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Sabit desenli zikzak; canli ark 3D katmanin isi. Yon: +1 saga, -1 sol-yukari. */
function sparkFrom(x0: number, y0: number, len: number, dir: 1 | -1): string {
  const pts: string[] = [];
  const steps = 7;
  const ang = dir === 1 ? 0.15 : -2.3;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const wobble = i === 0 || i === steps ? 0 : (i % 2 === 0 ? 1 : -1) * len * 0.12;
    const x = x0 + Math.cos(ang) * len * f - Math.sin(ang) * wobble;
    const y = y0 + Math.sin(ang) * len * f + Math.cos(ang) * wobble;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}
