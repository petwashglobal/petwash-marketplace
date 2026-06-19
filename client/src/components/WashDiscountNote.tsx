/**
 * WashDiscountNote — a small, luxury bilingual note shown where a member sees a
 * K9000 wash price. It reads the member's OWN resolved wash discount from the
 * server (GET /api/member/wash-discount — server-authoritative; the client never
 * computes the discount) and renders e.g.:
 *
 *   "Prestige 5% applied"            / "הנחת פרסטיז' 5% הוחלה"
 *   "Approved discount 10% applied"  / "הנחה מאושרת 10% הוחלה"
 *
 * Renders nothing when the member has no wash discount. White / black / gold,
 * per brand. The discount itself is applied server-side at checkout — this note
 * is purely informational.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';

interface WashDiscountResponse {
  ok: boolean;
  percent: number;
  source: 'prestige_basic' | 'senior' | 'disability' | 'none';
  prestigeBasic: boolean;
  approved: boolean;
}

async function fetchWashDiscount(): Promise<WashDiscountResponse | null> {
  try {
    const res = await apiRequest('GET', '/api/member/wash-discount');
    if (!res.ok) return null;
    return (await res.json()) as WashDiscountResponse;
  } catch {
    return null;
  }
}

export function WashDiscountNote({ className = '' }: { className?: string }) {
  const { language, dir } = useLanguage();
  const isHe = language === 'he';

  const { data } = useQuery({
    queryKey: ['member-wash-discount'],
    queryFn: fetchWashDiscount,
    staleTime: 60_000,
    retry: false,
  });

  if (!data || !data.ok || data.percent <= 0) return null;

  const pct = data.percent;
  // Label by dominant source. Prestige-basic = automatic loyalty 5%; senior /
  // disability = the admin-approved postal-review discount.
  let label: string;
  if (data.source === 'prestige_basic') {
    label = isHe ? `הנחת פרסטיז' ${pct}% הוחלה` : `Prestige ${pct}% applied`;
  } else {
    label = isHe ? `הנחה מאושרת ${pct}% הוחלה` : `Approved discount ${pct}% applied`;
  }

  return (
    <span
      dir={dir}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37] bg-white px-3 py-1 text-xs font-medium text-black ${className}`}
      data-testid="wash-discount-note"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
      {label}
    </span>
  );
}

export default WashDiscountNote;
