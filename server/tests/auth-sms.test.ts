import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the OTP engine and logger BEFORE importing the router (vi.mock is hoisted).
vi.mock('../services/TwilioSMSService', () => ({
  twilioSMSService: {
    isReady: vi.fn(),
    isEmergencyDisabled: vi.fn(),
    sendVerificationCode: vi.fn(),
    verifyCode: vi.fn(),
  },
}));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { twilioSMSService } from '../services/TwilioSMSService';
import authSmsRouter, { normalizeFlow, redirectForFlow } from '../routes/auth-sms';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/sms', authSmsRouter);
  return app;
}

describe('canonical SMS auth wrapper (/api/auth/sms)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (twilioSMSService.isReady as any).mockReturnValue(true);
    (twilioSMSService.isEmergencyDisabled as any).mockReturnValue(false);
  });

  it('status: exposes SMS provider health for client fallback', async () => {
    (twilioSMSService.isReady as any).mockReturnValue(false);
    const res = await request(makeApp()).get('/api/auth/sms/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, smsProviderHealthy: false });
  });

  it('start: 400 when phone missing', async () => {
    const res = await request(makeApp()).post('/api/auth/sms/start').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('start: returns structured error metadata when Twilio/config unavailable', async () => {
    (twilioSMSService.sendVerificationCode as any).mockResolvedValue({
      success: false,
      message: 'SMS unavailable',
      code: 'SMS_PROVIDER_CONFIG_ERROR',
      providerCode: '20404',
      retryable: false,
      status: 503,
    });
    const res = await request(makeApp()).post('/api/auth/sms/start').send({ phone: '+972500000000' });
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('SMS_PROVIDER_CONFIG_ERROR');
    expect(res.body.code).toBe('SMS_PROVIDER_CONFIG_ERROR');
    expect(res.body.providerCode).toBe('20404');
    expect(res.body.retryable).toBe(false);
    expect(res.body.smsProviderHealthy).toBe(false);
  });

  it('start: maps geo-disabled provider errors to 422 with safe providerCode', async () => {
    (twilioSMSService.sendVerificationCode as any).mockResolvedValue({
      success: false,
      message: 'SMS unavailable',
      code: 'SMS_PROVIDER_GEO_BLOCKED',
      providerCode: '60605',
      retryable: false,
      status: 422,
    });
    const res = await request(makeApp()).post('/api/auth/sms/start').send({ phone: '+61419773360' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SMS_PROVIDER_GEO_BLOCKED');
    expect(res.body.providerCode).toBe('60605');
  });

  it('start: 200 sends code and echoes the flow', async () => {
    (twilioSMSService.sendVerificationCode as any).mockResolvedValue({ success: true, message: 'sent', expiresIn: 300 });
    const res = await request(makeApp()).post('/api/auth/sms/start').send({ phone: '+972500000000', flow: 'provider' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.flow).toBe('provider');
    expect(twilioSMSService.sendVerificationCode).toHaveBeenCalledWith('+972500000000', 'he', expect.anything());
  });

  it('verify: 400 when phone or code missing', async () => {
    const res = await request(makeApp()).post('/api/auth/sms/verify').send({ phone: '+972500000000' });
    expect(res.status).toBe(400);
  });

  it('verify: 401 on invalid code', async () => {
    (twilioSMSService.verifyCode as any).mockResolvedValue({ success: false, message: 'invalid' });
    const res = await request(makeApp()).post('/api/auth/sms/verify').send({ phone: '+972500000000', code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('verification_failed');
  });

  it('verify: 200 returns verificationToken + per-flow redirect', async () => {
    (twilioSMSService.verifyCode as any).mockResolvedValue({ success: true, message: 'ok', verificationToken: 'tok123' });
    const res = await request(makeApp()).post('/api/auth/sms/verify').send({ phone: '+972500000000', code: '123456', flow: 'guest' });
    expect(res.status).toBe(200);
    expect(res.body.verificationToken).toBe('tok123');
    expect(res.body.flow).toBe('guest');
    expect(res.body.redirect).toBe('/egift');
  });

  it('flow helpers: unknown defaults to prestige; redirects map correctly', () => {
    expect(normalizeFlow('weird')).toBe('prestige');
    expect(normalizeFlow(undefined)).toBe('prestige');
    expect(normalizeFlow('provider')).toBe('provider');
    expect(redirectForFlow('prestige')).toBe('/member/dashboard');
    expect(redirectForFlow('provider')).toBe('/provider/dashboard');
    expect(redirectForFlow('guest')).toBe('/egift');
  });
});
