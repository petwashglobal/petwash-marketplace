/**
 * Regression: Twilio signature must validate behind Firebase Hosting → Cloud Run.
 *
 * Bug: petwash.co.il proxies /api/** to the *.run.app service, so the request's
 * Host header is the internal run.app address. Header-reconstruction produced
 * the wrong URL → every Twilio signature failed → callers heard "An application
 * error has occurred." Fix: verify against the canonical public host(s) too.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { buildCandidatePublicUrls, verifyTwilioSignature } from '../services/voice/twilioHmac';

const AUTH = 'test_auth_token_123';
const params: Record<string, string> = { CallSid: 'CA123', From: '+972535972239', To: '+16292059681' };

function twilioSig(url: string, p: Record<string, string>) {
  const data = url + Object.keys(p).sort().map((k) => k + p[k]).join('');
  return crypto.createHmac('sha1', AUTH).update(Buffer.from(data, 'utf8')).digest('base64');
}
function mkReq(path: string, sig: string): any {
  return {
    headers: { 'x-twilio-signature': sig, host: 'petwash-api-gphpd64opa-zf.a.run.app', 'x-forwarded-host': 'petwash-api-gphpd64opa-zf.a.run.app' },
    originalUrl: path, body: params, protocol: 'https',
  };
}
const pass = (req: any) => buildCandidatePublicUrls(req).some((u) => verifyTwilioSignature(req, { authToken: AUTH, publicUrl: u }));

describe('Twilio signature behind Firebase→Cloud Run proxy', () => {
  for (const path of ['/api/maya/voice/twilio/voice', '/api/maya/voice/twilio/gather', '/api/maya/voice/twilio/status']) {
    it(`PASSES for ${path} when signed for petwash.co.il but Host is run.app`, () => {
      const sig = twilioSig(`https://petwash.co.il${path}`, params);
      expect(pass(mkReq(path, sig))).toBe(true);
    });
  }
  it('still REJECTS a forged signature', () => {
    expect(pass(mkReq('/api/maya/voice/twilio/voice', 'forged-signature'))).toBe(false);
  });
});
