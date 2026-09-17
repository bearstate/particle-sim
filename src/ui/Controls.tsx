import type { ReactNode } from 'react';

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  /** Logaritmik kaydirici: deger log10 uzayinda tasinir. */
  log?: boolean;
}) {
  const { log = false } = props;
  const toSlider = (v: number) => (log ? Math.log10(v) : v);
  const fromSlider = (v: number) => (log ? Math.pow(10, v) : v);
  return (
    <div className="control">
      <div className="control-head">
        <label>{props.label}</label>
        <output>{props.display}</output>
      </div>
      <input
        type="range"
        min={toSlider(props.min)}
        max={toSlider(props.max)}
        step={props.step}
        value={toSlider(props.value)}
        onChange={(e) => props.onChange(fromSlider(Number(e.target.value)))}
      />
    </div>
  );
}

export function Picker<T extends string | number>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="control">
      <div className="control-head">
        <label>{props.label}</label>
      </div>
      <select
        value={String(props.value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = props.options.find((o) => String(o.value) === raw);
          if (match) props.onChange(match.value);
        }}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Readout(props: { k: string; v: string; tone?: 'zero' | 'hot' | 'neutron' | undefined }) {
  return (
    <div className="readout">
      <span className="k">{props.k}</span>
      <span className={`v ${props.tone ?? ''}`}>{props.v}</span>
    </div>
  );
}

export function Panel(props: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{props.title}</h2>
      {props.hint ? <p className="hint">{props.hint}</p> : null}
      {props.children}
    </section>
  );
}

/** SI on eki ile bicimle: 1.2e-9 -> "1.20 n". */
export function si(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '∞';
  if (value === 0) return '0';
  const prefixes = [
    [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
    [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
  ] as const;
  const abs = Math.abs(value);
  for (const [scale, suffix] of prefixes) {
    if (abs >= scale) return `${(value / scale).toFixed(digits)} ${suffix}`;
  }
  return value.toExponential(digits);
}
