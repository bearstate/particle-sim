import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkbench } from './model.ts';
import { BohrAtom, type ActInfo, type AtomMode } from './BohrAtom.tsx';
import type { BenchSolution } from './solve.ts';
import { nuclideLabel, specialIsotopeKey, bohrShells, neutronCount, type NuclideId } from '../physics/data/nuclides.ts';
import { si } from '../ui/Controls.tsx';
import { useReducedMotion } from '../ui/useReducedMotion.ts';
import { useClock, formatSimTime } from './clock.ts';
import { CellView } from './CellView.tsx';
import { InventoryTable } from './InventoryTable.tsx';
import { PaschenChart } from '../ui/PaschenChart.tsx';
import { SpectrumChart } from '../ui/SpectrumChart.tsx';
import { breakdownVoltageV } from '../physics/gas/paschen.ts';
import type { GasId } from '../physics/gas/gases.ts';
import { formatHalfLife } from '../physics/nuclear/decay.ts';
import { decayOf } from '../physics/nuclear/nuclideTable.ts';

/**
 * Mikro gorunum: secili hedefin atomu ve uzerinde olan biten.
 * Koreografi BohrAtom/atomActs icinde; burada mod secilir, anlati yazilir,
 * zincir (Th-232 -> Th-233 -> Pa-233 ...) ve yari omur gosterilir.
 */

type Lang = 'tr' | 'en';
type Tr = (key: string, opts?: Record<string, unknown>) => string;

function halfLifeText(s: number, lang: Lang): string {
  if (!Number.isFinite(s)) return '∞';
  if (s < 1e-3) return `${s.toExponential(1)} s`;
  const f = formatHalfLife(s);
  const unit = lang === 'tr' ? { s: 's', min: 'dk', h: 'sa', d: 'g', y: 'y' }[f.unit] : f.unit;
  const v = f.value >= 1e6 ? f.value.toExponential(2) : f.value < 10 ? f.value.toFixed(2) : f.value.toFixed(0);
  return `${v} ${unit}`;
}

/** Perdenin bu anindaki etiket nuklidi (atomActs.shownNuclide ile ayni kural). */
function labelNuclide(info: ActInfo): NuclideId | null {
  const after = info.phase === 'done';
  switch (info.act) {
    case 'photoneutron': return info.phase === 'neutron' || after ? info.to : info.from;
    case 'capture': return info.phase === 'gdr' || after ? info.to : info.from;
    case 'alpha': case 'betaMinus': case 'betaPlus': return info.phase === 'emit' || after ? info.to : info.from;
    case 'ec': return info.phase === 'start' ? info.from : info.to;
    case 'fission': case 'breakup': return info.phase === 'split' || after ? null : info.from;
    default: return info.from;
  }
}

function narrative(t: Tr, info: ActInfo | null, mode: AtomMode, lang: Lang): string {
  if (!info) return '';
  const lbl = (n: NuclideId) => nuclideLabel(n);
  const wait = info.waitS === null || info.waitS <= 0 ? '' : info.waitS < 1e-3 ? `${t('event.instant')}: ` : `${t('event.after', { time: formatSimTime(info.waitS, lang) })}: `;
  const ph = info.phase;
  switch (info.act) {
    case 'scatter': return mode === 'protons' ? t('event.proton_heat') : t('event.scatter');
    case 'brems': return ph === 'photon' || ph === 'done' ? t('event.photon') : t('event.electron_arrives');
    case 'photoneutron':
      if (ph === 'start') return t('event.electron_arrives');
      if (ph === 'photon') return t('event.photon');
      if (ph === 'gdr') return t('event.gdr');
      return `${t('event.neutron_out')} — ${t('event.now', { label: lbl(info.to) })}`;
    case 'capture': return ph === 'start' ? t('event.neutron_arrives') : `${t('event.capture_gamma')} — ${t('event.now', { label: lbl(info.to) })}`;
    case 'photonPass': return t('event.photons_pass');
    case 'ionize':
      if (ph === 'start') return mode === 'photons' ? t('event.photon_arrives') : t('event.electron_arrives');
      if (ph === 'hole') return mode === 'photons' ? t('event.photo_ionize') : t('event.ionize');
      return t('event.xray_char');
    case 'alpha': return wait + (ph === 'start' ? t('event.alpha_prep') : t('event.alpha_out', { label: lbl(info.to) }));
    case 'betaMinus': return wait + (ph === 'start' ? t('event.beta_prep') : t('event.beta_minus', { label: lbl(info.to) }));
    case 'betaPlus': return wait + (ph === 'start' ? t('event.betaplus_prep') : t('event.beta_plus', { label: lbl(info.to) }));
    case 'ec': return wait + (ph === 'start' ? t('event.ec_prep') : ph === 'emit' ? t('event.ec_done', { label: lbl(info.to) }) : `${t('event.ec_done', { label: lbl(info.to) })} · ${t('event.xray_char')}`);
    case 'fission': return ph === 'stretch' ? t('event.fission_stretch') : info.fission ? t('event.fission', { a: lbl(info.fission.light), b: lbl(info.fission.heavy), n: info.fission.neutrons }) : '';
    case 'breakup': return wait + t('event.breakup', { from: lbl(info.from) });
  }
}

function chainEntry(info: ActInfo): string | null {
  const n = labelNuclide(info);
  if (n) return nuclideLabel(n);
  if (info.fission && (info.phase === 'split' || info.phase === 'done')) return `${nuclideLabel(info.fission.light)} + ${nuclideLabel(info.fission.heavy)}`;
  return null;
}

export function Inspector(props: { solution: BenchSolution }) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const selected = useWorkbench((s) => s.devices.find((d) => d.id === s.selectedId) ?? null);
  const target = selected ? props.solution.targets[selected.id] : undefined;
  const [last, setLast] = useState<ActInfo | null>(null);
  const [chain, setChain] = useState<string[]>([]);
  const exposure = useClock((s) => (selected ? s.exposure[selected.id] : undefined));
  const thicknessMm = typeof selected?.params['thickness'] === 'number' ? (selected.params['thickness'] as number) : 2;
  const lang: Lang = i18n.language === 'en' ? 'en' : 'tr';

  const mode: AtomMode = !target || !target.incoming
    ? 'idle'
    : target.incoming === 'electrons'
      ? (target.aboveThreshold ? 'above' : 'below')
      : target.incoming === 'neutrons' ? 'neutrons' : target.incoming === 'protons' ? 'protons' : 'photons';

  useEffect(() => { setLast(null); setChain([]); }, [selected?.id, mode]);
  const onAct = useCallback((info: ActInfo) => {
    setLast(info);
    setChain((prev) => {
      const first = info.depth === 0 && (info.phase === 'start' || info.phase === 'stretch' || info.phase === 'photon');
      const base = first ? [nuclideLabel(info.from)] : prev.length ? prev : [nuclideLabel(info.from)];
      const entry = chainEntry(info);
      if (entry && base[base.length - 1] !== entry) return [...base, entry];
      return base;
    });
  }, []);

  const tube = selected ? props.solution.tubes[selected.id] : undefined;
  if (selected && tube) {
    const vb = breakdownVoltageV(tube.gas as GasId, tube.pressurePa, 0.2);
    return (
      <aside className="inspector">
        <h2>{t('inspector.tube')}</h2>
        <div className="inspector-head">
          <span className="nuclide">{t(`regime.${tube.regime}`)}</span>
          <span className="muted">{t(`gas.${tube.gas}`)} · {si(tube.pressurePa, 1)}Pa</span>
        </div>
        <PaschenChart gas={tube.gas as GasId} pressurePa={tube.pressurePa} gapM={0.2} />
        <dl className="facts">
          <dt>V</dt><dd>{si(tube.voltageV, 2)}V</dd>
          <dt>V_b</dt><dd>{Number.isFinite(vb) ? `${si(vb, 2)}V` : '∞'}</dd>
          <dt>I</dt><dd>{tube.beamCurrentA > 0 ? `${si(tube.beamCurrentA, 2)}A` : '—'}</dd>
          <dt>E</dt><dd>{tube.electronEnergyMeV > 0 ? `${tube.electronEnergyMeV.toFixed(2)} MeV` : '—'}</dd>
        </dl>
        <p className="note">{t('inspector.paschen')}</p>
      </aside>
    );
  }

  const cell = selected ? props.solution.cells[selected.id] : undefined;
  if (selected && cell) {
    const tissueKey = (typeof selected.params['tissue'] === 'string' ? selected.params['tissue'] : 'earlyResponding') as 'earlyResponding' | 'lateResponding' | 'radioresistant';
    const tissueLabel = tissueKey === 'earlyResponding' ? 'early' : tissueKey === 'lateResponding' ? 'late' : 'resistant';
    return (
      <aside className="inspector">
        <h2>{t('cell.title')}</h2>
        <div className="inspector-head">
          <span className="nuclide">{t(`tissue.${tissueLabel}`)}</span>
          <span className="muted">{cell.incoming ? t(`incoming.${cell.incoming}`) : t('cell.none')}</span>
        </div>
        <CellView sol={cell} accumulatedGy={exposure?.accumulated ?? 0} irradiatedS={exposure?.irradiatedS ?? 0} tissue={tissueKey} reduce={reduce} lang={lang} />
      </aside>
    );
  }

  if (!selected || !target) {
    return (
      <aside className="inspector">
        <h2>{t('inspector.title')}</h2>
        <p className="hint">{t('inspector.empty')}</p>
      </aside>
    );
  }

  const sym = target.element.symbol;
  const special = specialIsotopeKey(target.nuclide);
  const name = special ? t(special) : t(`element.${sym}`);
  const shells = bohrShells(target.nuclide.Z);
  const shown = (last ? labelNuclide(last) : null) ?? target.nuclide;
  const headLabel = last && last.fission && (last.phase === 'split' || last.phase === 'done') ? `${nuclideLabel(last.fission.light)} + ${nuclideLabel(last.fission.heavy)}` : nuclideLabel(shown);
  const decay = decayOf(shown);
  const unstable = decay !== null && decay.mode !== 'stable';
  const text = reduce
    ? (mode === 'above' && target.product ? t('event.now', { label: nuclideLabel(target.product) })
      : mode === 'below' ? t('event.below_threshold')
      : mode === 'neutrons' && target.product ? t('event.now', { label: nuclideLabel(target.product) })
      : mode === 'photons' ? t('event.photons_pass')
      : mode === 'protons' ? t('event.proton_heat') : '')
    : narrative(t as Tr, last, mode, lang);

  return (
    <aside className="inspector">
      <h2>{t('inspector.title')}</h2>
      <div className="inspector-head">
        <span className="nuclide">{headLabel}</span>
        <span className="muted">{name} · Z={shown.Z}</span>
      </div>
      <BohrAtom nuclide={target.nuclide} mode={mode} reduce={reduce} size={260} onAct={onAct} />
      <p className={`narrative ${mode !== 'idle' || last ? 'on' : ''}`}>{text || ' '}</p>
      {chain.length > 1 ? <p className="chain">{chain.join(' → ')}</p> : null}
      <dl className="facts">
        <dt>{t('inspector.protons')}</dt><dd>{shown.Z}</dd>
        <dt>{t('inspector.neutrons')}</dt><dd>{neutronCount(shown)}</dd>
        <dt>{t('inspector.electrons')}</dt><dd>{shells.join(' · ')}</dd>
        <dt>{t('inspector.halfLife')}</dt><dd className={unstable ? 'warn' : ''}>{decay ? (unstable ? halfLifeText(decay.halfLifeS, lang) : t('inspector.stable')) : t('inspector.noData')}</dd>
        {unstable && decay ? (<><dt>{t('inspector.decay')}</dt><dd className="warn">{t(`decay.${decay.mode}`)} · Q {decay.qMeV.toFixed(2)} MeV</dd></>) : null}
        <dt>(γ,n)</dt><dd>{target.thresholdMeV.toFixed(2)} MeV</dd>
        <dt>{t('incoming.none').replace('—', 'gelen')}</dt><dd>{target.incoming ? t(`incoming.${target.incoming}`) : t('incoming.none')}</dd>
        {target.incoming === 'electrons' ? (
          <>
            <dt>E</dt><dd className={target.aboveThreshold ? 'ok' : 'warn'}>{target.electronEnergyMeV.toFixed(2)} MeV</dd>
            <dt>n/s</dt><dd className={target.neutronYieldPerS > 0 ? 'ok' : ''}>{target.neutronYieldPerS > 0 ? si(target.neutronYieldPerS, 2) : '0'}</dd>
          </>
        ) : null}
        {target.product ? (<><dt>→</dt><dd className="ok">{nuclideLabel(target.nuclide)} → {nuclideLabel(target.product)}</dd></>) : null}
      </dl>
      {unstable || decayOf(target.nuclide)?.mode !== 'stable' ? <p className="note">{t('event.chainNote')}</p> : null}
      {target.incoming === 'electrons' ? (
        <div className="inventory">
          <h3>{t('inspector.spectrum')}</h3>
          <SpectrumChart anodeZ={target.element.Z} tubeVoltageV={target.electronEnergyMeV * 1e6} filterMm={0} />
        </div>
      ) : null}
      <InventoryTable element={target.element} thicknessMm={thicknessMm} exposure={exposure} lang={lang} A={target.nuclide.A} />
    </aside>
  );
}
