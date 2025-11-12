/**
 * Modern Web Capabilities 2025
 * 
 * Cutting-edge web platform APIs for 7-star luxury experience
 * - Badge API (notification counts on app icon)
 * - Background Sync (offline-first operations)
 * - Screen Wake Lock (prevent screen dimming during services)
 * - Contact Picker (easy referral sharing)
 * - Advanced Clipboard (rich content sharing)
 * - File System Access (document uploads)
 * - Idle Detection (automatic logout security)
 * - Web Share Target (receive shared content)
 * - Periodic Background Sync (auto-refresh data)
 * - Window Controls Overlay (desktop PWA)
 */

import { logger } from './logger';

// ============================================================================
// 1. BADGE API - App Icon Notification Badges
// ============================================================================

export class AppBadgeService {
  private static instance: AppBadgeService;
  
  static getInstance(): AppBadgeService {
    if (!this.instance) {
      this.instance = new AppBadgeService();
    }
    return this.instance;
  }

  /**
   * Check if Badge API is supported
   */
  isSupported(): boolean {
    return 'setAppBadge' in navigator && 'clearAppBadge' in navigator;
  }

  /**
   * Set badge count on app icon (e.g., unread messages, pending bookings)
   */
  async setBadge(count?: number): Promise<boolean> {
    if (!this.isSupported()) {
      logger.debug('[Badge API] Not supported on this device');
      return false;
    }

    try {
      if (count === undefined || count === 0) {
        await (navigator as any).clearAppBadge();
        logger.debug('[Badge API] Badge cleared');
      } else {
        await (navigator as any).setAppBadge(count);
        logger.debug(`[Badge API] Badge set to ${count}`);
      }
      return true;
    } catch (error) {
      logger.error('[Badge API] Failed to set badge', error);
      return false;
    }
  }

  /**
   * Clear badge from app icon
   */
  async clearBadge(): Promise<boolean> {
    return this.setBadge(0);
  }
}

// ============================================================================
// 2. BACKGROUND SYNC API - Offline-First Operations
// ============================================================================

export class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  
  static getInstance(): BackgroundSyncService {
    if (!this.instance) {
      this.instance = new BackgroundSyncService();
    }
    return this.instance;
  }

  /**
   * Check if Background Sync is supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as any);
  }

  /**
   * Register a background sync task (completes when online)
   */
  async registerSync(tag: string): Promise<boolean> {
    if (!this.isSupported()) {
      logger.debug('[Background Sync] Not supported - operation will run immediately');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      logger.info(`[Background Sync] Registered: ${tag}`);
      return true;
    } catch (error) {
      logger.error('[Background Sync] Registration failed', error);
      return false;
    }
  }

  /**
   * Common sync tags for Pet Wash™
   */
  static readonly SYNC_TAGS = {
    BOOKING: 'sync-booking',
    PAYMENT: 'sync-payment',
    LOYALTY_POINTS: 'sync-loyalty',
    REVIEW: 'sync-review',
    PROFILE_UPDATE: 'sync-profile',
    CHAT_MESSAGE: 'sync-chat',
  };
}

// ============================================================================
// 3. SCREEN WAKE LOCK - Keep Screen Active During Services
// ============================================================================

export class WakeLockService {
  private static instance: WakeLockService;
  private wakeLock: any = null;
  
  static getInstance(): WakeLockService {
    if (!this.instance) {
      this.instance = new WakeLockService();
    }
    return this.instance;
  }

  /**
   * Check if Wake Lock is supported
   */
  isSupported(): boolean {
    return 'wakeLock' in navigator;
  }

  /**
   * Request screen wake lock (prevents screen from turning off)
   * Use case: During active wash session, GPS tracking, QR code scanning
   */
  async requestWakeLock(): Promise<boolean> {
    if (!this.isSupported()) {
      logger.debug('[Wake Lock] Not supported on this device');
      return false;
    }

    try {
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      
      this.wakeLock.addEventListener('release', () => {
        logger.info('[Wake Lock] Released');
      });

      logger.info('[Wake Lock] Activated - screen will stay on');
      return true;
    } catch (error) {
      logger.error('[Wake Lock] Request failed', error);
      return false;
    }
  }

  /**
   * Release wake lock (allow screen to sleep)
   */
  async releaseWakeLock(): Promise<boolean> {
    if (!this.wakeLock) {
      return false;
    }

    try {
      await this.wakeLock.release();
      this.wakeLock = null;
      logger.info('[Wake Lock] Released manually');
      return true;
    } catch (error) {
      logger.error('[Wake Lock] Release failed', error);
      return false;
    }
  }

  /**
   * Check if wake lock is currently active
   */
  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}

// ============================================================================
// 4. CONTACT PICKER API - Easy Friend Referrals
// ============================================================================

export class ContactPickerService {
  private static instance: ContactPickerService;
  
  static getInstance(): ContactPickerService {
    if (!this.instance) {
      this.instance = new ContactPickerService();
    }
    return this.instance;
  }

  /**
   * Check if Contact Picker is supported
   */
  isSupported(): boolean {
    return 'contacts' in navigator && 'ContactsManager' in window;
  }

  /**
   * Pick contacts for referral sharing
   * Returns selected contacts with name, email, phone
   */
  async pickContacts(options?: {
    multiple?: boolean;
  }): Promise<any[]> {
    if (!this.isSupported()) {
      logger.debug('[Contact Picker] Not supported on this device');
      return [];
    }

    try {
      const props = ['name', 'email', 'tel'];
      const opts = { multiple: options?.multiple ?? true };

      const contacts = await (navigator as any).contacts.select(props, opts);
      
      logger.info(`[Contact Picker] Selected ${contacts.length} contacts`);
      return contacts;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('[Contact Picker] User cancelled');
      } else {
        logger.error('[Contact Picker] Failed', error);
      }
      return [];
    }
  }

  /**
   * Get supported properties for contact picker
   */
  async getSupportedProperties(): Promise<string[]> {
    if (!this.isSupported()) {
      return [];
    }

    try {
      const properties = await (navigator as any).contacts.getProperties();
      return properties;
    } catch (error) {
      logger.error('[Contact Picker] Failed to get properties', error);
      return [];
    }
  }
}

// ============================================================================
// 5. ADVANCED CLIPBOARD API - Rich Content Sharing
// ============================================================================

export class ClipboardService {
  private static instance: ClipboardService;
  
  static getInstance(): ClipboardService {
    if (!this.instance) {
      this.instance = new ClipboardService();
    }
    return this.instance;
  }

  /**
   * Check if Clipboard API is supported
   */
  isSupported(): boolean {
    return 'clipboard' in navigator;
  }

  /**
   * Copy text to clipboard
   */
  async copyText(text: string): Promise<boolean> {
    if (!this.isSupported()) {
      return this.fallbackCopyText(text);
    }

    try {
      await navigator.clipboard.writeText(text);
      logger.debug('[Clipboard] Text copied');
      return true;
    } catch (error) {
      logger.error('[Clipboard] Copy failed', error);
      return this.fallbackCopyText(text);
    }
  }

  /**
   * Copy rich content (HTML, images) to clipboard
   */
  async copyRichContent(items: ClipboardItems): Promise<boolean> {
    if (!this.isSupported() || !('write' in navigator.clipboard)) {
      logger.debug('[Clipboard] Rich content not supported');
      return false;
    }

    try {
      await navigator.clipboard.write(items);
      logger.debug('[Clipboard] Rich content copied');
      return true;
    } catch (error) {
      logger.error('[Clipboard] Rich copy failed', error);
      return false;
    }
  }

  /**
   * Read text from clipboard
   */
  async readText(): Promise<string | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      logger.debug('[Clipboard] Text read');
      return text;
    } catch (error) {
      logger.error('[Clipboard] Read failed', error);
      return null;
    }
  }

  /**
   * Fallback for older browsers
   */
  private fallbackCopyText(text: string): boolean {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
      logger.debug('[Clipboard] Fallback copy successful');
      return true;
    } catch (error) {
      textArea.remove();
      logger.error('[Clipboard] Fallback copy failed', error);
      return false;
    }
  }
}

// ============================================================================
// 6. FILE SYSTEM ACCESS API - Document Uploads
// ============================================================================

export class FileSystemService {
  private static instance: FileSystemService;
  
  static getInstance(): FileSystemService {
    if (!this.instance) {
      this.instance = new FileSystemService();
    }
    return this.instance;
  }

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  /**
   * Open file picker and return selected files
   */
  async pickFiles(options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<File[]> {
    if (!this.isSupported()) {
      logger.debug('[File System] Not supported - using fallback');
      return this.fallbackPickFiles(options);
    }

    try {
      const handles = await (window as any).showOpenFilePicker({
        multiple: options?.multiple ?? false,
        types: options?.types,
      });

      const files: File[] = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        files.push(file);
      }

      logger.info(`[File System] Selected ${files.length} files`);
      return files;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('[File System] User cancelled');
      } else {
        logger.error('[File System] Failed', error);
      }
      return [];
    }
  }

  /**
   * Save file with custom name
   */
  async saveFile(blob: Blob, suggestedName: string): Promise<boolean> {
    if (!this.isSupported()) {
      return this.fallbackSaveFile(blob, suggestedName);
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      logger.info('[File System] File saved successfully');
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('[File System] Save cancelled');
      } else {
        logger.error('[File System] Save failed', error);
      }
      return false;
    }
  }

  /**
   * Fallback file picker using input element
   */
  private fallbackPickFiles(options?: { multiple?: boolean }): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple ?? false;
      
      input.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        resolve(files);
      };
      
      input.click();
    });
  }

  /**
   * Fallback file save using download link
   */
  private fallbackSaveFile(blob: Blob, filename: string): boolean {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      logger.error('[File System] Fallback save failed', error);
      return false;
    }
  }
}

// ============================================================================
// 7. IDLE DETECTION API - Automatic Security Logout
// ============================================================================

export class IdleDetectionService {
  private static instance: IdleDetectionService;
  private idleDetector: any = null;
  private onIdleCallback?: () => void;
  
  static getInstance(): IdleDetectionService {
    if (!this.instance) {
      this.instance = new IdleDetectionService();
    }
    return this.instance;
  }

  /**
   * Check if Idle Detection is supported
   */
  isSupported(): boolean {
    return 'IdleDetector' in window;
  }

  /**
   * Start idle detection
   * @param threshold - Idle time in milliseconds (default: 5 minutes)
   * @param onIdle - Callback when user becomes idle
   */
  async startDetection(threshold: number = 300000, onIdle?: () => void): Promise<boolean> {
    if (!this.isSupported()) {
      logger.debug('[Idle Detection] Not supported on this device');
      return false;
    }

    try {
      const IdleDetector = (window as any).IdleDetector;
      this.idleDetector = new IdleDetector();
      this.onIdleCallback = onIdle;

      this.idleDetector.addEventListener('change', () => {
        const userState = this.idleDetector.userState;
        const screenState = this.idleDetector.screenState;
        
        logger.debug(`[Idle Detection] User: ${userState}, Screen: ${screenState}`);

        if (userState === 'idle' && this.onIdleCallback) {
          this.onIdleCallback();
        }
      });

      await this.idleDetector.start({
        threshold,
        signal: new AbortController().signal,
      });

      logger.info(`[Idle Detection] Started (threshold: ${threshold}ms)`);
      return true;
    } catch (error) {
      logger.error('[Idle Detection] Failed to start', error);
      return false;
    }
  }

  /**
   * Stop idle detection
   */
  stopDetection(): void {
    if (this.idleDetector) {
      this.idleDetector.stop?.();
      this.idleDetector = null;
      logger.info('[Idle Detection] Stopped');
    }
  }
}

// ============================================================================
// 8. WEB SHARE TARGET API - Receive Shared Content
// ============================================================================

export class ShareTargetService {
  /**
   * Check if app is launched as share target
   */
  static isShareTarget(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('share-target');
  }

  /**
   * Get shared data from URL params
   */
  static getSharedData(): {
    title?: string;
    text?: string;
    url?: string;
  } | null {
    if (!this.isShareTarget()) {
      return null;
    }

    const params = new URLSearchParams(window.location.search);
    return {
      title: params.get('title') || undefined,
      text: params.get('text') || undefined,
      url: params.get('url') || undefined,
    };
  }
}

// ============================================================================
// 9. PERIODIC BACKGROUND SYNC - Auto-Refresh Data
// ============================================================================

export class PeriodicSyncService {
  private static instance: PeriodicSyncService;
  
  static getInstance(): PeriodicSyncService {
    if (!this.instance) {
      this.instance = new PeriodicSyncService();
    }
    return this.instance;
  }

  /**
   * Check if Periodic Background Sync is supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'periodicSync' in (ServiceWorkerRegistration.prototype as any);
  }

  /**
   * Register periodic sync (e.g., refresh loyalty points, check bookings)
   * @param tag - Unique identifier for the sync
   * @param minInterval - Minimum interval in milliseconds (browser decides actual frequency)
   */
  async registerPeriodicSync(tag: string, minInterval: number = 86400000): Promise<boolean> {
    if (!this.isSupported()) {
      logger.debug('[Periodic Sync] Not supported on this device');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const status = await (navigator as any).permissions.query({
        name: 'periodic-background-sync',
      });

      if (status.state === 'granted') {
        await (registration as any).periodicSync.register(tag, {
          minInterval,
        });
        logger.info(`[Periodic Sync] Registered: ${tag} (interval: ${minInterval}ms)`);
        return true;
      } else {
        logger.debug('[Periodic Sync] Permission not granted');
        return false;
      }
    } catch (error) {
      logger.error('[Periodic Sync] Registration failed', error);
      return false;
    }
  }

  /**
   * Unregister periodic sync
   */
  async unregisterPeriodicSync(tag: string): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).periodicSync.unregister(tag);
      logger.info(`[Periodic Sync] Unregistered: ${tag}`);
      return true;
    } catch (error) {
      logger.error('[Periodic Sync] Unregister failed', error);
      return false;
    }
  }

  /**
   * Get list of registered periodic syncs
   */
  async getTags(): Promise<string[]> {
    if (!this.isSupported()) {
      return [];
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const tags = await (registration as any).periodicSync.getTags();
      return tags;
    } catch (error) {
      logger.error('[Periodic Sync] Failed to get tags', error);
      return [];
    }
  }

  /**
   * Common periodic sync tags
   */
  static readonly SYNC_TAGS = {
    LOYALTY_REFRESH: 'periodic-loyalty',
    BOOKING_CHECK: 'periodic-bookings',
    NOTIFICATIONS: 'periodic-notifications',
    WEATHER_UPDATE: 'periodic-weather',
  };
}

// ============================================================================
// UNIFIED API - Single Interface for All Modern Features
// ============================================================================

export const modernWebCapabilities = {
  badge: AppBadgeService.getInstance(),
  backgroundSync: BackgroundSyncService.getInstance(),
  wakeLock: WakeLockService.getInstance(),
  contacts: ContactPickerService.getInstance(),
  clipboard: ClipboardService.getInstance(),
  fileSystem: FileSystemService.getInstance(),
  idleDetection: IdleDetectionService.getInstance(),
  shareTarget: ShareTargetService,
  periodicSync: PeriodicSyncService.getInstance(),
};

// Export individual services
export {
  AppBadgeService,
  BackgroundSyncService,
  WakeLockService,
  ContactPickerService,
  ClipboardService,
  FileSystemService,
  IdleDetectionService,
  ShareTargetService,
  PeriodicSyncService,
};
