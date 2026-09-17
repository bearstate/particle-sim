import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import { initI18n } from './i18n/index.ts';

initI18n();

const root = document.getElementById('root');
if (!root) throw new Error('#root bulunamadi');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
