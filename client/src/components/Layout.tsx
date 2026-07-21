import { useEffect, useState } from 'react';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
import { NetworkOfflineBanner } from './NetworkOfflineBanner';
import { type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';
import { X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  language?: Language;
  onLanguageChange?: (language: Language) => void;
}

export function Layout({ children, language: propLanguage, onLanguageChange: propOnLanguageChange }: LayoutProps) {
  const { language: contextLanguage, setLanguage: contextSetLanguage } = useLanguage();

  const language = propLanguage ?? contextLanguage;
  const onLanguageChange = propOnLanguageChange ?? contextSetLanguage;
  const isRTL = language === 'he' || language === 'ar';

  // (The old shop "purchases opening soon" strip and its paymentsEnabled /
  //  bannerDismissed / isEgiftRoute plumbing were removed 2026-07-21 — replaced
  //  by the single development notice below.)

  // Site-wide development notice (CEO 2026-07-21): the site is honestly labelled
  // as under development / testing — live features limited, translations still
  // being polished — while making clear the PHYSICAL STATIONS are open to the
  // public. Truth-in-claims: better to say "we're polishing" than let a visitor
  // hit a half-ready flow and assume the whole business is broken.
  // New storage key on purpose — users who dismissed the old shop strip must
  // still see this once. Delete this block (or flip the const) at full launch.
  const DEV_NOTICE_COPY: Record<string, string> = {
    he: 'האתר בפיתוח ובשלבי הרצה — חלק מהתכונות עדיין אינן פעילות ואנו מלטשים את כל השפות. עמדות השטיפה שלנו פעילות ופתוחות לקהל! 🐾',
    en: 'Our website is under development and in testing — some features are not live yet and all languages are still being polished. Our wash stations ARE open to the public! 🐾',
    ar: 'موقعنا قيد التطوير وفي مرحلة تجريبية — بعض الميزات غير متاحة بعد ونعمل على تحسين جميع اللغات. محطات الغسيل لدينا مفتوحة للجمهور! 🐾',
    ru: 'Сайт находится в разработке и тестировании — некоторые функции пока недоступны, все языки дорабатываются. Наши мойки уже открыты для посетителей! 🐾',
    fr: 'Notre site est en développement et en phase de test — certaines fonctionnalités ne sont pas encore actives et toutes les langues sont en cours de finition. Nos stations de lavage sont ouvertes au public ! 🐾',
    es: 'Nuestro sitio está en desarrollo y en fase de pruebas — algunas funciones aún no están activas y seguimos puliendo todos los idiomas. ¡Nuestras estaciones de lavado están abiertas al público! 🐾',
  };
  const [devNoticeDismissed, setDevNoticeDismissed] = useState(() =>
    localStorage.getItem('petwash_dev_notice_dismissed_v1') === 'true'
  );
  const dismissDevNotice = () => {
    localStorage.setItem('petwash_dev_notice_dismissed_v1', 'true');
    setDevNoticeDismissed(true);
  };

  useEffect(() => {
    if (!language) return;
    
    document.documentElement.lang = language;
    
    const rtl = language === 'he' || language === 'ar';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    
    document.documentElement.setAttribute('data-language', language);
    document.documentElement.setAttribute('data-rtl', rtl ? 'true' : 'false');
    
    localStorage.setItem('pw_lang', language);
  }, [language]);


  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Announcement line — restrained luxury (replaced the violet 🎉 soft-launch
          banner, CEO 2026-06-11: shell looked dated). Shop is open to browse;
          purchases unlock at commerce launch. Dismissible; hidden on /egift. */}
      {/* Site-wide development notice (CEO 2026-07-21) — REPLACES the old shop
          "purchases opening soon" strip so there is still exactly ONE strip, not
          two. Shows on every route and every viewport (a testing notice is
          information, not promotion — the old /egift aesthetic exclusion doesn't
          apply). Dismissible per device. Remove at full launch. */}
      {!devNoticeDismissed && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          data-testid="dev-notice-banner"
          className="w-full bg-black text-white z-50 relative border-b border-amber-300/40"
        >
          <div className="flex items-center justify-center gap-2.5 py-2 px-3 text-[11px] sm:text-sm leading-snug tracking-wide">
            <span className="text-amber-200 shrink-0">✦</span>
            <span className="text-center">
              {DEV_NOTICE_COPY[language] ?? DEV_NOTICE_COPY.en}
            </span>
            <button
              onClick={dismissDevNotice}
              aria-label="Close"
              className="ms-1 p-0.5 rounded hover:bg-white/15 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Offline / connectivity banner — always visible when network drops */}
      <NetworkOfflineBanner />

      {/* Skip to Content for Accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white border text-black px-4 py-2 rounded z-50"
      >
        Skip to content
      </a>
      
      <PetWashHeader language={language} onLanguageChange={onLanguageChange} />
      
      <main id="main-content" role="main" className="bg-white">
        {children}
      </main>
      
      <div className="pb-16 md:pb-0">
        <Footer language={language} />
      </div>
    </div>
  );
}
