import { useEffect, useRef } from 'react';

/**
 * Kivilcim ve ark kanali: olay guduml, WAAPI ile sonen SVG polyline'lar.
 * PHYSICS.md 1.L. React her karede yeniden render ETMEZ; elemanlar dogrudan
 * DOM'a eklenir, opaklik animasyonu compositor'da kosar, bitince silinir.
 *
 * Uzunluk ve hiz FIZIKTEN gelir (solve.ts: sparkM, arcRatePerS); burada
 * yalnizca sekil uretilir: rastgele cikis noktasi, disari bakan yon,
 * orta nokta yer degistirme, olasiliksal dallanma.
 */

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

interface Pt { x: number; y: number }

function jagged(a: Pt, b: Pt, depth: number, amp: number, out: Pt[]): void {
  if (depth === 0) { out.push(b); return; }
  const mid = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * amp, y: (a.y + b.y) / 2 + (Math.random() - 0.5) * amp };
  jagged(a, mid, depth - 1, amp * 0.55, out);
  jagged(mid, b, depth - 1, amp * 0.55, out);
}

function channel(a: Pt, b: Pt): Pt[] {
  const pts: Pt[] = [a];
  jagged(a, b, 5, Math.hypot(b.x - a.x, b.y - a.y) * 0.32, pts);
  return pts;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function strokePolyline(parent: SVGGElement, pts: Pt[], color: string, width: number, opacity: number, lifeMs: number): void {
  const el = document.createElementNS(SVG_NS, 'polyline');
  el.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', String(width));
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('pointer-events', 'none');
  parent.appendChild(el);
  const anim = el.animate([{ opacity }, { opacity: opacity * 0.85, offset: 0.35 }, { opacity: 0 }], { duration: lifeMs, easing: EASE_OUT, fill: 'forwards' });
  anim.onfinish = () => el.remove();
}

/** Uc katmanli isik: genis mavi hale, orta, beyaz-sicak cekirdek. */
function flash(parent: SVGGElement, pts: Pt[], lifeMs: number, scale = 1): void {
  strokePolyline(parent, pts, 'rgba(70,130,255,1)', 9 * scale, 0.22, lifeMs);
  strokePolyline(parent, pts, 'rgba(150,195,255,1)', 3.5 * scale, 0.55, lifeMs);
  strokePolyline(parent, pts, 'rgba(240,248,255,1)', 1.6 * scale, 0.98, lifeMs);
}

/**
 * Kure etrafinda kivilcimlar. `lengthPx` ortalama kanal uzunlugu, `ratePerS`
 * saniyede olay sayisi (0 = hic). `avoidDownRad` yakinindaki acilar
 * (sutun) kullanilmaz.
 */
export function SparkLayer(props: { cx: number; cy: number; radiusPx: number; lengthPx: number; ratePerS: number; reduce: boolean }) {
  const ref = useRef<SVGGElement | null>(null);
  const live = useRef(props);
  live.current = props;

  useEffect(() => {
    if (props.reduce) return;
    let raf = 0;
    let next = performance.now() + 200;
    const tick = (t: number) => {
      const { cx, cy, radiusPx, lengthPx, ratePerS } = live.current;
      const g = ref.current;
      if (g && ratePerS > 0 && lengthPx > 4 && t >= next) {
        // Poisson benzeri: bir sonraki olay ustel dagilimdan.
        next = t + (-Math.log(1 - Math.random()) / ratePerS) * 1000;
        // Cikis acisi: sutunun oldugu alt bolge (75..105 derece) haric.
        let a = Math.random() * Math.PI * 2;
        if (Math.abs(a - Math.PI / 2) < 0.4) a += 0.9;
        const start = { x: cx + Math.cos(a) * radiusPx, y: cy + Math.sin(a) * radiusPx };
        const dir = a + (Math.random() - 0.5) * 1.1;
        const len = lengthPx * (0.65 + Math.random() * 0.7);
        const end = { x: start.x + Math.cos(dir) * len, y: start.y + Math.sin(dir) * len };
        const pts = channel(start, end);
        const life = 140 + Math.random() * 140;
        flash(g, pts, life);
        // Dallar: kanalin ortasindan, daha kisa, daha sonuk.
        const branches = Math.random() < 0.55 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;
        for (let b = 0; b < branches; b++) {
          const from = pts[Math.floor(pts.length * (0.3 + Math.random() * 0.4))]!;
          const bd = dir + (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.6);
          const bl = len * (0.35 + Math.random() * 0.3);
          flash(g, channel(from, { x: from.x + Math.cos(bd) * bl, y: from.y + Math.sin(bd) * bl }), life * 0.8, 0.6);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.reduce]);

  if (props.reduce) {
    // Azaltilmis hareket: hareket yok, ama "yuklu terminal" bilgisi kalsin.
    return props.ratePerS > 0 ? <circle cx={props.cx} cy={props.cy} r={props.radiusPx + 10} fill="none" stroke="#9ec8ff" strokeOpacity={0.35} strokeDasharray="3 6" /> : null;
  }
  return <g ref={ref} />;
}

/** Iki elektrot arasinda surekli yenilenen ark kanali (tup 'arc' rejimi). */
export function ArcChannel(props: { x1: number; y1: number; x2: number; y2: number; active: boolean; reduce: boolean }) {
  const ref = useRef<SVGGElement | null>(null);
  const live = useRef(props);
  live.current = props;
  useEffect(() => {
    if (props.reduce || !props.active) return;
    let raf = 0;
    let next = 0;
    const tick = (t: number) => {
      const { x1, y1, x2, y2 } = live.current;
      const g = ref.current;
      if (g && t >= next) {
        next = t + 70 + Math.random() * 60;
        flash(g, channel({ x: x1, y: y1 }, { x: x2, y: y2 }), 160, 1.1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.active, props.reduce]);
  if (!props.active) return null;
  if (props.reduce) return <line x1={props.x1} y1={props.y1} x2={props.x2} y2={props.y2} stroke="#dff3ff" strokeWidth={2} />;
  return <g ref={ref} />;
}
