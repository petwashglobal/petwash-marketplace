/**
 * Security Alerts System
 * Email notifications for critical security events
 */

import sgMail from '@sendgrid/mail';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { countFailedAttempts } from './securityEvents';

const FROM = process.env.ALERT_EMAIL_FROM || 'Support@PetWash.co.il';
const TO = process.env.ALERT_EMAIL_TO || 'Support@PetWash.co.il';

// Initialize SendGrid (already configured in project)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send security alert email
 */
export async function sendSecurityAlert(subject: string, html: string): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('[Alerts] SendGrid API key not configured - alert not sent', { subject });
    return;
  }

  try {
    await sgMail.send({
      from: FROM,
      to: TO,
      subject: `🚨 PetWash Security Alert: ${subject}`,
      html,
    });

    logger.info('[Alerts] Security alert sent', { subject });
  } catch (error) {
    logger.error('[Alerts] Failed to send security alert', { subject, error });
  }
}

/**
 * Alert A: Check for burst of failed login attempts
 * Triggers on 5+ failures in 10 minutes
 */
export async function checkFailedBurst(uid: string, userEmail?: string): Promise<void> {
  const count = await countFailedAttempts(uid, 10);

  if (count >= 5) {
    const subject = `Multiple failed passkey attempts for ${userEmail || uid}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #dc2626;">⚠️ Multiple Failed Authentication Attempts</h2>
        <p><strong>User:</strong> ${userEmail || uid}</p>
        <p><strong>Failures in 10 minutes:</strong> ${count}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This alert was triggered automatically by PetWash™ security monitoring.
        </p>
      </div>
    `;

    await sendSecurityAlert(subject, html);
  }
}

/**
 * Alert B: Passkey revoked notification
 */
export async function alertPasskeyRevoked(
  uid: string,
  credentialId: string,
  userEmail?: string,
  deviceLabel?: string
): Promise<void> {
  const subject = `Passkey revoked for ${userEmail || uid}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #dc2626;">🔒 Passkey Device Revoked</h2>
      <p><strong>User:</strong> ${userEmail || uid}</p>
      <p><strong>Device:</strong> ${deviceLabel || 'Unknown device'}</p>
      <p><strong>Credential ID:</strong> ${credentialId.substring(0, 20)}...</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        This alert was triggered automatically by PetWash™ security monitoring.
      </p>
    </div>
  `;

  await sendSecurityAlert(subject, html);
}

/**
 * Alert C: New device from unusual location
 * Basic heuristic - checks if this IP/city combination is new
 */
export async function alertNewDeviceIfUnusual(
  uid: string,
  ip: string,
  userEmail?: string,
  city?: string
): Promise<void> {
  try {
    // Look back 30 days for previous activity from this location
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const snapshot = await db
      .collection('securityEvents')
      .where('uid', '==', uid)
      .where('createdAt', '>=', since)
      .get();

    // Build set of seen IP:city combinations
    const seenLocations = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      const eventIp = data.ip || '';
      const eventCity = data.meta?.city || '';
      const key = `${eventIp}:${eventCity}`;
      if (key) seenLocations.add(key);
    });

    const currentKey = `${ip}:${city || ''}`;
    
    // If this is a new location, send alert
    if (!seenLocations.has(currentKey) && seenLocations.size > 0) {
      const subject = `New device/location for ${userEmail || uid}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #f59e0b;">📍 New Device or Location Detected</h2>
          <p><strong>User:</strong> ${userEmail || uid}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
          <p><strong>Location:</strong> ${city || 'Unknown'}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p style="margin-top: 16px; color: #6b7280;">
            This device or location has not been seen in the last 30 days. 
            If this was not authorized by the user, please investigate immediately.
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This alert was triggered automatically by PetWash™ security monitoring.
          </p>
        </div>
      `;

      await sendSecurityAlert(subject, html);
    }
  } catch (error) {
    logger.error('[Alerts] Failed to check for unusual location', { uid, ip, error });
  }
}

/**
 * Get IP address from Express request
 */
export function getClientIP(req: any): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * Get city from IP address (simple fallback for security alerts)
 * Returns 'Unknown' if geolocation fails
 */
export async function getCityFromIP(ip: string): Promise<string> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return 'Unknown'; // Skip localhost and private IPs
  }

  try {
    // Use free ipapi.co service (no API key required)
    // Create AbortController for 3 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return 'Unknown';
    }

    const data = await response.json();
    return data.city || data.region || data.country_name || 'Unknown';
  } catch (error) {
    logger.warn('[Alerts] Failed to get city from IP', { ip, error });
    return 'Unknown';
  }
}
