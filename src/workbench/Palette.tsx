import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PALETTE, type PaletteEntry } from './catalog.ts';
import { DeviceGlyph, GlyphDefs } from './DeviceGlyph.tsx';
import { specOf } from './catalog.ts';
import { useWorkbench } from './model.ts';
import { PRESETS } from './presets.ts';

/**
 * Sag panel: cihaz paleti. Bir kalemi basili tutup tezgaha suruklersin;
 * yerlestirme mantigi Workbench'te (pointer olaylari pencere duzeyinde).
 */
export function Palette(props: { onBeginPlace: (entry: PaletteEntry, e: ReactPointerEvent) => void }) {
  const { t } = useTranslation();
  const clear = useWorkbench((s) => s.clear);
  const count = useWorkbench((s) => s.devices.length);
  return (
    <aside className="palette">
      <div className="palette-head">
        <h2>{t('palette.title')}</h2>
        <p className="hint">{t('palette.hint')}</p>
      </div>
      <div className="palette-list">
        {PALETTE.map((entry) => {
          const spec = specOf(entry.kind);
          const scale = Math.min(0.34, 40 / spec.h, 72 / spec.w);
          return (
            <button
              key={entry.id}
              type="button"
              className="palette-item"
              onPointerDown={(e) => {
                e.preventDefault();
                props.onBeginPlace(entry, e);
              }}
            >
              <svg width={76} height={44} viewBox={`0 0 ${76 / scale} ${44 / scale}`} aria-hidden="true">
                <GlyphDefs />
                <g transform={`translate(${(76 / scale - spec.w) / 2} ${(44 / scale - spec.h) / 2})`}>
                  <DeviceGlyph kind={entry.kind} params={entry.defaults} selected={false} active={false} />
                </g>
              </svg>
              <span>{t(entry.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {count > 0 ? (
        <button type="button" className="palette-clear" onClick={clear}>
          {t('palette.clear')}
        </button>
      ) : null}
      <div className="presets">
        <h3>{t('preset.title')}</h3>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="palette-clear" onClick={p.build}>
            {t(p.labelKey)}
          </button>
        ))}
      </div>
    </aside>
  );
}
