import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function PushNotificationTest() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const { supported, permission, vapidConfigured, loading, requestPermission } = useFCMNotifications(false);
  
  const [title, setTitle] = useState('🐾 Pet Wash™ Club Member Exclusive!');
  const [message, setMessage] = useState('Welcome to Pet Wash Club! Your membership benefits are now active. Tap to explore exclusive perks.');
  const [sending, setSending] = useState(false);

  const handleEnableNotifications = async () => {
    const success = await requestPermission();
    if (success) {
      toast({
        title: '✅ Notifications Enabled',
        description: 'You will now receive Pet Wash Club member updates!',
      });
    }
  };

  const handleSendTest = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to send notifications',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      await apiRequest('/api/push-notifications/send', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          title,
          body: message,
          icon: '/brand/petwash-logo-official.png',
          badge: '/brand/petwash-logo-official.png',
          data: {
            url: '/dashboard',
            type: 'membership_welcome',
          },
        }),
      });

      toast({
        title: '✅ Test Notification Sent!',
        description: 'Check your browser/device for the push notification',
      });
    } catch (error: any) {
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-3 mb-2">
            <Bell className="w-10 h-10 text-blue-600" />
            Push Notification Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test Pet Wash™ Club member notifications with user consent
          </p>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              System Status
            </CardTitle>
            <CardDescription>Current notification capabilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Browser Support</span>
              {supported ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" /> Supported
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" /> Not Supported
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">VAPID Key Configured</span>
              {vapidConfigured ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" /> Missing
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">User Permission</span>
              {permission === 'granted' ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" /> Granted
                </Badge>
              ) : permission === 'denied' ? (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" /> Denied
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" /> Not Asked
                </Badge>
              )}
            </div>

            {!vapidConfigured && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Action Required:</strong> Add <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">VITE_FIREBASE_VAPID_KEY</code> to Replit Secrets to enable push notifications.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Enable Notifications */}
        {supported && vapidConfigured && permission !== 'granted' && (
          <Card className="border-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Enable Pet Wash™ Club Notifications
              </CardTitle>
              <CardDescription>
                Get exclusive member updates, vaccine reminders, and loyalty rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleEnableNotifications}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-enable-notifications"
              >
                {loading ? 'Requesting Permission...' : '🔔 Enable Notifications'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Send Test Notification */}
        {permission === 'granted' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send Test Notification
              </CardTitle>
              <CardDescription>
                Test push notifications as a Pet Wash Club member
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Notification Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notification title"
                  data-testid="input-notification-title"
                />
              </div>

              <div>
                <Label htmlFor="message">Notification Message</Label>
                <Input
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter notification message"
                  data-testid="input-notification-message"
                />
              </div>

              <Button
                onClick={handleSendTest}
                disabled={sending || !title || !message}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                data-testid="button-send-test"
              >
                {sending ? 'Sending...' : '📤 Send Test Notification'}
              </Button>

              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription>
                  The notification will appear on this device. Make sure you're on this tab/app to see the foreground notification, or switch to another app to see the background notification.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* User Info */}
        {user && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <CardContent className="pt-6">
              <div className="text-sm">
                <p className="font-semibold text-gray-900 dark:text-white">Pet Wash™ Club Member</p>
                <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">UID: {user.uid}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
