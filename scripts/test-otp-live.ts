import { registrationOTPService } from '../server/services/RegistrationOTPService';
import { db } from '../server/db';
import { otpEvents, smsEvidence } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

const TARGET_PHONE = '+61419773360';

async function main() {
  console.log(`\n[OTP TEST] Sending OTP to ${TARGET_PHONE}...`);

  const result = await registrationOTPService.sendOTP(TARGET_PHONE, 'PUBLIC', {
    language: 'en',
    ip: '127.0.0.1',
    userAgent: 'PetWash-DevTest/1.0',
    traceId: 'live-test-001',
  });

  console.log('\n[OTP RESULT]:', JSON.stringify(result, null, 2));

  // Verify it landed in the DB
  const [event] = await db
    .select()
    .from(otpEvents)
    .where(eq(otpEvents.traceId, 'live-test-001'))
    .orderBy(desc(otpEvents.createdAt))
    .limit(1);

  console.log('\n[DB otp_events row]:', event
    ? JSON.stringify({ ...event, otpHash: event.otpHash?.slice(0, 12) + '...' }, null, 2)
    : 'NOT FOUND — DB insert failed!');

  const [sms] = await db
    .select()
    .from(smsEvidence)
    .where(eq(smsEvidence.traceId, 'live-test-001'))
    .orderBy(desc(smsEvidence.createdAt))
    .limit(1);

  console.log('\n[DB sms_evidence row]:', sms
    ? JSON.stringify({ ...sms, renderedText: '[REDACTED]' }, null, 2)
    : 'NOT FOUND — DB insert failed!');

  if (result.success) {
    console.log(`\n✅ OTP sent! otpId = ${result.otpId}`);
    console.log(`   Expires in: ${result.expiresIn}s`);
    console.log(`   Channel: ${result.channel}`);
    console.log('\n>>> Tell the user to check their phone and give you the 6-digit code.');
    console.log('>>> Store otpId for verification:');
    console.log(`    OTP_ID=${result.otpId}`);
  } else {
    console.error('\n❌ FAILED:', result.error);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
