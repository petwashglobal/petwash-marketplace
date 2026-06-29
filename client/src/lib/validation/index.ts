/**
 * PetWash centralized validation library — single source of truth for form
 * validation across the apps. One import surface; reuse, don't re-roll.
 *
 * Stack (already installed, NO new deps): zod + react-hook-form +
 * @hookform/resolvers + libphonenumber-js + i18n (he/en, English fallback).
 *
 * Pattern: build a schema from a factory with the active language, wire it to
 * react-hook-form via zodResolver, and render inline errors with <FormMessage/>.
 * Backend ALWAYS re-validates — this layer is UX. Never trust amount, discount,
 * wallet balance, tier, provider status, payment/booking/approval status from
 * the client.
 *
 *   import { providerApplicationSchema } from '@/lib/validation';
 *   const schema = useMemo(() => providerApplicationSchema(i18n.language), [i18n.language]);
 *   const form = useForm({ resolver: zodResolver(schema) });
 */

// messages + language type
export { vmsg, type ValidationKey, type ValidationLang } from './messages';

// common field primitives + standalone validators
export {
  fieldSchemas,
  fieldSchemas as common,
  isValidIsraeliId,
  looksLikeIsraeliId,
  isValidPhone,
  POSTAL_CODE_RE,
  type FieldSchemas,
} from './fieldSchemas';

// dates & age
export {
  parseDate,
  ageInYears,
  isAtLeastAge,
  isFutureDate,
  isNotFutureDate,
  isNotPastDate,
  isEndOnOrAfterStart,
  dateSchemas,
  endAfterStartRefinement,
} from './dates';

// money (UX guard only)
export { amountSchema } from './money';

// domain form schemas
export { signupSchema, userProfileSchema } from './users';
export { providerApplicationSchema } from './providers';
export { petPassportSchema } from './pets';
export { bookingRequestSchema } from './bookings';
export { pawFinderPublishSchema } from './pawFinder';
export { incidentMinimalSchema, incidentDetailedSchema } from './incidents';
export { giftPurchaseSchema } from './gifts';
export { waitlistSchema } from './waitlist';
