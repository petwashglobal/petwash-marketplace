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
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-4 luxury-glass-minimal rounded-2xl">
            <Shield className="h-8 w-8 luxury-text-gradient" />
          </div>
          <div>
            <h1 className="luxury-heading-lg luxury-text-gradient" data-testid="text-fraud-dashboard-title">
              Fraud Monitoring Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Real-time blockchain audit and fraud detection
            </p>
          </div>
        </div>

        <div className="luxury-grid-4 gap-6">
          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl">
                <TrendingUp className="h-4 w-4 luxury-text-gradient" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient" data-testid="text-total-records">
                {stats.totalRecords}
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">High Risk</CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-high-risk">
                {stats.highRiskCount}
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Medium Risk</CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-white">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-medium-risk">
                {stats.mediumRiskCount}
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Low Risk</CardTitle>
              <div className="p-2 luxury-glass-minimal rounded-xl bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-low-risk">
                {stats.lowRiskCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="luxury-glass-card luxury-shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Average Fraud Score</CardTitle>
            <CardDescription>Lower is better (0-100 scale)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="luxury-heading-xl luxury-text-gradient">{stats.averageFraudScore.toFixed(1)}</span>
              <Badge variant={stats.averageFraudScore > 50 ? "destructive" : "secondary"} className="text-sm px-3 py-1">
                {stats.averageFraudScore > 50 ? "ALERT" : "NORMAL"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="luxury-glass-card luxury-shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Recent High-Risk Events</CardTitle>
            <CardDescription>Latest suspicious transactions requiring review</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentHighRisk.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                ✅ No high-risk events detected
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentHighRisk.map((event) => (
                  <div
                    key={event.id}
                    className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl flex items-center justify-between"
                    data-testid={`card-high-risk-${event.id}`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{event.eventType}</div>
                      <div className="text-sm text-gray-600">
                        User: {event.userId} · {new Date(event.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Signals: {event.fraudSignals?.join(", ") || "None"}
                      </div>
                    </div>
                    <Badge variant="destructive" className="px-3 py-1">Score: {event.fraudScore}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
