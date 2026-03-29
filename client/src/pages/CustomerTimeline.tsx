import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  CalendarDays, Droplets, Wallet, Star, ChevronLeft, RefreshCw,
  CheckCircle2, Clock, XCircle, AlertCircle, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; amountSign: string }> = {
  marketplace_booking: { icon: CalendarDays, color: "text-blue-500",   label: "הזמנה",        amountSign: "-" },
  k9000_wash:          { icon: Droplets,     color: "text-cyan-500",   label: "K9000 שטיפה",  amountSign: "-" },
  wallet_credit:       { icon: TrendingUp,   color: "text-green-500",  label: "טעינת ארנק",   amountSign: "+" },
  wallet_debit:        { icon: TrendingDown, color: "text-red-400",    label: "שימוש בארנק",  amountSign: "-" },
  loyalty_earned:      { icon: Star,         color: "text-amber-500",  label: "נקודות נצברו", amountSign: "+" },
  loyalty_redeemed:    { icon: Star,         color: "text-amber-400",  label: "נקודות מומשו", amountSign: "-" },
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending:     "ממתין",
  confirmed:   "מאושר",
  in_progress: "בתהליך",
  completed:   "הושלם",
  cancelled:   "בוטל",
  declined:    "נדחה",
  disputed:    "במחלוקת",
};

const BOOKING_STATUS_COLOR: Record<string, string> = {
  completed:   "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  confirmed:   "bg-blue-100 text-blue-800",
  pending:     "bg-yellow-100 text-yellow-800",
  cancelled:   "bg-gray-100 text-gray-600",
  declined:    "bg-gray-100 text-gray-600",
  disputed:    "bg-red-100 text-red-700",
};

function TimelineItem({ item }: { item: any }) {
  const cfg = TYPE_CONFIG[item.type] ?? { icon: CalendarDays, color: "text-gray-400", label: item.type, amountSign: "" };
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className="mt-1">
        <div className={cn("p-1.5 rounded-full bg-muted", cfg.color)}>
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{cfg.label}</span>
          {item.status && BOOKING_STATUS_LABELS[item.status] && (
            <Badge className={cn("text-xs", BOOKING_STATUS_COLOR[item.status] ?? "bg-gray-100 text-gray-600")}>
              {BOOKING_STATUS_LABELS[item.status]}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(item.timestamp).toLocaleString("he-IL")}
        </p>
      </div>
      <div className="text-left shrink-0">
        {item.amountILS && (
          <p className={cn(
            "text-sm font-bold",
            cfg.amountSign === "+" ? "text-green-600" : "text-foreground"
          )}>
            {cfg.amountSign}₪{item.amountILS}
          </p>
        )}
        {item.pointsDelta != null && item.pointsDelta !== 0 && (
          <p className={cn("text-xs font-medium", item.pointsDelta > 0 ? "text-amber-600" : "text-muted-foreground")}>
            {item.pointsDelta > 0 ? "+" : ""}{item.pointsDelta} נק׳
          </p>
        )}
        {item.balanceAfter && (
          <p className="text-xs text-muted-foreground">יתרה: {item.balanceAfter}</p>
        )}
      </div>
    </div>
  );
}

export default function CustomerTimeline() {
  const { user } = useFirebaseAuth();
  const userId = user?.uid;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/octopus/v1/timeline/customer", userId],
    queryFn: () => fetch(`/api/octopus/v1/timeline/customer/${userId}`).then(r => r.json()),
    enabled: !!userId,
  });

  const items: any[] = data?.items ?? [];

  const bookingCount = items.filter(i => i.type === "marketplace_booking").length;
  const k9000Count   = items.filter(i => i.type === "k9000_wash").length;
  const walletCount  = items.filter(i => i.type.startsWith("wallet_")).length;
  const loyaltyCount = items.filter(i => i.type.startsWith("loyalty_")).length;

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/bookings">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            הזמנות
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">ציר זמן פעילות</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {!isLoading && items.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {bookingCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
              <CalendarDays className="h-3 w-3" /> {bookingCount} הזמנות
            </div>
          )}
          {k9000Count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
              <Droplets className="h-3 w-3" /> {k9000Count} שטיפות K9000
            </div>
          )}
          {walletCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
              <Wallet className="h-3 w-3" /> {walletCount} תנועות ארנק
            </div>
          )}
          {loyaltyCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
              <Star className="h-3 w-3" /> {loyaltyCount} נקודות
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">כל הפעילות ({data?.totalCount ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">אין פעילות עדיין</p>
              <p className="text-xs text-muted-foreground mt-1">הזמנות, שטיפות ותנועות ארנק יופיעו כאן</p>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <TimelineItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
