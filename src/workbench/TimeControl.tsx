import { useTranslation } from 'react-i18next';
import { useClock, formatSimTime } from './clock.ts';

/**
 * Zaman kontrolu: oynat/durdur, logaritmik hizlandirma (1x..1e9x), sim suresi,
 * sifirla. Yalnizca yavas saati surer; elektrik tarafi zaten anliktir.
 */
export function TimeControl() {
  const { t, i18n } = useTranslation();
  const running = useClock((s) => s.running);
  const timeScale = useClock((s) => s.timeScale);
  const simTimeS = useClock((s) => s.simTimeS);
  const setRunning = useClock((s) => s.setRunning);
  const setTimeScale = useClock((s) => s.setTimeScale);
  const reset = useClock((s) => s.reset);
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const exp = Math.log10(timeScale);
  return (
    <div className="timectl">
      <button type="button" className={`tab ${running ? 'on' : ''}`} onClick={() => setRunning(!running)} aria-label={running ? t('time.pause') : t('time.play')}>
        {running ? '❚❚' : '▶'}
      </button>
      <div className="timectl-scale">
        <div className="control-head">
          <label>{t('time.scale')}</label>
          <output>{timeScale >= 1e6 ? `${(timeScale / 1e6).toFixed(0)}M×` : timeScale >= 1e3 ? `${(timeScale / 1e3).toFixed(0)}k×` : `${timeScale.toFixed(0)}×`}</output>
        </div>
        <input type="range" min={0} max={9} step={0.05} value={exp} onChange={(e) => setTimeScale(Math.pow(10, Number(e.target.value)))} />
      </div>
      <div className="timectl-clock">
        <span className="k">{t('time.elapsed')}</span>
        <span className="v">{formatSimTime(simTimeS, lang)}</span>
      </div>
      <button type="button" className="link-btn" onClick={reset}>{t('time.reset')}</button>
    </div>
  );
}
