import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
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
  ChevronLeft,
  Building2,
  Save,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Osek = "unknown" | "patur" | "murshe" | "chevra";

type Supplier = {
  id: number;
  companyName: string;
  legalName: string | null;
  taxId: string | null;
  supplierType: string;
  country: string;
  primaryContact: string;
  email: string;
  phone: string | null;
  paymentTerms: string | null;
  preferredCurrency: string | null;
  isActive: boolean | null;
  isApproved: boolean | null;
  osekClassification: Osek;
  osekCertificateUrl: string | null;
  osekClassificationVerifiedAt: string | null;
  osekClassificationVerifiedBy: string | null;
  onboardedAt: string;
  createdAt: string;
  updatedAt: string;
};

const OSEK_LABEL_HE: Record<Osek, string> = {
  unknown: "לא מסווג",
  patur: "עוסק פטור",
  murshe: "עוסק מורשה",
  chevra: "חברה בע״מ",
};

const OSEK_HELP_HE: Record<Osek, string> = {
  unknown: "סטטוס לא קבוע — חשבוניות מסומנות אזהרה עד לסיווג.",
  patur:
    "עוסק פטור: לא רשאי לחייב מע״מ. חשבונית עם מע״מ > 0 מספק זה נחסמת אוטומטית כדי למנוע הפסד.",
  murshe:
    "עוסק מורשה (יחיד או שותפות): גובה ומקזז מע״מ. אישור על מס תשומות נדרש.",
  chevra:
    "חברה בע״מ: גובה ומקזז מע״מ. ניכוי מס במקור וטופס 857 שונים מעוסק מורשה.",
};

function OsekBadge({ value }: { value: Osek }) {
  const cls =
    value === "unknown"
      ? "bg-amber-100 text-amber-800"
      : value === "patur"
      ? "bg-blue-100 text-blue-800"
      : value === "chevra"
      ? "bg-purple-100 text-purple-800"
      : "bg-emerald-100 text-emerald-800";
  return <Badge className={cn("text-[10px] font-medium", cls)}>{OSEK_LABEL_HE[value]}</Badge>;
}

export default function AdminSupplierDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const [classification, setClassification] = useState<Osek>("unknown");
  const [certUrl, setCertUrl] = useState<string>("");

  const { data, isLoading } = useQuery<Supplier>({
    queryKey: [`/api/admin/suppliers/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suppliers/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: Number.isInteger(id) && id > 0,
  });

  // Seed local form state once data loads — don't reset on every re-fetch
  // since that would clobber an in-progress edit.
  useEffect(() => {
    if (data) {
      setClassification(data.osekClassification);
      setCertUrl(data.osekCertificateUrl ?? "");
    }
  }, [data?.id]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/admin/suppliers/${id}/osek-classification`, {
        osekClassification: classification,
        certificateUrl: certUrl.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/suppliers/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
      toast({ title: "סיווג נשמר" });
    },
    onError: (err: any) => {
      toast({ title: "שמירה נכשלה", description: err.message, variant: "destructive" });
    },
  });

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" dir="rtl">
        <Card><CardContent className="pt-6 pb-6">מס&apos; ספק לא תקין</CardContent></Card>
      </div>
    );
  }

  const supplier = data;
  const isDirty =
    !!supplier &&
    (classification !== supplier.osekClassification ||
      (certUrl.trim() || null) !== (supplier.osekCertificateUrl ?? null));

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
            <Link href="/admin/suppliers">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                חזרה לרשימה
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                {supplier?.companyName ?? `ספק #${id}`}
              </h1>
            </div>
          </div>
          {supplier && <OsekBadge value={supplier.osekClassification} />}
        </div>

        {isLoading || !supplier ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : (
          <>
            <Card className="mb-4 border-slate-200">
              <CardContent className="pt-5 pb-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] text-gray-500">שם משפטי</div>
                    <div>{supplier.legalName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">ח.פ / ת.ז</div>
                    <div className="font-mono">{supplier.taxId ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">סוג ספק</div>
                    <div>{supplier.supplierType}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">מדינה</div>
                    <div>{supplier.country}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">איש קשר</div>
                    <div>{supplier.primaryContact}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">דוא״ל</div>
                    <div className="truncate">{supplier.email}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">תנאי תשלום</div>
                    <div>{supplier.paymentTerms ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">מטבע</div>
                    <div>{supplier.preferredCurrency ?? "ILS"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-5 pb-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <div className="text-sm font-medium">סיווג מס ישראל</div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">סיווג עוסק</Label>
                  <Select
                    value={classification}
                    onValueChange={(v) => setClassification(v as Osek)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">לא מסווג</SelectItem>
                      <SelectItem value="patur">עוסק פטור</SelectItem>
                      <SelectItem value="murshe">עוסק מורשה</SelectItem>
                      <SelectItem value="chevra">חברה בע״מ</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                    {OSEK_HELP_HE[classification]}
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-gray-500">
                    כתובת אישור (אסמכתא מרשות המסים — אופציונלי)
                  </Label>
                  <Input
                    value={certUrl}
                    onChange={(e) => setCertUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 h-9 text-sm font-mono"
                  />
                  {supplier.osekCertificateUrl && (
                    <a
                      className="mt-1 text-[11px] text-blue-700 hover:underline inline-flex items-center gap-1"
                      href={supplier.osekCertificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      פתח אישור נוכחי <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-gray-500">
                    {supplier.osekClassificationVerifiedAt
                      ? `אומת ע״י ${supplier.osekClassificationVerifiedBy ?? "—"} בתאריך ${new Date(supplier.osekClassificationVerifiedAt).toLocaleDateString("he-IL")}`
                      : "טרם אומת"}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => save.mutate()}
                    disabled={!isDirty || save.isPending}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {save.isPending ? "שומר…" : "שמור"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
