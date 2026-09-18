import { useTranslation } from 'react-i18next';
import type { Element } from '../physics/data/elements.ts';
import { si } from '../ui/Controls.tsx';
import { formatSimTime, type Exposure } from './clock.ts';
import { computeInventory } from './inventory.ts';
import { formatHalfLife } from '../physics/nuclear/decay.ts';

/** Hedefin nuklid envanteri: Bateman ile isinlama + sogutma. */
export function InventoryTable(props: { element: Element; thicknessMm: number; exposure: Exposure | undefined; lang: 'tr' | 'en'; A?: number }) {
  const { t } = useTranslation();
  const inv = computeInventory(props.element, props.thicknessMm, props.exposure, props.A);
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
