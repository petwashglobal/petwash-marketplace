/**
 * Incident case forms. Allow a MINIMAL urgent report (just a description) so
 * users can raise something fast; richer evidence is requested afterwards.
 */
import { z } from 'zod';
import { vmsg, type ValidationLang } from './messages';

/** Minimal urgent report — description only. */
export function incidentMinimalSchema(lang: ValidationLang = 'en') {
  return z.object({
    description: z.string().trim().min(10, vmsg('validation.incident.descriptionRequired', lang)),
  });
}

/** Fuller case (used once the urgent report is in and we ask for details). */
export function incidentDetailedSchema(lang: ValidationLang = 'en') {
  return z.object({
    category: z.string().trim().min(1, vmsg('validation.required', lang)),
    description: z.string().trim().min(10, vmsg('validation.incident.descriptionRequired', lang)),
  });
}
