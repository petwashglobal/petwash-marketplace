/**
 * Modern Web Features 2025 - Demo & Testing Page
 * 
 * Showcases all cutting-edge web platform capabilities
 * For admin/developer testing and client demonstrations
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useAppBadge,
  useBackgroundSync,
  useWakeLock,
  useContactPicker,
  useClipboard,
  useFileSystem,
  useIdleDetection,
  usePeriodicSync,
  useModernWebSupport,
} from '@/hooks/useModernWebFeatures';
import {
  Bell,
  Cloud,
  Sun,
  Users,
  Copy,
  FileUp,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

export default function ModernFeaturesDemo() {
  const { toast } = useToast();
  const [badgeCount, setBadgeCount] = useState(0);

  // Initialize all modern web feature hooks
  const badge = useAppBadge();
  const backgroundSync = useBackgroundSync();
  const wakeLock = useWakeLock();
  const contacts = useContactPicker();
  const clipboard = useClipboard();
  const fileSystem = useFileSystem();
  const idleDetection = useIdleDetection(() => {
    toast({
      title: "⚠️ User Idle Detected",
      description: "You've been inactive for 5 minutes",
    });
  }, 300000);
  const periodicSync = usePeriodicSync();
  const webSupport = useModernWebSupport();

  // Badge API Demo
  const handleIncrementBadge = async () => {
    const newCount = badgeCount + 1;
    setBadgeCount(newCount);
    await badge.setBadge(newCount);
  };

  const handleClearBadge = async () => {
    setBadgeCount(0);
    await badge.clearBadge();
  };

  // Background Sync Demo
  const handleBackgroundSync = async () => {
    const success = await backgroundSync.registerSync('demo-sync');
    if (success) {
      toast({
        title: "✅ Background Sync Registered",
        description: "Operation will complete when device is online",
      });
    } else {
      toast({
        title: "ℹ️ Background Sync Not Supported",
        description: "Operation will run immediately instead",
      });
    }
  };

  // Wake Lock Demo
  const handleToggleWakeLock = async () => {
    if (wakeLock.isActive) {
      await wakeLock.releaseWakeLock();
      toast({
        title: "💤 Screen Sleep Enabled",
        description: "Screen can now dim and turn off",
      });
    } else {
      const success = await wakeLock.requestWakeLock();
      if (success) {
        toast({
          title: "☀️ Screen Wake Lock Active",
          description: "Screen will stay on until released",
        });
      }
    }
  };

  // Contact Picker Demo
  const handlePickContacts = async () => {
    const selectedContacts = await contacts.pickContacts({ multiple: true });
    if (selectedContacts.length > 0) {
      console.log('Selected contacts:', selectedContacts);
    }
  };

  // Clipboard Demo
  const handleCopyToClipboard = async () => {
    await clipboard.copyText('https://petwash.co.il/ref/DEMO123');
  };

  // File System Demo
  const handleSaveFile = async () => {
    const demoData = `Pet Wash™ Demo Receipt\nDate: ${new Date().toLocaleDateString()}\nAmount: ₪100\nThank you!`;
    const blob = new Blob([demoData], { type: 'text/plain' });
    const success = await fileSystem.saveFile(blob, `PetWash_Demo_${Date.now()}.txt`);
    
    if (success) {
      toast({
        title: "✅ File Saved",
        description: "Demo receipt saved to your device",
      });
    }
  };

  // Idle Detection Demo
  const handleToggleIdleDetection = async () => {
    if (idleDetection.isDetecting) {
      idleDetection.stopDetection();
      toast({
        title: "Idle Detection Stopped",
        description: "No longer monitoring user activity",
      });
    } else {
      const success = await idleDetection.startDetection();
      if (success) {
        toast({
          title: "Idle Detection Active",
          description: "Will notify after 5 minutes of inactivity",
        });
      }
    }
  };

  // Periodic Sync Demo
  const handleRegisterPeriodicSync = async () => {
    const success = await periodicSync.registerSync('demo-periodic', 86400000);
    if (success) {
      toast({
        title: "✅ Periodic Sync Registered",
        description: "Will auto-refresh data daily",
      });
    }
  };

  const SupportBadge = ({ supported }: { supported: boolean }) => (
    <Badge variant={supported ? "default" : "secondary"} className="ml-2">
      {supported ? (
        <>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Supported
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3 mr-1" />
          Not Available
        </>
      )}
    </Badge>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-yellow-500" />
          Modern Web Features 2025
        </h1>
        <p className="text-muted-foreground text-lg">
          Cutting-edge web platform capabilities for 7-star luxury experience
        </p>
      </div>

      {/* Overall Support Summary */}
      <Card className="mb-6 border-2 border-primary">
        <CardHeader>
          <CardTitle>Device Capabilities</CardTitle>
          <CardDescription>
            Your device supports {webSupport.supportedCount} out of {webSupport.totalCount} modern features ({webSupport.supportPercentage}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(webSupport.support).map(([feature, supported]) => (
              <div key={feature} className="flex items-center gap-1 text-sm">
                {supported ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Badge API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Badge API
              <SupportBadge supported={badge.isSupported} />
            </CardTitle>
            <CardDescription>
              App icon notification badges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Display notification counts on Pet Wash™ app icon
            </p>
            <div className="flex gap-2">
              <Button onClick={handleIncrementBadge} size="sm">
                Add Notification ({badgeCount})
              </Button>
              <Button onClick={handleClearBadge} variant="outline" size="sm">
                Clear Badge
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Background Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              Background Sync
              <SupportBadge supported={backgroundSync.isSupported} />
            </CardTitle>
            <CardDescription>
              Offline-first operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Queue operations that complete when device is online
            </p>
            <Button onClick={handleBackgroundSync} size="sm">
              Register Background Sync
            </Button>
          </CardContent>
        </Card>

        {/* Wake Lock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5" />
              Screen Wake Lock
              <SupportBadge supported={wakeLock.isSupported} />
            </CardTitle>
            <CardDescription>
              Keep screen active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prevent screen from dimming during wash sessions
            </p>
            <Button 
              onClick={handleToggleWakeLock} 
              variant={wakeLock.isActive ? "destructive" : "default"}
              size="sm"
            >
              {wakeLock.isActive ? "Release Wake Lock" : "Request Wake Lock"}
            </Button>
            {wakeLock.isActive && (
              <Badge variant="default" className="ml-2">Active</Badge>
            )}
          </CardContent>
        </Card>

        {/* Contact Picker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contact Picker
              <SupportBadge supported={contacts.isSupported} />
            </CardTitle>
            <CardDescription>
              Easy friend referrals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select contacts from device for referral sharing
            </p>
            <Button onClick={handlePickContacts} size="sm">
              Pick Contacts
            </Button>
          </CardContent>
        </Card>

        {/* Clipboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Advanced Clipboard
              <SupportBadge supported={clipboard.isSupported} />
            </CardTitle>
            <CardDescription>
              Rich content sharing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy referral links, booking codes, QR codes
            </p>
            <Button onClick={handleCopyToClipboard} size="sm">
              Copy Referral Link
            </Button>
          </CardContent>
        </Card>

        {/* File System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              File System Access
              <SupportBadge supported={fileSystem.isSupported} />
            </CardTitle>
            <CardDescription>
              Save files with custom names
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download invoices, receipts, loyalty statements
            </p>
            <Button onClick={handleSaveFile} size="sm">
              Save Demo Receipt
            </Button>
          </CardContent>
        </Card>

        {/* Idle Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Idle Detection
              <SupportBadge supported={idleDetection.isSupported} />
            </CardTitle>
            <CardDescription>
              Automatic security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Auto-logout after 5 minutes of inactivity
            </p>
            <Button 
              onClick={handleToggleIdleDetection} 
              variant={idleDetection.isDetecting ? "destructive" : "default"}
              size="sm"
            >
              {idleDetection.isDetecting ? "Stop Detection" : "Start Detection"}
            </Button>
          </CardContent>
        </Card>

        {/* Periodic Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Periodic Sync
              <SupportBadge supported={periodicSync.isSupported} />
            </CardTitle>
            <CardDescription>
              Auto-refresh data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Automatically update loyalty points, bookings, weather
            </p>
            <Button onClick={handleRegisterPeriodicSync} size="sm">
              Register Daily Sync
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Additional Features Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>More 2025 Features</CardTitle>
          <CardDescription>
            Additional capabilities enabled in the PWA manifest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Web Share Target</h4>
              <p className="text-sm text-muted-foreground">
                Pet Wash™ appears in system share sheet to receive photos, documents, and links
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">File Handler Association</h4>
              <p className="text-sm text-muted-foreground">
                Open PDFs, images, and documents directly in Pet Wash™
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Window Controls Overlay</h4>
              <p className="text-sm text-muted-foreground">
                Custom title bar on Windows 11 desktop PWA
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">PWA Widgets</h4>
              <p className="text-sm text-muted-foreground">
                Quick booking widget on Windows 11 Widgets Board
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Protocol Handlers</h4>
              <p className="text-sm text-muted-foreground">
                Handle web+petwash:// URLs from other apps and websites
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">App Shortcuts</h4>
              <p className="text-sm text-muted-foreground">
                Quick access to Book, Dashboard, AI Chat, and Loyalty from app icon
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Feature availability varies by browser and platform. 
          Pet Wash™ gracefully degrades on unsupported devices while providing the 
          best possible experience on modern browsers.
        </p>
      </div>
    </div>
  );
}
