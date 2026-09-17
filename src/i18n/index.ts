import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './tr.json';
import en from './en.json';

/**
 * Iki dil, bastan. Anahtarlar duz noktali ('device.tube'); element adlari
 * 'element.W' gibi sembolle, izotop ozel adlari 'isotope.deuterium' ile.
 * Nuklid modulu yalnizca ANAHTAR uretir; metin burada cozulur.
 */
export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

let started = false;

export function initI18n(): typeof i18n {
  if (started) return i18n;
  started = true;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('lang');
  } catch {
    saved = null;
  }
  void i18n.use(initReactI18next).init({
    resources: { tr: { translation: tr }, en: { translation: en } },
    lng: saved === 'en' ? 'en' : 'tr',
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

export function setLanguage(lang: Language): void {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem('lang', lang);
  } catch {
    /* ozel pencere: kaydetme yok, calismaya devam */
  }
}
