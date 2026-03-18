import crypto from 'crypto';

export type QrPayload = {
  machineId: string;
  locationId: string;
  ts: number;
  nonce: string;
  sig: string;
};

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

export function generateMachineQrPayload(
  machineId: string,
  locationId: string,
): QrPayload {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const sig = signQrPayload(machineId, locationId, ts, nonce);
  return { machineId, locationId, ts, nonce, sig };
}
