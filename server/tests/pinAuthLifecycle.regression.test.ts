/**
 * P0-142 CEO fix — PIN authentication lifecycle regression pin.
 *
 * These are source-pin assertions (not behavioural — no full express
 * app boot). They lock in the security contract so a future refactor
 * cannot silently re-open the pre-fix holes:
 *
 *   - /setup /change /remove /status now require Firebase Bearer.
 *   - Zod schemas for those routes have NO `email` field — identity
 *     is derived from the decoded token, never trusted from body.
 *   - /setup is CREATE ONLY (409 PIN_ALREADY_EXISTS).
 *   - /change requires currentPin + newPin, no email.
 *   - /remove requires current PIN in body.
 *   - Client Settings.tsx no longer sends `email` on any of these
 *     four endpoints, has explicit change/remove flows, and no longer
 *     silently uses setup as a change path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVER = readFileSync(resolve(__dirname, '..', 'routes', 'pin-auth.ts'), 'utf8');
const CLIENT = readFileSync(
  resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'Settings.tsx'),
  'utf8',
);

describe('server — Zod schemas drop client-supplied identity', () => {
  it('setupPinSchema has NO email field', () => {
    const start = SERVER.indexOf('const setupPinSchema = z.object({');
    const end = SERVER.indexOf('});', start);
    const schema = SERVER.slice(start, end);
    expect(schema).not.toMatch(/email:\s*z\./);
  });

  it('changePinSchema has NO email field', () => {
    const start = SERVER.indexOf('const changePinSchema = z.object({');
    const end = SERVER.indexOf('});', start);
    const schema = SERVER.slice(start, end);
    expect(schema).not.toMatch(/email:\s*z\./);
    expect(schema).toContain('currentPin:');
    expect(schema).toContain('newPin:');
  });

  it('removePinSchema requires only pin (no email)', () => {
    expect(SERVER).toContain('const removePinSchema = z.object({');
    const start = SERVER.indexOf('const removePinSchema = z.object({');
    const end = SERVER.indexOf('});', start);
    const schema = SERVER.slice(start, end);
    expect(schema).not.toMatch(/email:\s*z\./);
    expect(schema).toMatch(/pin:\s*z\.string\(\)/);
  });
});

describe('server — /setup /change /remove /status ALL call resolveAuthedUser', () => {
  const HANDLERS: Array<{ name: string; anchor: string }> = [
    { name: 'setup',  anchor: "router.post('/setup'"   },
    { name: 'change', anchor: "router.post('/change'"  },
    { name: 'remove', anchor: "router.delete('/remove'" },
    { name: 'status', anchor: "router.get('/status'"    },
  ];
  for (const h of HANDLERS) {
    it(`${h.name} handler resolves the authed user before any DB access`, () => {
      const idx = SERVER.indexOf(h.anchor);
      expect(idx).toBeGreaterThan(-1);
      const region = SERVER.slice(idx, idx + 1200);
      const resolveAt = region.indexOf('resolveAuthedUser(req, res)');
      const dbAt = region.indexOf('await db.');
      const findAt = region.indexOf('findUserByEmail(');
      expect(resolveAt).toBeGreaterThan(-1);
      if (dbAt > -1) expect(dbAt).toBeGreaterThan(resolveAt);
      if (findAt > -1) expect(findAt).toBeGreaterThan(resolveAt);
    });
  }
});

describe('server — /setup is CREATE ONLY (409 PIN_ALREADY_EXISTS)', () => {
  it('rejects when a PIN already exists for the account', () => {
    const idx = SERVER.indexOf("router.post('/setup'");
    const region = SERVER.slice(idx, idx + 2500);
    expect(region).toMatch(/if \(existingPin\)/);
    expect(region).toMatch(/status\(409\)/);
    expect(region).toMatch(/'PIN_ALREADY_EXISTS'/);
  });
});

describe('server — /status does NOT read req.query.email or req.body.email', () => {
  it('handler body has no req.query.email or req.body.email', () => {
    const idx = SERVER.indexOf("router.get('/status'");
    const end = SERVER.indexOf('});', idx);
    const region = SERVER.slice(idx, end + 4);
    expect(region).not.toMatch(/req\.query\.email/);
    expect(region).not.toMatch(/req\.body\.email/);
  });
});

describe('server — /remove reads pin from body, ignores email', () => {
  it('remove handler validates via removePinSchema, no body.email destructure', () => {
    const idx = SERVER.indexOf("router.delete('/remove'");
    const end = SERVER.indexOf('});', idx);
    const region = SERVER.slice(idx, end + 4);
    expect(region).toContain('removePinSchema.safeParse');
    expect(region).not.toMatch(/req\.body\.email/);
  });
});

describe('client Settings.tsx — no email sent on any lifecycle endpoint', () => {
  it('no request body sent to pin-auth ever contains email', () => {
    // Search for JSON.stringify blocks inside pin-auth fetches.
    // The only fields we should see are pin/currentPin/newPin/deviceId/deviceName.
    const idx = CLIENT.indexOf('function PinSecuritySection');
    const end = CLIENT.indexOf('function SettingsControlMap');
    const region = CLIENT.slice(idx, end);
    // No literal `email:` inside body JSON.stringify blocks.
    const jsonBodies = region.match(/JSON\.stringify\(\{[\s\S]{0,400}?\}\)/g) || [];
    for (const body of jsonBodies) {
      expect(body).not.toMatch(/\bemail\b/);
    }
  });

  it('has an explicit change flow (currentPin → newPin → confirm)', () => {
    expect(CLIENT).toContain("uiMode === 'change'");
    expect(CLIENT).toContain("changeStep === 'current'");
    expect(CLIENT).toContain("changeStep === 'new'");
    expect(CLIENT).toContain("changeStep === 'confirm'");
  });

  it('calls the /change endpoint (not /setup) on change', () => {
    // handleChangePin fetches /api/pin-auth/change.
    expect(CLIENT).toMatch(/getApiUrl\('\/api\/pin-auth\/change'\)/);
    // The body carries currentPin + newPin (no email).
    expect(CLIENT).toMatch(/JSON\.stringify\(\{ currentPin: currentPinValue, newPin: newPinValue \}\)/);
  });

  it('DELETE /remove sends { pin } in body (server needs it) and Content-Type', () => {
    const idx = CLIENT.indexOf("getApiUrl('/api/pin-auth/remove')");
    expect(idx).toBeGreaterThan(-1);
    const region = CLIENT.slice(idx - 200, idx + 800);
    expect(region).toContain("method: 'DELETE'");
    expect(region).toContain("'Content-Type': 'application/json'");
    expect(region).toContain('JSON.stringify({ pin })');
  });

  it('remove flow prompts for the current PIN via the keypad', () => {
    // The remove branch of handlePinEntered forwards the entered PIN.
    expect(CLIENT).toContain("uiMode === 'remove'");
    expect(CLIENT).toContain('handleRemovePin(pin)');
  });

  it('setup no longer overloads change — first-click Change goes to /change flow', () => {
    // The Change PIN button switches uiMode to 'change', NOT 'setup'.
    expect(CLIENT).toMatch(/onClick=\{\(\) => \{ resetPinInputs\(\); setUiMode\('change'\); \}\}[\s\S]{0,200}data-testid="button-change-pin"/);
  });
});

describe('server — /verify legacy path preserved (Firebase Bearer + email==token)', () => {
  it('/verify still requires Bearer AND email===decodedToken.email', () => {
    const idx = SERVER.indexOf("router.post('/verify'");
    // /verify is long — read a generous slice for the pin assertions.
    const region = SERVER.slice(idx, idx + 12000);
    expect(region).toContain('verifyIdToken');
    expect(region).toContain("email.toLowerCase() !== decodedToken.email?.toLowerCase()");
    expect(region).toContain("code: 'EMAIL_MISMATCH'");
  });
});

describe('server — logger events no longer emit raw email on lifecycle changes', () => {
  it('setup / change / remove logger.info lines carry only userId, not email', () => {
    // Sample the three new logger.info lines and confirm they do NOT
    // include `email: ...` — reduces the amount of PII in server logs.
    expect(SERVER).toContain("logger.info('[PIN Auth] PIN created', { userId: userInfo.id }");
    expect(SERVER).toContain("logger.info('[PIN Auth] PIN changed', { userId: userInfo.id }");
    expect(SERVER).toContain("logger.info('[PIN Auth] PIN removed', { userId: userInfo.id }");
  });
});
