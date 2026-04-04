import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp, Wallet, CheckCircle2, Clock, XCircle,
  ChevronLeft, RefreshCw, AlertCircle, ArrowDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  completed:   { color: "bg-green-100 text-green-800",  label: "הושלם",    icon: CheckCircle2 },
  in_progress: { color: "bg-blue-100 text-blue-800",    label: "בתהליך",   icon: Clock },
  confirmed:   { color: "bg-blue-100 text-blue-800",    label: "מאושר",    icon: Clock },
  pending:     { color: "bg-yellow-100 text-yellow-800",label: "ממתין",    icon: Clock },
  cancelled:   { color: "bg-white text-gray-600",    label: "בוטל",     icon: XCircle },
  declined:    { color: "bg-white text-gray-600",    label: "נדחה",     icon: XCircle },
  disputed:    { color: "bg-red-100 text-red-700",      label: "במחלוקת",  icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "bg-white text-gray-600", label: status, icon: Clock };
  return <Badge className={cn("text-xs gap-1", cfg.color)}>{cfg.label}</Badge>;
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", highlight ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5", highlight ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-xl font-bold", highlight && "text-primary")}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderTimeline() {
  const { user } = useFirebaseAuth();
  const providerId = user?.uid;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/timeline/provider", providerId],
    queryFn: () => fetch(`/api/octopus/v1/timeline/provider/${providerId}`).then(r => r.json()),
    enabled: !!providerId,
  });

  const summary = data?.summary ?? {};
  const bookings = data?.bookings ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/provider/dashboard">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            לוח בקרה
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ציר זמן רווחים</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <StatCard icon={TrendingUp}   label="סה״כ רווחים"       value={`₪${summary.totalEarnedILS ?? "0.00"}`} highlight />
          <StatCard icon={Wallet}       label="ממתין לתשלום"       value={`₪${summary.pendingPayoutILS ?? "0.00"}`} />
          <StatCard icon={CheckCircle2} label="הזמנות שהושלמו"    value={String(summary.completedBookings ?? 0)} />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            כל ההזמנות ({bookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : bookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">אין הזמנות עדיין</p>
          ) : (
            <div className="divide-y">
              {bookings.map((b: any) => (
                <div key={b.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.serviceType}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.startDate ? new Date(b.startDate).toLocaleDateString("he-IL") : "—"}
                        {" · "}
                        {b.id}
                      </p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">ברוטו</span>
                      <span className="font-medium">₪{b.grossILS}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">עמלה: ₪{b.platformFeeILS}</div>
                    <div className="font-bold text-primary text-sm">נטו: ₪{b.netPayoutILS}</div>
                    {b.payoutReleased
                      ? <Badge className="text-xs bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />שולם</Badge>
                      : b.status === 'completed'
                        ? <Badge className="text-xs bg-yellow-100 text-yellow-800 gap-1"><Clock className="h-3 w-3" />ממתין</Badge>
                        : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-4">
        * תצוגה תפעולית. אמת המידה הפיננסית היא בדוחות הכספיים.
      </p>
    </div>
  );
}
