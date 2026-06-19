/**
 * AdminRetention.tsx
 *
 * READ-ONLY admin surface for two backend modules:
 *   • Customer Winback Engine (§27)  → GET /api/admin/winback
 *   • Review Engine logic (§26)      → GET /api/admin/review-funnel
 *
 * Both endpoints are PURE SELECT. This page only DISPLAYS what they return and
 * sends / posts NOTHING. The "suggested action" on each winback segment is a
 * LABEL for a human operator — no message is dispatched from here.
 *
 * Honest: a value the backend reports as `null` (e.g. no reviews table for
 * K9000 station washes) is shown as "not tracked yet" / "not available" —
 * never a fabricated number.
 *
 * Brand: pure white background, black text, bright gold (#D4AF37) accents.
 * Bilingual (he/en) via useLanguage; RTL when language is Hebrew.
 */
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import { Link } from "wouter";
import {
  Users, Star, ArrowLeft, Bell, Heart, Gift, CreditCard, Info,
  ThumbsUp, ThumbsDown, ShieldCheck,
} from "lucide-react";

const GOLD = "#D4AF37";

// ── Backend response types (mirror server/routes/admin-retention.ts) ────────
interface WinbackSample {
  userId: string;
  email: string | null;
  name: string | null;
  lastActivityAt: string | null;
}
type ActionLabel = "reminder" | "care_tip" | "small_credit" | "birthday_offer";
interface WinbackSegment {
  key: string;
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  suggestedAction: ActionLabel;
  count: number | null;
  sample: WinbackSample[];
  note?: string;
}
interface WinbackResponse {
  generatedAt: string;
  readOnly: boolean;
  sampleCap: number;
  note: string;
  actionLabels: Record<ActionLabel, { en: string; he: string }>;
  segments: WinbackSegment[];
}

interface ReviewFunnelLeg {
  eligibleToAsk: number | null;
  asked: number | null;
  reviewed: number | null;
  highRating: number | null;
  lowRating: number | null;
  reviewsTracked: boolean;
  note: string | null;
}
interface ReviewFunnelResponse {
  generatedAt: string;
  readOnly: boolean;
  policy: {
    summary: string;
    summaryHe: string;
    askEligibility: string[];
    routing: {
      highRating: { threshold: string; action: string };
      lowRating: { threshold: string; action: string };
    };
    enforced: boolean;
    note: string;
  };
  stationWashes: ReviewFunnelLeg;
  marketplace: ReviewFunnelLeg;
}

const ACTION_ICON: Record<ActionLabel, any> = {
  reminder: Bell,
  care_tip: Heart,
  small_credit: CreditCard,
  birthday_offer: Gift,
};

function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

export default function AdminRetention() {
  const { language, dir } = useLanguage();
  const he = language === "he";
  const tx = (en: string, hb: string) => (he ? hb : en);

  const winbackQ = useQuery<WinbackResponse>({ queryKey: ["/api/admin/winback"] });
  const reviewQ = useQuery<ReviewFunnelResponse>({ queryKey: ["/api/admin/review-funnel"] });

  const wb = winbackQ.data;
  const rv = reviewQ.data;

  const actionLabel = (a: ActionLabel): string => {
    const l = wb?.actionLabels?.[a];
    if (!l) return a;
    return he ? l.he : l.en;
  };

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black">
      <div
        className="mx-auto max-w-6xl px-4 py-8"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/admin/dashboard">
            <a className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black">
              <ArrowLeft className="h-4 w-4" />
              {tx("Admin", "ניהול")}
            </a>
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Users className="h-6 w-6" style={{ color: GOLD }} />
              <h1 className="text-2xl font-bold tracking-tight">
                {tx("Retention & Reviews", "שימור וביקורות")}
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {tx(
                "Winback detection + review funnel — preview only, nothing is sent",
                "זיהוי שימור + משפך ביקורות — תצוגה בלבד, שום דבר לא נשלח",
              )}
            </p>
          </div>
          <div className="w-16" />
        </div>

        {/* Read-only banner */}
        <div
          className="mb-8 flex items-start gap-3 rounded-2xl border bg-white p-4"
          style={{ borderColor: GOLD }}
        >
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
          <p className="text-sm leading-relaxed text-gray-700">
            {tx(
              "This screen is read-only. It detects who to re-engage and shows the review funnel, but does not send messages, post reviews, or open tickets. Suggested actions are labels for a human to decide on.",
              "מסך זה הוא לקריאה בלבד. הוא מזהה את מי כדאי להחזיר ומציג את משפך הביקורות, אך אינו שולח הודעות, אינו מפרסם ביקורות ואינו פותח פניות. הפעולות המוצעות הן תוויות להחלטת אדם.",
            )}
          </p>
        </div>

        {/* ── WINBACK ENGINE (§27) ──────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-1 text-lg font-bold">
            {tx("Customer Winback", "שימור לקוחות")}
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            {tx("Inactive customer segments", "פלחי לקוחות לא פעילים")}
          </p>

          {winbackQ.isLoading && (
            <div
              className="rounded-2xl border p-10 text-center text-gray-400"
              style={{ borderColor: "#ECECEC" }}
            >
              {tx("Loading segments…", "טוען פלחים…")}
            </div>
          )}
          {winbackQ.isError && (
            <div
              className="rounded-2xl border p-6 text-center text-red-600"
              style={{ borderColor: GOLD }}
            >
              {tx("Could not load winback segments.", "לא ניתן לטעון את פלחי השימור.")}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {wb?.segments?.map((seg) => {
              const ActionIcon = ACTION_ICON[seg.suggestedAction] ?? Bell;
              return (
                <div
                  key={seg.key}
                  className="flex flex-col rounded-2xl border bg-white p-5"
                  style={{ borderColor: "#ECECEC" }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-black">
                      {he ? seg.titleHe : seg.title}
                    </h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: GOLD }}>
                        {seg.count == null ? (
                          <span className="text-base font-normal text-gray-400">
                            {tx("n/a", "לא זמין")}
                          </span>
                        ) : (
                          num(seg.count)
                        )}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">
                        {tx("customers", "לקוחות")}
                      </div>
                    </div>
                  </div>

                  <p className="mb-3 text-sm text-gray-500">
                    {he ? seg.descriptionHe : seg.description}
                  </p>

                  {/* Suggested action — LABEL ONLY */}
                  <div
                    className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={{ borderColor: GOLD, color: "#7a5c00" }}
                  >
                    <ActionIcon className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    {tx("Suggested:", "מוצע:")} {actionLabel(seg.suggestedAction)}
                  </div>

                  {seg.note && (
                    <p className="mb-3 text-xs text-amber-700">{seg.note}</p>
                  )}

                  {/* Sample list (capped operator preview) */}
                  {seg.sample.length > 0 ? (
                    <div className="mt-auto rounded-xl bg-gray-50 p-3">
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        {tx("Sample", "דוגמה")} ({seg.sample.length})
                      </div>
                      <ul className="space-y-1 text-xs text-gray-600">
                        {seg.sample.slice(0, 8).map((s) => (
                          <li key={s.userId} className="flex justify-between gap-2">
                            <span className="truncate">
                              {s.name || s.email || s.userId}
                            </span>
                            {s.lastActivityAt && (
                              <span className="flex-shrink-0 text-gray-400">
                                {new Date(s.lastActivityAt).toLocaleDateString(
                                  he ? "he-IL" : "en-GB",
                                )}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {seg.count != null && seg.count > seg.sample.length && (
                        <div className="mt-1.5 text-[11px] text-gray-400">
                          {tx("+ more not shown", "+ נוספים שאינם מוצגים")}
                        </div>
                      )}
                    </div>
                  ) : (
                    !seg.note && (
                      <p className="mt-auto text-xs text-gray-400">
                        {tx("No customers in this segment.", "אין לקוחות בפלח זה.")}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── REVIEW ENGINE (§26) ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-lg font-bold">
            {tx("Review Funnel", "משפך ביקורות")}
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            {tx("How completed services turn into reviews", "כיצד שירותים שהושלמו הופכים לביקורות")}
          </p>

          {reviewQ.isLoading && (
            <div
              className="rounded-2xl border p-10 text-center text-gray-400"
              style={{ borderColor: "#ECECEC" }}
            >
              {tx("Loading review funnel…", "טוען משפך ביקורות…")}
            </div>
          )}
          {reviewQ.isError && (
            <div
              className="rounded-2xl border p-6 text-center text-red-600"
              style={{ borderColor: GOLD }}
            >
              {tx("Could not load the review funnel.", "לא ניתן לטעון את משפך הביקורות.")}
            </div>
          )}

          {/* Policy card */}
          {rv?.policy && (
            <div
              className="mb-6 rounded-2xl border bg-white p-5"
              style={{ borderColor: GOLD }}
            >
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {tx("Policy (documented, not executed here)", "מדיניות (מתועדת, אינה מופעלת כאן)")}
                </h3>
              </div>
              <p className="mb-3 text-[15px] leading-relaxed text-black">
                {he ? rv.policy.summaryHe : rv.policy.summary}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-green-700">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {tx("4-5★ → Google review", "4-5★ → ביקורת גוגל")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-700">
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {tx("1-3★ → Support ticket", "1-3★ → פניית תמיכה")}
                </span>
              </div>
            </div>
          )}

          {/* Two funnel legs */}
          {rv && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <FunnelCard
                title={tx("Station washes (K9000)", "רחיצות עמדה (K9000)")}
                leg={rv.stationWashes}
                he={he}
                tx={tx}
              />
              <FunnelCard
                title={tx("Marketplace bookings", "הזמנות מרקטפלייס")}
                leg={rv.marketplace}
                he={he}
                tx={tx}
              />
            </div>
          )}
        </section>

        {/* Footer timestamp */}
        {(wb || rv) && (
          <p className="mt-10 text-center text-xs text-gray-400">
            {tx("Generated", "הופק")}{" "}
            {new Date(wb?.generatedAt || rv?.generatedAt || Date.now()).toLocaleString(
              he ? "he-IL" : "en-GB",
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// A single funnel leg (station or marketplace).
function FunnelCard({
  title,
  leg,
  he,
  tx,
}: {
  title: string;
  leg: ReviewFunnelLeg;
  he: boolean;
  tx: (en: string, hb: string) => string;
}) {
  const Row = ({ label, value }: { label: string; value: number | null }) => (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-black">
        {value == null ? (
          <span className="font-normal text-gray-400">{tx("not tracked", "לא נמדד")}</span>
        ) : (
          value.toLocaleString("en-US")
        )}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#ECECEC" }}>
      <h3 className="mb-3 text-base font-semibold text-black">{title}</h3>

      {!leg.reviewsTracked && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {tx("Reviews not tracked yet for this channel.", "ביקורות אינן נמדדות עדיין בערוץ זה.")}
        </div>
      )}

      <div>
        <Row label={tx("Eligible to ask", "כשירים לבקשה")} value={leg.eligibleToAsk} />
        <Row label={tx("Asked", "נשאלו")} value={leg.asked} />
        <Row label={tx("Reviewed", "השאירו ביקורת")} value={leg.reviewed} />
        <Row label={tx("4-5★ (Google route)", "4-5★ (מסלול גוגל)")} value={leg.highRating} />
        <Row label={tx("1-3★ (Support route)", "1-3★ (מסלול תמיכה)")} value={leg.lowRating} />
      </div>

      {leg.note && <p className="mt-3 text-xs text-gray-400">{leg.note}</p>}
    </div>
  );
}
