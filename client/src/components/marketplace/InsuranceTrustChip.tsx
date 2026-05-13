/**
 * InsuranceTrustChip — Provider-safety disclaimer chip.
 *
 * PR-LEGAL-B: previously named "Covered by PetWash™" and
 * displayed a specific underwriter (Harel Insurance), policy
 * number (PW-2026-IL-001) and coverage amounts (₪20M, ₪250K,
 * ₪50K). Those claims contradicted §8 of the Provider & Host
 * Services Agreement merged in PR-LEGAL-A (#246):
 *
 *   "Pet Wash Ltd is not an insurance company, insurance
 *    broker or insurance adviser."
 *
 * The component now renders only the canonical disclaimer
 * approved by the CEO (chat 2026-05-12). It carries NO
 * monetary amounts, NO underwriter name, NO policy number,
 * NO "covered by us" claim.
 *
 * The component file is intentionally kept under its
 * existing name so the existing import paths in
 * BookingWizard, ProviderProfilePage, ProviderDetail,
 * MultiPetBookingWizard, and MarketplaceTerms continue
 * compiling. A follow-up cleanup PR may rename the file
 * to SafetyDisclaimerChip.
 *
 * Variants
 *   variant="badge"  — small inline pill
 *   variant="row"    — full-width row with expandable details
 *   variant="card"   — boxed callout
 *
 * All three variants render the same disclaimer; the
 * "expand" affordance on `row` is preserved for layout
 * compatibility but no longer reveals coverage numbers.
 */
import { useState } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';

interface InsuranceTrustChipProps {
  variant?: 'badge' | 'row' | 'card';
  isHebrew?: boolean;
  className?: string;
}

const HEADLINE = {
  en: 'Safety information',
  he: 'מידע בטיחות',
};

// Approved bilingual disclaimer wording. CEO directive
// 2026-05-12. Do NOT edit without Counsel sign-off.
const DISCLAIMER = {
  en:
    'Providers may be required to maintain their own ' +
    'insurance depending on the service type and applicable ' +
    'law. Pet Wash is not an insurance company, broker or ' +
    'adviser.',
  he:
    'ספקים עשויים להידרש להחזיק בביטוח מתאים בהתאם לסוג ' +
    'השירות והדין החל. פט וואש בע״מ אינה חברת ביטוח, ' +
    'סוכנות ביטוח או יועצת ביטוח.',
};

const BADGE_LABEL = {
  en: 'Verified provider',
  he: 'ספק מאומת',
};

export function InsuranceTrustChip({
  variant = 'badge',
  isHebrew = false,
  className = '',
}: InsuranceTrustChipProps) {
  const [open, setOpen] = useState(false);

  const headline = isHebrew ? HEADLINE.he : HEADLINE.en;
  const disclaimer = isHebrew ? DISCLAIMER.he : DISCLAIMER.en;
  const badge = isHebrew ? BADGE_LABEL.he : BADGE_LABEL.en;

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-semibold border border-gray-200 ${className}`}
        title={disclaimer}
      >
        <ShieldAlert className="w-3 h-3" />
        {badge}
      </span>
    );
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full text-start flex flex-col gap-2 p-4 rounded-2xl border border-gray-200 bg-gray-50/60 hover:bg-gray-50 transition-colors ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              {headline}
            </div>
            {!open && (
              <div className="text-xs text-gray-600 leading-snug line-clamp-2">
                {disclaimer}
              </div>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          />
        </div>
        {open && (
          <p className="text-xs text-gray-700 leading-relaxed pt-2 border-t border-gray-200/60">
            {disclaimer}
          </p>
        )}
      </button>
    );
  }

  // variant === 'card'
  return (
    <div
      className={`p-4 rounded-2xl border border-gray-200 bg-gray-50/60 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-gray-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">
            {headline}
          </div>
          <p className="text-xs text-gray-700 leading-relaxed mt-1">
            {disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default InsuranceTrustChip;
