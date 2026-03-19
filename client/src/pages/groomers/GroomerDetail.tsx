import { Button } from "@/components/ui/button";
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ProviderProfilePage, getFAQsForPlatform } from '@/components/marketplace';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface Groomer {
  id: number;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  salonName: string;
  salonAddress: string;
  bio: string;
  specialties: string[];
  certifications: string[];
  yearsOfExperience: number;
  priceRangeMin: number;
  priceRangeMax: number;
  hasMobileService: boolean;
  acceptsLargeDogs: boolean;
  acceptsCats: boolean;
  acceptsExoticPets: boolean;
  profilePhotoUrl: string | null;
  salonPhotos: string[];
  rating: string;
  totalGroomings: number;
  isActive: boolean;
  isVerified: boolean;
}

interface GroomerReview {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  petType?: string;
  serviceType?: string;
}

export default function GroomerDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const isHebrew = language === 'he';

  const { data: groomerData, isLoading } = useQuery<{
    groomer: Groomer;
    reviews: GroomerReview[];
  }>({
    queryKey: [`/api/groomers/${id}`],
  });

  const groomer = groomerData?.groomer;
  const reviews = groomerData?.reviews || [];

  const handleBook = (serviceMode: 'providerLocation' | 'clientLocation', serviceId: string) => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי להזמין' : 'Please log in to book',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }
    navigate(`/groomers/book?groomer=${id}&mode=${serviceMode}&service=${serviceId}`);
  };

  const handleMessage = () => {
    if (!user) {
      toast({
        title: isHebrew ? 'נדרש התחברות' : 'Login Required',
        description: isHebrew ? 'אנא התחבר כדי לשלוח הודעה' : 'Please log in to send a message',
        variant: 'destructive',
      });
      navigate('/signin');
      return;
    }
    navigate(`/messages?to=groomer-${id}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4" />
            <p className="text-gray-500">{isHebrew ? 'טוען...' : 'Loading...'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!groomer) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="text-6xl mb-6">✂️</div>
            <h2 className="text-2xl font-light text-gray-900 mb-2">
              {isHebrew ? 'מטפח לא נמצא' : 'Groomer not found'}
            </h2>
            <Button 
              onClick={() => navigate('/groomers')}
              className="mt-4 text-emerald-600 hover:underline"
            >
              {isHebrew ? 'חזור לרשימה' : 'Back to list'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const priceMin = groomer.priceRangeMin || 80;
  const priceMax = groomer.priceRangeMax || 250;
  const faqItems = getFAQsForPlatform('groomer');

  const acceptedPetsList: string[] = [];
  if (groomer.acceptsLargeDogs !== false) acceptedPetsList.push(isHebrew ? 'כלבים' : 'Dogs');
  if (groomer.acceptsCats) acceptedPetsList.push(isHebrew ? 'חתולים' : 'Cats');
  if (groomer.acceptsExoticPets) acceptedPetsList.push(isHebrew ? 'חיות אקזוטיות' : 'Exotic Pets');
  const acceptedPets = acceptedPetsList.join(' · ') || (isHebrew ? 'כלבים' : 'Dogs');

  return (
    <Layout>
      {user && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="p-4 bg-gradient-to-l from-[#C5A55A]/10 to-amber-50 border border-[#C5A55A]/30 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {isHebrew ? "מספר חיות? שירותים נוספים?" : "Multiple pets or extra services?"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isHebrew ? "השתמש בתהליך הזמנה המתקדם עם ציטוט מחיר חי" : "Use the advanced booking flow with live quote"}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate(`/booking/new/grooming/${groomer.userId}`)}
              className="bg-[#C5A55A] hover:bg-[#b8945a] text-white shrink-0 text-xs px-4"
            >
              {isHebrew ? "הזמן ←" : "Book →"}
            </Button>
          </div>
        </div>
      )}
      <ProviderProfilePage
        platform="groomer"
        providerId={String(groomer.id)}
        providerName={groomer.fullName}
        tagline={groomer.salonName 
          ? (isHebrew ? `מטפח ב-${groomer.salonName}` : `Groomer at ${groomer.salonName}`)
          : (isHebrew ? 'מטפח חיות מחמד מקצועי' : 'Professional Pet Groomer')
        }
        taglineHe={groomer.salonName ? `מטפח ב-${groomer.salonName}` : 'מטפח חיות מחמד מקצועי'}
        location={groomer.salonAddress || groomer.city}
        ratingAverage={parseFloat(groomer.rating) || 5.0}
        reviewCount={reviews.length}
        completedBookings={groomer.totalGroomings || 0}
        yearsExperience={groomer.yearsOfExperience || 1}
        responseTime="< 2 hours"
        responseTimeHe="< 2 שעות"
        heroImageUrl={groomer.profilePhotoUrl || 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800'}
        galleryImages={groomer.salonPhotos?.length ? groomer.salonPhotos.slice(0, 4) : [
          'https://images.unsplash.com/photo-1629740067905-bd3f515aa739?w=400',
          'https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=400',
          'https://images.unsplash.com/photo-1581888227599-779811939961?w=400',
          'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400',
        ]}
        bio={groomer.bio || (isHebrew 
          ? `שלום, אני ${groomer.fullName}! אני מטפח חיות מחמד מקצועי עם תשוקה לגרום לחיות מחמד להיראות ולהרגיש הכי טוב שלהן. אני משתמש רק במוצרים אורגניים ועדינים על העור. כל טיפוח מותאם אישית לצרכים הייחודיים של כל חיית מחמד.`
          : `Hi, I'm ${groomer.fullName}! I'm a professional pet groomer with a passion for making pets look and feel their best. I use only organic, skin-gentle products. Every grooming session is tailored to each pet's unique needs.`
        )}
        bioHe={`שלום, אני ${groomer.fullName}! אני מטפח חיות מחמד מקצועי עם תשוקה לגרום לחיות מחמד להיראות ולהרגיש הכי טוב שלהן. אני משתמש רק במוצרים אורגניים ועדינים על העור.`}
        languages={['Hebrew', 'English']}
        acceptedPets={acceptedPets}
        acceptedPetsHe={acceptedPetsList.join(' · ') || 'כלבים'}
        maxPetsPerBooking={2}
        servicesAtProvider={[
          {
            id: 'bath-blowdry',
            label: 'Bath & Blow Dry',
            labelHe: 'רחצה וייבוש',
            description: 'Full bath with premium organic shampoo & conditioning',
            descriptionHe: 'רחצה מלאה עם שמפו אורגני פרימיום ומרכך',
            priceFrom: priceMin,
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
          {
            id: 'full-groom',
            label: 'Full Grooming',
            labelHe: 'טיפוח מלא',
            description: 'Bath, haircut, styling, nails, ears & teeth',
            descriptionHe: 'רחצה, תספורת, עיצוב, ציפורניים, אוזניים ושיניים',
            priceFrom: Math.round((priceMin + priceMax) / 2),
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
          {
            id: 'luxury-spa',
            label: 'Luxury Spa Package',
            labelHe: 'חבילת ספא יוקרתית',
            description: 'Full groom + deep conditioning, massage & aromatherapy',
            descriptionHe: 'טיפוח מלא + מרכך עמוק, עיסוי וארומתרפיה',
            priceFrom: priceMax,
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
        ]}
        servicesAtClient={groomer.hasMobileService ? [
          {
            id: 'mobile-bath',
            label: 'Mobile Bath & Dry',
            labelHe: 'רחצה ניידת',
            description: 'Full bath service at your home',
            descriptionHe: 'שירות רחצה מלא בבית שלך',
            priceFrom: Math.round(priceMin * 1.3),
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
          {
            id: 'mobile-full-groom',
            label: 'Mobile Full Grooming',
            labelHe: 'טיפוח מלא נייד',
            description: 'Complete grooming in our mobile salon van',
            descriptionHe: 'טיפוח מלא בוואן הסלון הנייד שלנו',
            priceFrom: Math.round(((priceMin + priceMax) / 2) * 1.3),
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
          {
            id: 'mobile-spa',
            label: 'Mobile Spa Experience',
            labelHe: 'חוויית ספא ניידת',
            description: 'Premium spa treatment at your doorstep',
            descriptionHe: 'טיפול ספא פרימיום בפתח הדלת שלך',
            priceFrom: Math.round(priceMax * 1.4),
            priceUnit: 'per session',
            priceUnitHe: 'לטיפול',
          },
        ] : [
          {
            id: 'in-salon-only',
            label: 'Salon Visits Only',
            labelHe: 'ביקורים בסלון בלבד',
            description: 'This groomer offers in-salon services only',
            descriptionHe: 'מטפח זה מציע שירותים בסלון בלבד',
            priceFrom: priceMin,
            priceUnit: 'visit salon',
            priceUnitHe: 'בקר בסלון',
          },
        ]}
        addOns={[
          {
            id: 'nail-grinding',
            label: 'Nail Grinding',
            labelHe: 'שיוף ציפורניים',
            description: 'Smooth finish after nail trim',
            priceFrom: 15,
          },
          {
            id: 'teeth-brushing',
            label: 'Teeth Brushing',
            labelHe: 'צחצוח שיניים',
            description: 'Fresh breath treatment',
            priceFrom: 20,
          },
          {
            id: 'deshedding',
            label: 'De-shedding Treatment',
            labelHe: 'טיפול נגד נשירה',
            description: 'Deep undercoat removal',
            priceFrom: 35,
          },
          {
            id: 'flea-treatment',
            label: 'Flea & Tick Treatment',
            labelHe: 'טיפול נגד פרעושים',
            description: 'Medicated bath with preventive',
            priceFrom: 40,
          },
        ]}
        highlights={[
          'Premium organic, skin-gentle products',
          'Calm, stress-free grooming environment',
          'Breed-specific styling expertise',
          groomer.certifications?.length ? `${groomer.certifications.length}+ professional certifications` : 'Professionally certified',
          'Before & after photos provided',
          'Flexible appointment scheduling',
        ]}
        highlightsHe={[
          'מוצרים אורגניים פרימיום, עדינים לעור',
          'סביבת טיפוח רגועה וללא לחץ',
          'מומחיות בעיצוב ייחודי לגזע',
          groomer.certifications?.length ? `${groomer.certifications.length}+ הסמכות מקצועיות` : 'מוסמך מקצועית',
          'תמונות לפני ואחרי מסופקות',
          'תזמון פגישות גמיש',
        ]}
        verifiedBadges={[
          isHebrew ? 'בדיקת רקע' : 'Background Check',
          isHebrew ? 'מבוטח' : 'Insured',
          ...(groomer.certifications?.slice(0, 2) || []),
          groomer.hasMobileService ? (isHebrew ? 'שירות נייד' : 'Mobile Service') : (isHebrew ? 'סלון' : 'Salon'),
        ]}
        reviews={reviews.map(r => ({
          id: String(r.id),
          name: r.customerName,
          date: new Date(r.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US'),
          rating: r.rating,
          text: r.comment,
          petType: r.petType || r.serviceType,
        }))}
        faqItems={faqItems}
        isVerified={groomer.isVerified}
        isTopRated={parseFloat(groomer.rating) >= 4.8}
        language={language as 'en' | 'he'}
        onBook={handleBook}
        onMessage={handleMessage}
      />
    </Layout>
  );
}
