/**
 * The late return — a paid SUMIT checkout whose customer never came back.
 *
 * Every hosted-page purchase fulfils from our /return route: the customer's
 * browser is redirected there with OG-PaymentID, the route re-verifies the
 * payment with SUMIT, checks the amount, claims the PaymentID (one payment,
 * one order) and fulfils. A customer who pays and closes the tab never makes
 * that request, so the money sits at SUMIT and the order stays pending.
 *
 * SUMIT support confirmed in writing (2026-09-18): the ExternalIdentifier we
 * send with beginredirect is NOT returned by /billing/payments/get or /list,
 * and the Triggers-module webhook is not documented to carry it either. There
 * is no API that links a payment to our order. What SUMIT's own data does
 * carry is the document each hosted-page charge creates, whose Description we
 * stamp with `PW-REF <externalId>` (SumitClient.beginRedirect). The unclaimed
 * watch reads that stamp (refFromDocuments) — and this module makes the one
 * request the customer's browser would have made, against our own server.
 *
 * Nothing is fulfilled HERE. The return route does everything it does for a
 * live customer: SUMIT re-verify, amount comparison, the primary-keyed claim,
 * the idempotent flip. If any of those refuse, the route redirects to its
 * failure page and the watch keeps its alert. A replay can therefore never
 * fulfil an order the customer could not have fulfilled by returning late.
 */

export type LateReturnSurface = 'booking' | 'egift_guest' | 'wallet_purchase';

export type LateReturnTarget = { surface: LateReturnSurface; path: string };

/**
 * The return route for an order ref, exactly as beginRedirect registered it.
 * Refs are minted by the surfaces themselves:
 *   booking     `bkg_<requestId>_<t36>`   → GET /api/booking-requests/:requestId/sumit-return
 *   guest eGift `egiftguest_<uuid>`       → GET /api/egift/guest/return?ext=
 *   wallet/shop `pw-<uid>-<t36>` / `shop-<cartId>` / an order id → GET /api/payments/sumit/return?ext=
 * `savecard_…` is a ₪1 card-save, not an order; it is never replayed.
 */
export function lateReturnTargetFor(ref: string, paymentId: string): LateReturnTarget | null {
  const clean = String(ref ?? '').trim();
  const id = String(paymentId ?? '').trim();
  if (!clean || !id || /[\s/?#]/.test(clean)) return null;
  const q = (ext: string) => `?ext=${encodeURIComponent(ext)}&OG-PaymentID=${encodeURIComponent(id)}`;
  if (clean.startsWith('savecard_')) return null;
  if (clean.startsWith('bkg_')) {
    const body = clean.slice('bkg_'.length);
    const cut = body.lastIndexOf('_');
    const requestId = cut > 0 ? body.slice(0, cut) : '';
    if (!requestId) return null;
    return { surface: 'booking', path: `/api/booking-requests/${encodeURIComponent(requestId)}/sumit-return${q(clean)}` };
  }
  if (clean.startsWith('egiftguest_')) {
    return { surface: 'egift_guest', path: `/api/egift/guest/return${q(clean)}` };
  }
  return { surface: 'wallet_purchase', path: `/api/payments/sumit/return${q(clean)}` };
}

/**
 * What the route's redirect says happened. Each return route lands the customer
 * on a success page only after the order is fulfilled (booking: confirmed;
 * eGift: voucher issued; wallet: activated) — the querystring is the verdict.
 */
export function classifyLateReturnLocation(surface: LateReturnSurface, location: string | null): 'fulfilled' | 'refused' {
  const loc = String(location ?? '');
  if (!loc) return 'refused';
  switch (surface) {
    case 'booking':
      return /[?&]payment=success(?:&|$)/.test(loc) ? 'fulfilled' : 'refused';
    case 'egift_guest':
      return /[?&]status=success(?:&|$)/.test(loc) ? 'fulfilled' : 'refused';
    case 'wallet_purchase':
      return /\/payment-success(?:\?|$)/.test(loc) && !/[?&]fulfil=pending/.test(loc) ? 'fulfilled' : 'refused';
  }
}

export type LateReturnResult =
  | { outcome: 'fulfilled'; surface: LateReturnSurface; location: string }
  | { outcome: 'refused'; surface: LateReturnSurface; status: number; location: string | null }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'error'; surface: LateReturnSurface; reason: string };

/** Where this process answers its own routes. Cloud Run: the container's PORT on loopback. */
export function lateReturnBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = String(env.SUMIT_LATE_RETURN_BASE_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return `http://127.0.0.1:${Number(env.PORT || 8080)}`;
}

/**
 * Replay the customer's missing return for one payment. Follows no redirect:
 * the route's Location header is the answer, and the customer-facing page it
 * names is never fetched.
 */
export async function replayLateReturn(
  input: { paymentId: string; ref: string },
  deps: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {},
): Promise<LateReturnResult> {
  const target = lateReturnTargetFor(input.ref, input.paymentId);
  if (!target) return { outcome: 'unsupported', reason: 'ref_not_replayable' };
  const f = deps.fetchImpl ?? fetch;
  const url = `${deps.baseUrl ?? lateReturnBaseUrl()}${target.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 25_000);
  try {
    const res = await f(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        // Identifies the request in access logs; the route treats it like any customer.
        'user-agent': 'Mozilla/5.0 (compatible; PetWash-SumitLateReturn/1.0)',
        'x-petwash-late-return': input.paymentId,
      },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      const verdict = classifyLateReturnLocation(target.surface, location);
      return verdict === 'fulfilled'
        ? { outcome: 'fulfilled', surface: target.surface, location }
        : { outcome: 'refused', surface: target.surface, status: res.status, location };
    }
    return { outcome: 'refused', surface: target.surface, status: res.status, location };
  } catch (err: any) {
    return { outcome: 'error', surface: target.surface, reason: err?.name === 'AbortError' ? 'timeout' : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}
