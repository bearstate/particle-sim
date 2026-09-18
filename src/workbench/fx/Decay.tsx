import { useMemo } from 'react';

/**
 * Tezgahtaki kararsiz hedef: kosede yanip sonen trefoil ve govdeden firlayan
 * kucuk alfa (sari, agir) / beta (mavi, hafif) kivilcimlari. Sayi aktivitenin
 * logaritmasiyla olceklenir; gorsel ornektir, telemetri envanter tablosundadir.
 * Donus SVG transform ozniteligiyle (statik), ucus CSS animasyonuyla (translateX).
 */
export function DecayBadge(props: { activityBq: number; w: number; cx: number; cy: number; reduce: boolean }) {
  const n = Math.max(2, Math.min(9, 2 + Math.round(Math.log10(Math.max(1, props.activityBq)))));
  const sparks = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ a: (i / n) * 360 + ((i * 137) % 50), d: ((i * 0.37) % 1.3).toFixed(2), beta: i % 3 !== 0 })),
    [n],
  );
  return (
    <g pointerEvents="none">
      <text className={props.reduce ? '' : 'rad-pulse'} x={props.w - 10} y={16} fill="#ffcf5a" fontSize={13} textAnchor="middle" fontFamily="system-ui, sans-serif">☢</text>
      {!props.reduce ? (
        <g transform={`translate(${props.cx} ${props.cy})`}>
          {sparks.map((s, i) => (
            <g key={i} transform={`rotate(${s.a.toFixed(0)})`}>
              <circle className="decay-spark" r={s.beta ? 1.3 : 2.2} fill={s.beta ? '#dff3ff' : '#ffd27a'} style={{ animationDelay: `${s.d}s`, animationDuration: s.beta ? '0.8s' : '1.5s' }} />
            </g>
          ))}
        </g>
      ) : null}
    </g>
  );
}
