import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  Smartphone,
  Check,
  X,
  Shield,
  Clock,
  Info,
  Settings,
  History
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  marketingEmails: boolean;
  transactionalEmails: boolean;
  securityAlerts: boolean;
  loyaltyUpdates: boolean;
  appointmentReminders: boolean;
}

interface ConsentHistory {
  id: number;
  provider: string;
  action: string;
  timestamp: string;
  ipAddress?: string;
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('preferences');

  const { data: preferences, isLoading } = useQuery<{ success: boolean; data: NotificationPreferences }>({
    queryKey: ['/api/user/notification-preferences'],
  });

  const { data: history, isLoading: historyLoading } = useQuery<{ success: boolean; data: ConsentHistory[] }>({
    queryKey: ['/api/user/consent-history'],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest('/api/user/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/notification-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/consent-history'] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const prefs = preferences?.data || {
    emailEnabled: false,
    smsEnabled: false,
    pushEnabled: false,
    marketingEmails: false,
    transactionalEmails: true,
    securityAlerts: true,
    loyaltyUpdates: false,
    appointmentReminders: true,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="h-8 w-8 text-blue-600" />
              Notification Preferences
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage how you receive updates from Pet Wash™
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" data-testid="link-back-to-settings">
              ← Back to Settings
            </Button>
          </Link>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preferences" data-testid="tab-preferences">
              <Settings className="h-4 w-4 mr-2" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Consent History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-4">
            <Card data-testid="card-channel-preferences">
              <CardHeader>
                <CardTitle>Communication Channels</CardTitle>
                <CardDescription>Choose how you want to receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-blue-600" />
                        <div>
                          <Label htmlFor="email-enabled" className="text-base font-medium cursor-pointer">
                            Email Notifications
                          </Label>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Receive updates via email
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="email-enabled"
                        checked={prefs.emailEnabled}
                        onCheckedChange={(checked) => handleToggle('emailEnabled', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-email-enabled"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-green-600" />
                        <div>
                          <Label htmlFor="sms-enabled" className="text-base font-medium cursor-pointer">
                            SMS Notifications
                          </Label>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Get text messages for important updates
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="sms-enabled"
                        checked={prefs.smsEnabled}
                        onCheckedChange={(checked) => handleToggle('smsEnabled', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-sms-enabled"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-purple-600" />
                        <div>
                          <Label htmlFor="push-enabled" className="text-base font-medium cursor-pointer">
                            Push Notifications
                          </Label>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Browser and mobile app notifications
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="push-enabled"
                        checked={prefs.pushEnabled}
                        onCheckedChange={(checked) => handleToggle('pushEnabled', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-push-enabled"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-notification-types">
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
                <CardDescription>Fine-tune what notifications you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="security-alerts" className="text-sm font-medium cursor-pointer">
                          Security Alerts
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Login attempts, password changes, etc.
                        </p>
                      </div>
                      <Switch
                        id="security-alerts"
                        checked={prefs.securityAlerts}
                        onCheckedChange={(checked) => handleToggle('securityAlerts', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-security-alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="transactional-emails" className="text-sm font-medium cursor-pointer">
                          Transactional Emails
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Receipts, confirmations, account updates
                        </p>
                      </div>
                      <Switch
                        id="transactional-emails"
                        checked={prefs.transactionalEmails}
                        onCheckedChange={(checked) => handleToggle('transactionalEmails', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-transactional-emails"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="appointment-reminders" className="text-sm font-medium cursor-pointer">
                          Appointment Reminders
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Upcoming wash appointments
                        </p>
                      </div>
                      <Switch
                        id="appointment-reminders"
                        checked={prefs.appointmentReminders}
                        onCheckedChange={(checked) => handleToggle('appointmentReminders', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-appointment-reminders"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="loyalty-updates" className="text-sm font-medium cursor-pointer">
                          Loyalty Updates
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Tier changes, rewards, special offers
                        </p>
                      </div>
                      <Switch
                        id="loyalty-updates"
                        checked={prefs.loyaltyUpdates}
                        onCheckedChange={(checked) => handleToggle('loyaltyUpdates', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-loyalty-updates"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="marketing-emails" className="text-sm font-medium cursor-pointer">
                          Marketing Emails
                        </Label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Promotions, news, and updates
                        </p>
                      </div>
                      <Switch
                        id="marketing-emails"
                        checked={prefs.marketingEmails}
                        onCheckedChange={(checked) => handleToggle('marketingEmails', checked)}
                        disabled={updatePreferencesMutation.isPending}
                        data-testid="switch-marketing-emails"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Alert data-testid="alert-privacy-notice">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Privacy Protection:</strong> Your consent preferences are stored securely and retained for 7
                years to comply with Israeli Privacy Law. You can change these settings anytime.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card data-testid="card-consent-history">
              <CardHeader>
                <CardTitle>Consent History</CardTitle>
                <CardDescription>Complete audit trail of your notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history?.data?.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        data-testid={`history-entry-${entry.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {entry.action === 'granted' ? (
                            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                              <Check className="h-4 w-4 text-green-600 dark:text-green-300" />
                            </div>
                          ) : (
                            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                              <X className="h-4 w-4 text-red-600 dark:text-red-300" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {entry.provider} - {entry.action}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {entry.action === 'granted' ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    )) || (
                      <div className="text-center py-8 text-slate-500">
                        <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No consent history available</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert data-testid="alert-retention-info">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                All consent changes are logged and retained for 7 years (2,555 days) for compliance with Israeli
                Privacy Law Amendment 13.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
