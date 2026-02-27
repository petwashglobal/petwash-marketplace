/**
 * SMS Abuse Detector — Global Circuit Breaker
 *
 * What the Twilio attack exposed: per-phone caps are useless when attackers
 * rotate thousands of different phone numbers. This module adds a GLOBAL
 * watchdog that monitors total SMS volume across ALL phones and ALL IPs,
 * auto-triggers the emergency kill switch, and emails the admin team.
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
 */

import { logger } from '../lib/logger';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const ADMIN_ALERT_EMAIL = process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@petwash.co.il';
const FROM_EMAIL = 'security@petwash.co.il';

const GLOBAL_HOURLY_LIMIT = parseInt(process.env.SMS_GLOBAL_HOURLY_LIMIT || '80', 10);
const GLOBAL_DAILY_LIMIT = parseInt(process.env.SMS_GLOBAL_DAILY_LIMIT || '400', 10);
const ALERT_THRESHOLD_PCT = parseInt(process.env.SMS_ALERT_THRESHOLD_PCT || '60', 10) / 100;

const ENUMERATION_IP_PHONE_LIMIT = parseInt(process.env.SMS_ENUM_IP_LIMIT || '5', 10);

interface WindowedCounter {
  count: number;
  windowStart: number;
  windowMs: number;
}

interface AlertState {
  hourlyWarningSent: boolean;
  dailyWarningSent: boolean;
  hourlyKillSent: boolean;
  dailyKillSent: boolean;
}

class SmsAbuseDetector {
  private hourly: WindowedCounter = { count: 0, windowStart: Date.now(), windowMs: 60 * 60 * 1000 };
  private daily: WindowedCounter = { count: 0, windowStart: Date.now(), windowMs: 24 * 60 * 60 * 1000 };
  private alertState: AlertState = {
    hourlyWarningSent: false,
    dailyWarningSent: false,
    hourlyKillSent: false,
    dailyKillSent: false,
  };

  private ipPhoneMap = new Map<string, Set<string>>();
  private capHitPhones = new Set<string>();
  private capHitResetAt = 0;

  private emergencyEnabled = false;

  constructor() {
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }
  }

  private resetWindowIfNeeded(counter: WindowedCounter): void {
    const now = Date.now();
    if (now - counter.windowStart >= counter.windowMs) {
      counter.count = 0;
      counter.windowStart = now;
      if (counter.windowMs === 60 * 60 * 1000) {
        this.alertState.hourlyWarningSent = false;
        this.alertState.hourlyKillSent = false;
      } else {
        this.alertState.dailyWarningSent = false;
        this.alertState.dailyKillSent = false;
      }
    }
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
                System: PetWash™ SMS Abuse Detector<br>
                Action required: Review Twilio console and disable SMS if compromised.
              </p>
            </div>
          </div>`,
      });
      logger.info('[SmsAbuse] Alert email sent', { to: ADMIN_ALERT_EMAIL, subject });
    } catch (err: any) {
      logger.error('[SmsAbuse] Failed to send alert email', { error: err?.message });
    }
  }

  private triggerEmergencyKill(reason: string): void {
    process.env.SMS_EMERGENCY_DISABLED = 'true';
    this.emergencyEnabled = true;
    logger.error(`[SmsAbuse] 🔴 EMERGENCY KILL SWITCH ACTIVATED: ${reason}`, {
      hourlyCount: this.hourly.count,
      dailyCount: this.daily.count,
    });
  }

  trackIpPhoneCombo(ip: string, phone: string): void {
    if (!ip || !phone) return;
    const phones = this.ipPhoneMap.get(ip) || new Set<string>();
    phones.add(phone);
    this.ipPhoneMap.set(ip, phones);

    if (phones.size >= ENUMERATION_IP_PHONE_LIMIT) {
      const reason = `IP ${ip} targeted ${phones.size} unique phone numbers`;
      logger.warn(`[SmsAbuse] 🚨 Phone enumeration detected: ${reason}`);
      this.sendAlert(
        `Phone Enumeration Attack Detected`,
        `IP: ${ip}\nUnique phones targeted: ${phones.size}\nLimit: ${ENUMERATION_IP_PHONE_LIMIT}\n\nRecommendation: Block this IP at firewall level.`
      );
      setTimeout(() => this.ipPhoneMap.delete(ip), 60 * 60 * 1000);
    }
  }

  trackCapHit(phone: string): void {
    const now = Date.now();
    if (now > this.capHitResetAt) {
      this.capHitPhones.clear();
      this.capHitResetAt = now + 60 * 60 * 1000;
    }
    this.capHitPhones.add(phone);
    if (this.capHitPhones.size >= 10) {
      logger.warn('[SmsAbuse] 🚨 10+ different phones hit daily cap in 1 hour — bot rotation likely', {
        uniquePhones: this.capHitPhones.size,
      });
      this.sendAlert(
        'Possible Bot Phone Rotation',
        `${this.capHitPhones.size} different phone numbers hit their daily SMS cap within the last hour.\n\nThis pattern is consistent with attackers rotating phone numbers to bypass per-phone limits.\n\nGlobal hourly count: ${this.hourly.count} / ${GLOBAL_HOURLY_LIMIT}\nGlobal daily count: ${this.daily.count} / ${GLOBAL_DAILY_LIMIT}`
      );
    }
  }

  async recordSent(): Promise<void> {
    this.resetWindowIfNeeded(this.hourly);
    this.resetWindowIfNeeded(this.daily);

    this.hourly.count++;
    this.daily.count++;

    const hourlyPct = this.hourly.count / GLOBAL_HOURLY_LIMIT;
    const dailyPct = this.daily.count / GLOBAL_DAILY_LIMIT;

    if (this.hourly.count >= GLOBAL_HOURLY_LIMIT && !this.alertState.hourlyKillSent) {
      this.alertState.hourlyKillSent = true;
      const reason = `Global hourly SMS limit reached: ${this.hourly.count}/${GLOBAL_HOURLY_LIMIT}`;
      this.triggerEmergencyKill(reason);
      await this.sendAlert(
        '🔴 SMS EMERGENCY KILL ACTIVATED — Hourly Limit Exceeded',
        `The global SMS hourly limit was exceeded.\n\nHourly count: ${this.hourly.count} / ${GLOBAL_HOURLY_LIMIT}\nDaily count: ${this.daily.count} / ${GLOBAL_DAILY_LIMIT}\n\n⚠️ SMS_EMERGENCY_DISABLED has been set to true. All outgoing SMS are now blocked.\n\nTo re-enable: Set SMS_EMERGENCY_DISABLED=false in the Replit environment secrets.`
      );
    } else if (hourlyPct >= ALERT_THRESHOLD_PCT && !this.alertState.hourlyWarningSent) {
      this.alertState.hourlyWarningSent = true;
      await this.sendAlert(
        `⚠️ SMS Warning — ${Math.round(hourlyPct * 100)}% of Hourly Limit`,
        `Approaching global hourly SMS limit.\n\nHourly count: ${this.hourly.count} / ${GLOBAL_HOURLY_LIMIT} (${Math.round(hourlyPct * 100)}%)\nDaily count: ${this.daily.count} / ${GLOBAL_DAILY_LIMIT}\n\nMonitor closely. Auto-kill will trigger at ${GLOBAL_HOURLY_LIMIT} SMS/hour.`
      );
    }

    if (this.daily.count >= GLOBAL_DAILY_LIMIT && !this.alertState.dailyKillSent) {
      this.alertState.dailyKillSent = true;
      const reason = `Global daily SMS limit reached: ${this.daily.count}/${GLOBAL_DAILY_LIMIT}`;
      this.triggerEmergencyKill(reason);
      await this.sendAlert(
        '🔴 SMS EMERGENCY KILL ACTIVATED — Daily Limit Exceeded',
        `The global SMS daily limit was exceeded.\n\nDaily count: ${this.daily.count} / ${GLOBAL_DAILY_LIMIT}\nHourly count: ${this.hourly.count} / ${GLOBAL_HOURLY_LIMIT}\n\n⚠️ SMS_EMERGENCY_DISABLED has been set to true. All outgoing SMS are now blocked.\n\nTo re-enable: Set SMS_EMERGENCY_DISABLED=false in the Replit environment secrets.`
      );
    } else if (dailyPct >= ALERT_THRESHOLD_PCT && !this.alertState.dailyWarningSent) {
      this.alertState.dailyWarningSent = true;
      await this.sendAlert(
        `⚠️ SMS Warning — ${Math.round(dailyPct * 100)}% of Daily Limit`,
        `Approaching global daily SMS limit.\n\nDaily count: ${this.daily.count} / ${GLOBAL_DAILY_LIMIT} (${Math.round(dailyPct * 100)}%)\nHourly count: ${this.hourly.count} / ${GLOBAL_HOURLY_LIMIT}\n\nMonitor closely. Auto-kill will trigger at ${GLOBAL_DAILY_LIMIT} SMS/day.`
      );
    }
  }

  getStatus(): {
    hourlyCount: number;
    hourlyLimit: number;
    dailyCount: number;
    dailyLimit: number;
    emergencyEnabled: boolean;
    hourlyPct: number;
    dailyPct: number;
  } {
    this.resetWindowIfNeeded(this.hourly);
    this.resetWindowIfNeeded(this.daily);
    return {
      hourlyCount: this.hourly.count,
      hourlyLimit: GLOBAL_HOURLY_LIMIT,
      dailyCount: this.daily.count,
      dailyLimit: GLOBAL_DAILY_LIMIT,
      emergencyEnabled: this.emergencyEnabled || (process.env.SMS_EMERGENCY_DISABLED || '') === 'true',
      hourlyPct: Math.round((this.hourly.count / GLOBAL_HOURLY_LIMIT) * 100),
      dailyPct: Math.round((this.daily.count / GLOBAL_DAILY_LIMIT) * 100),
    };
  }
}

export const smsAbuseDetector = new SmsAbuseDetector();
