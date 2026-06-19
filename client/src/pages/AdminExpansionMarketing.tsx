/**
 * AdminExpansionMarketing.tsx
 *
 * READ-ONLY admin surface for two backend modules:
 *   • Franchise / Location Scoring (§9)  → GET /api/admin/location-scoring
 *   • Local Marketing Engine (§25)       → GET /api/admin/marketing-campaigns
 *
 * Both endpoints are PURE SELECT. This page only DISPLAYS what they return and
 * sends / posts NOTHING.
 *
 * Honest (platform skill §2 — no fake data):
 *   - There is no franchise/location LEAD table yet, so the scoring section
 *     shows the documented MODEL (factor weights + pipeline) and an explicit
 *     "not tracked yet" note — never invented leads.
 *   - Marketing attribution that the backend reports as not-linkable (e.g. a
 *     K9000 wash to a specific code) is labelled as such, not faked.
 *
 * Brand: pure white background, black text, bright gold (#D4AF37) accents.
 * Bilingual (he/en) via useLanguage; RTL when language is Hebrew. Mobile-first.
 */
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import { Link } from "wouter";
import {
  MapPin, BarChart3, ArrowLeft, Info, Building2, Tag, Megaphone,
  TrendingUp, Users, Layers,
} from "lucide-react";

const GOLD = "#D4AF37";

// ── Backend response types (mirror server/routes/admin-expansion-marketing.ts) ──
interface ScoringFactor {
  key: string;
  weight: number;
  label: string;
  labelHe: string;
  higherIsBetter: boolean;
}
interface PipelineStage { key: string; label: string; labelHe: string; }
interface LocationScoringResponse {
  generatedAt: string;
  leadsTracked: boolean;
  leads: unknown[];
  signedFranchisees: number;
  model: { scaleMax: number; factors: ScoringFactor[]; pipeline: PipelineStage[] };
  note: string;
}

interface CampaignRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  promoCode: string | null;
  discountType: string;
  discountValue: string;
  currency: string | null;
  startAt: string | null;
  endAt: string | null;
  maxRedemptions: number | null;
  currentRedemptions: number | null;
  attribution: {
    redemptions: number;
    uniqueCustomers: number;
    discountValueAttributed: number;
    bookingsLinked: number;
    ordersLinked: number;
  };
}
interface CouponChannel {
  channel: string;
  couponCount: number;
  activeCount: number;
  totalRedemptions: number;
}
interface MarketingResponse {
  generatedAt: string;
  promotionalCampaigns: {
    count: number;
    campaigns: CampaignRow[];
    customerMix: {
      firstTimeCustomers: number;
      repeatCustomers: number;
      repeatRedemptions: number;
      totalCustomers: number;
      note: string;
    };
  };
  couponEngine: {
    byChannel: CouponChannel[];
    money: {
      redemptions: number;
      uniqueCustomers: number;
      grossBeforeIls: number;
      discountIls: number;
      netAfterIls: number;
    };
    note: string;
  };
  bayWashAttribution: {
    promoSessions: number;
    promoSessionsCompleted: number;
    attributable: boolean;
    note: string;
  };
}

function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
function ils(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₪${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function AdminExpansionMarketing() {
  const { language, dir } = useLanguage();
  const he = language === "he";
  const tx = (en: string, hb: string) => (he ? hb : en);

  const scoringQ = useQuery<LocationScoringResponse>({ queryKey: ["/api/admin/location-scoring"] });
  const mktQ = useQuery<MarketingResponse>({ queryKey: ["/api/admin/marketing-campaigns"] });

  const sc = scoringQ.data;
  const mk = mktQ.data;

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
              <MapPin className="h-6 w-6" style={{ color: GOLD }} />
              <h1 className="text-2xl font-bold tracking-tight">
                {tx("Expansion & Marketing", "התרחבות ושיווק")}
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {tx(
                "Location scoring model + local marketing tracking — read-only",
                "מודל ניקוד מיקומים + מעקב שיווק מקומי — לקריאה בלבד",
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
              "This screen is read-only. It shows the location-scoring framework and the real local-marketing campaigns and coupons — it does not create leads, launch campaigns, or change any data.",
              "מסך זה לקריאה בלבד. הוא מציג את מסגרת ניקוד המיקומים ואת קמפייני השיווק והקופונים האמיתיים — הוא אינו יוצר לידים, אינו משיק קמפיינים ואינו משנה נתונים.",
            )}
          </p>
        </div>

        {/* ── §9 FRANCHISE / LOCATION SCORING ────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-bold">
              {tx("Franchise / Location Scoring", "ניקוד זכיינות / מיקומים")}
            </h2>
          </div>
          <p className="mb-5 text-sm text-gray-500">
            {tx("Site lead pipeline + scoring framework", "צבר לידים לאתרים + מסגרת ניקוד")}
          </p>

          {scoringQ.isLoading && (
            <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
              {tx("Loading…", "טוען…")}
            </div>
          )}
          {scoringQ.isError && (
            <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
              {tx("Could not load location scoring.", "לא ניתן לטעון את ניקוד המיקומים.")}
            </div>
          )}

          {sc && (
            <>
              {/* Status row: leads tracked or not */}
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border p-5" style={{ borderColor: "#ECECEC" }}>
                  <div className="text-sm text-gray-500">{tx("Location leads tracked", "לידים למיקומים")}</div>
                  <div className="mt-1 text-2xl font-bold">
                    {sc.leadsTracked ? tx("Yes", "כן") : tx("Not yet", "עדיין לא")}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {tx(`${sc.leads.length} leads`, `${sc.leads.length} לידים`)}
                  </div>
                </div>
                <div className="rounded-2xl border p-5" style={{ borderColor: "#ECECEC" }}>
                  <div className="text-sm text-gray-500">{tx("Signed franchisees", "זכיינים חתומים")}</div>
                  <div className="mt-1 text-2xl font-bold">{num(sc.signedFranchisees)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {tx("Real count (context, not leads)", "מספר אמיתי (הקשר, לא לידים)")}
                  </div>
                </div>
              </div>

              {/* Honest note when no leads table exists */}
              {!sc.leadsTracked && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border bg-gray-50 p-4" style={{ borderColor: "#ECECEC" }}>
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                  <p className="text-sm leading-relaxed text-gray-600">
                    {tx(
                      "No franchise / site-lead table exists yet, so no leads are shown. The scoring model below is the framework to use once a leads pipeline is added.",
                      "טרם קיימת טבלת לידים לזכיינות / אתרים, לכן לא מוצגים לידים. מודל הניקוד שלהלן הוא המסגרת שתשמש לאחר הוספת צבר לידים.",
                    )}
                  </p>
                </div>
              )}

              {/* Scoring model: weighted factors */}
              <div className="mb-6 overflow-hidden rounded-2xl border" style={{ borderColor: "#ECECEC" }}>
                <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold" style={{ borderColor: "#ECECEC" }}>
                  {tx(`Scoring model (0–${sc.model.scaleMax})`, `מודל ניקוד (0–${sc.model.scaleMax})`)}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="px-5 py-2 text-start font-medium">{tx("Factor", "גורם")}</th>
                      <th className="px-5 py-2 text-end font-medium">{tx("Weight", "משקל")}</th>
                      <th className="px-5 py-2 text-end font-medium">{tx("Direction", "כיוון")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sc.model.factors.map((f) => (
                      <tr key={f.key} className="border-t" style={{ borderColor: "#F3F3F3" }}>
                        <td className="px-5 py-2">{he ? f.labelHe : f.label}</td>
                        <td className="px-5 py-2 text-end font-semibold" style={{ color: GOLD }}>{f.weight}</td>
                        <td className="px-5 py-2 text-end text-xs text-gray-500">
                          {f.higherIsBetter ? tx("Higher better", "גבוה עדיף") : tx("Lower better", "נמוך עדיף")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pipeline stages */}
              <div className="mb-4">
                <div className="mb-2 text-sm font-semibold text-gray-700">{tx("Lead pipeline", "צבר לידים")}</div>
                <div className="flex flex-wrap gap-2">
                  {sc.model.pipeline.map((p) => (
                    <span
                      key={p.key}
                      className="rounded-full border px-3 py-1 text-xs text-gray-700"
                      style={{ borderColor: GOLD }}
                    >
                      {he ? p.labelHe : p.label}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-xs leading-relaxed text-gray-400">{sc.note}</p>
            </>
          )}
        </section>

        {/* ── §25 LOCAL MARKETING ENGINE ─────────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="h-5 w-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-bold">{tx("Local Marketing", "שיווק מקומי")}</h2>
          </div>
          <p className="mb-5 text-sm text-gray-500">
            {tx("Promotional campaigns, coupons & attribution", "קמפיינים מקדמי מכירות, קופונים וייחוס")}
          </p>

          {mktQ.isLoading && (
            <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
              {tx("Loading…", "טוען…")}
            </div>
          )}
          {mktQ.isError && (
            <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
              {tx("Could not load marketing campaigns.", "לא ניתן לטעון את קמפייני השיווק.")}
            </div>
          )}

          {mk && (
            <>
              {/* Customer mix */}
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border p-4" style={{ borderColor: "#ECECEC" }}>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" /> {tx("First-time", "ראשונה")}
                  </div>
                  <div className="mt-1 text-xl font-bold">{num(mk.promotionalCampaigns.customerMix.firstTimeCustomers)}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "#ECECEC" }}>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <TrendingUp className="h-3.5 w-3.5" /> {tx("Repeat", "חוזרים")}
                  </div>
                  <div className="mt-1 text-xl font-bold">{num(mk.promotionalCampaigns.customerMix.repeatCustomers)}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "#ECECEC" }}>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Layers className="h-3.5 w-3.5" /> {tx("Campaigns", "קמפיינים")}
                  </div>
                  <div className="mt-1 text-xl font-bold">{num(mk.promotionalCampaigns.count)}</div>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "#ECECEC" }}>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Tag className="h-3.5 w-3.5" /> {tx("Coupon redemptions", "מימושי קופונים")}
                  </div>
                  <div className="mt-1 text-xl font-bold">{num(mk.couponEngine.money.redemptions)}</div>
                </div>
              </div>

              {/* Campaign list */}
              <div className="mb-6 overflow-x-auto rounded-2xl border" style={{ borderColor: "#ECECEC" }}>
                <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold" style={{ borderColor: "#ECECEC" }}>
                  {tx("Promotional campaigns", "קמפיינים מקדמי מכירות")}
                </div>
                {mk.promotionalCampaigns.campaigns.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    {tx("No campaigns yet.", "אין קמפיינים עדיין.")}
                  </div>
                ) : (
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="px-4 py-2 text-start font-medium">{tx("Name", "שם")}</th>
                        <th className="px-4 py-2 text-start font-medium">{tx("Code", "קוד")}</th>
                        <th className="px-4 py-2 text-start font-medium">{tx("Status", "סטטוס")}</th>
                        <th className="px-4 py-2 text-end font-medium">{tx("Redemptions", "מימושים")}</th>
                        <th className="px-4 py-2 text-end font-medium">{tx("Customers", "לקוחות")}</th>
                        <th className="px-4 py-2 text-end font-medium">{tx("Discount value", "ערך הנחה")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mk.promotionalCampaigns.campaigns.map((c) => (
                        <tr key={c.id} className="border-t" style={{ borderColor: "#F3F3F3" }}>
                          <td className="px-4 py-2 font-medium">{c.name}</td>
                          <td className="px-4 py-2 font-mono text-xs">{c.promoCode || "—"}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{c.status}</td>
                          <td className="px-4 py-2 text-end">{num(c.attribution.redemptions)}</td>
                          <td className="px-4 py-2 text-end">{num(c.attribution.uniqueCustomers)}</td>
                          <td className="px-4 py-2 text-end" style={{ color: GOLD }}>
                            {ils(c.attribution.discountValueAttributed)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Coupon channels */}
              <div className="mb-6 overflow-hidden rounded-2xl border" style={{ borderColor: "#ECECEC" }}>
                <div className="border-b bg-gray-50 px-5 py-3 text-sm font-semibold" style={{ borderColor: "#ECECEC" }}>
                  {tx("Coupons by channel", "קופונים לפי ערוץ")}
                </div>
                {mk.couponEngine.byChannel.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    {tx("No coupons yet.", "אין קופונים עדיין.")}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="px-5 py-2 text-start font-medium">{tx("Channel", "ערוץ")}</th>
                        <th className="px-5 py-2 text-end font-medium">{tx("Coupons", "קופונים")}</th>
                        <th className="px-5 py-2 text-end font-medium">{tx("Active", "פעילים")}</th>
                        <th className="px-5 py-2 text-end font-medium">{tx("Redemptions", "מימושים")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mk.couponEngine.byChannel.map((ch) => (
                        <tr key={ch.channel} className="border-t" style={{ borderColor: "#F3F3F3" }}>
                          <td className="px-5 py-2 font-medium">{ch.channel}</td>
                          <td className="px-5 py-2 text-end">{num(ch.couponCount)}</td>
                          <td className="px-5 py-2 text-end">{num(ch.activeCount)}</td>
                          <td className="px-5 py-2 text-end">{num(ch.totalRedemptions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="border-t px-5 py-3 text-xs text-gray-500" style={{ borderColor: "#F3F3F3" }}>
                  {tx("Coupon discount (real ledger):", "הנחת קופונים (ספר אמיתי):")}{" "}
                  <span className="font-semibold" style={{ color: GOLD }}>{ils(mk.couponEngine.money.discountIls)}</span>
                  {" · "}
                  {tx("Net after discount:", "נטו לאחר הנחה:")}{" "}
                  <span className="font-semibold">{ils(mk.couponEngine.money.netAfterIls)}</span>
                </div>
              </div>

              {/* Bay wash attribution honesty card */}
              <div className="rounded-2xl border bg-gray-50 p-4" style={{ borderColor: "#ECECEC" }}>
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    <div className="mb-1 font-semibold text-gray-700">
                      {tx("K9000 promo washes", "רחיצות K9000 במבצע")}:{" "}
                      <span style={{ color: GOLD }}>{num(mk.bayWashAttribution.promoSessions)}</span>
                    </div>
                    <p className="leading-relaxed">{mk.bayWashAttribution.note}</p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray-400">
                {mk.promotionalCampaigns.customerMix.note} {mk.couponEngine.note}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
