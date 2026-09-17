/**
 * Adopt a Pet — the CEO-approved board (canonical mockup 2026-09-13), wired.
 *
 * Adopt a Pet is its OWN free PetWash™‎ member service: its own listings
 * (/api/adoption), statuses (available / pending / adopted), pet page
 * (/adoption/:id), listing flow (/adoption/new) and member area (/adoption/my).
 * It is NOT PawFinder™‎ — PawFinder is lost ↔ found. Only invisible plumbing
 * (login, photo storage, safety scan, push) is shared.
 *
 * Browsing is open so pets are seen; saving, matching, enquiring and listing are
 * for signed-in members. Hebrew-first: the whole surface flips with dir.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  Heart, Search, MapPin, PawPrint, Bookmark, MessageCircle, User, ShieldCheck, Home, CalendarDays,
  ArrowLeft, ArrowRight, Ruler, Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { PetWashIcon } from '@/components/PetWashIcon';
import { useSEO, pageSEO } from '@/lib/seo';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { sanitizeUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  EditorialHeader, PillarRow, StepsBand, ClosingBand, SideNav, Chip, placeLine, GOLD, GOLD_INK, HAIRLINE, PAPER, SERIF, INK,
} from '@/components/pet-community/Editorial';
import { adoptionApi, ageLabel, petLabel, errorText, type AdoptionListing } from '@/pages/adoption/adoptionUi';
import { ExamplePreview, adoptionExamples } from '@/components/pet-community/ExamplePreview';

type View = 'browse' | 'matches' | 'saved' | 'messages' | 'profile';
type ChipKey = 'all' | 'dog' | 'cat' | 'apartment' | 'kids' | 'dogs' | 'cats' | 'low_shedding' | 'special';

interface BoardListing extends AdoptionListing {
  apartment_friendly?: string;
  low_shedding?: string;
  age_months?: number | null;
  published_at?: string | null;
}

const SIZE: Record<string, [string, string]> = {
  tiny: ['זעיר', 'Tiny'], small: ['קטן', 'Small'], medium: ['בינוני', 'Medium'], large: ['גדול', 'Large'], giant: ['ענק', 'Giant'],
};

function ageText(isHe: boolean, l: BoardListing): string {
  if (typeof l.age_months === 'number') {
    if (l.age_months < 12) return isHe ? `${l.age_months} חודשים` : `${l.age_months} months`;
    const y = Math.floor(l.age_months / 12);
    return isHe ? (y === 1 ? 'שנה' : y === 2 ? 'שנתיים' : `${y} שנים`) : `${y} ${y === 1 ? 'year' : 'years'}`;
  }
  return l.age_group && l.age_group !== 'unknown' ? ageLabel(isHe, l.age_group) : '';
}

function traits(l: BoardListing): string {
  return String(l.temperament || '').split(/[,،·\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 3).join(', ');
}

/** Available = green, Pending Meet = amber, Adopted = quiet. */
function StatusPill({ isHe, status }: { isHe: boolean; status: string }) {
  const map: Record<string, { he: string; en: string; bg: string; fg: string }> = {
    available: { he: 'זמין/ה', en: 'Available', bg: '#E4F3E6', fg: '#256B34' },
    pending: { he: 'בתהליך היכרות', en: 'Pending Meet', bg: '#FBEFD3', fg: '#8A5A00' },
    adopted: { he: 'אומץ/ה', en: 'Adopted', bg: '#EEEEEE', fg: '#555' },
  };
  const s = map[status] ?? map.available;
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: s.bg, color: s.fg }} data-testid={`adoption-status-${status}`}>
      {isHe ? s.he : s.en}
    </span>
  );
}

function PetCard({ l, isHe, saved, onToggleSave }: { l: BoardListing; isHe: boolean; saved: boolean; onToggleSave: () => void }) {
  const [, navigate] = useLocation();
  const img = sanitizeUrl(l.primary_media);
  const size = l.size_category && SIZE[l.size_category] ? SIZE[l.size_category][isHe ? 0 : 1] : '';
  const Forward = isHe ? ArrowLeft : ArrowRight;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white" style={{ border: `1px solid ${HAIRLINE}` }} data-testid={`adoption-card-${l.id}`}>
      <div className="relative aspect-[4/3.4] overflow-hidden" style={{ background: PAPER }}>
        {img
          ? <img src={img} alt={l.pet_name || ''} className="h-full w-full object-cover" loading="lazy" />
          : <div className="flex h-full items-center justify-center"><PetWashIcon name="brand_paw" size={44} label={l.pet_name || 'Pet'} /></div>}
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={isHe ? 'שמירה' : 'Save'}
          data-testid={`adoption-save-${l.id}`}
          className="absolute top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur"
          style={{ insetInlineEnd: 10 }}
        >
          <Heart className="h-[18px] w-[18px]" style={{ color: saved ? '#C0392B' : INK }} fill={saved ? '#C0392B' : 'none'} />
        </button>
        <span className="absolute bottom-2.5" style={{ insetInlineStart: 10 }}><StatusPill isHe={isHe} status={l.status} /></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[22px] leading-tight text-black" style={{ fontFamily: SERIF }}>{l.pet_name || (isHe ? 'חיה לאימוץ' : 'For adoption')}</div>
        <div className="mt-1 text-[13px] text-black/60">{[ageText(isHe, l), l.breed || petLabel(isHe, l.pet_type)].filter(Boolean).join(' | ')}</div>
        {(size || traits(l)) && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[13px] text-black/60">
            <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{[size, traits(l)].filter(Boolean).join(' | ')}</span>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-black/60">
          <MapPin className="h-3.5 w-3.5 shrink-0" />{placeLine(l.city, l.area)}
        </div>
        <div className="mt-auto pt-4">
          {/* Desktop: outlined "View Profile" (mockup); phone: black "I'm Interested". */}
          <Link href={`/adoption/${l.id}`}>
            <span className="hidden sm:flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-2 text-[13px] text-black transition-colors hover:bg-black hover:text-white" style={{ border: `1px solid ${GOLD}` }} data-testid={`adoption-view-${l.id}`}>
              {isHe ? 'לפרופיל' : 'View Profile'} <Forward className="h-3.5 w-3.5" />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/adoption/${l.id}#enquire`)}
            className="sm:hidden w-full rounded-full bg-black py-3 text-sm font-medium text-white"
            data-testid={`adoption-interested-${l.id}`}
          >
            {isHe ? 'אני מעוניין/ת' : "I'm Interested"}
          </button>
        </div>
      </div>
    </article>
  );
}

function AdopterProfileForm({ isHe }: { isHe: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery<{ profile: any }>({ queryKey: ['/api/adoption/my/profile'], queryFn: () => adoptionApi('/api/adoption/my/profile') });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const p: Record<string, string> = draft ?? {
    homeType: q.data?.profile?.homeType ?? 'unspecified', hasChildren: q.data?.profile?.hasChildren ?? 'unknown',
    hasDogs: q.data?.profile?.hasDogs ?? 'unknown', hasCats: q.data?.profile?.hasCats ?? 'unknown',
    wantsLowShedding: q.data?.profile?.wantsLowShedding ?? 'unknown', preferredSpecies: q.data?.profile?.preferredSpecies ?? 'any',
    city: q.data?.profile?.city ?? '',
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setDraft({ ...p, [k]: e.target.value });
  const yn = (k: string, label: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-black/55">{label}</span>
      <select value={p[k]} onChange={set(k)} className="w-full rounded-xl bg-white px-3 py-2.5 text-base" style={{ border: `1px solid ${HAIRLINE}` }}>
        <option value="unknown">{isHe ? 'לא צוין' : 'Not specified'}</option>
        <option value="yes">{isHe ? 'כן' : 'Yes'}</option>
        <option value="no">{isHe ? 'לא' : 'No'}</option>
      </select>
    </label>
  );
  async function save() {
    try {
      await adoptionApi('/api/adoption/my/profile', { method: 'PUT', json: { ...p, city: p.city?.trim() || undefined } });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['/api/adoption/my/profile'] });
      qc.invalidateQueries({ queryKey: ['/api/adoption/my/matches'] });
      toast({ title: isHe ? 'הפרופיל נשמר' : 'Profile saved', description: isHe ? 'ההתאמות שלך עודכנו.' : 'Your matches are updated.' });
    } catch (err) {
      toast({ variant: 'destructive', title: isHe ? 'לא נשמר' : 'Not saved', description: errorText(isHe, err) });
    }
  }
  return (
    <div className="rounded-2xl p-5" style={{ border: `1px solid ${HAIRLINE}` }} data-testid="adopter-profile-form">
      <h3 className="text-2xl" style={{ fontFamily: SERIF }}>{isHe ? 'פרופיל מאמץ/ת' : 'Your adopter profile'}</h3>
      <p className="mt-1 text-sm text-black/60">{isHe ? 'ממלאים פעם אחת — ונראה לכם חיות שמתאימות לבית שלכם.' : 'Fill it once — we show pets that fit your home.'}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-black/55">{isHe ? 'סוג בית' : 'Home'}</span>
          <select value={p.homeType} onChange={set('homeType')} className="w-full rounded-xl bg-white px-3 py-2.5 text-base" style={{ border: `1px solid ${HAIRLINE}` }}>
            <option value="unspecified">{isHe ? 'לא צוין' : 'Not specified'}</option>
            <option value="apartment">{isHe ? 'דירה' : 'Apartment'}</option>
            <option value="house">{isHe ? 'בית' : 'House'}</option>
            <option value="house_with_yard">{isHe ? 'בית עם חצר' : 'House with yard'}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-black/55">{isHe ? 'מחפש/ת' : 'Looking for'}</span>
          <select value={p.preferredSpecies} onChange={set('preferredSpecies')} className="w-full rounded-xl bg-white px-3 py-2.5 text-base" style={{ border: `1px solid ${HAIRLINE}` }}>
            <option value="any">{isHe ? 'כל חיה' : 'Any pet'}</option>
            <option value="dog">{isHe ? 'כלב' : 'Dog'}</option>
            <option value="cat">{isHe ? 'חתול' : 'Cat'}</option>
            <option value="rabbit">{isHe ? 'ארנב' : 'Rabbit'}</option>
            <option value="bird">{isHe ? 'ציפור' : 'Bird'}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-black/55">{isHe ? 'עיר' : 'City'}</span>
          <input value={p.city} onChange={set('city')} className="w-full rounded-xl bg-white px-3 py-2.5 text-base" style={{ border: `1px solid ${HAIRLINE}` }} />
        </label>
        {yn('hasChildren', isHe ? 'ילדים בבית' : 'Children at home')}
        {yn('hasDogs', isHe ? 'כלבים בבית' : 'Dogs at home')}
        {yn('hasCats', isHe ? 'חתולים בבית' : 'Cats at home')}
        {yn('wantsLowShedding', isHe ? 'צריך/ה נשירה נמוכה' : 'Need low shedding')}
      </div>
      <button type="button" onClick={save} className="mt-5 rounded-full bg-black px-6 py-2.5 text-sm text-white" data-testid="button-save-adopter-profile">
        {isHe ? 'שמירה' : 'Save profile'}
      </button>
    </div>
  );
}

export default function AdoptionMaison() {
  useSEO(pageSEO.adoption);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const L = (he: string, en: string) => (isHe ? he : en);
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<View>('browse');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');

  const { data, isLoading, isError } = useQuery<{ rows: BoardListing[] }>({
    queryKey: ['/api/adoption/listings'],
    queryFn: async () => {
      const r = await fetch('/api/adoption/listings', { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });
  const posts: AdoptionListing[] = data?.rows ?? [];
  const favorites = useQuery<{ rows: BoardListing[]; ids: number[] }>({
    queryKey: ['/api/adoption/my/favorites'], enabled: !!user, queryFn: () => adoptionApi('/api/adoption/my/favorites'),
  });
  const matches = useQuery<{ profile: any; rows: BoardListing[] }>({
    queryKey: ['/api/adoption/my/matches'], enabled: !!user && view === 'matches', queryFn: () => adoptionApi('/api/adoption/my/matches'),
  });
  const savedIds = new Set(favorites.data?.ids ?? []);

  const requireMember = () => {
    if (user) return true;
    navigate(`/sign-in?redirect=${encodeURIComponent('/adoption')}`);
    return false;
  };

  async function toggleSave(id: number) {
    if (!requireMember()) return;
    try {
      await adoptionApi(`/api/adoption/listings/${id}/favorite`, { method: savedIds.has(id) ? 'DELETE' : 'POST', json: {} });
      qc.invalidateQueries({ queryKey: ['/api/adoption/my/favorites'] });
    } catch (err) {
      toast({ variant: 'destructive', title: L('לא נשמר', 'Not saved'), description: errorText(isHe, err) });
    }
  }

  const source: BoardListing[] = view === 'saved' ? (favorites.data?.rows ?? []) : view === 'matches' ? (matches.data?.rows ?? []) : (posts as BoardListing[]);
  const cities = useMemo(() => Array.from(new Set((posts as BoardListing[]).map((p) => p.city).filter(Boolean))).sort(), [posts]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = source.filter((l) => {
      if (city && l.city !== city) return false;
      if (q && ![l.pet_name, l.breed, l.city, l.area].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      switch (chip) {
        case 'dog': return l.pet_type === 'dog';
        case 'cat': return l.pet_type === 'cat';
        case 'apartment': return l.apartment_friendly === 'yes';
        case 'kids': return l.good_with_children === 'yes';
        case 'dogs': return l.good_with_dogs === 'yes';
        case 'cats': return l.good_with_cats === 'yes';
        case 'low_shedding': return l.low_shedding === 'yes';
        case 'special': return !!String(l.special_needs || '').trim();
        default: return true;
      }
    });
    const t = (l: BoardListing) => new Date(l.published_at || 0).getTime();
    return [...list].sort((a, b) => sort === 'name'
      ? String(a.pet_name || '').localeCompare(String(b.pet_name || ''), isHe ? 'he' : 'en')
      : sort === 'oldest' ? t(a) - t(b) : t(b) - t(a));
  }, [source, search, city, chip, sort, isHe]);

  const navItems = [
    { key: 'browse', label: L('כל החיות', 'Browse Pets'), icon: <PawPrint className="h-4 w-4" /> },
    { key: 'matches', label: L('ההתאמות שלי', 'My Matches'), icon: <Heart className="h-4 w-4" /> },
    { key: 'saved', label: L('שמורים', 'Saved'), icon: <Bookmark className="h-4 w-4" />, badge: savedIds.size || undefined },
    { key: 'messages', label: L('הודעות', 'Messages'), icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'profile', label: L('הפרופיל שלי', 'My Profile'), icon: <User className="h-4 w-4" /> },
  ];

  const selectView = (k: string) => {
    if (k === 'messages') { if (requireMember()) navigate('/adoption/my'); return; }
    if (k !== 'browse' && !requireMember()) return;
    setView(k as View);
  };

  const chips: [ChipKey, string][] = [
    ['all', L('כל החיות', 'All Pets')], ['dog', L('כלבים', 'Dogs')], ['cat', L('חתולים', 'Cats')],
    ['apartment', L('מתאים לדירה', 'Apartment Friendly')], ['kids', L('טוב עם ילדים', 'Good with Kids')],
    ['dogs', L('מסתדר עם כלבים', 'Dog Friendly')], ['cats', L('מסתדר עם חתולים', 'Cat Friendly')],
    ['low_shedding', L('נשירה נמוכה', 'Low Shedding')], ['special', L('צרכים מיוחדים', 'Special Needs')],
  ];

  const loading = view === 'browse' ? isLoading : view === 'saved' ? favorites.isLoading : matches.isLoading;

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen bg-white text-black">
      <EditorialHeader
        isHe={isHe}
        cornerStart={isHe ? ['מחר', 'מלא', 'חמלה'] : ['A more', 'compassionate', 'tomorrow']}
        cornerEnd={isHe ? ['אנשים', 'חיות', 'קהילות', 'טובות יותר'] : ['People', 'Pets', 'Kinder', 'Communities']}
        title={L('אימוץ חיות', 'Adopt a Pet')}
        subtitle={L('פלטפורמת אימוץ ללא עלות, לחברי PetWash.', 'A free members-only adoption platform.')}
        italic={isHe ? 'לכל נשמה מגיע בית.' : 'Every soul deserves a home.'}
      />

      <main className="mx-auto max-w-6xl px-3 sm:px-5">
        <div className="rounded-[28px] bg-white p-4 sm:p-6" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: '0 30px 60px -40px rgba(0,0,0,0.25)' }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: HAIRLINE }}>
            <div className="text-[13px] tracking-[0.2em] uppercase text-black/60">{L('אימוץ', 'Adopt')}</div>
            <div className="flex items-center gap-4">
              {user && (
                <Link href="/adoption/my">
                  <span className="cursor-pointer text-sm text-black/65 hover:text-black" data-testid="link-my-adoption">{L('האזור שלי', 'My adoption')}</span>
                </Link>
              )}
              <Link href="/adoption/new">
                <button className="rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: GOLD_INK }} data-testid="button-list-for-adoption">
                  {isHe ? 'פרסמו חיה לאימוץ ←' : 'List a pet for adoption ←'}
                </button>
              </Link>
            </div>
          </div>

          <div className="flex gap-6">
            <SideNav
              title={L('למצוא להם את הפרק הבא', 'Find Their Next Chapter')}
              subtitle={L('חיות אמיתיות. משפחות אמיתיות. מחר טוב יותר.', 'Real pets. Real families. A brighter tomorrow.')}
              items={navItems}
              active={view}
              onSelect={selectView}
              note={isHe ? ['בתים', 'טובים יותר', 'חיים', 'מאירים יותר'] : ['Better', 'Homes', 'Brighter', 'Lives']}
            />

            <div className="min-w-0 flex-1">
              <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
                {navItems.map((it) => <Chip key={it.key} active={view === it.key} onClick={() => selectView(it.key)}>{it.label}</Chip>)}
              </div>

              {view === 'profile' ? (
                <div className="space-y-4">
                  <AdopterProfileForm isHe={isHe} />
                  <Link href="/adoption/my"><span className="cursor-pointer text-sm underline">{L('המודעות והפניות שלי', 'My listings & enquiries')}</span></Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <Search className="h-4 w-4 text-black/45" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={L('חיפוש לפי שם, גזע או מיקום…', 'Search by name, breed or location…')}
                        className="w-full bg-transparent py-2.5 text-base outline-none"
                        data-testid="input-adoption-search"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl bg-white px-3 sm:w-56" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <MapPin className="h-4 w-4 text-black/45" />
                      <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-transparent py-2.5 text-base outline-none" data-testid="select-adoption-city">
                        <option value="">{L('כל הערים', 'All cities')}</option>
                        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {chips.map(([k, label]) => <Chip key={k} active={chip === k} onClick={() => setChip(k)} testId={`chip-${k}`}>{label}</Chip>)}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-black/60">
                    <span data-testid="adoption-count">{L(`${shown.length} חיות נמצאו`, `${shown.length} pets found`)}</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'name')} className="rounded-lg bg-white px-2 py-1.5 text-base" style={{ border: `1px solid ${HAIRLINE}` }}>
                      <option value="newest">{L('החדשים ביותר', 'Newest First')}</option>
                      <option value="oldest">{L('הוותיקים ביותר', 'Oldest First')}</option>
                      <option value="name">{L('לפי שם', 'Name')}</option>
                    </select>
                  </div>

                  {view === 'matches' && matches.data && !matches.data.profile ? (
                    <div className="mt-5"><AdopterProfileForm isHe={isHe} /></div>
                  ) : loading ? (
                    <div className="py-20 text-sm text-black/45" style={{ textAlign: 'center' }}>{L('טוען…', 'Loading…')}</div>
                  ) : isError && view === 'browse' ? (
                    <div className="py-20 text-sm text-black/55" style={{ textAlign: 'center' }}>{L('לא הצלחנו לטעון כרגע. נסו שוב.', 'Could not load right now. Please try again.')}</div>
                  ) : shown.length === 0 ? (
                    <div className="py-6">
                      <div className="mb-2 flex justify-center"><PetWashIcon name="brand_paw" size={30} label="" /></div>
                      <p className="text-sm text-black/60" style={{ textAlign: 'center' }}>
                        {view === 'saved' ? L('עוד לא שמרתם חיות. לחצו על הלב בכרטיס.', 'No saved pets yet. Tap the heart on a card.')
                          : view === 'matches' ? L('אין כרגע חיות שמתאימות לפרופיל שלכם.', 'No pets match your profile right now.')
                          : L('אין כרגע חיות הממתינות לאימוץ.', 'No pets are waiting for adoption right now.')}
                      </p>
                      {/* Nothing real to show → show what a real listing looks like,
                          labelled EXAMPLE on every card. Never invented pets. */}
                      {view === 'browse' && (
                        <ExamplePreview
                          isHe={isHe}
                          title={L('כך נראית מודעת אימוץ ב-PetWash', 'This is what an adoption listing looks like')}
                          subtitle={L('שלוש דוגמאות להמחשה — אין כאן חיות אמיתיות הממתינות לאימוץ.', 'Three examples for illustration — no real pets are waiting here.')}
                          cards={adoptionExamples(isHe)}
                          cta={{ href: '/adoption/new', label: isHe ? 'פרסמו חיה לאימוץ ←' : 'List a pet for adoption ←' }}
                          note={L('הדוגמאות נעלמות ברגע שמתפרסמת מודעה אמיתית אחת.', 'The examples disappear the moment one real listing is published.')}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {shown.map((l) => (
                        <div key={l.id} className="relative">
                          {view === 'matches' && (
                            <span className="absolute -top-2 z-10 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px]" style={{ insetInlineStart: 12, border: `1px solid ${GOLD}`, color: GOLD_INK }}>
                              <Sparkles className="h-3 w-3" /> {L('מתאים לבית שלכם', 'Great fit for your home')}
                            </span>
                          )}
                          <PetCard l={l} isHe={isHe} saved={savedIds.has(l.id)} onToggleSave={() => toggleSave(l.id)} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <PillarRow pillars={[
        { icon: <ShieldCheck className="h-6 w-6" />, title: L('מודעות מאומתות', 'Verified Listings'), body: L('כל מודעה נבדקת כדי להבטיח אימוץ אמיתי ואחראי.', 'All listings are reviewed to ensure genuine, responsible adoptions.') },
        { icon: <Heart className="h-6 w-6" />, title: L('התאמה חכמה', 'Smart Matching'), body: L('מוצאים חיות שמתאימות לאורח החיים שלכם.', 'Find pets that fit your lifestyle with intelligent recommendations.') },
        { icon: <MessageCircle className="h-6 w-6" />, title: L('פניות מאובטחות', 'Secure Enquiries'), body: L('יוצרים קשר בבטחה דרך מערכת ההודעות לחברים.', 'Connect safely through our members-only messaging system.') },
        { icon: <Home className="h-6 w-6" />, title: L('היכרות ואימוץ', 'Meet & Adopt'), body: L('מתאמים היכרות עם המטפלים ומעניקים לחיה בית לתמיד.', 'Arrange meetups with shelters or approved caregivers and give a pet their forever home.') },
      ]} />

      <StepsBand
        isHe={isHe}
        lead={L('חמישה צעדים פשוטים למחר טוב יותר.', 'Five simple steps to a brighter tomorrow.')}
        steps={[
          { icon: <Search className="h-5 w-5" />, title: L('מגלים', 'Browse'), body: L('חיות מדהימות בסביבתכם.', 'Explore amazing pets near you.') },
          { icon: <Heart className="h-5 w-5" />, title: L('מתאימים', 'Match'), body: L('מוצאים את ההתאמה הנכונה.', 'Find the right fit for your lifestyle.') },
          { icon: <MessageCircle className="h-5 w-5" />, title: L('פונים', 'Enquire'), body: L('פותחים שיחה בבטחה.', 'Start a conversation securely.') },
          { icon: <CalendarDays className="h-5 w-5" />, title: L('נפגשים', 'Meet'), body: L('מתאמים היכרות עם המטפלים.', 'Arrange a meetup with the current caregiver.') },
          { icon: <Home className="h-5 w-5" />, title: L('מאמצים', 'Adopt'), body: L('מקבלים אותם הביתה.', 'Welcome them home. Change a life forever.') },
        ]}
      />

      <ClosingBand
        isHe={isHe}
        image="/community/closing-dog.jpg"
        imageAlt=""
        heading={isHe ? ['חיים שונים.', 'מחר מאיר יותר.'] : ['Different lives.', 'A brighter tomorrow.']}
        caption={isHe ? ['אימוץ יוצר', 'אנשים מאושרים, חיות מאושרות,', 'קהילות טובות יותר.'] : ['Adoption creates', 'happier people, happier pets,', 'kinder communities.']}
        seal={isHe ? ['עולם', 'טוב יותר', 'לכל', 'חיה'] : ['A kinder', 'world', 'for every', 'pet']}
        footer={L('אימוץ חיות עוזר לחיות למצוא משפחה חדשה לתמיד.', 'Adopt a Pet helps pets find a new permanent family.')}
      />
    </div>
  );
}
