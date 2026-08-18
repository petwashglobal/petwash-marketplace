/**
 * PetPassportHome — the PetWash™ Pet Passport HOME screen.
 *
 * Wired PIXEL-FAITHFUL to the CEO's 2026-07-07 canonical mockup + spec (see
 * memory pet-passport-canonical-spec-2026-07-07). Same React + Tailwind stack as
 * the rest of the app (the spec's React-Native starter is reference only — colors,
 * copy and layout are translated here exactly).
 *
 * Design tokens (from the spec, do NOT change):
 *   page bg   #FAFAF7   hero card  #063B22 (dark green)   gold  #D6B56D
 *   title     #121212   green text/link  #063B22          tile border #ECE6D8
 *
 * Hebrew-first RTL; numbers/emails/phones stay LTR. Sharp on every device: the
 * app renders as a centered phone-width column so it looks right small or big.
 * Data is REAL — pets come from GET /api/pets; empty/missing renders honestly.
 */
import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  BriefcaseMedical, Syringe, ShieldCheck, CalendarDays, Stethoscope, MapPin,
  ShoppingBag, MoreHorizontal, Home, PawPrint, Heart, FileText, Bell, Pencil, Plus,
} from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';

type Species = 'dog' | 'cat' | 'bird' | 'rabbit' | 'guinea_pig' | 'hamster' | 'reptile' | 'fish' | 'snake' | 'other';

interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string | null;
  birthday?: string | null;   // server field is `birthday` (YYYY-MM-DD)
  birthdate?: string | null;  // legacy alias — read as fallback
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' | string | null;
  photoUrl?: string | null;
}

const SPECIES_HE: Record<string, string> = {
  dog: 'כלב', cat: 'חתול', bird: 'ציפור', rabbit: 'ארנב', guinea_pig: 'שרקן',
  hamster: 'אוגר', reptile: 'זוחל', fish: 'דג', snake: 'נחש', other: 'אחר',
};
const SPECIES_EN: Record<string, string> = {
  dog: 'Dog', cat: 'Cat', bird: 'Bird', rabbit: 'Rabbit', guinea_pig: 'Guinea Pig',
  hamster: 'Hamster', reptile: 'Reptile', fish: 'Fish', snake: 'Snake', other: 'Other',
};
const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇', guinea_pig: '🐹',
  hamster: '🐹', reptile: '🦎', fish: '🐠', snake: '🐍', other: '🐾',
};

/** "3 yrs 8 mo" / "3 שנים 8 חודשים" from an ISO birthdate. Empty if unknown. */
function ageText(birthdate: string | null | undefined, isHe: boolean): string {
  if (!birthdate) return '';
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (isHe) {
    const yl = y === 1 ? 'שנה' : `${y} שנים`;
    const ml = m === 1 ? 'חודש' : `${m} חודשים`;
    return y > 0 ? (m > 0 ? `${yl} ${ml}` : yl) : ml;
  }
  const yl = y > 0 ? `${y} yr${y > 1 ? 's' : ''}` : '';
  const ml = m > 0 ? `${m} mo` : '';
  return [yl, ml].filter(Boolean).join(' ') || '0 mo';
}

function genderText(g: string | null | undefined, isHe: boolean): string {
  const v = (g || '').toUpperCase();
  if (v === 'MALE') return isHe ? 'זכר' : 'Male';
  if (v === 'FEMALE') return isHe ? 'נקבה' : 'Female';
  return '';
}

/** Circle pet avatar — real photo when present, else a soft species emoji chip. */
function PetAvatar({ pet, size, ring }: { pet: Pet; size: number; ring?: boolean }) {
  const ringCls = ring ? 'ring-2' : '';
  const style = ring ? { boxShadow: `0 0 0 2px ${GOLD}` } : undefined;
  if (pet.photoUrl) {
    return (
      <img
        src={pet.photoUrl}
        alt={pet.name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${ringCls}`}
        style={{ width: size, height: size, ...style }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center bg-[#EEF3EC] ${ringCls}`}
      style={{ width: size, height: size, fontSize: size * 0.42, ...style }}
      aria-label={pet.name}
    >
      <span>{SPECIES_EMOJI[pet.species] ?? '🐾'}</span>
    </div>
  );
}

export default function PetPassportHome() {
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isHe = language === 'he';
  const tr = (he: string, en: string) => (isHe ? he : en);

  // Tiles/quick-actions that have no destination page yet must NOT silently
  // dump the user onto /pets — that's a bait-and-switch. Surface a real
  // "coming soon" toast so the owner knows what they clicked isn't wired.
  const notReady = (labelHe: string, labelEn: string) => {
    toast({
      title: tr(labelHe, labelEn),
      description: tr('בקרוב — עדיין בפיתוח', 'Coming soon — still in development'),
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['/api/pets'],
    queryFn: async () => {
      // MUST use apiRequest — it attaches the Firebase Bearer token. A raw
      // fetch sends no auth header (there is no pw_session cookie), so /api/pets
      // 401s and the passport falsely shows "no pets" to every real owner.
      const r = await apiRequest('GET', '/api/pets');
      return r.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const pets: Pet[] = useMemo(() => {
    const raw = Array.isArray(data?.pets) ? data.pets : Array.isArray(data) ? data : [];
    return raw as Pet[];
  }, [data]);

  const hero = pets[0];
  const ownerPhoto = (user as any)?.photoURL as string | undefined;

  const speciesLabel = (s: string) => (isHe ? SPECIES_HE[s] : SPECIES_EN[s]) ?? s;

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen w-full bg-[#FAFAF7]">
      <div className="mx-auto w-full max-w-[440px] px-5 pb-28 pt-5">

        {/* ── Header: logo (left) + owner avatar (right), fixed orientation ── */}
        <div dir="ltr" className="flex items-center justify-between">
          <PetWashLogo size={34} priority />
          <button
            onClick={() => navigate('/my-account')}
            className="h-10 w-10 rounded-full overflow-hidden border border-[#E4E4DC] bg-white shrink-0"
            aria-label={tr('החשבון שלי', 'My account')}
          >
            {ownerPhoto ? (
              <img src={ownerPhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[15px] font-bold" style={{ color: GREEN }}>
                {(user?.displayName || user?.email || '·').charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        </div>

        {/* ── Hero pet card ── */}
        <div dir="ltr" className="relative mt-4 flex items-center gap-4 rounded-[22px] p-5 shadow-lg" style={{ backgroundColor: GREEN }}>
          {hero ? (
            <>
              {/* Photo on the LEFT (matches the CEO mockup), text right-aligned for Hebrew */}
              <PetAvatar pet={hero} size={104} ring />
              <div className="min-w-0 flex-1" style={{ textAlign: isHe ? 'right' : 'left' }}>
                <div className="truncate text-[30px] font-extrabold leading-tight" style={{ color: GOLD }}>
                  {hero.name}
                </div>
                <div className="mt-1 truncate text-[15px] text-white/95">
                  {hero.breed || speciesLabel(hero.species)}
                </div>
                <div className="mt-0.5 text-[15px] text-white/80" dir={isHe ? 'rtl' : 'ltr'}>
                  {[ageText(hero.birthday ?? hero.birthdate, isHe), genderText(hero.gender, isHe)].filter(Boolean).join(' • ')}
                </div>
              </div>
              <button
                onClick={() => navigate(`/pets`)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center"
                style={{ color: GOLD }}
                aria-label={tr('עריכה', 'Edit')}
              >
                <Pencil className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <div className="flex-1 py-3 text-center">
              <div className="text-[17px] font-bold" style={{ color: GOLD }}>
                {tr('עדיין אין חיות מחמד', 'No pets yet')}
              </div>
              <button
                onClick={() => navigate('/pet-passport/add')}
                className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white"
              >
                {tr('הוסף חיית מחמד', 'Add a pet')}
              </button>
            </div>
          )}
        </div>

        {/* ── 3 passport tiles ── */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Tile icon={<BriefcaseMedical />} label={tr('רשומות רפואיות', 'Medical records')} onClick={() => navigate('/documents')} />
          {/* 2026-08-18 COMPETITIVE (WhatIDog gap): Vaccines is REAL — per-pet
              PetHealthPanel on /pets already stores nextVaccineDate + the
              enableVaccineReminders toggle and reads /api/pets/:id/health-events.
              Route the tile there instead of showing a coming-soon toast. */}
          <Tile icon={<Syringe />} label={tr('חיסונים', 'Vaccines')} onClick={() => navigate('/pets')} />
          <Tile icon={<ShieldCheck />} label={tr('ביטוחים', 'Insurance')} onClick={() => notReady('ביטוחים', 'Insurance')} />
        </div>

        {/* ── My Pets carousel ── */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-[22px] font-extrabold" style={{ color: '#121212' }}>
            {tr('החיות שלי', 'My pets')}
          </div>
          <button onClick={() => navigate('/pets')} className="text-[15px] font-bold" style={{ color: GREEN }}>
            {tr('הכל', 'All')}
          </button>
        </div>

        <div className="mt-3 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {isLoading && pets.length === 0 && (
            [0, 1, 2].map((i) => (
              <div key={i} className="w-[92px] shrink-0 text-center">
                <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-black/5" />
                <div className="mx-auto mt-2 h-3 w-14 animate-pulse rounded bg-black/5" />
              </div>
            ))
          )}
          {pets.map((pet) => (
            <button key={pet.id} onClick={() => navigate(`/pets/${pet.id}/passport`)} className="w-[92px] shrink-0 text-center">
              <div className="mx-auto"><PetAvatar pet={pet} size={82} /></div>
              <div className="mt-2 truncate text-[15px] font-extrabold text-[#111]">{pet.name}</div>
              <div className="truncate text-xs text-[#555]">{speciesLabel(pet.species)}</div>
            </button>
          ))}
          {/* Add pet */}
          <button
            onClick={() => navigate('/pet-passport/add')}
            className="flex min-h-[118px] w-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#B8B8B8]"
          >
            <Plus className="h-8 w-8" style={{ color: GREEN }} />
            <span className="px-1 text-[11px] font-semibold leading-tight text-[#111]">{tr('הוסף חיית מחמד', 'Add pet')}</span>
          </button>
        </div>

        {/* ── Quick actions ── */}
        <div className="mt-6 rounded-[22px] border border-[#ECE6D8] bg-white p-4">
          <div className="text-[22px] font-extrabold" style={{ color: '#121212' }}>
            {tr('פעולות מהירות', 'Quick actions')}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {/* 2026-08-18 COMPETITIVE (WhatIDog gap): Reminders and Vet are REAL —
                /pets renders per-pet PetHealthPanel with vaccine-reminder,
                deworming, and vet-visit event flows over /api/pets/:id/health-events.
                Route to the same feature the user already has. Clinics stays
                coming-soon until we surface a locator. */}
            <Quick icon={<CalendarDays />} label={tr('תזכורות', 'Reminders')} onClick={() => navigate('/pets')} />
            <Quick icon={<Stethoscope />} label={tr('וטרינר', 'Vet')} onClick={() => navigate('/pets')} />
            <Quick icon={<MapPin />} label={tr('בתי חולים', 'Clinics')} onClick={() => notReady('בתי חולים', 'Clinics')} />
            <Quick icon={<ShoppingBag />} label={tr('חנות', 'Shop')} onClick={() => navigate('/shop')} />
            <Quick icon={<MoreHorizontal />} label={tr('עוד', 'More')} onClick={() => navigate('/pets')} />
          </div>
        </div>
      </div>

      {/* ── Bottom nav (within the phone column) ── */}
      <nav
        dir={isHe ? 'rtl' : 'ltr'}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[440px] items-center justify-around border-t border-[#ECE6D8] bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2"
      >
        <NavItem icon={<Home />} label={tr('דף הבית', 'Home')} onClick={() => navigate('/prestige/home')} />
        <NavItem icon={<PawPrint />} label={tr('חיות מחמד', 'Pets')} active onClick={() => navigate('/pet-passport')} />
        <NavItem icon={<Heart />} label={tr('בריאות', 'Health')} onClick={() => navigate('/pets')} />
        <NavItem icon={<FileText />} label={tr('מסמכים', 'Documents')} onClick={() => navigate('/documents')} />
        <NavItem icon={<Bell />} label={tr('התראות', 'Alerts')} onClick={() => navigate('/notifications')} />
      </nav>
    </div>
  );
}

function Tile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-[#ECE6D8] bg-white px-2 py-4 transition-transform active:scale-[0.97]"
    >
      <span className="flex h-7 w-7 items-center justify-center [&_svg]:h-7 [&_svg]:w-7" style={{ color: GREEN }}>{icon}</span>
      <span className="text-center text-[13px] font-bold leading-tight" style={{ color: GREEN }}>{label}</span>
    </button>
  );
}

function Quick({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
      <span className="flex h-7 w-7 items-center justify-center [&_svg]:h-6 [&_svg]:w-6" style={{ color: GREEN }}>{icon}</span>
      <span className="text-center text-[11px] font-semibold leading-tight text-[#333]">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  const color = active ? GREEN : '#9AA0A6';
  return (
    <button onClick={onClick} className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1" style={{ color }}>
      <span className="flex items-center justify-center [&_svg]:h-[22px] [&_svg]:w-[22px]">{icon}</span>
      <span className="truncate text-[11px]" style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}
