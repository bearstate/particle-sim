import { describe, it, expect } from 'vitest';
import { crossingIndex, helixPoint, planTrack, stepLesions, type DnaGeom } from '../src/workbench/dna.ts';

const g: DnaGeom = { x0: 22, x1: 238, y: 282, amp: 20, bp: 40, top: 214, bottom: 350 };
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('DNA izleri', () => {
  it('iki omurga pi faz farkli, donus basina 10.5 bp', () => {
    const a = helixPoint(g, 0, 0, 0);
    const b = helixPoint(g, 0, 1, 0);
    expect(a.y + b.y).toBeCloseTo(2 * g.y, 6);
    expect(helixPoint(g, 21, 0, 0).y).toBeCloseTo(a.y, 3);
  });

  it('kesisme indeksi eksen gecisinde bulunur', () => {
    expect(crossingIndex(g, [{ x: 100, y: 240 }, { x: 110, y: 320 }])).toBe(Math.round((105.25 - 22) / ((238 - 22) / 39)));
    expect(crossingIndex(g, [{ x: 100, y: 240 }, { x: 110, y: 250 }])).toBeNull();
  });

  it('proton izi eksenden gecince kumelenmis kalici DSB birakir; foton izi seyrek', () => {
    let id = 0;
    const next = () => ++id;
    let dense = 0;
    let sparse = 0;
    for (let k = 0; k < 40; k++) {
      const p = planTrack('proton', g, 0, next, seeded(k + 1));
      expect(p.ions.length).toBeGreaterThan(30);
      if (p.lesions.some((l) => l.kind === 'dsb' && l.clustered && !Number.isFinite(l.ttl))) dense++;
      const ph = planTrack('photon', g, 0, next, seeded(k + 100));
      expect(ph.primary).not.toBeNull();
      expect(ph.ions.length).toBeLessThan(30);
      if (ph.lesions.some((l) => l.clustered)) sparse++;
    }
    expect(dense).toBeGreaterThan(30);
    expect(sparse).toBe(0);
  });

  it('notron izi: birincil kesikli, geri tepen proton ve cikis', () => {
    const n = planTrack('neutron', g, 0, () => 1, seeded(5));
    expect(n.primary).toHaveLength(2);
    expect(n.exit).toHaveLength(2);
    expect(n.dense).toBe(true);
  });

  it('lezyonlar suresi dolunca gider, kalici olanlar kalir', () => {
    const ls = [
      { id: 1, i: 3, strand: 0 as const, kind: 'ssb' as const, born: 0, clustered: false, ttl: 1000 },
      { id: 2, i: 5, strand: 1 as const, kind: 'dsb' as const, born: 0, clustered: true, ttl: Infinity },
    ];
    expect(stepLesions(ls, 500)).toHaveLength(2);
    expect(stepLesions(ls, 1500).map((l) => l.id)).toEqual([2]);
  });
});
