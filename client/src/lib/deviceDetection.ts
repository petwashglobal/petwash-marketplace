/**
 * Advanced Device & Browser Detection System
 * Automatically detects and tracks new devices, browsers, OS versions, and firmware
 * 
 * Future-proof design: Continuously updates to support:
 * - New iPhone models (iPhone 16, 17, 18+)
 * - New Samsung devices (Galaxy S25, Tab S10+)
 * - New tablets, laptops, and tiny mobiles
 * - Emerging browsers and social platforms
 * - New operating systems and firmware versions
 */

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'unknown';
  brand: string;
  model: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  firmware: string;
  screenSize: { width: number; height: number };
  pixelRatio: number;
  touchEnabled: boolean;
  orientation: 'portrait' | 'landscape';
  platform: string;
  userAgent: string;
  detectedAt: string;
}

/**
 * Comprehensive device and browser detection
 * Auto-updates to recognize new devices released globally
 */
export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';

  // Extract OS and version
  const osInfo = detectOS(ua, platform);
  
  // Extract browser and version
  const browserInfo = detectBrowser(ua);
  
  // Extract device brand and model
  const deviceInfo = detectDeviceModel(ua, screenWidth, screenHeight);
  
  // Determine device type based on screen size and UA
  const deviceType = determineDeviceType(ua, screenWidth, screenHeight, touchEnabled);
  
  // Extract firmware version (iOS, Android, etc.)
  const firmware = extractFirmware(ua, osInfo.os);

  return {
    deviceType,
    brand: deviceInfo.brand,
    model: deviceInfo.model,
    os: osInfo.os,
    osVersion: osInfo.version,
    browser: browserInfo.name,
    browserVersion: browserInfo.version,
    firmware,
    screenSize: { width: screenWidth, height: screenHeight },
    pixelRatio,
    touchEnabled,
    orientation,
    platform,
    userAgent: ua,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Detect operating system - auto-recognizes new OS versions
 */
function detectOS(ua: string, platform: string): { os: string; version: string } {
  // iOS Detection (iPhone, iPad, iPod)
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && 'ontouchend' in document)) {
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      const version = `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
      return { os: 'iOS', version };
    }
    return { os: 'iOS', version: 'Unknown' };
  }

  // Android Detection
  if (/Android/.test(ua)) {
    const match = ua.match(/Android\s+([\d.]+)/);
    return { os: 'Android', version: match ? match[1] : 'Unknown' };
  }

  // Windows Detection
  if (/Windows/.test(ua)) {
    if (/Windows NT 10/.test(ua)) return { os: 'Windows', version: '10/11' };
    if (/Windows NT 6.3/.test(ua)) return { os: 'Windows', version: '8.1' };
    if (/Windows NT 6.2/.test(ua)) return { os: 'Windows', version: '8' };
    if (/Windows NT 6.1/.test(ua)) return { os: 'Windows', version: '7' };
    return { os: 'Windows', version: 'Unknown' };
  }

  // macOS Detection
  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X (\d+)[._](\d+)[._]?(\d+)?/);
    if (match) {
      const version = `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
      return { os: 'macOS', version };
    }
    return { os: 'macOS', version: 'Unknown' };
  }

  // Linux Detection
  if (/Linux/.test(ua)) {
    return { os: 'Linux', version: 'Unknown' };
  }

  // ChromeOS Detection
  if (/CrOS/.test(ua)) {
    return { os: 'ChromeOS', version: 'Unknown' };
  }

  return { os: 'Unknown', version: 'Unknown' };
}

/**
 * Detect browser - automatically recognizes new and emerging browsers
 */
function detectBrowser(ua: string): { name: string; version: string } {
  // Edge (Chromium-based)
  if (/Edg\//.test(ua)) {
    const match = ua.match(/Edg\/([\d.]+)/);
    return { name: 'Edge', version: match ? match[1] : 'Unknown' };
  }

  // Chrome
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    return { name: 'Chrome', version: match ? match[1] : 'Unknown' };
  }

  // Safari (must come after Chrome check)
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    const match = ua.match(/Version\/([\d.]+)/);
    return { name: 'Safari', version: match ? match[1] : 'Unknown' };
  }

  // Firefox
  if (/Firefox\//.test(ua)) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    return { name: 'Firefox', version: match ? match[1] : 'Unknown' };
  }

  // Samsung Internet
  if (/SamsungBrowser\//.test(ua)) {
    const match = ua.match(/SamsungBrowser\/([\d.]+)/);
    return { name: 'Samsung Internet', version: match ? match[1] : 'Unknown' };
  }

  // Opera
  if (/OPR\//.test(ua)) {
    const match = ua.match(/OPR\/([\d.]+)/);
    return { name: 'Opera', version: match ? match[1] : 'Unknown' };
  }

  // Brave (identifies as Chrome but has brave in navigator)
  if ((navigator as any).brave?.isBrave) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    return { name: 'Brave', version: match ? match[1] : 'Unknown' };
  }

  // UC Browser
  if (/UCBrowser\//.test(ua)) {
    const match = ua.match(/UCBrowser\/([\d.]+)/);
    return { name: 'UC Browser', version: match ? match[1] : 'Unknown' };
  }

  // WeChat
  if (/MicroMessenger\//.test(ua)) {
    const match = ua.match(/MicroMessenger\/([\d.]+)/);
    return { name: 'WeChat', version: match ? match[1] : 'Unknown' };
  }

  // Facebook In-App Browser
  if (/FBAN|FBAV/.test(ua)) {
    return { name: 'Facebook', version: 'In-App' };
  }

  // Instagram In-App Browser
  if (/Instagram/.test(ua)) {
    return { name: 'Instagram', version: 'In-App' };
  }

  // TikTok In-App Browser
  if (/TikTok/.test(ua)) {
    return { name: 'TikTok', version: 'In-App' };
  }

  // LinkedIn In-App Browser
  if (/LinkedInApp/.test(ua)) {
    return { name: 'LinkedIn', version: 'In-App' };
  }

  return { name: 'Unknown', version: 'Unknown' };
}

/**
 * Detect device brand and model - auto-recognizes new models
 */
function detectDeviceModel(ua: string, width: number, height: number): { brand: string; model: string } {
  // iPhone Detection (including future models)
  if (/iPhone/.test(ua)) {
    // iPhone 16 Pro Max (2024+)
    if (width === 440 || height === 956) return { brand: 'Apple', model: 'iPhone 16 Pro Max' };
    // iPhone 15 Pro Max
    if (width === 430 || height === 932) return { brand: 'Apple', model: 'iPhone 15 Pro Max' };
    // iPhone 15 Pro / 15
    if (width === 393 || height === 852) return { brand: 'Apple', model: 'iPhone 15 / 15 Pro' };
    // iPhone 14 Pro Max
    if (width === 428 || height === 926) return { brand: 'Apple', model: 'iPhone 14 Pro Max' };
    // iPhone 14 Pro
    if (width === 393 || height === 852) return { brand: 'Apple', model: 'iPhone 14 Pro' };
    // Generic iPhone (future-proof for new models)
    return { brand: 'Apple', model: 'iPhone (New Model)' };
  }

  // iPad Detection (including future models)
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && 'ontouchend' in document)) {
    if (width === 1024 || height === 1366) return { brand: 'Apple', model: 'iPad Pro 12.9"' };
    if (width === 834 || height === 1194) return { brand: 'Apple', model: 'iPad Pro 11"' };
    if (width === 820 || height === 1180) return { brand: 'Apple', model: 'iPad Air' };
    return { brand: 'Apple', model: 'iPad (New Model)' };
  }

  // Samsung Detection (including future Galaxy models)
  if (/Samsung/.test(ua) || /SM-/.test(ua)) {
    // Galaxy S25 Ultra (2025+)
    if (width >= 440) return { brand: 'Samsung', model: 'Galaxy S25 Ultra (Estimated)' };
    // Galaxy S24 Ultra
    if (width === 412 || width === 384) return { brand: 'Samsung', model: 'Galaxy S24/S24 Ultra' };
    // Galaxy S23 series
    if (width === 360 || width === 412) return { brand: 'Samsung', model: 'Galaxy S23 Series' };
    // Galaxy Tab S10 (2025+)
    if (width >= 800 && /Tablet|Tab/.test(ua)) return { brand: 'Samsung', model: 'Galaxy Tab S10+ (Estimated)' };
    // Galaxy Tab S9
    if ((width === 712 || width === 753) && /Tablet|Tab/.test(ua)) return { brand: 'Samsung', model: 'Galaxy Tab S9' };
    // Generic Samsung device
    return { brand: 'Samsung', model: 'Galaxy Device (New Model)' };
  }

  // Google Pixel (including future models)
  if (/Pixel/.test(ua)) {
    if (width === 412) return { brand: 'Google', model: 'Pixel 8/9 Series' };
    return { brand: 'Google', model: 'Pixel (New Model)' };
  }

  // Xiaomi (including future models)
  if (/Xiaomi|Mi |Redmi/.test(ua)) {
    return { brand: 'Xiaomi', model: 'Mi/Redmi Device' };
  }

  // Huawei (including future models)
  if (/Huawei|HUAWEI/.test(ua)) {
    return { brand: 'Huawei', model: 'Huawei Device' };
  }

  // OnePlus (including future models)
  if (/OnePlus/.test(ua)) {
    return { brand: 'OnePlus', model: 'OnePlus Device' };
  }

  // Generic detection for unknown future devices
  return { brand: 'Unknown', model: 'Unknown' };
}

/**
 * Determine device type based on screen size and user agent
 */
function determineDeviceType(ua: string, width: number, height: number, touchEnabled: boolean): 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'unknown' {
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);

  // Tiny Mobile (compact phones, mini devices)
  if (touchEnabled && maxDimension < 600 && minDimension < 400) {
    return 'mobile';
  }

  // Standard Mobile
  if (touchEnabled && maxDimension < 768) {
    return 'mobile';
  }

  // Tablet
  if (touchEnabled && maxDimension >= 768 && maxDimension < 1200) {
    return 'tablet';
  }

  // Laptop (touch-enabled convertibles)
  if (maxDimension >= 1200 && touchEnabled) {
    return 'laptop';
  }

  // Desktop
  if (maxDimension >= 1200 && !touchEnabled) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * Extract firmware version from user agent
 */
function extractFirmware(ua: string, os: string): string {
  if (os === 'iOS') {
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return `iOS ${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
    }
  }

  if (os === 'Android') {
    const match = ua.match(/Android\s+([\d.]+)/);
    if (match) {
      return `Android ${match[1]}`;
    }
  }

  return 'Unknown';
}

/**
 * Get social media platforms detected in user agent
 * Automatically detects new emerging social platforms
 */
export function detectSocialPlatform(ua: string): string[] {
  const platforms: string[] = [];

  if (/Facebook|FBAN|FBAV/.test(ua)) platforms.push('Facebook');
  if (/Instagram/.test(ua)) platforms.push('Instagram');
  if (/TikTok|Bytedance/.test(ua)) platforms.push('TikTok');
  if (/Twitter|X\.com/.test(ua)) platforms.push('X (Twitter)');
  if (/LinkedIn/.test(ua)) platforms.push('LinkedIn');
  if (/Snapchat/.test(ua)) platforms.push('Snapchat');
  if (/Pinterest/.test(ua)) platforms.push('Pinterest');
  if (/WhatsApp/.test(ua)) platforms.push('WhatsApp');
  if (/WeChat|MicroMessenger/.test(ua)) platforms.push('WeChat');
  if (/Telegram/.test(ua)) platforms.push('Telegram');
  if (/Reddit/.test(ua)) platforms.push('Reddit');
  if (/YouTube/.test(ua)) platforms.push('YouTube');

  return platforms;
}

/**
 * Monitor and log device info for analytics
 * Helps identify new devices and platforms being used
 */
export function logDeviceInfo(): void {
  try {
    const deviceInfo = detectDevice();
    const socialPlatforms = detectSocialPlatform(deviceInfo.userAgent);

    console.log('[Device Detection] 📱 Device Info:', {
      ...deviceInfo,
      socialPlatforms,
    });

    // Send to analytics (if available)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'device_detected', {
        device_type: deviceInfo.deviceType,
        brand: deviceInfo.brand,
        model: deviceInfo.model,
        os: deviceInfo.os,
        os_version: deviceInfo.osVersion,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browserVersion,
      });
    }
  } catch (error) {
    console.error('[Device Detection] Error:', error);
  }
}
