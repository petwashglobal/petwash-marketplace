/**
 * JourneyConcierge — CEO MASTER 2026-08-28 §36 §37 §65 (Journey
 * Brain Phase 5).
 *
 * Renders the server's NextBestAction feed as a small stack of cards
 * on the pet-parent / provider home. The server owns priority +
 * destination + reasonCode; this component:
 *
 *   1. Resolves reasonCode → localised HE/EN copy (client-only copy
 *      table; unknown codes fall through to a generic "recommended
 *      for you" so a rolling deploy where the server ships a new
 *      code before the client learns it never crashes).
 *   2. Wraps the CTA in a confirm modal WHEN requiresConfirmation is
 *      true (CEO §37 L2/L3 gate).
 *   3. Provides a "Why am I seeing this?" affordance (CEO §23
 *      transparency) that shows the reason code + human copy in a
 *      compact drawer.
 *
 * No LLM in the render path. No client-side priority arithmetic. No
 * fabricated money amounts (moneyHintCents is displayed verbatim; if
 * absent it renders as nothing, never as zero).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import { useNextBestActionFeed } from '@/hooks/useNextBestActionFeed';
import type {
  NextBestAction,
  NextBestActionActor,
  NextBestActionReasonCode,
} from '@shared/lib/nextBestAction';
import {
  CreditCard, CheckCircle2, Star, Bell, PlayCircle, Flag, Navigation,
  MessageCircle, FileText, Wallet, Gift, Upload, Eye, Repeat, Sparkles,
  BadgeCheck, CalendarClock, ShieldAlert, Info, MoreVertical, X,
} from 'lucide-react';

interface Props {
  actor: NextBestActionActor;
  /** Optional cap; default 4 cards. Server already sorts by priority. */
  limit?: number;
}

const ACTION_ICON: Record<NextBestAction['actionType'], any> = {
  view:                Eye,
  pay:                 CreditCard,
  confirm:             CheckCircle2,
  review:              Star,
  accept_or_decline:   Bell,
  start:               PlayCircle,
  complete:            Flag,
  track:               Navigation,
  open_chat:           MessageCircle,
  open_document:       FileText,
  top_up:              Wallet,
  claim:               Gift,
  upload:              Upload,
  rebook:              Repeat,
  try_similar:         Sparkles,
  star:                Star,
  use_benefit:         BadgeCheck,
  update_availability: CalendarClock,
  renew_document:      ShieldAlert,
};

const PRIORITY_STYLE: Record<NextBestAction['priority'], { border: string; label: string }> = {
  critical: { border: '#c1121f', label: 'text-red-600' },
  high:     { border: '#D4AF37', label: 'text-[#9a7d2e]' },
  normal:   { border: '#e5e7eb', label: 'text-gray-500' },
  low:      { border: '#f3f4f6', label: 'text-gray-400' },
};

/**
 * REASON CODE → localised copy. The client owns this table (no LLM).
 * Unknown codes fall through to the generic "recommended for you".
 */
function reasonCopy(code: NextBestActionReasonCode, he: boolean): { title: string; why: string } {
  switch (code) {
    case 'BOOKING_PAYMENT_DUE':
      return he
        ? { title: 'שלמו כדי לאשר את ההזמנה', why: 'הספק אישר — הזמנתכם ממתינה לתשלום.' }
        : { title: 'Pay to confirm your booking', why: 'The provider accepted — your booking is waiting on payment.' };
    case 'BOOKING_STARTS_SOON':
      return he
        ? { title: 'ההזמנה שלכם מתקרבת', why: 'עקבו בזמן אמת ברגע שהשירות מתחיל.' }
        : { title: 'Your booking is coming up', why: 'Track it in real time as soon as it begins.' };
    case 'BOOKING_PROVIDER_ACCEPTED':
      return he
        ? { title: 'הספק אישר', why: 'תאשרו את ההזמנה כדי להזמין את הכספים.' }
        : { title: 'Provider accepted', why: 'Confirm to lock in the booking.' };
    case 'BOOKING_AWAITING_YOU':
      return he
        ? { title: 'ממתין לאישור שלך', why: 'הספק סימן שסיים — אשרו וכתבו ביקורת.' }
        : { title: 'Awaiting your confirmation', why: 'Provider marked done — confirm and review.' };
    case 'BOOKING_REVIEW_AVAILABLE':
      return he
        ? { title: 'השאירו ביקורת', why: 'עזרו להורים אחרים לבחור.' }
        : { title: 'Leave a review', why: 'Help other pet parents choose.' };
    case 'BOOKING_REQUEST_WAITING':
      return he
        ? { title: 'הבקשה שלך ממתינה', why: 'הספק עדיין לא הגיב — נעדכן ברגע שיש התאמה.' }
        : { title: 'Your request is waiting', why: "The provider hasn't responded yet — we'll ping you the moment there's a match." };
    case 'PROVIDER_REQUEST_WAITING':
      return he
        ? { title: 'בקשת הזמנה חדשה', why: 'לקוח ממתין לתשובה שלך.' }
        : { title: 'New booking request', why: 'A customer is waiting for your reply.' };
    case 'JOURNEY_RESUME_SAVED':
      return he
        ? { title: 'שמרנו את התהליך שלך', why: 'המשך מהנקודה שבה עצרת.' }
        : { title: 'We saved your progress', why: 'Continue from where you left off.' };
    case 'SAVED_SEARCH_CONTINUE':
      return he
        ? { title: 'עדיין מחפש?', why: 'המשך מהחיפוש האחרון שלך.' }
        : { title: 'Still looking?', why: 'Continue from your last search.' };
    case 'FAVOURITE_REBOOK':
      return he
        ? { title: 'להזמין שוב', why: 'הספק/ית המועדפ/ת עלייך זמינ/ה למועד שאת/ה מחפש/ת.' }
        : { title: 'Rebook a favourite', why: 'A provider you saved is available for the dates you\'re looking at.' };
    case 'REFUND_IN_PROGRESS':
      return he
        ? { title: 'החזר בתהליך', why: 'הכסף בדרך; אין צורך לפעול.' }
        : { title: 'Refund in progress', why: 'Money is on the way; no action needed.' };
    case 'EGIFT_BALANCE_AVAILABLE':
      return he
        ? { title: 'יש לך יתרת eGift', why: 'הפעל את השובר בהזמנה מתאימה.' }
        : { title: 'You have eGift balance', why: 'Apply it on a matching booking.' };
    case 'EGIFT_EXPIRING_SOON':
      return he
        ? { title: 'eGift שתוקפו פג בקרוב', why: 'יש לנצל לפני התפוגה.' }
        : { title: 'eGift expires soon', why: 'Use it before it expires.' };
    case 'WALLET_BALANCE_AVAILABLE':
      return he
        ? { title: 'יש לך יתרת ארנק', why: 'ניתן להשתמש בתשלום ההזמנה הבאה.' }
        : { title: 'You have wallet balance', why: 'Use it on your next booking.' };
    case 'WASH_PACKAGE_AVAILABLE':
      return he
        ? { title: 'חבילת שטיפה זמינה', why: 'תוקף עד לתום החבילה — הפעילו בעמדה קרובה.' }
        : { title: 'Wash package ready', why: 'Redeem it at a nearby K9000 station.' };
    case 'PRESTIGE_BENEFIT_AVAILABLE':
      return he
        ? { title: 'הטבת Prestige זמינה', why: 'צפו בהטבות שאתם זכאים להן.' }
        : { title: 'Prestige benefit available', why: 'See rewards you\'re eligible for.' };
    case 'KYA_STALE_REVIEW':
      return he
        ? { title: 'סקירת פרופיל טיפול', why: 'הפרופיל לא עודכן ב-90 הימים האחרונים.' }
        : { title: 'Review care profile', why: "The profile hasn't been reviewed in the last 90 days." };
    case 'PROVIDER_INSURANCE_EXPIRING':
      return he
        ? { title: 'הביטוח שלך עומד לפוג', why: 'חדשו כדי להמשיך לקבל הזמנות.' }
        : { title: 'Your insurance expires soon', why: 'Renew to keep receiving bookings.' };
    case 'PROVIDER_KYC_DOC_EXPIRING':
      return he
        ? { title: 'מסמך זיהוי עומד לפוג', why: 'חדשו כדי להמשיך לקבל הזמנות.' }
        : { title: 'Your ID document expires soon', why: 'Renew to keep receiving bookings.' };
    case 'PROVIDER_PAYOUT_AVAILABLE':
      return he
        ? { title: 'תשלום ממתין', why: 'ההעברה תבוצע לפי לוח התשלומים.' }
        : { title: 'Payout available', why: 'The payout batch runs on schedule.' };
    case 'PROVIDER_AVAILABILITY_STALE':
      return he
        ? { title: 'עדכני את הזמינות שלך', why: 'לקוחות רואים מועדים ריקים בלוח שלך.' }
        : { title: 'Update your availability', why: 'Customers see empty slots on your calendar.' };
  }
}

function shekel(cents: number): string {
  return `₪${(cents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

interface ConfirmState {
  action: NextBestAction;
  copy: { title: string; why: string };
}

export function JourneyConcierge({ actor, limit = 4 }: Props) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const { user } = useFirebaseAuth();
  const { actions, isLoading, refetch } = useNextBestActionFeed(actor);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [locallyHidden, setLocallyHidden] = useState<Set<string>>(new Set());

  // CEO §66 telemetry: post an `event` per action rendered (once per
  // set of ids per mount). Fire-and-forget — a network hiccup must
  // never block the render.
  async function postEvent(a: NextBestAction, eventType: 'shown' | 'clicked' | 'dismissed' | 'not_interested') {
    try {
      const token = await user?.getIdToken().catch(() => undefined);
      await fetch(getApiUrl('/api/journey/events'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          actor,
          reasonCode: a.reasonCode,
          eventType,
          actionType: a.actionType,
          source: 'concierge',
          entityRef: a.entityRef ?? undefined,
        }),
      });
    } catch { /* silent — telemetry is best-effort */ }
  }

  // Fire ONE `shown` event per action id per mount.
  useEffect(() => {
    if (!actions || actions.length === 0) return;
    for (const a of actions) {
      if (locallyHidden.has(a.id)) continue;
      postEvent(a, 'shown');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions?.map((a) => a.id).join(',')]);

  if (isLoading) return null;
  if (!actions || actions.length === 0) return null;

  const visible = actions
    .filter((a) => !locallyHidden.has(a.id))
    .slice(0, limit);

  const go = (a: NextBestAction, copy: { title: string; why: string }) => {
    postEvent(a, 'clicked');
    if (a.requiresConfirmation) {
      setConfirm({ action: a, copy });
      return;
    }
    navigate(a.destination);
  };

  const dismiss = (a: NextBestAction, mode: 'dismissed' | 'not_interested') => {
    setLocallyHidden((s) => new Set(s).add(a.id));
    setMenuOpen(null);
    postEvent(a, mode);
    // Refetch — the server may promote another item in this slot.
    // §67 dismissal-demote uses the same POST as its evidence, so
    // the next compose reflects the user's feedback immediately.
    setTimeout(() => { refetch(); }, 400);
  };

  return (
    <section
      className="px-4 pt-2"
      dir={he ? 'rtl' : 'ltr'}
      data-testid={`journey-concierge-${actor}`}
    >
      <h2 className="text-sm font-semibold text-gray-900 mb-2">
        {he ? 'הצעדים הבאים שלך' : 'Your next steps'}
      </h2>
      <ul className="space-y-2">
        {visible.map((a) => {
          const copy = reasonCopy(a.reasonCode, he) ?? {
            title: he ? 'מומלץ עבורך' : 'Recommended for you',
            why: he ? 'הצעה מותאמת אישית' : 'Personalised suggestion',
          };
          const Icon = ACTION_ICON[a.actionType] ?? Eye;
          const style = PRIORITY_STYLE[a.priority];
          return (
            <li key={a.id}>
              <div
                className="w-full rounded-2xl border bg-white p-3 flex items-center gap-3 shadow-sm"
                style={{ borderColor: style.border }}
                data-testid={`journey-concierge-item-${a.id}`}
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gray-50">
                  <Icon style={{ width: 18, height: 18 }} />
                </span>
                <button
                  type="button"
                  onClick={() => go(a, copy)}
                  className="flex-1 min-w-0 text-start"
                  data-testid={`journey-concierge-cta-${a.id}`}
                >
                  <span className="block text-[13.5px] font-semibold text-gray-900 truncate">
                    {copy.title}
                  </span>
                  <span className="block text-[11.5px] text-gray-500 truncate">
                    {copy.why}
                  </span>
                </button>
                {typeof a.moneyHintCents === 'number' && a.moneyHintCents > 0 && (
                  <span className={`shrink-0 text-[13px] font-bold ${style.label}`}>
                    {shekel(a.moneyHintCents)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setWhyOpen(whyOpen === a.id ? null : a.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700"
                  aria-label={he ? 'למה אני רואה את זה?' : 'Why am I seeing this?'}
                  data-testid={`journey-concierge-why-${a.id}`}
                >
                  <Info style={{ width: 14, height: 14 }} />
                </button>
                {/* CEO §24 dismissal menu — Not interested / Fewer offers */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700"
                    aria-label={he ? 'אפשרויות' : 'Options'}
                    data-testid={`journey-concierge-menu-${a.id}`}
                  >
                    <MoreVertical style={{ width: 14, height: 14 }} />
                  </button>
                  {menuOpen === a.id && (
                    <div
                      className="absolute z-40 top-8 end-0 w-48 rounded-xl border border-gray-200 bg-white shadow-lg py-1"
                      data-testid={`journey-concierge-menu-panel-${a.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => dismiss(a, 'dismissed')}
                        className="w-full text-start px-3 py-2 text-[12px] text-gray-800 hover:bg-gray-50"
                        data-testid={`journey-concierge-menu-dismiss-${a.id}`}
                      >
                        {he ? 'הסתר את הכרטיס הזה' : 'Hide this card'}
                      </button>
                      <button
                        type="button"
                        onClick={() => dismiss(a, 'not_interested')}
                        className="w-full text-start px-3 py-2 text-[12px] text-gray-800 hover:bg-gray-50"
                        data-testid={`journey-concierge-menu-notinterested-${a.id}`}
                      >
                        {he ? 'לא מעניין אותי' : 'Not interested'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {whyOpen === a.id && (
                <div
                  className="mt-1 mx-2 rounded-xl bg-gray-50 p-3 text-[12px] text-gray-700"
                  data-testid={`journey-concierge-why-panel-${a.id}`}
                >
                  <div className="font-semibold mb-1">
                    {he ? 'למה אני רואה את זה?' : 'Why am I seeing this?'}
                  </div>
                  <div>{copy.why}</div>
                  <div className="mt-1 text-[10px] text-gray-400 font-mono">{a.reasonCode}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          data-testid="journey-concierge-confirm"
          onClick={() => setConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {confirm.copy.title}
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              {confirm.copy.why}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-[13px] font-medium text-gray-700"
                data-testid="journey-concierge-confirm-cancel"
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = confirm.action.destination;
                  setConfirm(null);
                  navigate(dest);
                }}
                className="flex-1 rounded-xl bg-black text-white py-2 text-[13px] font-medium"
                data-testid="journey-concierge-confirm-continue"
              >
                {he ? 'המשך' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default JourneyConcierge;
