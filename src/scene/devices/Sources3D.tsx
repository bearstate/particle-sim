import { useMemo } from 'react';
import * as THREE from 'three';
import { LADDER, LINAC } from '../../workbench/catalog.ts';
import type { HvSolution, KlystronSolution, LinacSolution } from '../../workbench/solve.ts';
import { Z, glowTexture, hdr } from '../util.ts';
import { Sparks3D } from '../fx/Sparks3D.tsx';

const METAL = { color: '#8b95a5', metalness: 0.85, roughness: 0.4 } as const;
const DARK = { color: '#2a2f3a', metalness: 0.5, roughness: 0.6 } as const;

/** Cockcroft-Walton: iki kondansator sutunu (silindirler), gerilimle isiyan plakalar. */
export function CockcroftWalton3D(props: { x: number; y: number; sol: HvSolution; stages: number }) {
  const { x, y, sol } = props;
  const n = Math.max(1, Math.min(12, props.stages));
  const span = LADDER.bottom - LADDER.top - 20;
  const step = span / n;
  const charge = sol.idealV > 0 ? sol.voltageV / sol.idealV : 0;
  return (
    <group>
      <mesh position={[x + 75, -(y + 104), Z.device - 6]}>
        <boxGeometry args={[110, 190, 10]} />
        <meshStandardMaterial {...DARK} transparent opacity={0.9} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const cy = LADDER.bottom - 12 - i * step - step / 2;
        const glow = sol.delivered || sol.voltageV > 0 ? (0.2 + 0.8 * ((i + 1) / n)) * charge : 0;
        return [-26, 26].map((dx, k) => (
          <mesh key={`${i}-${k}`} position={[x + 75 + dx, -(y + cy + (k === 1 ? step / 2 : 0)), Z.device]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[9, 9, Math.max(6, step * 0.5), 20]} />
            <meshStandardMaterial color="#3d4656" metalness={0.6} roughness={0.5} emissive={hdr('#ff8a3d', 1)} emissiveIntensity={glow * 1.2} toneMapped={false} />
          </mesh>
        ));
      })}
    </group>
  );
}

/** Marx: kondansator yigini + kivilcim araliklari; darbe atarken araliklar cakar. */
export function Marx3D(props: { x: number; y: number; sol: HvSolution; stages: number; reduce: boolean }) {
  const { x, y, sol, reduce } = props;
  const n = Math.max(2, Math.min(20, props.stages));
  const span = LADDER.bottom - LADDER.top - 20;
  const step = span / n;
  return (
    <group>
      <mesh position={[x + 75, -(y + 104), Z.device - 6]}>
        <boxGeometry args={[110, 190, 10]} />
        <meshStandardMaterial {...DARK} transparent opacity={0.9} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const cy = LADDER.bottom - 12 - i * step - step * 0.55;
        return (
          <group key={i}>
            <mesh position={[x + 75, -(y + cy), Z.device]}>
              <boxGeometry args={[44, Math.max(5, step * 0.4), 14]} />
              <meshStandardMaterial color="#4a3f36" metalness={0.3} roughness={0.7} emissive={hdr('#ff8a3d', 1)} emissiveIntensity={sol.delivered ? 0.5 : 0.15} toneMapped={false} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[x + 109, -(y + cy + s * step * 0.25), Z.device + 4]}>
                <sphereGeometry args={[3, 12, 10]} />
                <meshStandardMaterial {...METAL} />
              </mesh>
            ))}
            {sol.delivered && sol.loadCurrentA > 0 ? (
              <Sparks3D cx={x + 109} cy={-(y + cy - step * 0.25)} radiusPx={0} lengthPx={step * 0.5} ratePerS={10} reduce={reduce} channelTo={{ x: x + 109, y: -(y + cy + step * 0.25) }} />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/** Klistron: govde + dalga kilavuzu; RF akarken cikis parlar. */
export function Klystron3D(props: { x: number; y: number; sol: KlystronSolution }) {
  const { x, y, sol } = props;
  const tex = useMemo(() => glowTexture(), []);
  return (
    <group>
      <mesh position={[x + 46, -(y + 42), Z.device]}>
        <cylinderGeometry args={[26, 26, 56, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[-14, 0, 14].map((dy) => (
        <mesh key={dy} position={[x + 46, -(y + 42 + dy), Z.device]}>
          <torusGeometry args={[27, 1.2, 8, 32]} />
          <meshStandardMaterial color="#3d4656" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[x + 93, -(y + 42), Z.device]}>
        <boxGeometry args={[30, 16, 16]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {sol.delivered ? (
        <sprite position={[x + 108, -(y + 42), Z.device + 10]} scale={[40, 40, 1]}>
          <spriteMaterial map={tex} color={hdr('#46d6c4', 2)} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ) : null}
    </group>
  );
}

/** LINAC: suruklenme tupleri (fizikten boy), bosluklarda RF parlamasi. */
export function Linac3D(props: { x: number; y: number; sol: LinacSolution }) {
  const { x, y, sol } = props;
  const lengths = sol.driftTubeLengthsM;
  const n = lengths.length;
  const total = lengths.reduce((a, b) => a + b, 0);
  const usable = LINAC.beamEndX - LINAC.beamStartX;
  const gapPx = Math.min(8, (usable / Math.max(1, n)) * 0.25);
  const scale = total > 0 ? (usable - gapPx * n) / total : 0;
  const ay = -(y + LINAC.axisY);
  const on = sol.beamCurrentA > 0;
  let cx = LINAC.beamStartX;
  const tubes: { x: number; w: number }[] = [];
  for (const l of lengths) { const w = Math.max(2, l * scale); tubes.push({ x: cx, w }); cx += w + gapPx; }
  return (
    <group>
      <mesh position={[x + 170, ay, Z.device - 4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[27, 27, 322, 28, 1, true]} />
        <meshPhysicalMaterial color="#9fb4d8" transparent opacity={0.1} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {tubes.map((t, i) => (
        <group key={i}>
          <mesh position={[x + t.x + t.w / 2, ay, Z.device]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[9, 9, t.w, 16]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          {on ? (
            <mesh position={[x + t.x + t.w + gapPx / 2, ay, Z.device]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[11, 11, gapPx, 12, 1, true]} />
              <meshBasicMaterial color={hdr(sol.arcing ? '#ff5a5a' : '#46d6c4', 1.8)} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}
