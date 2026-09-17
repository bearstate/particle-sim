import { useMemo } from 'react';
import * as THREE from 'three';
import { VDG_SPHERE, sphereRadiusPx, PX_PER_M } from '../../workbench/catalog.ts';
import type { VdgSolution } from '../../workbench/solve.ts';
import { Z, glowTexture, hdr } from '../util.ts';
import { Sparks3D } from '../fx/Sparks3D.tsx';

/**
 * Van de Graaff: metal kure, sutun, kayis, taban. Korona halesi gerilimle
 * buyur; delinmede turuncuya doner. Kivilcimlar Sparks3D'den.
 */
export function VanDeGraaff3D(props: { x: number; y: number; radiusM: number; sol: VdgSolution; reduce: boolean }) {
  const { x, y, radiusM, sol, reduce } = props;
  const r = sphereRadiusPx(radiusM);
  const cx = x + VDG_SPHERE.cx;
  const cy = -(y + VDG_SPHERE.cy);
  const columnTop = VDG_SPHERE.cy + r * 0.75;
  const columnH = 196 - columnTop;
  const charge = Math.min(1, sol.voltageV / Math.max(1, sol.maxV));
  const tex = useMemo(() => glowTexture(), []);
  const haloColor = sol.breakdown ? hdr('#ff8a3d', 2.2) : hdr('#4da3ff', 1.0 + charge * 1.6);
  const haloScale = (r + 30 + charge * 40) * 2;

  return (
    <group>
      {/* taban ve sutun */}
      <mesh position={[x + 60, -(y + 202), Z.device]}>
        <boxGeometry args={[60, 12, 24]} />
        <meshStandardMaterial color="#2a2f3a" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[x + 60, -(y + columnTop + columnH / 2), Z.device]}>
        <cylinderGeometry args={[9, 9, columnH, 24]} />
        <meshStandardMaterial color="#1c2028" metalness={0.2} roughness={0.7} transparent opacity={0.85} />
      </mesh>
      {/* kayis */}
      <mesh position={[x + 60, -(y + columnTop + columnH / 2), Z.device + 2]}>
        <boxGeometry args={[14, columnH - 16, 1]} />
        <meshStandardMaterial color="#3a2f26" roughness={0.9} />
      </mesh>
      {/* makaralar */}
      {[columnTop + 8, 188].map((py, i) => (
        <mesh key={i} position={[x + 60, -(y + py), Z.device + 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[9, 9, 6, 20]} />
          <meshStandardMaterial color="#4a5262" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* hale (additive sprite, bloom'a girer) */}
      <sprite position={[cx, cy, Z.device - 5]} scale={[haloScale, haloScale, 1]}>
        <spriteMaterial map={tex} color={haloColor} transparent opacity={0.16 + charge * 0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      {/* kure */}
      <mesh position={[cx, cy, Z.device + r * 0.2]}>
        <sphereGeometry args={[r, 48, 32]} />
        <meshStandardMaterial color="#7d8797" metalness={0.92} roughness={0.28} envMapIntensity={1} />
      </mesh>
      <Sparks3D cx={cx} cy={cy} radiusPx={r} lengthPx={sol.sparkM * PX_PER_M} ratePerS={sol.arcRatePerS} reduce={reduce} />
    </group>
  );
}
