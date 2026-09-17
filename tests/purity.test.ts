import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fizik cekirdeginin SAF kalmasini zorlayan bekci test.
 *
 * Tek paketli bir projede modul sinirlari yapisal olarak zorlanamaz
 * (monorepo'da packages/physics/package.json icinde react olmamasi bunu
 * kendiliginden saglardi). Bunun yerine sinir BURADA, testle korunur.
 *
 * Neden onemli: `src/physics/` Node'da test edilir ve tarayicida Web Worker
 * icinde kosar. DOM, React veya three.js'e dokunursa ikisi de kirilir.
 * Determinizm ise altin testlerin on kosuludur: ayni girdi her zaman ayni
 * cikti vermelidir, yoksa hicbir referans degeri anlamli olmaz.
 */

const PHYSICS_DIR = fileURLToPath(new URL('../src/physics', import.meta.url));

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const FILES = collect(PHYSICS_DIR);

const FORBIDDEN_IMPORTS = ['three', 'react', 'zustand', '@react-three'];
const FORBIDDEN_GLOBALS = [
  { pattern: /\bMath\.random\s*\(/, why: 'tohumlu RNG kullanin; determinizm sart' },
  { pattern: /\bDate\.now\s*\(/, why: 'zaman disaridan parametre olarak gelmeli' },
  { pattern: /\bperformance\.now\s*\(/, why: 'zaman disaridan parametre olarak gelmeli' },
  { pattern: /\bdocument\./, why: 'fizik cekirdegi DOM bilmez' },
  { pattern: /\bwindow\./, why: 'fizik cekirdegi tarayici global bilmez' },
  { pattern: /\bconsole\./, why: 'fizik cekirdegi ciktilamaz, deger dondurur' },
];

describe('fizik cekirdegi safligi', () => {
  it('taranacak dosya bulur', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it('UI veya render kutuphanesi import etmez', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (spec.startsWith('.')) continue;
        if (FORBIDDEN_IMPORTS.some((f) => spec === f || spec.startsWith(f + '/'))) {
          violations.push(`${file}: ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('determinizmi bozan global kullanmaz', () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      // Yorum satirlarini ele; metin icinde gecmesi ihlal degil.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const { pattern, why } of FORBIDDEN_GLOBALS) {
        if (pattern.test(code)) violations.push(`${file}: ${pattern.source} — ${why}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('yalnizca gorece yollarla ic import yapar', () => {
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        // allowImportingTsExtensions aciksa uzanti acik yazilmalidir.
        expect(m[1]!).toMatch(/\.ts$/);
      }
    }
  });
});
