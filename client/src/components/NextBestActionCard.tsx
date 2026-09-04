/**
 * NextBestActionCard — renders the "what should I do next" server
 * projection at the very top of Pet-Parent / Provider home
 * (Journey Brain Phase 5 · post-release 2026-09-04).
 *
 * The server (server/services/nextBestAction.ts) picks ONE primary
 * action and up to N secondary actions using canonical rules:
 *
 *   urgent attention item  >  most-recent resume hint  >  due_soon
 *   >  informational  >  null (quiet home)
 *
 * This component is a PURE renderer. No client-side priority logic,
 * no re-selection, no aggregation. If the server says null, the
 * home is quiet and we render nothing.
 *
 * Contract with the server:
 *
 *   • `AttentionItem` primary → tap navigates to `destination`.
 *   • `ResumeAction` primary  → tap navigates to `destination` (the
 *     wizard's canonical entry — the wizard itself hydrates from
 *     the checkpoint and revalidates canonical state on mount).
 *   • No card carries payment truth — the server strips those keys.
 *
 * The card sits ABOVE AttentionList when both are visible; the
 * primary action is the loudest surface on home.
 */

import { useLocation } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useNextBestAction, isResumeAction, type NextAction } from '@/hooks/useNextBestAction';
import type { AttentionActor, AttentionItem } from '@shared/lib/attentionFeed';
import { emitCtaEvent } from '@/lib/ctaActions';
import {
  ArrowRight, ArrowLeft, CreditCard, CheckCircle2, Star, Bell, PlayCircle,
  Flag, Navigation, MessageCircle, FileText, Wallet, Gift, Upload, Eye, RotateCw,
} from 'lucide-react';

interface Props {
  actor: AttentionActor;
  /** Secondary cards shown under the primary; default 3. Server may return more. */
  secondaryLimit?: number;
}

const ACTION_ICON: Record<AttentionItem['nextAction'], any> = {
  pay:               CreditCard,
  confirm:           CheckCircle2,
  review:            Star,
  accept_or_decline: Bell,
  start:             PlayCircle,
  complete:          Flag,
  track:             Navigation,
  open_chat:         MessageCircle,
  open_document:     FileText,
  top_up:            Wallet,
  claim:             Gift,
  upload:            Upload,
  view:              Eye,
};

function iconFor(action: NextAction) {
  if (isResumeAction(action)) return RotateCw;
  return ACTION_ICON[action.nextAction] || Eye;
}

/** Server never re-emits payment truth in a Resume card. */
function isPaymentTruthLeaked(action: NextAction): boolean {
  const forbidden = [
    'chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber',
    'settlementId', 'transactionId', 'redirectUrl', 'paymentUrl',
    'voucherCode', 'eGiftId',
  ];
  const keys = Object.keys(action);
  return forbidden.some((k) => keys.includes(k));
}

export function NextBestActionCard({ actor, secondaryLimit = 3 }: Props) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const { primaryAction, secondaryActions, isLoading } = useNextBestAction(actor);

  if (isLoading) return null;
  if (!primaryAction) return null;

  // Defence-in-depth: if the server EVER leaks a payment-truth key,
  // suppress the card rather than render it. The bug is on the
  // server; the client should never light a card up on tainted
  // data. AttentionList still shows its own items.
  if (isPaymentTruthLeaked(primaryAction)) return null;

  const PrimaryIcon = iconFor(primaryAction);
  const Chevron = he ? ArrowLeft : ArrowRight;

  const handleTap = (action: NextAction) => {
    if (isResumeAction(action)) {
      emitCtaEvent('RESUME_JOURNEY', {
        source: 'next_best_action',
        actor,
        domain: action.domain,
      });
    } else {
      emitCtaEvent('BOOK_CONFIRM', {
        source: 'next_best_action',
        actor,
        domain: (action as any).domain,
        priority: (action as any).priority,
      });
    }
    navigate((action as any).destination);
  };

  const visibleSecondary = secondaryActions
    .filter((a) => !isPaymentTruthLeaked(a))
    .slice(0, secondaryLimit);

  return (
    <section
      className="px-4 pt-2"
      dir={he ? 'rtl' : 'ltr'}
      data-testid={`next-best-action-${actor}`}
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-2">
        {he ? 'הצעד הבא שלך' : 'Your next step'}
      </h2>
      {/* Primary — one loud, gold-accented tap surface. */}
      <button
        type="button"
        onClick={() => handleTap(primaryAction)}
        className="w-full text-start rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-br from-white to-[#faf6ea] p-4 flex items-center gap-3 shadow-md transition-transform active:scale-[0.99] hover:shadow-lg"
        data-testid="next-best-action-primary"
        data-action-id={isResumeAction(primaryAction) ? 'RESUME_JOURNEY' : 'BOOK_CONFIRM'}
      >
        <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#D4AF37]/10">
          <PrimaryIcon className="w-5 h-5 text-[#9a7d2e]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-gray-900 truncate">
            {(primaryAction as any).title}
          </span>
          <span className="block text-[12px] text-gray-600 line-clamp-2">
            {(primaryAction as any).reason}
          </span>
        </span>
        <Chevron className="w-5 h-5 text-[#9a7d2e] shrink-0" />
      </button>
      {/* Secondary — quieter, no gold border. */}
      {visibleSecondary.length > 0 && (
        <ul className="space-y-2 mt-2" data-testid="next-best-action-secondary-list">
          {visibleSecondary.map((a, i) => {
            const Icon = iconFor(a);
            const key = isResumeAction(a) ? `resume:${a.checkpointId}` : (a as any).id ?? `sec-${i}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => handleTap(a)}
                  className="w-full text-start rounded-2xl border bg-white p-3 flex items-center gap-3 shadow-sm transition-transform active:scale-[0.99] hover:border-gray-300"
                  data-testid={`next-best-action-secondary-${i}`}
                  data-action-id={isResumeAction(a) ? 'RESUME_JOURNEY' : 'BOOK_CONFIRM'}
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gray-50">
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-gray-900 truncate">
                      {(a as any).title}
                    </span>
                    <span className="block text-[11.5px] text-gray-500 truncate">
                      {(a as any).reason}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default NextBestActionCard;
