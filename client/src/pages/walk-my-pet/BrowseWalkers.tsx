import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  MapPin, Star, Dog, Heart, Sparkles, CheckCircle, Smartphone, Route, Shield, Users
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";
import { MadPawsSearch, MadPawsProviderCard, type SearchParams } from "@/components/marketplace/MadPawsSearch";

interface Walker {
  id: number;
  businessName: string;
  displayName: string;
  serviceArea: string;
  bio: string;
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  yearsExperience: number;
  verified: boolean;
  photoUrl: string | null;
}

const DEMO_WALKERS: Walker[] = [
  {
    id: 1,
    businessName: "הליכות אבי",
    displayName: "אבי כהן",
    serviceArea: "תל אביב - מרכז",
    bio: "מטייל מקצועי עם אהבה אמיתית לכלבים. טיולים בפארקים הכי יפים של תל אביב עם עדכוני GPS בזמן אמת.",
    hourlyRate: 45,
    rating: 4.9,
    totalReviews: 127,
    yearsExperience: 5,
    verified: true,
    photoUrl: null,
  },
  {
    id: 2,
    businessName: "Dog Walks Pro",
    displayName: "דנה לוי",
    serviceArea: "רמת גן - גבעתיים",
    bio: "מאמנת כלבים מוסמכת. טיולים פרטיים או קבוצתיים קטנים. התמחות בכלבים אנרגטיים.",
    hourlyRate: 55,
    rating: 5.0,
    totalReviews: 89,
    yearsExperience: 7,
    verified: true,
    photoUrl: null,
  },
  {
    id: 3,
    businessName: "הטייל שלי",
    displayName: "יוסי מזרחי",
    serviceArea: "הרצליה - רעננה",
    bio: "טיולים יומיים עם קבוצות קטנות. תמונות ועדכונים לאורך כל הטיול. זמין גם בסופי שבוע.",
    hourlyRate: 40,
    rating: 4.7,
    totalReviews: 156,
    yearsExperience: 4,
    verified: true,
    photoUrl: null,
  },
  {
    id: 4,
    businessName: "Happy Paws Walks",
    displayName: "מיכל אברהם",
    serviceArea: "ירושלים",
    bio: "טיולים בטבע הירושלמי. ניסיון עם כל גזעי הכלבים. שירות אישי ומסור.",
    hourlyRate: 50,
    rating: 4.8,
    totalReviews: 72,
    yearsExperience: 3,
    verified: false,
    photoUrl: null,
  },
  {
    id: 5,
    businessName: "טיולי פרימיום",
    displayName: "נועה גולן",
    serviceArea: "חיפה והקריות",
    bio: "טיולים פרטיים בלבד. התמחות בכלבים גדולים. מצלמת GoPro בכל טיול!",
    hourlyRate: 65,
    rating: 5.0,
    totalReviews: 45,
    yearsExperience: 6,
    verified: true,
    photoUrl: null,
  },
  {
    id: 6,
    businessName: "הליכות השרון",
    displayName: "אלון שפירא",
    serviceArea: "כפר סבא - הוד השרון",
    bio: "מטייל מנוסה עם רכב לאיסוף הכלב. טיולים בפארקים ובחופים. גמישות מלאה בזמנים.",
    hourlyRate: 48,
    rating: 4.6,
    totalReviews: 98,
    yearsExperience: 4,
    verified: true,
    photoUrl: null,
  },
];

export default function BrowseWalkers() {
  useSEO(pageSEO.walkMyPet);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);

  const { data: walkers = [], isLoading } = useQuery<Walker[]>({
    queryKey: ['/api/platforms/walk_my_pet/providers', searchParams?.location],
  });

  const displayWalkers = (walkers && walkers.length > 0) ? walkers : DEMO_WALKERS;

  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="relative bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-200 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-200 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-4" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700">
                  {isHebrew ? 'טיולי כלבים מקצועיים' : 'Professional Dog Walking'}
                </span>
              </div>
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 mb-4" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid="heading-main">
                Walk My Pet™
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto font-light" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                {isHebrew 
                  ? 'מצאו מטייל מקצועי עם מעקב GPS בזמן אמת'
                  : 'Find a professional walker with real-time GPS tracking'
                }
              </p>
            </div>

            <div className="max-w-5xl mx-auto -mb-16 relative z-10">
              <MadPawsSearch 
                onSearch={handleSearch} 
                platform="walk-my-pet"
                theme="emerald"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {isHebrew ? 'מטיילים זמינים' : 'Available Walkers'}
              </h2>
              <p className="text-gray-500 mt-1">
                {displayWalkers.length > 0 
                  ? (isHebrew ? `${displayWalkers.length} מטיילים נמצאו` : `${displayWalkers.length} walkers found`)
                  : (isHebrew ? 'חפשו לפי מיקום ותאריכים' : 'Search by location and dates')
                }
              </p>
            </div>
            <Button variant="outline" className="gap-2 rounded-full" data-testid="button-map-view">
              <MapPin className="h-4 w-4" />
              {isHebrew ? 'תצוגת מפה' : 'Map View'}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isHebrew ? 'מחפשים מטיילים מדהימים...' : 'Finding amazing walkers...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayWalkers.map((walker) => (
                <MadPawsProviderCard
                  key={walker.id}
                  id={walker.id}
                  name={walker.displayName}
                  photo={walker.photoUrl}
                  location={walker.serviceArea}
                  rating={walker.rating}
                  reviewCount={walker.totalReviews}
                  price={walker.hourlyRate}
                  priceUnit="hour"
                  priceUnitHe="שעה"
                  verified={walker.verified}
                  theme="emerald"
                  specialties={[
                    isHebrew ? `${walker.yearsExperience} שנות ניסיון` : `${walker.yearsExperience} years exp.`,
                    isHebrew ? 'GPS בזמן אמת' : 'Live GPS'
                  ]}
                  onClick={() => setLocation(`/walk-my-pet/walkers/${walker.id}`)}
                />
              ))}
            </div>
          )}

          {displayWalkers.length > 0 && (
            <div className="text-center mt-12">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 border-gray-300 hover:bg-gray-50"
                data-testid="button-load-more"
              >
                {isHebrew ? 'טען עוד מטיילים' : 'Load More Walkers'}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">
                {isHebrew ? 'למה לבחור ב-Walk My Pet™?' : 'Why Choose Walk My Pet™?'}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הפלטפורמה המובילה בישראל לטיולי כלבים מקצועיים'
                  : 'Israel\'s leading platform for professional dog walking'
                }
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="h-7 w-7 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'מעקב GPS חי' : 'Live GPS Tracking'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'עקבו אחרי הטיול בזמן אמת'
                    : 'Follow the walk in real-time'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'מטיילים מאומתים' : 'Verified Walkers'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'כל המטיילים עוברים בדיקות רקע'
                    : 'All walkers undergo background checks'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <Shield className="h-7 w-7 text-teal-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'ביטוח מלא' : 'Full Insurance'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'כיסוי מלא לכל טיול'
                    : 'Complete coverage for every walk'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Route className="h-7 w-7 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'עדכוני תמונות' : 'Photo Updates'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'תמונות מהטיול ישירות לנייד'
                    : 'Photos from the walk to your phone'
                  }
                </p>
              </div>
            </div>

            <div className="text-center mt-10">
              <Button 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full px-8"
                onClick={() => setLocation('/become-provider')}
                data-testid="button-become-walker"
              >
                <Users className="h-5 w-5 mr-2" />
                {isHebrew ? 'הפוך למטייל' : 'Become a Walker'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
