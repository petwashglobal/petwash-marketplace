import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Activity, Database } from 'lucide-react';

const ADMIN_EMAIL = 'nirhadad1@gmail.com';

export default function AdminSystemLogs() {
  const { user: firebaseUser } = useFirebaseAuth();
  const [activeTab, setActiveTab] = useState('workflow');

  // Helper to get Firebase ID token
  const getAuthHeaders = async () => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const token = await (firebaseUser as any).getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Check if user is admin
  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

  // Fetch workflow logs
  const { data: workflowLogs, isLoading: workflowLoading, refetch: refetchWorkflow } = useQuery({
    queryKey: ['/api/admin/system-logs/workflow'],
    enabled: isAdmin && !!firebaseUser && activeTab === 'workflow',
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/system-logs/workflow', { headers });
      if (!response.ok) throw new Error('Failed to fetch workflow logs');
      return response.json();
    }
  });

  // Fetch activity logs
  const { data: activityLogs, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['/api/admin/system-logs/activity'],
    enabled: isAdmin && !!firebaseUser && activeTab === 'activity',
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/system-logs/activity', { headers });
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      return response.json();
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              Admin permissions required
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Logs
            </CardTitle>
            <CardDescription>
              View workflow logs and admin activity
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Logs Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="workflow">
                  <Activity className="h-4 w-4 mr-2" />
                  Workflow Logs
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <Database className="h-4 w-4 mr-2" />
                  Admin Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="workflow" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {workflowLogs?.file ? `File: ${workflowLogs.file}` : 'Recent workflow logs'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchWorkflow()}
                    disabled={workflowLoading}
                  >
                    Refresh
                  </Button>
                </div>
                <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                  {workflowLoading ? (
                    <p>Loading...</p>
                  ) : workflowLogs?.logs ? (
                    <pre className="whitespace-pre-wrap">{workflowLogs.logs}</pre>
                  ) : (
                    <p>No logs available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {activityLogs?.total ? `${activityLogs.total} activity logs` : 'Admin activity logs'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchActivity()}
                    disabled={activityLoading}
                  >
                    Refresh
                  </Button>
                </div>
                <div className="space-y-2">
                  {activityLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : activityLogs?.logs && activityLogs.logs.length > 0 ? (
                    activityLogs.logs.map((log: any) => (
                      <div key={log.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              Admin: {log.adminId} • Resource: {log.resource || 'N/A'}
                            </p>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded mt-2 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground mt-2">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No activity logs found</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
