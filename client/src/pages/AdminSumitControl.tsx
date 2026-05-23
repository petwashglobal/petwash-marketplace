import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "off" | "email" | "api" | "csv_export";

type HealthResponse = {
  mode: Mode;
  flags: { parent: boolean; send: boolean };
  env: {
    sumitApiKey: boolean;
    sumitCompanyId: boolean;
    sumitWebhookSecret: boolean;
    accountantEmail: boolean;
    sendgridApiKey: boolean;
  };
  counts: Record<string, number>;
  sumitApiBaseUrl: string;
  accountantEmailDomain: string | null;
};

const MODE_LABEL_HE: Record<Mode, string> = {
  off: "כבוי — ברירת מחדל בטוחה",
  email: "אימייל לרו״ח",
  api: "API ישיר (sumit.co.il)",
  csv_export: "ייצוא CSV ידני",
};

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
      )}
      <span className={cn(ok ? "text-gray-900" : "text-gray-500")}>{label}</span>
    </div>
  );
}

function CountChip({ label, value }: { label: string; value: number | undefined }) {
  const v = value ?? 0;
  return (
    <div className="flex flex-col items-end font-mono">
      <span className="text-lg font-medium text-gray-900">{v}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

export default function AdminSumitControl() {
  const { data, isLoading } = useQuery<HealthResponse>({
    queryKey: ["/api/admin/sumit/health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sumit/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-orange-50/20"
      dir="rtl"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                אדמין
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gray-400" />
                בקרת SUMIT
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                מצב הפעלה · דגלים · נוכחות סודות · ספירת חשבוניות
              </p>
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : (
          <>
            <Card
              className={cn(
                "mb-4",
                data.mode === "off"
                  ? "border-slate-200 bg-slate-50"
                  : "border-emerald-200 bg-emerald-50",
              )}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[11px] text-gray-500">מצב נוכחי</div>
                    <div className="text-lg font-medium">{MODE_LABEL_HE[data.mode]}</div>
                  </div>
                  <Badge
                    className={cn(
                      "text-xs",
                      data.mode === "off"
                        ? "bg-slate-200 text-slate-800"
                        : "bg-emerald-200 text-emerald-900",
                    )}
                  >
                    {data.mode}
                  </Badge>
                </div>
                {data.mode === "off" && (
                  <div className="mt-3 text-xs text-gray-700 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      כל שליחה ל-SUMIT חסומה. לא נשלחות חשבוניות עד שמצב הפעלה משתנה ל-email
                      או api דרך SystemConfig.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-4 border-slate-200">
              <CardContent className="pt-5 pb-5 space-y-2">
                <div className="text-sm font-medium mb-1">דגלים פעילים</div>
                <StatusDot
                  ok={data.flags.parent}
                  label="ff.supplier_invoice_control.enabled"
                />
                <StatusDot
                  ok={data.flags.send}
                  label="ff.supplier_invoice_control.sumit_send.enabled"
                />
              </CardContent>
            </Card>

            <Card className="mb-4 border-slate-200">
              <CardContent className="pt-5 pb-5 space-y-2">
                <div className="text-sm font-medium mb-1">סודות (נוכחות בלבד — ערכים לא מוצגים)</div>
                <StatusDot ok={data.env.sumitApiKey} label="SUMIT_API_KEY" />
                <StatusDot ok={data.env.sumitCompanyId} label="SUMIT_COMPANY_ID" />
                <StatusDot ok={data.env.sumitWebhookSecret} label="SUMIT_WEBHOOK_SECRET" />
                <StatusDot ok={data.env.accountantEmail} label="ACCOUNTANT_EMAIL" />
                <StatusDot ok={data.env.sendgridApiKey} label="SENDGRID_API_KEY" />
                {data.accountantEmailDomain && (
                  <div className="text-[11px] text-gray-500 mt-2">
                    דומיין רו״ח מוגדר: <span className="font-mono">{data.accountantEmailDomain}</span>
                  </div>
                )}
                <div className="text-[11px] text-gray-500 mt-1">
                  Base URL: <span className="font-mono">{data.sumitApiBaseUrl}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-5 pb-5">
                <div className="text-sm font-medium mb-3">סיכום חשבוניות לפי סטטוס SUMIT</div>
                <div className="grid grid-cols-5 gap-3">
                  <CountChip label="not_sent" value={data.counts.not_sent} />
                  <CountChip label="pending" value={data.counts.pending} />
                  <CountChip label="sent" value={data.counts.sent} />
                  <CountChip label="confirmed" value={data.counts.confirmed} />
                  <CountChip label="failed" value={data.counts.failed} />
                </div>
                <div className="mt-4 text-[11px] text-gray-500">
                  לרשימה מלאה ולפעולת שליחה לחץ:
                  <Link href="/admin/supplier-invoices">
                    <a className="text-blue-700 hover:underline mr-1">חשבוניות ספקים</a>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
