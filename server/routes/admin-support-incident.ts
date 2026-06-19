/**
 * admin-support-incident.ts — Support AI Script Builder (§15) + Incident Mode (§18).
 *
 * READ-ONLY / RECORD-ONLY. This router NEVER mutates money, payout, refund,
 * escrow, balance, or any finance state. It does not write to any table. It
 * surfaces:
 *
 *   §15  GET /api/admin/support-scripts
 *        A STATIC, deterministic decision-tree of ready support answers by
 *        issue type. No AI call, no DB read — pure structured content the
 *        support UI renders. (Bilingual he/en.)
 *
 *   §18  GET /api/admin/incidents
 *        A READ-ONLY list of incidents from the EXISTING `incidents` table
 *        (open/critical first), each enriched with its timeline entries
 *        (incident_timeline_entries) and its latest root-cause analysis
 *        (incident_rca). Timeline metadata is scanned for any referenced
 *        bookingId / faultId so the UI can show a linked booking / bay-fault —
 *        but the link is purely informational.
 *
 *   §18  Incident Mode (advisory hold flag).
 *        We expose a READ-ONLY computed flag `advisoryHold` on incidents that
 *        reference a booking or provider. This is a SIGNAL ONLY. It is NOT
 *        wired into any payout / refund / release logic. Enforcement (actually
 *        pausing a payout when an incident is open) is a FUTURE, SEPARATELY
 *        APPROVED step and is intentionally NOT done here.
 *
 * Auth: every route carries an inline `requireAdmin` gate (defence in depth on
 * top of the mount-chain auth in routes.ts).
 */
import { Router, type Request, type Response } from 'express';
import { inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import { incidents, incidentTimelineEntries, incidentRca } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

// Caps so a runaway table never returns an unbounded payload.
const MAX_INCIDENTS = 200;
const MAX_TIMELINE_PER_INCIDENT = 50;

// Per-query try/catch helper: one failing aggregate must never 500 the report.
async function safe<T>(label: string, errors: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(label);
    logger.error(`[support-incident] query failed: ${label}`, err);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §15 — SUPPORT AI SCRIPT BUILDER (static, deterministic decision-tree)
//
// This is intentionally hard-coded structured content, NOT an AI call and NOT a
// DB read. The support UI renders it as "pick an issue → see diagnostic steps +
// recommended action". Recommended actions are ADVISORY guidance for a human
// agent — none of them are executed by this endpoint.
// ─────────────────────────────────────────────────────────────────────────────
interface ScriptStep {
  en: string;
  he: string;
}
interface SupportScript {
  id: string;
  issue: { en: string; he: string };
  /** Ordered diagnostic questions/checks the agent walks through. */
  diagnosticSteps: ScriptStep[];
  /** The recommended action for the agent (advisory — agent decides + acts manually). */
  recommendedAction: { en: string; he: string };
  /** Whether resolving this issue may touch money (so the agent escalates rather than self-serves). */
  touchesMoney: boolean;
}

const SUPPORT_SCRIPTS: SupportScript[] = [
  {
    id: 'machine_did_not_start',
    issue: { en: "Machine didn't start", he: 'המכונה לא הופעלה' },
    diagnosticSteps: [
      { en: 'Confirm the station and bay (left/right) the customer used.', he: 'ודא את העמדה והתא (שמאל/ימין) שבהם השתמש הלקוח.' },
      { en: 'Check the bay status in Operations — is there an open fault on that bay?', he: 'בדוק את סטטוס התא במסך התפעול — האם יש תקלה פתוחה באותו תא?' },
      { en: 'Ask whether payment was taken (card charged / QR scanned).', he: 'שאל האם בוצע חיוב (כרטיס חויב / QR נסרק).' },
      { en: 'Check the station heartbeat — is the station online?', he: 'בדוק את פעימת הלב של העמדה — האם העמדה מקוונת?' },
    ],
    recommendedAction: {
      en: 'If a bay fault is open: direct the customer to the other bay and flag the fault for maintenance. If payment was taken but no wash started, escalate to the money path below — do NOT promise a refund yourself.',
      he: 'אם יש תקלה פתוחה בתא: הפנה את הלקוח לתא השני וסמן את התקלה לתחזוקה. אם בוצע חיוב אך השטיפה לא התחילה, הסלם לנתיב הכספי — אל תבטיח החזר בעצמך.',
    },
    touchesMoney: false,
  },
  {
    id: 'gift_not_received',
    issue: { en: 'Gift / e-gift not received', he: 'מתנה / גיפט לא התקבל' },
    diagnosticSteps: [
      { en: 'Confirm the recipient email/phone the buyer entered.', he: 'ודא את האימייל/הטלפון של הנמען שהזין הרוכש.' },
      { en: 'Ask the recipient to check spam / promotions folder.', he: 'בקש מהנמען לבדוק בתיקיית הספאם / הקידומים.' },
      { en: 'Verify the gift was paid for (purchase completed, not abandoned).', he: 'ודא שהמתנה שולמה (הרכישה הושלמה ולא ננטשה).' },
      { en: 'Confirm whether the recipient already signed in (recipient binding can defer delivery to first sign-in).', he: 'ודא האם הנמען כבר התחבר (קישור הנמען עשוי לדחות את המסירה להתחברות הראשונה).' },
    ],
    recommendedAction: {
      en: 'If paid and the address is correct, re-send the gift notification from the gift tooling. Do NOT issue a new gift balance or re-charge — escalate value/balance questions.',
      he: 'אם שולם והכתובת נכונה, שלח מחדש את הודעת המתנה מכלי הגיפט. אל תנפיק יתרת מתנה חדשה ואל תחייב מחדש — הסלם שאלות של ערך/יתרה.',
    },
    touchesMoney: true,
  },
  {
    id: 'qr_not_working',
    issue: { en: 'QR not working', he: 'ה-QR לא עובד' },
    diagnosticSteps: [
      { en: 'Ask the customer to increase screen brightness and clean the scanner lens area.', he: 'בקש מהלקוח להגביר את בהירות המסך ולנקות את אזור עדשת הסורק.' },
      { en: 'Confirm the QR is for the correct station/bay and is not expired/already redeemed.', he: 'ודא שה-QR שייך לעמדה/תא הנכונים ושאינו פג/מומש כבר.' },
      { en: 'Check the bay QR reader status in Operations for an open reader fault.', he: 'בדוק את סטטוס קורא ה-QR של התא במסך התפעול לאיתור תקלת קורא פתוחה.' },
      { en: 'Offer the alternate bay if its reader is healthy.', he: 'הצע את התא החלופי אם הקורא בו תקין.' },
    ],
    recommendedAction: {
      en: 'If the reader has an open fault, flag for maintenance and route the customer to a working bay. If the code itself is invalid/expired, explain why — do NOT manually mint a new code.',
      he: 'אם לקורא יש תקלה פתוחה, סמן לתחזוקה והפנה את הלקוח לתא תקין. אם הקוד עצמו אינו תקף/פג, הסבר מדוע — אל תייצר קוד חדש ידנית.',
    },
    touchesMoney: false,
  },
  {
    id: 'refund_request',
    issue: { en: 'Refund request', he: 'בקשת החזר כספי' },
    diagnosticSteps: [
      { en: 'Identify the booking / transaction and confirm what was charged.', he: 'אתר את ההזמנה / העסקה וודא מה חויב.' },
      { en: 'Confirm what actually happened (no wash, partial wash, double charge, duplicate booking).', he: 'ודא מה קרה בפועל (אין שטיפה, שטיפה חלקית, חיוב כפול, הזמנה כפולה).' },
      { en: 'Check whether an incident is already open for this booking / station.', he: 'בדוק האם כבר קיים אירוע פתוח להזמנה / לעמדה הזו.' },
      { en: 'Apply the published cancellation/refund policy tier — do not improvise the amount.', he: 'החל את מדרגת מדיניות הביטול/ההחזר המפורסמת — אל תאלתר את הסכום.' },
    ],
    recommendedAction: {
      en: 'Refunds are a money action: they must be performed through the authorised admin wallet/refund path, which writes an audit log. This support tool does NOT issue refunds. Record the case, then hand off to the refund path.',
      he: 'החזר הוא פעולה כספית: יש לבצעה דרך נתיב הארנק/ההחזר המורשה לניהול, שמתעד יומן ביקורת. כלי תמיכה זה אינו מבצע החזרים. תעד את המקרה והעבר לנתיב ההחזר.',
    },
    touchesMoney: true,
  },
  {
    id: 'payment_taken_no_wash',
    issue: { en: 'Payment taken, no wash', he: 'בוצע חיוב, ללא שטיפה' },
    diagnosticSteps: [
      { en: 'Confirm the charge (amount, time, station/bay, payment method).', he: 'ודא את החיוב (סכום, זמן, עמדה/תא, אמצעי תשלום).' },
      { en: 'Check for an open bay fault or station-offline event at that time.', he: 'בדוק תקלת תא פתוחה או אירוע ניתוק עמדה באותו זמן.' },
      { en: 'Check whether the session started at all (Operations session log).', he: 'בדוק האם הסשן בכלל התחיל (יומן הסשנים בתפעול).' },
      { en: 'Open or link an incident so the case is tracked end-to-end.', he: 'פתח או קשר אירוע כדי שהמקרה יתועד מקצה לקצה.' },
    ],
    recommendedAction: {
      en: 'This is the classic "charged but no service" case. Record the incident here for visibility, then escalate to the authorised refund/compensation path — that path (not this tool) performs and audits any money movement.',
      he: 'זהו המקרה הקלאסי של "חויב אך לא קיבל שירות". תעד כאן את האירוע לצורך נראות, ולאחר מכן הסלם לנתיב ההחזר/הפיצוי המורשה — אותו נתיב (ולא כלי זה) מבצע ומתעד כל תנועת כסף.',
    },
    touchesMoney: true,
  },
];

router.get('/support-scripts', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    wired: true,
    static: true,
    generatedAt: new Date().toISOString(),
    note: 'Static deterministic decision-tree (no AI, no DB). Recommended actions are advisory guidance for a human agent. This endpoint performs no mutation and no money action.',
    scripts: SUPPORT_SCRIPTS,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §18 — INCIDENT MODE (read-only list + advisory hold flag)
//
// Reads the EXISTING incidents / incident_timeline_entries / incident_rca
// tables. Open/critical first. Timeline metadata is scanned for any referenced
// bookingId/faultId to surface a (purely informational) linked booking/fault.
//
// Advisory hold flag: computed, read-only. NOT wired into payout logic.
// ─────────────────────────────────────────────────────────────────────────────
const OPEN_STATUSES = ['open', 'investigating', 'active', 'acknowledged'];

function severityRank(sev: string): number {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return 0;
    case 'high':     return 1;
    case 'medium':   return 2;
    case 'low':      return 3;
    default:         return 4;
  }
}
function statusRank(status: string): number {
  // Open-ish incidents float to the top.
  return OPEN_STATUSES.includes((status || '').toLowerCase()) ? 0 : 1;
}

/**
 * Scan a timeline metadata blob (and content) for any referenced booking or
 * fault id. Purely informational — used to render a "linked booking / fault"
 * chip. Never used to drive money logic.
 */
function extractLinks(metadata: unknown, content: string | null): { bookingId?: string; faultId?: string; providerId?: string } {
  const out: { bookingId?: string; faultId?: string; providerId?: string } = {};
  const meta = (metadata && typeof metadata === 'object') ? metadata as Record<string, unknown> : {};
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = meta[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return undefined;
  };
  out.bookingId = pick('bookingId', 'booking_id', 'bookingNumber', 'booking_number');
  out.faultId = pick('faultId', 'fault_id');
  out.providerId = pick('providerId', 'provider_id');
  // Best-effort scan of free-text content for an explicit "booking #..." mention.
  if (!out.bookingId && content) {
    const m = content.match(/booking[#\s:]+([A-Za-z0-9-]{4,})/i);
    if (m) out.bookingId = m[1];
  }
  return out;
}

router.get('/incidents', requireAdmin, async (req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  const statusFilter = String(req.query.status || 'all'); // 'all' | 'open' | a specific status
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), MAX_INCIDENTS);

  // 1) Incidents (most-recent first; resorted below by open/critical priority).
  const rows = await safe('incidents', errors, () => {
    return db
      .select()
      .from(incidents)
      .orderBy(sql`${incidents.startedAt} desc`)
      .limit(limit);
  }, [] as Array<typeof incidents.$inferSelect>);

  const filtered = rows.filter((r) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return OPEN_STATUSES.includes((r.status || '').toLowerCase());
    return (r.status || '').toLowerCase() === statusFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    return res.json({
      wired: true,
      generatedAt,
      statusFilter,
      incidentCount: 0,
      incidents: [],
      errors,
      advisoryHoldNote:
        'advisoryHold is a READ-ONLY signal only. It is NOT wired into any payout/refund/release logic. Enforcement is a future, separately-approved step.',
      note: 'No incidents match the filter. Data is read live from the incidents table — nothing was written.',
    });
  }

  const incidentIds = filtered.map((r) => r.id);

  // 2) Timeline entries for these incidents (read-only).
  const timeline = await safe('timeline', errors, () => {
    return db
      .select()
      .from(incidentTimelineEntries)
      .where(inArray(incidentTimelineEntries.incidentId, incidentIds))
      .orderBy(sql`${incidentTimelineEntries.occurredAt} desc`);
  }, [] as Array<typeof incidentTimelineEntries.$inferSelect>);

  // 3) Latest RCA per incident (read-only).
  const rca = await safe('rca', errors, () => {
    return db
      .select()
      .from(incidentRca)
      .where(inArray(incidentRca.incidentId, incidentIds))
      .orderBy(sql`${incidentRca.generatedAt} desc`);
  }, [] as Array<typeof incidentRca.$inferSelect>);

  // Group timeline + rca by incident.
  const timelineByIncident = new Map<number, Array<typeof incidentTimelineEntries.$inferSelect>>();
  for (const t of timeline) {
    const arr = timelineByIncident.get(t.incidentId) ?? [];
    if (arr.length < MAX_TIMELINE_PER_INCIDENT) arr.push(t);
    timelineByIncident.set(t.incidentId, arr);
  }
  const rcaByIncident = new Map<number, typeof incidentRca.$inferSelect>();
  for (const r of rca) {
    if (!rcaByIncident.has(r.incidentId)) rcaByIncident.set(r.incidentId, r); // first = latest (ordered desc)
  }

  // Assemble.
  const out = filtered.map((inc) => {
    const tl = timelineByIncident.get(inc.id) ?? [];

    // Derive (informational) linked booking / fault / provider from timeline.
    let linkedBookingId: string | undefined;
    let linkedFaultId: string | undefined;
    let linkedProviderId: string | undefined;
    for (const t of tl) {
      const links = extractLinks(t.metadataJson, t.content);
      linkedBookingId = linkedBookingId ?? links.bookingId;
      linkedFaultId = linkedFaultId ?? links.faultId;
      linkedProviderId = linkedProviderId ?? links.providerId;
    }

    const isOpen = OPEN_STATUSES.includes((inc.status || '').toLowerCase());

    // ADVISORY hold flag — read-only signal. NOT enforced anywhere.
    const advisoryHold =
      isOpen && (!!linkedBookingId || !!linkedProviderId)
        ? {
            active: true,
            scope: linkedBookingId ? 'booking' : 'provider',
            bookingId: linkedBookingId ?? null,
            providerId: linkedProviderId ?? null,
            reason: 'Open incident references this booking/provider.',
            enforced: false,
            note: 'Advisory only. No payout/refund is held by this flag. Enforcement is a future, separately-approved step.',
          }
        : { active: false, enforced: false };

    const r = rcaByIncident.get(inc.id);

    return {
      id: inc.id,
      title: inc.title,
      severity: inc.severity,
      status: inc.status,
      isOpen,
      anomalyEventId: inc.anomalyEventId,
      startedAt: inc.startedAt,
      resolvedAt: inc.resolvedAt,
      createdBy: inc.createdBy,
      summary: inc.summary,
      linked: {
        bookingId: linkedBookingId ?? null,
        faultId: linkedFaultId ?? null,
        providerId: linkedProviderId ?? null,
      },
      advisoryHold,
      timeline: tl.map((t) => ({
        id: t.id,
        eventType: t.eventType,
        content: t.content,
        actor: t.actor,
        occurredAt: t.occurredAt,
      })),
      rca: r
        ? {
            generatedAt: r.generatedAt,
            conclusion: r.conclusion,
            recommendedAction: r.recommendedAction,
            confidenceOverall: r.confidenceOverall,
            generatedBy: r.generatedBy,
          }
        : null,
    };
  });

  // Sort: open first, then by severity, then most-recent.
  out.sort((a, b) => {
    const s = statusRank(a.status) - statusRank(b.status);
    if (s !== 0) return s;
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return new Date(b.startedAt as unknown as string).getTime() - new Date(a.startedAt as unknown as string).getTime();
  });

  res.json({
    wired: true,
    generatedAt,
    statusFilter,
    incidentCount: out.length,
    openCount: out.filter((i) => i.isOpen).length,
    criticalCount: out.filter((i) => (i.severity || '').toLowerCase() === 'critical').length,
    advisoryHoldCount: out.filter((i) => i.advisoryHold.active).length,
    incidents: out,
    errors,
    advisoryHoldNote:
      'advisoryHold is a READ-ONLY signal only. It is NOT wired into any payout/refund/release logic. Enforcement is a future, separately-approved step.',
    note: 'Data is read live from incidents / incident_timeline_entries / incident_rca. This endpoint performs no mutation and no money action.',
  });
});

export default router;
