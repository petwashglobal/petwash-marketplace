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
import { useLanguage } from '@/lib/languageStore';
import { ArrowLeft, Loader2, ShieldCheck, Syringe, Cake, Stethoscope, Cpu } from 'lucide-react';

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

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🐦', rabbit: '🐰', guinea_pig: '🐹',
  hamster: '🐹', reptile: '🦎', fish: '🐠', other: '🐾',
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
                      : <span className="text-5xl">{SPECIES_EMOJI[pet.species || 'other'] || '🐾'}</span>}
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
