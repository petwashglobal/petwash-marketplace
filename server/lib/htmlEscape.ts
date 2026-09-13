/**
 * Escaping for user text placed into HTML email bodies and header lines.
 *
 * Every public form that emails what a visitor typed must pass each field
 * through escapeHtml before interpolating it into `html:`. (2026-09-13: the
 * contact form pasted raw name/subject/message into mail sent from
 * Support@PetWash — including an auto-reply to any address the visitor typed.)
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One line of plain text for an email Subject: no CR/LF (header injection), trimmed, capped. */
export function toHeaderText(value: unknown, max = 120): string {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}
