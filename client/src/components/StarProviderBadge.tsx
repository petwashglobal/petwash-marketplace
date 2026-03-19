import { Star, TrendingUp, Users, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const GOLD = '#C5A55A';

export interface ProviderStats {
  rating?: number;
  reviewCount?: number;
  responseRate?: number;
  repeatClientRate?: number;
  acceptanceRate?: number;
  completionRate?: number;
}

function isElite(stats: ProviderStats): boolean {
  return (
    (stats.rating ?? 0) >= 4.8 &&
    (stats.reviewCount ?? 0) >= 5 &&
    (stats.responseRate ?? 0) >= 90 &&
    (stats.repeatClientRate ?? 0) >= 30
  );
}

function isVerified(stats: ProviderStats): boolean {
  return (
    (stats.rating ?? 0) >= 4.5 &&
    (stats.reviewCount ?? 0) >= 2
  );
}

interface StarProviderBadgeProps {
  stats: ProviderStats;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export default function StarProviderBadge({ stats, size = 'md', showDetails = false, className = '' }: StarProviderBadgeProps) {
  const { language } = useLanguage();
  const isRTL = language === 'he' || language === 'ar';

  const elite = isElite(stats);
  const verified = isVerified(stats);

  if (!verified) return null;

  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';
  const px = size === 'sm' ? 'px-2 py-0.5' : size === 'lg' ? 'px-3 py-1.5' : 'px-2.5 py-1';

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      {elite ? (
        <span
          className={`inline-flex items-center gap-1 ${px} ${fontSize} font-semibold rounded-full`}
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}50` }}
        >
          <Star size={iconSize} fill={GOLD} />
          {isRTL ? 'ספק אליטה' : 'Elite Provider'}
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 ${px} ${fontSize} font-semibold rounded-full`}
          style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
        >
          <Star size={iconSize} fill="#15803d" />
          {isRTL ? 'ספק מאומת' : 'Verified Provider'}
        </span>
      )}

      {showDetails && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {stats.rating && stats.reviewCount && (
            <span className="text-[11px] text-gray-600 flex items-center gap-0.5">
              <Star size={10} fill={GOLD} style={{ color: GOLD }} />
              {stats.rating.toFixed(1)} ({stats.reviewCount})
            </span>
          )}
          {stats.responseRate !== undefined && (
            <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
              <TrendingUp size={10} />
              {stats.responseRate}% {isRTL ? 'תגובה' : 'response'}
            </span>
          )}
          {stats.repeatClientRate !== undefined && (
            <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
              <RotateCcw size={10} />
              {stats.repeatClientRate}% {isRTL ? 'חוזרים' : 'repeat'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { isElite, isVerified };
