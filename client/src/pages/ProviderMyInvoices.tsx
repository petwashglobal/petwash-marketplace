import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  RefreshCw,
  Receipt,
  ChevronLeft,
  Clock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RiskLevel = "green" | "yellow" | "red";
type SumitStatus = "pending" | "sent" | "confirmed" | "failed" | null;

type InvoiceRow = {
  id: number;
  supplierId: number | null;
  ocrSupplierName: string | null;
  ocrInvoiceNumber: string | null;
  ocrInvoiceDate: string | null;
  ocrTotalAmount: string | null;
  ocrCurrency: string | null;
  status: string;
  riskLevel: RiskLevel;
  sumitDocumentId: string | null;
  sumitStatus: SumitStatus;
  sumitSentAt: string | null;
  sumitConfirmedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type ListResponse = { rows: InvoiceRow[]; limit: number; offset: number };

const STATUS_HE: Record<string, string> = {
  uploaded: "התקבל",
  ocr_processing: "בעיבוד",
  needs_review: "בבדיקה",
  ready_for_approval: "ממתין לאישור",
  ready_for_accountant: "אושר לרישום",
  rejected: "נדחה",
  blocked: "חסום — בדיקה נוספת",
};

function StatusLine({ inv }: { inv: InvoiceRow }) {
  // Translate the combined status + sumit_status into a single,
  // provider-friendly Hebrew line. Providers don't care about the
  // internal pipeline names; they care: "where is my invoice now?"
  if (inv.status === "rejected") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        נדחה{inv.rejectionReason ? ` — ${inv.rejectionReason}` : ""}
      </div>
    );
  }
  if (inv.sumitStatus === "confirmed") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        נרשם ב-SUMIT{inv.sumitDocumentId ? ` · ${inv.sumitDocumentId}` : ""}
      </div>
    );
  }
  if (inv.sumitStatus === "sent") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-700">
        <Clock className="h-3.5 w-3.5" />
        נשלח לרו״ח — ממתין לאישור
      </div>
    );
  }
  if (inv.status === "ready_for_accountant") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        אושר — ממתין לרישום אצל הרו״ח
      </div>
    );
  }
  if (inv.status === "blocked") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        חסום — מחכה לבדיקת אדמין
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <Clock className="h-3.5 w-3.5" />
      {STATUS_HE[inv.status] ?? inv.status}
    </div>
  );
}

export default function ProviderMyInvoices() {
  const { data, isLoading, isFetching, refetch } = useQuery<ListResponse>({
    queryKey: ["/api/provider/my-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/provider/my-invoices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];

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
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                בית
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gray-400" />
                החשבוניות שלי
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                סטטוס הרישום אצל הרו״ח של PetWash
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

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="pt-10 pb-10 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">עדיין אין חשבוניות במערכת</p>
              <p className="text-xs text-gray-400 mt-1">
                ברגע שהאדמין יעלה חשבונית מטעמך — תופיע כאן יחד עם הסטטוס שלה
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((inv) => (
              <Card key={inv.id} className="border-slate-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Receipt className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {inv.ocrSupplierName ?? "ספק לא זוהה"}
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px] font-medium",
                            inv.riskLevel === "red"
                              ? "bg-red-100 text-red-800"
                              : inv.riskLevel === "yellow"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {inv.riskLevel === "red"
                            ? "סיכון"
                            : inv.riskLevel === "yellow"
                            ? "בדיקה"
                            : "תקין"}
                        </Badge>
                      </div>
                      <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>חשבונית #{inv.id}</span>
                        {inv.ocrInvoiceNumber && <span>מס׳ {inv.ocrInvoiceNumber}</span>}
                        {inv.ocrInvoiceDate && <span>{inv.ocrInvoiceDate}</span>}
                      </div>
                      <div className="mt-2">
                        <StatusLine inv={inv} />
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-mono text-sm font-medium text-gray-900">
                        {inv.ocrTotalAmount
                          ? `₪${Number(inv.ocrTotalAmount).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
