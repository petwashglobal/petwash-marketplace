import { useParams, Link, useLocation } from "wouter";
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

const mockTrainerImages = [
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1587764379873-97837921fd44?w=400&h=300&fit=crop",
];

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

const mockReviews: Review[] = [
  {
    id: "1",
    authorName: "יוסי כהן",
    authorImage: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 5,
    comment: "המאלף הכי מקצועי שפגשנו! הכלב שלנו השתנה לחלוטין תוך חודש אחד",
    commentEn: "The most professional trainer we've met! Our dog completely transformed within one month",
    date: "2025-01-15",
  },
  {
    id: "2",
    authorName: "מיכל לוי",
    authorImage: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 5,
    comment: "סבלני, מקצועי ומבין כלבים. ממליצה בחום",
    commentEn: "Patient, professional and understands dogs. Highly recommend",
    date: "2025-01-10",
  },
  {
    id: "3",
    authorName: "David Chen",
    authorImage: "https://randomuser.me/api/portraits/men/67.jpg",
    rating: 5,
    comment: "Amazing transformation for our reactive dog. Thank you!",
    commentEn: "Amazing transformation for our reactive dog. Thank you!",
    date: "2025-01-05",
  },
];

export default function TrainerDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  
  const faqItems = getFAQsForPlatform('trainer', language);

  const trainerData: ProviderProfileData = {
    id: id || "trainer-1",
    name: "דניאל שפירא",
    nameEn: "Daniel Shapira",
    title: "מאלף כלבים מוסמך",
    titleEn: "Certified Dog Trainer",
    location: "תל אביב",
    locationEn: "Tel Aviv",
    rating: 4.9,
    reviewCount: 156,
    responseTime: "1 שעה",
    responseTimeEn: "1 hour",
    yearsExperience: 12,
    images: mockTrainerImages,
    bio: "מאלף כלבים מוסמך עם ניסיון של 12 שנה. מתמחה באילוף גורים, שינוי התנהגות ואילוף מתקדם. גישה חיובית ומבוססת מדע.",
    bioEn: "Certified dog trainer with 12 years of experience. Specializing in puppy training, behavioral modification, and advanced obedience. Positive, science-based approach.",
    highlights: [
      { icon: "shield", label: "מאלף מוסמך", labelEn: "Certified Trainer" },
      { icon: "award", label: "12 שנות ניסיון", labelEn: "12 Years Experience" },
      { icon: "star", label: "דירוג 4.9", labelEn: "4.9 Rating" },
      { icon: "check", label: "156 הצלחות", labelEn: "156 Success Stories" },
    ],
    languages: ["עברית", "English"],
    isVerified: true,
    isPremium: true,
    badges: [
      { type: "certified", label: "מאלף מוסמך", labelEn: "Certified Trainer" },
      { type: "premium", label: "Pet Academy™ Elite", labelEn: "Pet Academy™ Elite" },
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
          reviews={mockReviews}
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
