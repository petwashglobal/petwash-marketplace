import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, TrendingUp, Droplets, ChevronLeft, RefreshCw,
  Clock, User, ShieldOff, Wifi, GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  terminal_card:    "כרטיס טרמינל",
  wash_package:     "חבילת שטיפה",
  wallet_balance:   "ארנק",
  gift_credit:      "מתנה",
  loyalty_benefit:  "הטבת נאמנות",
  promo_coupon:     "קוד פרומו",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  active:    "bg-blue-100 text-blue-800",
  cleanup:   "bg-yellow-100 text-yellow-800",
  pending:   "bg-white text-gray-700",
  timed_out: "bg-orange-100 text-orange-800",
  aborted:   "bg-red-100 text-red-800",
  fault:     "bg-red-200 text-red-900",
};

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StationTimeline() {
  const params = useParams<{ stationId: string }>();
  const stationId = params.stationId;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/timeline/station", stationId],
    queryFn: () => fetch(`/api/octopus/v1/timeline/station/${stationId}`).then(r => r.json()),
    enabled: !!stationId,
    refetchInterval: 30_000,
  });

  const summary = data?.summary ?? {};
  const sessions = data?.sessions ?? [];
  const daily = data?.dailySummary ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/admin/stations">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            תחנות
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">היסטוריית תחנה — {stationId}</h1>
        <Link href={`/admin/stations/${stationId}/bays`}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Activity className="h-3.5 w-3.5" />
            מפת עמדות
          </Button>
        </Link>
        <Link href={`/admin/stations/${stationId}/commands`}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <GitBranch className="h-3.5 w-3.5" />
            פקודות
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Droplets} label="סה״כ שטיפות"   value={String(summary.totalWashes ?? 0)} />
          <StatCard icon={TrendingUp} label="סה״כ הכנסות"  value={`₪${summary.totalRevenueILS ?? "0.00"}`} />
          <StatCard icon={Droplets}  label="שטיפות היום"   value={String(summary.todayWashes ?? 0)} />
          <StatCard icon={Activity}  label="הכנסות היום"   value={`₪${summary.todayRevenueILS ?? "0.00"}`}
            sub={`ממוצע: ${summary.avgSessionMinutes ?? 0} דק׳`} />
        </div>
      )}

      {daily.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">סיכום יומי (30 יום אחרונים)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {daily.map((d: any) => (
                <div key={d.date} className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{d.date}</span>
                  <span>{d.washCount} שטיפות</span>
                  <span className="font-medium">₪{d.revenueILS}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">סשנים ({sessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין נתונים עדיין</p>
          ) : (
            <div className="divide-y">
              {sessions.map((s: any) => (
                <div key={s.id} className="py-3 flex flex-wrap gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {SOURCE_LABELS[s.source] ?? s.source}
                      {s.product && ` — ${s.product}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {s.startedAt ? new Date(s.startedAt).toLocaleString("he-IL") : "—"}
                        {s.durationMinutes != null && ` · ${s.durationMinutes} דק׳`}
                      </p>
                      {s.bayId && (
                        <Link href={`/admin/bays/${s.bayId}/timeline`}>
                          <span className="text-xs text-primary underline flex items-center gap-0.5">
                            <GitBranch className="h-2.5 w-2.5" />{s.bayId}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">₪{s.amountILS}</span>
                    <Badge className={cn("text-xs", STATUS_COLOR[s.status] ?? "bg-white text-gray-700")}>
                      {s.status}
                    </Badge>
                    {s.isAnonymous
                      ? <ShieldOff className="h-3 w-3 text-muted-foreground" title="אנונימי" />
                      : <User className="h-3 w-3 text-primary" title="משתמש מחובר" />}
                    {s.loyaltyPointsAwarded > 0 && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                        +{s.loyaltyPointsAwarded} נק׳
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
