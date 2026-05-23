import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
import {
  CheckCircle2,
  RefreshCw,
  Building2,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Osek = "unknown" | "patur" | "murshe" | "chevra";

type SupplierRow = {
  id: number;
  companyName: string;
  legalName: string | null;
  taxId: string | null;
  supplierType: string;
  country: string;
  isActive: boolean | null;
  isApproved: boolean | null;
  osekClassification: Osek;
  osekClassificationVerifiedAt: string | null;
  createdAt: string;
};

type ListResponse = { rows: SupplierRow[]; limit: number; offset: number };

const OSEK_LABEL_HE: Record<Osek, string> = {
  unknown: "לא מסווג",
  patur: "עוסק פטור",
  murshe: "עוסק מורשה",
  chevra: "חברה בע״מ",
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

export default function AdminSuppliers() {
  const [filter, setFilter] = useState<Osek | "all">("all");
  const [search, setSearch] = useState("");

  const queryKey = ["/api/admin/suppliers", filter, search] as const;
  const { data, isLoading, isFetching, refetch } = useQuery<ListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("osekClassification", filter);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const res = await fetch(`/api/admin/suppliers${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const unknownCount = rows.filter((r) => r.osekClassification === "unknown").length;

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
              <h1 className="text-xl font-semibold text-gray-900">ספקים</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                סיווג עוסק עפ״י דיני מס ישראל — נדרש לפני אישור חשבונית
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

        {unknownCount > 0 && filter !== "patur" && filter !== "murshe" && filter !== "chevra" && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="pt-3 pb-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <strong>{unknownCount}</strong> ספקים ללא סיווג. סווג כל ספק לפני אישור החשבוניות שלו —
                סיווג שגוי עלול לגרום לאיבוד מע״מ.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs text-gray-500">חיפוש לפי שם</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="שם חברה / ספק"
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">סיווג</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as Osek | "all")}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="unknown">לא מסווג</SelectItem>
                <SelectItem value="patur">עוסק פטור</SelectItem>
                <SelectItem value="murshe">עוסק מורשה</SelectItem>
                <SelectItem value="chevra">חברה בע״מ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-emerald-100">
            <CardContent className="pt-10 pb-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">אין ספקים תואמים</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Link key={row.id} href={`/admin/suppliers/${row.id}`}>
                <Card className="border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-sm truncate">{row.companyName}</span>
                          <OsekBadge value={row.osekClassification} />
                          {row.isActive === false && (
                            <Badge className="bg-slate-100 text-slate-600 text-[10px]">לא פעיל</Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>ספק #{row.id}</span>
                          {row.taxId && <span>ח.פ. {row.taxId}</span>}
                          <span>{row.supplierType}</span>
                          <span>{row.country}</span>
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
