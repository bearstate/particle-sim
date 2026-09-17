import { describe, it, expect } from 'vitest';
import {
  ELEMENT_SYMBOLS,
  elementSymbol,
  nuclideLabel,
  neutronCount,
  specialIsotopeKey,
  bohrShells,
  SHELL_CAPACITY,
  afterNeutronEmission,
  afterNeutronCapture,
  afterBetaMinus,
  afterAlpha,
  transitionLabel,
  mostAbundantA,
} from '../src/physics/data/nuclides.ts';

describe('element sembolleri', () => {
  it('0..118 tam olarak tanimli', () => {
    expect(ELEMENT_SYMBOLS.length).toBe(119);
    expect(elementSymbol(0)).toBe('n');
    expect(elementSymbol(1)).toBe('H');
    expect(elementSymbol(74)).toBe('W');
    expect(elementSymbol(90)).toBe('Th');
    expect(elementSymbol(92)).toBe('U');
    expect(elementSymbol(118)).toBe('Og');
  });

  it('hicbir sembol tekrar etmez', () => {
    expect(new Set(ELEMENT_SYMBOLS).size).toBe(ELEMENT_SYMBOLS.length);
  });
});

describe('nuklid etiketi', () => {
  it('kanonik bicim', () => {
    expect(nuclideLabel({ Z: 74, A: 183 })).toBe('W-183');
    expect(nuclideLabel({ Z: 1, A: 2 })).toBe('H-2');
    expect(nuclideLabel({ Z: 0, A: 1 })).toBe('n');
  });

  it('hidrojen izotoplarinin ozel adi var, digerlerinin yok', () => {
    expect(specialIsotopeKey({ Z: 1, A: 2 })).toBe('isotope.deuterium');
    expect(specialIsotopeKey({ Z: 1, A: 3 })).toBe('isotope.tritium');
    expect(specialIsotopeKey({ Z: 74, A: 184 })).toBeNull();
  });

  it('notron sayisi A - Z', () => {
    expect(neutronCount({ Z: 74, A: 184 })).toBe(110);
  });
});

describe('Bohr kabuklari', () => {
  it('basit ornekler', () => {
    expect(bohrShells(1)).toEqual([1]);
    expect(bohrShells(2)).toEqual([2]);
    expect(bohrShells(6)).toEqual([2, 4]);
    expect(bohrShells(11)).toEqual([2, 8, 1]);
  });

  it('her Z icin toplam Z ve kapasite asilmaz', () => {
    for (let z = 1; z <= 118; z++) {
      const s = bohrShells(z);
      expect(s.reduce((a, b) => a + b, 0)).toBe(z);
      s.forEach((n, i) => expect(n).toBeLessThanOrEqual(SHELL_CAPACITY[i]!));
    }
  });
});

describe('donusum aritmetigi', () => {
  it('(gamma,n): W-184 -> W-183', () => {
    expect(afterNeutronEmission({ Z: 74, A: 184 })).toEqual({ Z: 74, A: 183 });
  });

  it('yakalama: H-1 -> H-2 (doteryum), Th-232 -> Th-233', () => {
    expect(afterNeutronCapture({ Z: 1, A: 1 })).toEqual({ Z: 1, A: 2 });
    expect(afterNeutronCapture({ Z: 90, A: 232 })).toEqual({ Z: 90, A: 233 });
  });

  it('toryum dongusu etiketleri', () => {
    const th233 = afterNeutronCapture({ Z: 90, A: 232 });
    const pa233 = afterBetaMinus(th233);
    const u233 = afterBetaMinus(pa233);
    expect(nuclideLabel(pa233)).toBe('Pa-233');
    expect(nuclideLabel(u233)).toBe('U-233');
    expect(transitionLabel(th233, pa233)).toBe('Th-233 → Pa-233');
  });

  it('alfa: U-238 -> Th-234', () => {
    expect(nuclideLabel(afterAlpha({ Z: 92, A: 238 }))).toBe('Th-234');
  });

  it('en bol izotop', () => {
    expect(mostAbundantA(74)).toBe(184);
    expect(mostAbundantA(1)).toBe(1);
    expect(mostAbundantA(43, 98.0)).toBe(98);
  });
});
