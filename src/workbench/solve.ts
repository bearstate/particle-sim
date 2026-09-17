import type { DeviceInstance, Wire } from './model.ts';
import { connectedTo } from './model.ts';
import { gasProperties, relativeDensity, type GasId } from '../physics/gas/gases.ts';
import { breakdownVoltageV } from '../physics/gas/paschen.ts';
import { sparkLengthM } from '../physics/gas/arc.ts';
import { sphereCoronaOnsetVoltageV } from '../physics/gas/corona.ts';
import * as vdg from '../physics/sources/vandeGraaff.ts';
import { childLangmuirElectron } from '../physics/sources/emission.ts';
import { productionEfficiency } from '../physics/interaction/bremsstrahlung.ts';
import { naturalThresholdMeV, thickTargetNeutronYieldPerS } from '../physics/interaction/photoneutron.ts';
import { elementBySymbol, type Element } from '../physics/data/elements.ts';
import { mostAbundantA, afterNeutronEmission, afterNeutronCapture, type NuclideId } from '../physics/data/nuclides.ts';

/**
 * Tezgah topolojisinden fizik durumu turetir. Saf fonksiyon; her karede
 * cagrilabilir. DESIGN.md "Asama 2 dilimi", madde 3.
 *
 * Kural: hicbir sonuc store'a yazilmaz. Kaydet/yukle yalnizca topolojidir.
 */

export interface VdgSolution {
  readonly voltageV: number;
  readonly maxV: number;
  readonly onsetV: number;
  /** Kablosuz terminal: ark uzunlugu. Bagliysa 0. */
  readonly sparkM: number;
  readonly delivered: boolean;
}

export type TubeRegime = 'off' | 'vacuum' | 'glow' | 'arc' | 'blocked';

export interface TubeSolution {
  readonly voltageV: number;
  readonly sourceId: string | null;
  readonly grounded: boolean;
  readonly regime: TubeRegime;
  readonly beamCurrentA: number;
  readonly electronEnergyMeV: number;
  readonly beamPowerW: number;
}

export type Incoming = 'electrons' | 'neutrons' | null;

export interface TargetSolution {
  readonly element: Element;
  readonly nuclide: NuclideId;
  readonly incoming: Incoming;
  readonly sourceId: string | null;
  readonly electronEnergyMeV: number;
  readonly beamPowerW: number;
  readonly thresholdMeV: number;
  readonly aboveThreshold: boolean;
  readonly neutronYieldPerS: number;
  readonly xrayEfficiency: number;
  readonly heatW: number;
  /** Olay sonrasi nuklid: (gamma,n) icin A-1, yakalama icin A+1. */
  readonly product: NuclideId | null;
  readonly event: 'photoneutron' | 'below_threshold' | 'capture' | null;
}

export interface BenchSolution {
  readonly vdgs: Readonly<Record<string, VdgSolution>>;
  readonly tubes: Readonly<Record<string, TubeSolution>>;
  readonly targets: Readonly<Record<string, TargetSolution>>;
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

/** Katot-anot araligi, m. Tup gorseliyle tutarli sabit. */
const TUBE_GAP_M = 0.2;
/** Katot emisyon alani, m^2. */
const CATHODE_AREA_M2 = 1e-4;

export function solveBench(devices: readonly DeviceInstance[], wires: readonly Wire[]): BenchSolution {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const vdgs: Record<string, VdgSolution> = {};
  const tubes: Record<string, TubeSolution> = {};
  const targets: Record<string, TargetSolution> = {};

  for (const d of devices) {
    if (d.kind !== 'vandegraaff') continue;
    const params: vdg.VanDeGraaffParams = {
      ...vdg.DEFAULT_VAN_DE_GRAAFF,
      sphereRadiusM: num(d.params['radius'], 0.15),
      gasId: str(d.params['gas'], 'air') as GasId,
      pressurePa: num(d.params['pressure'], 101325),
    };
    const maxV = vdg.maxTerminalVoltageV(params);
    const voltageV = Math.min(num(d.params['voltage'], 3e5), maxV);
    const delta = relativeDensity(params.pressurePa, params.tempK);
    const delivered = connectedTo(wires, { device: d.id, port: 'hv' }) !== null;
    vdgs[d.id] = {
      voltageV,
      maxV,
      onsetV: sphereCoronaOnsetVoltageV(params.sphereRadiusM, delta),
      sparkM: delivered ? 0 : sparkLengthM(voltageV, gasProperties(params.gasId).breakdownFieldVPerM * delta),
      delivered,
    };
  }

  for (const d of devices) {
    if (d.kind !== 'tube') continue;
    const anode = connectedTo(wires, { device: d.id, port: 'anode' });
    const cathode = connectedTo(wires, { device: d.id, port: 'cathode' });
    const source = anode ? byId.get(anode.device) : undefined;
    const grounded = cathode !== null && byId.get(cathode.device)?.kind === 'ground';
    const voltageV = source && source.kind === 'vandegraaff' ? (vdgs[source.id]?.voltageV ?? 0) : 0;

    const gas = str(d.params['gas'], 'vacuum') as GasId;
    const pressurePa = num(d.params['pressure'], 1e-3);
    let regime: TubeRegime = 'off';
    let beamCurrentA = 0;

    if (voltageV > 0 && grounded) {
      if (gas === 'vacuum' || pressurePa < 1e-2) {
        regime = 'vacuum';
        // Kaynak, kayisinin tasidigi akimdan fazlasini veremez: fiziksel tavan.
        const supply = source ? vdg.beltCurrentA(vdg.DEFAULT_VAN_DE_GRAAFF) : 0;
        beamCurrentA = Math.min(childLangmuirElectron(voltageV, TUBE_GAP_M) * CATHODE_AREA_M2, supply);
      } else {
        const vb = breakdownVoltageV(gas, pressurePa, TUBE_GAP_M);
        if (voltageV >= vb) regime = pressurePa > 3e3 ? 'arc' : 'glow';
        else regime = 'blocked';
      }
    }

    const electronEnergyMeV = regime === 'vacuum' ? voltageV / 1e6 : 0;
    tubes[d.id] = {
      voltageV,
      sourceId: source?.id ?? null,
      grounded,
      regime,
      beamCurrentA,
      electronEnergyMeV,
      beamPowerW: beamCurrentA * voltageV,
    };
  }

  const targetDevices = devices.filter((d) => d.kind === 'target');
  const pending = new Set(targetDevices.map((d) => d.id));

  const resolveTarget = (d: DeviceInstance): TargetSolution => {
    const element = elementBySymbol(str(d.params['element'], 'W')) ?? elementBySymbol('W')!;
    const nuclide: NuclideId = { Z: element.Z, A: mostAbundantA(element.Z, element.massNumber) };
    const upstream = connectedTo(wires, { device: d.id, port: 'beam_in' });
    const up = upstream ? byId.get(upstream.device) : undefined;

    let incoming: Incoming = null;
    let electronEnergyMeV = 0;
    let beamPowerW = 0;
    let sourceId: string | null = null;

    if (up?.kind === 'tube') {
      const t = tubes[up.id];
      if (t && t.regime === 'vacuum' && t.beamCurrentA > 0) {
        incoming = 'electrons';
        electronEnergyMeV = t.electronEnergyMeV;
        beamPowerW = t.beamPowerW;
        sourceId = up.id;
      }
    } else if (up?.kind === 'target') {
      const t = targets[up.id];
      if (t && t.neutronYieldPerS > 0) {
        incoming = 'neutrons';
        sourceId = up.id;
      }
    }

    const thresholdMeV = naturalThresholdMeV(element.Z, element.massNumber);
    const aboveThreshold = incoming === 'electrons' && electronEnergyMeV > thresholdMeV;
    const neutronYieldPerS =
      incoming === 'electrons'
        ? thickTargetNeutronYieldPerS(element.Z, element.massNumber, electronEnergyMeV, beamPowerW)
        : 0;
    const xrayEfficiency = incoming === 'electrons' ? productionEfficiency(element.Z, electronEnergyMeV * 1e6) : 0;

    let event: TargetSolution['event'] = null;
    let product: NuclideId | null = null;
    if (incoming === 'electrons') {
      event = aboveThreshold ? 'photoneutron' : 'below_threshold';
      product = aboveThreshold ? afterNeutronEmission(nuclide) : null;
    } else if (incoming === 'neutrons') {
      event = 'capture';
      product = afterNeutronCapture(nuclide);
    }

    return {
      element,
      nuclide,
      incoming,
      sourceId,
      electronEnergyMeV,
      beamPowerW,
      thresholdMeV,
      aboveThreshold,
      neutronYieldPerS,
      xrayEfficiency,
      heatW: beamPowerW * (1 - xrayEfficiency),
      product,
      event,
    };
  };

  // Iki gecis yeter: elektron alan hedefler ilk turda, notron alanlar ikincide.
  for (let pass = 0; pass < 2 && pending.size > 0; pass++) {
    for (const d of targetDevices) {
      if (!pending.has(d.id)) continue;
      const upstream = connectedTo(wires, { device: d.id, port: 'beam_in' });
      const upKind = upstream ? byId.get(upstream.device)?.kind : undefined;
      if (upKind === 'target' && upstream && pending.has(upstream.device)) continue;
      targets[d.id] = resolveTarget(d);
      pending.delete(d.id);
    }
  }
  for (const d of targetDevices) if (pending.has(d.id)) targets[d.id] = resolveTarget(d);

  return { vdgs, tubes, targets };
}
