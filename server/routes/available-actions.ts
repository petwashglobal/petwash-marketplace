/**
 * GET /api/actions/:entity/:id — CEO Action Brain Doctrine §41.
 *
 * The client does NOT hard-code buttons. It calls this endpoint for
 * every entity screen and renders whatever the resolver returned. Every
 * returned AvailableAction carries risk + confirmationLevel stamped
 * from the canonical action catalog.
 *
 * Wiring:
 *   • Mount under an authed prefix in server/routes.ts:
 *       app.use('/api/actions', validateFirebaseToken, apiLimiter,
 *               availableActionsRoutes);
 *   • Entities supported first pass: booking, meet-greet, prestige,
 *     provider-application.
 *   • Additional entities land as their resolver functions ship.
 *
 * Contract:
 *   200 { actions: AvailableAction[] }
 *   400 { ok: false, error, reasonCode }
 *   404 { ok: false, error, reasonCode }
 *
 * State-lookup is a caller responsibility (the route uses a state
 * loader passed in for testability). This keeps the router pure so it
 * can be unit-tested without hitting the DB.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  bookingAvailableActions,
  meetGreetAvailableActions,
  prestigeAvailableActions,
  providerApplicationAvailableActions,
  type BookingActionContext,
  type MeetGreetActionContext,
  type PrestigeActionContext,
  type ProviderApplicationActionContext,
} from '../services/marketplace/AvailableActionsResolver';

/**
 * State loaders — provided at wire time by callers that own the DB
 * layer. Keeping the router pure of DB imports lets tests exercise the
 * routing + reason-code contract without a database.
 */
export interface AvailableActionsStateLoaders {
  loadBookingContext(
    bookingId: string,
    actorUid: string,
  ): Promise<BookingActionContext | null>;
  loadMeetGreetContext(
    meetId: string,
    actorUid: string,
  ): Promise<MeetGreetActionContext | null>;
  loadPrestigeContext(actorUid: string): Promise<PrestigeActionContext | null>;
  loadProviderApplicationContext(
    applicationId: string,
    actorUid: string,
  ): Promise<ProviderApplicationActionContext | null>;
}

/**
 * Build the router. Accepts an injected state loader so different
 * callers (production DB vs unit-test fake) can swap implementations
 * without touching the routing code.
 */
export function buildAvailableActionsRouter(
  loaders: AvailableActionsStateLoaders,
): Router {
  const router = Router();

  router.get('/booking/:id/actions', async (req, res, next) => {
    try {
      const actorUid = (req as any).firebaseUser?.uid;
      if (!actorUid) return unauthorized(res);
      const ctx = await loaders.loadBookingContext(req.params.id, actorUid);
      if (!ctx) return notFound(res, 'booking');
      return res.json({ actions: bookingAvailableActions(ctx) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/meet-greet/:id/actions', async (req, res, next) => {
    try {
      const actorUid = (req as any).firebaseUser?.uid;
      if (!actorUid) return unauthorized(res);
      const ctx = await loaders.loadMeetGreetContext(req.params.id, actorUid);
      if (!ctx) return notFound(res, 'meet-greet');
      return res.json({ actions: meetGreetAvailableActions(ctx) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/prestige/actions', async (req, res, next) => {
    try {
      const actorUid = (req as any).firebaseUser?.uid;
      if (!actorUid) return unauthorized(res);
      const ctx = await loaders.loadPrestigeContext(actorUid);
      if (!ctx) return notFound(res, 'prestige-profile');
      return res.json({ actions: prestigeAvailableActions(ctx) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/provider-application/:id/actions', async (req, res, next) => {
    try {
      const actorUid = (req as any).firebaseUser?.uid;
      if (!actorUid) return unauthorized(res);
      const ctx = await loaders.loadProviderApplicationContext(
        req.params.id,
        actorUid,
      );
      if (!ctx) return notFound(res, 'provider-application');
      return res.json({ actions: providerApplicationAvailableActions(ctx) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function unauthorized(res: Response): void {
  res.status(401).json({ ok: false, error: 'Auth required', reasonCode: 'REAUTH_REQUIRED' });
}

function notFound(res: Response, entity: string): void {
  res.status(404).json({ ok: false, error: `${entity} not found or not accessible`, reasonCode: 'INSUFFICIENT_PERMISSIONS' });
}

// Convenience — some call sites just want a next-handler middleware.
export type _Next = NextFunction;
export type _Req = Request;
