/**
 * Paw Finder lost/found report. Must require enough to publish SAFELY:
 * pet type + location/area + contact preference.
 */
import { z } from 'zod';
import { vmsg, type ValidationLang } from './messages';

export function pawFinderPublishSchema(lang: ValidationLang = 'en') {
  return z.object({
    petType: z.string().trim().min(1, vmsg('validation.pawFinder.petTypeRequired', lang)),
    lastSeenArea: z.string().trim().min(1, vmsg('validation.pawFinder.locationRequired', lang)),
    contactPreference: z.enum(['IN_APP', 'PHONE', 'EMAIL'], {
      errorMap: () => ({ message: vmsg('validation.pawFinder.contactRequired', lang) }),
    }),
  });
}
