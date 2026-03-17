/**
 * PetWash™ PII Minimizer — Google Services Architecture Policy Section 3 + 8
 * ==========================================================================
 * Applies field-level PII redaction before data leaves PostgreSQL to any
 * secondary Google service (Sheets, Drive, Forms).
 *
 * POLICY (Section 8.3):
 *   - Financial data stays in PostgreSQL — full fidelity.
 *   - Exports to Sheets carry redacted PII only.
 *   - Drive PDF exports of legal documents carry full data (intended recipient).
 *   - Forms intake submissions must not store full PII in Sheets rows.
 *
 * RULE: Never remove PII minimization calls before a Google export.
 */

export type ExportChannel = 'SHEETS' | 'DRIVE_METADATA' | 'FORMS_SUMMARY';

export type PiiLevel = 'NONE' | 'MINIMIZED' | 'FULL_INTERNAL';

/** Classify individual field names for audit/documentation purposes. */
export const PII_FIELD_CLASSIFICATION: Record<string, 'PII' | 'SAFE' | 'SAFE_FINANCIAL'> = {
  fullName:   'PII',
  name:       'PII',
  email:      'PII',
  phone:      'PII',
  message:    'PII',
  ipAddress:  'PII',
  address:    'PII',
  bookingId:   'SAFE',
  machineId:   'SAFE',
  providerId:  'SAFE',
  documentId:  'SAFE',
  platform:    'SAFE',
  status:      'SAFE',
  amount:      'SAFE_FINANCIAL',
  grossCents:  'SAFE_FINANCIAL',
  vatCents:    'SAFE_FINANCIAL',
  netCents:    'SAFE_FINANCIAL',
};

/**
 * Redact an email address: keeps first 2 chars + domain.
 * "nir@petwash.co.il" → "ni***@petwash.co.il"
 */
export function redactEmail(email?: string | null): string | null {
  if (!email) return null;
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return '***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Redact a phone number: keeps last 4 digits only.
 * "+972541234567" → "***4567"
 */
export function redactPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

/**
 * Redact a full name: keeps first initial only.
 * "Nir Hadad" → "N***"
 */
export function redactName(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return `${trimmed[0]}***`;
}

/**
 * Apply PII minimization rules to a flat payload object before exporting
 * to a Google secondary service.
 *
 * Rules per channel:
 *   SHEETS        — redact email, phone, name, message. Keep safe/financial fields.
 *   DRIVE_METADATA — redact same fields (metadata rows, not PDF content).
 *   FORMS_SUMMARY  — redact all PII fields; keep platform/status/date only.
 */
export function minimizeExportPayload(
  channel: ExportChannel,
  payload: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = { ...payload };

  if (channel === 'SHEETS' || channel === 'DRIVE_METADATA' || channel === 'FORMS_SUMMARY') {
    if ('email' in out)     out.email    = redactEmail(out.email);
    if ('phone' in out)     out.phone    = redactPhone(out.phone);
    if ('name' in out)      out.name     = redactName(out.name);
    if ('fullName' in out)  out.fullName = redactName(out.fullName);
    if ('message' in out)   out.message  = '[REDACTED]';
    if ('ipAddress' in out) out.ipAddress = '[REDACTED]';
    if ('address' in out)   out.address  = '[REDACTED]';
  }

  if (channel === 'FORMS_SUMMARY') {
    delete out.message;
    delete out.ipAddress;
    delete out.address;
  }

  return out;
}
