import { useMemo } from 'react';
import * as THREE from 'three';
import type { TargetSolution } from '../../workbench/solve.ts';
import { blackbodyLinearRgb, glowIntensity } from '../../physics/thermal/blackbody.ts';
import { Z, glowTexture } from '../util.ts';

/** Hedef levha: metal; isinirsa kara cisim rengiyle (fizikten) isir ve bloom'a girer. */
export function Target3D(props: { x: number; y: number; sol: TargetSolution }) {
  const { x, y, sol } = props;
  const tex = useMemo(() => glowTexture(), []);
  // T^4 sinirsiz buyur; goz ve bloom icin doyuma sok (erime noktasinda en cok 2.5).
  const glow = Math.min(2.5, Math.sqrt(glowIntensity(sol.tempK, 1600)));
  const emissive = useMemo(() => {
    const [r, g, b] = blackbodyLinearRgb(Math.max(800, sol.tempK));
    return new THREE.Color(r, g, b);
  }, [sol.tempK]);
  const hot = glow > 0;
  return (
    <group>
      <mesh position={[x + 48, -(y + 48), Z.device]}>
        <boxGeometry args={[36, 68, 18]} />
        <meshStandardMaterial
          color={sol.element.Z >= 90 ? '#5a5f6b' : '#8b95a5'}
          metalness={0.85}
          roughness={0.4}
          emissive={emissive}
          emissiveIntensity={hot ? 0.5 + glow * 1.3 : 0}
          toneMapped={false}
        />
      </mesh>
      {hot ? (
        <sprite position={[x + 48, -(y + 48), Z.device + 12]} scale={[110 + glow * 36, 140 + glow * 36, 1]}>
          <spriteMaterial map={tex} color={emissive} transparent opacity={0.1 + glow * 0.1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ) : null}
      {/* tutucu */}
      <mesh position={[x + 48, -(y + 88), Z.device - 4]}>
        <boxGeometry args={[4, 14, 4]} />
        <meshStandardMaterial color="#4a5262" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[x + 48, -(y + 94), Z.device - 4]}>
        <boxGeometry args={[28, 3, 8]} />
        <meshStandardMaterial color="#4a5262" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Petri kabi: cam disk, icinde mor jel ve hucre; isinim gelince kizil hale. */
export function Dish3D(props: { x: number; y: number; active: boolean }) {
  const { x, y, active } = props;
  const tex = useMemo(() => glowTexture(), []);
  return (
    <group>
      <mesh position={[x + 48, -(y + 56), Z.device]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <cylinderGeometry args={[34, 34, 6, 32]} />
        <meshPhysicalMaterial color="#9fb4d8" transparent opacity={0.25} roughness={0.1} clearcoat={1} />
      </mesh>
      <mesh position={[x + 48, -(y + 55), Z.device + 3]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <cylinderGeometry args={[30, 30, 2, 32]} />
        <meshStandardMaterial color="#6b4a9a" roughness={0.6} emissive={new THREE.Color('#5b3f8a')} emissiveIntensity={0.4} />
      </mesh>
      {active ? (
        <sprite position={[x + 48, -(y + 52), Z.device + 8]} scale={[80, 80, 1]}>
          <spriteMaterial map={tex} color={new THREE.Color(2, 0.5, 0.5)} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ) : null}
    </group>
  );
}

/** Toprak sembolu: uc azalan cubuk ve dikey baglanti. */
export function Ground3D(props: { x: number; y: number }) {
  const { x, y } = props;
  const bars: [number, number][] = [[36, 24], [24, 32], [12, 40]];
  return (
    <group>
      <mesh position={[x + 32, -(y + 14), Z.device]}>
        <boxGeometry args={[3, 20, 3]} />
        <meshStandardMaterial color="#9aa3b5" metalness={0.7} roughness={0.4} />
      </mesh>
      {bars.map(([w, py], i) => (
        <mesh key={i} position={[x + 32, -(y + py), Z.device]}>
          <boxGeometry args={[w, 3, 4]} />
          <meshStandardMaterial color="#9aa3b5" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
