/**
 * Device Telemetry Collector
 * 
 * Captures device metadata for fraud prevention and security monitoring
 * Sends telemetry to backend API for device fingerprinting
 */

import { auth } from '../lib/firebase';

interface DeviceTelemetryData {
  platform: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  browser?: string;
  osVersion?: string;
  browserVersion?: string;
  webauthnCredentialId?: string;
  ipAddress?: string;
  ipLocation?: {
    city?: string;
    country?: string;
    region?: string;
    lat?: number;
    lng?: number;
  };
  wifiSsid?: string;
  wifiBssid?: string;
  userAgent?: string;
  deviceLabel?: string;
  metadata?: any;
}

/**
 * Detect platform from user agent
 */
function detectPlatform(): 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown' {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'iOS';
  } else if (/android/.test(userAgent)) {
    return 'Android';
  } else if (/windows/.test(userAgent)) {
    return 'Windows';
  } else if (/mac/.test(userAgent)) {
    return 'macOS';
  } else if (/linux/.test(userAgent)) {
    return 'Linux';
  }
  
  return 'Unknown';
}

/**
 * Detect browser from user agent
 */
function detectBrowser(): string {
  const userAgent = navigator.userAgent;
  
  if (/edge|edg\//i.test(userAgent)) {
    return 'Edge';
  } else if (/chrome|chromium|crios/i.test(userAgent)) {
    return 'Chrome';
  } else if (/firefox|fxios/i.test(userAgent)) {
    return 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    return 'Safari';
  } else if (/opr\//i.test(userAgent)) {
    return 'Opera';
  }
  
  return 'Unknown';
}

/**
 * Extract browser version
 */
function getBrowserVersion(): string {
  const userAgent = navigator.userAgent;
  let match;
  
  // Chrome
  match = userAgent.match(/(?:Chrome|Chromium)\/(\d+\.\d+)/);
  if (match) return match[1];
  
  // Firefox
  match = userAgent.match(/Firefox\/(\d+\.\d+)/);
  if (match) return match[1];
  
  // Safari
  match = userAgent.match(/Version\/(\d+\.\d+).*Safari/);
  if (match) return match[1];
  
  // Edge
  match = userAgent.match(/(?:Edge|Edg)\/(\d+\.\d+)/);
  if (match) return match[1];
  
  return 'Unknown';
}

/**
 * Extract OS version
 */
function getOSVersion(): string {
  const userAgent = navigator.userAgent;
  const platform = detectPlatform();
  let match;
  
  if (platform === 'iOS') {
    match = userAgent.match(/OS (\d+_\d+)/);
    if (match) return match[1].replace('_', '.');
  } else if (platform === 'Android') {
    match = userAgent.match(/Android (\d+\.\d+)/);
    if (match) return match[1];
  } else if (platform === 'Windows') {
    match = userAgent.match(/Windows NT (\d+\.\d+)/);
    if (match) {
      const ntVersion = match[1];
      // Convert NT version to Windows version
      const windowsVersions: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
      };
      return windowsVersions[ntVersion] || ntVersion;
    }
  } else if (platform === 'macOS') {
    match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (match) return match[1].replace('_', '.');
  }
  
  return 'Unknown';
}

/**
 * Generate a friendly device label
 */
function generateDeviceLabel(): string {
  const platform = detectPlatform();
  const browser = detectBrowser();
  
  // Try to get device name from platform
  if (platform === 'iOS') {
    const userAgent = navigator.userAgent;
    if (/iPad/.test(userAgent)) return 'iPad';
    if (/iPhone/.test(userAgent)) return 'iPhone';
    if (/iPod/.test(userAgent)) return 'iPod';
  }
  
  // Generic label based on platform and browser
  return `${platform} ${browser}`;
}

/**
 * Get WiFi/network information if available
 * Note: This is limited due to browser security/privacy restrictions
 */
async function getNetworkInfo(): Promise<{ ssid?: string; bssid?: string }> {
  try {
    // Network Information API is very limited and doesn't expose WiFi details
    // for privacy reasons. We can only get connection type.
    // SSID and BSSID are not accessible from web browsers
    
    // This is a placeholder - actual WiFi info cannot be obtained from browser
    return {};
  } catch (error) {
    console.debug('[Device Telemetry] Network info not available:', error);
    return {};
  }
}

/**
 * Get IP-based geolocation
 */
async function getIPLocation(): Promise<DeviceTelemetryData['ipLocation'] | null> {
  try {
    // Try multiple geolocation services in order
    const services = [
      'https://ipapi.co/json/',
      'https://ip-api.com/json/',
      'https://ipinfo.io/json',
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service);
        if (!response.ok) continue;
        
        const data = await response.json();
        
        // Normalize response from different services
        return {
          city: data.city,
          country: data.country || data.country_name,
          region: data.region || data.regionName,
          lat: data.latitude || data.lat,
          lng: data.longitude || data.lon,
        };
      } catch (error) {
        console.debug(`[Device Telemetry] Failed to fetch from ${service}:`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.debug('[Device Telemetry] IP location not available:', error);
    return null;
  }
}

/**
 * Collect device telemetry
 */
export async function collectDeviceTelemetry(
  webauthnCredentialId?: string
): Promise<DeviceTelemetryData> {
  const networkInfo = await getNetworkInfo();
  const ipLocation = await getIPLocation();
  
  const telemetry: DeviceTelemetryData = {
    platform: detectPlatform(),
    browser: detectBrowser(),
    osVersion: getOSVersion(),
    browserVersion: getBrowserVersion(),
    userAgent: navigator.userAgent,
    deviceLabel: generateDeviceLabel(),
    webauthnCredentialId,
    wifiSsid: networkInfo.ssid,
    wifiBssid: networkInfo.bssid,
    ipLocation: ipLocation || undefined,
    metadata: {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory, // Not standard but available in some browsers
      maxTouchPoints: navigator.maxTouchPoints,
    },
  };
  
  return telemetry;
}

/**
 * Send device telemetry to backend API
 * Should be called after successful authentication
 */
export async function sendDeviceTelemetry(
  webauthnCredentialId?: string
): Promise<{ success: boolean; isNewDevice?: boolean; fraudScore?: number }> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.debug('[Device Telemetry] No authenticated user, skipping telemetry');
      return { success: false };
    }
    
    // Get Firebase ID token for authentication
    const idToken = await user.getIdToken();
    
    // Collect telemetry
    const telemetry = await collectDeviceTelemetry(webauthnCredentialId);
    
    // Send to backend
    const response = await fetch('/api/devices/fingerprint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(telemetry),
    });
    
    if (!response.ok) {
      console.error('[Device Telemetry] Failed to send telemetry:', response.status);
      return { success: false };
    }
    
    const data = await response.json();
    
    console.info('[Device Telemetry] Telemetry sent successfully', {
      isNewDevice: data.isNewDevice,
      fraudScore: data.fraudScore,
      deviceId: data.device?.id,
    });
    
    // Alert user if this is a new device with high fraud score
    if (data.isNewDevice && data.fraudScore > 50) {
      console.warn('[Device Telemetry] ⚠️ New device with elevated fraud score:', data.fraudScore);
      // Could trigger a security alert to the user here
    }
    
    return {
      success: true,
      isNewDevice: data.isNewDevice,
      fraudScore: data.fraudScore,
    };
  } catch (error) {
    console.error('[Device Telemetry] Error sending telemetry:', error);
    return { success: false };
  }
}

/**
 * Track device on auth state change
 * Automatically sends telemetry when user logs in
 */
export function setupDeviceTracking() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User just signed in, send device telemetry
      await sendDeviceTelemetry();
    }
  });
}
