/**
 * PetPassport — the Luxury Pet Passport detail card.
 *
 * Repainted 2026-08-27 to the CEO's canonical green-marble palette so this
 * detail view matches PetPassportHome.tsx pixel-for-token. Memory anchor:
 * pet-passport-canonical-spec-2026-07-07.
 *
 *   page bg   #FAFAF7    hero card  #063B22 (deep green)   gold  #D6B56D
 *   title     #121212    tile border  #ECE6D8              muted #6B6E6A
 *
 * Read-only. Data comes from GET /api/pets/:petId and
 * GET /api/pet-care-timeline/:petId. Bilingual HE/EN. Fields with no value
 * simply hide — never invented.
 */
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { PetWashIcon } from '@/components/PetWashIcon';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import { useLanguage } from '@/lib/languageStore';
import {
  ArrowLeft, Loader2, ShieldCheck, Syringe, Cake, Stethoscope, Cpu,
  Droplets, CalendarClock, Sparkles,
} from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

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

const SPECIES_ICON: Record<string, string> = {
  dog: 'animal_dog', cat: 'animal_cat', bird: 'animal_bird',
  rabbit: 'animal_rabbit', guinea_pig: 'animal_guinea_pig',
  hamster: 'animal_hamster', reptile: 'animal_lizard', fish: 'animal_fish',
  other: 'brand_paw',
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

  const fmtDate = (d?: string | null): string => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(he ? 'he-IL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const nextDue = (date: string): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  };

  if (isLoading || (!pet && !isError)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: MARBLE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }

  if (isError || !pet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4" style={{ background: MARBLE }}>
        <div className="mb-6"><PetWashIcon name="brand_paw" size={56} label={tr('Pet not found', 'חיית המחמד לא נמצאה')} /></div>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: INK }}>{tr('Pet not found', 'חיית המחמד לא נמצאה')}</h2>
        <button
          onClick={() => navigate('/pets')}
          className="px-6 py-2.5 rounded-full font-semibold"
          style={{ background: GREEN, color: GOLD }}
        >
          {tr('Back to my pets', 'חזרה לחיות שלי')}
        </button>
      </div>
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
      <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: BORDER }}>
        <span style={{ color: GREEN }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider w-28 shrink-0" style={{ color: MUTED }}>{label}</span>
        <span className="text-sm font-medium" style={{ color: INK }} dir="auto">{value}</span>
      </div>
    ) : null;

  return (
    <div dir={he ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: MARBLE }}>
      <div className="mx-auto w-full max-w-[440px] px-5 pt-5 pb-16">

        {/* Back + brand */}
        <div dir="ltr" className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/pet-passport')}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: GREEN }}
            aria-label={tr('Back', 'חזרה')}
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back', 'חזרה')}
          </button>
          <PetWashLogo size={30} />
        </div>

        {/* Passport card — green-marble hero */}
        <div className="relative rounded-[22px] shadow-lg overflow-hidden" style={{ background: GREEN }}>
          {/* Header band with gold rule */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: `${GOLD}33` }}>
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD }}>
              {tr('PetWash™ · Pet Passport', 'PetWash™ · דרכון חיה')}
            </span>
            <ShieldCheck className="w-4 h-4" style={{ color: GOLD }} />
          </div>

          {/* Photo + name */}
          <div className="flex flex-col items-center pt-5 pb-6 px-6">
            <div className="rounded-full p-[2px] mb-3" style={{ boxShadow: `0 0 0 2px ${GOLD}` }}>
              <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#0a4b2c' }}>
                {pet.photoUrl
                  ? <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                  : <PetWashIcon name={SPECIES_ICON[pet.species || 'other'] || 'brand_paw'} size={56} label={pet.name} />}
              </div>
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: GOLD }}>{pet.name}</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {speciesLabel(pet.species)}{pet.breed ? ` · ${pet.breed}` : ''}
              {age(pet.birthday) ? ` · ${age(pet.birthday)}` : ''}
            </p>
          </div>
        </div>

        {/* Details tile — marble */}
        <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
            {tr('Details', 'פרטים')}
          </div>
          <Row icon={<Cake className="w-4 h-4" />} label={tr('Birthday', 'יום הולדת')} value={fmtDate(pet.birthday) || pet.birthday} />
          <Row
            icon={<span className="text-sm">⚧</span>}
            label={tr('Gender', 'מין')}
            value={pet.gender
              ? tr(
                  pet.gender === 'male' ? 'Male' : pet.gender === 'female' ? 'Female' : 'Unknown',
                  pet.gender === 'male' ? 'זכר' : pet.gender === 'female' ? 'נקבה' : 'לא ידוע',
                )
              : undefined}
          />
          <Row icon={<span className="text-sm">⚖️</span>} label={tr('Weight', 'משקל')} value={pet.weightKg ? `${pet.weightKg} kg` : undefined} />
          <Row icon={<Cpu className="w-4 h-4" />} label={tr('Microchip', 'שבב')} value={pet.microchip} />
          <Row icon={<Stethoscope className="w-4 h-4" />} label={tr('Vet', 'וטרינר')} value={pet.vetName} />
        </div>

        {/* Vaccines tile */}
        {vaccineRows.length > 0 && (
          <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Syringe className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
                {tr('Vaccinations', 'חיסונים')}
              </span>
            </div>
            <div className="space-y-2">
              {vaccineRows.map((v) => (
                <div
                  key={v.key}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: '#F7F3E7', border: `1px solid ${BORDER}` }}
                >
                  <span className="text-sm font-semibold" style={{ color: INK }}>{v.label}</span>
                  <span className="text-xs text-end" style={{ color: MUTED }}>
                    {fmtDate(v.date) || v.date}
                    <span className="block text-[10px] font-semibold" style={{ color: GREEN }}>
                      {tr('next due', 'חידוש')} {fmtDate(nextDue(v.date!)) || nextDue(v.date!)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Care timeline tile (§5) */}
        {care?.timeline && (
          <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
                {tr('Care timeline', 'ציר טיפוח')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl px-3 py-2.5" style={{ background: MARBLE, border: `1px solid ${BORDER}` }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{tr('Last wash', 'רחצה אחרונה')}</div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: INK }}>
                  {care.timeline.lastWashDate ? fmtDate(care.timeline.lastWashDate) : tr('No wash yet', 'אין רחצה עדיין')}
                </div>
                {care.timeline.daysSinceLastWash != null && (
                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color: GREEN }}>
                    {tr(
                      `${care.timeline.daysSinceLastWash} ${care.timeline.daysSinceLastWash === 1 ? 'day' : 'days'} ago`,
                      `לפני ${care.timeline.daysSinceLastWash} ${care.timeline.daysSinceLastWash === 1 ? 'יום' : 'ימים'}`,
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: MARBLE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                  <CalendarClock className="w-3 h-3" />
                  {tr('Next suggested', 'הבא המומלץ')}
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: INK }}>
                  {care.timeline.suggestedNextWashDate ? fmtDate(care.timeline.suggestedNextWashDate) : '—'}
                </div>
                {care.timeline.suggestedNextWashIsHeuristic && care.timeline.suggestedNextWashDate && (
                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color: GREEN }}>
                    {tr(
                      `Estimate · every ${care.timeline.nextWashIntervalDays} ${care.timeline.nextWashIntervalDays === 1 ? 'day' : 'days'}`,
                      `הערכה · כל ${care.timeline.nextWashIntervalDays} ${care.timeline.nextWashIntervalDays === 1 ? 'יום' : 'ימים'}`,
                    )}
                  </div>
                )}
              </div>
            </div>

            {care.timeline.daysUntilBirthday != null && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3" style={{ background: '#F7F3E7', border: `1px solid ${BORDER}` }}>
                <Sparkles className="w-4 h-4" style={{ color: GREEN }} />
                <span className="text-sm font-semibold" style={{ color: INK }}>
                  {care.timeline.daysUntilBirthday === 0
                    ? tr('Birthday is today! 🎉', 'יום ההולדת היום! 🎉')
                    : tr(
                        `Birthday in ${care.timeline.daysUntilBirthday} ${care.timeline.daysUntilBirthday === 1 ? 'day' : 'days'}`,
                        `יום הולדת בעוד ${care.timeline.daysUntilBirthday} ${care.timeline.daysUntilBirthday === 1 ? 'יום' : 'ימים'}`,
                      )}
                </span>
              </div>
            )}

            {care.timeline.washHistory.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: MUTED }}>
                  {tr('Recent washes', 'רחצות אחרונות')}
                </div>
                {care.timeline.washHistory.slice(0, 5).map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span style={{ color: INK }}>{fmtDate(w.date) || '—'}</span>
                    <span style={{ color: MUTED }}>
                      {w.source === 'kiosk' ? tr('Station', 'עמדה') : tr('Package', 'חבילה')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] mt-3 leading-relaxed" style={{ color: MUTED }}>
              {tr(
                'Next-wash date is an estimate, not medical advice. Wash records are account-wide.',
                'תאריך הרחצה הבא הוא הערכה ואינו ייעוץ וטרינרי. נתוני הרחצה הם ברמת החשבון.',
              )}
            </p>
          </div>
        )}

        {/* Passport ID footer */}
        <div className="mt-4 text-center">
          <p className="text-[10px] font-mono tracking-wider" style={{ color: MUTED }} dir="ltr">{pet.id}</p>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: MUTED }}>
          {tr('Keep your pet’s passport up to date in', 'עדכנו את דרכון חיית המחמד שלכם ב')}{' '}
          <button
            onClick={() => navigate('/pets')}
            className="font-semibold underline"
            style={{ color: GREEN }}
          >
            {tr('My Pets', 'החיות שלי')}
          </button>
        </p>
      </div>
    </div>
  );
}
