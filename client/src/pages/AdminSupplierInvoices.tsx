import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import {
  CheckCircle2,
  RefreshCw,
  Upload,
  Receipt,
  ChevronLeft,
  ShieldAlert,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RiskLevel = "green" | "yellow" | "red";

type InvoiceRow = {
  id: number;
  supplierId: number | null;
  ocrSupplierName: string | null;
  ocrInvoiceDate: string | null;
  ocrTotalAmount: string | null;
  ocrCurrency: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  status: string;
  createdAt: string;
  // SHAAM fields land once PR-S5a migration 0026 ships; UI then surfaces
  // the "missing allocation" chip in the row card.
};

type ListResponse = {
  rows: InvoiceRow[];
  limit: number;
  offset: number;
};

const STATUS_LABEL_HE: Record<string, string> = {
  uploaded: "הועלה",
  ocr_processing: "בעיבוד OCR",
  needs_review: "דורש בדיקה",
  ready_for_approval: "מוכן לאישור",
  ready_for_accountant: "מוכן לרו״ח",
  rejected: "נדחה",
  blocked: "חסום",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  if (level === "red") {
    return (
      <Badge className="bg-red-100 text-red-800 text-[10px] font-medium">
        סיכון גבוה
      </Badge>
    );
  }
  if (level === "yellow") {
    return (
      <Badge className="bg-amber-100 text-amber-800 text-[10px] font-medium">
        דורש בדיקה
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-medium">
      תקין
    </Badge>
  );
}

// ── Supplier Fraud Control (spec §20) — READ-ONLY detector surface ──────────
type FraudFlag = {
  key: string;
  invoiceIds: number[];
  reason: { he: string; en: string };
  severity: "high" | "medium";
  error?: boolean;
};

type FraudResponse = {
  flags: FraudFlag[];
  flagCount: number;
  totalFlaggedInvoices: number;
  statusBuckets: Record<string, number>;
  skippedChecks: { key: string; reason: { he: string; en: string } }[];
};

function FraudFlagsSection({ isHe }: { isHe: boolean }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<FraudResponse>({
    // Default authed fetcher (Bearer + App-Check) — bare fetch() with
    // credentials:"same-origin" sent no Bearer → 401 on this admin route. (2026-07-27)
    queryKey: ["/api/admin/supplier-fraud-flags"],
    refetchInterval: 60_000,
  });

  // Honest: render nothing until we have data. No fabricated zero-state.
  if (!data) return null;

  const realFlags = data.flags.filter((f) => !f.error && f.invoiceIds.length > 0);
  const erroredCount = data.flags.filter((f) => f.error).length;
  const flagged = data.totalFlaggedInvoices;

  // Clean state — small green confirmation, no alarm.
  if (realFlags.length === 0 && erroredCount === 0) {
    return (
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-800">
          {isHe
            ? "בקרת הונאת ספקים: לא נמצאו דגלים"
            : "Supplier fraud control: no flags found"}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-right"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm font-medium text-amber-900 truncate">
            {isHe
              ? `בקרת הונאת ספקים: ${realFlags.length} דגלים · ${flagged} חשבוניות`
              : `Supplier fraud control: ${realFlags.length} flags · ${flagged} invoices`}
            {erroredCount > 0 &&
              (isHe
                ? ` · ${erroredCount} בדיקות נכשלו`
                : ` · ${erroredCount} checks failed`)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-amber-600 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {data.flags.map((f, i) => (
            <div
              key={`${f.key}-${i}`}
              className={cn(
                "rounded-md border px-3 py-2 bg-white",
                f.error
                  ? "border-slate-200"
                  : f.severity === "high"
                  ? "border-red-200"
                  : "border-amber-200",
              )}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-800">
                  {isHe ? f.reason.he : f.reason.en}
                </span>
                {!f.error && (
                  <Badge
                    className={cn(
                      "text-[10px] font-medium",
                      f.severity === "high"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {f.severity === "high"
                      ? isHe
                        ? "גבוה"
                        : "High"
                      : isHe
                      ? "בינוני"
                      : "Medium"}
                  </Badge>
                )}
              </div>
              {f.invoiceIds.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {f.invoiceIds.map((id) => (
                    <Link key={id} href={`/admin/supplier-invoices/${id}`}>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer">
                        #{id}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {data.skippedChecks.length > 0 && (
            <div className="pt-1 text-[11px] text-gray-400">
              {isHe ? "בדיקות שלא בוצעו: " : "Checks not run: "}
              {data.skippedChecks
                .map((s) => (isHe ? s.reason.he : s.reason.en))
                .join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSupplierInvoices() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isHe = language === "he";
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [supplierIdInput, setSupplierIdInput] = useState("");

  const params = new URLSearchParams();
  if (riskFilter !== "all") params.set("riskLevel", riskFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  const qs = params.toString();
  // Default authed fetcher (Bearer + App-Check) via full URL in queryKey[0]. A bare
  // fetch() 401'd on this admin route; the module is also gated behind
  // ff.supplier_invoice_control (default OFF) → 404. (2026-07-27)
  const { data, isLoading, isFetching, isError, refetch } = useQuery<ListResponse>({
    queryKey: [`/api/supplier-invoices${qs ? `?${qs}` : ""}`],
    refetchInterval: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (supplierIdInput.trim()) fd.append("supplierId", supplierIdInput.trim());
      // Client-audit D-07 CRIT (2026-08-24): bare fetch used credentials:
      // 'same-origin' with NO Bearer — 401 on any subdomain deploy (staging
      // /prod). Route through apiRequest so Bearer + credentials: 'include'
      // + App Check + 401 retry all apply. FormData bodies are passed as-is
      // (no JSON.stringify — see queryClient.ts:131 special-case).
      const res = await apiRequest("/api/supplier-invoices", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      // The list key is now a single full-URL string ("/api/supplier-invoices?…"),
      // so array-prefix matching no longer works — match by URL prefix instead.
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/supplier-invoices"),
      });
      setUploading(false);
      toast({ title: "החשבונית הועלתה", description: "תוצאת הסינון בטבלה" });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({
        title: "כשל בהעלאה",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    uploadMutation.mutate(f);
    e.target.value = "";
  };

  const rows = data?.rows ?? [];

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-[#D4AF37]/20"
      dir="rtl"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                אדמין
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                חשבוניות ספקים
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                סינון אוטומטי · ע&quot;פ דיני מס ישראל 2026
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            רענן
          </Button>
        </div>

        <Card className="mb-6 border-slate-200">
          <CardContent className="pt-5 pb-5">
            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label htmlFor="supplierId" className="text-xs text-gray-500">
                  מס&apos; ספק (אופציונלי)
                </Label>
                <Input
                  id="supplierId"
                  type="number"
                  inputMode="numeric"
                  value={supplierIdInput}
                  onChange={(e) => setSupplierIdInput(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-gray-500">
                  העלאת חשבונית (PDF / תמונה, עד 15MB)
                </Label>
                <div className="mt-1 flex gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={onFile}
                      disabled={uploading}
                    />
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      disabled={uploading}
                      className="w-full gap-1.5"
                    >
                      <span className="cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {uploading ? "מעלה…" : "בחר קובץ"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <FraudFlagsSection isHe={isHe} />

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500">סיכון</Label>
            <Select
              value={riskFilter}
              onValueChange={(v) => setRiskFilter(v as RiskLevel | "all")}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="green">תקין</SelectItem>
                <SelectItem value="yellow">דורש בדיקה</SelectItem>
                <SelectItem value="red">גבוה</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500">סטטוס</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="ready_for_approval">מוכן לאישור</SelectItem>
                <SelectItem value="needs_review">דורש בדיקה</SelectItem>
                <SelectItem value="blocked">חסום</SelectItem>
                <SelectItem value="ready_for_accountant">מוכן לרו״ח</SelectItem>
                <SelectItem value="rejected">נדחה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          // Gated behind ff.supplier_invoice_control (default OFF) → API 404s. Never
          // show the green "no invoices ✅" all-clear on a failed load — it reads as
          // "clean" when the module is simply off.
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-10 pb-10 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="text-amber-900 font-medium">מודול חשבוניות הספקים אינו פעיל</p>
              <p className="text-xs text-amber-700 mt-1" dir="ltr">
                Supplier-invoice module is off (feature flag) or failed to load — NOT
                an all-clear. Enable ff.supplier_invoice_control to use it.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3" />
                נסה שוב
              </Button>
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="border-emerald-100">
            <CardContent className="pt-10 pb-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">אין חשבוניות תואמות</p>
              <p className="text-xs text-gray-400 mt-1">
                התאם את המסננים או העלה חשבונית חדשה
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Link key={row.id} href={`/admin/supplier-invoices/${row.id}`}>
                <Card className="border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Receipt className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {row.ocrSupplierName ?? "ספק לא זוהה"}
                          </span>
                          <RiskBadge level={row.riskLevel} />
                          {/* "חסר מספר הקצאה" chip lands once PR-S5a is on main. */}
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>חשבונית #{row.id}</span>
                          {row.supplierId != null && <span>ספק #{row.supplierId}</span>}
                          {row.ocrInvoiceDate && <span>{row.ocrInvoiceDate}</span>}
                          <span>
                            {STATUS_LABEL_HE[row.status] ?? row.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm font-medium text-gray-900">
                          {row.ocrTotalAmount
                            ? `₪${Number(row.ocrTotalAmount).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          ציון: {row.riskScore}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
