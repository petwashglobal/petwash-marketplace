import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Beautiful Mobile Notification Permission Prompt
 * 
 * Features:
 * - iOS/Android push notification support
 * - Apple-style glassmorphism design
 * - Responsive across all screen sizes
 * - Auto-dismisses after permission granted
 * - Remembers user's choice (don't ask again)
 * - Works on iPhone, Samsung, all devices
 */
export function NotificationPermissionPrompt() {
  const { user } = useFirebaseAuth();
  const { supported, permission, vapidConfigured, loading, requestPermission } = useFCMNotifications(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Don't show if user not logged in
    if (!user) {
      setIsVisible(false);
      return;
    }

    // Don't show if notifications not supported
    if (!supported || !vapidConfigured) {
      setIsVisible(false);
      return;
    }

    // Don't show if permission already granted
    if (permission === 'granted') {
      setIsVisible(false);
      return;
    }

    // Don't show if user already denied
    if (permission === 'denied') {
      setIsVisible(false);
      return;
    }

    // Check if user previously dismissed the prompt
    const dismissedAt = localStorage.getItem('notification_prompt_dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      // Ask again after 7 days
      if (daysSinceDismissed < 7) {
        setIsVisible(false);
        return;
      }
    }

    // Show prompt after 3 seconds (non-intrusive)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, supported, vapidConfigured, permission]);

  const handleAllow = async () => {
    setHasInteracted(true);
    const granted = await requestPermission();
    
    if (granted) {
      // Success! Hide prompt
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setHasInteracted(true);
    localStorage.setItem('notification_prompt_dismissed', Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
        data-testid="notification-permission-prompt"
      >
        <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background/95 via-background/90 to-primary/5 backdrop-blur-xl shadow-2xl">
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
          
          <div className="relative p-6">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full hover:bg-destructive/20 dark:hover:bg-destructive/30"
              onClick={handleDismiss}
              data-testid="button-dismiss-notifications"
              aria-label="Dismiss notification prompt"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Icon */}
            <div className="mb-4 flex items-center justify-center">
              <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-4">
                <Bell className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold mb-2 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                Stay Updated! 🔔
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get instant notifications for bookings, payments, ride updates, and important alerts on your <span className="font-semibold text-foreground">iOS or Android device</span>.
              </p>
            </div>

            {/* Device compatibility badges */}
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-medium">
                <Smartphone className="h-3.5 w-3.5" />
                <span>iPhone</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-medium">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Samsung</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-medium">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Android</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAllow}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary hover:from-primary/90 hover:via-primary/80 hover:to-primary/90 shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="button-allow-notifications"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Enabling...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Enable Notifications
                  </span>
                )}
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="w-full hover:bg-muted/50"
                data-testid="button-not-now"
              >
                <BellOff className="h-4 w-4 mr-2" />
                Not Now
              </Button>
            </div>

            {/* Privacy note */}
            <p className="text-xs text-center text-muted-foreground mt-4">
              We respect your privacy. You can change this anytime in Settings.
            </p>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact notification status indicator (for settings page)
 */
export function NotificationStatusBadge() {
  const { supported, permission, vapidConfigured } = useFCMNotifications(false);

  if (!supported || !vapidConfigured) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs">
        <BellOff className="h-3.5 w-3.5" />
        <span>Not Supported</span>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium">
        <Bell className="h-3.5 w-3.5" />
        <span>Enabled</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium">
        <BellOff className="h-3.5 w-3.5" />
        <span>Blocked</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
      <Bell className="h-3.5 w-3.5" />
      <span>Not Enabled</span>
    </div>
  );
}
