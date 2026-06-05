import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { classifyTwilioSmsError } from '../services/TwilioSMSService';

const root = resolve(__dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Twilio SMS provider error structure', () => {
  it('maps common Twilio provider codes to safe internal categories', () => {
    expect(classifyTwilioSmsError({ code: 20003 })).toMatchObject({
      code: 'SMS_PROVIDER_CONFIG_ERROR',
      providerCode: '20003',
      retryable: false,
      status: 503,
    });
    expect(classifyTwilioSmsError({ code: 20404 })).toMatchObject({
      code: 'SMS_PROVIDER_CONFIG_ERROR',
      providerCode: '20404',
    });
    expect(classifyTwilioSmsError({ code: 60605 })).toMatchObject({
      code: 'SMS_PROVIDER_GEO_BLOCKED',
      providerCode: '60605',
      status: 422,
    });
    expect(classifyTwilioSmsError({ code: 63016 })).toMatchObject({
      code: 'SMS_PROVIDER_SENDER_ERROR',
      providerCode: '63016',
    });
  });

  it('does not log full serialized Twilio errors or OTP payloads', () => {
    const src = read('server/services/TwilioSMSService.ts');

    expect(src).not.toContain("console.error('[TwilioSMS] Full error:'");
    expect(src).not.toContain('JSON.stringify(error, null, 2)');
    expect(src).toContain("logger.error('[TwilioSMS] Failed to send verification code'");
    expect(src).toContain("phone: formattedPhone.slice(0, 6) + '****'");
  });
});
