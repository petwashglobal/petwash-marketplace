import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ProviderProfilePage, getFAQsForPlatform } from '@/components/marketplace';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface Driver {
  id: number;
  userId: string;
  driverId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  licensePlate: string;
  maxPets: number;
  acceptsLargePets: boolean;
  hasCrate: boolean;
  hasAirConditioning: boolean;
  yearsOfExperience: number;
  pricePerKmCents: number;
  baseFareCents: number;
  profilePhotoUrl: string | null;
  vehiclePhotoUrl: string | null;
  rating: string;
  totalTrips: number;
  isActive: boolean;
  isVerified: boolean;
}

interface DriverReview {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  petType?: string;
}

export default function DriverDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const isHebrew = language === 'he';

  const { data: driverData, isLoading } = useQuery<{
    driver: Driver;
    reviews: DriverReview[];
  }>({
    queryKey: ['/api/pettrek/drivers', id],
  });

  const driver = driverData?.driver;
  const reviews = driverData?.reviews || [];

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
    navigate(`/pettrek/book?driver=${id}&mode=${serviceMode}&service=${serviceId}`);
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
    navigate(`/messages?to=driver-${id}`);
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

  if (!driver) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="text-6xl mb-6">🚗</div>
            <h2 className="text-2xl font-light text-gray-900 mb-2">
              {isHebrew ? 'נהג לא נמצא' : 'Driver not found'}
            </h2>
            <button 
              onClick={() => navigate('/pettrek')}
              className="mt-4 text-emerald-600 hover:underline"
            >
              {isHebrew ? 'חזור לרשימה' : 'Back to list'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const baseFare = (driver.baseFareCents || 2500) / 100;
  const pricePerKm = (driver.pricePerKmCents || 300) / 100;
  const faqItems = getFAQsForPlatform('driver');

  const vehicleInfo = driver.vehicleMake && driver.vehicleModel 
    ? `${driver.vehicleMake} ${driver.vehicleModel} (${driver.vehicleYear || 'N/A'})`
    : isHebrew ? 'רכב מאושר' : 'Approved Vehicle';

  return (
    <Layout>
      <ProviderProfilePage
        platform="driver"
        providerId={String(driver.id)}
        providerName={driver.fullName}
        tagline={isHebrew ? `נהג חיות מחמד מקצועי | ${vehicleInfo}` : `Professional Pet Driver | ${vehicleInfo}`}
        taglineHe={`נהג חיות מחמד מקצועי | ${vehicleInfo}`}
        location={driver.city}
        ratingAverage={parseFloat(driver.rating) || 5.0}
        reviewCount={reviews.length}
        completedBookings={driver.totalTrips || 0}
        yearsExperience={driver.yearsOfExperience || 1}
        responseTime="< 30 min"
        responseTimeHe="< 30 דקות"
        heroImageUrl={driver.profilePhotoUrl || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800'}
        galleryImages={[
          driver.vehiclePhotoUrl || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400',
          'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
          'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=400',
          'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
        ]}
        bio={driver.bio || (isHebrew 
          ? `שלום, אני ${driver.fullName}! אני נהג חיות מחמד מקצועי עם רכב מאובזר לנסיעות בטוחות ונוחות. אני מתמחה בהסעות לווטרינר, מספרות, שדות תעופה וכל יעד אחר. הרכב שלי כולל כלובי נשיאה מאובטחים ומיזוג אוויר.`
          : `Hi, I'm ${driver.fullName}! I'm a professional pet driver with a fully equipped vehicle for safe and comfortable transportation. I specialize in vet visits, groomer trips, airport transfers, and any destination. My vehicle includes secure carriers and climate control.`
        )}
        bioHe={`שלום, אני ${driver.fullName}! אני נהג חיות מחמד מקצועי עם רכב מאובזר לנסיעות בטוחות ונוחות. הרכב שלי כולל כלובי נשיאה מאובטחים ומיזוג אוויר.`}
        languages={['Hebrew', 'English']}
        acceptedPets={driver.acceptsLargePets 
          ? (isHebrew ? 'כלבים וחתולים (כל הגדלים)' : 'Dogs & Cats (all sizes)')
          : (isHebrew ? 'חיות מחמד קטנות עד בינוניות' : 'Small to medium pets')
        }
        acceptedPetsHe={driver.acceptsLargePets ? 'כלבים וחתולים (כל הגדלים)' : 'חיות מחמד קטנות עד בינוניות'}
        maxPetsPerBooking={driver.maxPets || 3}
        servicesAtProvider={[
          {
            id: 'standard-transport',
            label: 'Standard Transport',
            labelHe: 'הסעה רגילה',
            description: 'Safe, reliable pet transportation',
            descriptionHe: 'הסעת חיות מחמד בטוחה ואמינה',
            priceFrom: baseFare,
            priceUnit: 'base fare + per km',
            priceUnitHe: 'תעריף בסיס + לק"מ',
          },
          {
            id: 'vet-transport',
            label: 'Vet Visit Transport',
            labelHe: 'הסעה לווטרינר',
            description: 'Round trip to vet with waiting time',
            descriptionHe: 'הסעה הלוך-חזור לווטרינר כולל המתנה',
            priceFrom: Math.round(baseFare * 1.5),
            priceUnit: 'per trip',
            priceUnitHe: 'לנסיעה',
          },
        ]}
        servicesAtClient={[
          {
            id: 'premium-door-to-door',
            label: 'Premium Door-to-Door',
            labelHe: 'פרימיום מדלת לדלת',
            description: 'White-glove service with pet pickup from home',
            descriptionHe: 'שירות יוקרתי עם איסוף מהבית',
            priceFrom: Math.round(baseFare * 1.3),
            priceUnit: 'base fare + per km',
            priceUnitHe: 'תעריף בסיס + לק"מ',
          },
          {
            id: 'airport-transfer',
            label: 'Airport Transfer',
            labelHe: 'הסעה לשדה תעופה',
            description: 'Specialized airport transport with crate handling',
            descriptionHe: 'הסעה מיוחדת לשדה תעופה כולל טיפול בכלוב',
            priceFrom: Math.round(baseFare * 2),
            priceUnit: 'per trip',
            priceUnitHe: 'לנסיעה',
          },
          {
            id: 'multi-stop',
            label: 'Multi-Stop Trip',
            labelHe: 'נסיעה עם עצירות',
            description: 'Multiple destinations in one trip',
            descriptionHe: 'מספר יעדים בנסיעה אחת',
            priceFrom: Math.round(baseFare * 1.8),
            priceUnit: 'per trip',
            priceUnitHe: 'לנסיעה',
          },
        ]}
        addOns={[
          {
            id: 'extra-pet',
            label: 'Additional Pet',
            labelHe: 'חיית מחמד נוספת',
            description: 'Same household, same trip',
            priceFrom: Math.round(baseFare * 0.3),
          },
          {
            id: 'waiting-time',
            label: 'Extended Waiting',
            labelHe: 'המתנה מורחבת',
            description: 'Wait time over 15 min (per 15 min)',
            priceFrom: 15,
          },
          {
            id: 'crate-rental',
            label: 'Crate Rental',
            labelHe: 'השכרת כלוב נשיאה',
            description: 'Professional travel crate',
            priceFrom: 20,
          },
        ]}
        highlights={[
          driver.hasAirConditioning ? 'Climate-controlled vehicle' : 'Well-ventilated vehicle',
          driver.hasCrate ? 'Secure pet crates included' : 'Pet-friendly seating',
          'Real-time trip tracking via GPS',
          'Fully insured pet transport',
          'Trained in pet first aid',
          'Clean, sanitized vehicle',
        ]}
        highlightsHe={[
          driver.hasAirConditioning ? 'רכב ממוזג' : 'רכב מאוורר היטב',
          driver.hasCrate ? 'כלובי נשיאה מאובטחים כלולים' : 'ישיבה ידידותית לחיות מחמד',
          'מעקב נסיעה בזמן אמת עם GPS',
          'הסעת חיות מחמד מבוטחת במלואה',
          'מאומן בעזרה ראשונה לחיות מחמד',
          'רכב נקי ומחוטא',
        ]}
        verifiedBadges={[
          isHebrew ? 'בדיקת רקע' : 'Background Check',
          isHebrew ? 'רכב מבוטח' : 'Insured Vehicle',
          isHebrew ? 'רישיון נהיגה תקף' : 'Valid License',
          isHebrew ? 'מעקב GPS' : 'GPS Tracked',
        ]}
        reviews={reviews.map(r => ({
          id: String(r.id),
          name: r.customerName,
          date: new Date(r.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US'),
          rating: r.rating,
          text: r.comment,
          petType: r.petType,
        }))}
        faqItems={faqItems}
        isVerified={driver.isVerified}
        isTopRated={parseFloat(driver.rating) >= 4.8}
        language={language as 'en' | 'he'}
        onBook={handleBook}
        onMessage={handleMessage}
      />
    </Layout>
  );
}
