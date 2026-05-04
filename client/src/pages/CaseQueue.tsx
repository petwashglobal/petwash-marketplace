/**
 * CaseQueue — Phase 12.9 (Action Orchestration)
 * Route: /case-queue
 *
 * Phase 12.8 features preserved:
 *   Disputes · Mismatches · Refunds · SLA · Severity
 *
 * Phase 12.9 additions:
 *   - "My cases" vs "All cases" toggle
 *   - Checkboxes for multi-select + bulk action bar
 *   - Per-row: Assign to me / Unassign / Notes
 *   - Inline notes panel (lazy per row)
 *   - Assignment badge showing who owns each case
 *   - Controlled state transitions (bulk mark under review / close)
 *   - SLA ownership moves with assignment
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert, TriangleAlert, Clock, CheckCircle2,
  ArrowUpRight, Banknote, AlertCircle, Filter,
  UserPlus, UserMinus, MessageSquare, ChevronDown, ChevronUp,
  Users, User, Loader2, Send, Siren, RotateCcw, Building2, X, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlaStatus = 'on_track' | 'at_risk' | 'breached';
type Severity  = 'critical' | 'high' | 'medium' | 'low';
type CaseOwner = 'platform' | 'franchise_owner' | 'system' | 'none';

interface BaseCase {
  caseType:       string;
  caseId:         string;
  bookingId:      string;
  bookingNumber:  string;
  stationId:      number | null;
  stationName:    string;
  stationCode:    string;
  currency:       string;
  ageHours:       number;
  slaStatus:      SlaStatus;
  slaBudgetHours: number;
  severity:       Severity;
  currentOwner:   CaseOwner;
  openedAt:       string | null;
}

interface DisputeCase extends BaseCase {
  caseType:          'dispute';
  reason:            string;
  description:       string | null;
  status:            string;
  total:             number;
  closureRequested:  boolean;
  closureApproved:   boolean;
  closureReasonCode: string | null;
}

interface MismatchCase extends BaseCase {
  caseType:         'mismatch';
  settlementId:     number;
  settlementStatus: string;
  totalAmount:      number;
  mismatchILS:      number;
}

interface RefundCase extends BaseCase {
  caseType:    'refund';
  refundAmount: number;
  refundStatus: string;
  refundReason: string | null;
  total:        number;
}

interface QueueResponse<T extends BaseCase> { cases: T[]; total: number; }

interface EscalatedCase {
  caseType:         string;
  caseId:           string;
  bookingId:        string;
  bookingNumber:    string;
  stationId:        number | null;
  stationName:      string;
  stationCode:      string;
  label:            string;
  status:           string;
  amount:           number;
  currency:         string;
  ageHours:         number;
  slaBudgetHours:   number;
  overdueHours:     number;
  breachDetectedAt: string | null;
  escalatedAt:      string | null;
  escalatedToUid:   string | null;
  assignedToUid:    string | null;
  openedAt:         string | null;
  severity:         'critical';
  slaStatus:        'breached';
}

interface Summary {
  disputes:         { total: number; breached: number; atRiskOrBreached: number };
  mismatches:       { total: number; breached: number; atRiskOrBreached: number };
  refunds:          { total: number; breached: number; atRiskOrBreached: number };
  totalActiveCases: number;
  totalBreached:    number;
}

interface Assignment {
  id:              number;
  caseType:        string;
  caseRefId:       string;
  assignedToUid:   string | null;
  assignedTeamId:  number | null;
  teamName:        string | null;
  assignedByUid:   string | null;
  note:            string | null;
  assignedAt:      string | null;
}

interface MyTeam {
  id:          number;
  name:        string;
  type:        string;
  myRole:      string;
  memberCount: number;
}

interface ResolutionCode { code: string; label: string; appliesTo: string | null; }
interface ReopenCode     { code: string; label: string; }

interface CaseNote {
  id:         number;
  authorUid:  string;
  authorRole: string | null;
  noteText:   string;
  createdAt:  string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const fmt = (n: number) => ILS.format(n);

function ageLabel(hours: number): string {
  if (hours < 1)  return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function shortUid(uid: string | null): string {
  if (!uid) return '—';
  return uid.length > 10 ? uid.slice(0, 8) + '…' : uid;
}

function dtShort(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('he-IL', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ s }: { s: Severity }) {
  const styles = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    high:     'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    medium:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    low:      'bg-white text-gray-600 dark:bg-white dark:text-gray-400',
  };
  const icons = {
    critical: <ShieldAlert className="h-3 w-3 mr-1" />,
    high:     <TriangleAlert className="h-3 w-3 mr-1" />,
    medium:   <AlertCircle className="h-3 w-3 mr-1" />,
    low:      null,
  };
  return (
    <Badge className={cn('border-0 text-xs capitalize flex items-center', styles[s])}>
      {icons[s]}{s}
    </Badge>
  );
}

function SlaCell({ ageHours, slaBudgetHours, slaStatus }: {
  ageHours: number; slaBudgetHours: number; slaStatus: SlaStatus
}) {
  const pct       = Math.min(100, (ageHours / slaBudgetHours) * 100);
  const remaining = slaBudgetHours - ageHours;
  const barColor  =
    slaStatus === 'breached' ? 'bg-red-500' :
    slaStatus === 'at_risk'  ? 'bg-orange-400' : 'bg-emerald-400';
  const textColor =
    slaStatus === 'breached' ? 'text-red-600 dark:text-red-400' :
    slaStatus === 'at_risk'  ? 'text-orange-600 dark:text-orange-400' :
                               'text-emerald-600 dark:text-emerald-400';
  return (
    <div className="space-y-1 min-w-[80px]">
      <div className="w-full h-1.5 bg-white dark:bg-white rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn('text-xs font-medium', textColor)}>
        {slaStatus === 'breached'
          ? `+${ageLabel(Math.abs(remaining))} over`
          : `${ageLabel(remaining)} left`}
      </p>
    </div>
  );
}

function AssignedBadge({ uid, isMe }: { uid: string; isMe: boolean }) {
  return (
    <Badge className={cn(
      'border-0 text-xs font-mono flex items-center gap-1 max-w-[100px]',
      isMe
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
    )}>
      <User className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="truncate">{isMe ? 'Me' : shortUid(uid)}</span>
    </Badge>
  );
}

function SummaryCard({ label, total, breached, icon }: {
  label: string; total: number; breached: number; icon: React.ReactNode
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-black">{total}</p>
          {breached > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />{breached} SLA breached
            </p>
          )}
        </div>
        <div className="text-gray-300 dark:text-gray-600 mt-0.5">{icon}</div>
      </CardContent>
    </Card>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No {label} cases</p>
      <p className="text-xs mt-1">Everything looks clean here.</p>
    </div>
  );
}

function SkeletonRows({ cols = 7 }: { cols?: number }) {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function sortCases<T extends BaseCase>(cases: T[]): T[] {
  return [...cases].sort((a, b) => {
    const sev = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    return sev !== 0 ? sev : b.ageHours - a.ageHours;
  });
}

// ─── Inline notes panel ───────────────────────────────────────────────────────

function NotesPanel({ caseType, caseRefId, currentUid }: {
  caseType: string; caseRefId: string; currentUid: string | null;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const notesQ = useQuery<{ notes: CaseNote[] }>({
    queryKey: [`/api/case-actions/notes/${caseType}/${caseRefId}`],
  });

  const addNote = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/note', { caseType, caseRefId, noteText: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: [`/api/case-actions/notes/${caseType}/${caseRefId}`] });
    },
  });

  const notes = notesQ.data?.notes ?? [];

  return (
    <div className="bg-white dark:bg-white border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Internal Notes</p>

      {notesQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No notes yet.</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {notes.map(n => (
            <div key={n.id} className="bg-white dark:bg-white rounded-md px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono font-medium text-gray-500">{shortUid(n.authorUid)}</span>
                {n.authorRole && (
                  <Badge className="bg-white text-gray-500 border-0 text-[10px] py-0 px-1.5">{n.authorRole}</Badge>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">{dtShort(n.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-black whitespace-pre-wrap">{n.noteText}</p>
            </div>
          ))}
        </div>
      )}

      {currentUid && (
        <div className="flex gap-2">
          <Textarea
            className="text-sm resize-none h-16 flex-1"
            placeholder="Add internal note…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <Button
            size="icon"
            disabled={!text.trim() || addNote.isPending}
            onClick={() => addNote.mutate()}
            className="self-end"
          >
            {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────────────

interface BulkBarProps {
  selected:    Set<string>;
  casesByKey:  Map<string, { caseType: string; caseRefId: string; bookingId?: string }>;
  onClear:     () => void;
  onSuccess:   () => void;
  currentUid:  string | null;
  activeTab:   string;
}

function BulkActionBar({ selected, casesByKey, onClear, onSuccess, currentUid, activeTab }: BulkBarProps) {
  const qc = useQueryClient();

  const bulkMutation = useMutation({
    mutationFn: (action: string) => {
      const cases = Array.from(selected).map(key => casesByKey.get(key)!).filter(Boolean);
      return apiRequest('POST', '/api/case-actions/bulk', { action, cases });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/case-actions/assignments'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] });
      onClear();
      onSuccess();
    },
  });

  const count = selected.size;
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-semibold text-gray-700 dark:text-black mr-1">
        {count} selected
      </span>

      {currentUid && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-600"
          disabled={bulkMutation.isPending}
          onClick={() => bulkMutation.mutate('assign_to_me')}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign to me
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-gray-600 hover:bg-white"
        disabled={bulkMutation.isPending}
        onClick={() => bulkMutation.mutate('unassign')}
      >
        <UserMinus className="h-3.5 w-3.5" />
        Unassign
      </Button>

      {activeTab === 'disputes' && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-300"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate('mark_under_review')}
          >
            Mark Under Review
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-gray-500 hover:bg-white"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate('close_cases')}
          >
            Close
          </Button>
        </>
      )}

      {bulkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}

      <button
        className="text-gray-400 hover:text-gray-600 ml-1 text-xs underline"
        onClick={onClear}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Row-level assign controls ────────────────────────────────────────────────

function RowAssignControls({ caseType, caseRefId, assignedToUid, currentUid, onMutated }: {
  caseType:      string;
  caseRefId:     string;
  assignedToUid: string | null;
  currentUid:    string | null;
  onMutated:     () => void;
}) {
  const qc = useQueryClient();

  const assignMe = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/assign', {
      caseType, caseRefId, assignToUid: currentUid,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/case-actions/assignments'] });
      onMutated();
    },
  });

  const unassign = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/unassign', { caseType, caseRefId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/case-actions/assignments'] });
      onMutated();
    },
  });

  const isPending = assignMe.isPending || unassign.isPending;

  if (!currentUid) return null;

  if (!assignedToUid) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 px-2"
        disabled={isPending}
        onClick={e => { e.stopPropagation(); assignMe.mutate(); }}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
        Assign me
      </Button>
    );
  }

  if (assignedToUid === currentUid) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs gap-1 text-gray-500 hover:text-red-600 hover:bg-red-50 px-2"
        disabled={isPending}
        onClick={e => { e.stopPropagation(); unassign.mutate(); }}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
        Unassign
      </Button>
    );
  }

  // Assigned to someone else — allow reassign or unassign
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 text-xs gap-1 text-indigo-600 hover:text-blue-700 hover:bg-blue-50 px-2"
      disabled={isPending}
      onClick={e => { e.stopPropagation(); assignMe.mutate(); }}
      title={`Currently: ${assignedToUid}`}
    >
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
      Reassign me
    </Button>
  );
}

// ─── Escalated Tab ────────────────────────────────────────────────────────────

function CaseTypeBadge({ type }: { type: string }) {
  const styles = {
    dispute:  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    mismatch: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    refund:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  }[type] ?? 'bg-white text-gray-600';
  return <Badge className={cn('border-0 text-xs capitalize', styles)}>{type}</Badge>;
}

function ReopenButton({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [reopenCode, setCode] = useState('');
  const [note, setNote]       = useState('');

  const codesQ = useQuery<{ codes: ReopenCode[] }>({
    queryKey: ['/api/case-actions/reopen-codes'],
    staleTime: 300_000,
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/reopen', {
      bookingId, reopenCode, note: note || undefined,
    }),
    onSuccess: () => {
      setOpen(false); setCode(''); setNote('');
      qc.invalidateQueries({ queryKey: ['/api/case-queue/escalated'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] });
      onDone();
    },
  });

  if (!open) {
    return (
      <Button
        size="sm" variant="ghost"
        className="h-6 text-xs gap-1 px-2 text-indigo-600 hover:bg-indigo-50"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
      >
        <RotateCcw className="h-3 w-3" />Reopen
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
      <Select value={reopenCode} onValueChange={setCode}>
        <SelectTrigger className="h-7 text-xs w-44">
          <SelectValue placeholder="Reason for reopen *" />
        </SelectTrigger>
        <SelectContent>
          {(codesQ.data?.codes ?? []).map(c => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        className="border rounded px-2 py-0.5 text-xs w-28 dark:bg-white"
        placeholder="Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      />
      <Button
        size="sm" className="h-6 text-xs px-2"
        disabled={mut.isPending || !reopenCode}
        onClick={() => mut.mutate()}
      >
        {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
      </Button>
      <button className="text-gray-400 text-xs hover:text-gray-600" onClick={() => setOpen(false)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Closure Request Button ───────────────────────────────────────────────────

function ClosureRequestButton({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen]         = useState(false);
  const [reasonCode, setCode]   = useState('');
  const [note, setNote]         = useState('');

  const codesQ = useQuery<{ codes: ResolutionCode[] }>({
    queryKey: ['/api/case-actions/resolution-codes'],
    staleTime: 300_000,
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/closure-request', {
      bookingId, closureReasonCode: reasonCode, note: note || undefined,
    }),
    onSuccess: () => {
      setOpen(false); setCode(''); setNote('');
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] });
      onDone();
    },
  });

  if (!open) {
    return (
      <Button
        size="sm" variant="ghost"
        className="h-6 text-xs gap-1 px-2 text-gray-500 hover:text-green-700 hover:bg-green-50"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
      >
        Request Close
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
      <Select value={reasonCode} onValueChange={setCode}>
        <SelectTrigger className="h-7 text-xs w-44">
          <SelectValue placeholder="Resolution code *" />
        </SelectTrigger>
        <SelectContent>
          {(codesQ.data?.codes ?? [])
            .filter(c => !c.appliesTo || c.appliesTo === 'dispute')
            .map(c => (
              <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
            ))}
        </SelectContent>
      </Select>
      <input
        className="border rounded px-2 py-0.5 text-xs w-28 dark:bg-white"
        placeholder="Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      <Button
        size="sm" className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700"
        disabled={mut.isPending || !reasonCode}
        onClick={() => mut.mutate()}
      >
        {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit'}
      </Button>
      <button className="text-gray-400 text-xs hover:text-gray-600" onClick={() => setOpen(false)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Closure Approval Controls ────────────────────────────────────────────────

function ClosureApprovalControls({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const qc = useQueryClient();

  const approveMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/closure-approve', { bookingId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] });
      onDone();
    },
  });
  const rejectMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/closure-reject', { bookingId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      onDone();
    },
  });

  const isPending = approveMut.isPending || rejectMut.isPending;

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs px-1.5 py-0.5">
        Pending approval
      </Badge>
      <Button
        size="sm" variant="ghost"
        className="h-6 text-xs gap-1 px-2 text-green-700 hover:bg-green-50"
        disabled={isPending}
        onClick={e => { e.stopPropagation(); approveMut.mutate(); }}
      >
        {approveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
        Approve
      </Button>
      <Button
        size="sm" variant="ghost"
        className="h-6 text-xs gap-1 px-2 text-red-600 hover:bg-red-50"
        disabled={isPending}
        onClick={e => { e.stopPropagation(); rejectMut.mutate(); }}
      >
        {rejectMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
        Reject
      </Button>
    </div>
  );
}

function EscalatedTab({ cases, isLoading, currentUid }: {
  cases: EscalatedCase[]; isLoading: boolean; currentUid: string | null;
}) {
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-red-50/50 dark:bg-red-950/20">
                {['Type','Booking','Station','Age','Overdue','Escalated to','Assigned to','Actions'].map(h => (
                  <TableHead key={h} className="text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody><SkeletonRows cols={8} /></TableBody>
          </Table>
        </div>
      </Card>
    );
  }

  if (!cases.length) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No escalated cases</p>
          <p className="text-xs mt-1">All cases are within their SLA window.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-red-50/50 dark:bg-red-950/20">
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Booking</TableHead>
              <TableHead className="text-xs">Station</TableHead>
              <TableHead className="text-xs">Detail</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
              <TableHead className="text-xs">Age</TableHead>
              <TableHead className="text-xs text-red-600 font-semibold">Overdue</TableHead>
              <TableHead className="text-xs">Escalated to</TableHead>
              <TableHead className="text-xs">Assigned to</TableHead>
              <TableHead className="text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map(c => {
              const ILS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
              return (
                <TableRow key={c.caseId} className="bg-red-50/30 dark:bg-red-950/10 border-l-2 border-red-400">
                  <TableCell className="py-3"><CaseTypeBadge type={c.caseType} /></TableCell>
                  <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {c.bookingNumber}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {c.stationName || '—'}
                    {c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-600 max-w-[140px] truncate capitalize">
                    {c.label.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-right tabular-nums font-medium">
                    {c.amount > 0 ? ILS.format(c.amount) : '—'}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-gray-500 whitespace-nowrap">
                    {c.ageHours < 24 ? `${Math.round(c.ageHours)}h` : `${Math.round(c.ageHours / 24)}d`}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-red-600 font-semibold text-sm whitespace-nowrap">
                      +{c.overdueHours < 24 ? `${Math.round(c.overdueHours)}h` : `${(c.overdueHours / 24).toFixed(1)}d`}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {c.escalatedToUid ? (
                      <Badge className={cn(
                        'border-0 text-xs font-mono',
                        c.escalatedToUid === currentUid
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                      )}>
                        {c.escalatedToUid === currentUid ? 'Me' : c.escalatedToUid === 'platform_admin' ? 'Admin' : c.escalatedToUid.slice(0, 8) + '…'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {c.assignedToUid ? (
                      <Badge className="border-0 text-xs font-mono bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {c.assignedToUid === currentUid ? 'Me' : c.assignedToUid.slice(0, 8) + '…'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/booking-trace/${c.bookingId}`}
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs"
                        onClick={e => e.stopPropagation()}
                      >
                        View <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      {c.caseType === 'dispute' && (
                        <ReopenButton
                          bookingId={c.bookingId}
                          onDone={() => qc.invalidateQueries({ queryKey: ['/api/case-queue/escalated'] })}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaseQueue() {
  const qc = useQueryClient();
  const [activeTab,    setActiveTab]    = useState('disputes');
  const [caseFilter,   setCaseFilter]   = useState<'all' | 'mine' | 'my_team'>('all');
  const filterMine = caseFilter === 'mine';
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [currentUid,   setCurrentUid]   = useState<string | null>(null);

  // Get Firebase current user UID
  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u => setCurrentUid(u?.uid ?? null));
    return unsub;
  }, []);

  // When tab changes, clear selection
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSelected(new Set());
    setExpandedNotes(new Set());
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────

  const summaryQ  = useQuery<Summary>({
    queryKey: ['/api/case-queue/summary'],
  });
  const disputesQ = useQuery<QueueResponse<DisputeCase>>({
    queryKey: ['/api/case-queue/disputes'],
    enabled:  activeTab === 'disputes',
  });
  const mismatchQ = useQuery<QueueResponse<MismatchCase>>({
    queryKey: ['/api/case-queue/mismatches'],
    enabled:  activeTab === 'mismatches',
  });
  const refundsQ  = useQuery<QueueResponse<RefundCase>>({
    queryKey: ['/api/case-queue/refunds'],
    enabled:  activeTab === 'refunds',
  });
  const escalatedQ = useQuery<{ cases: EscalatedCase[]; total: number }>({
    queryKey: ['/api/case-queue/escalated'],
    enabled:  activeTab === 'escalated',
    refetchInterval: 60_000,  // auto-refresh every minute when on this tab
  });
  const assignmentsQ = useQuery<{ assignments: Assignment[] }>({
    queryKey: ['/api/case-actions/assignments'],
    staleTime: 30_000,
  });
  const myTeamsQ = useQuery<{ teams: MyTeam[] }>({
    queryKey: ['/api/teams/mine'],
    enabled: !!currentUid,
    staleTime: 60_000,
  });
  const resolutionCodesQ = useQuery<{ codes: ResolutionCode[] }>({
    queryKey: ['/api/case-actions/resolution-codes'],
    staleTime: 300_000,
  });
  const reopenCodesQ = useQuery<{ codes: ReopenCode[] }>({
    queryKey: ['/api/case-actions/reopen-codes'],
    staleTime: 300_000,
  });

  const summary = summaryQ.data;

  // ── Assignment map ─────────────────────────────────────────────────────────

  const assignMap = useMemo(() => {
    const m = new Map<string, Assignment>();
    for (const a of assignmentsQ.data?.assignments ?? []) {
      m.set(`${a.caseType}-${a.caseRefId}`, a);
    }
    return m;
  }, [assignmentsQ.data]);

  // ── Filter helpers ─────────────────────────────────────────────────────────

  function filterCases<T extends BaseCase>(cases: T[]): T[] {
    if (caseFilter === 'all' || !currentUid) return cases;
    if (caseFilter === 'mine') {
      return cases.filter(c => {
        const a = assignMap.get(`${c.caseType}-${c.caseId}`);
        return a?.assignedToUid === currentUid;
      });
    }
    // my_team: cases assigned to any of my teams
    const myTeamIds = new Set((myTeamsQ.data?.teams ?? []).map(t => t.id));
    if (myTeamIds.size === 0) return cases;
    return cases.filter(c => {
      const a = assignMap.get(`${c.caseType}-${c.caseId}`);
      return a?.assignedTeamId != null && myTeamIds.has(a.assignedTeamId);
    });
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  function toggleRow(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleAll(cases: BaseCase[]) {
    const keys = cases.map(c => c.caseId);
    const allSelected = keys.every(k => selected.has(k));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(keys));
    }
  }

  function toggleNotes(key: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Build casesByKey map for bulk bar ──────────────────────────────────────

  const casesByKey = useMemo(() => {
    const m = new Map<string, { caseType: string; caseRefId: string; bookingId?: string }>();
    for (const c of disputesQ.data?.cases ?? []) {
      m.set(c.caseId, { caseType: c.caseType, caseRefId: c.caseId, bookingId: c.bookingId });
    }
    for (const c of mismatchQ.data?.cases ?? []) {
      m.set(c.caseId, { caseType: c.caseType, caseRefId: c.caseId, bookingId: c.bookingId });
    }
    for (const c of refundsQ.data?.cases ?? []) {
      m.set(c.caseId, { caseType: c.caseType, caseRefId: c.caseId, bookingId: c.bookingId });
    }
    return m;
  }, [disputesQ.data, mismatchQ.data, refundsQ.data]);

  // ── Rendered case lists ────────────────────────────────────────────────────

  const filteredDisputes  = useMemo(() =>
    filterCases(sortCases(disputesQ.data?.cases  ?? [])),
    [disputesQ.data, caseFilter, currentUid, assignMap, myTeamsQ.data]
  );
  const filteredMismatches = useMemo(() =>
    filterCases(sortCases(mismatchQ.data?.cases ?? [])),
    [mismatchQ.data, caseFilter, currentUid, assignMap, myTeamsQ.data]
  );
  const filteredRefunds = useMemo(() =>
    filterCases(sortCases(refundsQ.data?.cases ?? [])),
    [refundsQ.data, caseFilter, currentUid, assignMap, myTeamsQ.data]
  );

  // ── Row helper ─────────────────────────────────────────────────────────────

  function renderRowExtras(c: BaseCase) {
    const assignee  = assignMap.get(`${c.caseType}-${c.caseId}`);
    const isExpanded = expandedNotes.has(c.caseId);
    const dispute   = c.caseType === 'dispute' ? (c as DisputeCase) : null;
    const refresh   = () => {
      qc.invalidateQueries({ queryKey: ['/api/case-queue/disputes'] });
      qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] });
    };

    return (
      <>
        <TableRow
          key={c.caseId + '-actions'}
          className="border-0"
        >
          <TableCell colSpan={100} className="py-1 px-4">
            <div className="flex items-center gap-2 flex-wrap">
              <RowAssignControls
                caseType={c.caseType}
                caseRefId={c.caseId}
                assignedToUid={assignee?.assignedToUid ?? null}
                currentUid={currentUid}
                onMutated={() => qc.invalidateQueries({ queryKey: ['/api/case-actions/assignments'] })}
              />
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  'h-6 text-xs gap-1 px-2',
                  isExpanded
                    ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                )}
                onClick={e => { e.stopPropagation(); toggleNotes(c.caseId); }}
              >
                <MessageSquare className="h-3 w-3" />
                Notes
                {isExpanded
                  ? <ChevronUp className="h-3 w-3" />
                  : <ChevronDown className="h-3 w-3" />}
              </Button>
              {/* Closure controls — disputes only */}
              {dispute && !dispute.closureRequested && dispute.status !== 'closed' && (
                <ClosureRequestButton bookingId={dispute.caseId} onDone={refresh} />
              )}
              {dispute?.closureRequested && !dispute.closureApproved && (
                <ClosureApprovalControls bookingId={dispute.caseId} onDone={refresh} />
              )}
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <TableRow key={c.caseId + '-notes'} className="border-0">
            <TableCell colSpan={100} className="p-0">
              <NotesPanel
                caseType={c.caseType}
                caseRefId={c.caseId}
                currentUid={currentUid}
              />
            </TableCell>
          </TableRow>
        )}
      </>
    );
  }

  // ── Shared column: assigned + checkbox ─────────────────────────────────────

  function AssignedCell({ c }: { c: BaseCase }) {
    const assignee = assignMap.get(`${c.caseType}-${c.caseId}`);
    if (!assignee) return <TableCell className="py-3"><span className="text-xs text-gray-400">—</span></TableCell>;
    return (
      <TableCell className="py-3 space-y-0.5">
        {assignee.assignedTeamId != null && (
          <Badge className="border-0 text-xs flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 max-w-[110px]">
            <Building2 className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{assignee.teamName ?? `Team ${assignee.assignedTeamId}`}</span>
          </Badge>
        )}
        {assignee.assignedToUid && (
          <AssignedBadge uid={assignee.assignedToUid} isMe={assignee.assignedToUid === currentUid} />
        )}
      </TableCell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-black flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              Exception Queue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Open disputes · settlement mismatches · pending refunds
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* All / My cases / My team toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-white">
              {([
                { value: 'all',     label: 'All cases',   icon: <Users className="h-3.5 w-3.5" /> },
                { value: 'mine',    label: 'My cases',    icon: <User className="h-3.5 w-3.5" /> },
                { value: 'my_team', label: 'My team',     icon: <Building2 className="h-3.5 w-3.5" /> },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                    caseFilter === opt.value
                      ? opt.value === 'all'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
                        : opt.value === 'mine'
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-purple-600 text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white'
                  )}
                  onClick={() => setCaseFilter(opt.value)}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>

            {summary && summary.totalBreached > 0 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-0 text-sm font-semibold px-3 py-1.5">
                <ShieldAlert className="h-4 w-4 mr-1.5" />
                {summary.totalBreached} SLA Breached
              </Badge>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryQ.isLoading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)
          ) : summary ? (
            <>
              <SummaryCard label="Open Disputes"  total={summary.disputes.total}   breached={summary.disputes.breached}  icon={<ShieldAlert className="h-7 w-7" />} />
              <SummaryCard label="Mismatches"     total={summary.mismatches.total} breached={summary.mismatches.breached} icon={<TriangleAlert className="h-7 w-7" />} />
              <SummaryCard label="Pending Refunds" total={summary.refunds.total}   breached={summary.refunds.breached}   icon={<Banknote className="h-7 w-7" />} />
              <SummaryCard label="Total Active"   total={summary.totalActiveCases} breached={summary.totalBreached}      icon={<Clock className="h-7 w-7" />} />
            </>
          ) : null}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white dark:bg-white border border-gray-200 dark:border-gray-700">
            {(['disputes','mismatches','refunds'] as const).map(tab => {
              const s = summary?.[tab];
              return (
                <TabsTrigger key={tab} value={tab} className="text-sm capitalize">
                  {tab}
                  {s && s.total > 0 && (
                    <span className={cn(
                      'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
                      s.breached > 0 ? 'bg-red-100 text-red-700' : 'bg-white text-gray-600'
                    )}>
                      {s.total}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="escalated" className="text-sm gap-1">
              <Siren className="h-3.5 w-3.5" />
              Escalated
              {(summary?.totalBreached ?? 0) > 0 && (
                <span className="ml-0.5 text-xs rounded-full px-1.5 py-0.5 font-medium bg-red-100 text-red-700">
                  {summary!.totalBreached}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Disputes ─────────────────────────────────────────────────── */}
          <TabsContent value="disputes" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white dark:bg-white/50">
                      <TableHead className="w-10 pl-3">
                        <Checkbox
                          checked={filteredDisputes.length > 0 && filteredDisputes.every(c => selected.has(c.caseId))}
                          onCheckedChange={() => toggleAll(filteredDisputes)}
                        />
                      </TableHead>
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Assigned</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputesQ.isLoading ? <SkeletonRows cols={11} /> :
                     filteredDisputes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11}>
                          {caseFilter !== 'all'
                            ? <div className="text-center py-12 text-gray-400 text-sm">
                                {caseFilter === 'mine' ? 'No cases assigned to you' : 'No cases assigned to your team'}
                              </div>
                            : <EmptyQueue label="dispute" />}
                        </TableCell>
                      </TableRow>
                    ) : filteredDisputes.flatMap(c => [
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                          selected.has(c.caseId)    && 'bg-blue-50/60 dark:bg-blue-950/20',
                        )}
                      >
                        <TableCell className="py-3 pl-3">
                          <Checkbox
                            checked={selected.has(c.caseId)}
                            onCheckedChange={() => toggleRow(c.caseId)}
                          />
                        </TableCell>
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 text-sm font-medium capitalize max-w-[120px] truncate">
                          {c.reason.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {c.bookingNumber}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {c.stationName || '—'}
                          {c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.total)}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {ageLabel(c.ageHours)}
                        </TableCell>
                        <TableCell className="py-3">
                          <SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} />
                        </TableCell>
                        <AssignedCell c={c} />
                        <TableCell className="py-3 space-y-0.5">
                          <Badge className={cn(
                            'border-0 text-xs capitalize',
                            c.status === 'open'         ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            c.status === 'under_review' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                            'bg-white text-gray-600'
                          )}>
                            {c.status.replace(/_/g, ' ')}
                          </Badge>
                          {c.closureRequested && !c.closureApproved && (
                            <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs block w-fit">
                              ⏳ Closure pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Link
                            href={`/booking-trace/${c.bookingId}`}
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs"
                            onClick={e => e.stopPropagation()}
                          >
                            View <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </TableCell>
                      </TableRow>,
                      renderRowExtras(c),
                    ])}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Mismatches ───────────────────────────────────────────────── */}
          <TabsContent value="mismatches" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white dark:bg-white/50">
                      <TableHead className="w-10 pl-3">
                        <Checkbox
                          checked={filteredMismatches.length > 0 && filteredMismatches.every(c => selected.has(c.caseId))}
                          onCheckedChange={() => toggleAll(filteredMismatches)}
                        />
                      </TableHead>
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Mismatch Δ</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Assigned</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mismatchQ.isLoading ? <SkeletonRows cols={10} /> :
                     filteredMismatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10}>
                          {caseFilter !== 'all'
                            ? <div className="text-center py-12 text-gray-400 text-sm">
                                {caseFilter === 'mine' ? 'No cases assigned to you' : 'No cases assigned to your team'}
                              </div>
                            : <EmptyQueue label="mismatch" />}
                        </TableCell>
                      </TableRow>
                    ) : filteredMismatches.flatMap(c => [
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                          selected.has(c.caseId)    && 'bg-blue-50/60 dark:bg-blue-950/20',
                        )}
                      >
                        <TableCell className="py-3 pl-3">
                          <Checkbox
                            checked={selected.has(c.caseId)}
                            onCheckedChange={() => toggleRow(c.caseId)}
                          />
                        </TableCell>
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {c.bookingNumber}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {c.stationName || '—'}
                          {c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.totalAmount)}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                          {fmt(c.mismatchILS)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {ageLabel(c.ageHours)}
                        </TableCell>
                        <TableCell className="py-3">
                          <SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} />
                        </TableCell>
                        <AssignedCell c={c} />
                        <TableCell className="py-3">
                          <Link
                            href={`/booking-trace/${c.bookingId}`}
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs"
                            onClick={e => e.stopPropagation()}
                          >
                            View <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </TableCell>
                      </TableRow>,
                      renderRowExtras(c),
                    ])}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Refunds ──────────────────────────────────────────────────── */}
          <TabsContent value="refunds" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white dark:bg-white/50">
                      <TableHead className="w-10 pl-3">
                        <Checkbox
                          checked={filteredRefunds.length > 0 && filteredRefunds.every(c => selected.has(c.caseId))}
                          onCheckedChange={() => toggleAll(filteredRefunds)}
                        />
                      </TableHead>
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Refund Amt</TableHead>
                      <TableHead className="text-xs text-right">Booking Total</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Assigned</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundsQ.isLoading ? <SkeletonRows cols={12} /> :
                     filteredRefunds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12}>
                          {caseFilter !== 'all'
                            ? <div className="text-center py-12 text-gray-400 text-sm">
                                {caseFilter === 'mine' ? 'No cases assigned to you' : 'No cases assigned to your team'}
                              </div>
                            : <EmptyQueue label="refund" />}
                        </TableCell>
                      </TableRow>
                    ) : filteredRefunds.flatMap(c => [
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                          selected.has(c.caseId)    && 'bg-blue-50/60 dark:bg-blue-950/20',
                        )}
                      >
                        <TableCell className="py-3 pl-3">
                          <Checkbox
                            checked={selected.has(c.caseId)}
                            onCheckedChange={() => toggleRow(c.caseId)}
                          />
                        </TableCell>
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {c.bookingNumber}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {c.stationName || '—'}
                          {c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.refundAmount)}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.total)}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-500 max-w-[120px] truncate">
                          {c.refundReason || '—'}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {ageLabel(c.ageHours)}
                        </TableCell>
                        <TableCell className="py-3">
                          <SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} />
                        </TableCell>
                        <AssignedCell c={c} />
                        <TableCell className="py-3">
                          <Badge className={cn(
                            'border-0 text-xs capitalize',
                            c.refundStatus === 'pending'    ? 'bg-yellow-100 text-yellow-700' :
                            c.refundStatus === 'processing' ? 'bg-orange-100 text-orange-700' :
                            'bg-white text-gray-600'
                          )}>
                            {c.refundStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <Link
                            href={`/booking-trace/${c.bookingId}`}
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs"
                            onClick={e => e.stopPropagation()}
                          >
                            View <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </TableCell>
                      </TableRow>,
                      renderRowExtras(c),
                    ])}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Escalated ────────────────────────────────────────────────── */}
          <TabsContent value="escalated" className="mt-3">
            <EscalatedTab cases={escalatedQ.data?.cases ?? []} isLoading={escalatedQ.isLoading} currentUid={currentUid} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selected={selected}
        casesByKey={casesByKey}
        onClear={() => setSelected(new Set())}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['/api/case-queue/summary'] })}
        currentUid={currentUid}
        activeTab={activeTab}
      />
    </div>
  );
}
