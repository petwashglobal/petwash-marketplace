import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, RefreshCw, Zap, CheckCircle2, XCircle,
  Clock, AlertTriangle, RotateCcw, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CMD_LABELS: Record<string, string> = {
  START_PUMP:  "הפעלת משאבה",
  STOP_PUMP:   "עצירת משאבה",
  EXTEND_TIME: "הארכת זמן",
  HEARTBEAT:   "פינג חיות",
  STATUS_PING: "בדיקת סטטוס",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:      { label: "ממתין",     color: "bg-gray-100 text-gray-700",    icon: Clock },
  sent:         { label: "נשלח",      color: "bg-blue-100 text-blue-700",    icon: Zap },
  acknowledged: { label: "אושר",      color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  completed:    { label: "הושלם",     color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  failed:       { label: "נכשל",      color: "bg-red-100 text-red-700",      icon: XCircle },
  expired:      { label: "פג תוקף",   color: "bg-orange-100 text-orange-700", icon: Clock },
};

function RelTime({ ts }: { ts: string | null }) {
  if (!ts) return <span className="text-gray-400">—</span>;
  return <span className="text-xs text-gray-500">{new Date(ts).toLocaleString("he-IL")}</span>;
}

export default function AdminCommandLog() {
  const params = useParams<{ stationId: string }>();
  const stationId = params.stationId;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/station", stationId, "command-log"],
    queryFn: () => fetch(`/api/octopus/v1/station/${stationId}/command-log?limit=100`).then(r => r.json()),
    enabled: !!stationId,
    refetchInterval: 20_000,
  });

  const commands: any[] = data?.commands ?? [];
  const summary = data?.summary ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/admin/stations/${stationId}/bay-map`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                מפת עמדות
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">יומן פקודות — {stationId}</h1>
              <p className="text-xs text-gray-400 mt-0.5">100 פקודות אחרונות · מתרענן כל 20 שניות</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            רענן
          </Button>
        </div>

        {!isLoading && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "פקודה אחרונה",  value: CMD_LABELS[summary.lastCommandType] ?? summary.lastCommandType ?? "—", color: "text-gray-800" },
              { label: "סטטוס אחרון",    value: STATUS_CONFIG[summary.lastCommandStatus]?.label ?? summary.lastCommandStatus ?? "—", color: summary.lastCommandStatus === "failed" ? "text-red-700" : "text-gray-800" },
              { label: "כשלונות (1ש׳)",   value: String(summary.failedCount ?? 0), color: summary.failedCount > 0 ? "text-red-700" : "text-gray-800" },
              { label: "פיקוח פעיל",    value: summary.pendingCompensations > 0 ? `${summary.pendingCompensations} דורשים פיצוי` : "תקין", color: summary.pendingCompensations > 0 ? "text-orange-700" : "text-emerald-700" },
            ].map((s) => (
              <Card key={s.label} className="border-gray-100">
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className={cn("text-sm font-semibold mt-0.5", s.color)}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
          </div>
        ) : commands.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center text-gray-400 text-sm">אין פקודות עדיין לתחנה זו</CardContent>
          </Card>
        ) : (
          <Card className="border-gray-100">
            <CardHeader className="pb-2 border-b border-gray-50">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                היסטוריית פקודות
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-right py-2 px-3 font-medium text-gray-500">פקודה</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">סטטוס</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">נסיונות</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">נשלח</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">אושר</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">פג תוקף</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">פיצוי</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {commands.map((cmd: any) => {
                      const cfg = STATUS_CONFIG[cmd.status] ?? { label: cmd.status, color: "bg-gray-100 text-gray-700", icon: Clock };
                      const Icon = cfg.icon;
                      const needsComp = !!cmd.compensationTriggeredAt;
                      return (
                        <tr key={cmd.id} className={cn(
                          "hover:bg-gray-50/60 transition-colors",
                          cmd.status === "failed" && "bg-red-50/40",
                          needsComp && "bg-orange-50/40",
                        )}>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-3 w-3 text-gray-400" />
                              <span className="font-medium text-gray-800">{CMD_LABELS[cmd.commandType] ?? cmd.commandType}</span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-mono mt-0.5 truncate max-w-[120px]">{cmd.commandId}</p>
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={cn("text-[10px] gap-1", cfg.color)}>
                              <Icon className="h-2.5 w-2.5" />
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              {cmd.retryCount > 0 && <RotateCcw className="h-3 w-3 text-orange-400" />}
                              <span className={cmd.retryCount > 0 ? "text-orange-700 font-medium" : "text-gray-600"}>
                                {cmd.retryCount}/{cmd.maxRetries}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3"><RelTime ts={cmd.sentAt} /></td>
                          <td className="py-2 px-3"><RelTime ts={cmd.acknowledgedAt} /></td>
                          <td className="py-2 px-3"><RelTime ts={cmd.timeoutAt} /></td>
                          <td className="py-2 px-3">
                            {needsComp ? (
                              <Link href="/admin/compensation">
                                <span className="text-orange-700 font-medium flex items-center gap-0.5 underline cursor-pointer">
                                  <AlertTriangle className="h-3 w-3" />
                                  פיצוי
                                </span>
                              </Link>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
