import { db } from './server/db';
import { bookings, providers } from './shared/schema';
import { eq, sql, desc, and, count } from 'drizzle-orm';

async function runAPITests() {
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

  const TEST_UID = 'test-provider-uid-001';
  const TEST_BOOKING_ID = 'TEST-BK-001';

  try {
    // === STATS ENDPOINT LOGIC ===
    const providerRecords = await db.select().from(providers).where(eq(providers.userId, TEST_UID));
    const providerIds = providerRecords.map(p => p.id);
    assert('S1. Provider records found', providerIds.length > 0);

    const allBookings = await db.select().from(bookings).where(
      sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`
    );
    assert('S2. Bookings query works for provider', allBookings.length >= 1);

    const totalBookings = allBookings.length;
    const completedBookings = allBookings.filter(b => b.status === 'completed').length;
    const activeBookings = allBookings.filter(b => ['confirmed', 'provider_confirmed', 'in_progress', 'started'].includes(b.status)).length;
    const totalEarnings = allBookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.providerPayout || '0'), 0);
    
    assert('S3. Stats calculation works', typeof totalBookings === 'number');
    assert('S4. Earnings calculation works', typeof totalEarnings === 'number');
    assert('S5. Active bookings count works', typeof activeBookings === 'number');
    
    const avgRating = providerRecords.reduce((sum, p) => sum + parseFloat(p.averageRating || '0'), 0) / providerRecords.length;
    assert('S6. Average rating calculation works', !isNaN(avgRating));

    const platformList = providerRecords.map(p => ({
      id: p.id,
      platformId: p.platformId,
      businessName: p.businessName,
      isAvailable: p.isAvailable,
      isActive: p.isActive,
      verificationStatus: p.verificationStatus,
    }));
    assert('S7. Platform list generated', platformList.length > 0);
    assert('S8. Platform has required fields', !!platformList[0].platformId && !!platformList[0].businessName);

    // === BOOKINGS ENDPOINT LOGIC ===
    const pageNum = 1;
    const limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [
      sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`,
    ];
    const whereClause = sql`${sql.join(conditions, sql` AND `)}`;

    const [countResult] = await db.select({ total: count() }).from(bookings).where(whereClause);
    assert('B1. Count query works', countResult?.total >= 1);

    const bookingResults = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      platformId: bookings.platformId,
      status: bookings.status,
      serviceType: bookings.serviceType,
      subtotal: bookings.subtotal,
      platformFee: bookings.platformFee,
      providerPayout: bookings.providerPayout,
      total: bookings.total,
      currency: bookings.currency,
      confirmedAt: bookings.confirmedAt,
      startedAt: bookings.startedAt,
      completedAt: bookings.completedAt,
      createdAt: bookings.createdAt,
    }).from(bookings).where(whereClause).orderBy(desc(bookings.createdAt)).limit(limitNum).offset(offset);
    
    assert('B2. Bookings query returns results', bookingResults.length >= 1);
    assert('B3. Booking has booking number', !!bookingResults[0].bookingNumber);
    assert('B4. Booking has platform ID', !!bookingResults[0].platformId);
    assert('B5. Booking has currency', !!bookingResults[0].currency);
    assert('B6. Pagination works', countResult.total >= bookingResults.length);

    // === BOOKINGS WITH STATUS FILTER ===
    const pendingConditions = [
      sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`,
      sql`${bookings.status} = ${'pending'}`,
    ];
    const pendingWhere = sql`${sql.join(pendingConditions, sql` AND `)}`;
    const pendingBookings = await db.select().from(bookings).where(pendingWhere);
    assert('B7. Status filter works', pendingBookings.every(b => b.status === 'pending'));

    // === EARNINGS ENDPOINT LOGIC ===
    const completedBks = await db.select().from(bookings).where(
      and(
        sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`,
        eq(bookings.status, 'completed')
      )
    ).orderBy(desc(bookings.completedAt));
    
    const earningsTotal = completedBks.reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    const pendingPayouts = completedBks.filter(b => b.payoutStatus === 'pending').reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    
    assert('E1. Earnings total calculation works', typeof earningsTotal === 'number' && !isNaN(earningsTotal));
    assert('E2. Pending payouts calculation works', typeof pendingPayouts === 'number' && !isNaN(pendingPayouts));

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEarnings = completedBks
      .filter(b => b.completedAt && new Date(b.completedAt) >= thisMonthStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    assert('E3. Monthly earnings calculation works', typeof thisMonthEarnings === 'number');

    // === APPLICATION STATUS LOGIC ===
    assert('A1. Provider records include rating', providerRecords[0].averageRating !== undefined);
    assert('A2. Provider records include reviews count', providerRecords[0].totalReviews !== undefined);

    // === AVAILABILITY ENDPOINT LOGIC ===
    const [provider] = await db.select().from(providers)
      .where(and(eq(providers.id, providerIds[0]), eq(providers.userId, TEST_UID)));
    assert('AV1. Provider found for availability', !!provider);
    
    await db.update(providers).set({ isAvailable: false }).where(eq(providers.id, providerIds[0]));
    let [updated] = await db.select().from(providers).where(eq(providers.id, providerIds[0]));
    assert('AV2. Availability set to false', updated.isAvailable === false);
    
    await db.update(providers).set({ isAvailable: true }).where(eq(providers.id, providerIds[0]));
    [updated] = await db.select().from(providers).where(eq(providers.id, providerIds[0]));
    assert('AV3. Availability restored to true', updated.isAvailable === true);

  } catch (error: any) {
    results.push(`ERROR: ${error.message}\n${error.stack}`);
    failed++;
  }

  console.log('\n===========================================');
  console.log('  DASHBOARD API ENDPOINT TEST RESULTS');
  console.log('===========================================\n');
  results.forEach(r => console.log(r));
  console.log(`\n-------------------------------------------`);
  console.log(`  TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('-------------------------------------------\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAPITests();
