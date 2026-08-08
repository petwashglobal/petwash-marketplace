/**
 * PetCareProfile — private, owner-only care profile for a single pet (Phase 1).
 *
 * Edits the SAME Firestore pet doc as the passport (PATCH /api/pets/:petId),
 * reusing the existing care fields (allergies, preferredShampoo, vetName,
 * vetPhone, behaviourNotes, feedingInstructions, etc.). This data is PRIVATE —
 * it is never public and never used for marketing. It is shared with a service
 * provider only when the owner separately opts in.
 *
 * Routed at /pets/:petId/care. Luxury gold-on-dark tokens, RTL-safe, bilingual.
 */
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Lock, Save, ShieldAlert } from 'lucide-react';
import { PetWashIcon } from '@/components/PetWashIcon';

interface Pet {
  id: string;
  name?: string;
  allergies?: string;
  sensitiveSkin?: boolean;
  preferredShampoo?: string;
  vetName?: string;
  vetPhone?: string;
  behaviourNotes?: string;
  aggressionWarning?: boolean;
  escapeRisk?: boolean;
  feedingInstructions?: string;
  handlingInstructions?: string;
}

// Hoisted to MODULE scope (2026-08-08). Previously these were declared INSIDE the
// component, so every keystroke → set() → re-render created new component identities →
// React unmounted/remounted the <input>/<textarea> → focus dropped after one character,
// making the whole care-profile form unfillable. They are pure (props only), so hoisting
// is safe and fixes the focus loss with no behavioural change.
const Field = ({ label, value, onChange, placeholder, textarea }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) => (
  <div>
    <label className="block text-xs uppercase tracking-wider text-amber-300/70 mb-1.5">{label}</label>
    {textarea ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="auto"
        rows={3}
        className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-amber-300/50 focus:outline-none resize-none"
      />
    ) : (
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="auto"
        className="w-full rounded-xl bg-white/[0.04] border border-amber-300/15 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-amber-300/50 focus:outline-none"
      />
    )}
  </div>
);

const Toggle = ({ label, hint, value, onChange, danger }: {
  label: string; hint?: string; value?: boolean; onChange: (v: boolean) => void; danger?: boolean;
}) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-start transition-colors ${
      value ? (danger ? 'bg-red-500/10 border-red-400/40' : 'bg-amber-300/10 border-amber-300/40') : 'bg-white/[0.03] border-white/10'
    }`}
  >
    <span>
      <span className="block text-sm text-white">{label}</span>
      {hint && <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>}
    </span>
    <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${value ? (danger ? 'bg-red-500' : 'bg-amber-400') : 'bg-gray-600'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? 'start-[22px]' : 'start-0.5'}`} />
    </span>
  </button>
);

export default function PetCareProfile() {
  const { petId } = useParams<{ petId: string }>();
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pet, isLoading, isError } = useQuery<Pet>({
    queryKey: [`/api/pets/${petId}`],
    enabled: !!petId,
  });

  const [form, setForm] = useState<Pet>({ id: petId || '' });
  useEffect(() => {
    if (pet) {
      setForm({
        id: pet.id,
        allergies: pet.allergies || '',
        sensitiveSkin: !!pet.sensitiveSkin,
        preferredShampoo: pet.preferredShampoo || '',
        vetName: pet.vetName || '',
        vetPhone: pet.vetPhone || '',
        behaviourNotes: pet.behaviourNotes || '',
        aggressionWarning: !!pet.aggressionWarning,
        escapeRisk: !!pet.escapeRisk,
        feedingInstructions: pet.feedingInstructions || '',
        handlingInstructions: pet.handlingInstructions || '',
      });
    }
  }, [pet]);

  const save = useMutation({
    mutationFn: async () => {
      const { id, ...payload } = form;
      const res = await apiRequest(`/api/pets/${petId}`, 'PATCH', payload);
      if (!res.ok) throw new Error('save_failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pets/${petId}`] });
      toast({ title: tr('Saved', 'נשמר'), description: tr('Care profile updated.', 'פרופיל הטיפוח עודכן.') });
    },
    onError: () =>
      toast({ title: tr('Could not save', 'שמירה נכשלה'), variant: 'destructive' }),
  });

  const set = (k: keyof Pet, v: any) => setForm((p) => ({ ...p, [k]: v }));

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </Layout>
    );
  }
  if (isError) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 luxury-bg-mesh">
          <div className="mb-6"><PetWashIcon name="brand_paw" size={56} label={tr('Pet not found', 'חיית המחמד לא נמצאה')} /></div>
          <h2 className="text-2xl font-light text-white mb-4">{tr('Pet not found', 'חיית המחמד לא נמצאה')}</h2>
          <button onClick={() => navigate('/my-account')} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-neutral-950 font-medium">
            {tr('Back to my account', 'חזרה לחשבון שלי')}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-8 px-4" dir={he ? 'rtl' : 'ltr'}>
        <div className="max-w-md mx-auto">
          <button onClick={() => navigate('/my-account')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 text-sm">
            <ArrowLeft className={`w-4 h-4 ${he ? 'scale-x-[-1]' : ''}`} />
            {tr('Back', 'חזרה')}
          </button>

          <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-500 shadow-2xl">
            <div className="rounded-3xl bg-gradient-to-b from-neutral-900 to-black px-6 py-6 space-y-5">
              <div className="flex items-center gap-2 text-amber-300/80">
                <Lock className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                  {tr('Private care profile', 'פרופיל טיפוח פרטי')}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-white">
                {pet?.name ? tr(`${pet.name}’s care profile`, `פרופיל הטיפוח של ${pet.name}`) : tr('Care profile', 'פרופיל טיפוח')}
              </h1>
              <p className="text-[11px] text-gray-400 leading-relaxed -mt-2">
                {tr(
                  'Private to you. Never shared for marketing. Shared with a service provider only if you choose to.',
                  'פרטי לך בלבד. לעולם לא משותף לשיווק. משותף עם נותן שירות רק אם תבחר/י בכך.',
                )}
              </p>

              <Field label={tr('Allergies', 'אלרגיות')} value={form.allergies} onChange={(v) => set('allergies', v)} placeholder={tr('e.g. sensitive to fragrance', 'למשל: רגישות לבושם')} textarea />
              <Toggle label={tr('Sensitive skin', 'עור רגיש')} hint={tr('Use gentler wash settings', 'שימוש בהגדרות רחצה עדינות')} value={form.sensitiveSkin} onChange={(v) => set('sensitiveSkin', v)} />
              <Field label={tr('Preferred shampoo', 'שמפו מועדף')} value={form.preferredShampoo} onChange={(v) => set('preferredShampoo', v)} />

              <Field label={tr('Vet name', 'שם וטרינר')} value={form.vetName} onChange={(v) => set('vetName', v)} />
              <Field label={tr('Vet phone', 'טלפון וטרינר')} value={form.vetPhone} onChange={(v) => set('vetPhone', v)} />

              <Field label={tr('Feeding instructions', 'הוראות האכלה')} value={form.feedingInstructions} onChange={(v) => set('feedingInstructions', v)} textarea />
              <Field label={tr('Handling instructions', 'הוראות טיפול')} value={form.handlingInstructions} onChange={(v) => set('handlingInstructions', v)} textarea />
              <Field label={tr('Behaviour notes', 'הערות התנהגות')} value={form.behaviourNotes} onChange={(v) => set('behaviourNotes', v)} textarea />

              {/* Safety flags */}
              <div className="flex items-center gap-2 pt-1">
                <ShieldAlert className="w-4 h-4 text-amber-300/70" />
                <span className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold">{tr('Safety', 'בטיחות')}</span>
              </div>
              <Toggle label={tr('Aggression warning', 'אזהרת תוקפנות')} hint={tr('Owner-declared — helps handlers stay safe', 'הצהרת בעלים — מסייע לצוות לשמור על בטיחות')} value={form.aggressionWarning} onChange={(v) => set('aggressionWarning', v)} danger />
              <Toggle label={tr('Escape risk', 'סיכון בריחה')} hint={tr('Owner-declared — extra care with doors/leads', 'הצהרת בעלים — זהירות יתרה עם דלתות ורצועות')} value={form.escapeRisk} onChange={(v) => set('escapeRisk', v)} danger />

              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-neutral-950 font-semibold py-3 disabled:opacity-60"
              >
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {tr('Save care profile', 'שמירת פרופיל טיפוח')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
