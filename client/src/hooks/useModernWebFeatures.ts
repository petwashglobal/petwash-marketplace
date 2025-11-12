/**
 * React Hooks for Modern Web Capabilities 2025
 * 
 * Easy-to-use hooks for cutting-edge web platform features
 */

import { useState, useEffect, useCallback } from 'react';
import { modernWebCapabilities } from '@/lib/modernWebCapabilities';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for App Badge API
 * Automatically manages notification badges on app icon
 */
export function useAppBadge() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.badge.isSupported());
  }, []);

  const setBadge = useCallback(async (count?: number) => {
    return await modernWebCapabilities.badge.setBadge(count);
  }, []);

  const clearBadge = useCallback(async () => {
    return await modernWebCapabilities.badge.clearBadge();
  }, []);

  return {
    isSupported,
    setBadge,
    clearBadge,
  };
}

/**
 * Hook for Background Sync API
 * Queue operations to complete when device is online
 */
export function useBackgroundSync() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.backgroundSync.isSupported());
  }, []);

  const registerSync = useCallback(async (tag: string) => {
    return await modernWebCapabilities.backgroundSync.registerSync(tag);
  }, []);

  return {
    isSupported,
    registerSync,
  };
}

/**
 * Hook for Screen Wake Lock
 * Keeps screen active during critical operations
 */
export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.wakeLock.isSupported());
  }, []);

  const requestWakeLock = useCallback(async () => {
    const success = await modernWebCapabilities.wakeLock.requestWakeLock();
    if (success) {
      setIsActive(true);
    }
    return success;
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const success = await modernWebCapabilities.wakeLock.releaseWakeLock();
    if (success) {
      setIsActive(false);
    }
    return success;
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        modernWebCapabilities.wakeLock.releaseWakeLock();
      }
    };
  }, [isActive]);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
}

/**
 * Hook for Contact Picker API
 * Select contacts for referrals and sharing
 */
export function useContactPicker() {
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsSupported(modernWebCapabilities.contacts.isSupported());
  }, []);

  const pickContacts = useCallback(async (options?: { multiple?: boolean }) => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Contact picker is not available on this device",
        variant: "destructive",
      });
      return [];
    }

    const contacts = await modernWebCapabilities.contacts.pickContacts(options);
    
    if (contacts.length > 0) {
      toast({
        title: "Contacts Selected",
        description: `Selected ${contacts.length} contact${contacts.length > 1 ? 's' : ''}`,
      });
    }

    return contacts;
  }, [isSupported, toast]);

  return {
    isSupported,
    pickContacts,
  };
}

/**
 * Hook for Advanced Clipboard
 * Copy/paste text and rich content
 */
export function useClipboard() {
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsSupported(modernWebCapabilities.clipboard.isSupported());
  }, []);

  const copyText = useCallback(async (text: string, showToast = true) => {
    const success = await modernWebCapabilities.clipboard.copyText(text);
    
    if (success && showToast) {
      toast({
        title: "Copied!",
        description: "Text copied to clipboard",
      });
    }

    return success;
  }, [toast]);

  const readText = useCallback(async () => {
    return await modernWebCapabilities.clipboard.readText();
  }, []);

  return {
    isSupported,
    copyText,
    readText,
  };
}

/**
 * Hook for File System Access
 * Modern file uploads and downloads
 */
export function useFileSystem() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.fileSystem.isSupported());
  }, []);

  const pickFiles = useCallback(async (options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => {
    return await modernWebCapabilities.fileSystem.pickFiles(options);
  }, []);

  const saveFile = useCallback(async (blob: Blob, filename: string) => {
    return await modernWebCapabilities.fileSystem.saveFile(blob, filename);
  }, []);

  return {
    isSupported,
    pickFiles,
    saveFile,
  };
}

/**
 * Hook for Idle Detection
 * Automatically detect when user is inactive
 */
export function useIdleDetection(onIdle?: () => void, threshold: number = 300000) {
  const [isSupported, setIsSupported] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.idleDetection.isSupported());
  }, []);

  const startDetection = useCallback(async () => {
    const success = await modernWebCapabilities.idleDetection.startDetection(
      threshold,
      onIdle
    );
    if (success) {
      setIsDetecting(true);
    }
    return success;
  }, [onIdle, threshold]);

  const stopDetection = useCallback(() => {
    modernWebCapabilities.idleDetection.stopDetection();
    setIsDetecting(false);
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (isDetecting) {
        stopDetection();
      }
    };
  }, [isDetecting, stopDetection]);

  return {
    isSupported,
    isDetecting,
    startDetection,
    stopDetection,
  };
}

/**
 * Hook for Periodic Background Sync
 * Auto-refresh data in the background
 */
export function usePeriodicSync() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(modernWebCapabilities.periodicSync.isSupported());
  }, []);

  const registerSync = useCallback(async (tag: string, minInterval?: number) => {
    return await modernWebCapabilities.periodicSync.registerPeriodicSync(tag, minInterval);
  }, []);

  const unregisterSync = useCallback(async (tag: string) => {
    return await modernWebCapabilities.periodicSync.unregisterPeriodicSync(tag);
  }, []);

  const getTags = useCallback(async () => {
    return await modernWebCapabilities.periodicSync.getTags();
  }, []);

  return {
    isSupported,
    registerSync,
    unregisterSync,
    getTags,
  };
}

/**
 * Hook to check all modern web capabilities support
 * Useful for feature detection and progressive enhancement
 */
export function useModernWebSupport() {
  const [support, setSupport] = useState({
    badge: false,
    backgroundSync: false,
    wakeLock: false,
    contacts: false,
    clipboard: false,
    fileSystem: false,
    idleDetection: false,
    periodicSync: false,
  });

  useEffect(() => {
    setSupport({
      badge: modernWebCapabilities.badge.isSupported(),
      backgroundSync: modernWebCapabilities.backgroundSync.isSupported(),
      wakeLock: modernWebCapabilities.wakeLock.isSupported(),
      contacts: modernWebCapabilities.contacts.isSupported(),
      clipboard: modernWebCapabilities.clipboard.isSupported(),
      fileSystem: modernWebCapabilities.fileSystem.isSupported(),
      idleDetection: modernWebCapabilities.idleDetection.isSupported(),
      periodicSync: modernWebCapabilities.periodicSync.isSupported(),
    });
  }, []);

  const supportedCount = Object.values(support).filter(Boolean).length;
  const totalCount = Object.keys(support).length;
  const supportPercentage = Math.round((supportedCount / totalCount) * 100);

  return {
    support,
    supportedCount,
    totalCount,
    supportPercentage,
  };
}
