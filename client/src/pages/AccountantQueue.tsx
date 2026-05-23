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
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  RefreshCw,
  Receipt,
  ChevronLeft,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RiskLevel = "green" | "yellow" | "red";

type Invoice = {
  id: number;
  supplierId: number | null;
  ocrSupplierName: string | null;
  ocrInvoiceNumber: string | null;
  ocrInvoiceDate: string | null;
  ocrTotalAmount: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  status: string;
  sumitDocumentId: string | null;
  sumitStatus: "pending" | "sent" | "confirmed" | "failed" | null;
  createdAt: string;
};

type QueueResponse = { rows: Invoice[] };

function RiskBadge({ level }: { level: RiskLevel }) {
  const cls =
    level === "red"
      ? "bg-red-100 text-red-800"
      : level === "yellow"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800";
  return <Badge className={cn("text-[10px] font-medium", cls)}>{level}</Badge>;
}

function MarkEnteredForm({
  invoiceId,
  onSuccess,
}: {
  invoiceId: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [docId, setDocId] = useState("");
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/accountant/invoices/${invoiceId}/mark-entered-in-sumit`, {
        sumitDocumentId: docId.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accountant/queue"] });
      toast({ title: "סומן כהוזן ל-SUMIT" });
      setDocId("");
      setNote("");
      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "פעולה נכשלה",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          placeholder="מס׳ מסמך SUMIT (אופציונלי)"
          className="h-8 text-xs"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה (אופציונלי)"
          className="h-8 text-xs sm:col-span-2"
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="h-8 text-xs gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {mut.isPending ? "סומן…" : "סמן כהוזן ל-SUMIT"}
        </Button>
      </div>
    </div>
  );
}

export default function AccountantQueue() {
  const { data, isLoading, isFetching, refetch } = useQuery<QueueResponse>({
    queryKey: ["/api/accountant/queue"],
    queryFn: async () => {
      const res = await fetch("/api/accountant/queue");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const [openId, setOpenId] = useState<number | null>(null);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                אדמין
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-gray-400" />
                תור רו״ח
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                חשבוניות שמחכות לרישום ידני ב-SUMIT
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
          <Card className="border-emerald-100">
            <CardContent className="pt-10 pb-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">התור ריק — הכל הוזן ב-SUMIT</p>
              <p className="text-xs text-gray-400 mt-1">
                חשבוניות חדשות יופיעו כאן ברגע שהאדמין יאשר אותן
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((inv) => {
              const isOpen = openId === inv.id;
              return (
                <Card key={inv.id} className="border-slate-200">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Receipt className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {inv.ocrSupplierName ?? "ספק לא זוהה"}
                          </span>
                          <RiskBadge level={inv.riskLevel} />
                          {inv.sumitStatus === "failed" && (
                            <Badge className="bg-red-100 text-red-800 text-[10px]">
                              שליחה אוטומטית נכשלה — הזן ידנית
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>חשבונית #{inv.id}</span>
                          {inv.ocrInvoiceNumber && <span>מס׳ {inv.ocrInvoiceNumber}</span>}
                          {inv.ocrInvoiceDate && <span>{inv.ocrInvoiceDate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-left shrink-0">
                          <div className="font-mono text-sm font-medium text-gray-900">
                            {inv.ocrTotalAmount
                              ? `₪${Number(inv.ocrTotalAmount).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isOpen ? "secondary" : "outline"}
                          onClick={() => setOpenId(isOpen ? null : inv.id)}
                          className="h-8 text-xs"
                        >
                          {isOpen ? "סגור" : "סמן הזנה"}
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <MarkEnteredForm
                        invoiceId={inv.id}
                        onSuccess={() => setOpenId(null)}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
