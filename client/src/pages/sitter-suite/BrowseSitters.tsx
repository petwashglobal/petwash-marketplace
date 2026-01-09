import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Shield, Heart, Sparkles, ArrowRight, CheckCircle, Camera, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";
import { MadPawsSearch, MadPawsProviderCard, MadPawsEmptyState, type SearchParams } from "@/components/marketplace/MadPawsSearch";
import { format } from "date-fns";

interface Provider {
  id: string;
  platform: string;
  serviceType: string;
  displayName: string;
  bio: string;
  profilePhotoUrl: string;
  location: string;
  rating: number | null;
  reviewCount: number;
  pricing: {
    perNight: string | null;
    perHour: string | null;
    additionalPet: string | null;
    currency: string;
  };
  maxPets: number;
  acceptedPetTypes: string[];
  addons: string[];
  instantBooking: boolean;
  cancellationPolicy: string;
}

interface SearchResponse {
  success: boolean;
  providers: Provider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export default function BrowseSitters() {
  useSEO(pageSEO.sitterSuite);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);

  // Build query string for API
  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set('platform', 'sitter_suite');
    if (searchParams?.service) params.set('serviceType', searchParams.service);
    if (searchParams?.startDate) params.set('startDate', format(searchParams.startDate, 'yyyy-MM-dd'));
    if (searchParams?.endDate) params.set('endDate', format(searchParams.endDate, 'yyyy-MM-dd'));
    if (searchParams?.petType) params.set('petTypes', searchParams.petType);
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<SearchResponse>({
    queryKey: ["/api/marketplace-bookings/search/providers", searchParams],
    queryFn: async () => {
      const queryString = buildQueryString();
      const response = await fetch(`/api/marketplace-bookings/search/providers?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch providers');
      return response.json();
    },
    enabled: true, // Always fetch to show available providers
  });

  const providers = data?.providers || [];

  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
    refetch();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="relative bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-10 left-10 w-72 h-72 bg-pink-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-200 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-4" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">
                  {isHebrew ? 'שוק שמרטפים מוביל' : 'Premium Pet Sitting Marketplace'}
                </span>
              </div>
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 mb-4" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid="heading-main">
                The Sitter Suite™
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto font-light" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                {isHebrew 
                  ? 'מצאו את השמרטף המושלם לחיית המחמד שלכם'
                  : 'Find the perfect sitter for your beloved pet'
                }
              </p>
            </div>

            <div className="max-w-5xl mx-auto -mb-16 relative z-10">
              <MadPawsSearch 
                onSearch={handleSearch} 
                platform="sitter-suite"
                theme="pink"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {isHebrew ? 'שמרטפים זמינים' : 'Available Sitters'}
              </h2>
              <p className="text-gray-500 mt-1">
                {providers.length > 0 
                  ? (isHebrew ? `${providers.length} שמרטפים נמצאו` : `${providers.length} sitters found`)
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
              <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isHebrew ? 'מחפשים שמרטפים מדהימים...' : 'Finding amazing sitters...'}
              </p>
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <Heart className="w-12 h-12 text-pink-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  {isHebrew ? 'בקרוב - שמרטפים מקצועיים' : 'Professional sitters coming soon'}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {isHebrew 
                    ? 'אנחנו מגייסים שמרטפים מאומתים לפלטפורמה. הזינו את המיקום שלכם כדי לקבל עדכון כשנשיק באזורכם.'
                    : 'We\'re recruiting verified sitters to our platform. Enter your location to get notified when we launch in your area.'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full px-8"
                    onClick={() => setLocation('/become-provider')}
                    data-testid="button-become-sitter"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    {isHebrew ? 'הפוך לשמרטף' : 'Become a Sitter'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-full px-8"
                    data-testid="button-notify-me"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    {isHebrew ? 'עדכנו אותי' : 'Notify Me'}
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-gray-100">
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'בדיקות רקע מלאות' : 'Full Background Checks'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'כל השמרטפים עוברים בדיקות רקע מקיפות'
                      : 'All sitters undergo comprehensive background checks'
                    }
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Camera className="h-7 w-7 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'עדכוני תמונות יומיים' : 'Daily Photo Updates'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'קבלו תמונות של חיית המחמד שלכם כל יום'
                      : 'Receive photos of your pet every day'
                    }
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center">
                    <Shield className="h-7 w-7 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'ביטוח מלא כלול' : 'Full Insurance Included'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'כיסוי ביטוחי מלא לכל הזמנה'
                      : 'Complete insurance coverage for every booking'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {providers.map((provider) => {
                const pricePerNight = provider.pricing.perNight ? parseFloat(provider.pricing.perNight) : 0;
                
                return (
                  <MadPawsProviderCard
                    key={provider.id}
                    id={provider.id}
                    name={provider.displayName || 'Provider'}
                    photo={provider.profilePhotoUrl}
                    location={provider.location || ''}
                    rating={provider.rating || 0}
                    reviewCount={provider.reviewCount}
                    price={pricePerNight}
                    priceUnit="night"
                    priceUnitHe="לילה"
                    verified={true}
                    theme="pink"
                    specialties={provider.acceptedPetTypes?.slice(0, 2).map(t => t === 'dog' ? (isHebrew ? 'כלבים' : 'Dogs') : t === 'cat' ? (isHebrew ? 'חתולים' : 'Cats') : t) || []}
                    onClick={() => setLocation(`/sitter-suite/sitters/${provider.id}`)}
                  />
                );
              })}
            </div>
          )}

          {providers.length > 0 && (
            <div className="text-center mt-12">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 border-gray-300 hover:bg-gray-50"
                data-testid="button-load-more"
              >
                {isHebrew ? 'טען עוד שמרטפים' : 'Load More Sitters'}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-rose-50 to-pink-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">
                {isHebrew ? 'למה לבחור ב-The Sitter Suite™?' : 'Why Choose The Sitter Suite™?'}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הפלטפורמה המובילה בישראל לשמרטפות חיות מחמד יוקרתית'
                  : 'Israel\'s leading platform for premium pet sitting services'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-600 mb-2">4.9</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'דירוג ממוצע' : 'Average Rating'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-600 mb-2">10K+</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'הזמנות הושלמו' : 'Bookings Completed'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-600 mb-2">100%</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'שמרטפים מאומתים' : 'Verified Sitters'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-600 mb-2">24/7</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'תמיכה זמינה' : 'Support Available'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
