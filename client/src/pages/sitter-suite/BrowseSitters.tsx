import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Calendar, Shield, Home, Heart, Search, Filter, Sparkles, ArrowRight, CheckCircle, Camera, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useSEO, pageSEO } from "@/lib/seo";

interface Sitter {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  yearsOfExperience: number;
  pricePerDayCents: number;
  profilePictureUrl: string | null;
  rating: string;
  totalBookings: number;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

// No demo data - only real sitters from API

const SERVICE_TYPES = [
  { id: 'boarding', name: 'לינה בבית המארח', nameEn: 'Boarding', icon: Home },
  { id: 'house-sitting', name: 'שמירה בביתך', nameEn: 'House Sitting', icon: Heart },
  { id: 'daycare', name: 'טיפול יומי', nameEn: 'Day Care', icon: Calendar },
  { id: 'drop-in', name: 'ביקור קצר', nameEn: 'Drop-in Visits', icon: Clock },
];

export default function BrowseSitters() {
  useSEO(pageSEO.sitterSuite);
  const [, setLocation] = useLocation();
  const [selectedService, setSelectedService] = useState('boarding');
  const [filters, setFilters] = useState({
    location: "",
    minRating: 0,
    maxPrice: 1000,
  });

  const { data, isLoading } = useQuery<Sitter[]>({
    queryKey: ["/api/sitter-suite/sitters", filters],
  });

  // Only use real sitters from API - no fake demo data
  const sitters = data || [];

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Hero Section - Pet Wash™ Premium Design */}
        <div className="relative bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-10 w-64 h-64 bg-pink-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <div className="text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-6" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Premium Pet Sitting Marketplace</span>
              </div>
              
              {/* Main Title - Gucci Style Serif */}
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 mb-4" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid="heading-main">
                The Sitter Suite™
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 font-light" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                שמרטפות מקצועית עם אהבה אינסופית לחיות המחמד שלך
              </p>
              
              {/* Service Type Selection - Pet Wash™ Luxury */}
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
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg scale-105' 
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
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>בדיקות רקע מלאות</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-blue-500" />
                  <span>תמונות יומיות</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  <span>ביטוח מלא</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Filters - Luxurious Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-10" data-testid="filters-section">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-700">סינון תוצאות</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 מיקום</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="עיר או מיקוד"
                    className="pl-10 bg-gray-50 border-gray-200 focus:border-pink-500 focus:ring-pink-500 rounded-xl"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    data-testid="input-location"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">⭐ דירוג מינימלי</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:border-pink-500 focus:ring-pink-500 transition-all"
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                  data-testid="select-rating"
                >
                  <option value="0">כל הדירוגים</option>
                  <option value="3">3+ כוכבים</option>
                  <option value="4">4+ כוכבים</option>
                  <option value="4.5">4.5+ כוכבים</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">💰 מחיר מקסימלי (₪/יום)</label>
                <Input
                  type="number"
                  className="bg-gray-50 border-gray-200 focus:border-pink-500 focus:ring-pink-500 rounded-xl"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                  data-testid="input-max-price"
                />
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-light text-gray-900" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
              {sitters.length} שמרטפים זמינים
            </h2>
            <Button variant="outline" className="gap-2" data-testid="button-map-view">
              <MapPin className="h-4 w-4" />
              תצוגת מפה
            </Button>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-light">מחפשים שמרטפים מדהימים...</p>
            </div>
          ) : sitters.length === 0 ? (
            <div className="text-center py-20 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl" data-testid="empty-state">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                <Heart className="w-12 h-12 text-pink-500" />
              </div>
              <h3 className="text-2xl font-serif font-medium text-gray-900 mb-3" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                בקרוב - שמרטפים מקצועיים
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                אנחנו מגייסים שמרטפים מאומתים לפלטפורמה. רוצים להיות הראשונים לדעת כשנשיק?
              </p>
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-medium hover:shadow-lg transition-all" data-testid="button-notify-me">
                <Sparkles className="w-5 h-5" />
                עדכנו אותי
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sitters.map((sitter, index) => {
                const ratingNum = parseFloat(sitter.rating);
                const priceInShekels = sitter.pricePerDayCents / 100;
                
                return (
                  <div
                    key={sitter.id}
                    onClick={() => setLocation(`/sitter-suite/sitters/${sitter.id}`)}
                    className="group bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
                    data-testid={`card-sitter-${sitter.id}`}
                  >
                    {/* Image Section */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-pink-100 via-rose-100 to-purple-100 relative overflow-hidden">
                      {sitter.profilePictureUrl ? (
                        <img
                          src={sitter.profilePictureUrl}
                          alt={`${sitter.firstName} ${sitter.lastName}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-4xl shadow-lg">
                            {sitter.firstName.charAt(0)}
                          </div>
                        </div>
                      )}
                      
                      {/* Verified Badge */}
                      {sitter.isVerified && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md">
                          <Shield className="h-4 w-4 text-green-500" />
                          <span className="text-xs font-medium text-gray-700">מאומת</span>
                        </div>
                      )}
                      
                      {/* Favorite Button */}
                      <button 
                        className="absolute top-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); }}
                        data-testid={`button-favorite-${sitter.id}`}
                      >
                        <Heart className="h-5 w-5 text-gray-400 hover:text-red-500 transition-colors" />
                      </button>
                      
                      {/* Rating Badge */}
                      <div className="absolute bottom-3 left-3 flex items-center gap-1 px-3 py-1.5 bg-amber-500 rounded-full shadow-md">
                        <Star className="h-4 w-4 text-white fill-current" />
                        <span className="text-sm font-bold text-white">{ratingNum.toFixed(1)}</span>
                        <span className="text-xs text-white/90">({sitter.totalBookings})</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="font-serif text-xl font-medium text-gray-900 mb-1" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid={`text-name-${sitter.id}`}>
                        {sitter.firstName} {sitter.lastName}
                      </h3>

                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <MapPin className="h-4 w-4" />
                        <span>{sitter.city}</span>
                        <span className="text-gray-300">•</span>
                        <span>{sitter.yearsOfExperience} שנות ניסיון</span>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">{sitter.bio}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div>
                          <div className="text-2xl font-serif font-semibold text-gray-900" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                            ₪{priceInShekels}
                          </div>
                          <div className="text-xs text-gray-500">ליום</div>
                        </div>
                        <Button
                          className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-full px-5 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/sitter-suite/sitters/${sitter.id}`);
                          }}
                          data-testid={`button-book-${sitter.id}`}
                        >
                          צפייה בפרופיל
                          <ArrowRight className="h-4 w-4 mr-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Load More */}
          <div className="text-center mt-12">
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full px-8 border-gray-300 hover:bg-gray-50"
              data-testid="button-load-more"
            >
              טען עוד שמרטפים
            </Button>
          </div>
        </div>
        
        {/* Trust Section */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  בדיקות רקע מלאות
                </h3>
                <p className="text-gray-600 text-sm">כל השמרטפים עוברים בדיקות רקע פליליות ואימות זהות</p>
              </div>
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Camera className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  עדכונים יומיים
                </h3>
                <p className="text-gray-600 text-sm">קבלו תמונות ועדכונים על חיית המחמד שלכם כל יום</p>
              </div>
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Heart className="h-8 w-8 text-rose-500" />
                </div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                  ביטוח מלא
                </h3>
                <p className="text-gray-600 text-sm">כיסוי ביטוחי מלא לכל שהייה לשקט נפשי מושלם</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
