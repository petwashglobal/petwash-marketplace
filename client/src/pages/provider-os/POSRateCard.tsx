import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

/**
 * Rate card — the screen that makes an approved provider BOOKABLE.
 *
 * Approval seeds the platform profile at ₪0 / unavailable (see
 * server/services/providerProfileSeed.ts); until 2026-09-12 there was no
 * screen anywhere to set a rate, so no approved provider ever appeared in
 * search. Whole shekels; the server stores cents / decimals.
 */
type Platforms = {
  walk_my_pet: { hourlyIls: number; available: boolean } | null;
  sitter_suite: { dayIls: number; hourIls: number | null; available: boolean } | null;
  academy: { hourlyIls: number; available: boolean } | null;
};

export default function POSRateCard() {
  const { language } = useLanguage();
  const he = language === 'he';
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ ok: boolean; platforms: Platforms }>({
    queryKey: ['/api/provider-os/rate-card'],
    queryFn: async () => (await apiRequest('GET', '/api/provider-os/rate-card')).json(),
  });

  const [walker, setWalker] = useState<number>(0);
  const [sitterDay, setSitterDay] = useState<number>(0);
  const [sitterHour, setSitterHour] = useState<number>(0);
  const [trainer, setTrainer] = useState<number>(0);
  const [available, setAvailable] = useState<boolean>(true);

  useEffect(() => {
    const p = data?.platforms;
    if (!p) return;
    if (p.walk_my_pet) setWalker(p.walk_my_pet.hourlyIls);
    if (p.sitter_suite) { setSitterDay(p.sitter_suite.dayIls); setSitterHour(p.sitter_suite.hourIls ?? 0); }
    if (p.academy) setTrainer(p.academy.hourlyIls);
    const anyLive = !!(p.walk_my_pet?.available || p.sitter_suite?.available || p.academy?.available);
    const anyRate = !!((p.walk_my_pet?.hourlyIls || 0) + (p.sitter_suite?.dayIls || 0) + (p.academy?.hourlyIls || 0));
    setAvailable(anyRate ? anyLive : true);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { available };
      if (data?.platforms.walk_my_pet) body.walkerHourlyIls = walker;
      if (data?.platforms.sitter_suite) { body.sitterDayIls = sitterDay; body.sitterHourIls = sitterHour; }
      if (data?.platforms.academy) body.trainerHourlyIls = trainer;
      const r = await apiRequest('PUT', '/api/provider-os/rate-card', body);
      return r.json();
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['/api/provider-os/rate-card'] });
      toast({ title: he ? 'המחירון נשמר' : 'Rate card saved', description: he ? (available ? 'הפרופיל שלך זמין להזמנות.' : 'הפרופיל שלך מוסתר מחיפוש.') : (available ? 'Your profile is bookable.' : 'Your profile is hidden from search.') });
      if (Array.isArray(r?.applied) && r.applied.length === 0) {
        toast({ variant: 'destructive', title: he ? 'לא נמצא פרופיל ספק' : 'No provider profile found', description: he ? 'האישור שלך עדיין לא יצר פרופיל. פנו לתמיכה.' : 'Your approval has not created a profile yet. Contact support.' });
      }
    },
    onError: () => toast({ variant: 'destructive', title: he ? 'השמירה נכשלה' : 'Save failed' }),
  });

  if (isLoading) return <div className="p-6 text-gray-500">{he ? 'טוען…' : 'Loading…'}</div>;
  const p = data?.platforms;
  const none = !p || (!p.walk_my_pet && !p.sitter_suite && !p.academy);

  const field = (label: string, value: number, set: (n: number) => void, testid: string, unit: string) => (
    <label className="block">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-gray-500">₪</span>
        <input type="number" min={0} step={1} value={value} onChange={(e) => set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40" dir="ltr" data-testid={testid} />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </label>
  );

  return (
    <div className="max-w-xl" dir={he ? 'rtl' : 'ltr'} data-testid="pos-rate-card">
      <h2 className="text-xl font-semibold text-gray-900">{he ? 'מחירון וזמינות' : 'Rate card & availability'}</h2>
      <p className="text-sm text-gray-500 mt-1">
        {he ? 'לקוחות רואים אותך בחיפוש רק כשיש מחיר והפרופיל זמין.' : 'Customers see you in search only when a rate is set and the profile is available.'}
      </p>

      {none ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="pos-rate-card-none">
          {he ? 'עדיין אין פרופיל ספק מאושר לחשבון הזה. לאחר אישור הבקשה המחירון יופיע כאן.' : 'No approved provider profile on this account yet. Once your application is approved, the rate card appears here.'}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {p!.walk_my_pet && (
            <section className="rounded-2xl border border-gray-100 p-4" data-testid="pos-rate-card-walker">
              <h3 className="font-medium text-gray-900">Walk My Pet</h3>
              <div className="mt-3">{field(he ? 'מחיר לשעת הליכה' : 'Price per walk hour', walker, setWalker, 'rate-walker-hourly', he ? 'לשעה' : '/ hour')}</div>
            </section>
          )}
          {p!.sitter_suite && (
            <section className="rounded-2xl border border-gray-100 p-4" data-testid="pos-rate-card-sitter">
              <h3 className="font-medium text-gray-900">Pet Sitter Suite</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(he ? 'מחיר ליום (24 שעות)' : 'Price per day (24h)', sitterDay, setSitterDay, 'rate-sitter-day', he ? 'ליום' : '/ day')}
                {field(he ? 'מחיר לשעה (אופציונלי)' : 'Price per hour (optional)', sitterHour, setSitterHour, 'rate-sitter-hour', he ? 'לשעה' : '/ hour')}
              </div>
            </section>
          )}
          {p!.academy && (
            <section className="rounded-2xl border border-gray-100 p-4" data-testid="pos-rate-card-trainer">
              <h3 className="font-medium text-gray-900">PetWash Academy</h3>
              <div className="mt-3">{field(he ? 'מחיר לשעת אימון' : 'Price per training hour', trainer, setTrainer, 'rate-trainer-hourly', he ? 'לשעה' : '/ hour')}</div>
            </section>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4">
            <div>
              <div className="font-medium text-gray-900">{he ? 'זמין להזמנות' : 'Available for bookings'}</div>
              <div className="text-xs text-gray-500">{he ? 'כבו כדי להיעלם מהחיפוש בלי למחוק את המחירון.' : 'Turn off to disappear from search without deleting your rates.'}</div>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} data-testid="rate-available" />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-full bg-black text-white py-6 text-base" data-testid="rate-save">
            {save.isPending ? (he ? 'שומר…' : 'Saving…') : (he ? 'שמירת מחירון' : 'Save rate card')}
          </Button>
        </div>
      )}
    </div>
  );
}
