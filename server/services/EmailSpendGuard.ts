/**
 * EMAIL SPEND GUARD
 *
 * Global circuit breaker for ALL outgoing SendGrid email sends.
 * Tracks spend across every service, fires admin alarms at thresholds,
 * and hard-blocks further sends if daily/hourly budget is exceeded.
 *
 * Thresholds:
 *   Hourly WARN  : 40 emails  → admin alarm email
 *   Hourly BLOCK : 80 emails  → circuit open, all sends rejected
 *   Daily  WARN  : 200 emails → admin alarm email
 *   Daily  BLOCK : 500 emails → circuit open, all sends rejected
 *
 * Every send is logged with: service name, recipient (masked), timestamp.
 */

import { logger } from '../lib/logger';

export interface EmailSendRecord {
  ts: number;
  service: string;
  recipientMasked: string;
  subject: string;
}

interface Window {
  count: number;
  resetAt: number;
  alarmFired: boolean;
}

const HOURLY_WARN  = parseInt(process.env.EMAIL_GUARD_HOURLY_WARN  || '40');
const HOURLY_BLOCK = parseInt(process.env.EMAIL_GUARD_HOURLY_BLOCK || '80');
const DAILY_WARN   = parseInt(process.env.EMAIL_GUARD_DAILY_WARN   || '200');
const DAILY_BLOCK  = parseInt(process.env.EMAIL_GUARD_DAILY_BLOCK  || '500');

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  return `${local.slice(0, 2)}***@${domain}`;
}

class EmailSpendGuard {
  private hourly: Window = { count: 0, resetAt: Date.now() + 3_600_000, alarmFired: false };
  private daily: Window  = { count: 0, resetAt: Date.now() + 86_400_000, alarmFired: false };
  private recentSends: EmailSendRecord[] = [];
  private readonly MAX_LOG = 1000;

  private alarmCallback: ((subject: string, html: string) => Promise<void>) | null = null;

  setAlarmCallback(fn: (subject: string, html: string) => Promise<void>) {
    this.alarmCallback = fn;
  }

  private tick() {
    const now = Date.now();
    if (now >= this.hourly.resetAt) {
      this.hourly = { count: 0, resetAt: now + 3_600_000, alarmFired: false };
    }
    if (now >= this.daily.resetAt) {
      this.daily = { count: 0, resetAt: now + 86_400_000, alarmFired: false };
    }
  }

  /**
   * Call BEFORE every sgMail.send() call.
   * Returns { allowed: true } if send is permitted.
   * Returns { allowed: false, reason } if circuit is open.
   */
  check(service: string, recipient: string): { allowed: boolean; reason?: string } {
    this.tick();

    if (this.hourly.count >= HOURLY_BLOCK) {
      logger.error(`[EmailSpendGuard] 🔴 CIRCUIT OPEN — hourly block (${this.hourly.count}/${HOURLY_BLOCK}). Send rejected from [${service}]`);
      return { allowed: false, reason: `Hourly email budget exceeded (${this.hourly.count}/${HOURLY_BLOCK})` };
    }
    if (this.daily.count >= DAILY_BLOCK) {
      logger.error(`[EmailSpendGuard] 🔴 CIRCUIT OPEN — daily block (${this.daily.count}/${DAILY_BLOCK}). Send rejected from [${service}]`);
      return { allowed: false, reason: `Daily email budget exceeded (${this.daily.count}/${DAILY_BLOCK})` };
    }
    return { allowed: true };
  }

  /**
   * Call AFTER a successful sgMail.send() call.
   */
  async record(service: string, recipient: string, subject: string) {
    this.tick();

    this.hourly.count++;
    this.daily.count++;

    const rec: EmailSendRecord = {
      ts: Date.now(),
      service,
      recipientMasked: maskEmail(recipient),
      subject,
    };

    this.recentSends.unshift(rec);
    if (this.recentSends.length > this.MAX_LOG) this.recentSends.pop();

    logger.info(`[EmailSpendGuard] 📧 Sent [${service}] → ${rec.recipientMasked} | hourly: ${this.hourly.count}/${HOURLY_BLOCK} | daily: ${this.daily.count}/${DAILY_BLOCK}`);

    await this.checkThresholds(service);
  }

  private async checkThresholds(service: string) {
    if (this.hourly.count >= HOURLY_WARN && !this.hourly.alarmFired) {
      this.hourly.alarmFired = true;
      logger.warn(`[EmailSpendGuard] ⚠️ HOURLY WARN threshold hit: ${this.hourly.count}/${HOURLY_WARN}`);
      await this.fireAlarm('HOURLY WARN', `Hourly email count reached ${this.hourly.count} (warn threshold: ${HOURLY_WARN}, block at: ${HOURLY_BLOCK})`, service);
    }
    if (this.daily.count >= DAILY_WARN && !this.daily.alarmFired) {
      this.daily.alarmFired = true;
      logger.warn(`[EmailSpendGuard] ⚠️ DAILY WARN threshold hit: ${this.daily.count}/${DAILY_WARN}`);
      await this.fireAlarm('DAILY WARN', `Daily email count reached ${this.daily.count} (warn threshold: ${DAILY_WARN}, block at: ${DAILY_BLOCK})`, service);
    }
    if (this.hourly.count >= HOURLY_BLOCK) {
      logger.error(`[EmailSpendGuard] 🔴 HOURLY BLOCK threshold reached: ${this.hourly.count}`);
      await this.fireAlarm('HOURLY CIRCUIT OPEN', `Hourly email count hit block threshold ${HOURLY_BLOCK}. All email sends are now BLOCKED until the hour resets.`, service);
    }
    if (this.daily.count >= DAILY_BLOCK) {
      logger.error(`[EmailSpendGuard] 🔴 DAILY BLOCK threshold reached: ${this.daily.count}`);
      await this.fireAlarm('DAILY CIRCUIT OPEN', `Daily email count hit block threshold ${DAILY_BLOCK}. All email sends are now BLOCKED until midnight.`, service);
    }
  }

  private async fireAlarm(level: string, details: string, triggeredBy: string) {
    if (!this.alarmCallback) return;
    const recent = this.recentSends.slice(0, 10)
      .map(r => `<tr><td>${new Date(r.ts).toISOString()}</td><td>${r.service}</td><td>${r.recipientMasked}</td><td>${r.subject.slice(0, 60)}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px">
        <h2 style="color:#dc2626">🚨 PetWash™ Email Spend Guard — ${level}</h2>
        <p><strong>Details:</strong> ${details}</p>
        <p><strong>Triggered by service:</strong> ${triggeredBy}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Hourly counter:</strong> ${this.hourly.count} / warn ${HOURLY_WARN} / block ${HOURLY_BLOCK}</p>
        <p><strong>Daily counter:</strong> ${this.daily.count} / warn ${DAILY_WARN} / block ${DAILY_BLOCK}</p>
        <h3 style="margin-top:20px">Last 10 sends:</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px">
          <thead style="background:#f3f4f6"><tr><th>Time</th><th>Service</th><th>Recipient</th><th>Subject</th></tr></thead>
          <tbody>${recent}</tbody>
        </table>
        <p style="margin-top:20px;color:#6b7280;font-size:12px">
          This alert was automatically generated by PetWash™ EmailSpendGuard.<br>
          To adjust thresholds set: EMAIL_GUARD_HOURLY_WARN, EMAIL_GUARD_HOURLY_BLOCK, EMAIL_GUARD_DAILY_WARN, EMAIL_GUARD_DAILY_BLOCK
        </p>
      </div>
    `;

    try {
      await this.alarmCallback(`Email Spend Guard — ${level}`, html);
    } catch (err: any) {
      logger.error('[EmailSpendGuard] Failed to fire alarm email', { error: err.message });
    }
  }

  getStats() {
    this.tick();
    return {
      hourly: { count: this.hourly.count, warnAt: HOURLY_WARN, blockAt: HOURLY_BLOCK, resetAt: new Date(this.hourly.resetAt).toISOString() },
      daily:  { count: this.daily.count,  warnAt: DAILY_WARN,  blockAt: DAILY_BLOCK,  resetAt: new Date(this.daily.resetAt).toISOString() },
      circuitOpen: this.hourly.count >= HOURLY_BLOCK || this.daily.count >= DAILY_BLOCK,
      recentSends: this.recentSends.slice(0, 20),
    };
  }
}

export const emailSpendGuard = new EmailSpendGuard();
export default emailSpendGuard;
