import { Button } from "@/components/ui/button";
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ProviderProfilePage, getFAQsForPlatform } from '@/components/marketplace';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface Walker {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  yearsOfExperience: number;
  pricePerWalkCents: number;
  profilePictureUrl: string | null;
  rating: string;
  totalWalks: number;
  isActive: boolean;
  isVerified: boolean;
}

interface WalkerReview {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  petType?: string;
}

export default function WalkerDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const isHebrew = language === 'he';

  const { data: walkerData, isLoading } = useQuery<{
    walker: Walker;
    reviews: WalkerReview[];
  }>({
    queryKey: [`/api/walk-my-pet/walkers/${id}`],
  });

  const walker = walkerData?.walker;
  const reviews = walkerData?.reviews || [];

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
    navigate(`/walk-my-pet/book/${id}?mode=${serviceMode}&service=${serviceId}`);
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
    navigate(`/messages?to=walker-${id}`);
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

  if (!walker) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="text-6xl mb-6">🐕</div>
            <h2 className="text-2xl font-light text-gray-900 mb-2">
              {isHebrew ? 'מטייל לא נמצא' : 'Walker not found'}
            </h2>
            <Button 
              onClick={() => navigate('/walk-my-pet')}
              className="mt-4 text-emerald-600 hover:underline"
            >
              {isHebrew ? 'חזור לרשימה' : 'Back to list'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const pricePerWalk = walker.pricePerWalkCents / 100;
  const faqItems = getFAQsForPlatform('walker');

  return (
    <Layout>
      <ProviderProfilePage
        platform="walker"
        providerId={String(walker.id)}
        providerName={`${walker.firstName} ${walker.lastName}`}
        tagline={isHebrew ? 'מטייל כלבים מקצועי' : 'Professional Dog Walker'}
        taglineHe="מטייל כלבים מקצועי"
        location={walker.city}
        ratingAverage={parseFloat(walker.rating) || 5.0}
        reviewCount={reviews.length}
        completedBookings={walker.totalWalks || 0}
        yearsExperience={walker.yearsOfExperience || 1}
        responseTime="< 1 hour"
        responseTimeHe="< שעה"
        heroImageUrl={walker.profilePictureUrl || 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800'}
        galleryImages={[
          'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400',
          'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
          'https://images.unsplash.com/photo-1601758174493-89c7f6e39b1a?w=400',
          'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400',
        ]}
        bio={walker.bio || (isHebrew 
          ? `שלום, אני ${walker.firstName}! אני מטייל כלבים מקצועי עם אהבה אמיתית לכלבים. כל טיול הוא הרפתקה מותאמת אישית לצרכים של הכלב שלך. אני מציע טיולים בטוחים, מהנים ומותאמים לכל גודל וגיל. כל כלב מקבל את תשומת הלב שהוא צריך.`
          : `Hi, I'm ${walker.firstName}! I'm a professional dog walker with a genuine love for dogs. Every walk is an adventure tailored to your dog's needs. I offer safe, fun walks customized for every size and age. Each dog gets the attention they deserve.`
        )}
        bioHe={`שלום, אני ${walker.firstName}! אני מטייל כלבים מקצועי עם אהבה אמיתית לכלבים. כל טיול הוא הרפתקה מותאמת אישית לצרכים של הכלב שלך.`}
        languages={['Hebrew', 'English']}
        acceptedPets="Dogs (all sizes)"
        acceptedPetsHe="כלבים (כל הגדלים)"
        maxPetsPerBooking={4}
        servicesAtProvider={[
          {
            id: 'group-walk-30',
            label: '30-min Group Walk',
            labelHe: 'טיול קבוצתי 30 דקות',
            description: 'Social walk with up to 4 friendly dogs',
            descriptionHe: 'טיול חברתי עם עד 4 כלבים ידידותיים',
            priceFrom: Math.round(pricePerWalk * 0.7),
            priceUnit: 'per walk',
            priceUnitHe: 'לטיול',
          },
          {
            id: 'group-walk-60',
            label: '60-min Group Walk',
            labelHe: 'טיול קבוצתי 60 דקות',
            description: 'Extended adventure with playtime',
            descriptionHe: 'הרפתקה מורחבת עם זמן משחק',
            priceFrom: pricePerWalk,
            priceUnit: 'per walk',
            priceUnitHe: 'לטיול',
          },
        ]}
        servicesAtClient={[
          {
            id: 'private-walk-30',
            label: '30-min Private Walk',
            labelHe: 'טיול פרטי 30 דקות',
            description: 'One-on-one attention from your home',
            descriptionHe: 'תשומת לב אחד-על-אחד מהבית שלך',
            priceFrom: pricePerWalk,
            priceUnit: 'per walk',
            priceUnitHe: 'לטיול',
          },
          {
            id: 'private-walk-60',
            label: '60-min Private Walk',
            labelHe: 'טיול פרטי 60 דקות',
            description: 'Extended private adventure',
            descriptionHe: 'הרפתקה פרטית מורחבת',
            priceFrom: Math.round(pricePerWalk * 1.5),
            priceUnit: 'per walk',
            priceUnitHe: 'לטיול',
          },
          {
            id: 'puppy-walk',
            label: 'Puppy Walk (15-min)',
            labelHe: 'טיול גורים (15 דקות)',
            description: 'Short, gentle walks for puppies',
            descriptionHe: 'טיולים קצרים ועדינים לגורים',
            priceFrom: Math.round(pricePerWalk * 0.5),
            priceUnit: 'per walk',
            priceUnitHe: 'לטיול',
          },
        ]}
        addOns={[
          {
            id: 'photo-updates',
            label: 'Photo Updates',
            labelHe: 'עדכוני תמונות',
            description: 'Get photos during the walk',
            priceFrom: 0,
          },
          {
            id: 'extra-dog',
            label: 'Additional Dog',
            labelHe: 'כלב נוסף',
            description: 'Add another dog from same household',
            priceFrom: Math.round(pricePerWalk * 0.3),
          },
          {
            id: 'training-reinforcement',
            label: 'Training Reinforcement',
            labelHe: 'חיזוק אימון',
            description: 'Practice basic commands during walk',
            priceFrom: 15,
          },
        ]}
        highlights={[
          'GPS-tracked routes shared after every walk',
          'Certified in pet first aid',
          'Flexible scheduling - same day available',
          'Secure key handling',
          'Regular updates and photos',
          'Familiar with all dog breeds',
        ]}
        highlightsHe={[
          'מסלולים עם GPS משותפים לאחר כל טיול',
          'מוסמך בעזרה ראשונה לחיות מחמד',
          'תזמון גמיש - זמין באותו יום',
          'טיפול מאובטח במפתחות',
          'עדכונים ותמונות קבועים',
          'מכיר את כל גזעי הכלבים',
        ]}
        verifiedBadges={[
          isHebrew ? 'בדיקת רקע' : 'Background Check',
          isHebrew ? 'מבוטח' : 'Insured',
          isHebrew ? 'עזרה ראשונה' : 'First Aid Certified',
          isHebrew ? 'מאומת GPS' : 'GPS Verified',
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
        isVerified={walker.isVerified}
        isTopRated={parseFloat(walker.rating) >= 4.8}
        language={language as 'en' | 'he'}
        onBook={handleBook}
        onMessage={handleMessage}
      />
    </Layout>
  );
}
