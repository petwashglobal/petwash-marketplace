/**
 * AttentionList — renders the "what needs my attention" projection at
 * the top of the Pet Parent / Provider home (CEO 2026-08-26 §27-29).
 *
 * The server owns priority + nextAction + destination — this
 * component is a pure renderer. No client-side logic that could
 * drift from server truth.
 */

import { useLocation } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useAttentionFeed } from '@/hooks/useAttentionFeed';
import type {
  AttentionActor,
  AttentionItem,
} from '@shared/lib/attentionFeed';
import {
  CreditCard, CheckCircle2, Star, Bell, PlayCircle, Flag,
  Navigation, MessageCircle, FileText, Wallet, Gift, Upload, Eye,
} from 'lucide-react';

interface Props {
  actor: AttentionActor;
  /** Optional cap; default 6 items. Server already sorts by priority. */
  limit?: number;
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

const PRIORITY_STYLE: Record<AttentionItem['priority'], { border: string; label: string }> = {
  urgent:        { border: '#c1121f', label: 'text-red-600' },
  due_soon:      { border: '#D4AF37', label: 'text-[#9a7d2e]' },
  informational: { border: '#e5e7eb', label: 'text-gray-500' },
};

function shekel(cents: number): string {
  return `₪${(cents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

export function AttentionList({ actor, limit = 6 }: Props) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const { items, isLoading } = useAttentionFeed(actor);

  if (isLoading) return null;
  if (!items || items.length === 0) return null;

  const visible = items.slice(0, limit);

  return (
    <section
      className="px-4 pt-2"
      dir={he ? 'rtl' : 'ltr'}
      data-testid={`attention-list-${actor}`}
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-2">
        {he ? 'מה מחכה לך' : "What's waiting for you"}
      </h2>
      <ul className="space-y-2">
        {visible.map((it) => {
          const Icon = ACTION_ICON[it.nextAction] || Eye;
          const style = PRIORITY_STYLE[it.priority];
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => navigate(it.destination)}
                className="w-full text-start rounded-2xl border bg-white p-3 flex items-center gap-3 shadow-sm transition-transform active:scale-[0.99] hover:border-gray-300"
                style={{ borderColor: style.border }}
                data-testid={`attention-item-${it.id}`}
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gray-50">
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-gray-900 truncate">
                    {it.title}
                  </span>
                  <span className="block text-[11.5px] text-gray-500 truncate">
                    {it.reason}
                  </span>
                </span>
                {it.moneySummary && (
                  <span className={`shrink-0 text-[13px] font-bold ${style.label}`}>
                    {shekel(it.moneySummary.amountCents)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AttentionList;
