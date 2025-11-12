import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface FraudStats {
  totalRecords: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  averageFraudScore: number;
  recentHighRisk: Array<{
    id: number;
    userId: string;
    eventType: string;
    fraudScore: number;
    fraudSignals: string[];
    createdAt: string;
  }>;
}

export default function FraudDashboard() {
  const { data, isLoading } = useQuery<FraudStats>({
    queryKey: ['/api/audit/fraud-dashboard'],
  });

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const stats = data || {
    totalRecords: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    averageFraudScore: 0,
    recentHighRisk: [],
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-fraud-dashboard-title">
            Fraud Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time blockchain audit and fraud detection
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {stats.totalRecords}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-high-risk">
              {stats.highRiskCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-medium-risk">
              {stats.mediumRiskCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-low-risk">
              {stats.lowRiskCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average Fraud Score</CardTitle>
          <CardDescription>Lower is better (0-100 scale)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{stats.averageFraudScore.toFixed(1)}</span>
            <Badge variant={stats.averageFraudScore > 50 ? "destructive" : "secondary"}>
              {stats.averageFraudScore > 50 ? "ALERT" : "NORMAL"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent High-Risk Events</CardTitle>
          <CardDescription>Latest suspicious transactions requiring review</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentHighRisk.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No high-risk events detected
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentHighRisk.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`card-high-risk-${event.id}`}
                >
                  <div>
                    <div className="font-semibold">{event.eventType}</div>
                    <div className="text-sm text-muted-foreground">
                      User: {event.userId} · {new Date(event.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Signals: {event.fraudSignals?.join(", ") || "None"}
                    </div>
                  </div>
                  <Badge variant="destructive">Score: {event.fraudScore}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
