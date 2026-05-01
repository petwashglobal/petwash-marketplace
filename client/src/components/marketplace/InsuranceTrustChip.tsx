/**
 * InsuranceTrustChip — Compact "Covered by PetWash™" pill.
 *
 * Surfaces the headline insurance fact (every booking is covered) at the
 * exact moments where customers decide to book or pay:
 *
 *   • Provider profile pages (sitter / walker / driver / groomer / trainer)
 *   • BookingWizard summary step
 *   • CheckoutModal / payment review screens
 *
 * Source of truth (text + numbers must match):
 *   client/src/components/legal/InsuranceAndProtection.tsx
 *
 * Variant matrix:
 *   variant="badge"    — small pill, single line, no expansion (inside cards)
 *   variant="row"      — full-width row with icon + headline (provider hero)
 *   variant="card"     — boxed callout with bullet list (checkout summary)
 *
 * The numbers are pulled from the underlying policy on InsuranceAndProtection.
 * They are intentionally hard-coded here: the policy is a static legal
 * artifact (Harel PW-2026-IL-001), not a per-provider variable. Any change
 * needs to land in InsuranceAndProtection.tsx in the same PR.
 */
import { useState } from 'react';
import { Shield, ChevronDown, Heart, UserCheck, Stethoscope } from 'lucide-react';

interface InsuranceTrustChipProps {
  variant?: 'badge' | 'row' | 'card';
  isHebrew?: boolean;
  className?: string;
}

const POLICY = {
  underwriter: { en: 'Harel Insurance', he: 'הראל ביטוח' },
  generalLiability: '₪20,000,000',
  petAndProperty: '₪250,000',
  emergencyVet: '₪50,000',
};

export function InsuranceTrustChip({
  variant = 'badge',
  isHebrew = false,
  className = '',
}: InsuranceTrustChipProps) {
  const [open, setOpen] = useState(false);

  const headline = isHebrew
    ? 'מכוסה על ידי PetWash™'
    : 'Covered by PetWash™';
  const subhead = isHebrew
    ? `ביטוח אחריות צד שלישי בכל הזמנה דרך הפלטפורמה — ${POLICY.underwriter.he}`
    : `Third-party liability on every booking — underwritten by ${POLICY.underwriter.en}`;

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100 ${className}`}
        title={subhead}
      >
        <Shield className="w-3 h-3" />
        {isHebrew ? 'מכוסה ביטוחית' : 'Insured booking'}
      </span>
    );
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`w-full text-start flex flex-col gap-2 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">{headline}</div>
            <div className="text-xs text-gray-600 leading-snug">{subhead}</div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          />
        </div>
        {open && (
          <ul className="grid sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-100/60">
            <CoverageLine
              icon={UserCheck}
              amount={POLICY.generalLiability}
              label={isHebrew ? 'אחריות כללית' : 'General liability'}
            />
            <CoverageLine
              icon={Heart}
              amount={POLICY.petAndProperty}
              label={isHebrew ? 'נזק לחיית מחמד או רכוש' : 'Pet & property damage'}
            />
            <CoverageLine
              icon={Stethoscope}
              amount={POLICY.emergencyVet}
              label={isHebrew ? 'וטרינר חירום' : 'Emergency vet'}
            />
          </ul>
        )}
      </button>
    );
  }

  // variant === 'card' — full callout for checkout
  return (
    <div className={`p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{headline}</div>
          <p className="text-xs text-gray-700 leading-relaxed mt-0.5">{subhead}</p>
        </div>
      </div>
      <ul className="grid sm:grid-cols-3 gap-2 mt-3">
        <CoverageLine
          icon={UserCheck}
          amount={POLICY.generalLiability}
          label={isHebrew ? 'אחריות כללית' : 'General liability'}
        />
        <CoverageLine
          icon={Heart}
          amount={POLICY.petAndProperty}
          label={isHebrew ? 'נזק לחיית מחמד או רכוש' : 'Pet & property damage'}
        />
        <CoverageLine
          icon={Stethoscope}
          amount={POLICY.emergencyVet}
          label={isHebrew ? 'וטרינר חירום' : 'Emergency vet'}
        />
      </ul>
    </div>
  );
}

function CoverageLine({
  icon: Icon,
  amount,
  label,
}: {
  icon: any;
  amount: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/70">
      <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-900 leading-tight">{amount}</div>
        <div className="text-[10px] text-gray-500 leading-tight truncate">{label}</div>
      </div>
    </li>
  );
}

export default InsuranceTrustChip;
