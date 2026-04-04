import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, ChevronLeft, RefreshCw, Activity,
  Terminal, Zap, Wifi, AlertCircle, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; urgent?: boolean }> = {
  session_completed:    { icon: CheckCircle2, color: "text-green-600",  label: "סשן הושלם" },
  session_active:       { icon: Activity,     color: "text-blue-600",   label: "סשן פעיל" },
  session_pending:      { icon: Clock,        color: "text-gray-500",   label: "סשן ממתין" },
  session_aborted:      { icon: XCircle,      color: "text-red-500",    label: "סשן בוטל" },
  session_timed_out:    { icon: XCircle,      color: "text-orange-500", label: "סשן פג תוקף" },
  session_fault:        { icon: AlertTriangle,color: "text-red-700",    label: "תקלה בסשן" },
  command_timed_out:    { icon: Clock,        color: "text-orange-500", label: "פקודה פגה" },
  command_failed:       { icon: XCircle,      color: "text-red-600",    label: "פקודה נכשלה" },
  command_start_pump:   { icon: Zap,          color: "text-blue-500",   label: "הפעלת משאבה" },
  compensation_required:{ icon: AlertTriangle,color: "text-orange-700", label: "נדרש פיצוי", urgent: true },
  fault:                { icon: AlertTriangle,color: "text-red-600",    label: "תקלה" },
  fault_raised:         { icon: AlertTriangle,color: "text-red-700",    label: "תקלה הועלתה" },
  heartbeat:            { icon: Wifi,         color: "text-emerald-500",label: "Heartbeat" },
  session_started:      { icon: Activity,     color: "text-blue-500",   label: "סשן התחיל" },
  card_swiped:          { icon: Terminal,     color: "text-indigo-500", label: "כרטיס נגלש" },
  qr_scanned:           { icon: Terminal,     color: "text-indigo-500", label: "QR נסרק" },
  command_sent:         { icon: Zap,          color: "text-blue-400",   label: "פקודה נשלחה" },
  command_acknowledged: { icon: CheckCircle2, color: "text-emerald-500",label: "פקודה אושרה" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Activity, color: "text-muted-foreground", label: type };
}

const SEVERITY_COLOR: Record<string, string> = {
  warning:  "bg-yellow-100 text-yellow-800",
  error:    "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

export default function BayTimeline() {
  const params = useParams<{ bayId: string }>();
  const bayId = params.bayId;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/timeline/bay", bayId],
    queryFn: () => fetch(`/api/octopus/v1/timeline/bay/${bayId}`).then(r => r.json()),
    enabled: !!bayId,
    refetchInterval: 15_000,
  });

  const feed = data?.feed ?? [];
  const activeFaults = data?.activeFaults ?? 0;
  const pendingCmds = data?.pendingCmds ?? 0;

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/stations">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <ChevronLeft className="h-4 w-4" />
            תחנות
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">פיד עמדה — {bayId}</h1>
        <Link href="/admin/compensation">
          <Button variant="outline" size="sm" className="gap-1 text-xs border-orange-200 text-orange-700 hover:bg-orange-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            פיצויים
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      <div className="flex gap-3 mb-6">
        <Card className="flex-1">
          <CardContent className="pt-3 pb-3 flex items-center gap-2">
            <AlertTriangle className={cn("h-5 w-5", activeFaults > 0 ? "text-red-500" : "text-gray-300")} />
            <div>
              <p className="text-xs text-muted-foreground">תקלות פעילות</p>
              <p className={cn("text-lg font-bold", activeFaults > 0 ? "text-red-600" : "text-gray-400")}>
                {activeFaults}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="pt-3 pb-3 flex items-center gap-2">
            <Terminal className={cn("h-5 w-5", pendingCmds > 0 ? "text-blue-500" : "text-gray-300")} />
            <div>
              <p className="text-xs text-muted-foreground">פקודות ממתינות</p>
              <p className={cn("text-lg font-bold", pendingCmds > 0 ? "text-blue-600" : "text-gray-400")}>
                {pendingCmds}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="pt-3 pb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">סה״כ אירועים</p>
              <p className="text-lg font-bold">{data?.totalItems ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">פיד אירועים (כרונולוגי)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : feed.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין אירועים לתא זה</p>
          ) : (
            <div className="space-y-1">
              {feed.map((item: any) => {
                const config = getTypeConfig(item.type);
                const Icon = config.icon;
                const isUrgent = config.urgent;
                const meta = item.meta ?? {};
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-3 py-2.5 px-2 border-b last:border-0 rounded transition-colors",
                      isUrgent && "bg-orange-50 border-orange-100",
                    )}
                  >
                    <div className="mt-0.5">
                      <Icon className={cn("h-4 w-4 mt-1", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-medium", isUrgent && "text-orange-800")}>
                          {config.label}
                        </span>
                        {item.severity && (
                          <Badge className={cn("text-xs", SEVERITY_COLOR[item.severity] ?? "bg-white")}>
                            {item.severity}
                          </Badge>
                        )}
                        {item.status && item.status !== item.type && (
                          <Badge variant="outline" className="text-xs">{item.status}</Badge>
                        )}
                        {isUrgent && (
                          <Link href="/admin/compensation">
                            <Badge className="text-[10px] bg-orange-200 text-orange-900 cursor-pointer underline">
                              דרוש פיצוי ›
                            </Badge>
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      {(meta.commandId || meta.retryCount != null || meta.reason) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {meta.commandId && (
                            <span className="text-[10px] font-mono text-gray-400 truncate max-w-[180px]">
                              {meta.commandId}
                            </span>
                          )}
                          {meta.retryCount != null && (
                            <span className="text-[10px] text-orange-500">
                              ניסיון {meta.retryCount + 1}
                            </span>
                          )}
                          {meta.reason && (
                            <span className="text-[10px] text-gray-400">{meta.reason}</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.timestamp).toLocaleString("he-IL")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
