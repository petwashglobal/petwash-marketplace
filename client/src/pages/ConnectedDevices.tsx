/**
 * Connected Devices Page
 * Apple/myGov-style comprehensive device monitoring for fraud prevention
 * Tracks ALL login sessions regardless of auth method
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Smartphone, Monitor, Laptop, Tablet, MapPin, Clock, Shield, AlertTriangle, Trash2, Edit2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/lib/languageStore';

interface Device {
  id: string;
  deviceLabel: string;
  platform: string;
  browser?: string;
  osVersion?: string;
  browserVersion?: string;
  ipAddress?: string;
  ipLocation?: {
    city?: string;
    country?: string;
    region?: string;
  };
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  trustScore: number;
  fraudFlags: string[];
  isCurrentDevice: boolean;
}

export default function ConnectedDevices() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isHebrew = language === 'he';

  // Fetch devices
  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ['/api/devices'],
    enabled: !!auth.currentUser,
  });

  // Remove device mutation
  const removeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const idToken = await auth.currentUser!.getIdToken();
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to remove device');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setShowRemoveDialog(false);
      setSelectedDevice(null);
      toast({
        title: isHebrew ? 'המכשיר הוסר' : 'Device removed',
        description: isHebrew 
          ? 'המכשיר הוסר בהצלחה מהחשבון שלך.'
          : 'The device has been successfully dismissed from your account.',
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'הסרת המכשיר נכשלה. אנא נסה שוב.'
          : 'Failed to remove device. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Rename device mutation
  const renameMutation = useMutation({
    mutationFn: async ({ deviceId, label }: { deviceId: string; label: string }) => {
      const idToken = await auth.currentUser!.getIdToken();
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ deviceLabel: label }),
      });
      if (!response.ok) throw new Error('Failed to rename device');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setEditingDevice(null);
      toast({
        title: isHebrew ? 'שם המכשיר שונה' : 'Device renamed',
        description: isHebrew 
          ? 'שם המכשיר עודכן בהצלחה.'
          : 'The device name has been updated.',
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew 
          ? 'שינוי שם המכשיר נכשל. אנא נסה שוב.'
          : 'Failed to rename device. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Get device icon based on platform
  const getDeviceIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'ios':
        return <Smartphone className="h-8 w-8" />;
      case 'android':
        return <Smartphone className="h-8 w-8" />;
      case 'windows':
        return <Monitor className="h-8 w-8" />;
      case 'macos':
        return <Laptop className="h-8 w-8" />;
      case 'linux':
        return <Monitor className="h-8 w-8" />;
      default:
        return <Tablet className="h-8 w-8" />;
    }
  };

  // Get trust score color
  const getTrustScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const handleRemoveClick = (device: Device) => {
    setSelectedDevice(device);
    setShowRemoveDialog(true);
  };

  const handleRenameClick = (device: Device) => {
    setEditingDevice(device.id);
    setNewDeviceLabel(device.deviceLabel);
  };

  const handleSaveRename = (deviceId: string) => {
    if (newDeviceLabel.trim()) {
      renameMutation.mutate({ deviceId, label: newDeviceLabel.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <Header language={language} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              {isHebrew ? 'מכשירים מחוברים' : 'Connected Devices'}
            </h1>
            <p className="text-muted-foreground">
              {isHebrew 
                ? 'נהל מכשירים שניגשו לחשבון Pet Wash™ שלך. הסר כל מכשיר שאינך מזהה.'
                : "Manage devices that have accessed your Pet Wash™ account. Remove any devices you don't recognize."}
            </p>
          </div>

          {/* Security Status */}
          {devices && devices.some(d => d.fraudFlags.length > 0) && (
            <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                      {isHebrew ? 'התראת אבטחה' : 'Security Alert'}
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {isHebrew 
                        ? 'חלק מהמכשירים מציגים פעילות חשודה. בדוק אותם והסר כל מכשיר שאינך מזהה.'
                        : "Some devices show suspicious activity. Review them and remove any you don't recognize."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          )}

          {/* Device List */}
          {!isLoading && (
            <div className="space-y-4">
              {devices?.map((device) => (
                <Card 
                  key={device.id}
                  className={`transition-all hover:shadow-lg ${
                    device.isCurrentDevice ? 'ring-2 ring-primary' : ''
                  } ${
                    device.fraudFlags.length > 0 ? 'border-yellow-500' : ''
                  }`}
                  data-testid={`device-card-${device.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Device Icon */}
                        <div className="text-muted-foreground">
                          {getDeviceIcon(device.platform)}
                        </div>

                        {/* Device Info */}
                        <div className="flex-1">
                          {editingDevice === device.id ? (
                            <div className="flex items-center gap-2 mb-2">
                              <Input
                                value={newDeviceLabel}
                                onChange={(e) => setNewDeviceLabel(e.target.value)}
                                className="max-w-xs"
                                data-testid="input-device-label"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveRename(device.id)}
                                data-testid="button-save-rename"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingDevice(null)}
                                data-testid="button-cancel-rename"
                              >
                                {isHebrew ? 'ביטול' : 'Cancel'}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg" data-testid={`text-device-label-${device.id}`}>
                                {device.deviceLabel}
                              </CardTitle>
                              {device.isCurrentDevice && (
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                                  {isHebrew ? 'המכשיר הנוכחי' : 'This device'}
                                </span>
                              )}
                            </div>
                          )}
                          
                          <CardDescription className="space-y-1">
                            <div className="flex items-center gap-2 text-sm" data-testid={`text-platform-${device.id}`}>
                              {device.platform} • {device.browser} {device.browserVersion}
                            </div>
                            
                            {device.ipLocation && (
                              <div className="flex items-center gap-1 text-sm" data-testid={`text-location-${device.id}`}>
                                <MapPin className="h-3 w-3" />
                                {device.ipLocation.city}, {device.ipLocation.country}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1 text-sm" data-testid={`text-last-active-${device.id}`}>
                              <Clock className="h-3 w-3" />
                              {isHebrew ? 'פעילות אחרונה לפני' : 'Last active'} {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: !isHebrew })}
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <Shield className={`h-3 w-3 ${getTrustScoreColor(device.trustScore)}`} />
                              <span className={getTrustScoreColor(device.trustScore)}>
                                {isHebrew ? 'ציון אמון' : 'Trust score'}: {device.trustScore}/100
                              </span>
                            </div>

                            {device.fraudFlags.length > 0 && (
                              <div className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="h-3 w-3" />
                                {isHebrew ? 'התראות אבטחה' : 'Security alerts'}: {device.fraudFlags.join(', ')}
                              </div>
                            )}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRenameClick(device)}
                          data-testid={`button-edit-${device.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClick(device)}
                          disabled={device.isCurrentDevice}
                          data-testid={`button-remove-${device.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}

              {devices?.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {isHebrew 
                        ? 'לא נמצאו מכשירים. מידע על מכשירים יופיע כאן לאחר שתתחבר.'
                        : 'No devices found. Device information will appear here after you sign in.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Remove Device Dialog */}
          <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isHebrew ? 'להסיר מכשיר?' : 'Remove Device?'}
                </DialogTitle>
                <DialogDescription>
                  {isHebrew ? (
                    <>האם אתה בטוח שברצונך להסיר את <strong>{selectedDevice?.deviceLabel}</strong>? תצטרך להתחבר שוב מהמכשיר הזה.</>
                  ) : (
                    <>Are you sure you want to remove <strong>{selectedDevice?.deviceLabel}</strong>? You&apos;ll need to sign in again from that device.</>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveDialog(false)}
                  data-testid="button-cancel-remove"
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => selectedDevice && removeMutation.mutate(selectedDevice.id)}
                  disabled={removeMutation.isPending}
                  data-testid="button-confirm-remove"
                >
                  {removeMutation.isPending 
                    ? (isHebrew ? 'מסיר...' : 'Removing...') 
                    : (isHebrew ? 'הסר מכשיר' : 'Remove Device')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Footer language={language} />
    </div>
  );
}
