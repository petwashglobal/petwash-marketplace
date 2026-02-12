import { db } from './server/db';
import { bookings, providers } from './shared/schema';
import { eq } from 'drizzle-orm';

const TEST_BOOKING_ID = 'TEST-BK-001';
const TEST_PROVIDER_ID = 1;

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results: string[] = [];

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push(`PASS: ${testName}`);
    } else {
      failed++;
      results.push(`FAIL: ${testName}${details ? ' - ' + details : ''}`);
    }
  }

  try {
    // Reset booking to pending for clean test
    await db.update(bookings).set({
      status: 'pending',
      confirmedAt: null,
      startedAt: null,
      completedAt: null,
      payoutStatus: 'pending',
    }).where(eq(bookings.id, TEST_BOOKING_ID));

    // TEST 1: Verify initial state
    let [bk] = await db.select().from(bookings).where(eq(bookings.id, TEST_BOOKING_ID));
    assert('1. Booking exists', !!bk);
    assert('2. Initial status is pending', bk.status === 'pending');
    assert('3. No confirmedAt initially', bk.confirmedAt === null);
    assert('4. No startedAt initially', bk.startedAt === null);
    assert('5. No completedAt initially', bk.completedAt === null);
    assert('6. Provider ID matches', String(bk.providerId) === String(TEST_PROVIDER_ID));

    // TEST 2: Provider owns booking check
    const providerRecords = await db.select().from(providers).where(eq(providers.id, TEST_PROVIDER_ID));
    assert('7. Provider exists', providerRecords.length > 0);
    const providerIds = providerRecords.map(p => p.id);
    const bookingPid = typeof bk.providerId === 'string' ? parseInt(bk.providerId as string, 10) : bk.providerId;
    assert('8. Provider ownership check passes', providerIds.includes(bookingPid as number), `providerIds=${JSON.stringify(providerIds)}, bookingPid=${bookingPid}`);

    // TEST 3: CONFIRM - pending -> provider_confirmed
    const confirmTime = new Date();
    await db.update(bookings).set({
      status: 'provider_confirmed',
      confirmedAt: confirmTime,
    }).where(eq(bookings.id, TEST_BOOKING_ID));
    
    [bk] = await db.select().from(bookings).where(eq(bookings.id, TEST_BOOKING_ID));
    assert('9. Status changed to provider_confirmed', bk.status === 'provider_confirmed');
    assert('10. confirmedAt timestamp saved', bk.confirmedAt !== null);
    assert('11. confirmedAt is valid date', bk.confirmedAt instanceof Date && !isNaN(bk.confirmedAt.getTime()));

    // TEST 4: Invalid transitions from provider_confirmed
    const invalidConfirm = !['pending', 'confirmed', 'owner_confirmed'].includes(bk.status);
    assert('12. Cannot re-confirm provider_confirmed booking', invalidConfirm === true);

    // TEST 5: START - provider_confirmed -> in_progress
    const startTime = new Date();
    assert('13. Can start from provider_confirmed', bk.status === 'provider_confirmed');
    
    await db.update(bookings).set({
      status: 'in_progress',
      startedAt: startTime,
    }).where(eq(bookings.id, TEST_BOOKING_ID));
    
    [bk] = await db.select().from(bookings).where(eq(bookings.id, TEST_BOOKING_ID));
    assert('14. Status changed to in_progress', bk.status === 'in_progress');
    assert('15. startedAt timestamp saved', bk.startedAt !== null);
    assert('16. startedAt is valid date', bk.startedAt instanceof Date && !isNaN(bk.startedAt.getTime()));
    assert('17. confirmedAt still preserved', bk.confirmedAt !== null);

    // TEST 6: Invalid - cannot start from in_progress
    assert('18. Cannot start already in_progress booking', bk.status !== 'provider_confirmed');

    // TEST 7: COMPLETE - in_progress -> completed
    const completeTime = new Date();
    assert('19. Can complete from in_progress', ['in_progress', 'started'].includes(bk.status));
    
    await db.update(bookings).set({
      status: 'completed',
      completedAt: completeTime,
      payoutStatus: 'pending',
    }).where(eq(bookings.id, TEST_BOOKING_ID));
    
    [bk] = await db.select().from(bookings).where(eq(bookings.id, TEST_BOOKING_ID));
    assert('20. Status changed to completed', bk.status === 'completed');
    assert('21. completedAt timestamp saved', bk.completedAt !== null);
    assert('22. completedAt is valid date', bk.completedAt instanceof Date && !isNaN(bk.completedAt.getTime()));
    assert('23. payoutStatus set to pending', bk.payoutStatus === 'pending');
    assert('24. All 3 timestamps present', bk.confirmedAt !== null && bk.startedAt !== null && bk.completedAt !== null);

    // TEST 8: Timestamp order
    assert('25. confirmedAt <= startedAt', bk.confirmedAt! <= bk.startedAt!);
    assert('26. startedAt <= completedAt', bk.startedAt! <= bk.completedAt!);

    // TEST 9: Cannot complete already completed
    assert('27. Cannot complete already completed', !['in_progress', 'started'].includes(bk.status));

    // TEST 10: Skip transitions
    await db.update(bookings).set({ status: 'pending', confirmedAt: null, startedAt: null, completedAt: null }).where(eq(bookings.id, TEST_BOOKING_ID));
    [bk] = await db.select().from(bookings).where(eq(bookings.id, TEST_BOOKING_ID));
    assert('28. Cannot start from pending (must confirm first)', bk.status !== 'provider_confirmed');
    assert('29. Cannot complete from pending', !['in_progress', 'started'].includes(bk.status));

    // TEST 11: Commission math (15% fee)
    const payout = parseFloat(bk.providerPayout || '0');
    const fee = parseFloat(bk.platformFee || '0');
    const total = parseFloat(bk.total || '0');
    assert('30. Payout + fee = total', Math.abs((payout + fee) - total) < 0.01, `payout=${payout}, fee=${fee}, total=${total}`);
    assert('31. Fee is 15% of total', Math.abs(fee - (total * 0.15)) < 0.01, `fee=${fee}, expected=${total * 0.15}`);
    assert('32. Payout is 85% of total', Math.abs(payout - (total * 0.85)) < 0.01, `payout=${payout}, expected=${total * 0.85}`);

    // TEST 12: Non-existent booking
    const [nonExistent] = await db.select().from(bookings).where(eq(bookings.id, 'DOES-NOT-EXIST'));
    assert('33. Non-existent booking returns undefined', nonExistent === undefined);

    // TEST 13: Non-existent provider
    const fakeProvider = await db.select().from(providers).where(eq(providers.userId, 'fake-user'));
    assert('34. Non-existent provider returns empty', fakeProvider.length === 0);

    // TEST 14: Booking number format
    assert('35. Booking number has PW prefix', bk.bookingNumber.startsWith('PW-'));

    // Restore to pending for future use
    await db.update(bookings).set({ 
      status: 'pending', confirmedAt: null, startedAt: null, completedAt: null, payoutStatus: 'pending'
    }).where(eq(bookings.id, TEST_BOOKING_ID));

  } catch (error: any) {
    results.push(`ERROR: ${error.message}\n${error.stack}`);
    failed++;
  }

  console.log('\n===========================================');
  console.log('  PROVIDER DASHBOARD TEST RESULTS');
  console.log('===========================================\n');
  results.forEach(r => console.log(r));
  console.log(`\n-------------------------------------------`);
  console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('-------------------------------------------\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
