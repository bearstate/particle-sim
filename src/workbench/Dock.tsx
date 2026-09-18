import { useTranslation } from 'react-i18next';
import { useWorkbench } from './model.ts';
import { specOf, type ParamSpec } from './catalog.ts';
import { Slider, Picker, Readout, si } from '../ui/Controls.tsx';
import type { BenchSolution } from './solve.ts';

/**
 * Alt dock: secili cihazin kontrolleri ParamSpec'ten OTOMATIK uretilir,
 * yaninda o cihazin telemetrisi. Cihaz basina panel yazilmaz.
 */
export function Dock(props: { solution: BenchSolution }) {
  const { t } = useTranslation();
  const device = useWorkbench((s) => s.devices.find((d) => d.id === s.selectedId) ?? null);
  const setParam = useWorkbench((s) => s.setParam);
  const removeDevice = useWorkbench((s) => s.removeDevice);

  if (!device) {
    return <div className="dock dock-empty">{t('dock.empty')}</div>;
  }

  const spec = specOf(device.kind);
  const value = (key: string) => device.params[key];

  const renderParam = (p: ParamSpec) => {
    if (p.kind === 'number') {
      const v = typeof value(p.key) === 'number' ? (value(p.key) as number) : p.min;
      const scale = p.displayScale ?? 1;
      const display =
        p.displayScale !== undefined
          ? `${(v * scale).toFixed(p.digits ?? 0)} ${p.unit}`
          : `${si(v, p.digits ?? 2)}${p.unit}`;
      return (
        <Slider
          key={p.key}
          label={t(p.labelKey)}
          value={v}
          min={p.min}
          max={p.max}
          step={p.step}
          display={display}
          onChange={(x) => setParam(device.id, p.key, x)}
          {...(p.log ? { log: true } : {})}
        />
      );
    }
    if (p.kind === 'enum') {
      const v = typeof value(p.key) === 'string' ? (value(p.key) as string) : p.options[0]!.value;
      return (
        <Picker
          key={p.key}
          label={t(p.labelKey)}
          value={v}
          options={p.options.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(x) => setParam(device.id, p.key, x)}
        />
      );
    }
    const v = typeof value(p.key) === 'string' ? (value(p.key) as string) : p.options[0]!;
    return (
      <Picker
        key={p.key}
        label={t(p.labelKey)}
        value={v}
        options={p.options.map((sym) => ({ value: sym, label: `${sym} · ${t(`element.${sym}`)}` }))}
        onChange={(x) => setParam(device.id, p.key, x)}
      />
    );
  };

  return (
    <div className="dock">
      <div className="dock-controls">
        <div className="dock-title">
          <span>
            {device.kind === 'target'
              ? `${t('device.target_any')} · ${String(device.params['element'] ?? '')}`
              : t(`device.${device.kind}`)}
          </span>
          <button type="button" className="link-btn" onClick={() => removeDevice(device.id)}>
            {t('dock.remove')}
          </button>
        </div>
        <div className="dock-grid">{spec.params.filter((p) => p.kind !== 'enum' || !p.onlyIf || p.onlyIf.values.includes(String(value(p.onlyIf.key) ?? ''))).map(renderParam)}</div>
      </div>
      <div className="dock-telemetry">
        <Telemetry id={device.id} kind={device.kind} solution={props.solution} />
      </div>
    </div>
  );
}

function Telemetry(props: { id: string; kind: string; solution: BenchSolution }) {
  const { t } = useTranslation();
  const v = props.solution.vdgs[props.id];
  const tube = props.solution.tubes[props.id];
  const g = props.solution.targets[props.id];
  const cl = props.solution.cells[props.id];
  if (cl) {
    return (
      <div className="readouts">
        <Readout k="gelen" v={cl.incoming ? t(`incoming.${cl.incoming}`) : t('incoming.none')} tone={cl.incoming ? 'hot' : 'zero'} />
        <Readout k="Gy/s" v={cl.doseRateGyPerS > 0 ? si(cl.doseRateGyPerS, 2) : '0'} tone={cl.doseRateGyPerS > 0 ? 'hot' : 'zero'} />
        <Readout k="Sv/h" v={cl.doseRateSvPerS > 0 ? si(cl.doseRateSvPerS * 3600, 2) : '0'} tone={cl.doseRateSvPerS > 0 ? 'hot' : 'zero'} />
        <Readout k="w_R" v={String(cl.wR)} />
      </div>
    );
  }
  const h = props.solution.hv[props.id];
  const k = props.solution.klystrons[props.id];
  const l = props.solution.linacs[props.id];

  if (h) {
    return (
      <div className="readouts">
        <Readout k={t('param.voltage')} v={`${si(h.voltageV, 2)}V`} tone={h.delivered ? 'neutron' : undefined} />
        <Readout k="ideal" v={`${si(h.idealV, 2)}V`} />
        <Readout k={h.kind === 'marx' ? 'η kaybı' : 'ΔV'} v={`${si(h.dropV, 2)}V`} tone={h.dropV > 0.2 * h.idealV ? 'hot' : undefined} />
        <Readout k="I" v={`${si(h.loadCurrentA, 2)}A`} tone={h.loadCurrentA > 0 ? undefined : 'zero'} />
        <Readout k={t('port.hv')} v={h.delivered ? t('vdg.delivered') : '—'} tone={h.delivered ? 'neutron' : 'zero'} />
      </div>
    );
  }
  if (k) {
    return (
      <div className="readouts">
        <Readout k={t('param.rfPower')} v={`${si(k.rfPowerW, 2)}W`} />
        <Readout k={t('port.rf')} v={k.delivered ? '→' : '—'} tone={k.delivered ? 'neutron' : 'zero'} />
      </div>
    );
  }
  if (l) {
    return (
      <>
        <div className="readouts">
          <Readout k="E" v={`${l.energyMeV.toFixed(2)} MeV`} tone={l.energyMeV > 0 ? 'neutron' : 'zero'} />
          <Readout k="I" v={`${si(l.beamCurrentA, 2)}A`} tone={l.beamCurrentA > 0 ? undefined : 'zero'} />
          <Readout k="P" v={`${si(l.beamPowerW, 2)}W`} />
          <Readout k="RF" v={`${si(l.rfPowerW, 2)}W`} tone={l.powered ? undefined : 'zero'} />
          <Readout k="E/L" v={`${l.gradientMVPerM.toFixed(2)} MV/m`} tone={l.arcing ? 'hot' : undefined} />
          <Readout k="Kilpatrick" v={`${l.kilpatrickMVPerM.toFixed(1)} MV/m`} />
        </div>
        {!l.powered ? <p className="note">{t('linac.noRf')}</p> : null}
        {l.arcing ? <p className="note">{t('linac.kilpatrick')}</p> : null}
      </>
    );
  }

  if (v) {
    return (
      <>
      <div className="readouts">
        <Readout k={t('param.voltage')} v={`${si(v.voltageV, 1)}V`} tone={v.breakdown ? 'hot' : undefined} />
        <Readout k="V_max" v={`${si(v.maxV, 1)}V`} tone={v.breakdown ? 'hot' : undefined} />
        <Readout k="⚡" v={`${(v.sparkM * 100).toFixed(1)} cm`} tone={v.arcRatePerS > 0 ? 'hot' : 'zero'} />
        <Readout k={t('port.hv')} v={v.delivered ? t('vdg.delivered') : '—'} tone={v.delivered ? 'neutron' : 'zero'} />
      </div>
      {v.breakdown ? <p className="note">{t('vdg.breakdown')}</p> : null}
      </>
    );
  }
  if (tube) {
    return (
      <div className="readouts">
        <Readout k="rejim" v={t(`regime.${tube.regime}`)} tone={tube.regime === 'vacuum' ? 'neutron' : tube.regime === 'off' ? 'zero' : 'hot'} />
        <Readout k="I" v={`${si(tube.beamCurrentA, 1)}A`} tone={tube.beamCurrentA > 0 ? undefined : 'zero'} />
        <Readout k="E" v={`${tube.electronEnergyMeV.toFixed(2)} MeV`} />
        <Readout k="P" v={`${si(tube.beamPowerW, 2)}W`} />
      </div>
    );
  }
  if (g) {
    return (
      <div className="readouts">
        <Readout k="gelen" v={g.incoming ? t(`incoming.${g.incoming}`) : t('incoming.none')} tone={g.incoming ? 'neutron' : 'zero'} />
        <Readout k="(γ,n)" v={`${g.thresholdMeV.toFixed(2)} MeV`} />
        <Readout k="E" v={g.incoming === 'electrons' ? `${g.electronEnergyMeV.toFixed(2)} MeV` : '—'} tone={g.aboveThreshold ? 'neutron' : g.incoming ? 'hot' : 'zero'} />
        <Readout k="n/s" v={g.neutronYieldPerS > 0 ? si(g.neutronYieldPerS, 2) : '0'} tone={g.neutronYieldPerS > 0 ? 'neutron' : 'zero'} />
        <Readout k="ısı" v={`${si(g.heatW, 2)}W`} tone={g.heatW > 0 ? 'hot' : 'zero'} />
      </div>
    );
  }
  return null;
}
