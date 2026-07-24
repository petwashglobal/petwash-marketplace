/**
 * צוות ו־HR (Staff / HR) — admin roster CRUD.
 *
 * CEO 2026-07-24 ("hr staff"). Greenfield module on the staff table. All
 * Hebrew, canon white/black/gold. Add / edit inline / deactivate. Real data
 * from /api/admin/staff — no fakes; an empty roster invites the first record.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowRight, Plus, Save, UserX, Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const GOLD = '#D4AF37';
const INK = '#0a0a0a';

const ROLE_HE: Record<string, string> = {
  attendant: 'סדרן/ית', technician: 'טכנאי/ת', manager: 'מנהל/ת', support: 'תמיכה', ops: 'תפעול', other: 'אחר',
};
const EMP_HE: Record<string, string> = { full_time: 'משרה מלאה', part_time: 'חלקית', contractor: 'קבלן/ית' };
const STATUS_HE: Record<string, string> = { active: 'פעיל/ה', on_leave: 'בחופשה', inactive: 'לא פעיל/ה' };
const STATION_HE: Record<string, string> = { 'PWS-IL-KFS-001': 'פארק ולד', 'PWS-IL-KFS-002': 'כפר סבא הירוקה' };

interface Staff {
  id: string; full_name: string; role: string; station_code: string | null; phone: string | null;
  email: string | null; employment: string; pay_type: string; pay_rate_ils: number; status: string;
  hired_at: string | null; notes: string | null;
}

const EMPTY = { fullName: '', role: 'attendant', stationCode: '', phone: '', email: '', employment: 'part_time', payType: 'hourly', payRateIls: 0, status: 'active', hiredAt: '' };

export default function AdminStaff() {
  const [, go] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({ ...EMPTY });
  const [edits, setEdits] = useState<Record<string, Partial<Staff>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/staff');
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{ staff: Staff[]; summary: { active: number; onLeave: number; total: number } }>;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/staff', draft);
      if (!res.ok) throw new Error('create');
      return res.json();
    },
    onSuccess: () => { setCreating(false); setDraft({ ...EMPTY }); qc.invalidateQueries({ queryKey: ['admin-staff'] }); toast({ title: 'נוסף לצוות ✓' }); },
    onError: () => toast({ title: 'הוספה נכשלה', variant: 'destructive' }),
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/staff/${id}`, patch);
      if (!res.ok) throw new Error('patch');
      return res.json();
    },
    onSuccess: (_d, { id }) => { setEdits((e) => { const n = { ...e }; delete n[id]; return n; }); qc.invalidateQueries({ queryKey: ['admin-staff'] }); toast({ title: 'נשמר ✓' }); },
    onError: () => toast({ title: 'שמירה נכשלה', variant: 'destructive' }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest('DELETE', `/api/admin/staff/${id}`); if (!res.ok) throw new Error('del'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff'] }); toast({ title: 'הועבר ללא-פעיל ✓' }); },
    onError: () => toast({ title: 'פעולה נכשלה', variant: 'destructive' }),
  });

  const setField = (id: string, f: keyof Staff, v: any) => setEdits((e) => ({ ...e, [id]: { ...e[id], [f]: v } }));

  const money = (s: Staff) => `₪${s.pay_rate_ils.toLocaleString('he-IL')}${s.pay_type === 'hourly' ? '/שעה' : '/חודש'}`;

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#FAFAF7]" data-testid="admin-staff">
      <div className="border-b bg-white" style={{ borderColor: '#EDE6D2' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => go('/admin/octopus')} className="text-neutral-500"><ArrowRight className="h-5 w-5" /></button>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: GOLD }} />
              <h1 className="text-xl font-extrabold" style={{ color: INK }}>צוות ו־HR</h1>
            </div>
            {data?.summary && <span className="text-xs text-neutral-500">{data.summary.active} פעילים · {data.summary.total} סה״כ</span>}
          </div>
          <button type="button" onClick={() => setCreating((c) => !c)} className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: INK }} data-testid="staff-new">
            <Plus className="h-4 w-4" /> עובד/ת חדש/ה
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {creating && (
          <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3" style={{ borderColor: `${GOLD}66` }} data-testid="staff-create-form">
            <Field label="שם מלא"><input className="fld" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} /></Field>
            <Field label="תפקיד"><select className="fld" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>{Object.entries(ROLE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="עמדה"><select className="fld" value={draft.stationCode} onChange={(e) => setDraft({ ...draft, stationCode: e.target.value })}><option value="">— מטה —</option>{Object.entries(STATION_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="טלפון"><input className="fld" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
            <Field label="אימייל"><input className="fld" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            <Field label="העסקה"><select className="fld" value={draft.employment} onChange={(e) => setDraft({ ...draft, employment: e.target.value })}>{Object.entries(EMP_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="סוג שכר"><select className="fld" value={draft.payType} onChange={(e) => setDraft({ ...draft, payType: e.target.value })}><option value="hourly">שעתי</option><option value="monthly">חודשי</option></select></Field>
            <Field label="שכר (₪)"><input type="number" className="fld" value={draft.payRateIls} onChange={(e) => setDraft({ ...draft, payRateIls: Number(e.target.value) })} /></Field>
            <Field label="תאריך תחילה"><input type="date" className="fld" value={draft.hiredAt} onChange={(e) => setDraft({ ...draft, hiredAt: e.target.value })} /></Field>
            <div className="col-span-2 sm:col-span-3">
              <button type="button" onClick={() => createMut.mutate()} disabled={createMut.isPending || !draft.fullName} className="flex items-center gap-1 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: GOLD, color: INK }}>
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} שמירה
              </button>
            </div>
          </div>
        )}

        {isLoading && <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />}
        {data?.staff && data.staff.length === 0 && !creating && (
          <div className="rounded-3xl border bg-white p-10 text-center" style={{ borderColor: '#EDE6D2' }}>
            <Users className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-500">עדיין אין עובדים במערכת. הוסיפו את הראשון עם «עובד/ת חדש/ה».</p>
          </div>
        )}

        <div className="space-y-2">
          {(data?.staff ?? []).map((s) => {
            const e = edits[s.id] ?? {};
            const dirty = Object.keys(e).length > 0;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3" style={{ borderColor: s.status === 'active' ? `${GOLD}55` : '#E5E5E5' }} data-testid={`staff-row-${s.id}`}>
                <input className="min-w-[9rem] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm font-semibold" value={(e.full_name ?? s.full_name) || ''} onChange={(ev) => setField(s.id, 'full_name', ev.target.value)} />
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-neutral-600">{ROLE_HE[s.role] || s.role}</span>
                <span className="text-xs text-neutral-500">{s.station_code ? STATION_HE[s.station_code] || s.station_code : 'מטה'}</span>
                <span className="text-xs text-neutral-500" dir="ltr">{s.phone || '—'}</span>
                <span className="text-xs font-semibold" style={{ color: INK }}>{money(s)}</span>
                <select className="rounded-lg border border-neutral-200 px-2 py-1 text-xs" value={(e.status ?? s.status) as string} onChange={(ev) => setField(s.id, 'status', ev.target.value)}>
                  {Object.entries(STATUS_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" disabled={!dirty || patchMut.isPending} onClick={() => patchMut.mutate({ id: s.id, patch: e })} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-30" style={{ background: dirty ? GOLD : '#eee', color: INK }} data-testid={`staff-save-${s.id}`}>
                  <Save className="h-3.5 w-3.5" /> שמור
                </button>
                <button type="button" onClick={() => { if (window.confirm(`להעביר את «${s.full_name}» ללא-פעיל?`)) delMut.mutate(s.id); }} className="rounded-lg border border-red-200 p-1.5 text-red-500" data-testid={`staff-deactivate-${s.id}`}>
                  <UserX className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`.fld{width:100%;margin-top:4px;border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;font-size:14px}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-neutral-600">{label}{children}</label>;
}
