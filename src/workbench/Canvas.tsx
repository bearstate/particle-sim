import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkbench, type PortKind, type PortRef } from './model.ts';
import { specOf, portOf, sphereRadiusPx, VDG_SPHERE, PX_PER_M } from './catalog.ts';
import { DeviceGlyph, GlyphDefs } from './DeviceGlyph.tsx';
import { gasProperties, type GasId } from '../physics/gas/gases.ts';
import { SparkLayer } from './fx/Sparks.tsx';
import { BeamLayer } from './fx/Beam.tsx';
import { useReducedMotion } from '../ui/useReducedMotion.ts';
import type { BenchSolution } from './solve.ts';

/**
 * Tezgah: cihazlar suruklenir, elektrik portlari kabloyla baglanir, tiklayinca
 * secilir. Demet kablo DEGIL: solve.ts geometriden turetir, BeamLayer cizer.
 */

const PORT_COLOR: Record<PortKind, string> = { hv: '#ff8a3d', ground: '#9aa3b5', beam: '#46d6c4' };

interface DragState { id: string; dx: number; dy: number }
interface WireDrag { from: PortRef; kind: PortKind; x0: number; y0: number; x: number; y: number }

export function Canvas(props: { solution: BenchSolution; flat?: boolean }) {
  const flat = props.flat ?? false;
  const devices = useWorkbench((s) => s.devices);
  const wires = useWorkbench((s) => s.wires);
  const selectedId = useWorkbench((s) => s.selectedId);
  const select = useWorkbench((s) => s.select);
  const moveDevice = useWorkbench((s) => s.moveDevice);
  const addWire = useWorkbench((s) => s.addWire);
  const reduce = useReducedMotion();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [wireDrag, setWireDrag] = useState<WireDrag | null>(null);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const portPos = (ref: PortRef) => {
    const d = devices.find((x) => x.id === ref.device);
    const p = d ? portOf(d.kind, ref.port, d.params) : undefined;
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
        if (spec && spec.kind === wireDrag.kind) addWire(wireDrag.kind, wireDrag.from, { device, port });
      }
    }
    setDrag(null);
    setWireDrag(null);
  };

  const cablePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const sag = 30 + Math.abs(a.x - b.x) * 0.15;
    return `M${a.x},${a.y} C${a.x},${a.y + sag} ${b.x},${b.y + sag} ${b.x},${b.y}`;
  };

  return (
    <svg ref={svgRef} className="bench" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerDown={() => select(null)}>
      <GlyphDefs />
      <defs>
        <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#161a22" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {flat ? <BeamLayer segments={props.solution.beams} reduce={reduce} /> : null}

      {wires.map((w) => {
        const a = portPos(w.from);
        const b = portPos(w.to);
        if (!a || !b) return null;
        return <path key={w.id} d={cablePath(a, b)} fill="none" stroke={PORT_COLOR[w.kind]} strokeWidth={w.kind === 'hv' ? 3 : 1.6} opacity={0.85} />;
      })}

      {wireDrag ? (
        <path d={cablePath({ x: wireDrag.x0, y: wireDrag.y0 }, { x: wireDrag.x, y: wireDrag.y })} fill="none" stroke={PORT_COLOR[wireDrag.kind]} strokeWidth={2} strokeDasharray="4 4" pointerEvents="none" />
      ) : null}

      {devices.map((d) => {
        const spec = specOf(d.kind);
        const v = props.solution.vdgs[d.id];
        const t = props.solution.tubes[d.id];
        const g = props.solution.targets[d.id];
        const active = d.kind === 'vandegraaff' ? (v?.voltageV ?? 0) > 0 : d.kind === 'tube' ? t?.regime === 'vacuum' : (g?.incoming ?? null) !== null;
        const heat = g ? Math.min(1, g.heatW / 40) : 0;
        const gas = t ? gasProperties(t.gas as GasId) : null;
        const fx = {
          ...(t ? { regime: t.regime, glowColor: gas?.glowColor || '#b48cff' } : {}),
          ...(v ? { breakdown: v.breakdown } : {}),
          reduce,
        };
        const radiusPx = d.kind === 'vandegraaff' ? sphereRadiusPx(typeof d.params['radius'] === 'number' ? (d.params['radius'] as number) : 0.15) : 0;
        return (
          <g key={d.id} transform={`translate(${d.x} ${d.y})`} onPointerDown={(e) => onDevicePointerDown(e, d.id)} style={{ cursor: drag?.id === d.id ? 'grabbing' : 'grab' }}>
            {flat ? (
              <DeviceGlyph kind={d.kind} params={d.params} selected={selectedId === d.id} active={active} heat={heat} fx={fx} />
            ) : (
              <g>
                {selectedId === d.id ? <rect x={-6} y={-6} width={spec.w + 12} height={spec.h + 12} rx={10} fill="none" stroke="#4da3ff" strokeDasharray="4 4" /> : null}
                <rect x={0} y={0} width={spec.w} height={spec.h} fill="transparent" />
                {d.kind === 'target' ? <text x={48} y={54} fill="#eef2f8" fontSize={16} fontWeight={600} textAnchor="middle" fontFamily="system-ui, sans-serif" pointerEvents="none">{String(d.params['element'] ?? 'W')}</text> : null}
                {d.kind === 'vandegraaff' ? <text x={60} y={VDG_SPHERE.cy + radiusPx + 14} fill="#868fa1" fontSize={9} textAnchor="middle" fontFamily="ui-monospace, monospace" pointerEvents="none">R {((typeof d.params['radius'] === 'number' ? (d.params['radius'] as number) : 0.15) * 100).toFixed(0)} cm</text> : null}
              </g>
            )}
            {v && flat ? (

              <SparkLayer cx={VDG_SPHERE.cx} cy={VDG_SPHERE.cy} radiusPx={radiusPx} lengthPx={v.sparkM * PX_PER_M} ratePerS={v.arcRatePerS} reduce={reduce} />
            ) : null}
            {spec.ports.map((p) => {
              const pos = portOf(d.kind, p.id, d.params) ?? p;
              return (
                <g key={p.id} transform={`translate(${pos.x} ${pos.y})`}>
                  <circle r={7} fill="#0a0c10" stroke={PORT_COLOR[p.kind]} strokeWidth={2} data-device={d.id} data-port={p.id} style={{ cursor: 'crosshair' }} onPointerDown={(e) => onPortPointerDown(e, { device: d.id, port: p.id }, p.kind)} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
