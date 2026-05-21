import { describe, it, expect } from 'vitest';
import { classifyRuntimeServices } from '../lib/runtimeServiceHealth';

const TWILIO = {
  TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32),
  TWILIO_AUTH_TOKEN: 'a'.repeat(32),
  TWILIO_PHONE_NUMBER: '+972501234567',
};

describe('classifyRuntimeServices', () => {
  it('CI/local (no K_SERVICE): missing Twilio is NOT production-critical', () => {
    const r = classifyRuntimeServices({}, false);
    expect(r.onCloudRun).toBe(false);
    expect(r.productionCriticalMissing).toEqual([]);
    expect(r.note).toMatch(/CI\/local/);
  });

  it('Cloud Run + Twilio missing: SMS is production-critical', () => {
    const r = classifyRuntimeServices({ K_SERVICE: 'petwash-api' }, false);
    expect(r.onCloudRun).toBe(true);
    expect(r.productionCriticalMissing).toContain('sms:twilio');
    expect(r.critical.sms.configured).toBe(false);
  });

  it('Cloud Run + Twilio phone present: not critical', () => {
    const r = classifyRuntimeServices({ K_SERVICE: 'petwash-api', ...TWILIO }, true);
    expect(r.productionCriticalMissing).toEqual([]);
    expect(r.critical.sms.configured).toBe(true);
    expect(r.optionalDegraded.database.available).toBe(true);
  });

  it('Cloud Run + messaging service SID (no phone): configured', () => {
    const r = classifyRuntimeServices(
      {
        K_SERVICE: 'petwash-api',
        TWILIO_ACCOUNT_SID: TWILIO.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: TWILIO.TWILIO_AUTH_TOKEN,
        TWILIO_MESSAGING_SERVICE_SID: 'MG' + '1'.repeat(32),
      },
      false,
    );
    expect(r.critical.sms.configured).toBe(true);
    expect(r.productionCriticalMissing).toEqual([]);
  });

  it('email/database are optional — absent does not become production-critical', () => {
    const r = classifyRuntimeServices({ K_SERVICE: 'petwash-api', ...TWILIO }, false);
    expect(r.optionalDegraded.email.configured).toBe(false);
    expect(r.optionalDegraded.database.available).toBe(false);
    expect(r.productionCriticalMissing).toEqual([]);
  });

  it('SendGrid key present: email reported configured', () => {
    const r = classifyRuntimeServices(
      { K_SERVICE: 'petwash-api', ...TWILIO, SENDGRID_API_KEY: 'SG.' + 'x'.repeat(24) },
      true,
    );
    expect(r.optionalDegraded.email.configured).toBe(true);
  });
});
