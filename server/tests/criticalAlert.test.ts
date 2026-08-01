import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendCriticalAlert } from '../services/alerts';

/**
 * sendCriticalAlert (CTO P1-10) must fan out to INDEPENDENT channels and be fail-safe:
 * one dead channel can't silence a money/security alert, and the function never throws.
 * With nothing configured it must report all channels false (and log that no channel
 * was reachable) — never crash the caller (e.g. the money-path cron).
 */
describe('sendCriticalAlert — multi-channel, fail-safe', () => {
  const KEYS = ['SENDGRID_API_KEY', 'SLACK_WEBHOOK_URL', 'ALERTS_SLACK_WEBHOOK', 'ALERT_WEBHOOK_URL', 'SUPER_ADMIN_ALERT_PHONE'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('never throws and reports all channels false when nothing is configured', async () => {
    const r = await sendCriticalAlert('test alert', '<p>x</p>', 'plain text');
    expect(r).toEqual({ email: false, webhook: false, sms: false });
  });
});
