import type { DeviceInstance, Wire } from './model.ts';
import { connectedTo } from './model.ts';
import { specOf, TUBE, LINAC, PX_PER_M } from './catalog.ts';
import { gasProperties, relativeDensity, type GasId } from '../physics/gas/gases.ts';
import { breakdownVoltageV } from '../physics/gas/paschen.ts';
import { sparkLengthM, arcRatePerS } from '../physics/gas/arc.ts';
import { sphereCoronaOnsetVoltageV } from '../physics/gas/corona.ts';
import * as vdg from '../physics/sources/vandeGraaff.ts';
import * as cw from '../physics/sources/cockcroftWalton.ts';
import * as marx from '../physics/sources/marx.ts';
import * as linac from '../physics/sources/linac.ts';
import { childLangmuirElectron } from '../physics/sources/emission.ts';
import { productionEfficiency } from '../physics/interaction/bremsstrahlung.ts';
import { naturalThresholdMeV, thickTargetNeutronYieldPerS } from '../physics/interaction/photoneutron.ts';
import { elementBySymbol, densityKgPerM3, type Element } from '../physics/data/elements.ts';
import { mostAbundantA, afterNeutronEmission, afterNeutronCapture, type NuclideId } from '../physics/data/nuclides.ts';
import { equilibriumTempK, type ThermalBody } from '../physics/thermal/heat.ts';
import { ELECTRON_MASS_MEV, PROTON_MASS_MEV, MEV_TO_J } from '../physics/constants.ts';

/**
 * Tezgah topolojisinden fizik durumu turetir. Saf fonksiyon.
 * DESIGN.md "Asama 2 dilimi", madde 3.
 *
 * Kablo yalnizca elektrikte (hv, ground, rf). Demet GEOMETRIDIR: kaynagin
 * cikisindan saga ucar, ekseni kesen ilk cihaza carpar.
 */

export interface VdgSolution {
  readonly voltageV: number;
  readonly targetV: number;
  readonly maxV: number;
  readonly onsetV: number;
  readonly sparkM: number;
  readonly delivered: boolean;
  readonly breakdown: boolean;
  readonly arcRatePerS: number;
}

/** Cockcroft-Walton ve Marx: tup anodunu besleyen DC/darbeli kaynaklar. */
export interface HvSolution {
  readonly kind: 'cockcroftwalton' | 'marx';
  readonly voltageV: number;
  readonly idealV: number;
  /** Yuk altinda dusum (CW) veya verim kaybi (Marx), V. */
  readonly dropV: number;
  readonly loadCurrentA: number;
  readonly pulsed: boolean;
  readonly delivered: boolean;
  /** Merdiven/kademe gerilim profili (sematik icin). */
  readonly stageProfileV: Float64Array;
}

export interface KlystronSolution {
  readonly rfPowerW: number;
  readonly delivered: boolean;
}

export type Species = 'electron' | 'proton';

export interface LinacSolution {
  readonly species: Species;
  readonly powered: boolean;
  readonly grounded: boolean;
  readonly rfPowerW: number;
  readonly energyMeV: number;
  readonly beamCurrentA: number;
  readonly beamPowerW: number;
  readonly driftTubeLengthsM: Float64Array;
  readonly gradientMVPerM: number;
  readonly kilpatrickMVPerM: number;
  readonly arcing: boolean;
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
  readonly pulsed: boolean;
}

export type Incoming = 'electrons' | 'protons' | 'neutrons' | 'photons' | null;

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
  readonly tempK: number;
  /** Alinan notron akisi, 1/(m^2 s). Kati acili geometriden: Y/(4 pi d^2). */
  readonly neutronFluxPerM2S: number;
  readonly product: NuclideId | null;
  readonly event: 'photoneutron' | 'below_threshold' | 'capture' | 'photons' | 'proton_heat' | null;
}

export interface BeamSegment {
  readonly kind: 'electron' | 'proton' | 'xray' | 'neutron';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly intensity: number;
  readonly sourceId: string;
  readonly targetId: string | null;
  readonly spray?: boolean;
}

export type CellIncoming = 'electrons' | 'protons' | 'photons' | 'neutrons' | null;

/**
 * Hucre ornegi (1 g doku). Egitim modeli: nokta kaynak / koni geometrisi,
 * sabit sogurma kesirleri; gercek dozimetri degildir.
 */
export interface CellSolution {
  readonly incoming: CellIncoming;
  readonly sourceId: string | null;
  readonly energyMeV: number;
  readonly doseRateGyPerS: number;
  readonly wR: number;
  readonly doseRateSvPerS: number;
  readonly letKeVPerUm: number;
}

export interface BenchSolution {
  readonly vdgs: Readonly<Record<string, VdgSolution>>;
  readonly cells: Readonly<Record<string, CellSolution>>;
  readonly hv: Readonly<Record<string, HvSolution>>;
  readonly klystrons: Readonly<Record<string, KlystronSolution>>;
  readonly linacs: Readonly<Record<string, LinacSolution>>;
  readonly tubes: Readonly<Record<string, TubeSolution>>;
  readonly targets: Readonly<Record<string, TargetSolution>>;
  readonly beams: readonly BeamSegment[];
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

const TUBE_GAP_M = 0.2;
const CATHODE_AREA_M2 = 1e-4;
const HIT_TOLERANCE_PX = 28;
const NEUTRON_REACH_PX = 340;
const FREE_FLIGHT_PX = 560;
/** CW ve Marx'in verebilecegi ortalama akim tavani, A. */
const CW_CURRENT_CAP_A = 5e-3;
const MARX_CURRENT_CAP_A = 2e-3;
/** LINAC enjektor tavanlari, A. */
const INJECTOR_CAP_A: Record<Species, number> = { electron: 5e-3, proton: 2e-3 };
const INJECTION_MEV: Record<Species, number> = { electron: 0.05, proton: 0.1 };
/** Demet gucu RF gucunun bu kesrini asamaz. */
const RF_TO_BEAM = 0.5;
/** Modern yapilar Kilpatrick'in bu katina kadar calisir. */
const KILPATRICK_FACTOR = 1.8;

export function firstHitToRight(devices: readonly DeviceInstance[], fromId: string, x: number, y: number, tolerance = HIT_TOLERANCE_PX): DeviceInstance | null {
  let best: DeviceInstance | null = null;
  let bestX = Infinity;
  for (const d of devices) {
    if (d.id === fromId) continue;
    const s = specOf(d.kind);
    if (d.x < x) continue;
    if (y < d.y - tolerance || y > d.y + s.h + tolerance) continue;
    if (d.x < bestX) { best = d; bestX = d.x; }
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
    if (dist < bestD) { best = d; bestD = dist; }
  }
  return best;
}

export function solveBench(devices: readonly DeviceInstance[], wires: readonly Wire[]): BenchSolution {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const vdgs: Record<string, VdgSolution> = {};
  const hv: Record<string, HvSolution> = {};
  const klystrons: Record<string, KlystronSolution> = {};
  const linacs: Record<string, LinacSolution> = {};
  const tubes: Record<string, TubeSolution> = {};
  const targets: Record<string, TargetSolution> = {};
  const cells: Record<string, CellSolution> = {};
  const beams: BeamSegment[] = [];

  const isGrounded = (id: string, port: string) => {
    const c = connectedTo(wires, { device: id, port });
    return c !== null && byId.get(c.device)?.kind === 'ground';
  };

  // --- Van de Graaff ---
  for (const d of devices) {
    if (d.kind !== 'vandegraaff') continue;
    const params: vdg.VanDeGraaffParams = { ...vdg.DEFAULT_VAN_DE_GRAAFF, sphereRadiusM: num(d.params['radius'], 0.15), gasId: str(d.params['gas'], 'air') as GasId, pressurePa: num(d.params['pressure'], 101325) };
    const maxV = vdg.maxTerminalVoltageV(params);
    const targetV = num(d.params['voltage'], 3e5);
    const voltageV = Math.min(targetV, maxV);
    const delta = relativeDensity(params.pressurePa, params.tempK);
    const eBr = gasProperties(params.gasId).breakdownFieldVPerM * delta;
    const delivered = connectedTo(wires, { device: d.id, port: 'hv' }) !== null;
    const breakdown = targetV > maxV;
    const onsetV = sphereCoronaOnsetVoltageV(params.sphereRadiusM, delta);
    const rate = breakdown ? 8 + arcRatePerS(targetV, maxV, 18) : delivered ? 0 : 1 + 7 * (voltageV / maxV);
    vdgs[d.id] = { voltageV, targetV, maxV, onsetV, sparkM: sparkLengthM(voltageV, eBr), delivered, breakdown, arcRatePerS: rate };
  }

  // --- Tup yuk akimi tahmini (CW dusumu icin sabit nokta) ---
  const tubeLoadFor = (sourceId: string, voltageV: number, cap: number): number => {
    for (const t of devices) {
      if (t.kind !== 'tube') continue;
      const a = connectedTo(wires, { device: t.id, port: 'anode' });
      if (!a || a.device !== sourceId || !isGrounded(t.id, 'cathode')) continue;
      const gas = str(t.params['gas'], 'vacuum');
      if (gas !== 'vacuum' && num(t.params['pressure'], 1e-3) >= 1e-2) return 0;
      return Math.min(childLangmuirElectron(voltageV, TUBE_GAP_M) * CATHODE_AREA_M2, cap);
    }
    return 0;
  };

  // --- Cockcroft-Walton ---
  for (const d of devices) {
    if (d.kind !== 'cockcroftwalton') continue;
    const p: cw.CockcroftWaltonParams = { stages: Math.max(1, Math.round(num(d.params['stages'], 4))), inputPeakV: num(d.params['inputPeakV'], 1e5), frequencyHz: num(d.params['frequency'], 5e4), capacitanceF: num(d.params['capacitance'], 1e-8) };
    const idealV = cw.idealOutputV(p);
    let v = idealV;
    let i = 0;
    for (let k = 0; k < 4; k++) { i = tubeLoadFor(d.id, v, CW_CURRENT_CAP_A); v = cw.outputVoltageV(p, i); }
    hv[d.id] = { kind: 'cockcroftwalton', voltageV: v, idealV, dropV: idealV - v, loadCurrentA: i, pulsed: false, delivered: connectedTo(wires, { device: d.id, port: 'hv' }) !== null, stageProfileV: cw.stageVoltageProfileV(p, i) };
  }

  // --- Marx ---
  for (const d of devices) {
    if (d.kind !== 'marx') continue;
    const p: marx.MarxParams = { ...marx.DEFAULT_MARX, stages: Math.max(2, Math.round(num(d.params['stages'], 10))), stageVoltageV: num(d.params['stageVoltage'], 1e5), stageCapacitanceF: num(d.params['capacitance'], 1e-7) };
    const idealV = marx.idealOutputV(p);
    const v = marx.peakOutputV(p);
    const i = tubeLoadFor(d.id, v, MARX_CURRENT_CAP_A);
    const profile = new Float64Array(p.stages);
    for (let k = 0; k < p.stages; k++) profile[k] = p.stageVoltageV * (k + 1) * (v / idealV);
    hv[d.id] = { kind: 'marx', voltageV: v, idealV, dropV: idealV - v, loadCurrentA: i, pulsed: true, delivered: connectedTo(wires, { device: d.id, port: 'hv' }) !== null, stageProfileV: profile };
  }

  // --- Klistron ---
  for (const d of devices) {
    if (d.kind !== 'klystron') continue;
    klystrons[d.id] = { rfPowerW: num(d.params['rfPower'], 1e6), delivered: connectedTo(wires, { device: d.id, port: 'rf' }) !== null };
  }

  // --- LINAC ---
  for (const d of devices) {
    if (d.kind !== 'linac') continue;
    const species = (str(d.params['particle'], 'electron') === 'proton' ? 'proton' : 'electron') as Species;
    const rf = connectedTo(wires, { device: d.id, port: 'rf' });
    const kl = rf ? klystrons[rf.device] : undefined;
    const grounded = isGrounded(d.id, 'cathode');
    const rfPowerW = kl?.rfPowerW ?? 0;
    const powered = rfPowerW > 0;
    const p: linac.LinacParams = { mode: str(d.params['mode'], 'alvarez') === 'wideroe' ? 'wideroe' : 'alvarez', frequencyHz: num(d.params['frequency'], 2e8), gapVoltageV: num(d.params['gapVoltage'], 5e5), gapLengthM: 0.02, synchronousPhaseRad: -Math.PI / 6, gapCount: Math.max(1, Math.round(num(d.params['gapCount'], 20))) };
    const rest = species === 'proton' ? PROTON_MASS_MEV : ELECTRON_MASS_MEV;
    const profile = linac.solveProfile(p, rest, 1, INJECTION_MEV[species]);
    const totalLen = profile.driftTubeLengthsM.reduce((a, b) => a + b, 0) + p.gapCount * p.gapLengthM;
    const gradient = totalLen > 0 ? profile.finalEnergyMeV / totalLen : 0;
    const kilpatrick = linac.kilpatrickFieldMVPerM(p.frequencyHz) * KILPATRICK_FACTOR;
    // Bosluk gradyani: boslukta V0/g; yapinin ortalamasindan cok daha buyuk — Kilpatrick bunu gorur.
    const gapGradient = p.gapVoltageV / 1e6 / p.gapLengthM;
    const arcing = gapGradient > kilpatrick;
    const on = powered && grounded && !arcing;
    const energyMeV = on ? profile.finalEnergyMeV : 0;
    const rfCap = energyMeV > 0 ? (RF_TO_BEAM * rfPowerW) / (energyMeV * 1e6) : 0;
    const beamCurrentA = on ? Math.min(INJECTOR_CAP_A[species], rfCap) : 0;
    linacs[d.id] = { species, powered, grounded, rfPowerW, energyMeV, beamCurrentA, beamPowerW: beamCurrentA * energyMeV * 1e6, driftTubeLengthsM: profile.driftTubeLengthsM, gradientMVPerM: gradient, kilpatrickMVPerM: kilpatrick, arcing };
    if (on && beamCurrentA > 0) {
      const y = d.y + LINAC.axisY;
      const intensity = Math.min(1, 0.4 + Math.log10(1 + beamCurrentA * 1e3) / 2);
      const kind = species === 'proton' ? 'proton' : 'electron';
      beams.push({ kind, x1: d.x + LINAC.beamStartX, y1: y, x2: d.x + LINAC.beamEndX, y2: y, intensity, sourceId: d.id, targetId: null });
      const exitX = d.x + specOf('linac').w;
      const hit = firstHitToRight(devices, d.id, exitX, y);
      beams.push({ kind, x1: exitX, y1: y, x2: hit ? hit.x : exitX + FREE_FLIGHT_PX, y2: y, intensity, sourceId: d.id, targetId: hit?.id ?? null });
    }
  }

  // --- Tupler: anot herhangi bir HV kaynagina baglanabilir ---
  for (const d of devices) {
    if (d.kind !== 'tube') continue;
    const anode = connectedTo(wires, { device: d.id, port: 'anode' });
    const source = anode ? byId.get(anode.device) : undefined;
    const grounded = isGrounded(d.id, 'cathode');
    let voltageV = 0;
    let pulsed = false;
    if (source?.kind === 'vandegraaff') voltageV = vdgs[source.id]?.voltageV ?? 0;
    else if (source && (source.kind === 'cockcroftwalton' || source.kind === 'marx')) { voltageV = hv[source.id]?.voltageV ?? 0; pulsed = hv[source.id]?.pulsed ?? false; }
    const gas = str(d.params['gas'], 'vacuum') as GasId;
    const pressurePa = num(d.params['pressure'], 1e-3);
    let regime: TubeRegime = 'off';
    let beamCurrentA = 0;
    if (voltageV > 0 && grounded) {
      if (gas === 'vacuum' || pressurePa < 1e-2) {
        regime = 'vacuum';
        const supply = source?.kind === 'vandegraaff' ? vdg.beltCurrentA(vdg.DEFAULT_VAN_DE_GRAAFF) : source?.kind === 'marx' ? MARX_CURRENT_CAP_A : CW_CURRENT_CAP_A;
        beamCurrentA = Math.min(childLangmuirElectron(voltageV, TUBE_GAP_M) * CATHODE_AREA_M2, supply);
      } else {
        const vb = breakdownVoltageV(gas, pressurePa, TUBE_GAP_M);
        regime = voltageV >= vb ? (pressurePa > 3e3 ? 'arc' : 'glow') : 'blocked';
      }
    }
    const electronEnergyMeV = regime === 'vacuum' ? voltageV / 1e6 : 0;
    tubes[d.id] = { voltageV, sourceId: source?.id ?? null, grounded, regime, beamCurrentA, electronEnergyMeV, beamPowerW: beamCurrentA * voltageV, gas, pressurePa, pulsed };
    if (regime === 'vacuum' && beamCurrentA > 0) {
      const s = specOf('tube');
      const y = d.y + TUBE.axisY;
      const intensity = Math.min(1, 0.35 + Math.log10(1 + beamCurrentA * 1e6) / 3);
      beams.push({ kind: 'electron', x1: d.x + TUBE.cathodeX, y1: y, x2: d.x + TUBE.anodeX, y2: y, intensity, sourceId: d.id, targetId: null });
      const exitX = d.x + (s.emitter?.x ?? s.w);
      const hit = firstHitToRight(devices, d.id, exitX, y);
      beams.push({ kind: 'electron', x1: exitX, y1: y, x2: hit ? hit.x : exitX + FREE_FLIGHT_PX, y2: y, intensity, sourceId: d.id, targetId: hit?.id ?? null });
    }
  }

  // --- Hedefler ---
  const targetDevices = devices.filter((d) => d.kind === 'target');
  const primaryHits = new Map<string, BeamSegment>();
  for (const b of beams) if ((b.kind === 'electron' || b.kind === 'proton') && b.targetId) primaryHits.set(b.targetId, b);

  const resolve = (d: DeviceInstance, incoming: Incoming, sourceId: string | null, energyMeV: number, beamPowerW: number, neutronFluxPerM2S = 0): TargetSolution => {
    const element = elementBySymbol(str(d.params['element'], 'W')) ?? elementBySymbol('W')!;
    const nuclide: NuclideId = { Z: element.Z, A: mostAbundantA(element.Z, element.massNumber) };
    const thresholdMeV = naturalThresholdMeV(element.Z, element.massNumber);
    const electrons = incoming === 'electrons';
    const aboveThreshold = electrons && energyMeV > thresholdMeV;
    const neutronYieldPerS = electrons ? thickTargetNeutronYieldPerS(element.Z, element.massNumber, energyMeV, beamPowerW) : 0;
    const xrayEfficiency = electrons ? productionEfficiency(element.Z, energyMeV * 1e6) : 0;
    let event: TargetSolution['event'] = null;
    let product: NuclideId | null = null;
    if (electrons) { event = aboveThreshold ? 'photoneutron' : 'below_threshold'; product = aboveThreshold ? afterNeutronEmission(nuclide) : null; }
    else if (incoming === 'protons') event = 'proton_heat';
    else if (incoming === 'neutrons') { event = 'capture'; product = afterNeutronCapture(nuclide); }
    else if (incoming === 'photons') event = 'photons';
    const heatW = beamPowerW * (1 - xrayEfficiency);
    const thicknessM = num(d.params['thickness'], 2) * 1e-3;
    const faceM2 = 0.01 * 0.02;
    const body: ThermalBody = { massKg: densityKgPerM3(element) * faceM2 * thicknessM, specificHeatJPerKgK: element.specificHeatJPerKgK, surfaceAreaM2: 2 * faceM2 + 2 * (0.01 + 0.02) * thicknessM, emissivity: 0.35, conductanceWPerK: 0.05, ambientTempK: 293.15, meltingPointK: element.meltingPointK, boilingPointK: element.boilingPointK, latentHeatFusionJPerKg: element.latentHeatFusionKJPerKg * 1000, latentHeatVaporJPerKg: element.latentHeatVaporKJPerKg * 1000 };
    const tempK = heatW > 0 ? Math.min(equilibriumTempK(body, heatW), element.meltingPointK) : 293.15;
    return { element, nuclide, incoming, sourceId, electronEnergyMeV: energyMeV, beamPowerW, thresholdMeV, aboveThreshold, neutronYieldPerS, xrayEfficiency, heatW, tempK, neutronFluxPerM2S, product, event };
  };

  const secondary = new Map<string, { kind: 'neutrons' | 'photons'; from: string; fluxPerM2S: number }>();
  for (const d of targetDevices) {
    const hit = primaryHits.get(d.id);
    if (!hit) continue;
    const src = byId.get(hit.sourceId);
    const energyMeV = src?.kind === 'linac' ? linacs[hit.sourceId]!.energyMeV : tubes[hit.sourceId]!.electronEnergyMeV;
    const powerW = src?.kind === 'linac' ? linacs[hit.sourceId]!.beamPowerW : tubes[hit.sourceId]!.beamPowerW;
    const sol = resolve(d, hit.kind === 'proton' ? 'protons' : 'electrons', hit.sourceId, energyMeV, powerW);
    targets[d.id] = sol;
    const c = center(d);
    if (sol.incoming === 'electrons') {
      beams.push({ kind: 'xray', x1: c.x, y1: c.y, x2: c.x + 300, y2: c.y, intensity: Math.min(1, 0.3 + sol.xrayEfficiency * 40), sourceId: d.id, targetId: null });
      const photonHit = firstHitToRight(devices, d.id, d.x + specOf('target').w, c.y);
      if (photonHit?.kind === 'target' && !secondary.has(photonHit.id)) secondary.set(photonHit.id, { kind: 'photons', from: d.id, fluxPerM2S: 0 });
    }
    if (sol.neutronYieldPerS > 0) {
      const intensity = Math.min(1, 0.3 + Math.log10(1 + sol.neutronYieldPerS / 1e6) / 8);
      beams.push({ kind: 'neutron', x1: c.x, y1: c.y, x2: c.x, y2: c.y, intensity, sourceId: d.id, targetId: null, spray: true });
      const receiver = nearestTargetWithin(devices, d.id, c.x, c.y, NEUTRON_REACH_PX);
      if (receiver) {
        const rc = center(receiver);
        beams.push({ kind: 'neutron', x1: c.x, y1: c.y, x2: rc.x, y2: rc.y, intensity, sourceId: d.id, targetId: receiver.id });
        // Izotropik kaynak: alicinin yuzeyindeki aki Y/(4 pi d^2); d tezgah olceginden metreye.
        const dM = Math.max(0.05, Math.hypot(rc.x - c.x, rc.y - c.y) / PX_PER_M);
        secondary.set(receiver.id, { kind: 'neutrons', from: d.id, fluxPerM2S: sol.neutronYieldPerS / (4 * Math.PI * dM * dM) });
      }
    }
  }
  for (const d of targetDevices) {
    if (targets[d.id]) continue;
    const s = secondary.get(d.id);
    targets[d.id] = s ? resolve(d, s.kind, s.from, 0, 0, s.fluxPerM2S) : resolve(d, null, null, 0, 0);
  }

  // --- Hucre ornekleri: 1 g doku, gelen isinimdan doz hizi ---
  const CELL_MASS_KG = 1e-3;
  const CELL_FACE_M2 = 1e-4;
  const XRAY_CONE_HALF = Math.tan((15 * Math.PI) / 180);
  for (const d of devices) {
    if (d.kind !== 'cell') continue;
    const c = center(d);
    let sol: CellSolution = { incoming: null, sourceId: null, energyMeV: 0, doseRateGyPerS: 0, wR: 1, doseRateSvPerS: 0, letKeVPerUm: 0 };
    const direct = primaryHits.get(d.id);
    if (direct) {
      const src = byId.get(direct.sourceId);
      const energyMeV = src?.kind === 'linac' ? linacs[direct.sourceId]!.energyMeV : tubes[direct.sourceId]!.electronEnergyMeV;
      const powerW = src?.kind === 'linac' ? linacs[direct.sourceId]!.beamPowerW : tubes[direct.sourceId]!.beamPowerW;
      const proton = direct.kind === 'proton';
      // Demet tumuyle sogurulur (MeV elektron/proton 1 cm dokuda durur).
      const gy = powerW / CELL_MASS_KG;
      const wR = proton ? 2 : 1;
      sol = { incoming: proton ? 'protons' : 'electrons', sourceId: direct.sourceId, energyMeV, doseRateGyPerS: gy, wR, doseRateSvPerS: gy * wR, letKeVPerUm: proton ? 25 / Math.max(0.3, energyMeV) : 0.25 };
    } else {
      // Notronlar: en yakin notron kaynagi (menzil icinde); X-isini: soldaki hedefin konisi.
      let best: CellSolution | null = null;
      for (const t of targetDevices) {
        const ts = targets[t.id]!;
        const tc = center(t);
        const dM = Math.max(0.05, Math.hypot(c.x - tc.x, c.y - tc.y) / PX_PER_M);
        if (ts.neutronYieldPerS > 0 && Math.hypot(c.x - tc.x, c.y - tc.y) < NEUTRON_REACH_PX) {
          const received = (ts.neutronYieldPerS * CELL_FACE_M2) / (4 * Math.PI * dM * dM);
          const eMeV = 2.0;
          const powerW = received * eMeV * MEV_TO_J * 0.5;
          const gy = powerW / CELL_MASS_KG;
          const wR = 17; // ICRP 103, ~2 MeV
          const cand: CellSolution = { incoming: 'neutrons', sourceId: t.id, energyMeV: eMeV, doseRateGyPerS: gy, wR, doseRateSvPerS: gy * wR, letKeVPerUm: 35 };
          if (!best || cand.doseRateSvPerS > best.doseRateSvPerS) best = cand;
        }
        if (ts.incoming === 'electrons' && ts.xrayEfficiency > 0 && c.x > tc.x && Math.abs(c.y - tc.y) < (c.x - tc.x) * XRAY_CONE_HALF + 30) {
          const coneArea = Math.PI * Math.pow(dM * XRAY_CONE_HALF, 2) + CELL_FACE_M2;
          const powerW = ts.beamPowerW * ts.xrayEfficiency * (CELL_FACE_M2 / coneArea) * 0.3;
          const gy = powerW / CELL_MASS_KG;
          const cand: CellSolution = { incoming: 'photons', sourceId: t.id, energyMeV: ts.electronEnergyMeV / 3, doseRateGyPerS: gy, wR: 1, doseRateSvPerS: gy, letKeVPerUm: 2 };
          if (!best || cand.doseRateSvPerS > best.doseRateSvPerS) best = cand;
        }
      }
      if (best) sol = best;
    }
    cells[d.id] = sol;
  }

  return { vdgs, hv, klystrons, linacs, tubes, targets, cells, beams };
}
