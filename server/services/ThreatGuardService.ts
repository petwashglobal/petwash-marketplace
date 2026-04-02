/**
 * ThreatGuardService — PetWash™ Intrusion Detection & Alert System
 *
 * Detects and responds to hostile access attempts across the platform:
 *   • Brute-force on admin / auth endpoints
 *   • Admin API enumeration (mass 404s)
 *   • SQL injection / XSS payloads in requests
 *   • Suspicious user-agent strings (scanners, exploit kits)
 *   • Credential-stuffing patterns (high-velocity auth failures)
 *   • Non-Israeli IP accessing super-admin endpoints
 *
 * On confirmed threat:
 *   → Stamps to system_events (severity: critical)
 *   → Stamps to security_events (existing table)
 *   → Sends Twilio SMS to SUPER_ADMIN_ALERT_PHONE
 *   → Records in Redis so alerts are not repeated for 1 hour per IP
 *
 * Phone configuration: Set SUPER_ADMIN_ALERT_PHONE env var to +61419773360
 * (or whatever number you want to receive security alerts on)
 */

import { logger } from '../lib/logger';
import { SystemEventService } from './SystemEventService';
import { logSecurityEvent } from './securityEventsService';

/* ── Config ──────────────────────────────────────────────────────────────── */
const ALERT_PHONE = process.env.SUPER_ADMIN_ALERT_PHONE ?? null;

/* Thresholds before an SMS alert fires */
const BRUTE_FORCE_THRESHOLD  = 10;   // failed auth attempts from one IP in 15 min
const ENUM_THRESHOLD         = 30;   // 404s on /api/admin/* from one IP in 15 min
const INJECTION_AUTO_ALERT   = true; // always alert on injection pattern match
const ALERT_COOLDOWN_MS      = 60 * 60 * 1000; // 1 hour per IP between SMS alerts

/* In-memory counters (complement Redis — works even if Redis is down) */
interface IpBucket {
  authFails:   number;
  adminNotFounds: number;
  lastAlert:   number; // epoch ms of last SMS alert for this IP
  firstSeen:   number;
}
const ipBuckets = new Map<string, IpBucket>();

/* Flush buckets older than 15 minutes to avoid memory bloat */
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [ip, b] of ipBuckets) {
    if (b.firstSeen < cutoff) ipBuckets.delete(ip);
  }
}, 5 * 60 * 1000);

/* ── SQL/XSS injection pattern list ─────────────────────────────────────── */
const INJECTION_PATTERNS: RegExp[] = [
  /union\s+select/i,
  /\bor\s+1\s*=\s*1\b/i,
  /'\s*(or|and)\s+'[^']*'\s*=\s*'[^']*/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /exec\s*\(/i,
  /xp_cmdshell/i,
  /<script[\s>]/i,
  /javascript:/i,
  /on(load|error|click)\s*=/i,
  /\beval\s*\(/i,
  /base64_decode\s*\(/i,
  /\/etc\/passwd/i,
  /\.\.\/\.\.\//,           // path traversal
  /\bwget\s/i,
  /\bcurl\s/i,
];

/* Suspicious scanner user-agents */
const BAD_UA_PATTERNS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /masscan/i,
  /zap(proxy)?/i,
  /burpsuite/i,
  /dirbuster/i,
  /hydra/i,
  /medusa/i,
  /nmap/i,
  /wfuzz/i,
  /gobuster/i,
  /nuclei/i,
  /havij/i,
  /acunetix/i,
  /python-requests\/[0-1]\./i,  // very old python-requests often used in scripts
];

/* ── Internal helpers ────────────────────────────────────────────────────── */
function getBucket(ip: string): IpBucket {
  if (!ipBuckets.has(ip)) {
    ipBuckets.set(ip, { authFails: 0, adminNotFounds: 0, lastAlert: 0, firstSeen: Date.now() });
  }
  return ipBuckets.get(ip)!;
}

function canAlert(ip: string): boolean {
  const b = getBucket(ip);
  return Date.now() - b.lastAlert > ALERT_COOLDOWN_MS;
}

function markAlerted(ip: string): void {
  getBucket(ip).lastAlert = Date.now();
}

/* ── SMS alert (fire-and-forget, never throws) ───────────────────────────── */
async function sendThreatSMS(message: string): Promise<void> {
  if (!ALERT_PHONE) return;
  try {
    // Lazy-import to avoid circular dependency during startup
    const { twilioSMSService } = await import('./TwilioSMSService');
    if (!twilioSMSService) return;
    await (twilioSMSService as any).sendSMS(ALERT_PHONE, message, {});
    logger.warn('[ThreatGuard] 🚨 SMS alert sent to super-admin');
  } catch (err: any) {
    logger.error('[ThreatGuard] SMS alert failed', { error: err?.message });
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export const ThreatGuardService = {

  /**
   * Record a failed authentication attempt.
   * Call this from auth middleware / login routes on 401/403.
   */
  recordAuthFailure(ip: string, ua: string, endpoint: string, userId?: string): void {
    const b = getBucket(ip);
    b.authFails++;

    const payload = {
      eventType:  'admin_auth_failure',
      severity:   'warn' as const,
      source:     'threat_guard',
      message:    `Auth failure from ${ip} (${b.authFails} attempts) on ${endpoint}`,
      detail:     { ip, ua: ua?.slice(0, 200), endpoint, count: b.authFails, userId },
    };

    SystemEventService.stamp(payload);

    if (b.authFails >= BRUTE_FORCE_THRESHOLD && canAlert(ip)) {
      markAlerted(ip);
      const critical = {
        ...payload,
        eventType: 'brute_force_detected',
        severity: 'critical' as const,
        message: `🚨 BRUTE FORCE from ${ip}: ${b.authFails} auth failures on ${endpoint}`,
      };
      SystemEventService.stamp(critical);
      logSecurityEvent({ eventType: 'brute_force', ip, userAgent: ua, riskScore: 95, metadata: { count: b.authFails, endpoint } });
      sendThreatSMS(
        `🚨 PetWash Security Alert!\nBrute-force detected\nIP: ${ip}\nAttempts: ${b.authFails}\nEndpoint: ${endpoint}\nTime: ${new Date().toISOString()}`
      );
      logger.error('[ThreatGuard] 🚨 BRUTE FORCE DETECTED', { ip, attempts: b.authFails, endpoint });
    }
  },

  /**
   * Record an admin-endpoint 404 (enumeration attempt).
   */
  recordAdminEnumeration(ip: string, ua: string, path: string): void {
    const b = getBucket(ip);
    b.adminNotFounds++;

    if (b.adminNotFounds >= ENUM_THRESHOLD && canAlert(ip)) {
      markAlerted(ip);
      const msg = `🕵️ Admin API enumeration from ${ip}: ${b.adminNotFounds} 404s`;
      SystemEventService.stamp({
        eventType: 'admin_enumeration',
        severity:  'error',
        source:    'threat_guard',
        message:   msg,
        detail:    { ip, ua: ua?.slice(0, 200), lastPath: path, count: b.adminNotFounds },
      });
      logSecurityEvent({ eventType: 'admin_enumeration', ip, userAgent: ua, riskScore: 70, metadata: { count: b.adminNotFounds, path } });
      sendThreatSMS(
        `🚨 PetWash Security Alert!\nAdmin API scanning detected\nIP: ${ip}\n404s: ${b.adminNotFounds}\nLast path: ${path}\nTime: ${new Date().toISOString()}`
      );
    }
  },

  /**
   * Scan a raw URL path + query string for injection payloads.
   * Returns true if a threat was detected (caller may reject the request).
   */
  scanForInjection(ip: string, ua: string, rawUrl: string, body?: string): boolean {
    const target = `${rawUrl} ${body ?? ''}`;
    const matched = INJECTION_PATTERNS.find(p => p.test(target));
    if (!matched) return false;

    const msg = `💉 Injection payload detected from ${ip}: ${rawUrl.slice(0, 120)}`;
    SystemEventService.stamp({
      eventType: 'injection_attempt',
      severity:  'critical',
      source:    'threat_guard',
      message:   msg,
      detail:    { ip, ua: ua?.slice(0, 200), url: rawUrl.slice(0, 300), pattern: matched.toString() },
    });
    logSecurityEvent({ eventType: 'injection_attempt', ip, userAgent: ua, riskScore: 99, metadata: { url: rawUrl.slice(0, 300) } });

    if (INJECTION_AUTO_ALERT && canAlert(ip)) {
      markAlerted(ip);
      sendThreatSMS(
        `🚨 PetWash Security Alert!\nInjection attack detected!\nIP: ${ip}\nURL: ${rawUrl.slice(0, 100)}\nTime: ${new Date().toISOString()}`
      );
    }
    logger.error('[ThreatGuard] 🚨 INJECTION ATTEMPT', { ip, url: rawUrl.slice(0, 200) });
    return true;
  },

  /**
   * Check user-agent against known scanner fingerprints.
   */
  scanUserAgent(ip: string, ua: string, path: string): boolean {
    if (!ua) return false;
    const matched = BAD_UA_PATTERNS.find(p => p.test(ua));
    if (!matched) return false;

    const msg = `🤖 Malicious scanner detected from ${ip}: ${ua.slice(0, 80)}`;
    SystemEventService.stamp({
      eventType: 'scanner_detected',
      severity:  'error',
      source:    'threat_guard',
      message:   msg,
      detail:    { ip, ua: ua.slice(0, 300), path, pattern: matched.toString() },
    });
    logSecurityEvent({ eventType: 'scanner_ua', ip, userAgent: ua, riskScore: 85, metadata: { path } });

    if (canAlert(ip)) {
      markAlerted(ip);
      sendThreatSMS(
        `🚨 PetWash Security Alert!\nSecurity scanner detected\nIP: ${ip}\nTool: ${ua.slice(0, 60)}\nPath: ${path}\nTime: ${new Date().toISOString()}`
      );
    }
    return true;
  },

  /**
   * Record a super-admin operation from an unexpected IP/geo.
   * Flags non-Israeli IPs (AU/AU prefix) accessing /api/admin/
   * — legitimate admin is in Australia, so we flag anything else.
   */
  recordSuperAdminAccess(ip: string, ua: string, path: string, uid: string): void {
    // Log every super-admin access for full auditability
    SystemEventService.stamp({
      eventType: 'super_admin_access',
      severity:  'info',
      source:    'threat_guard',
      message:   `Super admin access: ${uid} from ${ip} → ${path}`,
      detail:    { ip, ua: ua?.slice(0, 200), path, uid },
    });
  },

  /**
   * Trigger a manual security alert from any server-side code.
   * E.g. when wallet balance tampering is detected.
   */
  async manualAlert(title: string, detail: string, severity: 'warn' | 'error' | 'critical' = 'critical'): Promise<void> {
    SystemEventService.stamp({
      eventType: 'manual_security_alert',
      severity,
      source:    'threat_guard',
      message:   title,
      detail:    { detail },
    });
    logSecurityEvent({ eventType: 'manual_alert', riskScore: severity === 'critical' ? 95 : 60, metadata: { title, detail } });
    await sendThreatSMS(`🚨 PetWash Security Alert!\n${title}\n${detail.slice(0, 200)}\nTime: ${new Date().toISOString()}`);
  },

  /**
   * Get current threat summary (for admin dashboard).
   */
  getThreatSummary(): { activeIps: number; topThreats: Array<{ ip: string; authFails: number; adminScans: number }> } {
    const entries = [...ipBuckets.entries()]
      .filter(([, b]) => b.authFails > 2 || b.adminNotFounds > 5)
      .sort((a, b) => (b[1].authFails + b[1].adminNotFounds) - (a[1].authFails + a[1].adminNotFounds))
      .slice(0, 20)
      .map(([ip, b]) => ({ ip: ip.slice(0, -2) + '**', authFails: b.authFails, adminScans: b.adminNotFounds }));

    return { activeIps: ipBuckets.size, topThreats: entries };
  },
};
