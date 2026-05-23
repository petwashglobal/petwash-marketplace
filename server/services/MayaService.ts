/**
 * Maya reception/intake service — thin Drizzle layer over the maya_* tables.
 *
 * Responsibilities:
 *   - typed CRUD-ish access for conversations, messages, leads, intake drafts,
 *     tasks, escalations
 *   - append-only audit writer (writes to maya_audit_log; UPDATE/DELETE on
 *     that table is blocked at the DB level by the migration's trigger)
 *
 * Hard constraints (enforced here in addition to the migration's CHECK
 * constraints):
 *   - Provider intake drafts CANNOT transition to 'approved' here. Provider
 *     approval is handled by the provider-admin system outside Maya.
 *   - Booking intake drafts CANNOT transition to 'confirmed' here. Final
 *     booking confirmation is handled by the existing booking system.
 *   - This service writes NO money. No wallet, no K9000, no payments.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
// NOTE: confirm this import path matches your repo. Likely '../db' or '../db/index'.
import { db } from '../db';
import {
  mayaAuditLog,
  mayaBookingIntakeDrafts,
  mayaConversations,
  mayaEscalations,
  mayaLeads,
  mayaMessages,
  mayaProviderIntakeDrafts,
  mayaTasks,
  type MayaConversation,
  type MayaMessage,
  type MayaLead,
  type MayaProviderIntakeDraft,
  type MayaBookingIntakeDraft,
  type MayaTask,
  type MayaEscalation,
} from '@shared/schema';

export type MayaActor = {
  type: 'system' | 'maya' | 'admin' | 'user';
  id?: string | null;
};

export type MayaAuditAction =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'status_change';

const VALID_ENTITIES = new Set([
  'conversation',
  'message',
  'lead',
  'provider_draft',
  'booking_draft',
  'task',
  'escalation',
]);

const VALID_ACTIONS: ReadonlySet<MayaAuditAction> = new Set([
  'create',
  'update',
  'soft_delete',
  'status_change',
]);

// ===========================================================================
// audit
// ===========================================================================
export async function writeMayaAudit(opts: {
  actor: MayaActor;
  entityType: string;
  entityId: string;
  action: MayaAuditAction;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (!VALID_ENTITIES.has(opts.entityType)) {
    throw new Error(`invalid entityType: ${opts.entityType}`);
  }
  if (!VALID_ACTIONS.has(opts.action)) {
    throw new Error(`invalid action: ${opts.action}`);
  }
  if (!opts.entityId) {
    throw new Error('entityId required');
  }
  await db.insert(mayaAuditLog).values({
    actorType: opts.actor.type,
    actorId: opts.actor.id ?? null,
    entityType: opts.entityType,
    entityId: opts.entityId,
    action: opts.action,
    payload: opts.payload ?? null,
  });
}

// ===========================================================================
// conversations
// ===========================================================================
export async function createConversation(
  input: {
    channel: string;
    locale?: string;
    contactPhone?: string | null;
    contactEmail?: string | null;
    contactName?: string | null;
  },
  actor: MayaActor,
): Promise<MayaConversation> {
  const [row] = await db
    .insert(mayaConversations)
    .values({
      channel: input.channel,
      locale: input.locale ?? 'he',
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      contactName: input.contactName ?? null,
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'conversation',
    entityId: row.id,
    action: 'create',
    payload: { channel: row.channel, locale: row.locale },
  });
  return row;
}

export async function getConversation(id: string): Promise<MayaConversation | null> {
  const [row] = await db
    .select()
    .from(mayaConversations)
    .where(and(eq(mayaConversations.id, id), isNull(mayaConversations.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ===========================================================================
// messages
// ===========================================================================
export async function appendMessage(
  conversationId: string,
  input: { role: string; content: string; locale?: string },
  actor: MayaActor,
): Promise<MayaMessage> {
  const conv = await getConversation(conversationId);
  if (!conv) {
    const err = new Error('conversation not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  const [row] = await db
    .insert(mayaMessages)
    .values({
      conversationId,
      role: input.role,
      content: input.content,
      locale: input.locale ?? 'he',
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'message',
    entityId: row.id,
    action: 'create',
    payload: { conversation_id: conversationId, role: row.role },
  });
  return row;
}

export async function listMessages(conversationId: string): Promise<MayaMessage[]> {
  return db
    .select()
    .from(mayaMessages)
    .where(eq(mayaMessages.conversationId, conversationId))
    .orderBy(asc(mayaMessages.createdAt));
}

// ===========================================================================
// leads
// ===========================================================================
export async function createLead(
  input: Omit<MayaLead, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'status'> & {
    status?: string;
  },
  actor: MayaActor,
): Promise<MayaLead> {
  const [row] = await db
    .insert(mayaLeads)
    .values({
      conversationId: input.conversationId ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      intent: input.intent ?? null,
      source: input.source ?? null,
      notes: input.notes ?? null,
      status: input.status ?? 'new',
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'lead',
    entityId: row.id,
    action: 'create',
    payload: { source: row.source },
  });
  return row;
}

export async function getLead(id: string): Promise<MayaLead | null> {
  const [row] = await db
    .select()
    .from(mayaLeads)
    .where(and(eq(mayaLeads.id, id), isNull(mayaLeads.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ===========================================================================
// provider intake drafts (DRAFT-ONLY)
// ===========================================================================
const ALLOWED_PROVIDER_INTAKE_STATUSES = new Set(['draft', 'submitted-for-review']);

export async function createProviderDraft(
  input: Omit<MayaProviderIntakeDraft, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'intakeStatus'>,
  actor: MayaActor,
): Promise<MayaProviderIntakeDraft> {
  const [row] = await db
    .insert(mayaProviderIntakeDrafts)
    .values({
      conversationId: input.conversationId ?? null,
      businessName: input.businessName ?? null,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      servicesOffered: input.servicesOffered ?? null,
      notes: input.notes ?? null,
      // intakeStatus omitted — DB default is 'draft'
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'provider_draft',
    entityId: row.id,
    action: 'create',
    payload: { city: row.city },
  });
  return row;
}

export async function updateProviderDraft(
  id: string,
  input: Partial<MayaProviderIntakeDraft>,
  actor: MayaActor,
): Promise<MayaProviderIntakeDraft> {
  if (input.intakeStatus && !ALLOWED_PROVIDER_INTAKE_STATUSES.has(input.intakeStatus)) {
    const err = new Error('approval is not handled by Maya') as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }
  const updates: Partial<MayaProviderIntakeDraft> & { updatedAt?: string } = {
    ...(input.businessName !== undefined && { businessName: input.businessName }),
    ...(input.contactName !== undefined && { contactName: input.contactName }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.region !== undefined && { region: input.region }),
    ...(input.servicesOffered !== undefined && { servicesOffered: input.servicesOffered }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.intakeStatus !== undefined && { intakeStatus: input.intakeStatus }),
    updatedAt: new Date().toISOString(),
  };
  if (Object.keys(updates).length === 1) {
    // only updatedAt — nothing to update
    const existing = await getProviderDraft(id);
    if (!existing) {
      const err = new Error('provider draft not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    return existing;
  }
  const [row] = await db
    .update(mayaProviderIntakeDrafts)
    .set(updates)
    .where(and(eq(mayaProviderIntakeDrafts.id, id), isNull(mayaProviderIntakeDrafts.deletedAt)))
    .returning();
  if (!row) {
    const err = new Error('provider draft not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  await writeMayaAudit({
    actor,
    entityType: 'provider_draft',
    entityId: id,
    action: input.intakeStatus ? 'status_change' : 'update',
    payload: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
  });
  return row;
}

export async function getProviderDraft(id: string): Promise<MayaProviderIntakeDraft | null> {
  const [row] = await db
    .select()
    .from(mayaProviderIntakeDrafts)
    .where(and(eq(mayaProviderIntakeDrafts.id, id), isNull(mayaProviderIntakeDrafts.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ===========================================================================
// booking intake drafts (DRAFT-ONLY; price never stored here)
// ===========================================================================
const ALLOWED_BOOKING_INTAKE_STATUSES = new Set(['draft', 'submitted-for-review']);

export async function createBookingDraft(
  input: Omit<MayaBookingIntakeDraft, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'intakeStatus'>,
  actor: MayaActor,
): Promise<MayaBookingIntakeDraft> {
  const [row] = await db
    .insert(mayaBookingIntakeDrafts)
    .values({
      conversationId: input.conversationId ?? null,
      leadId: input.leadId ?? null,
      serviceCode: input.serviceCode ?? null,
      petName: input.petName ?? null,
      petBreed: input.petBreed ?? null,
      petSize: input.petSize ?? null,
      preferredDates: input.preferredDates ?? null,
      preferredLocation: input.preferredLocation ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'booking_draft',
    entityId: row.id,
    action: 'create',
    payload: { service_code: row.serviceCode },
  });
  return row;
}

export async function updateBookingDraft(
  id: string,
  input: Partial<MayaBookingIntakeDraft>,
  actor: MayaActor,
): Promise<MayaBookingIntakeDraft> {
  if (input.intakeStatus && !ALLOWED_BOOKING_INTAKE_STATUSES.has(input.intakeStatus)) {
    const err = new Error('booking confirmation is not handled by Maya') as Error & {
      statusCode?: number;
    };
    err.statusCode = 422;
    throw err;
  }
  const updates: Partial<MayaBookingIntakeDraft> & { updatedAt?: string } = {
    ...(input.leadId !== undefined && { leadId: input.leadId }),
    ...(input.serviceCode !== undefined && { serviceCode: input.serviceCode }),
    ...(input.petName !== undefined && { petName: input.petName }),
    ...(input.petBreed !== undefined && { petBreed: input.petBreed }),
    ...(input.petSize !== undefined && { petSize: input.petSize }),
    ...(input.preferredDates !== undefined && { preferredDates: input.preferredDates }),
    ...(input.preferredLocation !== undefined && { preferredLocation: input.preferredLocation }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.intakeStatus !== undefined && { intakeStatus: input.intakeStatus }),
    updatedAt: new Date().toISOString(),
  };
  if (Object.keys(updates).length === 1) {
    const existing = await getBookingDraft(id);
    if (!existing) {
      const err = new Error('booking draft not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    return existing;
  }
  const [row] = await db
    .update(mayaBookingIntakeDrafts)
    .set(updates)
    .where(and(eq(mayaBookingIntakeDrafts.id, id), isNull(mayaBookingIntakeDrafts.deletedAt)))
    .returning();
  if (!row) {
    const err = new Error('booking draft not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  await writeMayaAudit({
    actor,
    entityType: 'booking_draft',
    entityId: id,
    action: input.intakeStatus ? 'status_change' : 'update',
    payload: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
  });
  return row;
}

export async function getBookingDraft(id: string): Promise<MayaBookingIntakeDraft | null> {
  const [row] = await db
    .select()
    .from(mayaBookingIntakeDrafts)
    .where(and(eq(mayaBookingIntakeDrafts.id, id), isNull(mayaBookingIntakeDrafts.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ===========================================================================
// tasks
// ===========================================================================
export async function createTask(
  input: { conversationId?: string | null; title: string; description?: string | null; assignee?: string | null; dueAt?: string | null },
  actor: MayaActor,
): Promise<MayaTask> {
  const [row] = await db
    .insert(mayaTasks)
    .values({
      conversationId: input.conversationId ?? null,
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee ?? null,
      dueAt: input.dueAt ?? null,
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'task',
    entityId: row.id,
    action: 'create',
    payload: { assignee: row.assignee },
  });
  return row;
}

export async function listTasks(opts: { status?: string } = {}): Promise<MayaTask[]> {
  const cond = opts.status
    ? and(isNull(mayaTasks.deletedAt), eq(mayaTasks.status, opts.status))
    : isNull(mayaTasks.deletedAt);
  return db.select().from(mayaTasks).where(cond).orderBy(desc(mayaTasks.createdAt)).limit(200);
}

// ===========================================================================
// escalations
// ===========================================================================
export async function createEscalation(
  input: {
    conversationId?: string | null;
    reason: string;
    severity?: string;
    assignee?: string | null;
  },
  actor: MayaActor,
): Promise<MayaEscalation> {
  const [row] = await db
    .insert(mayaEscalations)
    .values({
      conversationId: input.conversationId ?? null,
      reason: input.reason,
      severity: input.severity ?? 'medium',
      assignee: input.assignee ?? null,
    })
    .returning();
  await writeMayaAudit({
    actor,
    entityType: 'escalation',
    entityId: row.id,
    action: 'create',
    payload: { severity: row.severity },
  });
  return row;
}
