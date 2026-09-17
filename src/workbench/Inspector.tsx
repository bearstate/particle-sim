import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkbench } from './model.ts';
import { BohrAtom, type ActInfo, type AtomMode } from './BohrAtom.tsx';
import type { BenchSolution } from './solve.ts';
import { nuclideLabel, specialIsotopeKey, bohrShells, neutronCount } from '../physics/data/nuclides.ts';
import { si } from '../ui/Controls.tsx';
import { useReducedMotion } from '../ui/useReducedMotion.ts';
import { useClock, formatSimTime } from './clock.ts';
import { computeInventory } from './inventory.ts';
import { CellView } from './CellView.tsx';
import { formatHalfLife } from '../physics/nuclear/decay.ts';

/**
 * Mikro gorunum: secili hedefin atomu ve uzerinde olan biten.
 * Koreografi BohrAtom'un icinde; burada yalnizca mod secilir ve anlati yazilir.
 */
function InventoryTable(props: { element: import('../physics/data/elements.ts').Element; thicknessMm: number; exposure: import('./clock.ts').Exposure | undefined; lang: 'tr' | 'en' }) {
  const { t } = useTranslation();
  const inv = computeInventory(props.element, props.thicknessMm, props.exposure);
  if (!inv) return null;
  const products = inv.rows.slice(1);
  const maxAtoms = Math.max(1, ...products.map((r) => r.atoms));
  const hl = (s: number) => {
    if (!Number.isFinite(s)) return '∞';
    const f = formatHalfLife(s);
    const unit = props.lang === 'tr' ? { s: 's', min: 'dk', h: 'sa', d: 'g', y: 'y' }[f.unit] : f.unit;
    return `${f.value < 10 ? f.value.toFixed(2) : f.value.toFixed(0)} ${unit}`;
  };
  return (
    <div className="inventory">
      <h3>{t('inventory.title')} · {inv.reaction.targetSymbol}-{inv.reaction.targetA} (n,γ)</h3>
      <table>
        <thead>
          <tr><th>{t('inventory.nuclide')}</th><th>{t('inventory.atoms')}</th><th>{t('inventory.activity')}</th><th>{t('inventory.halfLife')}</th></tr>
        </thead>
        <tbody>
          {inv.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}{r.index > 0 ? <div className="bar" style={{ width: `${Math.max(2, (100 * r.atoms) / maxAtoms).toFixed(1)}%` }} /> : null}</td>
              <td>{si(r.atoms, 2)}</td>
              <td>{r.activityBq > 0 ? `${si(r.activityBq, 2)}Bq` : '—'}</td>
              <td>{hl(r.halfLifeS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        {si(inv.captureRatePerS, 2)} {t('inventory.captures')} · {t('inventory.flux')} {si(props.exposure?.fluxPerM2S ?? 0, 2)}/m²s · {formatSimTime(props.exposure?.irradiatedS ?? 0, props.lang)}
        {(props.exposure?.cooledS ?? 0) > 0 ? ` + ${formatSimTime(props.exposure?.cooledS ?? 0, props.lang)}` : ''}
      </p>
    </div>
  );
}

export function Inspector(props: { solution: BenchSolution }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const selected = useWorkbench((s) => s.devices.find((d) => d.id === s.selectedId) ?? null);
  const target = selected ? props.solution.targets[selected.id] : undefined;
  const [last, setLast] = useState<ActInfo | null>(null);
  const exposure = useClock((s) => (selected ? s.exposure[selected.id] : undefined));
  const thicknessMm = typeof selected?.params['thickness'] === 'number' ? (selected.params['thickness'] as number) : 2;
  const lang = useTranslation().i18n.language === 'en' ? 'en' : 'tr';

  const mode: AtomMode = !target || !target.incoming
    ? 'idle'
    : target.incoming === 'electrons'
      ? (target.aboveThreshold ? 'above' : 'below')
      : target.incoming === 'neutrons' ? 'neutrons' : target.incoming === 'protons' ? 'protons' : 'photons';

  useEffect(() => setLast(null), [selected?.id, mode]);
  const onAct = useCallback((info: ActInfo) => setLast(info), []);

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
  const transmuted = last && ((last.act === 'photoneutron' && (last.phase === 'neutron' || last.phase === 'done')) || (last.act === 'capture' && (last.phase === 'gdr' || last.phase === 'done')));
  const shown = transmuted && target.product ? target.product : target.nuclide;

  const narrative = (() => {
    if (reduce) {
      if (mode === 'above' && target.product) return t('event.now', { label: nuclideLabel(target.product) });
      if (mode === 'below') return t('event.below_threshold');
      if (mode === 'neutrons' && target.product) return t('event.now', { label: nuclideLabel(target.product) });
      if (mode === 'photons') return t('event.photons_pass');
      if (mode === 'protons') return t('event.proton_heat');
      return '';
    }
    if (!last) return '';
    switch (last.act) {
      case 'scatter': return mode === 'protons' ? t('event.proton_heat') : t('event.scatter');
      case 'brems': return last.phase === 'photon' || last.phase === 'done' ? t('event.photon') : t('event.electron_arrives');
      case 'photoneutron':
        if (last.phase === 'start') return t('event.electron_arrives');
        if (last.phase === 'photon') return t('event.photon');
        if (last.phase === 'gdr') return t('event.gdr');
        return `${t('event.neutron_out')} — ${target.product ? t('event.now', { label: nuclideLabel(target.product) }) : ''}`;
      case 'capture':
        return last.phase === 'start' ? t('event.electron_arrives').replace(/.*/, t('incoming.neutrons')) + ' →' : `${t('event.capture')} — ${target.product ? t('event.now', { label: nuclideLabel(target.product) }) : ''}`;
      case 'photonPass': return t('event.photons_pass');
    }
  })();

  return (
    <aside className="inspector">
      <h2>{t('inspector.title')}</h2>
      <div className="inspector-head">
        <span className="nuclide">{nuclideLabel(shown)}</span>
        <span className="muted">{name} · Z={target.nuclide.Z}</span>
      </div>
      <BohrAtom nuclide={target.nuclide} mode={mode} reduce={reduce} size={260} onAct={onAct} />
      <p className={`narrative ${mode !== 'idle' ? 'on' : ''}`}>{narrative || ' '}</p>
      <dl className="facts">
        <dt>{t('inspector.protons')}</dt><dd>{target.nuclide.Z}</dd>
        <dt>{t('inspector.neutrons')}</dt><dd>{neutronCount(shown)}</dd>
        <dt>{t('inspector.electrons')}</dt><dd>{shells.join(' · ')}</dd>
        <dt>(γ,n)</dt><dd>{target.thresholdMeV.toFixed(2)} MeV</dd>
        <dt>{t('incoming.none').replace('—', 'gelen')}</dt><dd>{target.incoming ? t(`incoming.${target.incoming}`) : t('incoming.none')}</dd>
        {target.incoming === 'electrons' ? (
          <>
            <dt>E</dt><dd className={target.aboveThreshold ? 'ok' : 'warn'}>{target.electronEnergyMeV.toFixed(2)} MeV</dd>
            <dt>n/s</dt><dd className={target.neutronYieldPerS > 0 ? 'ok' : ''}>{target.neutronYieldPerS > 0 ? si(target.neutronYieldPerS, 2) : '0'}</dd>
          </>
        ) : null}
        {target.product ? (
          <>
            <dt>→</dt><dd className="ok">{nuclideLabel(target.nuclide)} → {nuclideLabel(target.product)}</dd>
          </>
        ) : null}
      </dl>
      <InventoryTable element={target.element} thicknessMm={thicknessMm} exposure={exposure} lang={lang} />
    </aside>
  );
}
