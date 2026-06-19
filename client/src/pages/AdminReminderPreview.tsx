/**
 * AdminReminderPreview.tsx — Smart-Reminders PREVIEW (Business-OS §6).
 *
 * READ-ONLY. Renders GET /api/admin/reminder-preview: a preview of the
 * reminders that WOULD be sent (due-for-wash, unused eGift, package almost
 * empty, upcoming pet birthday). It does NOT send anything — no SMS, email,
 * or push is dispatched. Each category is a counted card; click to expand a
 * capped sample list.
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
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  EyeOff,
} from "lucide-react";

const GOLD = "#D4AF37";

type SampleRow = Record<string, unknown>;

interface ReminderPreviewResponse {
  preview: boolean;
  sends: boolean;
  note: string;
  heuristics: {
    reminderDueDays: number;
    packageAlmostEmptyUnits: number;
    birthdayLookaheadDays: number;
    sampleCap: number;
  };
  counts: Record<string, number | null>;
  samples: Record<string, SampleRow[]>;
  errors: Record<string, string>;
  generatedAt: string;
}

// Category metadata — order + bilingual labels.
const CATEGORIES: Array<{ key: string; en: string; he: string; descEn: string; descHe: string }> = [
  {
    key: "dueForWash",
    en: "Due for next wash",
    he: "מועד לרחצה הבאה",
    descEn: "Customers whose last wash is older than the cadence window.",
    descHe: "לקוחות שהרחצה האחרונה שלהם ישנה מחלון התזכורת.",
  },
  {
    key: "unusedEgift",
    en: "Unused eGift",
    he: "גיפט שלא נוצל",
    descEn: "Issued / active gift vouchers with a remaining balance.",
    descHe: "שוברי מתנה פעילים עם יתרה שטרם נוצלה.",
  },
  {
    key: "packageAlmostEmpty",
    en: "Package almost empty",
    he: "חבילה כמעט ריקה",
    descEn: "Wallets with only the last wash credit left.",
    descHe: "ארנקים שנותרה בהם רחצה אחרונה בלבד.",
  },
  {
    key: "upcomingBirthday",
    en: "Upcoming pet birthday",
    he: "יום הולדת מתקרב לחיה",
    descEn: "Pets with a birthday within the look-ahead window.",
    descHe: "חיות שיום ההולדת שלהן בחלון הקרוב.",
  },
];

export default function AdminReminderPreview() {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const tr = (en: string, he: string) => (isHebrew ? he : en);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, refetch } = useQuery<ReminderPreviewResponse>({
    queryKey: ["/api/admin/reminder-preview"],
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const fmt = (v: unknown): string => {
    if (v == null) return "—";
    if (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toLocaleDateString(isHebrew ? "he-IL" : "en-GB");
    }
    return String(v);
  };

  return (
    <div dir={isHebrew ? "rtl" : "ltr"} className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Back link */}
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 text-black/60 hover:text-black">
            <ArrowLeft className={`h-4 w-4 ${isHebrew ? "ml-2 rotate-180" : "mr-2"}`} />
            {tr("Back to admin", "חזרה לניהול")}
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(212,175,55,0.12)" }}
            >
              <Activity className="h-6 w-6" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {tr("Reminders (preview)", "תזכורות (תצוגה)")}
              </h1>
              <p className="text-sm text-black/60">
                {tr(
                  "What smart reminders WOULD be sent — read-only",
                  "אילו תזכורות חכמות היו נשלחות — לקריאה בלבד",
                )}
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
            {tr("Refresh", "רענון")}
          </Button>
        </div>

        {/* Preview-only banner */}
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(212,175,55,0.4)", backgroundColor: "rgba(212,175,55,0.06)" }}
        >
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GOLD }} />
          <p className="text-sm text-black/80">
            {tr(
              "Preview only. Nothing is sent. This page shows the audiences a future reminder campaign would target, so copy and timing can be reviewed before any SMS, email, or push goes out.",
              "תצוגה בלבד. דבר לא נשלח. הדף מציג את קהלי היעד שקמפיין תזכורות עתידי היה פונה אליהם, כדי לבחון תוכן ותזמון לפני שליחת SMS, אימייל או התראה.",
            )}
          </p>
        </div>

        {isLoading && (
          <div className="py-16 text-center text-black/50">{tr("Loading…", "טוען…")}</div>
        )}

        {!isLoading && data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {CATEGORIES.map((cat) => {
                const count = data.counts?.[cat.key];
                const rows = data.samples?.[cat.key] ?? [];
                const hasError = !!data.errors?.[cat.key];
                const open = !!expanded[cat.key];
                return (
                  <Card key={cat.key} className="border-black/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          {tr(cat.en, cat.he)}
                        </CardTitle>
                        {hasError ? (
                          <Badge variant="outline" className="border-black/20 text-black/50">
                            {tr("unavailable", "לא זמין")}
                          </Badge>
                        ) : (
                          <Badge
                            className="text-white"
                            style={{ backgroundColor: count ? GOLD : "#9ca3af" }}
                          >
                            {count ?? "—"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-black/50">{tr(cat.descEn, cat.descHe)}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {!hasError && rows.length > 0 && (
                        <>
                          <button
                            onClick={() => toggle(cat.key)}
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: GOLD }}
                          >
                            {open ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5" />
                                {tr("Hide sample", "הסתר דוגמה")}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5" />
                                {tr(`Show sample (${rows.length})`, `הצג דוגמה (${rows.length})`)}
                              </>
                            )}
                          </button>
                          {open && (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-black/40">
                                    {Object.keys(rows[0]).map((k) => (
                                      <th key={k} className="px-2 py-1 text-start font-medium">{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, i) => (
                                    <tr key={i} className="border-t border-black/5">
                                      {Object.keys(rows[0]).map((k) => (
                                        <td key={k} className="px-2 py-1 text-black/70" dir="auto">
                                          {fmt(row[k])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {data.heuristics?.sampleCap != null && rows.length >= data.heuristics.sampleCap && (
                                <p className="mt-2 text-[10px] text-black/40">
                                  {tr(
                                    `Sample capped at ${data.heuristics.sampleCap}.`,
                                    `דוגמה מוגבלת ל-${data.heuristics.sampleCap}.`,
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {!hasError && rows.length === 0 && (
                        <p className="text-xs text-black/40">{tr("No one in this audience.", "אין אף אחד בקהל זה.")}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Heuristics footnote */}
            {data.heuristics && (
              <p className="mt-6 text-xs text-black/45 leading-relaxed">
                {tr(
                  `Heuristics (configurable): due after ${data.heuristics.reminderDueDays} days since last wash · package almost empty at ${data.heuristics.packageAlmostEmptyUnits} credit · birthday look-ahead ${data.heuristics.birthdayLookaheadDays} days. These are estimates, not medical advice.`,
                  `כללי אצבע (ניתנים להגדרה): "מועד לרחצה" אחרי ${data.heuristics.reminderDueDays} ימים מהרחצה האחרונה · "חבילה כמעט ריקה" ב-${data.heuristics.packageAlmostEmptyUnits} רחצה · חלון יום הולדת ${data.heuristics.birthdayLookaheadDays} ימים. אלו הערכות, לא ייעוץ וטרינרי.`,
                )}
              </p>
            )}
            <p className="mt-1 text-[10px] text-black/35">
              {tr("Generated", "נוצר")} {fmt(data.generatedAt)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
