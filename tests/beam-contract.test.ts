import { describe, it, expect } from 'vitest';
import { deriveTotals, type BeamComponent, type BeamPacket } from '../src/physics/types.ts';
import { ELECTRON_MASS_MEV, MEV_TO_J, ELEMENTARY_CHARGE } from '../src/physics/constants.ts';

function electronComponent(ratePerS: number, energyMeV: number): BeamComponent {
  return {
    species: 'electron',
    ratePerS,
    spectrum: { kind: 'mono', energyMeV, spreadFrac: 0 },
    meanEnergyMeV: energyMeV,
    powerW: ratePerS * energyMeV * MEV_TO_J,
    currentA: ratePerS * ELEMENTARY_CHARGE,
  };
}

describe('demet sozlesmesi', () => {
  it('toplamlar bilesenlerden turetilir', () => {
    const c1 = electronComponent(1e12, 1);
    const c2: BeamComponent = {
      species: 'photon',
      ratePerS: 1e10,
      spectrum: { kind: 'mono', energyMeV: 0.1, spreadFrac: 0 },
      meanEnergyMeV: 0.1,
      powerW: 1e10 * 0.1 * MEV_TO_J,
      currentA: 0,
    };
    const totals = deriveTotals([c1, c2]);
    expect(totals.ratePerS).toBe(1e12 + 1e10);
    expect(totals.currentA).toBeCloseTo(c1.currentA, 12);
    expect(totals.powerW).toBeCloseTo(c1.powerW + c2.powerW, 12);
  });

  it('1 uA elektron demeti 6.24e12 elektron/s tasir', () => {
    const rate = 1e-6 / ELEMENTARY_CHARGE;
    expect(rate / 1e12).toBeCloseTo(6.2415, 3);
  });

  it('paket structuredClone ile worker sinirindan gecebilir', () => {
    const packet: BeamPacket = {
      schemaVersion: 1,
      id: 'test',
      producedBy: { stage: 1, deviceId: 'van-de-graaff' },
      simTimeS: 0,
      components: [electronComponent(1e12, 1)],
      optics: {
        originM: [0, 0, 0],
        direction: [0, 0, 1],
        sigmaXMm: 1,
        sigmaYMm: 1,
        divergenceMrad: 5,
        emittanceMmMrad: 1,
        solidAngleSr: 0.01,
      },
      temporal: { kind: 'cw' },
      totals: deriveTotals([electronComponent(1e12, 1)]),
    };
    const clone = structuredClone(packet);
    expect(clone.totals.ratePerS).toBe(packet.totals.ratePerS);
    expect(clone.components[0]!.species).toBe('electron');
  });

  it('yuksuz turler akim tasimaz', () => {
    const neutron: BeamComponent = {
      species: 'neutron',
      ratePerS: 1e12,
      spectrum: { kind: 'mono', energyMeV: 2, spreadFrac: 0 },
      meanEnergyMeV: 2,
      powerW: 1e12 * 2 * MEV_TO_J,
      currentA: 0,
    };
    expect(deriveTotals([neutron]).currentA).toBe(0);
  });

  it('elektron durgun enerjisi 0.511 MeV', () => {
    expect(ELECTRON_MASS_MEV).toBeCloseTo(0.511, 3);
  });
});
