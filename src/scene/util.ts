import * as THREE from 'three';

/**
 * Sahne yardimcilari. Koordinat sozlesmesi: dunya = (x, -y, z), 1 birim = 1 px,
 * tezgah SVG'siyle birebir ortusur. z izleyiciye dogru (+).
 */

export const Z = { base: 0, device: 30, beam: 60, fx: 70 } as const;

let glowTex: THREE.Texture | null = null;

/** Radyal parilti dokusu (tek sefer uretilir). Hale, sprite ve parcaciklar icin. */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** '#rrggbb' -> THREE.Color, opsiyonel parlaklik carpani (bloom icin >1). */
export function hdr(hex: string, intensity = 1): THREE.Color {
  const c = new THREE.Color(hex);
  c.multiplyScalar(intensity);
  return c;
}
