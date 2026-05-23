import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Receipt,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RiskLevel = "green" | "yellow" | "red";

type Invoice = {
  id: number;
  supplierId: number | null;
  fileUrl: string | null;
  fileHash: string;
  ocrSupplierName: string | null;
  ocrBusinessNumber: string | null;
  ocrInvoiceDate: string | null;
  ocrAmountBeforeVat: string | null;
  ocrVatAmount: string | null;
  ocrTotalAmount: string | null;
  ocrCurrency: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  status: string;
  fraudEngineScore: number | null;
  fraudEngineFlags: string[] | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  approvalNote: string | null;
  createdAt: string;
};

type Check = {
  id: number;
  invoiceId: number;
  checkType: string;
  result: "pass" | "warning" | "fail";
  scoreImpact: number;
  details: Record<string, unknown> | null;
};

type DetailResponse = { invoice: Invoice; checks: Check[] };

const CHECK_LABEL_HE: Record<string, string> = {
  exact_duplicate_file: "קובץ כפול בדיוק",
  duplicate_invoice_number: "מספר חשבונית כבר קיים לספק זה",
  business_number_mismatch: "מספר עוסק לא תואם",
  supplier_name_mismatch: "שם ספק לא תואם",
  bank_mismatch: "חשבון בנק לא תואם",
  bank_missing_from_invoice: "חשבון בנק לא מופיע על החשבונית",
  vat_math_mismatch: "אי-התאמה בחישוב מע״מ",
  high_amount: "סכום חריג",
  ocr_unavailable: "OCR לא זמין",
  fraud_engine_unavailable: "מנוע סיכון לא זמין",
  fraud_engine_score: "מנוע סיכון העלה דגל",
  shaam_allocation_missing: "חסר מספר הקצאה (חובה ע״פ חוק 2026)",
  osek_vat_mismatch: "מע״מ לא תואם לסיווג ספק",
  osek_classification_unknown: "ספק לא מסווג — סווג לפני אישור",
};

function StatusBadge({ status, level }: { status: string; level: RiskLevel }) {
  const color =
    level === "red"
      ? "bg-red-100 text-red-800"
      : level === "yellow"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800";
  return <Badge className={cn("text-xs", color)}>{status}</Badge>;
}

function CheckRow({ check }: { check: Check }) {
  const Icon =
    check.result === "fail"
      ? XCircle
      : check.result === "warning"
      ? AlertTriangle
      : CheckCircle2;
  const tint =
    check.result === "fail"
      ? "text-red-600"
      : check.result === "warning"
      ? "text-amber-600"
      : "text-emerald-600";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", tint)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900">
          {CHECK_LABEL_HE[check.checkType] ?? check.checkType}
        </div>
        {check.details && Object.keys(check.details).length > 0 && (
          <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
            {JSON.stringify(check.details)}
          </div>
        )}
      </div>
      <div className="text-[10px] text-gray-400 shrink-0 self-center">
        +{check.scoreImpact}
      </div>
    </div>
  );
}

export default function AdminSupplierInvoiceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [confirming, setConfirming] = useState<null | "approve" | "reject">(null);

  const { data, isLoading, refetch } = useQuery<DetailResponse>({
    queryKey: [`/api/supplier-invoices/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/supplier-invoices/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: Number.isInteger(id) && id > 0,
  });

  const approve = useMutation({
    mutationFn: () => apiRequest("POST", `/api/supplier-invoices/${id}/approve`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier-invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      setConfirming(null);
      setNote("");
      toast({ title: "החשבונית אושרה" });
    },
    onError: (err: any) => {
      setConfirming(null);
      toast({ title: "אישור נדחה", description: err.message, variant: "destructive" });
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/supplier-invoices/${id}/reject`, { reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier-invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      setConfirming(null);
      setRejectReason("");
      toast({ title: "החשבונית נדחתה" });
    },
    onError: (err: any) => {
      setConfirming(null);
      toast({ title: "דחייה נכשלה", description: err.message, variant: "destructive" });
    },
  });

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" dir="rtl">
        <Card><CardContent className="pt-6 pb-6">מס&apos; חשבונית לא תקין</CardContent></Card>
      </div>
    );
  }

  const invoice = data?.invoice;
  const checks = data?.checks ?? [];
  const isTerminal =
    invoice && (invoice.status === "rejected" || invoice.status === "ready_for_accountant");

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
            <Link href="/admin/supplier-invoices">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                חזרה לרשימה
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gray-400" />
                חשבונית #{id}
              </h1>
            </div>
          </div>
          {invoice && <StatusBadge status={invoice.status} level={invoice.riskLevel} />}
        </div>

        {isLoading || !invoice ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : (
          <>
            <Card className="mb-4 border-slate-200">
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] text-gray-500">ספק</div>
                    <div className="font-medium">
                      {invoice.ocrSupplierName ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">ח.פ / עוסק</div>
                    <div className="font-mono text-sm">
                      {invoice.ocrBusinessNumber ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">תאריך חשבונית</div>
                    <div>{invoice.ocrInvoiceDate ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">סה״כ</div>
                    <div className="font-mono font-medium">
                      {invoice.ocrTotalAmount
                        ? `₪${Number(invoice.ocrTotalAmount).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">מע״מ</div>
                    <div className="font-mono">
                      {invoice.ocrVatAmount
                        ? `₪${Number(invoice.ocrVatAmount).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">ציון סיכון</div>
                    <div className="font-mono">{invoice.riskScore}/100</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">קובץ מקור</div>
                    {invoice.fileUrl ? (
                      <a
                        className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
                        href={invoice.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        פתח <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-4 border-slate-200">
              <CardContent className="pt-3 pb-3">
                <div className="text-xs font-medium text-gray-700 mb-1 px-1">
                  ממצאי הסינון
                </div>
                {checks.length === 0 ? (
                  <div className="text-xs text-gray-500 px-1 py-3">
                    אין ממצאים — חשבונית עברה את כל הבדיקות
                  </div>
                ) : (
                  <div className="px-1">
                    {checks.map((c) => (
                      <CheckRow key={c.id} check={c} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {!isTerminal && (
              <Card className="border-slate-200">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div>
                    <Label className="text-xs text-gray-500">
                      הערה לאישור (חובה לסיכון YELLOW)
                    </Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="לדוגמה: אומת מול הספק טלפונית"
                      className="mt-1 text-sm"
                      rows={2}
                    />
                    <Button
                      variant="default"
                      className="mt-2 w-full sm:w-auto"
                      onClick={() => setConfirming("approve")}
                      disabled={approve.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      אישור החשבונית
                    </Button>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <Label className="text-xs text-gray-500">סיבת דחייה</Label>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="לדוגמה: כפל מע״מ"
                      className="mt-1 text-sm"
                    />
                    <Button
                      variant="destructive"
                      className="mt-2 w-full sm:w-auto"
                      onClick={() => setConfirming("reject")}
                      disabled={reject.isPending || !rejectReason.trim()}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      דחיית החשבונית
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {confirming === "approve" && (
              <Card className="mt-4 border-emerald-200 bg-emerald-50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm">לאשר את החשבונית?</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                      כן, אשר
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                      ביטול
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {confirming === "reject" && (
              <Card className="mt-4 border-red-200 bg-red-50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm">לדחות את החשבונית? פעולה זו תירשם ביומן הביקורת.</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
                      כן, דחה
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                      ביטול
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {invoice.approvedAt && (
              <div className="mt-4 text-xs text-emerald-700">
                ✓ אושר ע&quot;י {invoice.approvedBy ?? "—"} בתאריך {new Date(invoice.approvedAt).toLocaleString("he-IL")}
                {invoice.approvalNote && <div className="mt-1 text-gray-600">הערה: {invoice.approvalNote}</div>}
              </div>
            )}
            {invoice.rejectedAt && (
              <div className="mt-4 text-xs text-red-700">
                ✕ נדחה ע&quot;י {invoice.rejectedBy ?? "—"} בתאריך {new Date(invoice.rejectedAt).toLocaleString("he-IL")}
                {invoice.rejectionReason && <div className="mt-1 text-gray-600">סיבה: {invoice.rejectionReason}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
