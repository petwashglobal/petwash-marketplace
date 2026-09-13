
/**
 * Let a literal route win over an earlier `/:param` route that swallows it.
 *
 * Express matches routes in REGISTRATION order, and `/:id` matches literally
 * any single segment. So when a file registers
 *
 *     router.get('/:id', ...)          // line 131
 *     router.get('/low-stock', ...)    // line 817
 *
 * the second one is dead: `GET /low-stock` is served by the first handler with
 * `id === 'low-stock'`. The failure is silent and it does not look like a
 * routing bug from either end — the client gets a plausible `404 not found`, or
 * worse, whatever `parseInt('low-stock')` → `NaN` does inside a query. Ten of
 * these were found on 2026-09-13; several were customer- or admin-facing
 * features that had simply never returned data.
 *
 * Reordering the file is the textbook fix, but moving large handler bodies is
 * exactly the kind of edit that goes wrong quietly. This does the same thing in
 * one line at the shadowing route: `next('route')` abandons THIS route and
 * resumes matching, so the literal sibling registered later gets its turn.
 *
 *     router.get('/:id', reserveLiteralSegments('id', 'low-stock'), requireAdmin, ...)
 *
 * It must be the FIRST handler in the stack, so the shadowed route is skipped
 * before any auth, rate limit or database work runs.
 */
/*
 * Deliberately typed with `any` request/response rather than express's
 * RequestHandler: the routes this guard is inserted into declare their own
 * widened request types (FranchiseAuthRequest, the Firebase-auth Request, and
 * so on), and a concrete RequestHandler in front of those breaks express's
 * handler-overload resolution — which shows up as type errors in files that
 * were never edited. The body below touches only `req.params`.
 */
export function reserveLiteralSegments(
  paramName: string,
  ...literals: string[]
): (req: any, res: any, next: (err?: any) => void) => void {
  const reserved = new Set(literals.map((l) => l.toLowerCase()));
  return function skipReservedSegment(req: any, _res: any, next: (err?: any) => void) {
    const value = (req?.params as Record<string, string | undefined> | undefined)?.[paramName];
    if (typeof value === 'string' && reserved.has(value.toLowerCase())) {
      // Not an error: hand control back to the router so the literal route matches.
      return next('route');
    }
    return next();
  };
}
