import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BeamSegment } from '../../workbench/solve.ts';
import { Z } from '../util.ts';

/**
 * Demet parcaciklari: konum VERTEX SHADER'DA analitik olarak hesaplanir
 * (t = frac(faz + zaman*hiz/uzunluk)); kare basina CPU isi sifir, tek
 * uniform guncellenir. PHYSICS.md bolum 3 "makro-parcacik".
 */

const VERT = /* glsl */ `
attribute float aSeed;
attribute float aPhase;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform float uSpeed;
uniform float uJitter;
uniform float uSize;
uniform float uSpray;
uniform float uSprayLen;
varying float vAlpha;
varying float vSeed;
void main() {
  float len = max(1.0, distance(uA, uB));
  vec3 dir = normalize(uB - uA + vec3(1e-4, 0.0, 0.0));
  vec3 side = vec3(-dir.y, dir.x, 0.0);
  float speed = uSpeed * (0.75 + 0.5 * aSeed);
  float t = fract(aPhase + uTime * speed / len);
  float j = sin(uTime * 30.0 * (0.6 + aSeed) + aSeed * 6.2831) * uJitter * (0.4 + aSeed);
  vec3 p = uA + dir * len * t + side * j;
  if (uSpray > 0.5) {
    float ang = aSeed * 6.2831;
    float sl = uSprayLen * (0.6 + 0.6 * fract(aSeed * 7.31));
    t = fract(aPhase + uTime * speed / sl);
    p = uA + vec3(cos(ang), sin(ang), 0.0) * sl * t;
  }
  vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.82, 1.0, t));
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.8 + 0.4 * aSeed);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStreak;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // Cizgi (X-isini) veya yumusak disk.
  float d = uStreak > 0.5 ? max(abs(c.y) * 3.0, abs(c.x) * 0.9) : length(c) * 2.0;
  float a = smoothstep(1.0, 0.25, d) * vAlpha * (0.6 + 0.4 * vSeed);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const STYLE: Record<BeamSegment['kind'], { color: THREE.Color; count: number; speed: number; jitter: number; size: number; streak: number }> = {
  electron: { color: new THREE.Color(1.6, 2.2, 2.8), count: 16, speed: 210, jitter: 2.2, size: 5, streak: 0 },
  proton: { color: new THREE.Color(2.8, 1.6, 1.0), count: 14, speed: 170, jitter: 1.4, size: 7, streak: 0 },
  xray: { color: new THREE.Color(1.6, 1.1, 2.6), count: 10, speed: 520, jitter: 1, size: 9, streak: 1 },
  neutron: { color: new THREE.Color(1.3, 1.5, 1.6), count: 14, speed: 110, jitter: 1.5, size: 7, streak: 0 },
};

function Segment(props: { s: BeamSegment; reduce: boolean }) {
  const { s, reduce } = props;
  const st = STYLE[s.kind];
  const count = Math.max(4, Math.round(st.count * (0.4 + 0.6 * s.intensity)));
  const mat = useRef<THREE.ShaderMaterial | null>(null);

  const { geometry, uniforms } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const phase = new Float32Array(count);
    let h = 2166136261;
    for (const ch of `${s.sourceId}:${s.kind}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    let a = h >>> 0;
    const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < count; i++) { seed[i] = rnd(); phase[i] = rnd(); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    // Frustum: parcaciklar shader'da tasindigi icin kirpmayi kapat.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
    const u = {
      uTime: { value: 0 },
      uA: { value: new THREE.Vector3(s.x1, -s.y1, Z.beam) },
      uB: { value: new THREE.Vector3(s.x2, -s.y2, Z.beam) },
      uSpeed: { value: st.speed },
      uJitter: { value: st.jitter },
      uSize: { value: st.size },
      uSpray: { value: s.spray ? 1 : 0 },
      uSprayLen: { value: 170 },
      uColor: { value: st.color },
      uStreak: { value: st.streak },
    };
    return { geometry: g, uniforms: u };
  }, [count, s.kind, s.sourceId, s.spray]);

  useFrame((_, dt) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    if (!reduce) u['uTime']!.value += dt;
    (u['uA']!.value as THREE.Vector3).set(s.x1, -s.y1, Z.beam);
    (u['uB']!.value as THREE.Vector3).set(s.x2, -s.y2, Z.beam);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

export function Beam3D(props: { segments: readonly BeamSegment[]; reduce: boolean }) {
  return (
    <group>
      {props.segments.map((s, i) => (
        <Segment key={`${s.sourceId}-${s.kind}-${s.spray ? 's' : 'd'}-${i}`} s={s} reduce={props.reduce} />
      ))}
    </group>
  );
}
