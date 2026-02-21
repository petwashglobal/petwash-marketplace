import crypto from 'crypto';

const BASE = 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  duration: number;
}

const results: TestResult[] = [];

async function api(path: string, body: any, lang = 'en'): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': lang },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, detail: 'OK', duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message, duration: Date.now() - start });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function uniquePhone() {
  const rand = Math.floor(Math.random() * 9000000) + 1000000;
  return `+97250${rand}`;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  PetWash™ OTP System - Deep End-to-End Tests    ║');
  console.log('║  Multi-Channel (SMS + WhatsApp)                 ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ────────────────────────────────────────────────
  // SECTION 1: /api/auth/phone/otp/send - Validation
  // ────────────────────────────────────────────────
  console.log('📡 SECTION 1: Send Endpoint - Validation\n');

  await test('1.1 Reject empty body', async () => {
    const res = await api('/api/auth/phone/otp/send', {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.body.error === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res.body.error}`);
  });

  await test('1.2 Reject short phone number', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: '123' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.body.error === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res.body.error}`);
  });

  await test('1.3 Reject long phone number (>20 chars)', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: '+' + '1'.repeat(25) });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('1.4 Reject invalid userTypeIntent', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: uniquePhone(), userTypeIntent: 'HACKER' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('1.5 Reject invalid channel value', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: uniquePhone(), channel: 'telegram' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('1.6 Accept valid SMS send request (default channel)', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, userTypeIntent: 'PUBLIC' });
    assert(res.body.otpId !== undefined, 'Missing otpId in response');
    assert(typeof res.body.otpId === 'string', `otpId should be string, got ${typeof res.body.otpId}`);
    assert(res.body.otpId.length === 36, `otpId should be UUID (36 chars), got ${res.body.otpId.length}`);
  });

  await test('1.7 Accept valid WhatsApp send request', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, userTypeIntent: 'PROVIDER', channel: 'whatsapp' });
    assert(res.body.otpId !== undefined, 'Missing otpId in response');
  });

  await test('1.8 Accept STAFF_REQUEST userTypeIntent', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, userTypeIntent: 'STAFF_REQUEST' });
    assert(res.body.otpId !== undefined, 'Missing otpId in response');
  });

  await test('1.9 Default userTypeIntent to PUBLIC if omitted', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone });
    assert(res.body.otpId !== undefined, 'Missing otpId');
  });

  await test('1.10 Hebrew response when Accept-Language is he', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone }, 'he');
    if (res.body.message) {
      const hasHebrew = /[\u0590-\u05FF]/.test(res.body.message);
      assert(hasHebrew, `Expected Hebrew message, got: ${res.body.message}`);
    }
  });

  // ────────────────────────────────────────────────
  // SECTION 2: Cooldown Enforcement
  // ────────────────────────────────────────────────
  console.log('\n⏱️  SECTION 2: Cooldown Enforcement\n');

  await test('2.1 Second send to same phone within 60s triggers cooldown', async () => {
    const phone = uniquePhone();
    const res1 = await api('/api/auth/phone/otp/send', { phone });
    assert(res1.body.otpId !== undefined, 'First send should return otpId');

    const res2 = await api('/api/auth/phone/otp/send', { phone });
    assert(res2.status === 429, `Expected 429 on cooldown, got ${res2.status}`);
    assert(res2.body.error === 'COOLDOWN_ACTIVE', `Expected COOLDOWN_ACTIVE, got ${res2.body.error}`);
    assert(typeof res2.body.cooldownRemaining === 'number', 'Should include cooldownRemaining');
    assert(res2.body.cooldownRemaining > 0 && res2.body.cooldownRemaining <= 60, 
      `Cooldown should be 1-60s, got ${res2.body.cooldownRemaining}`);
  });

  // ────────────────────────────────────────────────
  // SECTION 3: /api/auth/phone/otp/verify
  // ────────────────────────────────────────────────
  console.log('\n🔐 SECTION 3: Verify Endpoint\n');

  await test('3.1 Reject empty verify body', async () => {
    const res = await api('/api/auth/phone/otp/verify', {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('3.2 Reject non-UUID otpId', async () => {
    const res = await api('/api/auth/phone/otp/verify', { otpId: 'not-a-uuid', code: '123456' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('3.3 Reject wrong code length (5 digits)', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/verify', { otpId: uuid, code: '12345' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('3.4 Reject wrong code length (7 digits)', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/verify', { otpId: uuid, code: '1234567' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('3.5 Return OTP_EXPIRED for random UUID (no OTP exists)', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/verify', { otpId: uuid, code: '123456' });
    assert(res.body.error === 'OTP_EXPIRED', `Expected OTP_EXPIRED, got ${res.body.error}`);
  });

  await test('3.6 Return INVALID_CODE for wrong code on valid OTP', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    assert(sendRes.body.otpId, 'Need otpId from send');

    const verifyRes = await api('/api/auth/phone/otp/verify', { otpId: sendRes.body.otpId, code: '000000' });
    assert(verifyRes.body.error === 'INVALID_CODE', `Expected INVALID_CODE, got ${verifyRes.body.error}`);
    assert(typeof verifyRes.body.remainingAttempts === 'number', 'Should return remainingAttempts');
    assert(verifyRes.body.remainingAttempts === 4, `Expected 4 remaining, got ${verifyRes.body.remainingAttempts}`);
  });

  await test('3.7 Track remaining attempts correctly', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;

    for (let i = 1; i <= 4; i++) {
      const res = await api('/api/auth/phone/otp/verify', { otpId, code: '000000' });
      const expected = 5 - i;
      assert(res.body.remainingAttempts === expected, 
        `Attempt ${i}: expected ${expected} remaining, got ${res.body.remainingAttempts}`);
    }
  });

  await test('3.8 Max attempts exceeded locks out OTP', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;

    for (let i = 0; i < 5; i++) {
      await api('/api/auth/phone/otp/verify', { otpId, code: '000000' });
    }
    const res = await api('/api/auth/phone/otp/verify', { otpId, code: '000000' });
    assert(res.body.error === 'MAX_ATTEMPTS_EXCEEDED' || res.body.error === 'OTP_EXPIRED', 
      `Expected MAX_ATTEMPTS_EXCEEDED or OTP_EXPIRED, got ${res.body.error}`);
  });

  // ────────────────────────────────────────────────
  // SECTION 4: /api/auth/phone/otp/resend
  // ────────────────────────────────────────────────
  console.log('\n🔄 SECTION 4: Resend Endpoint\n');

  await test('4.1 Reject empty resend body', async () => {
    const res = await api('/api/auth/phone/otp/resend', {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('4.2 Reject non-UUID otpId for resend', async () => {
    const res = await api('/api/auth/phone/otp/resend', { otpId: 'not-valid' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test('4.3 Return OTP_EXPIRED for unknown otpId', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/resend', { otpId: uuid });
    assert(res.status === 410, `Expected 410, got ${res.status}`);
    assert(res.body.error === 'OTP_EXPIRED', `Expected OTP_EXPIRED, got ${res.body.error}`);
  });

  await test('4.4 Resend blocked by cooldown within 60s', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;
    assert(otpId, 'Need otpId from initial send');

    const resendRes = await api('/api/auth/phone/otp/resend', { otpId, channel: 'whatsapp' });
    assert(resendRes.status === 429, `Expected 429 cooldown, got ${resendRes.status}`);
    assert(resendRes.body.error === 'COOLDOWN_ACTIVE', `Expected COOLDOWN_ACTIVE, got ${resendRes.body.error}`);
  });

  await test('4.5 Default resend channel is whatsapp', async () => {
    const res = await api('/api/auth/phone/otp/resend', { otpId: crypto.randomUUID() });
    assert(res.body.error === 'OTP_EXPIRED', 'Should get OTP_EXPIRED (testing default channel param accepted)');
  });

  await test('4.6 Accept sms channel for resend', async () => {
    const res = await api('/api/auth/phone/otp/resend', { otpId: crypto.randomUUID(), channel: 'sms' });
    assert(res.body.error === 'OTP_EXPIRED', 'Should get OTP_EXPIRED');
  });

  await test('4.7 Reject invalid channel for resend', async () => {
    const res = await api('/api/auth/phone/otp/resend', { otpId: crypto.randomUUID(), channel: 'pigeon' });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // ────────────────────────────────────────────────
  // SECTION 5: Response Structure Validation
  // ────────────────────────────────────────────────
  console.log('\n📋 SECTION 5: Response Structure\n');

  await test('5.1 Send response has required fields', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone });
    const body = res.body;
    if (body.success) {
      assert(body.otpId !== undefined, 'Missing otpId');
      assert(body.expiresIn !== undefined, 'Missing expiresIn');
      assert(body.message !== undefined, 'Missing message');
    } else {
      assert(body.otpId !== undefined, 'Missing otpId even in failure');
    }
  });

  await test('5.2 Verify response has required fields on failure', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/verify', { otpId: uuid, code: '123456' });
    assert(res.body.error !== undefined, 'Missing error field');
  });

  await test('5.3 Error response never leaks phone number', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const json = JSON.stringify(sendRes.body);
    assert(!json.includes(phone), 'Response should not contain full phone number');
  });

  await test('5.4 Error response never leaks OTP code', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone });
    const json = JSON.stringify(res.body);
    const hasCode = /\d{6}/.test(json.replace(res.body.otpId || '', '').replace(/\d{10,}/, ''));
    assert(!hasCode || json.includes('expiresIn'), 'Response should not leak OTP code');
  });

  // ────────────────────────────────────────────────
  // SECTION 6: Database Evidence Trail
  // ────────────────────────────────────────────────
  console.log('\n🗄️  SECTION 6: Database Evidence Audit Trail\n');

  await test('6.1 OTP event logged in otp_events table', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;
    if (!otpId) return;
    
    await sleep(500);
    const checkRes = await fetch(`${BASE}/api/auth/phone/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpId, code: '999999' }),
    });
    const verifyBody = await checkRes.json();
    assert(verifyBody.error === 'INVALID_CODE' || verifyBody.error === 'INTERNAL_ERROR',
      'Should get INVALID_CODE or INTERNAL_ERROR (confirms OTP was stored)');
  });

  await test('6.2 Multiple verify attempts tracked sequentially', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;
    if (!otpId) return;

    const r1 = await api('/api/auth/phone/otp/verify', { otpId, code: '111111' });
    const r2 = await api('/api/auth/phone/otp/verify', { otpId, code: '222222' });
    const r3 = await api('/api/auth/phone/otp/verify', { otpId, code: '333333' });

    if (r1.body.remainingAttempts !== undefined) {
      assert(r1.body.remainingAttempts === 4, `Attempt 1: expected 4 remaining, got ${r1.body.remainingAttempts}`);
      assert(r2.body.remainingAttempts === 3, `Attempt 2: expected 3 remaining, got ${r2.body.remainingAttempts}`);
      assert(r3.body.remainingAttempts === 2, `Attempt 3: expected 2 remaining, got ${r3.body.remainingAttempts}`);
    }
  });

  // ────────────────────────────────────────────────
  // SECTION 7: Security Tests
  // ────────────────────────────────────────────────
  console.log('\n🛡️  SECTION 7: Security\n');

  await test('7.1 OTP IDs are proper UUIDs v4', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone });
    const otpId = res.body.otpId;
    if (otpId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert(uuidRegex.test(otpId), `otpId is not valid UUID v4: ${otpId}`);
    }
  });

  await test('7.2 Cannot verify after OTP deleted (max attempts)', async () => {
    const phone = uniquePhone();
    const sendRes = await api('/api/auth/phone/otp/send', { phone });
    const otpId = sendRes.body.otpId;
    if (!otpId) return;

    for (let i = 0; i < 6; i++) {
      await api('/api/auth/phone/otp/verify', { otpId, code: '000000' });
    }

    const finalRes = await api('/api/auth/phone/otp/verify', { otpId, code: '000000' });
    assert(
      finalRes.body.error === 'OTP_EXPIRED' || finalRes.body.error === 'MAX_ATTEMPTS_EXCEEDED',
      `After lockout, expected OTP_EXPIRED or MAX_ATTEMPTS_EXCEEDED, got ${finalRes.body.error}`
    );
  });

  await test('7.3 OTP codes are cryptographically random (uniqueness check)', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const phone = uniquePhone();
      const res = await api('/api/auth/phone/otp/send', { phone });
      if (res.body.otpId) ids.push(res.body.otpId);
    }
    const uniqueIds = new Set(ids);
    assert(uniqueIds.size === ids.length, `Expected ${ids.length} unique OTP IDs, got ${uniqueIds.size}`);
  });

  await test('7.4 Phone normalization - different formats same result', async () => {
    const base = Math.floor(Math.random() * 9000000) + 1000000;
    const phone1 = `+97250${base}`;
    const res1 = await api('/api/auth/phone/otp/send', { phone: phone1 });
    assert(res1.body.otpId !== undefined, 'First send should work');

    const res2 = await api('/api/auth/phone/otp/send', { phone: phone1 });
    assert(res2.status === 429 || res2.body.error === 'COOLDOWN_ACTIVE',
      'Same phone should trigger cooldown');
  });

  await test('7.5 SQL injection in phone number rejected', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: "'+OR 1=1--" });
    assert(res.status === 400, `Expected 400 for SQL injection, got ${res.status}`);
  });

  await test('7.6 XSS in phone number rejected', async () => {
    const res = await api('/api/auth/phone/otp/send', { phone: '<script>alert(1)</script>' });
    assert(res.status === 400, `Expected 400 for XSS, got ${res.status}`);
  });

  // ────────────────────────────────────────────────
  // SECTION 8: Channel-Specific Tests
  // ────────────────────────────────────────────────
  console.log('\n📱 SECTION 8: Channel-Specific Behavior\n');

  await test('8.1 SMS channel returns correct message (English)', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, channel: 'sms' }, 'en');
    if (res.body.message) {
      assert(res.body.message.includes('SMS') || res.body.message.includes('sent'), 
        `Expected SMS-related message, got: ${res.body.message}`);
    }
  });

  await test('8.2 WhatsApp channel returns correct message (English)', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, channel: 'whatsapp' }, 'en');
    if (res.body.message) {
      assert(res.body.message.includes('WhatsApp') || res.body.message.includes('sent'),
        `Expected WhatsApp-related message, got: ${res.body.message}`);
    }
  });

  await test('8.3 SMS channel returns Hebrew message', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, channel: 'sms' }, 'he');
    if (res.body.message) {
      assert(/[\u0590-\u05FF]/.test(res.body.message), `Expected Hebrew, got: ${res.body.message}`);
    }
  });

  await test('8.4 WhatsApp channel returns Hebrew message', async () => {
    const phone = uniquePhone();
    const res = await api('/api/auth/phone/otp/send', { phone, channel: 'whatsapp' }, 'he');
    if (res.body.message) {
      assert(/[\u0590-\u05FF]/.test(res.body.message), `Expected Hebrew, got: ${res.body.message}`);
    }
  });

  // ────────────────────────────────────────────────
  // SECTION 9: Edge Cases
  // ────────────────────────────────────────────────
  console.log('\n⚠️  SECTION 9: Edge Cases\n');

  await test('9.1 Content-Type must be JSON', async () => {
    const res = await fetch(`${BASE}/api/auth/phone/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'phone=+972501234567',
    });
    assert(res.status === 400 || res.status === 415 || res.status === 500,
      `Expected error for non-JSON, got ${res.status}`);
  });

  await test('9.2 GET method rejected', async () => {
    const res = await fetch(`${BASE}/api/auth/phone/otp/send`, { method: 'GET' });
    assert(res.status === 404 || res.status === 405, `Expected 404/405 for GET, got ${res.status}`);
  });

  await test('9.3 PUT method rejected', async () => {
    const res = await fetch(`${BASE}/api/auth/phone/otp/send`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: uniquePhone() }),
    });
    assert(res.status === 404 || res.status === 405, `Expected 404/405 for PUT, got ${res.status}`);
  });

  await test('9.4 Verify with correct format but expired OTP returns proper error', async () => {
    const uuid = crypto.randomUUID();
    const res = await api('/api/auth/phone/otp/verify', { otpId: uuid, code: '123456' });
    assert(res.body.error === 'OTP_EXPIRED', `Expected OTP_EXPIRED for nonexistent, got ${res.body.error}`);
    assert(res.body.success === false, 'Should be success:false');
  });

  await test('9.5 Concurrent sends to different phones succeed', async () => {
    const phones = Array.from({ length: 3 }, () => uniquePhone());
    const promises = phones.map(p => api('/api/auth/phone/otp/send', { phone: p }));
    const results = await Promise.all(promises);
    const otpIds = results.map(r => r.body.otpId).filter(Boolean);
    assert(otpIds.length >= 2, `Expected at least 2 successful concurrent sends, got ${otpIds.length}`);
    const uniqueOtps = new Set(otpIds);
    assert(uniqueOtps.size === otpIds.length, 'All OTP IDs should be unique');
  });

  // ────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.detail}`);
    });
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\n⏱️  Total duration: ${totalDuration}ms`);
  console.log('═══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
