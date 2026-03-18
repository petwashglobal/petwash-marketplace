import { apiRequest } from './queryClient';

export type QrPayload = {
  machineId: string;
  locationId: string;
  ts: number;
  nonce: string;
  sig: string;
};

export type ActivationResult = {
  success: boolean;
  sessionId?: string;
  activationToken?: string;
  nayaxSessionId?: string;
  machineId?: string;
  machineName?: string;
  priceCents?: number;
  currency?: string;
  startWindowSeconds?: number;
  message?: string;
  errorCode?: string;
};

export function parseQrString(raw: string): QrPayload {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error('QR code is not valid JSON');
  }
  if (
    typeof parsed.machineId !== 'string' ||
    typeof parsed.locationId !== 'string' ||
    typeof parsed.ts !== 'number' ||
    typeof parsed.nonce !== 'string' ||
    typeof parsed.sig !== 'string'
  ) {
    throw new Error('QR code format invalid — missing required fields');
  }
  return parsed as QrPayload;
}

export async function activateQrSession(qrPayload: QrPayload): Promise<ActivationResult> {
  const res = await apiRequest('/api/qr/activate', {
    method: 'POST',
    body: JSON.stringify(qrPayload),
    headers: {
      'Content-Type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Activation failed (${data?.errorCode})`);
  return data;
}

export async function startQrSession(params: {
  sessionId: string;
  activationToken: string;
}): Promise<{ success: boolean; startedAt?: string; estimatedSeconds?: number; message?: string }> {
  const res = await apiRequest('/api/qr/start', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Start failed (${data?.errorCode})`);
  return data;
}

export async function completeQrSession(params: { sessionId: string }): Promise<{
  success: boolean;
  completedAt?: string;
  chargedAmountCents?: number;
  currency?: string;
}> {
  const res = await apiRequest('/api/qr/complete', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Complete failed (${data?.errorCode})`);
  return data;
}

export async function pollQrSession(sessionId: string): Promise<{ success: boolean; session?: any }> {
  const res = await apiRequest(`/api/qr/session/${sessionId}`);
  return res.json();
}
