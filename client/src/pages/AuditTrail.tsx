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
      <div className="container max-w-4xl mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const records = data?.records || [];

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-audit-trail-title">
            Blockchain Audit Trail
          </h1>
          <p className="text-muted-foreground">
            Your complete transaction history with cryptographic verification
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Summary</CardTitle>
          <CardDescription>
            Total verified transactions: <span className="font-bold">{data?.recordCount || 0}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {records.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => (
            <Card key={record.id} data-testid={`card-audit-record-${record.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {record.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <CardTitle className="text-lg">{record.eventType}</CardTitle>
                  </div>
                  <Badge variant={record.fraudScore > 50 ? "destructive" : "secondary"}>
                    Fraud Score: {record.fraudScore}
                  </Badge>
                </div>
                <CardDescription>
                  {new Date(record.createdAt).toLocaleString()} · {record.action}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Entity:</span> {record.entityType}
                  </div>
                  <div>
                    <span className="font-semibold">ID:</span> {record.entityId}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                  Hash: {record.currentHash?.substring(0, 32)}...
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
