import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle2, RefreshCw, ChevronLeft,
  Wallet, Clock, Zap, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  wallet_balance:   "ארנק מזומן",
  gift_credit:      "כרטיס מתנה",
  wash_package:     "חבילת שטיפות",
  loyalty_benefit:  "הטבת נאמנות",
  promo_coupon:     "קופון פרומו",
};

export default function AdminCompensation() {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/compensation/pending"],
    queryFn: () => fetch("/api/octopus/v1/compensation/pending").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const pending: any[] = data?.pending ?? [];

  const compensate = useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest("POST", `/api/octopus/v1/compensation/${sessionId}`),
    onSuccess: (res: any, sessionId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/octopus/v1/compensation/pending"] });
      setConfirming(null);
      const body = res as any;
      toast({
        title: "פיצוי הוחזר בהצלחה",
        description: `₪${body?.refundILS ?? "?"} הוחזרו לארנק לקוח · TXN: ${body?.txnId ?? "—"}`,
      });
    },
    onError: (err: any) => {
      setConfirming(null);
      toast({ title: "שגיאה בפיצוי", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/20" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/stations">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                תחנות
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">פיצויים ממתינים — K9000</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                סשנים שנכשלה הפעלת המשאבה לאחר חיוב ארנק
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <Badge className={cn("text-xs", pending.length > 0 ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800")}>
                {pending.length > 0 ? `${pending.length} ממתינים` : "הכל תקין"}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              רענן
            </Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-xs text-amber-800">
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1.5 mb-0.5" />
          <strong>הסבר:</strong> פיצוי מופעל כאשר הלקוח שילם מהארנק אך משאבת K9000 לא אושרה לאחר כל הניסיונות.
          ״הפעלת פיצוי״ מחזיר את הסכום לארנק בפעולה אטומית אידמפוטנטית — ביצוע כפול בטוח.
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : pending.length === 0 ? (
          <Card className="border-emerald-100">
            <CardContent className="pt-10 pb-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">אין פיצויים ממתינים</p>
              <p className="text-xs text-gray-400 mt-1">כל הסשנים שנכשלו כבר טופלו</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((item: any) => (
              <Card key={item.sessionId} className="border-orange-100 bg-white">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-orange-100 text-orange-800 text-[10px]">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          פיצוי נדרש
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {item.sessionStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Wallet className="h-3 w-3" />
                          <span className="font-semibold text-gray-900">₪{item.amountILS}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <User className="h-3 w-3" />
                          <span className="font-mono truncate max-w-[100px]" title={item.userId}>{item.userId}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Zap className="h-3 w-3" />
                          <span>{item.stationId} / {item.bayId?.split("-").slice(-1)[0]}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{item.startedAt ? new Date(item.startedAt).toLocaleString("he-IL") : "—"}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-400 font-mono">
                        סשן: {item.sessionId}
                        {item.commandId && <span className="mr-2">· פקודה: {item.commandId}</span>}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {confirming === item.sessionId ? (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            className="text-xs bg-orange-600 hover:bg-orange-700 gap-1.5"
                            onClick={() => compensate.mutate(item.sessionId)}
                            disabled={compensate.isPending}
                          >
                            {compensate.isPending ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wallet className="h-3 w-3" />
                            )}
                            אישור — החזר ₪{item.amountILS}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => setConfirming(null)}
                            disabled={compensate.isPending}
                          >
                            ביטול
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                          onClick={() => setConfirming(item.sessionId)}
                        >
                          <Wallet className="h-3 w-3" />
                          הפעל פיצוי
                        </Button>
                      )}
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
