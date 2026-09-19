/**
 * Public stations — the list CUSTOMERS see (2026-09-18).
 *
 * /admin/stations is the operations screen and writes Firestore; the station a
 * customer finds on the map, in bookkeeping and on a wallet pass comes from
 * `station_registry` (server/lib/stationRegistry.ts → loadStations). Adding a
 * station there used to mean editing a code array and deploying, so this screen
 * is the door: GET/POST /api/admin/bookkeeping/stations.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Plus, Save, X, ExternalLink } from 'lucide-react';

type Bay = { machineId: string; terminalId?: string; label: string };
type Station = {
  code: string; nameHe: string; nameEn: string; address: string; city: string;
  lat: number; lng: number; hoursHe: string; open: boolean; bays: Bay[];
  accessHe?: string; accessEn?: string;
};

const EMPTY: Station = {
  code: '', nameHe: '', nameEn: '', address: '', city: '',
  lat: 0, lng: 0, hoursHe: '', open: true, bays: [],
};

export default function AdminPublicStations() {
  const { language } = useLanguage();
  const isHe = language === 'he' || language === 'ar';
  const { toast } = useToast();
  const [draft, setDraft] = useState<Station | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ ok: boolean; stations: Station[] }>({
    queryKey: ['/api/admin/bookkeeping/stations'],
    queryFn: async () => (await apiRequest('GET', '/api/admin/bookkeeping/stations')).json(),
  });

  const save = useMutation({
    mutationFn: async (s: Station) => {
      const r = await apiRequest('POST', '/api/admin/bookkeeping/stations', s);
      return r.json();
    },
    onSuccess: (body: any) => {
      if (body?.ok === false) { setError(body?.error || 'Save failed'); return; }
      setDraft(null); setError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookkeeping/stations'] });
      toast({ title: isHe ? 'העמדה נשמרה' : 'Station saved' });
    },
    onError: (e: any) => setError(e?.body?.error || (isHe ? 'השמירה נכשלה' : 'Save failed')),
  });

  const stations = data?.stations ?? [];
  const t = useMemo(() => ({
    title: isHe ? 'עמדות באתר (מה שהלקוחות רואים)' : 'Public stations (what customers see)',
    sub: isHe
      ? 'הרשימה הזו מגיעה ממסד הנתונים. הוספת עמדה כאן מופיעה מיד במפה, בחשבונאות ובכרטיסי הארנק — בלי גרסה חדשה.'
      : 'This list comes from the database. A station added here appears at once on the map, in bookkeeping and on wallet passes — no deploy.',
    ops: isHe ? 'מסך התפעול (Firestore)' : 'Operations screen (Firestore) →',
    add: isHe ? 'הוספת עמדה' : 'Add a station',
    edit: isHe ? 'עריכה' : 'Edit',
    code: isHe ? 'קוד עמדה (PWS-IL-XXX-001)' : 'Station code (PWS-IL-XXX-001)',
    nameHe: isHe ? 'שם בעברית' : 'Hebrew name',
    nameEn: isHe ? 'שם באנגלית' : 'English name',
    address: isHe ? 'כתובת' : 'Address',
    city: isHe ? 'עיר' : 'City',
    coords: isHe ? 'קואורדינטות (מתוך Google Maps)' : 'Coordinates (from Google Maps)',
    hours: isHe ? 'שעות פתיחה' : 'Opening hours',
    accessHe: isHe ? 'הוראות הגעה (עברית)' : 'On-site directions (Hebrew)',
    accessEn: isHe ? 'הוראות הגעה (אנגלית)' : 'On-site directions (English)',
    bays: isHe ? 'תאים — מזהה מכונה Nayax' : 'Bays — Nayax machine id',
    addBay: isHe ? 'הוספת תא' : 'Add a bay',
    open: isHe ? 'פתוחה ללקוחות' : 'Open to customers',
    save: isHe ? 'שמירה' : 'Save',
    cancel: isHe ? 'ביטול' : 'Cancel',
    none: isHe ? 'אין עדיין עמדות' : 'No stations yet',
    loading: isHe ? 'טוען…' : 'Loading…',
    machineNote: isHe
      ? 'מזהה המכונה הוא מה שמחבר הכנסות מהתא לעמדה. אותו מזהה לא יכול להופיע בשתי עמדות.'
      : "The machine id is what links a bay's income to the station. The same id cannot appear on two stations.",
  }), [isHe]);

  useEffect(() => { if (draft) setError(null); }, [draft?.code]);

  const field = (label: string, value: string | number, onChange: (v: string) => void, extra?: { type?: string; placeholder?: string }) => (
    <label className="block mb-3">
      <span className="block text-xs text-gray-600 mb-1">{label}</span>
      <Input value={String(value)} type={extra?.type} placeholder={extra?.placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );

  return (
    <div className="min-h-screen bg-white p-6" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><MapPin className="w-5 h-5" />{t.title}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">{t.sub}</p>
          </div>
          <Link href="/admin/stations" className="text-sm underline text-gray-600 whitespace-nowrap flex items-center gap-1">
            {t.ops}<ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {!draft && (
          <Button onClick={() => setDraft({ ...EMPTY })} className="mb-4" data-testid="button-add-station">
            <Plus className="w-4 h-4 mr-1" />{t.add}
          </Button>
        )}

        {draft && (
          <Card className="mb-6 border-2">
            <CardHeader><CardTitle className="text-base">{draft.code ? `${t.edit} — ${draft.code}` : t.add}</CardTitle></CardHeader>
            <CardContent>
              {field(t.code, draft.code, (v) => setDraft({ ...draft, code: v.toUpperCase() }), { placeholder: 'PWS-IL-TLV-001' })}
              <div className="grid md:grid-cols-2 gap-x-4">
                {field(t.nameHe, draft.nameHe, (v) => setDraft({ ...draft, nameHe: v }))}
                {field(t.nameEn, draft.nameEn, (v) => setDraft({ ...draft, nameEn: v }))}
                {field(t.address, draft.address, (v) => setDraft({ ...draft, address: v }))}
                {field(t.city, draft.city, (v) => setDraft({ ...draft, city: v }))}
                {field(`${t.coords} — lat`, draft.lat, (v) => setDraft({ ...draft, lat: Number(v) }), { type: 'number' })}
                {field(`${t.coords} — lng`, draft.lng, (v) => setDraft({ ...draft, lng: Number(v) }), { type: 'number' })}
                {field(t.hours, draft.hoursHe, (v) => setDraft({ ...draft, hoursHe: v }), { placeholder: 'כל יום 05:30–23:00' })}
                {field(t.accessHe, draft.accessHe ?? '', (v) => setDraft({ ...draft, accessHe: v }))}
                {field(t.accessEn, draft.accessEn ?? '', (v) => setDraft({ ...draft, accessEn: v }))}
              </div>

              <label className="flex items-center gap-2 my-3 text-sm">
                <input type="checkbox" checked={draft.open} onChange={(e) => setDraft({ ...draft, open: e.target.checked })} />
                {t.open}
              </label>

              <div className="mt-4">
                <div className="text-xs text-gray-600 mb-1">{t.bays}</div>
                <p className="text-xs text-gray-500 mb-2">{t.machineNote}</p>
                {draft.bays.map((b, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={b.machineId} placeholder="182443" onChange={(e) => {
                      const bays = [...draft.bays]; bays[i] = { ...b, machineId: e.target.value }; setDraft({ ...draft, bays });
                    }} />
                    <Input value={b.terminalId ?? ''} placeholder="terminal id" onChange={(e) => {
                      const bays = [...draft.bays]; bays[i] = { ...b, terminalId: e.target.value }; setDraft({ ...draft, bays });
                    }} />
                    <Input value={b.label} placeholder={isHe ? 'תא ימין' : 'right bay'} onChange={(e) => {
                      const bays = [...draft.bays]; bays[i] = { ...b, label: e.target.value }; setDraft({ ...draft, bays });
                    }} />
                    <Button variant="outline" onClick={() => setDraft({ ...draft, bays: draft.bays.filter((_, j) => j !== i) })}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, bays: [...draft.bays, { machineId: '', terminalId: '', label: '' }] })}>
                  <Plus className="w-4 h-4 mr-1" />{t.addBay}
                </Button>
              </div>

              {error && <p className="text-sm text-red-600 mt-4" data-testid="text-station-error">{error}</p>}

              <div className="flex gap-2 mt-5">
                <Button
                  onClick={() => save.mutate({ ...draft, bays: draft.bays.filter((b) => b.machineId.trim()) })}
                  disabled={save.isPending}
                  data-testid="button-save-station"
                >
                  <Save className="w-4 h-4 mr-1" />{t.save}
                </Button>
                <Button variant="outline" onClick={() => { setDraft(null); setError(null); }}>{t.cancel}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-500">{t.loading}</p>
        ) : stations.length === 0 ? (
          <p className="text-sm text-gray-500">{t.none}</p>
        ) : (
          <div className="space-y-3">
            {stations.map((s) => (
              <Card key={s.code} data-testid={`card-station-${s.code}`}>
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{isHe ? s.nameHe : s.nameEn} <span className="text-xs text-gray-500">({s.code})</span></div>
                    <div className="text-sm text-gray-600">{s.address}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {s.hoursHe} · {s.lat.toFixed(5)}, {s.lng.toFixed(5)} ·{' '}
                      {s.bays.length > 0
                        ? `${isHe ? 'תאים' : 'bays'}: ${s.bays.map((b) => b.machineId).join(', ')}`
                        : (isHe ? 'אין מזהי תאים' : 'no bay ids')}
                      {!s.open && ` · ${isHe ? 'סגורה' : 'closed'}`}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDraft({ ...s })}>{t.edit}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
