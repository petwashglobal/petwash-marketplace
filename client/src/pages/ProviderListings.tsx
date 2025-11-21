/**
 * Provider Listings Page
 * Browse and filter providers for Sitter Suite, Walk My Pet, and PetTrek
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Star,
  MapPin,
  Shield,
  Award,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  Dog,
  Home,
  Car,
} from 'lucide-react';

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
  serviceType: 'walker' | 'sitter' | 'driver';
  city: string;
  country: string;
  rating: number;
  totalReviews: number;
  completedBookings: number;
  hourlyRate?: number;
  dailyRate?: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  trustScore: number;
  badges: string[];
  hasInsurance: boolean;
  yearsOfExperience?: number;
  bio?: string;
  availability: 'available' | 'busy' | 'offline';
}

export default function ProviderListings() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const isHebrew = language === 'he';
  
  const [serviceType, setServiceType] = useState<'walker' | 'sitter' | 'driver'>('walker');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'rating' | 'price' | 'experience'>('rating');
  
  // Fetch providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ['/api/providers', serviceType, cityFilter, minRating, sortBy],
  });
  
  const providers: Provider[] = providersData?.providers || [];
  
  // Filter providers based on search
  const filteredProviders = providers.filter((provider) => {
    const nameMatch = `${provider.firstName} ${provider.lastName}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const cityMatch = cityFilter === 'all' || provider.city === cityFilter;
    const ratingMatch = provider.rating >= minRating;
    
    return nameMatch && cityMatch && ratingMatch;
  });
  
  const t = {
    title: isHebrew ? 'מצא ספק מושלם' : 'Find the Perfect Provider',
    subtitle: isHebrew ? 'עיין בספקים מאומתים עם ביטוח ובדיקות רקע' : 'Browse verified providers with insurance and background checks',
    walker: isHebrew ? 'מטיילי כלבים' : 'Dog Walkers',
    sitter: isHebrew ? 'שמרטפים' : 'Pet Sitters',
    driver: isHebrew ? 'נהגי הובלה' : 'Pet Drivers',
    search: isHebrew ? 'חפש לפי שם...' : 'Search by name...',
    allCities: isHebrew ? 'כל הערים' : 'All Cities',
    minRating: isHebrew ? 'דירוג מינימלי' : 'Minimum Rating',
    sortBy: isHebrew ? 'מיין לפי' : 'Sort By',
    rating: isHebrew ? 'דירוג' : 'Rating',
    price: isHebrew ? 'מחיר' : 'Price',
    experience: isHebrew ? 'ניסיון' : 'Experience',
    verified: isHebrew ? 'מאומת' : 'Verified',
    insured: isHebrew ? 'מבוטח' : 'Insured',
    reviews: isHebrew ? 'ביקורות' : 'Reviews',
    bookings: isHebrew ? 'הזמנות' : 'Bookings',
    hourly: isHebrew ? 'לשעה' : '/hr',
    daily: isHebrew ? 'ליום' : '/day',
    available: isHebrew ? 'זמין' : 'Available',
    busy: isHebrew ? 'עסוק' : 'Busy',
    offline: isHebrew ? 'לא מקוון' : 'Offline',
    viewProfile: isHebrew ? 'צפה בפרופיל' : 'View Profile',
    book: isHebrew ? 'הזמן עכשיו' : 'Book Now',
    noProviders: isHebrew ? 'לא נמצאו ספקים' : 'No providers found',
    loading: isHebrew ? 'טוען...' : 'Loading...',
    years: isHebrew ? 'שנים' : 'years',
    trustScore: isHebrew ? 'ציון אמון' : 'Trust Score',
  };
  
  const serviceTypeIcons = {
    walker: Dog,
    sitter: Home,
    driver: Car,
  };
  
  const ServiceIcon = serviceTypeIcons[serviceType];
  
  return (
    <div className="min-h-screen luxury-bg-mesh py-12 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-2">{t.title}</h1>
          <p className="luxury-text-body">{t.subtitle}</p>
        </div>
      
        {/* Service Type Tabs */}
        <div className="luxury-animate-slide-up luxury-delay-1">
          <Tabs value={serviceType} onValueChange={(value) => setServiceType(value as any)} className="mb-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 luxury-glass-card luxury-shadow-md p-1">
              <TabsTrigger value="walker" data-testid="tab-walkers" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Dog className="h-4 w-4 mr-2" />
                {t.walker}
              </TabsTrigger>
              <TabsTrigger value="sitter" data-testid="tab-sitters" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Home className="h-4 w-4 mr-2" />
                {t.sitter}
              </TabsTrigger>
              <TabsTrigger value="driver" data-testid="tab-drivers" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Car className="h-4 w-4 mr-2" />
                {t.driver}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      
        {/* Filters */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-6 luxury-animate-fade-in luxury-delay-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 luxury-glass-minimal"
                data-testid="input-search-providers"
              />
            </div>
            
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger data-testid="select-city-filter">
                <SelectValue placeholder={t.allCities} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allCities}</SelectItem>
                <SelectItem value="Tel Aviv">Tel Aviv</SelectItem>
                <SelectItem value="Jerusalem">Jerusalem</SelectItem>
                <SelectItem value="Haifa">Haifa</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
              <SelectTrigger data-testid="select-rating-filter">
                <SelectValue placeholder={t.minRating} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.minRating}</SelectItem>
                <SelectItem value="3">3+ ⭐</SelectItem>
                <SelectItem value="4">4+ ⭐</SelectItem>
                <SelectItem value="4.5">4.5+ ⭐</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger data-testid="select-sort">
                <SelectValue placeholder={t.sortBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{t.rating}</SelectItem>
                <SelectItem value="price">{t.price}</SelectItem>
                <SelectItem value="experience">{t.experience}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      
        {/* Provider Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="luxury-text-body">{t.loading}</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <ServiceIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="luxury-text-body">{t.noProviders}</p>
          </div>
        ) : (
          <div className="luxury-grid-3">
            {filteredProviders.map((provider, idx) => (
              <div
                key={provider.id}
                className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 cursor-pointer luxury-animate-fade-in luxury-delay-${Math.min(idx + 3, 10)}`}
                onClick={() => setLocation(`/providers/${provider.id}`)}
                data-testid={`provider-card-${provider.id}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-16 w-16 ring-2 ring-purple-400/30">
                    <AvatarImage src={provider.profilePhoto} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {provider.firstName[0]}{provider.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="luxury-heading-sm">
                      {provider.firstName} {provider.lastName}
                    </h3>
                    <p className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {provider.city}, {provider.country}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{provider.rating.toFixed(1)}</span>
                        <span className="text-sm text-gray-600">
                          ({provider.totalReviews} {t.reviews})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {provider.verificationStatus === 'verified' && (
                      <span className="luxury-badge luxury-badge-success">
                        <Shield className="h-3 w-3 mr-1" />
                        {t.verified}
                      </span>
                    )}
                    {provider.hasInsurance && (
                      <span className="luxury-badge">
                        <Shield className="h-3 w-3 mr-1" />
                        {t.insured}
                      </span>
                    )}
                    {provider.badges.map((badge, idx) => (
                      <span key={idx} className="luxury-badge luxury-badge-gold">
                        <Award className="h-3 w-3 mr-1" />
                        {badge}
                      </span>
                    ))}
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm luxury-text-body">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span>{provider.completedBookings} {t.bookings}</span>
                    </div>
                    {provider.yearsOfExperience && (
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-purple-600" />
                        <span>{provider.yearsOfExperience} {t.years}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Bio */}
                  {provider.bio && (
                    <p className="text-sm luxury-text-small line-clamp-2">
                      {provider.bio}
                    </p>
                  )}
                  
                  {/* Price & Action */}
                  <div className="flex items-center justify-between pt-3 mt-3 luxury-divider">
                    <div>
                      {provider.hourlyRate && (
                        <div className="flex items-center gap-1 font-semibold text-purple-900">
                          <DollarSign className="h-4 w-4" />
                          {provider.hourlyRate}{t.hourly}
                        </div>
                      )}
                      {provider.dailyRate && !provider.hourlyRate && (
                        <div className="flex items-center gap-1 font-semibold text-purple-900">
                          <DollarSign className="h-4 w-4" />
                          {provider.dailyRate}{t.daily}
                        </div>
                      )}
                    </div>
                    <button className="luxury-btn-primary luxury-shadow-md px-4 py-2 text-sm" data-testid={`button-book-${provider.id}`}>
                      {t.book}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
