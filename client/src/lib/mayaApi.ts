/**
 * Maya admin API client (Stage 2).
 *
 * Thin typed wrappers over /api/admin/maya/*. Uses the same apiRequest +
 * queryClient pattern as the rest of the codebase.
 *
 * SAFETY: every call hits the admin-gated, MFA-gated, flag-gated backend.
 * If the master flag (ff.maya.enabled) is OFF, every call returns 503.
 * Components should treat 503 from these endpoints as "Maya is currently
 * disabled" and render an empty state — not an error.
 */
import { apiRequest } from './queryClient';

// ---------- types (mirror server/services/MayaService.ts return shapes) ----------
export interface MayaConversation {
  id: string;
  channel: string;
  locale: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  locale: string;
  createdAt: string;
}

export interface MayaLead {
  id: string;
  conversationId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  intent: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaProviderDraft {
  id: string;
  conversationId: string | null;
  businessName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  servicesOffered: string[] | null;
  notes: string | null;
  intakeStatus: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaBookingDraft {
  id: string;
  conversationId: string | null;
  leadId: string | null;
  serviceCode: string | null;
  petName: string | null;
  petBreed: string | null;
  petSize: string | null;
  preferredDates: string[] | null;
  preferredLocation: string | null;
  notes: string | null;
  intakeStatus: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaTask {
  id: string;
  conversationId: string | null;
  title: string;
  description: string | null;
  assignee: string | null;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaEscalation {
  id: string;
  conversationId: string | null;
  reason: string;
  severity: string;
  status: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MayaAuditEntry {
  // bigserial in the DB; route handler stringifies for JSON safety
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: unknown;
}

// Common envelope shape from /api/admin/maya/*
type Envelope<T> = { ok: true } & T;

// ---------- helpers ----------
function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiRequest(path);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiRequest(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiRequest(path, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return (await res.json()) as T;
}

// ---------- conversations ----------
export async function listConversations(opts: { status?: string; limit?: number } = {}) {
  return getJson<Envelope<{ conversations: MayaConversation[] }>>(
    `/api/admin/maya/conversations${qs(opts)}`,
  );
}

export async function getConversation(id: string) {
  return getJson<Envelope<{ conversation: MayaConversation }>>(`/api/admin/maya/conversations/${id}`);
}

export async function listMessages(conversationId: string) {
  return getJson<Envelope<{ messages: MayaMessage[] }>>(
    `/api/admin/maya/conversations/${conversationId}/messages`,
  );
}

// ---------- leads ----------
export async function listLeads(opts: { status?: string; limit?: number } = {}) {
  return getJson<Envelope<{ leads: MayaLead[] }>>(`/api/admin/maya/leads${qs(opts)}`);
}

export async function getLead(id: string) {
  return getJson<Envelope<{ lead: MayaLead }>>(`/api/admin/maya/leads/${id}`);
}

// ---------- provider intake drafts ----------
export async function listProviderDrafts(opts: { status?: string; limit?: number } = {}) {
  return getJson<Envelope<{ drafts: MayaProviderDraft[] }>>(
    `/api/admin/maya/provider-intake-drafts${qs(opts)}`,
  );
}

export async function getProviderDraft(id: string) {
  return getJson<Envelope<{ draft: MayaProviderDraft }>>(
    `/api/admin/maya/provider-intake-drafts/${id}`,
  );
}

// ---------- booking intake drafts ----------
export async function listBookingDrafts(opts: { status?: string; limit?: number } = {}) {
  return getJson<Envelope<{ drafts: MayaBookingDraft[] }>>(
    `/api/admin/maya/booking-intake-drafts${qs(opts)}`,
  );
}

export async function getBookingDraft(id: string) {
  return getJson<Envelope<{ draft: MayaBookingDraft }>>(
    `/api/admin/maya/booking-intake-drafts/${id}`,
  );
}

// ---------- tasks ----------
export async function listTasks(opts: { status?: string; limit?: number } = {}) {
  return getJson<Envelope<{ tasks: MayaTask[] }>>(`/api/admin/maya/tasks${qs(opts)}`);
}

export async function getTask(id: string) {
  return getJson<Envelope<{ task: MayaTask }>>(`/api/admin/maya/tasks/${id}`);
}

// ---------- escalations ----------
export async function listEscalations(opts: { status?: string; severity?: string; limit?: number } = {}) {
  return getJson<Envelope<{ escalations: MayaEscalation[] }>>(
    `/api/admin/maya/escalations${qs(opts)}`,
  );
}

export async function getEscalation(id: string) {
  return getJson<Envelope<{ escalation: MayaEscalation }>>(`/api/admin/maya/escalations/${id}`);
}

// ---------- audit log ----------
export async function listAudit(opts: { entityType?: string; entityId?: string; limit?: number } = {}) {
  return getJson<Envelope<{ entries: MayaAuditEntry[] }>>(`/api/admin/maya/audit${qs(opts)}`);
}

// ---------- query keys (for TanStack Query cache management) ----------
export const mayaQK = {
  conversations: (opts?: { status?: string }) => ['maya', 'conversations', opts ?? {}] as const,
  conversation: (id: string) => ['maya', 'conversation', id] as const,
  messages: (conversationId: string) => ['maya', 'messages', conversationId] as const,
  leads: (opts?: { status?: string }) => ['maya', 'leads', opts ?? {}] as const,
  lead: (id: string) => ['maya', 'lead', id] as const,
  providerDrafts: (opts?: { status?: string }) => ['maya', 'providerDrafts', opts ?? {}] as const,
  providerDraft: (id: string) => ['maya', 'providerDraft', id] as const,
  bookingDrafts: (opts?: { status?: string }) => ['maya', 'bookingDrafts', opts ?? {}] as const,
  bookingDraft: (id: string) => ['maya', 'bookingDraft', id] as const,
  tasks: (opts?: { status?: string }) => ['maya', 'tasks', opts ?? {}] as const,
  task: (id: string) => ['maya', 'task', id] as const,
  escalations: (opts?: { status?: string; severity?: string }) => ['maya', 'escalations', opts ?? {}] as const,
  escalation: (id: string) => ['maya', 'escalation', id] as const,
  audit: (opts?: { entityType?: string; entityId?: string }) => ['maya', 'audit', opts ?? {}] as const,
};

/**
 * Detect the "feature disabled" sentinel from the API.
 * Backend returns 503 with body { ok: false, error: 'maya_disabled' | 'feature_disabled' }.
 * Components can use this to render a clean disabled-state instead of an error.
 */
export function isMayaDisabledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; body?: { error?: string } };
  return e.status === 503 || e.body?.error === 'maya_disabled' || e.body?.error === 'feature_disabled';
}
