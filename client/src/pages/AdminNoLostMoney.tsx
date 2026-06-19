/**
 * AdminNoLostMoney.tsx — CEO "No Lost Money" view (Business-OS §14).
 *
 * READ-ONLY money-leak detector. Renders GET /api/admin/no-lost-money:
 * each leak category becomes a counted card; clicking a card expands the
 * affected rows. No actions, no money math — pure visibility.
 *
 * Brand: pure white background, black text, metallic gold (#D4AF37) accents.
 * Bilingual via useLanguage; RTL when Hebrew.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  ShieldAlert,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const GOLD = "#D4AF37";

type LeakRow = Record<string, unknown>;

interface NoLostMoneyResponse {
  generatedAt: string;
  cap: number;
  leaks: Record<string, LeakRow[]>;
  counts: Record<string, number>;
}

// Display order + bilingual labels + one-line explanation per leak category.
const CATEGORIES: Array<{
  key: string;
  en: string;
  he: string;
  descEn: string;
  descHe: string;
}> = [
  {
    key: "paidNotActivated",
    en: "Paid but not activated",
    he: "שולם אך לא הופעל",
    descEn: "Online/SUMIT purchases marked paid that never reached 'activated'.",
    descHe: "רכישות מקוונות/SUMIT שסומנו כשולמו אך לא הגיעו לסטטוס 'הופעל'.",
  },
  {
    key: "nayaxNoSession",
    en: "Nayax payment, no wash session",
    he: "תשלום Nayax ללא שטיפה",
    descEn: "Successful Nayax terminal payments with no matching bay session.",
    descHe: "תשלומי Nayax מוצלחים ללא רישום שטיפה תואם.",
  },
  {
    key: "sessionNoPayment",
    en: "Wash session, no payment",
    he: "שטיפה ללא תשלום",
    descEn: "Terminal-card bay sessions that ran with no Nayax transaction.",
    descHe: "שטיפות בכרטיס בעמדה שרצו ללא עסקת Nayax.",
  },
  {
    key: "egiftEmailFailed",
    en: "eGift paid, not delivered",
    he: "מתנה שולמה, לא נמסרה",
    descEn:
      "Issued gift vouchers with a recipient email, > 1h old, never claimed (likely undelivered email).",
    descHe:
      "שוברי מתנה שהונפקו עם דוא״ל נמען, מעל שעה, שלא נדרשו (ככל הנראה דוא״ל שלא נמסר).",
  },
  {
    key: "egiftRedeemedNotCredited",
    en: "eGift redeemed, wallet not credited",
    he: "מתנה מומשה, הארנק לא זוכה",
    descEn: "Redeemed vouchers with no matching credit in the wallet ledger.",
    descHe: "שוברים שמומשו ללא רישום זיכוי תואם בארנק.",
  },
  {
    key: "receiptFailed",
    en: "Order paid, no receipt",
    he: "הזמנה שולמה, ללא קבלה",
    descEn: "Paid/activated purchases with no SUMIT receipt number.",
    descHe: "רכישות ששולמו/הופעלו ללא מספר קבלה ב-SUMIT.",
  },
  {
    key: "duplicateSupplierInvoice",
    en: "Duplicate supplier invoice",
    he: "חשבונית ספק כפולה",
    descEn: "Same file hash, or same supplier + invoice number, on multiple rows.",
    descHe: "אותו hash קובץ, או אותו ספק + מספר חשבונית, במספר רשומות.",
  },
];

export default function AdminNoLostMoney() {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, refetch } = useQuery<NoLostMoneyResponse>({
    queryKey: ["/api/admin/no-lost-money"],
  });

  const counts = data?.counts ?? {};
  const totalLeaks = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      dir={isHebrew ? "rtl" : "ltr"}
      className="min-h-screen bg-white text-black"
      style={{ fontFamily: "inherit" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Back link */}
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 text-black/60 hover:text-black">
            <ArrowLeft className={`h-4 w-4 ${isHebrew ? "ml-2 rotate-180" : "mr-2"}`} />
            {isHebrew ? "חזרה לניהול" : "Back to admin"}
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(212,175,55,0.12)" }}
            >
              <ShieldAlert className="h-6 w-6" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isHebrew ? "בלי כסף אבוד" : "No Lost Money"}
              </h1>
              <p className="text-sm text-black/60">
                {isHebrew
                  ? "גלאי דליפות כסף — לקריאה בלבד"
                  : "Money-leak detector — read-only"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-black/15"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""} ${isHebrew ? "ml-2" : "mr-2"}`} />
            {isHebrew ? "רענון" : "Refresh"}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-black/50">{isHebrew ? "טוען…" : "Loading…"}</p>
        ) : (
          <>
            {/* Summary banner */}
            {totalLeaks === 0 ? (
              <Card className="mb-6 border-emerald-200 bg-emerald-50">
                <CardContent className="flex items-center gap-3 py-5">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <span className="font-medium text-emerald-800">
                    {isHebrew
                      ? "לא נמצאו דליפות כסף."
                      : "No money leaks detected."}
                  </span>
                </CardContent>
              </Card>
            ) : (
              <Card
                className="mb-6 border-2"
                style={{ borderColor: GOLD, backgroundColor: "rgba(212,175,55,0.06)" }}
              >
                <CardContent className="py-5">
                  <span className="text-lg font-semibold">
                    {isHebrew
                      ? `${totalLeaks} רשומות חשודות לבדיקה`
                      : `${totalLeaks} records to investigate`}
                  </span>
                  {data?.cap != null && (
                    <p className="mt-1 text-xs text-black/50">
                      {isHebrew
                        ? `כל קטגוריה מוגבלת ל-${data.cap} רשומות.`
                        : `Each category is capped at ${data.cap} rows.`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Leak cards */}
            <div className="space-y-3">
              {CATEGORIES.map((cat) => {
                const rows = data?.leaks?.[cat.key] ?? [];
                const count = counts[cat.key] ?? 0;
                const isOpen = !!expanded[cat.key];
                const hasLeaks = count > 0;
                return (
                  <Card
                    key={cat.key}
                    className="border-black/10"
                    style={hasLeaks ? { borderInlineStartWidth: 4, borderInlineStartColor: GOLD } : undefined}
                  >
                    <CardHeader
                      className={`flex flex-row items-center justify-between gap-3 ${hasLeaks ? "cursor-pointer" : ""}`}
                      onClick={() => hasLeaks && toggle(cat.key)}
                    >
                      <div className="min-w-0">
                        <CardTitle className="text-base">
                          {isHebrew ? cat.he : cat.en}
                        </CardTitle>
                        <p className="mt-1 text-xs text-black/50">
                          {isHebrew ? cat.descHe : cat.descEn}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={hasLeaks ? "default" : "secondary"}
                          style={hasLeaks ? { backgroundColor: GOLD, color: "#000" } : undefined}
                        >
                          {count}
                        </Badge>
                        {hasLeaks &&
                          (isOpen ? (
                            <ChevronUp className="h-4 w-4 text-black/40" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-black/40" />
                          ))}
                      </div>
                    </CardHeader>
                    {hasLeaks && isOpen && (
                      <CardContent>
                        <div className="overflow-x-auto rounded-lg border border-black/10">
                          <table className="w-full text-start text-xs">
                            <thead className="bg-black/[0.03] text-black/60">
                              <tr>
                                {Object.keys(rows[0] ?? {}).map((col) => (
                                  <th
                                    key={col}
                                    className="whitespace-nowrap px-3 py-2 text-start font-medium"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, i) => (
                                <tr key={i} className="border-t border-black/5">
                                  {Object.keys(rows[0] ?? {}).map((col) => (
                                    <td
                                      key={col}
                                      className="whitespace-nowrap px-3 py-2 align-top"
                                    >
                                      {formatCell((row as LeakRow)[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {data?.generatedAt && (
              <p className="mt-6 text-center text-xs text-black/40">
                {isHebrew ? "נוצר ב-" : "Generated at "}
                {new Date(data.generatedAt).toLocaleString(isHebrew ? "he-IL" : "en-GB")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
