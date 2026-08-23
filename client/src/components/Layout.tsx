import { useEffect, useState } from 'react';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
import { NetworkOfflineBanner } from './NetworkOfflineBanner';
import { type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';

// UNDER-DEV-NOTICE (CEO 2026-08-23): key used to remember a viewer dismissed
// the "site under development" strip. Bump the suffix if the wording changes
// materially so returning users see the new version once.
const UNDER_DEV_DISMISS_KEY = 'pw_under_dev_notice_dismissed_v1';

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

  // UNDER-DEV-NOTICE (CEO 2026-08-23): local dismissal only — a viewer who
  // clicks × on the strip doesn't see it again on this device. We start
  // dismissed=false so first-visit viewers always see the honest notice
  // and only skip the LocalStorage read (which throws in private mode) on
  // client mount.
  const [dismissedDevNotice, setDismissedDevNotice] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(UNDER_DEV_DISMISS_KEY) === '1') {
        setDismissedDevNotice(true);
      }
    } catch {
      /* localStorage unavailable (Safari private, blocked cookies) — show the strip anyway */
    }
  }, []);
  const dismissUnderDevNotice = () => {
    setDismissedDevNotice(true);
    try { window.localStorage.setItem(UNDER_DEV_DISMISS_KEY, '1'); } catch { /* non-fatal */ }
  };

  // UNDER-DEV NOTICE (CEO 2026-08-23): the site-wide beta/testing strip is
  // BACK — small, at the top, on every route. Rationale: some customer flows
  // (marketplace payment, provider payout, egift live) are still in
  // integration and the CEO wants every visitor to see one honest one-line
  // notice before they hit any of them. Overrides the 2026-07-25 removal
  // note. The strip is 24 px tall, low-contrast amber, and self-dismissible
  // via a small × so a returning customer never has to re-read it.
  //
  // Copy is bilingual (HE first, EN second) inside a single narrow strip.
  // Payment-related surfaces (Nayax / SUMIT / K9000 wallet) still gate their
  // own live-vs-test state per feature; this is the site-wide "we're still
  // building" honest signal that lives above them.

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
      {/* UNDER-DEV-NOTICE (CEO 2026-08-23): the small honest strip that some
          flows aren't live yet. Amber, 24 px tall, dismissible. Hidden after
          the viewer clicks × (per-device). Text is bilingual in one line —
          HE first for the primary Israel audience, EN in parentheses so an
          English visitor still sees it clearly. */}
      {!dismissedDevNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="under-dev-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '4px 14px',
            minHeight: 24,
            background: '#FEF3C7',
            color: '#78350F',
            fontSize: 12.5,
            lineHeight: 1.35,
            borderBottom: '1px solid rgba(120, 53, 15, 0.15)',
            direction: isRTL ? 'rtl' : 'ltr',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
          }}
        >
          <span style={{ flex: 1, textAlign: 'center' }}>
            {isRTL
              ? 'האתר עדיין בפיתוח — אין תשלום חי כרגע. (Site under development — no live payments yet.)'
              : 'Site still under development — no live payments yet. (האתר עדיין בפיתוח — אין תשלום חי כרגע.)'}
          </span>
          <button
            type="button"
            onClick={dismissUnderDevNotice}
            aria-label={isRTL ? 'סגור הודעה' : 'Dismiss notice'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#78350F',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 4px',
              opacity: 0.75,
            }}
          >
            ×
          </button>
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
