import { useEffect, useState } from 'react';

/**
 * prefers-reduced-motion. Azaltilmis hareket "hic animasyon" degil,
 * "daha az ve daha yumusak" demektir: parcacik akislari statik cizgiye,
 * olay koreografisi sonuc karesine duser; opaklik gecisleri kalir.
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  return reduce;
}
