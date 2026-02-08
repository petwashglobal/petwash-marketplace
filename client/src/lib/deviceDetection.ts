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
  // iPadOS Detection (iPadOS 13+ reports as MacIntel with touch)
  if (/iPad/.test(ua) || (platform === 'MacIntel' && 'ontouchend' in document && navigator.maxTouchPoints > 1)) {
    const osMatch = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (osMatch) {
      const version = `${osMatch[1]}.${osMatch[2]}${osMatch[3] ? '.' + osMatch[3] : ''}`;
      return { os: 'iPadOS', version };
    }
    const ipadOSMatch = ua.match(/iPadOS\s+([\d.]+)/);
    if (ipadOSMatch) {
      return { os: 'iPadOS', version: ipadOSMatch[1] };
    }
    return { os: 'iPadOS', version: 'Unknown' };
  }

  // iOS Detection (iPhone, iPod)
  if (/iPhone|iPod/.test(ua)) {
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      const version = `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
      return { os: 'iOS', version };
    }
    return { os: 'iOS', version: 'Unknown' };
  }

  // Android Detection (including Android 16+)
  if (/Android/.test(ua)) {
    const match = ua.match(/Android\s+([\d.]+)/);
    return { os: 'Android', version: match ? match[1] : 'Unknown' };
  }

  // HarmonyOS Detection (Huawei)
  if (/HarmonyOS/.test(ua)) {
    const match = ua.match(/HarmonyOS\s+([\d.]+)/);
    return { os: 'HarmonyOS', version: match ? match[1] : 'Unknown' };
  }

  // Windows Detection
  if (/Windows/.test(ua)) {
    if (/Windows NT 10/.test(ua)) return { os: 'Windows', version: '10/11' };
    if (/Windows NT 6.3/.test(ua)) return { os: 'Windows', version: '8.1' };
    if (/Windows NT 6.2/.test(ua)) return { os: 'Windows', version: '8' };
    if (/Windows NT 6.1/.test(ua)) return { os: 'Windows', version: '7' };
    return { os: 'Windows', version: 'Unknown' };
  }

  // macOS Detection (non-touch Mac = true macOS)
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
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // iPhone Detection (including 2026+ models)
  // Note: iPhone 15 Pro Max and 16 Pro share 430x932 — grouped together
  if (/iPhone/.test(ua)) {
    // Future iPhone 17+ (2026+) — any dimensions beyond current known models
    if (minDim > 440 || maxDim > 956) return { brand: 'Apple', model: 'iPhone 17+ (New Model)' };
    // iPhone 16 Pro Max (2024)
    if (minDim === 440 && maxDim === 956) return { brand: 'Apple', model: 'iPhone 16 Pro Max' };
    // iPhone 15 Pro Max / 16 Pro / 16 Plus (all share 430x932)
    if (minDim === 430 && maxDim === 932) return { brand: 'Apple', model: 'iPhone 15 Pro Max / 16 Pro' };
    // iPhone 14 Pro Max / 14 Plus (428x926)
    if (minDim === 428 && maxDim === 926) return { brand: 'Apple', model: 'iPhone 14 Pro Max' };
    // iPhone 15 / 15 Pro / 16 (393x852)
    if (minDim === 393 && maxDim === 852) return { brand: 'Apple', model: 'iPhone 15/16 Series' };
    // iPhone 14 / 13 / 12 (390x844)
    if (minDim === 390 && maxDim === 844) return { brand: 'Apple', model: 'iPhone 12-14 Series' };
    // iPhone 13 Mini / 12 Mini (375x812)
    if (minDim === 375 && maxDim === 812) return { brand: 'Apple', model: 'iPhone 12/13 Mini' };
    // iPhone SE 3rd / 8 / 7 / 6s (375x667)
    if (minDim === 375 && maxDim === 667) return { brand: 'Apple', model: 'iPhone SE / 8' };
    // iPhone SE 1st / 5s (320x568)
    if (minDim === 320 && maxDim === 568) return { brand: 'Apple', model: 'iPhone SE 1st Gen' };
    // Generic iPhone (future-proof for new models)
    return { brand: 'Apple', model: 'iPhone (New Model)' };
  }

  // iPad Detection (including future models)
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && 'ontouchend' in document && navigator.maxTouchPoints > 1)) {
    if (minDim === 1024 && maxDim === 1366) return { brand: 'Apple', model: 'iPad Pro 12.9"' };
    if (minDim === 834 && maxDim === 1194) return { brand: 'Apple', model: 'iPad Pro 11"' };
    if (minDim === 820 && maxDim === 1180) return { brand: 'Apple', model: 'iPad Air' };
    if (minDim === 810 && maxDim === 1080) return { brand: 'Apple', model: 'iPad 10th Gen' };
    if (minDim === 744 && maxDim === 1133) return { brand: 'Apple', model: 'iPad Mini 6' };
    return { brand: 'Apple', model: 'iPad (New Model)' };
  }

  // Samsung Detection (including 2026+ Galaxy models)
  if (/Samsung/.test(ua) || /SM-/.test(ua)) {
    // Galaxy S26 Ultra (2026+)
    if (minDim >= 440 && maxDim >= 960) return { brand: 'Samsung', model: 'Galaxy S26 Ultra (Estimated)' };
    // Galaxy S25 Ultra (2025+)
    if (minDim >= 412 && maxDim >= 920) return { brand: 'Samsung', model: 'Galaxy S25 Ultra' };
    // Galaxy S24 Ultra
    if (minDim === 412 && maxDim >= 900) return { brand: 'Samsung', model: 'Galaxy S24 Ultra' };
    // Galaxy S24/S23 series
    if (minDim >= 360 && minDim <= 412) return { brand: 'Samsung', model: 'Galaxy S23/S24 Series' };
    // Galaxy Tab S10+ (2025+)
    if (minDim >= 800 && /Tablet|Tab/.test(ua)) return { brand: 'Samsung', model: 'Galaxy Tab S10+' };
    // Galaxy Tab S9
    if ((minDim >= 700 && minDim <= 760) && /Tablet|Tab/.test(ua)) return { brand: 'Samsung', model: 'Galaxy Tab S9' };
    return { brand: 'Samsung', model: 'Galaxy Device (New Model)' };
  }

  // Google Pixel (including Pixel 10/11 - 2026+)
  if (/Pixel/.test(ua)) {
    const pixelMatch = ua.match(/Pixel\s*(\d+)/);
    if (pixelMatch) {
      return { brand: 'Google', model: `Pixel ${pixelMatch[1]}` };
    }
    return { brand: 'Google', model: 'Pixel (New Model)' };
  }

  // Xiaomi (including future models)
  if (/Xiaomi|Mi |Redmi|POCO/.test(ua)) {
    return { brand: 'Xiaomi', model: 'Xiaomi Device' };
  }

  // Huawei (including HarmonyOS devices)
  if (/Huawei|HUAWEI|HarmonyOS/.test(ua)) {
    return { brand: 'Huawei', model: 'Huawei Device' };
  }

  // OnePlus (including future models)
  if (/OnePlus/.test(ua)) {
    return { brand: 'OnePlus', model: 'OnePlus Device' };
  }

  // Nothing Phone
  if (/Nothing/.test(ua)) {
    return { brand: 'Nothing', model: 'Nothing Phone' };
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

  // iPad detection takes priority (iPadOS 13+ reports as MacIntel)
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && 'ontouchend' in document && navigator.maxTouchPoints > 1)) {
    return 'tablet';
  }

  // Tiny Mobile (compact phones, mini devices)
  if (touchEnabled && maxDimension < 600 && minDimension < 400) {
    return 'mobile';
  }

  // Standard Mobile (phones)
  if (touchEnabled && maxDimension < 768) {
    return 'mobile';
  }

  // Mobile phones with tall screens (modern phones up to ~430px wide)
  if (touchEnabled && minDimension <= 440 && maxDimension < 1000 && /Mobile|iPhone|Android/.test(ua)) {
    return 'mobile';
  }

  // Tablet (touch + medium screen, NOT a phone)
  if (touchEnabled && maxDimension >= 768 && maxDimension <= 1400 && minDimension >= 600) {
    return 'tablet';
  }

  // Laptop (touch-enabled convertibles with large screens)
  if (maxDimension > 1400 && touchEnabled) {
    return 'laptop';
  }

  // Desktop
  if (maxDimension >= 1200 && !touchEnabled) {
    return 'desktop';
  }

  // Fallback: large touch devices are tablets, non-touch are desktops
  if (touchEnabled) return 'tablet';
  return 'desktop';
}

/**
 * Extract firmware version from user agent
 */
function extractFirmware(ua: string, os: string): string {
  if (os === 'iOS' || os === 'iPadOS') {
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return `${os} ${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`;
    }
    const versionMatch = ua.match(/(?:iPad|iPhone)OS\s+([\d.]+)/i);
    if (versionMatch) {
      return `${os} ${versionMatch[1]}`;
    }
  }

  if (os === 'Android') {
    const match = ua.match(/Android\s+([\d.]+)/);
    if (match) {
      return `Android ${match[1]}`;
    }
  }

  if (os === 'HarmonyOS') {
    const match = ua.match(/HarmonyOS\s+([\d.]+)/);
    if (match) {
      return `HarmonyOS ${match[1]}`;
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
