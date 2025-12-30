import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  User, MapPin, Star, Calendar, Dog, Heart, Search, Filter, 
  Sparkles, ArrowRight, CheckCircle, Smartphone, Route, Clock, Shield
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";

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

// Demo walkers for display when API returns empty
// Note: photoUrl uses empty string instead of null to avoid null reference errors
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
    photoUrl: "",
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
    photoUrl: "",
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
    photoUrl: "",
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
    photoUrl: "",
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
    photoUrl: "",
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
    photoUrl: "",
  },
];

const SERVICE_TYPES = [
  { id: 'daily-walk', name: 'טיול יומי', icon: Route },
  { id: 'group-walk', name: 'טיול קבוצתי', icon: Dog },
  { id: 'private-walk', name: 'טיול פרטי', icon: User },
  { id: 'running', name: 'ריצה עם הכלב', icon: Clock },
];

export default function BrowseWalkers() {
  useSEO(pageSEO.walkMyPet);
  const [, setLocation] = useLocation();
  const [selectedService, setSelectedService] = useState('daily-walk');
  const [filters, setFilters] = useState({
    location: "",
    minRating: 0,
  });

  const { data: walkers = [], isLoading } = useQuery<Walker[]>({
    queryKey: ['/api/platforms/walk_my_pet/providers', filters],
  });

  // Use demo walkers if API returns empty
  const displayWalkers = (walkers && walkers.length > 0) ? walkers : DEMO_WALKERS;

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Hero Section - MadPaws Style with Green Theme */}
        <div className="relative bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-200 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-6" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700">Premium Dog Walking</span>
              </div>
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 mb-4" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid="heading-main">
                Walk My Pet™
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 font-light" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                טיולי כלבים מקצועיים עם GPS בזמן אמת ותמונות לאורך כל הדרך
              </p>
              
              {/* Service Type Selection */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {SERVICE_TYPES.map((service) => {
                  const Icon = service.icon;
                  const isSelected = selectedService === service.id;
                  return (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 ${
                        isSelected 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg scale-105' 
                          : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm border border-gray-200'
                      }`}
                      data-testid={`button-service-${service.id}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{service.name}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-emerald-500" />
                  <span>מעקב GPS בזמן אמת</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>מטיילים מאומתים</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-teal-500" />
                  <span>ביטוח מלא</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-10" data-testid="filters-section">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-700">סינון תוצאות</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 מיקום</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="עיר או שכונה"
                    className="pl-10 bg-gray-50 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    data-testid="input-location"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">⭐ דירוג מינימלי</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:border-emerald-500 focus:ring-emerald-500 transition-all"
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                  data-testid="select-rating"
                >
                  <option value="0">כל הדירוגים</option>
                  <option value="4">4+ כוכבים</option>
                  <option value="4.5">4.5+ כוכבים</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-light text-gray-900" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
              {displayWalkers.length} מטיילים זמינים
            </h2>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-light">מחפשים מטיילים מדהימים...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayWalkers.map((walker) => (
                <div
                  key={walker.id}
                  onClick={() => setLocation(`/walk-my-pet/walkers/${walker.id}`)}
                  className="group bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
                  data-testid={`card-walker-${walker.id}`}
                >
                  {/* Image Section */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-emerald-100 via-green-100 to-teal-100 relative overflow-hidden">
                    {walker.photoUrl ? (
                      <img src={walker.photoUrl} alt={walker.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-4xl shadow-lg">
                          {walker.displayName.charAt(0)}
                        </div>
                      </div>
                    )}
                    
                    {walker.verified && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-medium text-gray-700">מאומת</span>
                      </div>
                    )}
                    
                    <button 
                      className="absolute top-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); }}
                      data-testid={`button-favorite-${walker.id}`}
                    >
                      <Heart className="h-5 w-5 text-gray-400 hover:text-red-500 transition-colors" />
                    </button>
                    
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 rounded-full shadow-md">
                      <Star className="h-4 w-4 text-white fill-current" />
                      <span className="text-sm font-bold text-white">{walker.rating.toFixed(1)}</span>
                      <span className="text-xs text-white/90">({walker.totalReviews})</span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-serif text-xl font-medium text-gray-900 mb-1" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                      {walker.displayName}
                    </h3>
                    <p className="text-sm text-emerald-600 font-medium mb-2">{walker.businessName}</p>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                      <MapPin className="h-4 w-4" />
                      <span>{walker.serviceArea}</span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">{walker.bio}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <div className="text-2xl font-serif font-semibold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                          ₪{walker.hourlyRate}
                        </div>
                        <div className="text-xs text-gray-500">לשעה</div>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full px-5 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/walk-my-pet/book/${walker.id}`);
                        }}
                        data-testid={`button-book-walker-${walker.id}`}
                      >
                        הזמן טיול
                        <ArrowRight className="h-4 w-4 mr-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Trust Section */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  GPS בזמן אמת
                </h3>
                <p className="text-gray-600 text-sm">עקבו אחרי הטיול של הכלב שלכם בזמן אמת על המפה</p>
              </div>
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Route className="h-8 w-8 text-teal-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  מסלולים מותאמים
                </h3>
                <p className="text-gray-600 text-sm">כל טיול מותאם לאופי ולצרכים של הכלב שלכם</p>
              </div>
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  ביטוח מלא
                </h3>
                <p className="text-gray-600 text-sm">כיסוי ביטוחי מלא לכל טיול לשקט נפשי מושלם</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
