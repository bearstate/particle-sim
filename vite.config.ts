import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // OneDrive'da yerel izleyici degisiklikleri kaciriyor; polling guvenilir.
    watch: { usePolling: true, interval: 300 },
    // SharedArrayBuffer cross-origin izolasyon gerektirir. Yoksa worker
    // protokolu otomatik olarak postMessage'a duser (src/sim/protocol.ts).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
