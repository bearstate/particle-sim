import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkbench } from './model.ts';
import { BohrAtom, type AtomPhase } from './BohrAtom.tsx';
import type { BenchSolution } from './solve.ts';
import { nuclideLabel, specialIsotopeKey, bohrShells, neutronCount } from '../physics/data/nuclides.ts';
import { si } from '../ui/Controls.tsx';

/**
 * Mikro gorunum: secili hedefin atomu ve uzerinde olan biten.
 * Olay surdukce (demet acikken) ~3 s'de bir bastan oynar.
 */
export function Inspector(props: { solution: BenchSolution }) {
  const { t } = useTranslation();
  const selected = useWorkbench((s) => s.devices.find((d) => d.id === s.selectedId) ?? null);
  const target = selected ? props.solution.targets[selected.id] : undefined;
  const [playKey, setPlayKey] = useState(0);
  const [phase, setPhase] = useState<AtomPhase>({ t: 0, label: 'idle' });

  const event = target?.event ?? null;
  useEffect(() => {
    if (!event) return;
    setPlayKey((k) => k + 1);
    const id = setInterval(() => setPlayKey((k) => k + 1), 3200);
    return () => clearInterval(id);
  }, [event, selected?.id]);

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
  const done = phase.label === 'done';
  const shown = done && target.product ? target.product : target.nuclide;

  const narrative = (() => {
    switch (phase.label) {
      case 'electron': return t('event.electron_arrives');
      case 'photon': return t('event.photon');
      case 'gdr': return event === 'below_threshold' ? t('event.below_threshold') : t('event.gdr');
      case 'neutron': return t('event.neutron_out');
      case 'capture': return t('event.capture');
      case 'done':
        if (target.product) return t('event.now', { label: nuclideLabel(target.product) });
        return t('event.below_threshold');
      default: return '';
    }
  })();

  return (
    <aside className="inspector">
      <h2>{t('inspector.title')}</h2>
      <div className="inspector-head">
        <span className="nuclide">{nuclideLabel(shown)}</span>
        <span className="muted">{name} · Z={target.nuclide.Z}</span>
      </div>
      <BohrAtom nuclide={target.nuclide} event={event} playKey={playKey} size={260} onPhase={setPhase} />
      <p className={`narrative ${event ? 'on' : ''}`}>{narrative || ' '}</p>
      <dl className="facts">
        <dt>{t('inspector.protons')}</dt><dd>{target.nuclide.Z}</dd>
        <dt>{t('inspector.neutrons')}</dt><dd>{neutronCount(shown)}</dd>
        <dt>{t('inspector.electrons')}</dt><dd>{shells.join(' · ')}</dd>
        <dt>(γ,n)</dt><dd>{target.thresholdMeV.toFixed(2)} MeV</dd>
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
