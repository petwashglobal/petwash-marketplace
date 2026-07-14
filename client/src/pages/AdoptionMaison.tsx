/**
 * Adoption maison — LVMH-luxury listings for pets looking for a forever home.
 *
 * Reuses the PawFinder engine end-to-end (post_type='adoption' on paw_finder_posts):
 * same intake, photo upload, 3-stage safety scan, public viewing and contact. This
 * page is the boutique storefront for those listings.
 *
 * RTL DISCIPLINE (PetWash is Hebrew-first): the whole surface is dir="rtl",
 * everything anchors from the RIGHT (never the left), the ™ wordmark sits
 * top-CENTER, and "forward/more" arrows point LEFT (←) because forward = leftward
 * in RTL. Brand palette: pure white, black text, one metallic-gold (#D4AF37) hairline.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Heart } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { PetWashIcon } from '@/components/PetWashIcon';
import { useSEO, pageSEO } from '@/lib/seo';

const GOLD = '#D4AF37';

interface AdoptionPost {
  id: number;
  pet_name?: string;
  breed?: string;
  city: string;
  description: string;
  primary_media?: string | null;
  reward_amount?: string | null;
}

export default function AdoptionMaison() {
  useSEO(pageSEO.adoption);
  const { language } = useLanguage();
  const isHe = language === 'he';

  const { data, isLoading, isError } = useQuery<{ posts?: AdoptionPost[] } | AdoptionPost[]>({
    queryKey: ['/api/paw-finder/posts?postType=adoption'],
    queryFn: async () => {
      const r = await fetch('/api/paw-finder/posts?postType=adoption', { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });
  const posts: AdoptionPost[] = Array.isArray(data) ? data : (data?.posts ?? []);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-black">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="px-6 pt-12 pb-8 text-center">
        {/* ™ wordmark — top-center ("crown"), never modified */}
        <div className="text-sm tracking-[0.2px] font-serif">PetWash™</div>
        <div className="mt-6 text-[11px] tracking-[4px]" style={{ color: '#9A7B2E' }}>אימוץ · ADOPTION</div>
        <h1 className="mt-3 font-serif font-normal leading-tight text-black" style={{ fontSize: 'clamp(2rem, 8vw, 3.25rem)' }}>
          {isHe ? 'לכל נשמה מגיע בית.' : 'Every soul deserves a home.'}
        </h1>
        <div className="mx-auto my-5 h-px w-12" style={{ backgroundColor: GOLD }} />
        <p className="mx-auto max-w-md text-sm leading-relaxed text-black/60">
          {isHe
            ? 'פלטפורמה ללא עלות לחיבור בין חיות הממתינות לאימוץ למשפחות אוהבות. כל פוסט נבדק.'
            : 'A free portal connecting pets waiting for adoption with loving families. Every listing is checked.'}
        </p>
        <div className="mt-7">
          <Link href="/paw-finder">
            <button
              className="text-sm font-medium text-black pb-1 transition-opacity hover:opacity-60"
              style={{ borderBottom: `1px solid ${GOLD}` }}
              data-testid="button-list-for-adoption"
            >
              {isHe ? 'פרסמו חיה לאימוץ ←' : 'List a pet for adoption ←'}
            </button>
          </Link>
        </div>
      </header>

      {/* ── Listings ─────────────────────────────────────────────────────── */}
      <main className="px-4 pb-16 max-w-3xl mx-auto">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-black/40">{isHe ? 'טוען…' : 'Loading…'}</div>
        ) : isError ? (
          <div className="py-20 text-center text-sm text-black/55">{isHe ? 'לא הצלחנו לטעון כרגע. נסו שוב.' : 'Could not load right now. Please try again.'}</div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-2 flex justify-center"><PetWashIcon name="brand_paw" size={30} label="" /></div>
            <p className="text-sm text-black/60">{isHe ? 'אין כרגע חיות הממתינות לאימוץ. בקרו שוב בקרוב.' : 'No pets awaiting adoption right now. Check back soon.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((p) => (
              <article key={p.id} className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E6E2D8' }} data-testid={`adoption-card-${p.id}`}>
                <div className="h-44 bg-[#F4F1EA] flex items-center justify-center overflow-hidden">
                  {p.primary_media
                    ? <img src={p.primary_media} alt={p.pet_name || ''} className="w-full h-full object-cover" />
                    : <PetWashIcon name="brand_paw" size={40} label={p.pet_name || 'Pet'} />}
                </div>
                <div className="p-4">
                  <div className="font-serif text-lg leading-tight">{p.pet_name || (isHe ? 'חיה לאימוץ' : 'For adoption')}</div>
                  <div className="mt-1 text-xs text-black/55">
                    {[p.breed, p.city].filter(Boolean).join(' · ')}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-black/65 line-clamp-2">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Link href={`/paw-finder`}>
                      <span className="text-xs text-black pb-0.5" style={{ borderBottom: `1px solid ${GOLD}` }}>
                        {isHe ? 'להכרות ←' : 'Meet ←'}
                      </span>
                    </Link>
                    <Heart className="w-4 h-4" style={{ color: '#C9C4B5' }} aria-hidden="true" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-[11px] tracking-[1px] text-black/45">
          {isHe ? 'כל חיה נבדקת · אימוץ אחראי · מבית PetWash™' : 'Every pet checked · Responsible adoption · By PetWash™'}
        </p>
      </main>
    </div>
  );
}
