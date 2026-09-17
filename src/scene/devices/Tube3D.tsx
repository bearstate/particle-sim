import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TUBE } from '../../workbench/catalog.ts';
import type { TubeSolution } from '../../workbench/solve.ts';
import { Z } from '../util.ts';
import { Sparks3D } from '../fx/Sparks3D.tsx';

/**
 * Vakum tupu: cam silindir, katot, halka anot ve gaz rejimine gore plazma.
 * Plazma bir shader: pozitif sutunda kayan cizgilenme (striation), katot
 * karanlik uzayi, katot onunde negatif parilti. Renk gazin emisyon rengi.
 */

const PLASMA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PLASMA_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uStriate;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  // vUv.x: eksen boyunca (0 katot, 1 anot); vUv.y: cevre.
  float x = vUv.x;
  // Katot karanlik uzayi: ilk %7 karanlik, hemen onunde negatif parilti seridi.
  float dark = smoothstep(0.03, 0.10, x);
  float negGlow = exp(-pow((x - 0.02) / 0.012, 2.0)) * 1.6;
  // Cizgilenme: sutun boyunca kayan bantlar + yavas gurultu.
  float bands = 0.55 + 0.45 * sin(x * 42.0 - uTime * 6.0);
  float n = noise(vec2(x * 18.0 - uTime * 0.6, vUv.y * 4.0 + uTime * 0.2));
  float col = dark * (0.35 + 0.65 * mix(1.0, bands, uStriate)) * (0.7 + 0.5 * n);
  // Kenarlarda (silindir profili) hafif sonme: uv.y 0 ve 1 kenarlar.
  float rim = 0.75 + 0.25 * sin(vUv.y * 6.2831);
  float a = clamp((col + negGlow) * rim, 0.0, 1.0) * uIntensity;
  gl_FragColor = vec4(uColor * (1.2 + negGlow) * uIntensity, a * 0.85);
}`;

export function Tube3D(props: { x: number; y: number; sol: TubeSolution; glowColor: string; reduce: boolean }) {
  const { x, y, sol, glowColor, reduce } = props;
  const ay = -(y + TUBE.axisY);
  const mat = useRef<THREE.ShaderMaterial | null>(null);
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(glowColor) }, uTime: { value: 0 }, uIntensity: { value: 0 }, uStriate: { value: 1 } }),
    [],
  );
  useFrame((_, dt) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    if (!reduce) u['uTime']!.value += dt;
    u['uColor']!.value.set(glowColor);
    u['uIntensity']!.value = sol.regime === 'glow' ? 1 : sol.regime === 'blocked' ? 0.08 : 0;
  });
  const hot = sol.regime === 'vacuum' ? Math.min(1, sol.beamPowerW / 40) : 0;

  return (
    <group>
      {/* plazma sutunu: katot+16 .. anot-10 */}
      <mesh position={[x + (TUBE.cathodeX + 16 + TUBE.anodeX - 10) / 2, ay, Z.device]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[21, 21, TUBE.anodeX - 10 - (TUBE.cathodeX + 16), 32, 1, true]} />
        <shaderMaterial ref={mat} vertexShader={PLASMA_VERT} fragmentShader={PLASMA_FRAG} uniforms={uniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* cam govde */}
      <mesh position={[x + 120, ay, Z.device]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[26, 168, 8, 24]} />
        <meshPhysicalMaterial color="#9fb4d8" transparent opacity={0.14} roughness={0.15} metalness={0} clearcoat={1} clearcoatRoughness={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* katot: isinirsa kizarir */}
      <mesh position={[x + TUBE.cathodeX - 6, ay, Z.device]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 12, 20]} />
        <meshStandardMaterial color="#5a6270" metalness={0.8} roughness={0.4} emissive={new THREE.Color('#ff7a2a')} emissiveIntensity={hot * 2.5} toneMapped={false} />
      </mesh>
      {/* anot halkasi */}
      <mesh position={[x + TUBE.anodeX, ay, Z.device]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[12, 2.4, 12, 32]} />
        <meshStandardMaterial color="#c9cfd8" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* uc kapaklar / baglanti pimleri */}
      {[TUBE.cathodeX, TUBE.anodeX].map((px, i) => (
        <mesh key={i} position={[x + px, -(y + 22), Z.device + 4]}>
          <cylinderGeometry args={[2, 2, 18, 10]} />
          <meshStandardMaterial color="#9aa3b5" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {/* ark rejimi: elektrotlar arasi surekli kanal */}
      {sol.regime === 'arc' ? (
        <Sparks3D cx={x + TUBE.cathodeX + 4} cy={ay} radiusPx={0} lengthPx={TUBE.anodeX - 12 - TUBE.cathodeX} ratePerS={14} reduce={reduce} channelTo={{ x: x + TUBE.anodeX - 12, y: ay }} />
      ) : null}
    </group>
  );
}
