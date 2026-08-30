/**
 * /api/marketplace/inbox — CEO NEXT-AUTO §21 + Doctrine §22, §23, §37.
 *
 * The unified Inbox endpoint the doctrine calls for. Serves the
 * `InboxItem[]` projection for the signed-in user through the shared
 * CommunicationHubService (§14–§16 adapters wired together in §21's
 * createProductionHubSource).
 *
 * Contract:
 *   GET /api/marketplace/inbox?workspace=PET_PARENT|PROVIDER
 *       &category=ALL|MESSAGES|BOOKINGS|ORDERS|...     (optional)
 *       &limit=1..100                                   (optional; default 50)
 *
 *   200 → { items: InboxItem[], unread: InboxUnreadCounts }
 *   400 → invalid workspace
 *   401 → missing / invalid Firebase token (handled upstream)
 *
 * Discipline (§29, §37):
 *   • UID is derived from the Firebase token server-side — never the
 *     request body. Client cannot ask for another actor's Inbox.
 *   • Workspace is scoped ONLY to PET_PARENT / PROVIDER. A multi-role
 *     UID gets DISTINCT counters — reading the provider inbox never
 *     marks the customer inbox read.
 *   • Response never contains detection rules, raw email/phone, or
 *     the underlying source of any item — the projection has already
 *     masked what needs masking.
 */
import { Router, type Request, type Response } from 'express';
import {
  listForUser,
  createProductionHubSource,
} from '../services/marketplace/CommunicationHubService';
import { loadUnreadTotals } from '../services/marketplace/UnreadCountsService';
import { getUserCapabilities } from '../lib/userCapabilities';
import type {
  InboxCategory,
  InboxWorkspace,
} from '@shared/marketplace/inboxItem';
import { logger } from '../lib/logger';

const router = Router();

const VALID_WORKSPACES: readonly InboxWorkspace[] = ['PET_PARENT', 'PROVIDER'];
const VALID_CATEGORIES: readonly InboxCategory[] = [
  'ALL',
  'MESSAGES',
  'BOOKINGS',
  'ORDERS',
  'PAYMENTS_AND_DOCUMENTS',
  'SUPPORT',
  'REQUESTS',
  'ACTIVE_JOBS',
  'EARNINGS',
  'COMPLIANCE',
];

// One shared production source — instantiated lazily so its adapters
// don't load at boot for environments that never touch the Inbox.
let cachedSource: ReturnType<typeof createProductionHubSource> | null = null;
function getSource() {
  if (!cachedSource) cachedSource = createProductionHubSource();
  return cachedSource;
}

router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });

    const workspaceRaw = String(req.query.workspace ?? 'PET_PARENT').toUpperCase();
    if (!VALID_WORKSPACES.includes(workspaceRaw as InboxWorkspace)) {
      return res.status(400).json({ error: 'invalid_workspace' });
    }
    const workspace = workspaceRaw as InboxWorkspace;

    // CEO DEEP-LOGIC §21 — capability-aware workspace refusal. A
    // customer-only account that requests workspace=PROVIDER must NOT
    // silently receive an empty inbox and think it "worked but there
    // are no jobs" — it doesn't have the workspace at all. Same for
    // PET_PARENT: everyone has it by default. Provider requires
    // provider.active (or provider.applicant during onboarding).
    if (workspace === 'PROVIDER') {
      const caps = await getUserCapabilities(uid);
      if (!caps.provider.active && !caps.provider.applicant) {
        return res.status(403).json({
          error: 'workspace_unavailable',
          reasonCode: 'WORKSPACE_CAPABILITY_MISSING',
          workspace,
        });
      }
    }

    const categoryRaw = req.query.category ? String(req.query.category).toUpperCase() : 'ALL';
    const category = (VALID_CATEGORIES.includes(categoryRaw as InboxCategory)
      ? (categoryRaw as InboxCategory)
      : 'ALL');

    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50;

    // CEO DEEP-LOGIC §7 — accept a locale so Attention items render in
    // Hebrew or English. Default to Hebrew — the doctrine's default UI
    // language — and never trust an unknown value.
    const localeRaw = String(req.query.locale ?? 'he').toLowerCase();
    const locale = (localeRaw === 'en' ? 'en' : 'he') as 'he' | 'en';

    const [result, totals] = await Promise.all([
      listForUser(uid, getSource(), { workspace, category, limit, locale }),
      loadUnreadTotals(uid),
    ]);
    // CEO DEEP-LOGIC §19 — global unread is REAL now: per-workspace
    // SUMs computed independently over booking_conversations +
    // chat_threads so a workspace=PET_PARENT call returns an honest
    // provider count instead of 0.
    const currentWorkspace = workspace === 'PET_PARENT' ? totals.petParent : totals.provider;
    const enriched = {
      ...result,
      unread: {
        currentWorkspace,
        petParent: totals.petParent,
        provider: totals.provider,
        global: totals.global,
      },
      unreadDegraded: totals.degraded,
    };
    // CEO DEEP-LOGIC §36 — emit an OBSERVABILITY metric line for any
    // degraded lane so a source falling over does not silently rot for
    // weeks. Payload carries no message content — just the lane names.
    if (result.partial) {
      const degradedLanes = (['bookingChat', 'threadChat', 'attention'] as const)
        .filter((k) => result.sourceHealth[k] === 'degraded');
      logger.warn('[MarketplaceInbox] INBOX_SOURCE_DEGRADED', {
        metric: 'INBOX_SOURCE_DEGRADED',
        workspace,
        degradedLanes,
        uidTail: uid.slice(-6),
      });
    }
    return res.json(enriched);
  } catch (err: any) {
    logger.error('[MarketplaceInbox] Unhandled error', { error: err?.message });
    // Fail-CLOSED: never leak internals; the projection is a
    // best-effort read model, so a blanket 500 with a stable code is
    // enough for the client to retry with a shorter window.
    return res.status(500).json({ error: 'inbox_unavailable' });
  }
});

export default router;
