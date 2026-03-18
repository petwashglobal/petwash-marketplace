import crypto from 'crypto';

// ── Dynamic QR payload (for generated/admin/test QR codes) ───────────────────
// Contains a short-lived signed payload with timestamp + nonce.
// Used by: admin tools, temporary screens, testing.
export type QrPayload = {
  machineId: string;
  locationId: string;
  ts: number;
  nonce: string;
  sig: string;
};

// ── Static sticker payload (for permanent printed stickers on machines) ───────
// Contains only machine identity — no signature, no timestamp, no nonce.
// Authorization is performed entirely server-side after Firebase auth.
// Recommended format encoded in sticker QR:
//   https://petwash.co.il/activate?m=<machineId>&l=<locationId>
// The app parses the URL and sends { machineId, locationId } to /api/qr/scan-sticker.
export type StaticStickerPayload = {
  machineId: string;
  locationId: string;
};

export function assertValidStaticStickerPayload(input: any): input is StaticStickerPayload {
  return (
    input &&
    typeof input.machineId === 'string' &&
    input.machineId.length > 0 &&
    input.machineId.length <= 64 &&
    typeof input.locationId === 'string' &&
    input.locationId.length > 0 &&
    input.locationId.length <= 64
  );
}

// ── Signing / verifying dynamic QR payloads ───────────────────────────────────

const QR_SECRET = process.env.QR_SECRET || 'petwash-qr-default-replace-in-prod';

export function signQrPayload(
  machineId: string,
  locationId: string,
  ts: number,
  nonce: string,
): string {
  const raw = `${machineId}:${locationId}:${ts}:${nonce}`;
  return crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
}

export function verifyQrSignature(payload: QrPayload): boolean {
  const expected = signQrPayload(
    payload.machineId,
    payload.locationId,
    payload.ts,
    payload.nonce,
  );
  const aBuf = Buffer.from(expected, 'utf8');
  const bBuf = Buffer.from(payload.sig, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function assertValidQrPayload(input: any): input is QrPayload {
  return (
    input &&
    typeof input.machineId === 'string' &&
    typeof input.locationId === 'string' &&
    typeof input.ts === 'number' &&
    typeof input.nonce === 'string' &&
    typeof input.sig === 'string'
  );
}

export function generateMachineQrPayload(
  machineId: string,
  locationId: string,
): QrPayload {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const sig = signQrPayload(machineId, locationId, ts, nonce);
  return { machineId, locationId, ts, nonce, sig };
}

// ── Static sticker URL helpers ────────────────────────────────────────────────

/** Generate the deep-link URL to encode in a permanent sticker QR code */
export function generateStaticStickerUrl(machineId: string, locationId: string): string {
  return `https://petwash.co.il/activate?m=${encodeURIComponent(machineId)}&l=${encodeURIComponent(locationId)}`;
}

/** Parse a sticker URL back to a payload (used in tests / admin tools) */
export function parseStaticStickerUrl(url: string): StaticStickerPayload | null {
  try {
    const u = new URL(url);
    const machineId = u.searchParams.get('m') || '';
    const locationId = u.searchParams.get('l') || '';
    if (!machineId || !locationId) return null;
    return { machineId, locationId };
  } catch {
    return null;
  }
}
