import type { DeviceInstance, Wire } from './model.ts';
import { connectedTo } from './model.ts';
import { specOf, TUBE } from './catalog.ts';
import { gasProperties, relativeDensity, type GasId } from '../physics/gas/gases.ts';
import { breakdownVoltageV } from '../physics/gas/paschen.ts';
import { sparkLengthM, arcRatePerS } from '../physics/gas/arc.ts';
import { sphereCoronaOnsetVoltageV } from '../physics/gas/corona.ts';
import * as vdg from '../physics/sources/vandeGraaff.ts';
import { childLangmuirElectron } from '../physics/sources/emission.ts';
import { productionEfficiency } from '../physics/interaction/bremsstrahlung.ts';
import { naturalThresholdMeV, thickTargetNeutronYieldPerS } from '../physics/interaction/photoneutron.ts';
import { elementBySymbol, type Element } from '../physics/data/elements.ts';
import { mostAbundantA, afterNeutronEmission, afterNeutronCapture, type NuclideId } from '../physics/data/nuclides.ts';
import { densityKgPerM3 } from '../physics/data/elements.ts';
import { equilibriumTempK, type ThermalBody } from '../physics/thermal/heat.ts';

/**
 * Tezgah topolojisinden fizik durumu turetir. Saf fonksiyon.
 * DESIGN.md "Asama 2 dilimi", madde 3.
 *
 * Kablo yalnizca elektrikte vardir. Demet GEOMETRIDIR: tup cikisindan saga
 * ucar, ekseni kesen ilk cihaza carpar. Hedeften X-isini ileri, notron her
 * yone cikar; notronlari yakin bir hedef yakalar.
 */

export interface VdgSolution {
  /** Gercek terminal gerilimi (delinme ile sinirli), V. */
  readonly voltageV: number;
  /** Kullanicinin istedigi gerilim, V. */
  readonly targetV: number;
  readonly maxV: number;
  readonly onsetV: number;
  readonly sparkM: number;
  readonly delivered: boolean;
  /** Istenen gerilim kurenin tutabileceginden buyuk: surekli desarj. */
  readonly breakdown: boolean;
  /** Ark olay hizi, 1/s. Gorsel katman bunu tuketir. */
  readonly arcRatePerS: number;
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
  readonly gas: GasId;
  readonly pressurePa: number;
}

export type Incoming = 'electrons' | 'neutrons' | 'photons' | null;

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
  /** Denge sicakligi, K (1x2 cm levha, isima + tutucu iletimi). */
  readonly tempK: number;
  readonly product: NuclideId | null;
  readonly event: 'photoneutron' | 'below_threshold' | 'capture' | 'photons' | null;
}

export interface BeamSegment {
  readonly kind: 'electron' | 'xray' | 'neutron';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** 0..1 gorsel yogunluk (parcacik sayisi/parlaklik). */
  readonly intensity: number;
  readonly sourceId: string;
  readonly targetId: string | null;
  /** Isotropik puskurme (notron); x2,y2 anlamsiz. */
  readonly spray?: boolean;
}

export interface BenchSolution {
  readonly vdgs: Readonly<Record<string, VdgSolution>>;
  readonly tubes: Readonly<Record<string, TubeSolution>>;
  readonly targets: Readonly<Record<string, TargetSolution>>;
  readonly beams: readonly BeamSegment[];
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

const TUBE_GAP_M = 0.2;
const CATHODE_AREA_M2 = 1e-4;
/** Demet ekseninin cihaz kutusunu "kesmesi" icin dikey tolerans, px. */
const HIT_TOLERANCE_PX = 28;
/** Notron yakalama mesafesi (merkezden merkeze), px. */
const NEUTRON_REACH_PX = 340;
/** Carpmayan demetin cizildigi uzunluk, px. */
const FREE_FLIGHT_PX = 560;

/** (x,y)'den saga giden isinin kestigi ilk cihaz (kendisi haric). */
export function firstHitToRight(
  devices: readonly DeviceInstance[],
  fromId: string,
  x: number,
  y: number,
  tolerance = HIT_TOLERANCE_PX,
): DeviceInstance | null {
  let best: DeviceInstance | null = null;
  let bestX = Infinity;
  for (const d of devices) {
    if (d.id === fromId) continue;
    const s = specOf(d.kind);
    if (d.x < x) continue;
    if (y < d.y - tolerance || y > d.y + s.h + tolerance) continue;
    if (d.x < bestX) {
      best = d;
      bestX = d.x;
    }
  }
  return best;
}

function center(d: DeviceInstance): { x: number; y: number } {
  const s = specOf(d.kind);
  return { x: d.x + s.w / 2, y: d.y + s.h / 2 };
}

function nearestTargetWithin(devices: readonly DeviceInstance[], fromId: string, px: number, py: number, reach: number): DeviceInstance | null {
  let best: DeviceInstance | null = null;
  let bestD = reach;
  for (const d of devices) {
    if (d.id === fromId || d.kind !== 'target') continue;
    const c = center(d);
    const dist = Math.hypot(c.x - px, c.y - py);
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

export function solveBench(devices: readonly DeviceInstance[], wires: readonly Wire[]): BenchSolution {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const vdgs: Record<string, VdgSolution> = {};
  const tubes: Record<string, TubeSolution> = {};
  const targets: Record<string, TargetSolution> = {};
  const beams: BeamSegment[] = [];

  for (const d of devices) {
    if (d.kind !== 'vandegraaff') continue;
    const params: vdg.VanDeGraaffParams = {
      ...vdg.DEFAULT_VAN_DE_GRAAFF,
      sphereRadiusM: num(d.params['radius'], 0.15),
      gasId: str(d.params['gas'], 'air') as GasId,
      pressurePa: num(d.params['pressure'], 101325),
    };
    const maxV = vdg.maxTerminalVoltageV(params);
    const targetV = num(d.params['voltage'], 3e5);
    const voltageV = Math.min(targetV, maxV);
    const delta = relativeDensity(params.pressurePa, params.tempK);
    const eBr = gasProperties(params.gasId).breakdownFieldVPerM * delta;
    const delivered = connectedTo(wires, { device: d.id, port: 'hv' }) !== null;
    const breakdown = targetV > maxV;
    const onsetV = sphereCoronaOnsetVoltageV(params.sphereRadiusM, delta);
    // Kablosuz yuklu terminal her zaman cevresine bosalir; gerilim tavana
    // yaklastikca siklasir, delinmede firtinaya doner. Bagliysa yuk anoda gider.
    const rate = breakdown
      ? 8 + arcRatePerS(targetV, maxV, 18)
      : delivered
        ? 0
        : 1 + 7 * (voltageV / maxV);
    vdgs[d.id] = { voltageV, targetV, maxV, onsetV, sparkM: sparkLengthM(voltageV, eBr), delivered, breakdown, arcRatePerS: rate };
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
        const supply = source ? vdg.beltCurrentA(vdg.DEFAULT_VAN_DE_GRAAFF) : 0;
        beamCurrentA = Math.min(childLangmuirElectron(voltageV, TUBE_GAP_M) * CATHODE_AREA_M2, supply);
      } else {
        const vb = breakdownVoltageV(gas, pressurePa, TUBE_GAP_M);
        regime = voltageV >= vb ? (pressurePa > 3e3 ? 'arc' : 'glow') : 'blocked';
      }
    }
    const electronEnergyMeV = regime === 'vacuum' ? voltageV / 1e6 : 0;
    tubes[d.id] = { voltageV, sourceId: source?.id ?? null, grounded, regime, beamCurrentA, electronEnergyMeV, beamPowerW: beamCurrentA * voltageV, gas, pressurePa };

    if (regime === 'vacuum' && beamCurrentA > 0) {
      const s = specOf('tube');
      const y = d.y + TUBE.axisY;
      const intensity = Math.min(1, 0.35 + Math.log10(1 + beamCurrentA * 1e6) / 3);
      beams.push({ kind: 'electron', x1: d.x + TUBE.cathodeX, y1: y, x2: d.x + TUBE.anodeX, y2: y, intensity, sourceId: d.id, targetId: null });
      const exitX = d.x + (s.emitter?.x ?? s.w);
      const hit = firstHitToRight(devices, d.id, exitX, y);
      const x2 = hit ? hit.x : exitX + FREE_FLIGHT_PX;
      beams.push({ kind: 'electron', x1: exitX, y1: y, x2, y2: y, intensity, sourceId: d.id, targetId: hit?.id ?? null });
    }
  }

  // Hedefler: once elektron alanlar, sonra notron/foton alanlar.
  const targetDevices = devices.filter((d) => d.kind === 'target');
  const electronHits = new Map<string, BeamSegment>();
  for (const b of beams) if (b.kind === 'electron' && b.targetId) electronHits.set(b.targetId, b);

  const resolve = (d: DeviceInstance, incoming: Incoming, sourceId: string | null, electronEnergyMeV: number, beamPowerW: number): TargetSolution => {
    const element = elementBySymbol(str(d.params['element'], 'W')) ?? elementBySymbol('W')!;
    const nuclide: NuclideId = { Z: element.Z, A: mostAbundantA(element.Z, element.massNumber) };
    const thresholdMeV = naturalThresholdMeV(element.Z, element.massNumber);
    const aboveThreshold = incoming === 'electrons' && electronEnergyMeV > thresholdMeV;
    const neutronYieldPerS = incoming === 'electrons' ? thickTargetNeutronYieldPerS(element.Z, element.massNumber, electronEnergyMeV, beamPowerW) : 0;
    const xrayEfficiency = incoming === 'electrons' ? productionEfficiency(element.Z, electronEnergyMeV * 1e6) : 0;
    let event: TargetSolution['event'] = null;
    let product: NuclideId | null = null;
    if (incoming === 'electrons') { event = aboveThreshold ? 'photoneutron' : 'below_threshold'; product = aboveThreshold ? afterNeutronEmission(nuclide) : null; }
    else if (incoming === 'neutrons') { event = 'capture'; product = afterNeutronCapture(nuclide); }
    else if (incoming === 'photons') event = 'photons';
    const heatW = beamPowerW * (1 - xrayEfficiency);
    const thicknessM = num(d.params['thickness'], 2) * 1e-3;
    const faceM2 = 0.01 * 0.02;
    const body: ThermalBody = {
      massKg: densityKgPerM3(element) * faceM2 * thicknessM,
      specificHeatJPerKgK: element.specificHeatJPerKgK,
      surfaceAreaM2: 2 * faceM2 + 2 * (0.01 + 0.02) * thicknessM,
      emissivity: 0.35,
      conductanceWPerK: 0.05,
      ambientTempK: 293.15,
      meltingPointK: element.meltingPointK,
      boilingPointK: element.boilingPointK,
      latentHeatFusionJPerKg: element.latentHeatFusionKJPerKg * 1000,
      latentHeatVaporJPerKg: element.latentHeatVaporKJPerKg * 1000,
    };
    const tempK = heatW > 0 ? Math.min(equilibriumTempK(body, heatW), element.meltingPointK) : 293.15;
    return { element, nuclide, incoming, sourceId, electronEnergyMeV, beamPowerW, thresholdMeV, aboveThreshold, neutronYieldPerS, xrayEfficiency, heatW, tempK, product, event };
  };

  const secondary = new Map<string, { kind: 'neutrons' | 'photons'; from: string }>();
  for (const d of targetDevices) {
    const hit = electronHits.get(d.id);
    if (!hit) continue;
    const tube = tubes[hit.sourceId]!;
    const sol = resolve(d, 'electrons', hit.sourceId, tube.electronEnergyMeV, tube.beamPowerW);
    targets[d.id] = sol;
    const c = center(d);
    beams.push({ kind: 'xray', x1: c.x, y1: c.y, x2: c.x + 300, y2: c.y, intensity: Math.min(1, 0.3 + sol.xrayEfficiency * 40), sourceId: d.id, targetId: null });
    const photonHit = firstHitToRight(devices, d.id, d.x + specOf('target').w, c.y);
    if (photonHit?.kind === 'target' && !secondary.has(photonHit.id)) secondary.set(photonHit.id, { kind: 'photons', from: d.id });
    if (sol.neutronYieldPerS > 0) {
      const intensity = Math.min(1, 0.3 + Math.log10(1 + sol.neutronYieldPerS / 1e6) / 8);
      beams.push({ kind: 'neutron', x1: c.x, y1: c.y, x2: c.x, y2: c.y, intensity, sourceId: d.id, targetId: null, spray: true });
      const receiver = nearestTargetWithin(devices, d.id, c.x, c.y, NEUTRON_REACH_PX);
      if (receiver) {
        const rc = center(receiver);
        beams.push({ kind: 'neutron', x1: c.x, y1: c.y, x2: rc.x, y2: rc.y, intensity, sourceId: d.id, targetId: receiver.id });
        secondary.set(receiver.id, { kind: 'neutrons', from: d.id });
      }
    }
  }
  for (const d of targetDevices) {
    if (targets[d.id]) continue;
    const s = secondary.get(d.id);
    targets[d.id] = s ? resolve(d, s.kind, s.from, 0, 0) : resolve(d, null, null, 0, 0);
  }

  return { vdgs, tubes, targets, beams };
}
