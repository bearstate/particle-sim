import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DeviceInstance } from '../workbench/model.ts';
import type { BenchSolution } from '../workbench/solve.ts';
import { gasProperties, type GasId } from '../physics/gas/gases.ts';
import { VanDeGraaff3D } from './devices/VanDeGraaff3D.tsx';
import { Tube3D } from './devices/Tube3D.tsx';
import { Target3D, Ground3D } from './devices/Simple3D.tsx';
import { Beam3D } from './fx/Beam3D.tsx';

/**
 * Sahne katmani: tezgah SVG'sinin ALTINDA, ayni piksel koordinatlarinda,
 * sabit ortografik kamera. DESIGN.md "Katmanlar".
 *
 * Etkilesim yok (pointer-events: none); SVG secim/kablo/port cizer. Bu katman
 * ayni durumu isik, malzeme, bloom ve GPU parcaciklariyla cizer.
 */

/** Prosedurel ortam haritasi (RoomEnvironment): metaller agsiz yansir. */
function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function BenchCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.left = 0;
    cam.right = size.width;
    cam.top = 0;
    cam.bottom = -size.height;
    cam.near = -2000;
    cam.far = 2000;
    cam.position.set(0, 0, 500);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export function BenchScene(props: {
  devices: readonly DeviceInstance[];
  solution: BenchSolution;
  reduce: boolean;
}) {
  const { devices, solution, reduce } = props;
  return (
    <div className="scene-canvas" aria-hidden="true">
      <Canvas
        orthographic
        flat
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
        frameloop={reduce ? 'demand' : 'always'}
        style={{ background: 'transparent' }}
      >
        <BenchCamera />
        <Env />
        <hemisphereLight args={[0x9fb4d8, 0x0a0c10, 0.55]} />
        <directionalLight position={[-300, 500, 700]} intensity={1.3} />
        <directionalLight position={[600, -200, 300]} intensity={0.25} color={0x8fb3ff} />

        {devices.map((d) => {
          const v = solution.vdgs[d.id];
          const t = solution.tubes[d.id];
          const g = solution.targets[d.id];
          if (d.kind === 'vandegraaff' && v) {
            const radiusM = typeof d.params['radius'] === 'number' ? (d.params['radius'] as number) : 0.15;
            return <VanDeGraaff3D key={d.id} x={d.x} y={d.y} radiusM={radiusM} sol={v} reduce={reduce} />;
          }
          if (d.kind === 'tube' && t) {
            const glow = gasProperties(t.gas as GasId).glowColor || '#b48cff';
            return <Tube3D key={d.id} x={d.x} y={d.y} sol={t} glowColor={glow} reduce={reduce} />;
          }
          if (d.kind === 'target' && g) return <Target3D key={d.id} x={d.x} y={d.y} sol={g} />;
          if (d.kind === 'ground') return <Ground3D key={d.id} x={d.x} y={d.y} />;
          return null;
        })}

        <Beam3D segments={solution.beams} reduce={reduce} />

        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1} luminanceSmoothing={0.25} mipmapBlur intensity={0.9} radius={0.6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
