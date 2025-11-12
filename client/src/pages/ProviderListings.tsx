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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>
      
      {/* Service Type Tabs */}
      <Tabs value={serviceType} onValueChange={(value) => setServiceType(value as any)} className="mb-6">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
          <TabsTrigger value="walker" data-testid="tab-walkers">
            <Dog className="h-4 w-4 mr-2" />
            {t.walker}
          </TabsTrigger>
          <TabsTrigger value="sitter" data-testid="tab-sitters">
            <Home className="h-4 w-4 mr-2" />
            {t.sitter}
          </TabsTrigger>
          <TabsTrigger value="driver" data-testid="tab-drivers">
            <Car className="h-4 w-4 mr-2" />
            {t.driver}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
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
        </CardContent>
      </Card>
      
      {/* Provider Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t.loading}</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-12">
          <ServiceIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t.noProviders}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setLocation(`/providers/${provider.id}`)}
              data-testid={`provider-card-${provider.id}`}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={provider.profilePhoto} />
                    <AvatarFallback>
                      {provider.firstName[0]}{provider.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {provider.firstName} {provider.lastName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {provider.city}, {provider.country}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{provider.rating.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">
                          ({provider.totalReviews} {t.reviews})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {provider.verificationStatus === 'verified' && (
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        {t.verified}
                      </Badge>
                    )}
                    {provider.hasInsurance && (
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        {t.insured}
                      </Badge>
                    )}
                    {provider.badges.map((badge, idx) => (
                      <Badge key={idx} variant="outline">
                        <Award className="h-3 w-3 mr-1" />
                        {badge}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{provider.completedBookings} {t.bookings}</span>
                    </div>
                    {provider.yearsOfExperience && (
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span>{provider.yearsOfExperience} {t.years}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Bio */}
                  {provider.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {provider.bio}
                    </p>
                  )}
                  
                  {/* Price & Action */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      {provider.hourlyRate && (
                        <div className="flex items-center gap-1 font-semibold">
                          <DollarSign className="h-4 w-4" />
                          {provider.hourlyRate}{t.hourly}
                        </div>
                      )}
                      {provider.dailyRate && !provider.hourlyRate && (
                        <div className="flex items-center gap-1 font-semibold">
                          <DollarSign className="h-4 w-4" />
                          {provider.dailyRate}{t.daily}
                        </div>
                      )}
                    </div>
                    <Button size="sm" data-testid={`button-book-${provider.id}`}>
                      {t.book}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
