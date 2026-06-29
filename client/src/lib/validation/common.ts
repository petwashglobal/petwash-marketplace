/**
 * Common field primitives — re-exported from fieldSchemas so call sites can
 * import { common } from '@/lib/validation' or directly from here.
 */
export {
  fieldSchemas,
  fieldSchemas as common,
  isValidIsraeliId,
  looksLikeIsraeliId,
  isValidPhone,
  POSTAL_CODE_RE,
  type FieldSchemas,
} from './fieldSchemas';
