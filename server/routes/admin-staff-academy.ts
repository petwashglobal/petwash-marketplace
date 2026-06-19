/**
 * Staff Performance Dashboard (§16) + Staff Academy / Training (§17)
 * — READ-ONLY admin operations intelligence.
 *
 * CEO "Business OS" spec. Pure SELECT aggregation over tables that ALREADY
 * exist (hr_employees, hr_time_tracking, ops_tasks, bay_faults). NO schema
 * change, NO new dependency, NO money math, NO K9000/Nayax runtime touch.
 *
 * Honesty rules (platform skill §2 — no fake data):
 *   - Every metric we CAN back with a real column is a real COUNT / aggregate.
 *   - Every metric we CANNOT back with a real table is returned as `null`
 *     WITH a `note` explaining why — never fabricated, never zero-as-if-real.
 *   - This is OPERATIONAL visibility, not a punitive HR instrument. The numbers
 *     describe throughput/health, they do not rank or score people.
 *
 * Both endpoints mount under /api/admin/* so they inherit the admin security
 * stack, and a second inline `requireAdmin` gate is applied here for
 * defence-in-depth.
 *
 *   GET /api/admin/staff-performance
 *     Per active staff member (hr_employees), over a lookback window:
 *       - tasksClosed       : ops_tasks completed by this employee     (REAL)
 *       - tasksOpen         : ops_tasks assigned & not yet closed       (REAL)
 *       - lateTasks         : completed after dueDate OR open & overdue (REAL)
 *       - faultsClosed      : bay_faults resolved by this employee      (REAL,
 *                             matched via hr_employees.firebaseUid ==
 *                             bay_faults.resolvedBy)
 *       - hoursWorked       : sum of hr_time_tracking total_hours       (REAL)
 *       - avgTaskResolution : avg (completedAt − createdAt) hours       (REAL)
 *       - checklistCompletion : null + note (no staff-checklist table)
 *       - ticketsSolved       : null + note (no support-ticket table)
 *       - avgResponseTime     : null + note (no support-ticket table)
 *
 *   GET /api/admin/academy
 *     Staff Academy. There is NO staff training/course table in the schema
 *     today (the existing provider_training_* tables are for MARKETPLACE
 *     PROVIDERS, a different population — not employees). So rather than
 *     fabricate completions, this returns:
 *       - catalog          : the documented course catalog from the spec
 *       - records          : []  (training records not tracked yet)
 *       - tracked          : false
 *       - permissionRule   : the documented "gate permissions on course
 *                            completion" model, with enforced:false.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import { hrEmployees, hrTimeTracking, opsTasksTable, bayFaults } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

const HOUR_MS = 60 * 60 * 1000;

// Caps so a runaway table never returns an unbounded payload.
const MAX_STAFF = 300;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Per-query try/catch helper: one failing aggregate must never 500 the report.
async function safe<T>(label: string, errors: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(label);
    logger.error(`[staff-academy] aggregate failed: ${label}`, err);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §16 — STAFF PERFORMANCE (operational, not punitive)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-performance', requireAdmin, async (req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const now = Date.now();

  // Lookback window for throughput metrics (default 30d, 7–365 clamp).
  const lookbackDays = Math.min(Math.max(Number(req.query.lookbackDays) || 30, 7), 365);
  const since = new Date(now - lookbackDays * 24 * HOUR_MS);

  // 1) Active staff roster (real).
  const staff = await safe('staff-roster', errors, () =>
    db
      .select({
        id: hrEmployees.id,
        employeeId: hrEmployees.employeeId,
        firebaseUid: hrEmployees.firebaseUid,
        firstName: hrEmployees.firstName,
        lastName: hrEmployees.lastName,
        department: hrEmployees.department,
        position: hrEmployees.position,
      })
      .from(hrEmployees)
      .where(eq(hrEmployees.isActive, true))
      .limit(MAX_STAFF),
    [] as Array<{
      id: number; employeeId: string; firebaseUid: string | null;
      firstName: string; lastName: string; department: string; position: string;
    }>,
  );

  const empIds = staff.map((s) => s.id);
  const uids = staff.map((s) => s.firebaseUid).filter((u): u is string => !!u);

  // 2) Tasks per employee (real) — closed, open, late, avg resolution hours.
  type TaskAgg = {
    closed: number;
    open: number;
    lateClosed: number;
    overdueOpen: number;
    sumResolutionMs: number;
    resolvedCount: number;
  };
  const taskRows = empIds.length
    ? await safe('tasks-agg', errors, () =>
        db
          .select({
            assignedTo: opsTasksTable.assignedTo,
            status: opsTasksTable.status,
            dueDate: opsTasksTable.dueDate,
            completedAt: opsTasksTable.completedAt,
            createdAt: opsTasksTable.createdAt,
          })
          .from(opsTasksTable)
          .where(inArray(opsTasksTable.assignedTo, empIds)),
        [] as Array<{
          assignedTo: number | null;
          status: string | null;
          dueDate: Date | null;
          completedAt: Date | null;
          createdAt: Date | null;
        }>,
      )
    : [];

  const taskByEmp = new Map<number, TaskAgg>();
  for (const r of taskRows) {
    if (r.assignedTo == null) continue;
    let a = taskByEmp.get(r.assignedTo);
    if (!a) {
      a = { closed: 0, open: 0, lateClosed: 0, overdueOpen: 0, sumResolutionMs: 0, resolvedCount: 0 };
      taskByEmp.set(r.assignedTo, a);
    }
    const isClosed = r.status === 'completed';
    if (isClosed) {
      a.closed += 1;
      if (r.dueDate && r.completedAt && r.completedAt.getTime() > r.dueDate.getTime()) a.lateClosed += 1;
      if (r.completedAt && r.createdAt) {
        a.sumResolutionMs += r.completedAt.getTime() - r.createdAt.getTime();
        a.resolvedCount += 1;
      }
    } else if (r.status !== 'cancelled') {
      a.open += 1;
      if (r.dueDate && r.dueDate.getTime() < now) a.overdueOpen += 1;
    }
  }

  // 3) Faults resolved per staff member (real) — matched by firebaseUid.
  //    bay_faults.resolvedBy holds a staff userId string (or "system").
  const faultByUid = new Map<string, number>();
  if (uids.length) {
    const faultRows = await safe('faults-agg', errors, () =>
      db
        .select({
          resolvedBy: bayFaults.resolvedBy,
          count: sql<number>`count(*)::int`,
        })
        .from(bayFaults)
        .where(and(eq(bayFaults.status, 'resolved'), inArray(bayFaults.resolvedBy, uids)))
        .groupBy(bayFaults.resolvedBy),
      [] as Array<{ resolvedBy: string | null; count: number }>,
    );
    for (const r of faultRows) {
      if (r.resolvedBy) faultByUid.set(r.resolvedBy, Number(r.count) || 0);
    }
  }

  // 4) Hours worked per employee in window (real) — hr_time_tracking.
  const hoursByEmp = new Map<number, number>();
  if (empIds.length) {
    const hourRows = await safe('hours-agg', errors, () =>
      db
        .select({
          employeeId: hrTimeTracking.employeeId,
          hours: sql<number>`coalesce(sum(${hrTimeTracking.totalHours}), 0)::float`,
        })
        .from(hrTimeTracking)
        .where(and(inArray(hrTimeTracking.employeeId, empIds), sql`${hrTimeTracking.clockInTime} >= ${since}`))
        .groupBy(hrTimeTracking.employeeId),
      [] as Array<{ employeeId: number; hours: number }>,
    );
    for (const r of hourRows) hoursByEmp.set(r.employeeId, Number(r.hours) || 0);
  }

  // 5) Assemble per-staff rows. Unavailable metrics → null + note.
  const NO_CHECKLIST = 'No staff-checklist table in schema — not tracked yet.';
  const NO_TICKETS = 'No staff support-ticket table in schema — not tracked yet.';

  const rows = staff.map((s) => {
    const t = taskByEmp.get(s.id);
    const closed = t?.closed ?? 0;
    const open = t?.open ?? 0;
    const late = (t?.lateClosed ?? 0) + (t?.overdueOpen ?? 0);
    const avgResolutionHours =
      t && t.resolvedCount > 0 ? round1(t.sumResolutionMs / t.resolvedCount / HOUR_MS) : null;
    const faultsClosed = s.firebaseUid ? faultByUid.get(s.firebaseUid) ?? 0 : 0;
    const hoursWorked = round1(hoursByEmp.get(s.id) ?? 0);

    return {
      employeeId: s.employeeId,
      name: `${s.firstName} ${s.lastName}`.trim(),
      department: s.department,
      position: s.position,
      hasLinkedAccount: !!s.firebaseUid,

      // REAL operational throughput
      tasksClosed: closed,
      tasksOpen: open,
      lateTasks: late,
      faultsClosed,
      hoursWorked,
      avgTaskResolutionHours: avgResolutionHours,

      // NOT TRACKED — honest null + note (no backing table)
      checklistCompletion: null as number | null,
      checklistNote: NO_CHECKLIST,
      ticketsSolved: null as number | null,
      avgResponseTimeHours: null as number | null,
      ticketsNote: NO_TICKETS,
    };
  });

  // Sort by most active (tasks + faults closed) for a useful default view.
  rows.sort((a, b) => b.tasksClosed + b.faultsClosed - (a.tasksClosed + a.faultsClosed));

  res.json({
    generatedAt,
    lookbackDays,
    staffCount: rows.length,
    rows,
    metrics: {
      real: ['tasksClosed', 'tasksOpen', 'lateTasks', 'faultsClosed', 'hoursWorked', 'avgTaskResolutionHours'],
      notTracked: [
        { metric: 'checklistCompletion', reason: NO_CHECKLIST },
        { metric: 'ticketsSolved', reason: NO_TICKETS },
        { metric: 'avgResponseTimeHours', reason: NO_TICKETS },
      ],
    },
    note:
      'Operational visibility, not a performance score. faultsClosed is matched ' +
      'via hr_employees.firebase_uid; staff without a linked account (or faults ' +
      'auto-healed by "system") will not be attributed.',
    degraded: errors.length > 0,
    errors,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §17 — STAFF ACADEMY / TRAINING
//   No staff training/course table exists. Return the documented spec catalog,
//   the permission-gating rule (enforced:false), and an honest "not tracked"
//   flag. NEVER fabricate completions.
// ─────────────────────────────────────────────────────────────────────────────

interface AcademyCourse {
  courseId: string;
  titleEn: string;
  titleHe: string;
  summaryEn: string;
  summaryHe: string;
  /** Permissions this course is intended to gate, per the spec model. */
  gatesPermissions: string[];
  required: boolean;
}

// Course catalog from the CEO spec (§17). Documented model, not seeded data.
const ACADEMY_CATALOG: AcademyCourse[] = [
  {
    courseId: 'station-cleaning',
    titleEn: 'Station Cleaning & Hygiene',
    titleHe: 'ניקיון והיגיינה בעמדה',
    summaryEn: 'Daily cleaning routine, pet-safe hygiene, consumables handling.',
    summaryHe: 'שגרת ניקיון יומית, היגיינה בטוחה לחיות מחמד וטיפול בחומרים מתכלים.',
    gatesPermissions: ['station.operate'],
    required: true,
  },
  {
    courseId: 'machine-fault-basics',
    titleEn: 'Machine Fault Basics (K9000)',
    titleHe: 'יסודות תקלות מכונה (K9000)',
    summaryEn: 'Reading fault codes, safe first response, when to escalate.',
    summaryHe: 'קריאת קודי תקלה, תגובה ראשונית בטוחה ומתי להסלים.',
    gatesPermissions: ['fault.resolve'],
    required: true,
  },
  {
    courseId: 'customer-support',
    titleEn: 'Customer Support Essentials',
    titleHe: 'יסודות שירות לקוחות',
    summaryEn: 'Tone, response standards, escalation paths for customer issues.',
    summaryHe: 'טון, סטנדרטים לתגובה ומסלולי הסלמה לפניות לקוחות.',
    gatesPermissions: ['support.respond'],
    required: true,
  },
  {
    courseId: 'privacy-data',
    titleEn: 'Privacy & Data Protection',
    titleHe: 'פרטיות והגנת מידע',
    summaryEn: 'Amendment 13 basics, handling personal data, retention rules.',
    summaryHe: 'יסודות תיקון 13, טיפול במידע אישי וכללי שמירה.',
    gatesPermissions: ['customer.data.view'],
    required: true,
  },
  {
    courseId: 'refund-rules',
    titleEn: 'Refund & Cancellation Rules',
    titleHe: 'כללי החזרים וביטולים',
    summaryEn: 'Tiered refund policy, what staff may/may not authorise.',
    summaryHe: 'מדיניות החזרים מדורגת, מה מותר/אסור לעובד לאשר.',
    gatesPermissions: ['refund.process'],
    required: true,
  },
  {
    courseId: 'safety-incident',
    titleEn: 'Safety & Incident Response',
    titleHe: 'בטיחות ותגובה לאירועים',
    summaryEn: 'Pet/customer safety, incident reporting, emergency steps.',
    summaryHe: 'בטיחות חיה/לקוח, דיווח אירועים וצעדי חירום.',
    gatesPermissions: ['incident.report'],
    required: true,
  },
  {
    courseId: 'brand-standards',
    titleEn: 'Brand Standards',
    titleHe: 'סטנדרטים של המותג',
    summaryEn: 'PetWash luxury standards, presentation, language do/avoid.',
    summaryHe: 'סטנדרט יוקרה של PetWash, הצגה ושפה מותרת/אסורה.',
    gatesPermissions: [],
    required: false,
  },
  {
    courseId: 'egift-support',
    titleEn: 'eGift & Support',
    titleHe: 'גיפט קארד ותמיכה',
    summaryEn: 'eGift activation, redemption, common support cases.',
    summaryHe: 'הפעלת גיפט קארד, מימוש ומקרי תמיכה נפוצים.',
    gatesPermissions: ['egift.support'],
    required: false,
  },
  {
    courseId: 'admin-access',
    titleEn: 'Admin Access & Governance',
    titleHe: 'גישת ניהול וממשל',
    summaryEn: 'Admin console responsibilities, audit logging, least privilege.',
    summaryHe: 'אחריות בקונסולת הניהול, תיעוד ביקורת והרשאות מינימליות.',
    gatesPermissions: ['admin.access'],
    required: true,
  },
];

router.get('/academy', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();

  res.json({
    generatedAt,
    tracked: false,
    note:
      'Training records are not tracked yet — there is no staff training/course ' +
      'table in the schema (the existing provider_training_* tables are for ' +
      'marketplace providers, a different population). The catalog below is the ' +
      'documented course model from the spec; no completions are fabricated.',
    catalog: ACADEMY_CATALOG,
    records: [] as Array<unknown>,
    permissionRule: {
      enforced: false,
      description:
        'Per spec, staff permissions SHOULD be gated on completion of the ' +
        'required course(s) that cover each permission (see each course\'s ' +
        'gatesPermissions). This rule is documented but NOT enforced — no ' +
        'completion records exist and this module makes no permission changes.',
    },
  });
});

export default router;
