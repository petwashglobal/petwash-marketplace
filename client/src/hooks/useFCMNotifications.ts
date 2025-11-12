import { useEffect, useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { 
  initializeFCM, 
  requestNotificationPermission, 
  deleteFCMToken,
  areNotificationsSupported,
  getNotificationPermission,
  isVAPIDKeyConfigured
} from '@/lib/fcm-notifications';
import { logger } from '@/lib/logger';

interface FCMNotificationsState {
  supported: boolean;
  permission: NotificationPermission;
  vapidConfigured: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * React hook for managing FCM push notifications
 * Automatically requests permission and registers token after user login
 */
export function useFCMNotifications(autoRequest: boolean = true) {
  const { user } = useFirebaseAuth();
  const [state, setState] = useState<FCMNotificationsState>({
    supported: areNotificationsSupported(),
    permission: getNotificationPermission(),
    vapidConfigured: isVAPIDKeyConfigured(),
    loading: false,
    error: null,
  });

  // Initialize FCM on mount
  useEffect(() => {
    if (state.supported && state.vapidConfigured) {
      initializeFCM();
    }
  }, [state.supported, state.vapidConfigured]);

  // Request notification permission after user logs in
  useEffect(() => {
    if (!user || !autoRequest || !state.supported || !state.vapidConfigured) {
      return;
    }

    // Only auto-request if permission is default (not yet asked)
    if (state.permission === 'default') {
      handleRequestPermission();
    } else if (state.permission === 'granted') {
      // Permission already granted, just register token
      registerToken();
    }
  }, [user, autoRequest, state.supported, state.vapidConfigured]);

  // Clean up token on logout
  useEffect(() => {
    if (!user) {
      return;
    }

    return () => {
      // User logged out, delete FCM token
      deleteFCMToken(user.uid).catch((error) => {
        logger.error('[FCM Hook] Failed to delete token on logout:', error);
      });
    };
  }, [user]);

  const registerToken = async () => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'User not authenticated' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = await requestNotificationPermission(user.uid);
      
      if (token) {
        logger.info('[FCM Hook] Token registered successfully');
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          permission: 'granted',
          error: null 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: 'Failed to get FCM token'
        }));
      }
    } catch (error: any) {
      logger.error('[FCM Hook] Error registering token:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error.message || 'Failed to register for notifications'
      }));
    }
  };

  const handleRequestPermission = async () => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'User not authenticated' }));
      return false;
    }

    if (!state.supported) {
      setState(prev => ({ ...prev, error: 'Notifications not supported in this browser' }));
      return false;
    }

    if (!state.vapidConfigured) {
      setState(prev => ({ ...prev, error: 'VAPID key not configured' }));
      logger.warn('[FCM Hook] VAPID key not configured. Set VITE_FIREBASE_VAPID_KEY in Replit Secrets.');
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = await requestNotificationPermission(user.uid);
      
      if (token) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          permission: 'granted',
          error: null 
        }));
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false,
          permission: Notification.permission,
          error: 'Permission denied or failed to get token'
        }));
        return false;
      }
    } catch (error: any) {
      logger.error('[FCM Hook] Error requesting permission:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        permission: Notification.permission,
        error: error.message || 'Failed to request notification permission'
      }));
      return false;
    }
  };

  return {
    ...state,
    requestPermission: handleRequestPermission,
  };
}
