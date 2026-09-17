import { useMemo } from 'react';
import {
  kramersSpectrum,
  addCharacteristicLines,
  characteristicLines,
  meanEnergyKeV,
} from '../physics/interaction/bremsstrahlung.ts';
import { filterTransmissionFn } from '../physics/interaction/attenuation.ts';

/**
 * X-isini spektrumu. PHYSICS.md bolum 1.E.
 *
 * Iki sey ayni anda gorunur: surekli bremsstrahlung tabani (Kramers) ve
 * hizlandirma gerilimi K kabuk baglanma enerjisini gectigi anda beliren
 * karakteristik DIKEN. W icin bu esik 69.5 kV'dir; kaydiriciyi oradan gecirmek
 * bu simulasyonun en tatmin edici etkilesimi.
 */

const W = 520;
const H = 220;
const PAD = { l: 40, r: 12, t: 14, b: 30 };

export function SpectrumChart(props: {
  anodeZ: number;
  tubeVoltageV: number;
  /** Al filtre kalinligi, mm. Dusuk enerjili kuyrugu kirpar (demet sertlesmesi). */
  filterMm: number;
}) {
  const { anodeZ, tubeVoltageV, filterMm } = props;

  const { spectrum, lines, mean, peak } = useMemo(() => {
    const attenuation =
      filterMm > 0 ? filterTransmissionFn(13, 26.982, 2.7, filterMm / 10) : undefined;
    const base = kramersSpectrum(anodeZ, tubeVoltageV, 160, attenuation);
    const withLines = addCharacteristicLines(base, anodeZ, tubeVoltageV);
    let max = 0;
    for (const w of withLines.weights) if (w > max) max = w;
    return {
      spectrum: withLines,
      lines: characteristicLines(anodeZ),
      mean: meanEnergyKeV(withLines),
      peak: max,
    };
  }, [anodeZ, tubeVoltageV, filterMm]);

  const endpoint = spectrum.endpointKeV;
  const toX = (keV: number) => PAD.l + (keV / endpoint) * (W - PAD.l - PAD.r);
  const toY = (w: number) => H - PAD.b - (peak > 0 ? w / peak : 0) * (H - PAD.t - PAD.b);

  const area = useMemo(() => {
    const pts: string[] = [`M${PAD.l},${H - PAD.b}`];
    for (let i = 0; i < spectrum.energiesKeV.length; i++) {
      const e = spectrum.energiesKeV[i] ?? 0;
      const w = spectrum.weights[i] ?? 0;
      pts.push(`L${toX(e).toFixed(1)},${toY(w).toFixed(1)}`);
    }
    pts.push(`L${(W - PAD.r).toFixed(1)},${H - PAD.b}Z`);
    return pts.join('');
  }, [spectrum, peak, endpoint]);

  const kvp = tubeVoltageV / 1000;
  const linesActive = kvp > lines.kEdgeKeV;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * endpoint);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="X-isini spektrumu">
      <defs>
        <linearGradient id="xraygrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b98cff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#b98cff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={toX(t)} x2={toX(t)} y1={PAD.t} y2={H - PAD.b} stroke="#242a36" />
          <text x={toX(t)} y={H - 10} fill="#868fa1" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
            {t.toFixed(0)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#xraygrad)" stroke="#b98cff" strokeWidth="1.4" />

      {/* K kenari: cizgilerin dogdugu esik */}
      {lines.kEdgeKeV < endpoint ? (
        <g>
          <line
            x1={toX(lines.kEdgeKeV)}
            x2={toX(lines.kEdgeKeV)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke={linesActive ? '#46d6c4' : '#3a4150'}
            strokeDasharray="4 3"
            strokeWidth="1"
          />
          <text
            x={toX(lines.kEdgeKeV) + 4}
            y={PAD.t + 10}
            fill={linesActive ? '#46d6c4' : '#868fa1'}
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            K {lines.kEdgeKeV.toFixed(1)}
          </text>
        </g>
      ) : null}

      {/* Duane-Hunt siniri */}
      <line x1={W - PAD.r} x2={W - PAD.r} y1={PAD.t} y2={H - PAD.b} stroke="#ff8a3d" strokeWidth="1" />

      <text x={W - PAD.r} y={H - 10} fill="#868fa1" fontSize="10" textAnchor="end">
        keV
      </text>
      <text x={PAD.l} y={PAD.t + 10} fill="#868fa1" fontSize="10">
        {linesActive ? `Kα ${lines.kAlphaKeV.toFixed(1)} keV aktif` : 'karakteristik çizgi yok'}
        {`  ·  ort ${mean.toFixed(1)} keV`}
      </text>
    </svg>
  );
}
