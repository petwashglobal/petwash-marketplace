import { getApiUrl } from "@/lib/apiConfig";
import { logger } from "@/lib/logger";

const ALLOWED_INTENTS = ['customer', 'loyalty', 'provider', 'staff_request'] as const;
type AllowedIntent = (typeof ALLOWED_INTENTS)[number];

export async function seedSignupIntentCookie(): Promise<void> {
  try {
    const raw = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('signup_intent')
      : null;
    if (!raw) return;
    if (!ALLOWED_INTENTS.includes(raw as AllowedIntent)) return;

    const res = await fetch(getApiUrl('/api/auth/seed-intent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ intent: raw }),
      keepalive: true,
    });
    if (!res.ok) {
      logger.warn('[seedIntent] Server rejected intent seed', { status: res.status });
    }
  } catch (err) {
    logger.warn('[seedIntent] Network error seeding intent (non-fatal)', { err: String(err) });
  }
}
