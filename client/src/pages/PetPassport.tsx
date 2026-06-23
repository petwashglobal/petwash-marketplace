/**
 * PetPassport — the Luxury Pet Passport. A glam, owner-facing card that shows a
 * pet's real profile (photo, DOB, breed, microchip, vet, vaccines) like a
 * premium passport. Read-only view; data comes from GET /api/pets/:petId.
 *
 * Routed at /pets/:petId/passport. Gold-on-dark luxury tokens, RTL-safe,
 * bilingual HE/EN copy (crafted, not google-translated). No invented data —
 * fields with no value are simply hidden.
 */
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { PetWashIcon } from '@/components/PetWashIcon';
import { useLanguage } from '@/lib/languageStore';
import { ArrowLeft, Loader2, ShieldCheck, Syringe, Cake, Stethoscope, Cpu, Droplets, CalendarClock, Sparkles } from 'lucide-react';

interface Pet {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  gender?: 'male' | 'female' | 'unknown';
  birthday?: string;
  weightKg?: number;
  microchip?: string;
  vetName?: string;
  photoUrl?: string;
  vaccineDates?: { rabies?: string; dhpp?: string; lepto?: string };
}

interface WashEntry {
  date: string | null;
  source: string;
  status: string | null;
  program: string | null;
}

interface CareTimeline {
  timeline: {
    lastWashDate: string | null;
    daysSinceLastWash: number | null;
    suggestedNextWashDate: string | null;
    suggestedNextWashIsHeuristic: boolean;
    nextWashIntervalDays: number;
    washHistory: WashEntry[];
    birthday: string | null;
    daysUntilBirthday: number | null;
    creditUsed: {
      egiftRedeemedCents: number | null;
      washPackageUnitsRedeemed: number | null;
      walletWashCreditsRemaining: number | null;
    };
  };
  notes?: { washScope?: string; washScopeReason?: string };
  readOnly?: boolean;
}

// Luxury asset icons (never emoji) keyed by species — Smart Luxury Icon System.
const SPECIES_ICON: Record<string, string> = {
  dog: 'animal_dog', cat: 'animal_cat', bird: 'animal_bird', rabbit: 'animal_rabbit', guinea_pig: 'animal_guinea_pig',
  hamster: 'animal_hamster', reptile: 'animal_lizard', fish: 'animal_fish', other: 'brand_paw',
};

export default function PetPassport() {
  const { petId } = useParams<{ petId: string }>();
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();

  const { data: pet, isLoading, isError } = useQuery<Pet>({
    queryKey: [`/api/pets/${petId}`],
    enabled: !!petId,
  });

  // Pet-Care Timeline (§5) — read-only. Loads alongside the passport; if it
  // errors the passport still renders (the section just hides).
  const { data: care } = useQuery<CareTimeline>({
    queryKey: [`/api/pet-care-timeline/${petId}`],
    enabled: !!petId,
  });

  const speciesLabel = (s?: string) => {
    const map: Record<string, [string, string]> = {
      dog: ['Dog', 'כלב'], cat: ['Cat', 'חתול'], bird: ['Bird', 'ציפור'],
      rabbit: ['Rabbit', 'ארנב'], guinea_pig: ['Guinea Pig', 'שרקן'],
      hamster: ['Hamster', 'אוגר'], reptile: ['Reptile', 'זוחל'],
      fish: ['Fish', 'דג'], other: ['Pet', 'חיה'],
    };
    const e = map[s || 'other'] || map.other;
    return he ? e[1] : e[0];
  };

  const age = (birthday?: string): string => {
    if (!birthday) return '';
    const d = new Date(birthday);
    if (isNaN(d.getTime())) return '';
    const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    if (months < 12) return tr(`${months} mo`, `${months} חודשים`);
    const y = Math.floor(months / 12);
    return tr(`${y} ${y === 1 ? 'year' : 'years'}`, `${y} שנים`);
  };

  // Short date label (locale-aware), or '' when missing/unparseable.
  const fmtDate = (d?: string | null): string => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(he ? 'he-IL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // A vaccine's next-due = one year after the recorded date (standard annual cadence).
  const nextDue = (date: string): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  };

  if (isLoading || (!pet && !isError)) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </Layout>
    );
  }

  if (isError || !pet) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 luxury-bg-mesh">
          <div className="text-6xl mb-6">🐾</div>
          <h2 className="text-2xl font-light text-white mb-4">{tr('Pet not found', 'חיית המחמד לא נמצאה')}</h2>
          <button onClick={() => navigate('/pets')} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-neutral-950 font-medium">
            {tr('Back to my pets', 'חזרה לחיות שלי')}
          </button>
        </div>
      </Layout>
    );
  }

  const vaccines = pet.vaccineDates || {};
  const vaccineRows = [
    { key: 'rabies', label: tr('Rabies', 'כלבת'), date: vaccines.rabies },
    { key: 'dhpp', label: tr('DHPP', 'משושה DHPP'), date: vaccines.dhpp },
    { key: 'lepto', label: tr('Lepto', 'לפטו'), date: vaccines.lepto },
  ].filter((v) => v.date);

  const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number }) =>
    value ? (
      <div className="flex items-center gap-3 py-2.5 border-b border-amber-300/10 last:border-0">
        <span className="text-amber-300/80">{icon}</span>
        <span className="text-xs uppercase tracking-wider text-gray-400 w-28 shrink-0">{label}</span>
        <span className="text-sm text-white" dir="auto">{value}</span>
      </div>
    ) : null;

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-8 px-4" dir={he ? 'rtl' : 'ltr'}>
        <div className="max-w-md mx-auto">
          <button onClick={() => navigate('/pets')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 text-sm">
            <ArrowLeft className={`w-4 h-4 ${he ? 'scale-x-[-1]' : ''}`} />
            {tr('Back', 'חזרה')}
          </button>

          {/* The passport card */}
          <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-500 shadow-2xl">
            <div className="rounded-3xl bg-gradient-to-b from-neutral-900 to-black overflow-hidden">
              {/* Header band */}
              <div className="flex items-center justify-between px-6 pt-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-semibold">
                  {tr('Pet Wash™ · Pet Passport', '⁦Pet Wash™⁩ · דרכון חיה')}
                </span>
                <ShieldCheck className="w-4 h-4 text-amber-300/70" />
              </div>

              {/* Photo + name */}
              <div className="flex flex-col items-center pt-4 pb-6 px-6">
                <div className="w-28 h-28 rounded-full p-[2px] bg-gradient-to-br from-amber-300 to-amber-500 mb-4">
                  <div className="w-full h-full rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                    {pet.photoUrl
                      ? <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                      : <span className="petwash-icon-card" style={{ width: 80, height: 80 }}><PetWashIcon name={SPECIES_ICON[pet.species || 'other'] || 'brand_paw'} size={56} label={pet.name} /></span>}
                  </div>
                </div>
                <h1 className="text-2xl font-semibold text-white">{pet.name}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {speciesLabel(pet.species)}{pet.breed ? ` · ${pet.breed}` : ''}
                  {age(pet.birthday) ? ` · ${age(pet.birthday)}` : ''}
                </p>
              </div>

              {/* Details */}
              <div className="px-6 pb-6">
                <Row icon={<Cake className="w-4 h-4" />} label={tr('Birthday', 'יום הולדת')} value={pet.birthday} />
                <Row icon={<span className="text-sm">⚧</span>} label={tr('Gender', 'מין')}
                     value={pet.gender ? tr(pet.gender, pet.gender === 'male' ? 'זכר' : pet.gender === 'female' ? 'נקבה' : 'לא ידוע') : undefined} />
                <Row icon={<span className="text-sm">⚖️</span>} label={tr('Weight', 'משקל')} value={pet.weightKg ? `${pet.weightKg} kg` : undefined} />
                <Row icon={<Cpu className="w-4 h-4" />} label={tr('Microchip', 'שבב')} value={pet.microchip} />
                <Row icon={<Stethoscope className="w-4 h-4" />} label={tr('Vet', 'וטרינר')} value={pet.vetName} />
              </div>

              {/* Vaccines */}
              {vaccineRows.length > 0 && (
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Syringe className="w-4 h-4 text-amber-300/80" />
                    <span className="text-xs uppercase tracking-wider text-amber-300/80 font-semibold">
                      {tr('Vaccinations', 'חיסונים')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {vaccineRows.map((v) => (
                      <div key={v.key} className="flex items-center justify-between rounded-xl bg-amber-300/[0.04] border border-amber-300/10 px-3 py-2.5">
                        <span className="text-sm text-white">{v.label}</span>
                        <span className="text-xs text-gray-400 text-end">
                          {v.date}
                          <span className="block text-[10px] text-amber-300/60">
                            {tr('next due', 'חידוש')} {nextDue(v.date!)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pet-Care Timeline (§5) — read-only, owner-scoped ─────────── */}
              {care?.timeline && (
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Droplets className="w-4 h-4 text-amber-300/80" />
                    <span className="text-xs uppercase tracking-wider text-amber-300/80 font-semibold">
                      {tr('Care timeline', 'ציר טיפוח')}
                    </span>
                  </div>

                  {/* Last wash / next suggested wash */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-xl bg-amber-300/[0.04] border border-amber-300/10 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">{tr('Last wash', 'רחצה אחרונה')}</div>
                      <div className="text-sm text-white mt-0.5">
                        {care.timeline.lastWashDate ? fmtDate(care.timeline.lastWashDate) : tr('No wash yet', 'אין רחצה עדיין')}
                      </div>
                      {care.timeline.daysSinceLastWash != null && (
                        <div className="text-[10px] text-amber-300/60 mt-0.5">
                          {tr(`${care.timeline.daysSinceLastWash} days ago`, `לפני ${care.timeline.daysSinceLastWash} ימים`)}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl bg-amber-300/[0.04] border border-amber-300/10 px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                        <CalendarClock className="w-3 h-3" />
                        {tr('Next suggested', 'הבא המומלץ')}
                      </div>
                      <div className="text-sm text-white mt-0.5">
                        {care.timeline.suggestedNextWashDate ? fmtDate(care.timeline.suggestedNextWashDate) : '—'}
                      </div>
                      {care.timeline.suggestedNextWashIsHeuristic && care.timeline.suggestedNextWashDate && (
                        <div className="text-[10px] text-amber-300/60 mt-0.5">
                          {tr(
                            `Estimate · every ${care.timeline.nextWashIntervalDays} days`,
                            `הערכה · כל ${care.timeline.nextWashIntervalDays} ימים`,
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Birthday countdown */}
                  {care.timeline.daysUntilBirthday != null && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-300/[0.04] border border-amber-300/10 px-3 py-2.5 mb-3">
                      <Sparkles className="w-4 h-4 text-amber-300/80" />
                      <span className="text-sm text-white">
                        {care.timeline.daysUntilBirthday === 0
                          ? tr('Birthday is today! 🎉', 'יום ההולדת היום! 🎉')
                          : tr(
                              `Birthday in ${care.timeline.daysUntilBirthday} days`,
                              `יום הולדת בעוד ${care.timeline.daysUntilBirthday} ימים`,
                            )}
                      </span>
                    </div>
                  )}

                  {/* Recent wash history */}
                  {care.timeline.washHistory.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                        {tr('Recent washes', 'רחצות אחרונות')}
                      </div>
                      {care.timeline.washHistory.slice(0, 5).map((w, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{fmtDate(w.date) || '—'}</span>
                          <span className="text-gray-500">
                            {w.source === 'kiosk' ? tr('Station', 'עמדה') : tr('Package', 'חבילה')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Honesty note — wash data is account-wide, not per-pet */}
                  <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                    {tr(
                      'Next-wash date is an estimate, not medical advice. Wash records are account-wide.',
                      'תאריך הרחצה הבא הוא הערכה ואינו ייעוץ וטרינרי. נתוני הרחצה הם ברמת החשבון.',
                    )}
                  </p>
                </div>
              )}

              <div className="px-6 pb-5 text-center">
                <p className="text-[10px] text-gray-500 font-mono tracking-wide" dir="ltr">{pet.id}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-5">
            {tr('Keep your pet’s passport up to date in', 'עדכנו את דרכון חיית המחמד שלכם ב')}{' '}
            <button onClick={() => navigate('/pets')} className="text-amber-400 underline">{tr('My Pets', 'החיות שלי')}</button>
          </p>
        </div>
      </div>
    </Layout>
  );
}
