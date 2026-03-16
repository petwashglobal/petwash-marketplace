/**
 * SMS Abuse Detector — Global Circuit Breaker (Redis-backed)
 *
 * All state is persisted in Redis so counters survive server restarts.
 * The emergency kill switch also lives in Redis — admin clears it via the
 * admin panel or by calling smsAbuseDetector.clearKillSwitch().
 *
 * Thresholds (configurable via env vars):
 *   SMS_GLOBAL_HOURLY_LIMIT  — default 80  (auto-kill at this per hour)
 *   SMS_GLOBAL_DAILY_LIMIT   — default 400 (auto-kill at this per day)
 *   SMS_ALERT_THRESHOLD_PCT  — default 60  (warn admin at 60% of limits)
 *
 * Attack patterns detected:
 *   1. Volume spike — too many total SMS in an hour or day
 *   2. Phone enumeration — one IP targeting many different phone numbers
 *   3. Repeated daily-cap hits — many phones hitting their daily cap (bot rotation)
 *
 * Redis keys used:
 *   sms_abuse:hourly        — rolling 1-hour INCR counter (TTL 7200s)
 *   sms_abuse:daily         — rolling 24-hour INCR counter (TTL 172800s)
 *   sms_abuse:kill          — emergency kill switch ('1'), cleared by admin
 *   sms_abuse:alert:{type}  — dedup flag so each alert fires once per window
 *   sms_abuse:ip_ph:{ip}    — comma-separated phones seen from this IP (TTL 3600s)
 *   sms_abuse:cap_hits      — comma-separated phones that hit daily cap (TTL 3600s)
 */

import { logger } from '../lib/logger';
import { redis } from './redis';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const ADMIN_ALERT_EMAIL = process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@petwash.co.il';
const FROM_EMAIL = 'security@petwash.co.il';

const GLOBAL_HOURLY_LIMIT = parseInt(process.env.SMS_GLOBAL_HOURLY_LIMIT || '80', 10);
const GLOBAL_DAILY_LIMIT = parseInt(process.env.SMS_GLOBAL_DAILY_LIMIT || '400', 10);
const ALERT_THRESHOLD_PCT = parseInt(process.env.SMS_ALERT_THRESHOLD_PCT || '60', 10) / 100;
const ENUMERATION_IP_PHONE_LIMIT = parseInt(process.env.SMS_ENUM_IP_LIMIT || '5', 10);

const KEY_HOURLY = 'sms_abuse:hourly';
const KEY_DAILY = 'sms_abuse:daily';
const KEY_KILL = 'sms_abuse:kill';
const KEY_ALERT = (type: string) => `sms_abuse:alert:${type}`;
const KEY_IP_PHONES = (ip: string) => `sms_abuse:ip_ph:${ip}`;
const KEY_CAP_HITS = 'sms_abuse:cap_hits';

async function redisIncr(key: string, ttlSec: number): Promise<number> {
  try {
    const val = await redis.incr(key);
    if (val === 1) await redis.expire(key, ttlSec);
    return val;
  } catch {
    return 0;
  }
}

async function redisGet(key: string): Promise<string | null> {
  try {
    return await redis.getRaw(key);
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    await redis.setRaw(key, value, ttlSec);
  } catch {
    // non-critical
  }
}

async function redisDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // non-critical
  }
}

class SmsAbuseDetector {
  constructor() {
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }
  }

  /**
   * Check if the kill switch is currently active.
   * Checks BOTH Redis (automatic/persisted) AND process.env (manual override).
   */
  async isKillSwitchActive(): Promise<boolean> {
    const envFlag = (process.env.SMS_EMERGENCY_DISABLED || '').toLowerCase();
    if (envFlag === 'true' || envFlag === '1') return true;
    const redisFlag = await redisGet(KEY_KILL);
    return redisFlag === '1';
  }

  /**
   * Clear the kill switch — called by admin to restore SMS after a kill event.
   */
  async clearKillSwitch(): Promise<void> {
    await redisDel(KEY_KILL);
    delete process.env.SMS_EMERGENCY_DISABLED;
    logger.info('[SmsAbuse] ✅ Kill switch cleared — SMS re-enabled');
  }

  private async triggerEmergencyKill(reason: string, hourly: number, daily: number): Promise<void> {
    await redisSet(KEY_KILL, '1', 7 * 24 * 3600);
    process.env.SMS_EMERGENCY_DISABLED = 'true';
    logger.error(`[SmsAbuse] 🔴 EMERGENCY KILL SWITCH ACTIVATED: ${reason}`, { hourly, daily });
  }

  private async sendAlert(subject: string, body: string): Promise<void> {
    logger.warn(`[SmsAbuse] 🚨 ALERT: ${subject}`);
    if (!SENDGRID_API_KEY) return;
    try {
      await sgMail.send({
        to: ADMIN_ALERT_EMAIL,
        from: FROM_EMAIL,
        subject: `🚨 PetWash SMS Security Alert: ${subject}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#ef4444;color:white;padding:16px;border-radius:8px 8px 0 0">
              <h2 style="margin:0">🚨 SMS Security Alert</h2>
            </div>
            <div style="background:#fef2f2;border:1px solid #fecaca;padding:20px;border-radius:0 0 8px 8px">
              <p style="color:#991b1b;font-weight:bold;font-size:16px">${subject}</p>
              <pre style="background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap">${body}</pre>
              <p style="color:#6b7280;font-size:13px;margin-top:16px">
                Timestamp: ${new Date().toISOString()}<br>
                System: PetWash™ SMS Abuse Detector (Redis-backed)<br>
                Action required: Review Twilio console and call clearKillSwitch() to re-enable.
              </p>
            </div>
          </div>`,
      });
      logger.info('[SmsAbuse] Alert email sent', { to: ADMIN_ALERT_EMAIL, subject });
    } catch (err: any) {
      logger.error('[SmsAbuse] Failed to send alert email', { error: err?.message });
    }
  }

  /**
   * Track IP → phone enumeration attacks.
   * Stored in Redis so it persists across restarts.
   */
  async trackIpPhoneCombo(ip: string, phone: string): Promise<void> {
    if (!ip || !phone) return;
    try {
      const key = KEY_IP_PHONES(ip);
      const raw = await redisGet(key);
      const phones = new Set<string>(raw ? raw.split(',').filter(Boolean) : []);
      phones.add(phone);
      await redisSet(key, Array.from(phones).join(','), 3600);

      if (phones.size >= ENUMERATION_IP_PHONE_LIMIT) {
        const alertKey = KEY_ALERT(`enum:${ip}`);
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 3600);
          const reason = `IP ${ip} targeted ${phones.size} unique phone numbers`;
          logger.warn(`[SmsAbuse] 🚨 Phone enumeration detected: ${reason}`);
          await this.sendAlert(
            'Phone Enumeration Attack Detected',
            `IP: ${ip}\nUnique phones targeted: ${phones.size}\nLimit: ${ENUMERATION_IP_PHONE_LIMIT}\n\nRecommendation: Block this IP at firewall level.`
          );
        }
      }
    } catch (err: any) {
      logger.error('[SmsAbuse] trackIpPhoneCombo error', { error: err?.message });
    }
  }

  async trackCapHit(phone: string): Promise<void> {
    try {
      const key = KEY_CAP_HITS;
      const raw = await redisGet(key);
      const phones = new Set<string>(raw ? raw.split(',').filter(Boolean) : []);
      phones.add(phone);
      await redisSet(key, Array.from(phones).join(','), 3600);

      if (phones.size >= 10) {
        const alertKey = KEY_ALERT('cap_rotation');
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 3600);
          logger.warn('[SmsAbuse] 🚨 10+ different phones hit daily cap in 1 hour — bot rotation likely', {
            uniquePhones: phones.size,
          });
          const hourly = parseInt((await redisGet(KEY_HOURLY)) || '0', 10);
          const daily = parseInt((await redisGet(KEY_DAILY)) || '0', 10);
          await this.sendAlert(
            'Possible Bot Phone Rotation',
            `${phones.size} different phone numbers hit their daily SMS cap within the last hour.\n\nThis pattern is consistent with attackers rotating phone numbers to bypass per-phone limits.\n\nGlobal hourly count: ${hourly} / ${GLOBAL_HOURLY_LIMIT}\nGlobal daily count: ${daily} / ${GLOBAL_DAILY_LIMIT}`
          );
        }
      }
    } catch (err: any) {
      logger.error('[SmsAbuse] trackCapHit error', { error: err?.message });
    }
  }

  /**
   * Called after every successful SMS dispatch. Increments Redis counters,
   * fires alerts at threshold, and triggers the kill switch at the limits.
   */
  async recordSent(): Promise<void> {
    try {
      const hourly = await redisIncr(KEY_HOURLY, 7200);
      const daily = await redisIncr(KEY_DAILY, 172800);

      const hourlyPct = hourly / GLOBAL_HOURLY_LIMIT;
      const dailyPct = daily / GLOBAL_DAILY_LIMIT;

      if (hourly >= GLOBAL_HOURLY_LIMIT) {
        const alertKey = KEY_ALERT('hourly_kill');
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 7200);
          await this.triggerEmergencyKill(`Global hourly limit: ${hourly}/${GLOBAL_HOURLY_LIMIT}`, hourly, daily);
          await this.sendAlert(
            '🔴 SMS EMERGENCY KILL ACTIVATED — Hourly Limit Exceeded',
            `The global SMS hourly limit was exceeded.\n\nHourly count: ${hourly} / ${GLOBAL_HOURLY_LIMIT}\nDaily count: ${daily} / ${GLOBAL_DAILY_LIMIT}\n\n⚠️ Kill switch stored in Redis. Call smsAbuseDetector.clearKillSwitch() to re-enable.\n\nTo re-enable via API: POST /api/admin/sms/kill-switch/clear`
          );
        }
      } else if (hourlyPct >= ALERT_THRESHOLD_PCT) {
        const alertKey = KEY_ALERT('hourly_warn');
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 7200);
          await this.sendAlert(
            `⚠️ SMS Warning — ${Math.round(hourlyPct * 100)}% of Hourly Limit`,
            `Approaching global hourly SMS limit.\n\nHourly count: ${hourly} / ${GLOBAL_HOURLY_LIMIT} (${Math.round(hourlyPct * 100)}%)\nDaily count: ${daily} / ${GLOBAL_DAILY_LIMIT}\n\nMonitor closely. Auto-kill triggers at ${GLOBAL_HOURLY_LIMIT} SMS/hour.`
          );
        }
      }

      if (daily >= GLOBAL_DAILY_LIMIT) {
        const alertKey = KEY_ALERT('daily_kill');
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 172800);
          await this.triggerEmergencyKill(`Global daily limit: ${daily}/${GLOBAL_DAILY_LIMIT}`, hourly, daily);
          await this.sendAlert(
            '🔴 SMS EMERGENCY KILL ACTIVATED — Daily Limit Exceeded',
            `The global SMS daily limit was exceeded.\n\nDaily count: ${daily} / ${GLOBAL_DAILY_LIMIT}\nHourly count: ${hourly} / ${GLOBAL_HOURLY_LIMIT}\n\n⚠️ Kill switch stored in Redis. Call smsAbuseDetector.clearKillSwitch() to re-enable.\n\nTo re-enable via API: POST /api/admin/sms/kill-switch/clear`
          );
        }
      } else if (dailyPct >= ALERT_THRESHOLD_PCT) {
        const alertKey = KEY_ALERT('daily_warn');
        const alerted = await redisGet(alertKey);
        if (!alerted) {
          await redisSet(alertKey, '1', 172800);
          await this.sendAlert(
            `⚠️ SMS Warning — ${Math.round(dailyPct * 100)}% of Daily Limit`,
            `Approaching global daily SMS limit.\n\nDaily count: ${daily} / ${GLOBAL_DAILY_LIMIT} (${Math.round(dailyPct * 100)}%)\nHourly count: ${hourly} / ${GLOBAL_HOURLY_LIMIT}\n\nMonitor closely. Auto-kill triggers at ${GLOBAL_DAILY_LIMIT} SMS/day.`
          );
        }
      }
    } catch (err: any) {
      logger.error('[SmsAbuse] recordSent error', { error: err?.message });
    }
  }

  async getStatus(): Promise<{
    hourlyCount: number;
    hourlyLimit: number;
    dailyCount: number;
    dailyLimit: number;
    killSwitchActive: boolean;
    killSwitchSource: string;
    hourlyPct: number;
    dailyPct: number;
  }> {
    const [hourlyRaw, dailyRaw, killRaw] = await Promise.all([
      redisGet(KEY_HOURLY),
      redisGet(KEY_DAILY),
      redisGet(KEY_KILL),
    ]);
    const hourly = parseInt(hourlyRaw || '0', 10);
    const daily = parseInt(dailyRaw || '0', 10);
    const envFlag = (process.env.SMS_EMERGENCY_DISABLED || '').toLowerCase();
    const killSwitchActive = killRaw === '1' || envFlag === 'true' || envFlag === '1';
    const killSwitchSource = killRaw === '1' ? 'redis' : envFlag === 'true' ? 'env' : 'none';
    return {
      hourlyCount: hourly,
      hourlyLimit: GLOBAL_HOURLY_LIMIT,
      dailyCount: daily,
      dailyLimit: GLOBAL_DAILY_LIMIT,
      killSwitchActive,
      killSwitchSource,
      hourlyPct: Math.round((hourly / GLOBAL_HOURLY_LIMIT) * 100),
      dailyPct: Math.round((daily / GLOBAL_DAILY_LIMIT) * 100),
    };
  }
}

export const smsAbuseDetector = new SmsAbuseDetector();
