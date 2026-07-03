/**
 * HostStayJourney — the client UI for the Host Stay care journey.
 *
 * The server (server/routes/booking-requests.ts) and the T-48h/24h/day-of
 * reminder cron already exist, but NOTHING in the client called them — owners
 * were being nagged to "complete care details" they had no screen to enter.
 * This component closes that gap. It is party-aware (owner vs provider) using
 * the role the GET endpoint returns, and matches the server contracts exactly:
 *   GET  /api/booking-requests/:id/care-details  -> {role,status,details,handovers,checklist}
 *   POST /api/booking-requests/:id/care-details        (owner)   care pack
 *   POST /api/booking-requests/:id/provider-readiness  (provider){readiness,homeReady}
 *   POST /api/booking-requests/:id/handover            (either)  {direction,notes?}
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface HostStayResponse {
  ok: boolean;
  requestId: string;
  role: 'owner' | 'provider' | null;
  status: string;
  details: Record<string, any> | null;
  handovers: Array<{ direction: string; confirmedByRole: string; occurredAt?: string }>;
  checklist: { items: Array<{ key: string; label: string; required: boolean; present: boolean }>; missing: string[]; ready: boolean; overnight: boolean } | null;
}

const he = typeof window !== 'undefined' && window.localStorage?.getItem('pw_lang') === 'he';
const t = (en: string, hebrew: string) => (he ? hebrew : en);

// Owner care-pack fields (match careDetailsSchema on the server).
const CARE_FIELDS: Array<{ key: string; label: string; type: 'text' | 'tel' | 'datetime-local' | 'textarea' }> = [
  { key: 'pickupAt', label: t('Drop-off date & time', 'תאריך ושעת מסירה'), type: 'datetime-local' },
  { key: 'dropoffAt', label: t('Pick-up date & time', 'תאריך ושעת איסוף'), type: 'datetime-local' },
  { key: 'meetingLocation', label: t('Meeting location', 'מקום מפגש'), type: 'text' },
  { key: 'emergencyContactName', label: t('Emergency contact name', 'איש קשר לחירום'), type: 'text' },
  { key: 'emergencyContactPhone', label: t('Emergency contact phone', 'טלפון לחירום'), type: 'tel' },
  { key: 'vetName', label: t('Vet name', 'שם וטרינר'), type: 'text' },
  { key: 'vetPhone', label: t('Vet phone', 'טלפון וטרינר'), type: 'tel' },
  { key: 'foodInstructions', label: t('Food & feeding instructions', 'הוראות האכלה'), type: 'textarea' },
  { key: 'medication', label: t('Medication', 'תרופות'), type: 'textarea' },
  { key: 'medicationDosage', label: t('Medication dosage', 'מינון תרופות'), type: 'text' },
  { key: 'allergies', label: t('Allergies', 'אלרגיות'), type: 'text' },
  { key: 'behaviourNotes', label: t('Behaviour notes', 'הערות התנהגות'), type: 'textarea' },
  { key: 'specialInstructions', label: t('Special instructions', 'הוראות מיוחדות'), type: 'textarea' },
];

// Convert a stored ISO/date into the value a datetime-local input expects.
const toLocalInput = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function HostStayJourney({ requestId }: { requestId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = [`/api/booking-requests/${requestId}/care-details`];
  const { data, isLoading } = useQuery<HostStayResponse>({ queryKey: key });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data?.details) {
      const seed: Record<string, string> = {};
      for (const f of CARE_FIELDS) {
        const raw = data.details[f.key];
        seed[f.key] = f.type === 'datetime-local' ? toLocalInput(raw) : (raw ?? '');
      }
      setForm(seed);
    }
  }, [data?.details]);

  const saveCare = useMutation({
    mutationFn: () => apiRequest('POST', key[0], form),
    onSuccess: () => { toast({ title: t('Care details saved', 'פרטי הטיפול נשמרו') }); qc.invalidateQueries({ queryKey: key }); },
    onError: () => toast({ title: t('Could not save', 'לא ניתן לשמור'), variant: 'destructive' }),
  });

  const readiness = useMutation({
    mutationFn: () => apiRequest('POST', `/api/booking-requests/${requestId}/provider-readiness`, { homeReady: true, readiness: { confirmedAt: new Date().toISOString() } }),
    onSuccess: () => { toast({ title: t('Marked home-ready', 'סומן: מוכן לאירוח') }); qc.invalidateQueries({ queryKey: key }); },
    onError: () => toast({ title: t('Could not update', 'לא ניתן לעדכן'), variant: 'destructive' }),
  });

  const handover = useMutation({
    mutationFn: (direction: 'DROPOFF' | 'PICKUP') => apiRequest('POST', `/api/booking-requests/${requestId}/handover`, { direction }),
    onSuccess: () => { toast({ title: t('Handover confirmed', 'מסירה אושרה') }); qc.invalidateQueries({ queryKey: key }); },
    onError: () => toast({ title: t('Could not confirm', 'לא ניתן לאשר'), variant: 'destructive' }),
  });

  if (isLoading) return <div style={{ padding: 24, textAlign: 'center', color: '#9E9E9E' }}>{t('Loading…', 'טוען…')}</div>;
  if (!data || !data.role) return <div style={{ padding: 24, textAlign: 'center', color: '#9E9E9E' }}>{t('Not available for this booking.', 'לא זמין להזמנה זו.')}</div>;

  const isOwner = data.role === 'owner';
  const isProvider = data.role === 'provider';
  const gold = '#D9B84C';
  const has = (dir: string) => (data.handovers || []).some((h) => h.direction === dir);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(217,184,76,0.3)',
    fontSize: '0.9rem', background: '#fff', direction: he ? 'rtl' : 'ltr',
  };

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 16, direction: he ? 'rtl' : 'ltr', textAlign: he ? 'right' : 'left' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1A1A1A', margin: '0 0 4px' }}>
        {t('Host Stay — Care Journey', 'אירוח — מסע הטיפול')}
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#9E9E9E', margin: '0 0 16px' }}>
        {t('Everything your provider needs to care for your pet, in one place.', 'כל מה שהמארח צריך כדי לטפל בחיה שלך, במקום אחד.')}
      </p>

      {/* Checklist status */}
      {data.checklist && (
        <div style={{ background: data.checklist.ready ? 'rgba(34,197,94,0.08)' : 'rgba(217,184,76,0.08)', border: `1px solid ${data.checklist.ready ? 'rgba(34,197,94,0.4)' : 'rgba(217,184,76,0.35)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1A1A1A' }}>
            {data.checklist.ready ? t('✓ Care details complete', '✓ פרטי הטיפול הושלמו') : t('Care details still needed', 'עדיין נדרשים פרטי טיפול')}
          </p>
          {!data.checklist.ready && (
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#7A7068' }}>
              {t('Still needed:', 'עדיין חסר:')}{' '}
              {data.checklist.items.filter((i) => i.required && !i.present).map((i) => i.label).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* OWNER — care pack form */}
      {isOwner && (
        <form onSubmit={(e) => { e.preventDefault(); saveCare.mutate(); }} style={{ display: 'grid', gap: 12 }}>
          {CARE_FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7A7068', marginBottom: 4 }}>{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea rows={2} value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
              ) : (
                <input type={f.type} value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} style={inputStyle} />
              )}
            </label>
          ))}
          <button type="submit" disabled={saveCare.isPending} style={{ padding: '13px', borderRadius: 12, border: 'none', background: gold, color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: saveCare.isPending ? 'wait' : 'pointer' }}>
            {saveCare.isPending ? t('Saving…', 'שומר…') : t('Save care details', 'שמור פרטי טיפול')}
          </button>
        </form>
      )}

      {/* PROVIDER — readiness (address-reveal only after accept) */}
      {isProvider && (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.details ? (
            <div style={{ background: '#fff', border: '1px solid rgba(217,184,76,0.2)', borderRadius: 12, padding: 14 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem' }}>{t('Care pack from the owner', 'ערכת הטיפול מהבעלים')}</p>
              {CARE_FIELDS.filter((f) => data.details?.[f.key]).map((f) => (
                <p key={f.key} style={{ margin: '4px 0', fontSize: '0.82rem', color: '#4A4A4A' }}><b>{f.label}:</b> {String(data.details?.[f.key])}</p>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.82rem', color: '#9E9E9E' }}>{t('The care pack becomes visible once the booking is confirmed.', 'ערכת הטיפול תוצג לאחר אישור ההזמנה.')}</p>
          )}
          <button onClick={() => readiness.mutate()} disabled={readiness.isPending} style={{ padding: '13px', borderRadius: 12, border: `1.5px solid ${gold}`, background: '#fff', color: '#B8860B', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
            {t('Confirm my home is ready', 'אשר שהבית מוכן')}
          </button>
        </div>
      )}

      {/* HANDOVER — either party confirms drop-off (start) and pick-up (end) */}
      <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1A1A1A' }}>{t('Handover', 'מסירה')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => handover.mutate('DROPOFF')} disabled={handover.isPending || has('DROPOFF')} style={{ flex: 1, minWidth: 140, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(217,184,76,0.3)', background: has('DROPOFF') ? 'rgba(34,197,94,0.1)' : '#fff', color: has('DROPOFF') ? '#166534' : '#B8860B', fontWeight: 700, fontSize: '0.85rem', cursor: has('DROPOFF') ? 'default' : 'pointer' }}>
            {has('DROPOFF') ? t('✓ Drop-off confirmed', '✓ מסירה אושרה') : t('Confirm drop-off', 'אשר מסירה')}
          </button>
          <button onClick={() => handover.mutate('PICKUP')} disabled={handover.isPending || has('PICKUP')} style={{ flex: 1, minWidth: 140, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(217,184,76,0.3)', background: has('PICKUP') ? 'rgba(34,197,94,0.1)' : '#fff', color: has('PICKUP') ? '#166534' : '#B8860B', fontWeight: 700, fontSize: '0.85rem', cursor: has('PICKUP') ? 'default' : 'pointer' }}>
            {has('PICKUP') ? t('✓ Pick-up confirmed', '✓ איסוף אושר') : t('Confirm pick-up', 'אשר איסוף')}
          </button>
        </div>
      </div>
    </div>
  );
}
