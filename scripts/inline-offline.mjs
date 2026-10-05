// Derlenmis uygulamayi tek bir HTML dosyasina gomer.
// Tarayicilar file:// altinda ayri JS modullerini yuklemez; JS ve CSS sayfanin
// icine alininca dosya cift tiklamayla, internetsiz acilir (USB, akilli tahta).
//
// Kullanim: node scripts/inline-offline.mjs <derleme-klasoru> [cikti-dosyasi]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? 'dist-offline');
const out = resolve(process.argv[3] ?? join(dir, 'parcacik-simulatoru.html'));

let html = readFileSync(join(dir, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, p) => {
  const css = readFileSync(join(dir, p), 'utf8');
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, p) => {
  // Gomulu kodda gecen "</script" etiketi sayfayi erken kapatmasin.
  const js = readFileSync(join(dir, p), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${js}\n</script>`;
});

const leftover = html.match(/(?:src|href)="\.\/assets\/[^"]+"/g);
if (leftover) {
  console.error('Gomulemeyen dosyalar kaldi:', leftover.join(', '));
  process.exit(1);
}

writeFileSync(out, html, 'utf8');
console.log(`${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
