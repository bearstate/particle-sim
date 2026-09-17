import { useMemo } from 'react';
import { breakdownVoltageV, paschenMinimum } from '../physics/gas/paschen.ts';
import type { GasId } from '../physics/gas/gases.ts';

/**
 * Paschen egrisi, log-log. PHYSICS.md bolum 1.C.
 *
 * Egrinin SOL dali simulasyonun en sezgi-disi kismidir: basinc dustukce
 * delinme gerilimi TEKRAR yukselir, cunku carpisacak molekul kalmaz.
 * Calisma noktasi bu egri uzerinde gezdirilerek gorulur.
 */

const W = 520;
const H = 220;
const PAD = { l: 46, r: 12, t: 12, b: 30 };

export function PaschenChart(props: { gas: GasId; pressurePa: number; gapM: number }) {
  const { gas, pressurePa, gapM } = props;

  const { path, minimum, xMin, xMax, yMin, yMax } = useMemo(() => {
    const lo = -2; // log10(Pa*m)
    const hi = 4;
    const yLo = Math.log10(100);
    const yHi = Math.log10(3e5);
    const pts: string[] = [];
    for (let i = 0; i <= 240; i++) {
      const lx = lo + ((hi - lo) * i) / 240;
      const pd = Math.pow(10, lx);
      // Egriyi sabit aralikta, degisen basincta ciz.
      const v = breakdownVoltageV(gas, pd / gapM, gapM);
      if (!Number.isFinite(v) || v <= 0) {
        pts.push('');
        continue;
      }
      const ly = Math.log10(v);
      if (ly < yLo || ly > yHi) {
        pts.push('');
        continue;
      }
      const x = PAD.l + ((lx - lo) / (hi - lo)) * (W - PAD.l - PAD.r);
      const y = H - PAD.b - ((ly - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b);
      pts.push(`${pts[pts.length - 1] === '' || i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return {
      path: pts.filter(Boolean).join(' '),
      minimum: paschenMinimum(gas),
      xMin: lo,
      xMax: hi,
      yMin: yLo,
      yMax: yHi,
    };
  }, [gas, gapM]);

  const toX = (pd: number) => PAD.l + ((Math.log10(pd) - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const toY = (v: number) => H - PAD.b - ((Math.log10(v) - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const pd = pressurePa * gapM;
  const vNow = breakdownVoltageV(gas, pressurePa, gapM);
  const onChart = Number.isFinite(vNow) && vNow > Math.pow(10, yMin) && vNow < Math.pow(10, yMax) && pd > Math.pow(10, xMin) && pd < Math.pow(10, xMax);

  const decades = [-2, -1, 0, 1, 2, 3, 4];
  const vTicks = [100, 1000, 1e4, 1e5];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Paschen egrisi">
      {decades.map((d) => (
        <g key={d}>
          <line x1={toX(Math.pow(10, d))} x2={toX(Math.pow(10, d))} y1={PAD.t} y2={H - PAD.b} stroke="#242a36" />
          <text x={toX(Math.pow(10, d))} y={H - 10} fill="#868fa1" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
            1e{d}
          </text>
        </g>
      ))}
      {vTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={toY(v)} y2={toY(v)} stroke="#242a36" />
          <text x={PAD.l - 6} y={toY(v) + 3} fill="#868fa1" fontSize="10" textAnchor="end" fontFamily="ui-monospace, monospace">
            {v >= 1000 ? `${v / 1000}k` : v}
          </text>
        </g>
      ))}

      <path d={path} fill="none" stroke="#4da3ff" strokeWidth="1.8" />

      {minimum ? (
        <g>
          <circle cx={toX(minimum.pdPaM)} cy={toY(minimum.voltageV)} r="3" fill="none" stroke="#868fa1" />
          <text x={toX(minimum.pdPaM) + 7} y={toY(minimum.voltageV) + 12} fill="#868fa1" fontSize="10" fontFamily="ui-monospace, monospace">
            min {minimum.voltageV.toFixed(0)} V
          </text>
        </g>
      ) : null}

      {onChart ? (
        <g>
          <line x1={toX(pd)} x2={toX(pd)} y1={PAD.t} y2={H - PAD.b} stroke="#ff8a3d" strokeDasharray="3 3" strokeWidth="1" />
          <circle cx={toX(pd)} cy={toY(vNow)} r="4.5" fill="#ff8a3d" />
        </g>
      ) : null}

      <text x={W - PAD.r} y={H - 10} fill="#868fa1" fontSize="10" textAnchor="end">
        p&#183;d (Pa&#183;m)
      </text>
      <text x={PAD.l - 6} y={PAD.t + 8} fill="#868fa1" fontSize="10" textAnchor="end">
        V
      </text>
    </svg>
  );
}
