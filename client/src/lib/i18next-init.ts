import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const SUPPORTED = ['he', 'en', 'ar', 'ru', 'fr', 'es'];

function initialLanguage(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = (p.get('lang') || p.get('hl') || '').toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem('pw_lang') || '';
    if (SUPPORTED.includes(saved)) return saved;
  } catch { /* SSR / private mode */ }
  return 'he';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: {} },
      he: { translation: {} },
      ar: { translation: {} },
      ru: { translation: {} },
      fr: { translation: {} },
      es: { translation: {} }
    },
    // Start in the site's language (same order as languageStore: ?lang= /
    // ?hl=, saved pw_lang, else Hebrew) so the first paint is not English;
    // languageStore keeps it in sync after that.
    lng: initialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
