import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkbench } from './model.ts';
import { BohrAtom, type ActInfo, type AtomMode } from './BohrAtom.tsx';
import type { BenchSolution } from './solve.ts';
import { nuclideLabel, specialIsotopeKey, bohrShells, neutronCount } from '../physics/data/nuclides.ts';
import { si } from '../ui/Controls.tsx';
import { useReducedMotion } from '../ui/useReducedMotion.ts';

/**
 * Mikro gorunum: secili hedefin atomu ve uzerinde olan biten.
 * Koreografi BohrAtom'un icinde; burada yalnizca mod secilir ve anlati yazilir.
 */
export function Inspector(props: { solution: BenchSolution }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const selected = useWorkbench((s) => s.devices.find((d) => d.id === s.selectedId) ?? null);
  const target = selected ? props.solution.targets[selected.id] : undefined;
  const [last, setLast] = useState<ActInfo | null>(null);

  const mode: AtomMode = !target || !target.incoming
    ? 'idle'
    : target.incoming === 'electrons'
      ? (target.aboveThreshold ? 'above' : 'below')
      : target.incoming === 'neutrons' ? 'neutrons' : 'photons';

  useEffect(() => setLast(null), [selected?.id, mode]);
  const onAct = useCallback((info: ActInfo) => setLast(info), []);

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
      return '';
    }
    if (!last) return '';
    switch (last.act) {
      case 'scatter': return t('event.scatter');
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
    </aside>
  );
}
