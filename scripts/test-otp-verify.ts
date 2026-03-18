import { registrationOTPService } from '../server/services/RegistrationOTPService';
import { db } from '../server/db';
import { otpEvents, smsEvidence } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

const OTP_ID = '2549d71c-ffb3-46a2-b678-88e0d0b947fb';
const CODE = process.argv[2];

if (!CODE || CODE.length !== 6) {
  console.error('Usage: npx tsx scripts/test-otp-verify.ts <6-digit-code>');
  process.exit(1);
}

async function main() {
  console.log(`\n[OTP VERIFY] Verifying code ${CODE} for otpId ${OTP_ID}...`);

  const result = await registrationOTPService.verifyOTP(OTP_ID, CODE, {
    ip: '127.0.0.1',
    userAgent: 'PetWash-DevTest/1.0',
    traceId: 'live-verify-001',
  });

  console.log('\n[VERIFY RESULT]:', JSON.stringify(result, null, 2));

  // Check DB for verification event
  const [verifyEvent] = await db
    .select()
    .from(otpEvents)
    .where(eq(otpEvents.traceId, 'live-verify-001'))
    .orderBy(desc(otpEvents.createdAt))
    .limit(1);

  console.log('\n[DB verification event]:', verifyEvent
    ? JSON.stringify({ ...verifyEvent, otpHash: '[HIDDEN]' }, null, 2)
    : 'NOT FOUND in DB');

  if (result.success) {
    console.log('\n✅ OTP verified successfully!');
    console.log('   Phone:', result.metadata?.phoneE164);
    console.log('   Intent:', result.metadata?.userTypeIntent);
    console.log('\n[NOTE] In production, the mobile client would pass a Firebase ID token');
    console.log('       to the /api/auth/phone/otp/verify route, which triggers:');
    console.log('       1. users row upsert (phone_verified=true, phone_e164 set)');
    console.log('       2. membership number assignment (PW-AU-XXXXXXXX)');
    console.log('       3. welcome SMS with membership ID');
  } else {
    console.error('\n❌ Verification failed:', result.error);
    if (result.remainingAttempts !== undefined) {
      console.log('   Remaining attempts:', result.remainingAttempts);
    }
  }

  // Show all events for this OTP
  const allEvents = await db
    .select()
    .from(otpEvents)
    .where(eq(otpEvents.phoneE164, '+61419773360'))
    .orderBy(desc(otpEvents.createdAt))
    .limit(5);

  console.log('\n[All DB events for this phone]:');
  allEvents.forEach(e => {
    console.log(`  ${e.eventType.padEnd(20)} | ${e.traceId} | ${e.createdAt?.toISOString()}`);
  });

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
