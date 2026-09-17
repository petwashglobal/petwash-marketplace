/**
 * Walk My Pet peak-hour surcharge — ONE rule for the server price and the
 * booking screen (2026-09-17). The screen used to show the walk without it,
 * so a 7–9 AM / 5–7 PM walk showed ₪115 and was priced ₪138.
 *
 * `hour` is the wall-clock hour the customer picked (Israel time): the client
 * sends "HH:mm" and the server reads it back as the same wall-clock hour.
 */
export const WALK_PEAK_SURGE_RATE = 0.2;

export function isWalkPeakHour(hour: number): boolean {
  return (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
}

/** The surcharge on a walk subtotal for a start hour (0 off-peak). */
export function walkPeakSurcharge(hour: number, subtotal: number): number {
  return isWalkPeakHour(hour) ? subtotal * WALK_PEAK_SURGE_RATE : 0;
}
