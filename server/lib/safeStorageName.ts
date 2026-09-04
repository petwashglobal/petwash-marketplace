/**
 * safeStorageName — never let a user-supplied filename reach a storage key,
 * a filesystem path, or a response header verbatim.
 *
 * Several upload routes built object keys like:
 *
 *     `${conversationId}/${attachmentId}-${file.originalname}`      (messaging)
 *     `careers/${applicationId}/${documentType}_${ts}_${originalname}` (careers)
 *     `health-safety/${incidentId}/${ts}_${originalname}`             (H&S)
 *     `field-updates/${fieldUpdateId}/${ts}_${originalname}`          (field ops)
 *
 * `originalname` is entirely attacker-controlled — it is just a string in the
 * multipart header, never validated by multer. Three concrete problems:
 *
 *  1. PATH SEGMENTS. A `/` in the name silently re-parents the object inside
 *     the bucket, and `..` segments get normalised by HTTP clients when the
 *     resulting public URL is fetched, so the link no longer resolves to the
 *     object that was written. On a local-disk sink the same input is a real
 *     directory traversal.
 *  2. HEADER INJECTION. The name was interpolated into
 *     `attachment; filename="${originalname}"`. A quote, CR or LF breaks out
 *     of the quoted-string and injects into object metadata / response headers.
 *  3. NULL BYTES / CONTROL CHARS, which truncate paths in some downstream
 *     consumers and render unpredictably in the admin UI.
 *
 * This module gives one answer: strip the name down to a conservative,
 * flat, printable-ASCII token. Callers must always pair it with their own
 * random component (nanoid / uuid) — the sanitised name is for HUMAN
 * recognisability only and is NOT guaranteed unique.
 */

import path from 'path';

/** Longest sanitised name we will emit (keeps GCS keys well under the 1024-byte cap). */
const MAX_NAME_LEN = 80;

/** Extensions that must never be preserved on a stored object. */
const DANGEROUS_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.shtml', '.svg', '.xml',
  '.js', '.mjs', '.cjs', '.jsx', '.ts',
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phar',
  '.jsp', '.jspx', '.asp', '.aspx', '.cer', '.asa',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.com', '.exe', '.scr',
  '.jar', '.war', '.py', '.rb', '.pl', '.cgi',
  '.htaccess', '.htpasswd',
]);

/**
 * Reduce a user-supplied filename to a safe, flat token.
 *
 * Guarantees about the returned value:
 *   - never empty (falls back to `file`)
 *   - contains ONLY `[A-Za-z0-9._-]`
 *   - contains no `/`, no `\`, no `..`, no leading `.`, no control chars
 *   - is at most MAX_NAME_LEN characters
 *   - does not end in an executable / markup extension
 *
 * It is therefore safe to interpolate into a storage object key, a filesystem
 * path (inside an already-confined directory), or a quoted header value.
 */
export function sanitizeFilenameForStorage(originalname: unknown): string {
  if (typeof originalname !== 'string' || originalname.length === 0) return 'file';

  // 1. Take the basename under BOTH separator conventions. `path.basename`
  //    only knows the host's separator, so a Windows-style `..\..\evil` would
  //    survive on Linux. Normalise backslashes to slashes first.
  let name = originalname.replace(/\\/g, '/');
  name = name.slice(name.lastIndexOf('/') + 1);
  name = path.basename(name);

  // 2. Drop everything outside a conservative printable set. This removes
  //    NULs, CR/LF (header injection), quotes (header quoted-string escape),
  //    semicolons, spaces and every non-ASCII byte in one pass.
  name = name.replace(/[^A-Za-z0-9._-]/g, '_');

  // 3. Collapse dot runs so no `..` can survive, and strip leading dots so we
  //    can never emit a dotfile (`.htaccess`) or a relative marker.
  name = name.replace(/\.{2,}/g, '.').replace(/^\.+/, '');

  // 4. Neutralise a dangerous trailing extension. Renaming rather than
  //    rejecting keeps the upload working while making the stored object
  //    inert; the route's own MIME allowlist is what decides acceptance.
  const ext = path.extname(name).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    name = name.slice(0, -ext.length) + ext.replace(/\./g, '_') + '.txt';
  }

  // 5. Length cap, preserving the (now-safe) extension where possible.
  if (name.length > MAX_NAME_LEN) {
    const keptExt = path.extname(name).slice(0, 10);
    name = name.slice(0, MAX_NAME_LEN - keptExt.length) + keptExt;
  }

  // 6. Never return an empty or dot-only token.
  if (!name || /^[._-]*$/.test(name)) return 'file';

  return name;
}

/**
 * Build a value safe to put in a `Content-Disposition` header.
 *
 * Uses the sanitised ASCII name for the legacy `filename=` parameter and, per
 * RFC 5987/6266, a percent-encoded `filename*=UTF-8''…` for the real name so
 * the user still sees something recognisable when they download it. The
 * percent-encoding is what makes the original name safe to include at all.
 */
export function safeContentDisposition(
  type: 'inline' | 'attachment',
  originalname: unknown,
): string {
  const ascii = sanitizeFilenameForStorage(originalname);
  const utf8 = encodeURIComponent(typeof originalname === 'string' ? originalname : ascii)
    // encodeURIComponent leaves these, and they are not valid in ext-value.
    .replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
