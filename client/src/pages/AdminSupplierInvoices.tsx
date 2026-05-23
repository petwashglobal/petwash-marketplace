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
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Upload,
  Receipt,
  ChevronLeft,
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
  shaamRequired: boolean;
  shaamAllocationNumber: string | null;
  createdAt: string;
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

export default function AdminSupplierInvoices() {
  const { toast } = useToast();
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [supplierIdInput, setSupplierIdInput] = useState("");

  const queryKey = ["/api/supplier-invoices", riskFilter, statusFilter] as const;
  const { data, isLoading, isFetching, refetch } = useQuery<ListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (riskFilter !== "all") params.set("riskLevel", riskFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const qs = params.toString();
      const res = await fetch(`/api/supplier-invoices${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (supplierIdInput.trim()) fd.append("supplierId", supplierIdInput.trim());
      const res = await fetch("/api/supplier-invoices", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
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
      className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-orange-50/20"
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
                          {row.shaamRequired && !row.shaamAllocationNumber && (
                            <Badge className="bg-red-100 text-red-800 text-[10px] font-medium gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              חסר מספר הקצאה
                            </Badge>
                          )}
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
