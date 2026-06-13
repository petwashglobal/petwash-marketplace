import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/lib/languageStore";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { 
  ProviderProfilePage, 
  getFAQsForPlatform,
  type ProviderProfileData,
  type ServiceItem,
  type AddOn,
  type Review
} from "@/components/marketplace";

const trainerServices: ServiceItem[] = [
  {
    id: "basic-training",
    name: "Basic Obedience",
    nameHe: "אילוף בסיסי",
    description: "Essential commands: sit, stay, come, heel",
    descriptionHe: "פקודות בסיסיות: שב, הישאר, בוא, הלוך ברגל",
    price: 165,
    duration: "60 min",
    durationHe: "60 דקות",
  },
  {
    id: "puppy-training",
    name: "Puppy Training",
    nameHe: "אילוף גורים",
    description: "Foundation training for puppies 8-16 weeks",
    descriptionHe: "אימון יסודות לגורים בני 8-16 שבועות",
    price: 165,
    duration: "45 min",
    durationHe: "45 דקות",
  },
  {
    id: "behavioral",
    name: "Behavioral Modification",
    nameHe: "שינוי התנהגותי",
    description: "Address aggression, fear, anxiety issues",
    descriptionHe: "טיפול בבעיות תוקפנות, פחד וחרדה",
    price: 275,
    duration: "90 min",
    durationHe: "90 דקות",
  },
  {
    id: "advanced",
    name: "Advanced Training",
    nameHe: "אילוף מתקדם",
    description: "Off-leash control, tricks, agility basics",
    descriptionHe: "שליטה ללא רצועה, טריקים, יסודות אג'יליטי",
    price: 275,
    duration: "75 min",
    durationHe: "75 דקות",
  },
  {
    id: "intensive",
    name: "Intensive Boot Camp",
    nameHe: "מחנה אימונים אינטנסיבי",
    description: "Week-long immersive training program",
    descriptionHe: "תוכנית אימונים אינטנסיבית של שבוע",
    price: 550,
    duration: "5 days",
    durationHe: "5 ימים",
  },
];

const trainerAddOns: AddOn[] = [
  {
    id: "video-report",
    name: "Video Progress Report",
    nameHe: "דוח התקדמות בוידאו",
    price: 55,
  },
  {
    id: "home-visit",
    name: "In-Home Training Session",
    nameHe: "אימון בבית הלקוח",
    price: 55,
  },
  {
    id: "clicker-kit",
    name: "Clicker Training Kit",
    nameHe: "ערכת אימון קליקר",
    price: 55,
  },
  {
    id: "followup",
    name: "30-Day Follow-up Support",
    nameHe: "תמיכה למעקב 30 יום",
    price: 165,
  },
];

// PR-FAKE (2026-06-13): removed the hardcoded mockReviews (fake testimonials
// with randomuser.me avatars). Real reviews are now fetched from the backend
// (GET /api/academy/trainers/:id → { reviews } from contractor_reviews) and
// mapped to the Review shape below; when there are none, ProviderProfilePage
// simply hides the reviews section (no fake content shown).

export default function TrainerDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  
  const faqItems = getFAQsForPlatform('trainer');

  // Real reviews from the backend (contractor_reviews via GET /api/academy/trainers/:id).
  // No fake testimonials — empty list → ProviderProfilePage hides the reviews section.
  const { data: trainerResponse, isLoading, isError } = useQuery<{ trainer?: any; reviews?: any[] }>({
    queryKey: [`/api/academy/trainers/${id}`],
    enabled: !!id,
  });
  const t = trainerResponse?.trainer;
  const realReviews: Review[] = (trainerResponse?.reviews ?? []).map((r: any) => ({
    id: String(r.id ?? r.reviewId ?? ''),
    name: r.reviewerName || (isHebrew ? 'לקוח' : 'Customer'),
    date: r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    rating: Number(r.overallRating ?? 0),
    text: r.reviewText || '',
  }));

  // Loading / not-found — no more rendering a hardcoded "Daniel Shapira" for
  // every id. While loading show a spinner; if the trainer doesn't exist (404)
  // show an honest not-found.
  if (isLoading || (!trainerResponse && !isError)) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C5A55A]" />
        </div>
      </Layout>
    );
  }
  if (isError || !t) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-4">
          <div className="text-6xl mb-6">🐾</div>
          <h2 className="text-2xl font-light text-gray-900 mb-4">{isHebrew ? 'המאלף לא נמצא' : 'Trainer not found'}</h2>
          <Button onClick={() => navigate('/academy')} className="bg-[#C5A55A] hover:bg-[#b8945a] text-white">
            {isHebrew ? 'חזרה לאקדמיה' : 'Back to Academy'}
          </Button>
        </div>
      </Layout>
    );
  }

  // Map the REAL trainer record (GET /api/academy/trainers/:id) → profile shape.
  // Only real fields; no invented person, photos, rating or review counts.
  const ratingNum = Number(t.averageRating ?? 0);
  const years = t.yearsOfExperience ?? t.experienceYears ?? 0;
  const fullName = (t.fullName || `${t.firstName || ''} ${t.lastName || ''}`).trim() || (isHebrew ? 'מאלף' : 'Trainer');
  const title = t.isCertified ? (isHebrew ? 'מאלף כלבים מוסמך' : 'Certified Dog Trainer') : (isHebrew ? 'מאלף כלבים' : 'Dog Trainer');
  const titleEn = t.isCertified ? 'Certified Dog Trainer' : 'Dog Trainer';
  const loc = t.city || t.serviceArea || 'Israel';

  const trainerData: ProviderProfileData = {
    id: id || String(t.id),
    name: fullName,
    nameEn: fullName,
    title,
    titleEn,
    location: loc,
    locationEn: loc,
    rating: ratingNum,
    reviewCount: t.totalReviews ?? realReviews.length,
    responseTime: isHebrew ? 'תוך 24 שעות' : 'within 24h',
    responseTimeEn: 'within 24h',
    yearsExperience: years,
    images: t.profilePhotoUrl ? [t.profilePhotoUrl] : [],
    bio: t.bioHe || t.bio || '',
    bioEn: t.bio || '',
    highlights: [
      ...(t.isCertified ? [{ icon: 'shield', label: 'מאלף מוסמך', labelEn: 'Certified Trainer' }] : []),
      ...(years ? [{ icon: 'award', label: `${years} שנות ניסיון`, labelEn: `${years} Years Experience` }] : []),
      ...(ratingNum > 0 ? [{ icon: 'star', label: `דירוג ${ratingNum.toFixed(1)}`, labelEn: `${ratingNum.toFixed(1)} Rating` }] : []),
      ...(t.totalSessions ? [{ icon: 'check', label: `${t.totalSessions} אילופים`, labelEn: `${t.totalSessions} Sessions` }] : []),
    ],
    languages: Array.isArray(t.languages) && t.languages.length ? t.languages : ['עברית', 'English'],
    isVerified: t.verificationStatus === 'approved',
    isPremium: !!t.isCertified,
    badges: [
      ...(t.isCertified ? [{ type: 'certified' as const, label: 'מאלף מוסמך', labelEn: 'Certified Trainer' }] : []),
    ],
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {user && (
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="p-4 bg-gradient-to-l from-[#C5A55A]/10 to-amber-50 border border-[#C5A55A]/30 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {isHebrew ? "כמה כלבים? תוכנית אישית?" : "Multiple dogs? Custom training plan?"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isHebrew ? "השתמש בתהליך הזמנה המתקדם עם ציטוט מחיר חי" : "Use the advanced booking flow with live quote"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate(`/booking/new/training/${id}`)}
                className="bg-[#C5A55A] hover:bg-[#b8945a] text-white shrink-0 text-xs px-4"
              >
                {isHebrew ? "הזמן ←" : "Book →"}
              </Button>
            </div>
          </div>
        )}
        <div className="container mx-auto px-4 pt-6">
          <Link href="/academy">
            <Button 
              variant="ghost" 
              className="gap-2 text-gray-600 hover:text-gray-900"
              data-testid="back-to-academy"
            >
              <ArrowLeft className="h-4 w-4" />
              {isHebrew ? 'חזרה לאקדמיה' : 'Back to Academy'}
            </Button>
          </Link>
        </div>

        <ProviderProfilePage
          provider={trainerData}
          services={trainerServices}
          addOns={trainerAddOns}
          reviews={realReviews}
          faqItems={faqItems}
          platform="trainer"
          language={language}
          serviceModeLabels={{
            atProvider: isHebrew ? 'במתקן המאלף' : "At trainer's facility",
            atClient: isHebrew ? 'אצל הלקוח' : "At your home",
          }}
          bookingPath={`/academy/book/${id}`}
          backPath="/academy"
          breadcrumbs={[
            { label: isHebrew ? 'ראשי' : 'Home', path: '/' },
            { label: 'Pet Academy™', path: '/academy' },
            { label: trainerData.name, path: '#' },
          ]}
        />
      </div>
    </Layout>
  );
}
