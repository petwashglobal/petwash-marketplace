/**
 * registerJourneyLoaders — CEO DEEP-LOGIC §84 loader registration.
 *
 * Called once at boot from routes.ts to register every JourneyLoader
 * that has a real persistence backend today. Kinds not registered
 * here surface as 501 NOT_IMPLEMENTED from the dispatch endpoint —
 * the client is expected to render a subdued placeholder (§72), NEVER
 * to fabricate a green OK badge.
 *
 * The registration list grows one loader at a time as each kind's
 * durable snapshot is proven to work end-to-end. Each new loader lands
 * in its own commit with regression pins next to it.
 */
import { getDefaultJourneyStateService } from './JourneyStateService';
import { prestigeJourneyLoader } from './loaders/PrestigeJourneyLoader';
import { refundJourneyLoader } from './loaders/RefundJourneyLoader';
import { petKyaJourneyLoader } from './loaders/PetKyaJourneyLoader';
import { supportCaseJourneyLoader } from './loaders/SupportCaseJourneyLoader';
import { bookingJourneyLoader } from './loaders/BookingJourneyLoader';
import { k9000JourneyLoader } from './loaders/K9000JourneyLoader';

let alreadyRegistered = false;

export function registerJourneyLoaders(): void {
  if (alreadyRegistered) return;
  alreadyRegistered = true;
  const svc = getDefaultJourneyStateService();
  svc.registerLoader('prestige_member', prestigeJourneyLoader);
  svc.registerLoader('refund', refundJourneyLoader);
  svc.registerLoader('pet', petKyaJourneyLoader);
  svc.registerLoader('support_case', supportCaseJourneyLoader);
  svc.registerLoader('booking', bookingJourneyLoader);
  svc.registerLoader('k9000_session', k9000JourneyLoader);
}

/** Tests only — allow re-registration after resetting the default service. */
export function __resetRegisterJourneyLoadersForTests(): void {
  alreadyRegistered = false;
}
