import fs from 'fs';
import path from 'path';
import os from 'os';

// Upload files live under the app's uploads dir or the OS temp dir (multer's
// diskStorage default). Confine every FS access to those roots so a traversed
// path can never reach an arbitrary file. Boolean guard — the static analyser
// sees the taint cleared before each sink.
const UPLOAD_ROOTS = [path.resolve(process.cwd(), 'uploads'), path.resolve(os.tmpdir())];
function isConfinedUploadPath(p: unknown): p is string {
  if (typeof p !== 'string' || !p) return false;
  const resolved = path.resolve(p);
  return UPLOAD_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

/**
 * Content-based (magic-number) file validation.
 *
 * multer's fileFilter only sees `file.mimetype`, which is the client-supplied
 * Content-Type header — trivially spoofable. An attacker can rename an HTML
 * page, an SVG-with-script, or an executable to `evil.png` and set
 * `Content-Type: image/png` and it sails through a mimetype-only allowlist.
 *
 * This sniffs the actual leading bytes of the buffer and confirms they match an
 * allowed file family. Zero dependencies (the `file-type` package is ESM-only
 * and fights our CJS/esbuild build), so we hand-roll the few signatures we accept.
 */

export type DetectedFileKind =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'heic'
  | 'pdf'
  | null;

/** Map a detected kind to its canonical mime type. */
export const KIND_TO_MIME: Record<Exclude<DetectedFileKind, null>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Sniff a buffer's true file kind from its magic number. Returns null when the
 * bytes match none of the families we accept (i.e. reject — could be HTML, SVG,
 * a script, an archive, an executable, etc.).
 */
export function detectFileKind(buf: Buffer): DetectedFileKind {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // GIF: "GIF87a" / "GIF89a"
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'gif';

  // PDF: "%PDF"
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return 'pdf';

  // WebP: "RIFF"....(size)...."WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }

  // HEIC/HEIF: ISO-BMFF box — bytes 4..8 == "ftyp", brand at 8..12 in a known set.
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'heif'].includes(brand)) {
      return 'heic';
    }
  }

  return null;
}

export interface FileTypeCheck {
  ok: boolean;
  detectedKind: DetectedFileKind;
  detectedMime: string | null;
  reason?: string;
}

/**
 * Validate that a buffer's real content is one of `allowedMimes`. The claimed
 * mimetype is IGNORED for the security decision — only the sniffed bytes matter.
 * Pass `claimedMime` only so we can flag a mismatch in the reason for logging.
 */
export function validateFileContent(
  buf: Buffer,
  allowedMimes: string[],
  claimedMime?: string,
): FileTypeCheck {
  const detectedKind = detectFileKind(buf);
  const detectedMime = detectedKind ? KIND_TO_MIME[detectedKind] : null;

  if (!detectedKind || !detectedMime) {
    return {
      ok: false,
      detectedKind: null,
      detectedMime: null,
      reason: `Unrecognized or disallowed file content${claimedMime ? ` (claimed ${claimedMime})` : ''}`,
    };
  }

  const allowed = allowedMimes.map((m) => m.toLowerCase());
  if (!allowed.includes(detectedMime)) {
    return {
      ok: false,
      detectedKind,
      detectedMime,
      reason: `File content is ${detectedMime}, which is not in the allowed list`,
    };
  }

  return { ok: true, detectedKind, detectedMime };
}

/** Flatten the various shapes multer puts on the request into a flat file list. */
function collectMulterFiles(req: any): Array<{ fieldname?: string; mimetype?: string; buffer?: Buffer }> {
  const out: any[] = [];
  if (req.file) out.push(req.file);
  if (Array.isArray(req.files)) {
    out.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    for (const key of Object.keys(req.files)) {
      const v = (req.files as any)[key];
      if (Array.isArray(v)) out.push(...v);
    }
  }
  return out;
}

/**
 * Express middleware factory: run AFTER multer (memoryStorage) to reject any
 * uploaded file whose real bytes don't match `allowedMimes`. This is the teeth
 * behind a fileFilter that can only see the spoofable Content-Type header.
 *
 * Requires memoryStorage (file.buffer present). Files with no buffer are skipped
 * with a warning rather than failing closed, so a diskStorage route won't 500.
 */
export function requireValidFileContent(allowedMimes: string[]) {
  return function validateUploadedFilesContent(req: any, res: any, next: any) {
    try {
      const files = collectMulterFiles(req);
      for (const f of files) {
        if (!f?.buffer || !Buffer.isBuffer(f.buffer)) continue; // not memoryStorage
        const check = validateFileContent(f.buffer, allowedMimes, f.mimetype);
        if (!check.ok) {
          return res.status(400).json({
            error: 'Invalid file',
            code: 'FILE_CONTENT_REJECTED',
            field: f.fieldname,
            message: check.reason || 'File content failed validation',
          });
        }
      }
      return next();
    } catch (err: any) {
      return res.status(400).json({
        error: 'Invalid file',
        code: 'FILE_CONTENT_CHECK_FAILED',
        message: err?.message || 'Upload validation error',
      });
    }
  };
}

/** Read the first `n` bytes of a file synchronously (for diskStorage validation). */
function readFileHead(filePath: string, n = 32): Buffer {
  // Confine to the upload roots before opening — never read an arbitrary path.
  if (!isConfinedUploadPath(filePath)) throw new Error('Upload path outside allowed directory');
  const fd = fs.openSync(path.resolve(filePath), 'r');
  try {
    const buf = Buffer.alloc(n);
    const read = fs.readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Express middleware factory for multer **diskStorage** routes: the file is
 * already on disk (no buffer), so we read its head from `file.path`, validate,
 * and on failure DELETE the rejected file before responding (don't leave hostile
 * content sitting on disk).
 */
export function requireValidFileContentDisk(allowedMimes: string[]) {
  return function validateUploadedDiskFiles(req: any, res: any, next: any) {
    const files = collectMulterFiles(req) as Array<{ fieldname?: string; mimetype?: string; path?: string }>;
    const cleanupAll = () => {
      for (const f of files) {
        if (isConfinedUploadPath(f?.path)) { try { fs.unlinkSync(path.resolve(f.path!)); } catch { /* best effort */ } }
      }
    };
    try {
      for (const f of files) {
        if (!f?.path) continue;
        if (!isConfinedUploadPath(f.path)) {
          cleanupAll();
          return res.status(400).json({ error: 'Invalid file', code: 'FILE_PATH_REJECTED', field: f.fieldname });
        }
        const head = readFileHead(f.path);
        const check = validateFileContent(head, allowedMimes, f.mimetype);
        if (!check.ok) {
          cleanupAll(); // remove every file from this rejected request
          return res.status(400).json({
            error: 'Invalid file',
            code: 'FILE_CONTENT_REJECTED',
            field: f.fieldname,
            message: check.reason || 'File content failed validation',
          });
        }
      }
      return next();
    } catch (err: any) {
      cleanupAll();
      return res.status(400).json({
        error: 'Invalid file',
        code: 'FILE_CONTENT_CHECK_FAILED',
        message: err?.message || 'Upload validation error',
      });
    }
  };
}
