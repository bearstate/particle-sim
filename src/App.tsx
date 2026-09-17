import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Workbench } from './workbench/Workbench.tsx';
import { VerifyPanel } from './verify/VerifyPanel.tsx';
import { setLanguage, SUPPORTED_LANGUAGES } from './i18n/index.ts';

type View = 'bench' | 'verify';

export function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>('bench');
  return (
    <div className={`app ${view === 'bench' ? 'wide' : ''}`}>
      <header className="masthead">
        <div>
          <h1>{t('app.title')}</h1>
        </div>
        <nav className="tabs">
          <button type="button" className={`tab ${view === 'bench' ? 'on' : ''}`} onClick={() => setView('bench')}>
            {t('app.workbench')}
          </button>
          <button type="button" className={`tab ${view === 'verify' ? 'on' : ''}`} onClick={() => setView('verify')}>
            {t('app.verify')}
          </button>
          <span className="lang">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button key={l} type="button" className={`tab ${i18n.language === l ? 'on' : ''}`} onClick={() => setLanguage(l)}>
                {t(`lang.${l}`)}
              </button>
            ))}
          </span>
        </nav>
      </header>

      {view === 'bench' ? <Workbench /> : <VerifyPanel />}

      <footer className="foot">{t('app.disclaimer')}</footer>
    </div>
  );
}
