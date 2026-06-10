/**
 * israeliDeliveryCalendar.ts — working-day math for shop delivery under Israeli norms.
 *
 * No dispatch/delivery on the Israeli weekend (Friday + Saturday) or on public
 * holidays. ETAs are computed in DELIVERY business days, skipping both.
 *
 * ⚠️ The 2026 holiday dates below are a Gregorian SNAPSHOT — Jewish-calendar holidays
 * shift every year, so this list MUST be refreshed annually (or replaced with a Hebcal
 * API feed). It is intentionally explicit and easy to edit. We do not guess future years.
 */

// Israeli public-holiday no-delivery dates — 2026 (YYYY-MM-DD). Update yearly.
export const ISRAELI_NO_DELIVERY_DATES: ReadonlySet<string> = new Set([
  '2026-03-03', // Purim
  '2026-04-01', // Erev Pesach
  '2026-04-02', // Pesach I
  '2026-04-08', // Pesach VII
  '2026-04-21', // Yom HaZikaron
  '2026-04-22', // Yom HaatzmaUt (Independence Day)
  '2026-05-21', // Erev Shavuot
  '2026-05-22', // Shavuot
  '2026-09-11', // Erev Rosh Hashanah
  '2026-09-12', // Rosh Hashanah I
  '2026-09-13', // Rosh Hashanah II
  '2026-09-20', // Erev Yom Kippur
  '2026-09-21', // Yom Kippur
  '2026-09-25', // Erev Sukkot
  '2026-09-26', // Sukkot I
  '2026-10-02', // Erev Shmini Atzeret
  '2026-10-03', // Shmini Atzeret / Simchat Torah
]);

const iso = (d: Date) => d.toISOString().split('T')[0];

/** True if the date is a valid delivery day (not Fri/Sat, not a public holiday). */
export function isDeliveryDay(d: Date): boolean {
  const day = d.getDay(); // 0=Sun … 5=Fri, 6=Sat
  if (day === 5 || day === 6) return false;       // Israeli weekend
  if (ISRAELI_NO_DELIVERY_DATES.has(iso(d))) return false; // public holiday
  return true;
}

/**
 * Advances `businessDays` valid delivery days forward from `from` (default today),
 * skipping weekends + holidays. Returns YYYY-MM-DD.
 */
export function addDeliveryDays(businessDays: number, from?: Date): string {
  const d = from ? new Date(from) : new Date();
  let counted = 0;
  while (counted < businessDays) {
    d.setDate(d.getDate() + 1);
    if (isDeliveryDay(d)) counted++;
  }
  return iso(d);
}

/** Next valid dispatch day (today if today is a delivery day, else the next one). */
export function nextDispatchDate(from?: Date): string {
  const d = from ? new Date(from) : new Date();
  while (!isDeliveryDay(d)) d.setDate(d.getDate() + 1);
  return iso(d);
}

/**
 * Consumer-facing legal delivery note (Israel). Covers: business-day basis excluding
 * weekend/holidays, and the 14-day cancellation right under the Consumer Protection Law
 * 1981 (חוק הגנת הצרכן), §14ג (distance selling).
 */
export const DELIVERY_LEGAL_NOTE = {
  he:
    'זמני האספקה הם בימי עסקים (א׳–ה׳) ואינם כוללים שישי, שבת וחגי ישראל. ' +
    'בהתאם לחוק הגנת הצרכן, התשמ״א–1981, ניתן לבטל עסקת מכר מרחוק תוך 14 יום מקבלת המוצר או מסמך הגילוי, לפי המאוחר.',
  en:
    'Delivery times are in business days (Sun–Thu) and exclude Friday, Saturday and Israeli public holidays. ' +
    'Under the Israeli Consumer Protection Law, 1981, a distance-selling purchase may be cancelled within 14 days of receiving the product or the disclosure document, whichever is later.',
} as const;
