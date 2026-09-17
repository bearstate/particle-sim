import { useEffect, useRef } from 'react';

/**
 * Prosedurel ark cizimi: ozyinelemeli orta nokta yer degistirme + olasiliksal
 * dallanma. PHYSICS.md bolum 1.L.
 *
 * Kanal uzunlugu FIZIKTEN gelir (`lengthM = V / E_delinme`); bu bilesen onu
 * hesaplamaz, tuketir. Voltaj kaydiricisi buyudukce ark gorunur sekilde uzar.
 */

/** Ark kanali gorunur omru, ms. Gercek kivilcim ~1 us; gozun secebilmesi icin uzatildi. */
const ARC_LIFE_MS = 300;

interface Point {
  x: number;
  y: number;
}

function displace(a: Point, b: Point, depth: number, amp: number, out: Point[]): void {
  if (depth === 0) {
    out.push(b);
    return;
  }
  const mid: Point = {
    x: (a.x + b.x) / 2 + (Math.random() - 0.5) * amp,
    y: (a.y + b.y) / 2 + (Math.random() - 0.5) * amp,
  };
  displace(a, mid, depth - 1, amp / 2, out);
  displace(mid, b, depth - 1, amp / 2, out);
}

function buildChannel(from: Point, to: Point, amp: number): Point[] {
  const pts: Point[] = [from];
  displace(from, to, 5, amp, pts);
  return pts;
}

export function ArcCanvas(props: {
  /** Ark kanali uzunlugu, m. 0 ise hicbir sey cizilmez. */
  lengthM: number;
  /** Korona yogunlugu 0..1. */
  coronaIntensity: number;
  /** Sahnenin yatay kapsami, m. Olcek bundan cikar. */
  sceneWidthM: number;
  /** true ise ark yok, sadece korona (hedefe yonlendirilmis yuk). */
  grounded: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const state = useRef({ ...props });
  state.current = props;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let channels: { pts: Point[]; born: number }[] = [];
    let last = 0;

    const draw = (t: number) => {
      const { lengthM, coronaIntensity, sceneWidthM, grounded } = state.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = 190;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);
      const pxPerM = w / sceneWidthM;
      const cx = w * 0.32;
      const cy = h * 0.5;
      const sphereR = Math.max(10, 0.15 * pxPerM);

      // Terminal kure
      const g = ctx.createRadialGradient(cx - sphereR * 0.3, cy - sphereR * 0.3, 1, cx, cy, sphereR);
      g.addColorStop(0, '#5b6472');
      g.addColorStop(1, '#22262e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereR, 0, Math.PI * 2);
      ctx.fill();

      // Korona: kure etrafinda yumusak halka
      if (coronaIntensity > 0) {
        const cg = ctx.createRadialGradient(cx, cy, sphereR, cx, cy, sphereR * 2.4);
        cg.addColorStop(0, `rgba(150,180,255,${0.35 * coronaIntensity})`);
        cg.addColorStop(1, 'rgba(150,180,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cx, cy, sphereR * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      const lengthPx = lengthM * pxPerM;

      // Yeni ark dogur (Poisson benzeri; hiz uzunlukla artar)
      if (!grounded && lengthPx > 6 && t - last > 60 + 260 / (1 + lengthM * 20)) {
        last = t;
        const angle = Math.random() * Math.PI * 2;
        const from: Point = { x: cx + Math.cos(angle) * sphereR, y: cy + Math.sin(angle) * sphereR };
        const to: Point = {
          x: from.x + Math.cos(angle) * lengthPx,
          y: from.y + Math.sin(angle) * lengthPx,
        };
        channels.push({ pts: buildChannel(from, to, lengthPx * 0.35), born: t });
      }

      channels = channels.filter((c) => t - c.born < ARC_LIFE_MS);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const c of channels) {
        const age = (t - c.born) / ARC_LIFE_MS;
        const alpha = Math.pow(1 - age, 1.6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        c.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        // Genis hale
        ctx.strokeStyle = `rgba(70,130,255,${0.28 * alpha})`;
        ctx.lineWidth = 14;
        ctx.stroke();
        // Orta katman
        ctx.strokeStyle = `rgba(140,190,255,${0.5 * alpha})`;
        ctx.lineWidth = 5;
        ctx.stroke();
        // Beyaz-sicak cekirdek (20 000-30 000 K)
        ctx.strokeStyle = `rgba(240,248,255,${0.98 * alpha})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }

      // Olcek cubugu
      ctx.strokeStyle = '#3a4150';
      ctx.fillStyle = '#868fa1';
      ctx.lineWidth = 1;
      const barM = 0.1;
      const barPx = barM * pxPerM;
      const bx = w - barPx - 16;
      const by = h - 18;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + barPx, by);
      ctx.moveTo(bx, by - 4);
      ctx.lineTo(bx, by + 4);
      ctx.moveTo(bx + barPx, by - 4);
      ctx.lineTo(bx + barPx, by + 4);
      ctx.stroke();
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('10 cm', bx + barPx / 2 - 17, by - 8);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas className="arc" ref={ref} />;
}
