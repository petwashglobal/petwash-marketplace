import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface AuditRecord {
  id: number;
  eventType: string;
  action: string;
  entityType: string;
  entityId: string;
  newState: any;
  previousState: any;
  fraudScore: number;
  verified: boolean;
  createdAt: string;
  currentHash: string;
}

export default function AuditTrail() {
  const { data, isLoading } = useQuery<{
    userId: string;
    recordCount: number;
    records: AuditRecord[];
  }>({
    queryKey: ['/api/audit/my-trail'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
          <p className="luxury-text-body">Loading audit trail...</p>
        </div>
      </div>
    );
  }

  const records = data?.records || [];

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="luxury-container max-w-4xl space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 luxury-text-gradient" />
          <div>
            <h1 className="luxury-heading-lg" data-testid="text-audit-trail-title">
              Blockchain Audit Trail
            </h1>
            <p className="luxury-text-body">
              Your complete transaction history with cryptographic verification
            </p>
          </div>
        </div>

        <Card className="luxury-glass-card luxury-shadow-lg">
          <CardHeader>
            <CardTitle className="luxury-heading-md">Transaction Summary</CardTitle>
            <CardDescription>
              Total verified transactions: <span className="font-bold luxury-text-gradient">{data?.recordCount || 0}</span>
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-4">
          {records.length === 0 ? (
            <Card className="luxury-glass-panel">
              <CardContent className="pt-6 text-center">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50 text-purple-400" />
                <p className="luxury-text-body">No transactions yet</p>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="luxury-glass-minimal luxury-hover-lift p-6 rounded-xl"
                data-testid={`card-audit-record-${record.id}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {record.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <h3 className="luxury-heading-sm">{record.eventType}</h3>
                  </div>
                  <Badge className={record.fraudScore > 50 ? "bg-red-500" : "luxury-badge-success"}>
                    Fraud Score: {record.fraudScore}
                  </Badge>
                </div>
                <p className="luxury-text-small mb-4">
                  {new Date(record.createdAt).toLocaleString()} · {record.action}
                </p>
                <div className="grid grid-cols-2 gap-4 luxury-text-body mb-3">
                  <div>
                    <span className="font-semibold">Entity:</span> {record.entityType}
                  </div>
                  <div>
                    <span className="font-semibold">ID:</span> {record.entityId}
                  </div>
                </div>
                <div className="luxury-text-small font-mono bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg">
                  Hash: {record.currentHash?.substring(0, 32)}...
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
