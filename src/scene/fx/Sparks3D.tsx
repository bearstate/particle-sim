import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Line2 } from 'three-stdlib';
import * as THREE from 'three';
import { Z } from '../util.ts';

/**
 * 3D kivilcimlar: drei Line (Line2, piksel genisligi) ile uc katmanli isik.
 * Uretim SVG katmaniyla ayni kurallar (Poisson hiz, rastgele cikis noktasi,
 * dallanma); opaklik useFrame'de ref uzerinden suruluyor, React yalnizca
 * dogum/olumde render eder. `channelTo` verilirse sabit iki nokta arasinda
 * surekli yenilenen ark kanali (tup 'arc' rejimi).
 */

interface Pt { x: number; y: number }
interface Spark { id: number; pts: [number, number, number][]; born: number; life: number; scale: number }

function jagged(a: Pt, b: Pt, depth: number, amp: number, out: Pt[]): void {
  if (depth === 0) { out.push(b); return; }
  const mid = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * amp, y: (a.y + b.y) / 2 + (Math.random() - 0.5) * amp };
  jagged(a, mid, depth - 1, amp * 0.55, out);
  jagged(mid, b, depth - 1, amp * 0.55, out);
}
function channel(a: Pt, b: Pt): Pt[] {
  const pts: Pt[] = [a];
  jagged(a, b, 5, Math.hypot(b.x - a.x, b.y - a.y) * 0.3, pts);
  return pts;
}
const to3 = (pts: Pt[]): [number, number, number][] => pts.map((p) => [p.x, p.y, Z.fx]);

const CORE = new THREE.Color(2.4, 2.8, 3.2);
const MID = new THREE.Color(0.9, 1.4, 2.6);
const HALO = new THREE.Color(0.25, 0.5, 1.4);

export function Sparks3D(props: {
  cx: number; cy: number; radiusPx: number; lengthPx: number; ratePerS: number; reduce: boolean;
  channelTo?: Pt;
}) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const idRef = useRef(0);
  const nextRef = useRef(0);
  const live = useRef(props);
  live.current = props;
  const mats = useRef(new Map<number, THREE.Material[]>());

  useFrame(({ clock }) => {
    const { cx, cy, radiusPx, lengthPx, ratePerS, reduce, channelTo } = live.current;
    if (reduce) return;
    const t = clock.elapsedTime * 1000;
    let changed = false;
    let list = sparks;
    if (ratePerS > 0 && lengthPx > 4 && t >= nextRef.current) {
      nextRef.current = t + (channelTo ? 70 + Math.random() * 60 : (-Math.log(1 - Math.random()) / ratePerS) * 1000);
      const fresh: Spark[] = [];
      if (channelTo) {
        fresh.push({ id: idRef.current++, pts: to3(channel({ x: cx, y: cy }, channelTo)), born: t, life: 150, scale: 1.1 });
      } else {
        let a = Math.random() * Math.PI * 2;
        if (Math.abs(a + Math.PI / 2) < 0.4) a += 0.9; // sutun asagida (y ters), o bolgeyi atla
        const start = { x: cx + Math.cos(a) * radiusPx, y: cy + Math.sin(a) * radiusPx };
        const dir = a + (Math.random() - 0.5) * 1.1;
        const len = lengthPx * (0.65 + Math.random() * 0.7);
        const end = { x: start.x + Math.cos(dir) * len, y: start.y + Math.sin(dir) * len };
        const main = channel(start, end);
        const life = 140 + Math.random() * 140;
        fresh.push({ id: idRef.current++, pts: to3(main), born: t, life, scale: 1 });
        const branches = Math.random() < 0.55 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;
        for (let b = 0; b < branches; b++) {
          const from = main[Math.floor(main.length * (0.3 + Math.random() * 0.4))]!;
          const bd = dir + (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.6);
          const bl = len * (0.35 + Math.random() * 0.3);
          fresh.push({ id: idRef.current++, pts: to3(channel(from, { x: from.x + Math.cos(bd) * bl, y: from.y + Math.sin(bd) * bl })), born: t, life: life * 0.8, scale: 0.6 });
        }
      }
      list = [...list, ...fresh].slice(-14);
      changed = true;
    }
    // Sonme: opaklik ease-out; omru dolanlari at.
    for (const s of list) {
      const age = (t - s.born) / s.life;
      const o = age >= 1 ? 0 : Math.pow(1 - age, 1.8);
      const m = mats.current.get(s.id);
      if (m) for (const mm of m) (mm as THREE.Material & { opacity: number }).opacity = o;
    }
    const alive = list.filter((s) => t - s.born < s.life);
    if (alive.length !== list.length) changed = true;
    if (changed) setSparks(alive);
  });

  if (props.reduce) return null;
  return (
    <group>
      {sparks.map((s) => (
        <group key={s.id}>
          {([[HALO, 9, 0.22], [MID, 3.5, 0.55], [CORE, 1.6, 1]] as const).map(([color, w, op], i) => (
            <Line
              key={i}
              points={s.pts}
              color={color}
              lineWidth={w * s.scale}
              transparent
              opacity={op}
              toneMapped={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              ref={(l: Line2 | null) => {
                if (!l) return;
                const arr = mats.current.get(s.id) ?? [];
                if (!arr.includes(l.material)) arr.push(l.material);
                mats.current.set(s.id, arr);
              }}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
