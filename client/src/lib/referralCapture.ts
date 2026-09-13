/**
 * Referral links — capture on landing, attach after sign-in (2026-09-13).
 *
 * The server builds `${base}/ref?code=XXX` (server/routes/referral.ts GET /link)
 * and ReferralPage shares it to WhatsApp, but there was NO /ref route (NotFound)
 * and nothing on the client ever called POST /api/referral/link-signup — so no
 * invite could ever attach. link-signup derives the invitee from the verified
 * Firebase token, so the client only carries the code.
 */
const KEY = 'pw_referral_code';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9_-]{4,32}$/.test(v) ? v : null;
}

export function storeReferralCode(raw: string | null | undefined, now = Date.now()): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: now })); } catch { /* storage blocked */ }
  return code;
}

export function readReferralCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || typeof at !== 'number' || now - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return normalizeReferralCode(code);
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
