import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, AlertTriangle, Activity, Wifi, WifiOff,
  Thermometer, Droplets, Clock, ChevronLeft, RefreshCw,
  Terminal, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; labelHe: string; color: string; bg: string; icon: any }> = {
  ready:       { label: "Ready",               labelHe: "מוכן",            color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  busy:        { label: "Active wash",          labelHe: "שטיפה פעילה",     color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       icon: Activity },
  cleanup:     { label: "Cleanup in progress",  labelHe: "ניקוי מתבצע",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     icon: Clock },
  fault:       { label: "Fault",                labelHe: "תקלה",            color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: AlertTriangle },
  maintenance: { label: "Maintenance",          labelHe: "תחזוקה",          color: "text-purple-700",  bg: "bg-purple-50 border-purple-200",   icon: Wrench },
  offline:     { label: "Offline",              labelHe: "לא מחובר",        color: "text-gray-500",    bg: "bg-gray-50 border-gray-200",       icon: WifiOff },
};

function HeartbeatAge({ ts }: { ts: string | null }) {
  if (!ts) return <span className="text-xs text-gray-400">—</span>;
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  const label =
    seconds < 60  ? `${seconds}ש׳` :
    seconds < 3600 ? `${Math.floor(seconds / 60)}ד׳` :
    `${Math.floor(seconds / 3600)}ש׳`;
  const stale = seconds > 120;
  return (
    <span className={cn("text-xs", stale ? "text-orange-500" : "text-gray-500")}>
      {stale && <WifiOff className="inline h-3 w-3 mr-0.5" />}
      לפני {label}
    </span>
  );
}

function LevelBar({ pct, label, color }: { pct: number | null; label: string; color: string }) {
  const val = pct ?? 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>{label}</span><span>{val}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(val, 100)}%` }} />
      </div>
    </div>
  );
}

export default function AdminBayMap() {
  const params = useParams<{ stationId: string }>();
  const stationId = params.stationId;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/station", stationId, "bay-map"],
    queryFn: () => fetch(`/api/octopus/v1/station/${stationId}/bay-map`).then(r => r.json()),
    enabled: !!stationId,
    refetchInterval: 15_000,
  });

  const bays: Record<string, any> = data?.bays ?? {};
  const summary = data?.summary;
  const sides = ["left", "right"].filter((s) => bays[s]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/20" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/admin/stations/${stationId}/timeline`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                ציר זמן תחנה
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">מפת עמדות — {stationId}</h1>
              <p className="text-xs text-gray-400 mt-0.5">מתרענן כל 15 שניות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary && (
              <Badge className={cn("text-xs", summary.anyFault ? "bg-red-100 text-red-800" : summary.allReady ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800")}>
                {summary.anyFault ? "תקלה פעילה" : summary.allReady ? "כל העמדות מוכנות" : "פעיל"}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              רענן
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : data?.error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6 text-center text-red-600 text-sm">{data.error}</CardContent>
          </Card>
        ) : sides.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center text-gray-400 text-sm">לא נמצאו עמדות רשומות לתחנה זו</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sides.map((side) => {
              const bay = bays[side];
              const cfg = STATUS_CONFIG[bay.status] ?? { label: bay.status, labelHe: bay.status, color: "text-gray-600", bg: "bg-gray-50 border-gray-200", icon: Activity };
              const Icon = cfg.icon;

              return (
                <Card key={side} className={cn("border", cfg.bg, "transition-all duration-300")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {bay.labelHe ?? bay.label ?? `עמדה ${side}`}
                        </CardTitle>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{bay.bayId}</p>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium", cfg.bg, cfg.color)}>
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.labelHe}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {bay.status === "fault" && bay.lastFaultCode && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                        <span className="font-medium">קוד תקלה:</span> {bay.lastFaultCode}
                        {bay.lastFaultAt && (
                          <span className="text-red-400 mr-1">· {new Date(bay.lastFaultAt).toLocaleString("he-IL")}</span>
                        )}
                      </div>
                    )}

                    {bay.currentSessionId && (
                      <div className="text-xs bg-blue-50 border border-blue-100 rounded p-2">
                        <span className="text-gray-500">סשן פעיל:</span>
                        <Link href={`/admin/bays/${bay.bayId}/timeline`}>
                          <span className="font-mono text-blue-700 underline mr-1 cursor-pointer">{bay.currentSessionId}</span>
                        </Link>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/70 border border-gray-100 rounded p-2">
                        <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                          <Thermometer className="h-3 w-3" />
                          <span>טמפ׳ מים</span>
                        </div>
                        <p className="font-semibold text-gray-800">
                          {bay.waterTempC != null ? `${Number(bay.waterTempC).toFixed(1)}°C` : "—"}
                        </p>
                      </div>
                      <div className="bg-white/70 border border-gray-100 rounded p-2">
                        <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                          <Wifi className="h-3 w-3" />
                          <span>Heartbeat</span>
                        </div>
                        <HeartbeatAge ts={bay.lastHeartbeat} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <LevelBar pct={bay.shampooLevelPct} label="שמפו" color="bg-violet-400" />
                      <LevelBar pct={bay.conditionerLevelPct} label="קונדישינר" color="bg-cyan-400" />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                      <span>סה״כ סשנים: <span className="font-medium text-gray-600">{bay.totalSessions ?? 0}</span></span>
                      {bay.lastSessionAt && (
                        <span>אחרון: {new Date(bay.lastSessionAt).toLocaleDateString("he-IL")}</span>
                      )}
                    </div>

                    <Link href={`/admin/bays/${bay.bayId}/timeline`}>
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 mt-1">
                        <Terminal className="h-3 w-3" />
                        ציר זמן עמדה
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Link href={`/admin/stations/${stationId}/commands`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Terminal className="h-3.5 w-3.5" />
              יומן פקודות מכונה
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
