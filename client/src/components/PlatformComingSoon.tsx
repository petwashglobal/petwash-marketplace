import { useMemo } from 'react';
import { useLanguage } from '@/lib/languageStore';
import { useSEO } from '@/lib/seo';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ArrowLeft, Clock } from 'lucide-react';
import { JoinWaitlistForm } from '@/components/waitlist/JoinWaitlistForm';
import type { WaitlistPlatform } from '@shared/schema-waitlist';

const GOLD = '#D4AF37';

interface InterestOption { value: string; en: string; he: string }

interface PlatformComingSoonProps {
  platformName: string;
  platformNameHe?: string;
  icon?: React.ReactNode;
  /** Kept for backwards compatibility — no longer used (brand is white+black+gold). */
  accentColor?: string;
  /** Which waitlist bucket this page captures into. */
  platformKey?: WaitlistPlatform;
  descriptionEn?: string;
  descriptionHe?: string;
  interestOptions?: InterestOption[];
}

/**
 * No dead "coming soon" — every not-yet-live platform page captures real demand
 * via the universal waitlist engine. White + black + gold; strong original copy
 * (never the weak "we're working hard…" line).
 */
export function PlatformComingSoon({
  platformName,
  platformNameHe,
  icon,
  platformKey = 'OTHER',
  descriptionEn,
  descriptionHe,
  interestOptions,
}: PlatformComingSoonProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const dir = (language === 'he' || language === 'ar') ? 'rtl' : 'ltr';
  const name = isHebrew ? (platformNameHe || platformName) : platformName;

  const description = isHebrew
    ? (descriptionHe || `${platformNameHe || platformName} בדרך. ספרו לנו מה חיית המחמד שלכם צריכה ונעדכן אתכם כשהשירות יהיה זמין באזורכם.`)
    : (descriptionEn || `${platformName} is coming soon. Tell us what your pet needs and we'll notify you when it's available in your area.`);

  // SEO from the real props — truthful "coming soon" title, never a generic
  // fallback. Memoized so useSEO's effect doesn't re-run every render.
  const seoConfig = useMemo(() => ({
    title: `${platformName} — Coming Soon | ⁦Pet Wash™⁩ | בקרוב`,
    description,
  }), [platformName, description]);
  useSEO(seoConfig);

  return (
    <div className="min-h-[100dvh] bg-white flex items-center justify-center px-4 py-10" dir={dir}>
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full text-black shadow-sm mx-auto" style={{ background: 'rgba(212,175,55,0.12)', border: `1px solid ${GOLD}` }}>
          <span style={{ color: GOLD }}>{icon || <Clock className="h-10 w-10" />}</span>
        </div>

        <div className="space-y-2">
          {/* Platform NAME stays English even in Hebrew (brand-language rule) */}
          <h1 className="text-3xl font-bold text-black">{platformName}</h1>
          <div className="inline-block px-4 py-1 rounded-full text-sm font-semibold tracking-wide" style={{ background: GOLD, color: '#000' }}>
            {isHebrew ? 'בקרוב' : 'Coming Soon'}
          </div>
        </div>

        <p className="text-base text-black/65 leading-relaxed max-w-md mx-auto">
          {description}
        </p>

        {/* Real demand capture — no dead page */}
        <JoinWaitlistForm platformKey={platformKey} interestOptions={interestOptions} sourcePage={typeof window !== 'undefined' ? window.location.pathname : undefined} />

        <p className="text-xs text-black/40">
          {isHebrew ? `נעדכן את החברים הראשונים כש-${name} יהיה זמין באזור שלך.` : `We'll update early members when ${platformName} becomes available in your area.`}
        </p>

        <Link href="/">
          <Button variant="outline" className="gap-2 px-6" style={{ borderColor: GOLD, color: '#000' }}>
            <ArrowLeft className={`h-4 w-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
