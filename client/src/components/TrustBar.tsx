import { Shield, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const GOLD = '#C5A55A';

interface TrustBadge {
  icon: React.ReactNode;
  labelHe: string;
  labelEn: string;
  descHe?: string;
  descEn?: string;
  color: string;
  bg: string;
}

const BADGES: TrustBadge[] = [
  {
    icon: <CheckCircle size={16} />,
    labelHe: 'מאומת',
    labelEn: 'ID Verified',
    descHe: 'כל הספקים עברו אימות זהות',
    descEn: 'All providers go through identity verification',
    color: '#1a7f4b',
    bg: '#f0fdf4',
  },
  // PR-FAKE (2026-06-13): removed fabricated trust stats — "1 in 5 Accepted /
  // top 20% approved", "Trained & Certified / professional course completed",
  // and "10,000+ Bookings" were all invented (no such data exists pre-launch).
  // Kept only the verification badges, which reflect the real KYC flow.
  {
    // PR-LEGAL-B: previously 'PetWash Guarantee' / 'Full coverage for
    // every confirmed booking'. Replaced with a neutral verification
    // label per §8 of the Provider & Host Services Agreement.
    icon: <Shield size={16} />,
    labelHe: 'ספקים מאומתים',
    labelEn: 'Verified Providers',
    descHe: 'זהות, מסמכים והמלצות עברו בדיקה',
    descEn: 'Identity, documents and references checked',
    color: '#1e40af',
    bg: '#eff6ff',
  },
];

interface TrustBarProps {
  variant?: 'horizontal' | 'grid' | 'compact';
  className?: string;
}

export default function TrustBar({ variant = 'horizontal', className = '' }: TrustBarProps) {
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {BADGES.map((b, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ color: b.color, background: b.bg }}
          >
            {b.icon}
            {isRTL ? b.labelHe : b.labelEn}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-2 gap-3 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {BADGES.map((b, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 p-3 rounded-xl border"
            style={{ background: b.bg, borderColor: `${b.color}30` }}
          >
            <span style={{ color: b.color }} className="mt-0.5">{b.icon}</span>
            <div>
              <p className="text-xs font-bold" style={{ color: b.color }}>
                {isRTL ? b.labelHe : b.labelEn}
              </p>
              {(b.descHe || b.descEn) && (
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                  {isRTL ? b.descHe : b.descEn}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto scrollbar-hide ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
        {BADGES.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border flex-shrink-0"
            style={{ background: b.bg, borderColor: `${b.color}30` }}
          >
            <span style={{ color: b.color }}>{b.icon}</span>
            <span className="text-xs font-semibold" style={{ color: b.color }}>
              {isRTL ? b.labelHe : b.labelEn}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { BADGES };
export type { TrustBadge };
