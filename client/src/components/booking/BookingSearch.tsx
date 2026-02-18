import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Star, 
  Filter, 
  Dog, 
  Cat, 
  Bird, 
  Rabbit,
  Check,
  Shield,
  Clock,
  X,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SearchFilters {
  serviceType: string;
  petCount: number;
  petTypes: string[];
  city: string;
  area: string;
  startDate: string;
  endDate: string;
  minRating: number;
  verifiedOnly: boolean;
  maxPrice: number | null;
}

interface Provider {
  id: number;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  rating: number;
  totalReviews: number;
  totalBookings: number;
  pricePerNight: number | null;
  pricePerHour: number | null;
  city: string;
  distance?: number;
  isVerified: boolean;
  hasPoliceCheck: boolean;
  yearsExperience: number;
  acceptedPetTypes: string[];
  maxPets: number;
  bio: string | null;
  badges: string[];
  responseTime: string;
}

const petTypeIcons: Record<string, any> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
};

const serviceTypes = [
  { value: 'pet_sitting', labelEn: 'Pet Sitting', labelHe: 'שמירת חיות מחמד' },
  { value: 'dog_walking', labelEn: 'Dog Walking', labelHe: 'הליכות כלבים' },
  { value: 'grooming', labelEn: 'Grooming', labelHe: 'טיפוח' },
  { value: 'pet_taxi', labelEn: 'Pet Taxi (Coming Soon)', labelHe: 'הסעות חיות (בקרוב)', disabled: true },
  { value: 'daycare', labelEn: 'Daycare', labelHe: 'מעון יום' },
  { value: 'training', labelEn: 'Training', labelHe: 'אילוף' },
  { value: 'k9000_wash', labelEn: 'K9000 Wash', labelHe: 'רחצה K9000' },
];

const petTypes = [
  { value: 'dog', labelEn: 'Dog', labelHe: 'כלב', icon: Dog },
  { value: 'cat', labelEn: 'Cat', labelHe: 'חתול', icon: Cat },
  { value: 'bird', labelEn: 'Bird', labelHe: 'ציפור', icon: Bird },
  { value: 'rabbit', labelEn: 'Rabbit', labelHe: 'ארנב', icon: Rabbit },
  { value: 'other', labelEn: 'Other', labelHe: 'אחר', icon: null },
];

export function BookingSearch() {
  const { t, i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const [, setLocation] = useLocation();
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    serviceType: 'pet_sitting',
    petCount: 1,
    petTypes: ['dog'],
    city: '',
    area: '',
    startDate: '',
    endDate: '',
    minRating: 0,
    verifiedOnly: false,
    maxPrice: null,
  });

  const [searchResults, setSearchResults] = useState<Provider[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: cities } = useQuery<{ cities: string[] }>({
    queryKey: ['/api/booking-search/cities'],
  });

  const searchMutation = useMutation({
    mutationFn: async (searchFilters: SearchFilters) => {
      const response = await apiRequest('POST', '/api/booking-search', {
        serviceType: searchFilters.serviceType,
        petCount: searchFilters.petCount,
        petTypes: searchFilters.petTypes,
        city: searchFilters.city || undefined,
        area: searchFilters.area || undefined,
        startDate: searchFilters.startDate || undefined,
        endDate: searchFilters.endDate || undefined,
        minRating: searchFilters.minRating || undefined,
        verifiedOnly: searchFilters.verifiedOnly,
        maxPrice: searchFilters.maxPrice || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.providers || []);
      setHasSearched(true);
    },
  });

  const handleSearch = () => {
    searchMutation.mutate(filters);
  };

  const togglePetType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      petTypes: prev.petTypes.includes(type)
        ? prev.petTypes.filter(t => t !== type)
        : [...prev.petTypes, type],
    }));
  };

  const clearFilters = () => {
    setFilters({
      serviceType: 'pet_sitting',
      petCount: 1,
      petTypes: ['dog'],
      city: '',
      area: '',
      startDate: '',
      endDate: '',
      minRating: 0,
      verifiedOnly: false,
      maxPrice: null,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <Card className="bg-white dark:bg-zinc-900 border-0 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-black dark:text-white">
            {isHebrew ? 'חפש שירות לחיית המחמד שלך' : 'Find Care for Your Pet'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'סוג שירות' : 'Service Type'}
              </Label>
              <Select
                value={filters.serviceType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, serviceType: value }))}
              >
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(service => (
                    <SelectItem 
                      key={service.value} 
                      value={service.value}
                      disabled={(service as any).disabled}
                      className={(service as any).disabled ? 'opacity-50' : ''}
                    >
                      {isHebrew ? service.labelHe : service.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'מיקום / עיר' : 'Location / City'}
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-location"
                  placeholder={isHebrew ? 'הזן עיר או אזור' : 'Enter city or area'}
                  value={filters.city}
                  onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'תאריך התחלה' : 'Start Date'}
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={filters.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setFilters(prev => ({
                      ...prev,
                      startDate: newStart,
                      endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate,
                    }));
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'תאריך סיום' : 'End Date'}
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={filters.endDate}
                  min={filters.startDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">
              {isHebrew ? 'סוג חיית מחמד' : 'Pet Type'}
            </Label>
            <div className="flex flex-wrap gap-2">
              {petTypes.map(pet => {
                const Icon = pet.icon;
                const isSelected = filters.petTypes.includes(pet.value);
                return (
                  <button
                    key={pet.value}
                    data-testid={`pet-type-${pet.value}`}
                    onClick={() => togglePetType(pet.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                      isSelected
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-gray-200 hover:border-gray-400 dark:border-zinc-700'
                    }`}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                      {isHebrew ? pet.labelHe : pet.labelEn}
                    </span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">
              {isHebrew ? `מספר חיות מחמד: ${filters.petCount}` : `Number of Pets: ${filters.petCount}`}
            </Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-decrease-pets"
                onClick={() => setFilters(prev => ({ ...prev, petCount: Math.max(1, prev.petCount - 1) }))}
                disabled={filters.petCount <= 1}
              >
                -
              </Button>
              <span className="text-2xl font-bold w-12 text-center">{filters.petCount}</span>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-increase-pets"
                onClick={() => setFilters(prev => ({ ...prev, petCount: Math.min(10, prev.petCount + 1) }))}
                disabled={filters.petCount >= 10}
              >
                +
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" data-testid="button-more-filters">
                  <Filter className="h-4 w-4 mr-2" />
                  {isHebrew ? 'פילטרים נוספים' : 'More Filters'}
                </Button>
              </SheetTrigger>
              <SheetContent side={isHebrew ? 'left' : 'right'} className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>{isHebrew ? 'פילטרים' : 'Filters'}</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {isHebrew ? `דירוג מינימלי: ${filters.minRating} כוכבים` : `Minimum Rating: ${filters.minRating} stars`}
                    </Label>
                    <Slider
                      value={[filters.minRating]}
                      onValueChange={([value]) => setFilters(prev => ({ ...prev, minRating: value }))}
                      max={5}
                      step={0.5}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {isHebrew ? 'רק מאומתים' : 'Verified Only'}
                    </Label>
                    <button
                      data-testid="toggle-verified-only"
                      onClick={() => setFilters(prev => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        filters.verifiedOnly ? 'bg-black dark:bg-white' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`block w-5 h-5 rounded-full bg-white dark:bg-black shadow transform transition-transform ${
                        filters.verifiedOnly ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {isHebrew ? 'מחיר מקסימלי (₪)' : 'Maximum Price (₪)'}
                    </Label>
                    <Input
                      data-testid="input-max-price"
                      type="number"
                      placeholder={isHebrew ? 'ללא הגבלה' : 'No limit'}
                      value={filters.maxPrice || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        maxPrice: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                    />
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {isHebrew ? 'נקה פילטרים' : 'Clear Filters'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Button 
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              className="bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 px-8"
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              {searchMutation.isPending 
                ? (isHebrew ? 'מחפש...' : 'Searching...') 
                : (isHebrew ? 'חפש' : 'Search')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchMutation.isPending && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasSearched && !searchMutation.isPending && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {isHebrew 
                ? `${searchResults.length} ספקים נמצאו`
                : `${searchResults.length} providers found`}
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {isHebrew 
                  ? 'לא נמצאו ספקים התואמים לחיפוש שלך. נסה לשנות את הפילטרים.'
                  : 'No providers found matching your search. Try adjusting your filters.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(provider => (
                <ProviderCard key={provider.id} provider={provider} isHebrew={isHebrew} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider, isHebrew }: { provider: Provider; isHebrew: boolean }) {
  const [, setLocation] = useLocation();
  
  return (
    <Card 
      className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group"
      onClick={() => setLocation(`/provider/${provider.id}`)}
      data-testid={`provider-card-${provider.id}`}
    >
      <div className="relative">
        <div className="h-48 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
          {provider.profilePictureUrl ? (
            <img 
              src={provider.profilePictureUrl} 
              alt={`${provider.firstName} ${provider.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-black dark:bg-white flex items-center justify-center">
              <span className="text-3xl font-bold text-white dark:text-black">
                {provider.firstName?.[0]}{provider.lastName?.[0]}
              </span>
            </div>
          )}
        </div>
        
        {provider.isVerified && (
          <Badge className="absolute top-3 left-3 bg-black text-white dark:bg-white dark:text-black">
            <Shield className="h-3 w-3 mr-1" />
            {isHebrew ? 'מאומת' : 'Verified'}
          </Badge>
        )}

        {provider.hasPoliceCheck && (
          <Badge variant="outline" className="absolute top-3 right-3 bg-white/90 dark:bg-black/90">
            {isHebrew ? 'בדיקת משטרה' : 'Police Check'}
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg">
              {provider.firstName} {provider.lastName?.[0]}.
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <MapPin className="h-3 w-3 mr-1" />
              {provider.city}
              {provider.distance && ` • ${provider.distance.toFixed(1)} km`}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">{provider.rating?.toFixed(1) || '5.0'}</span>
            </div>
            <p className="text-xs text-gray-500">
              ({provider.totalReviews || 0} {isHebrew ? 'ביקורות' : 'reviews'})
            </p>
          </div>
        </div>

        {provider.bio && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
            {provider.bio}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {provider.acceptedPetTypes?.slice(0, 3).map(type => {
            const Icon = petTypeIcons[type];
            return (
              <Badge key={type} variant="outline" className="text-xs">
                {Icon && <Icon className="h-3 w-3 mr-1" />}
                {type}
              </Badge>
            );
          })}
          {provider.maxPets > 1 && (
            <Badge variant="outline" className="text-xs">
              {isHebrew ? `עד ${provider.maxPets} חיות` : `Up to ${provider.maxPets} pets`}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            {provider.pricePerNight ? (
              <p className="font-bold text-lg">
                ₪{provider.pricePerNight}
                <span className="text-sm font-normal text-gray-500">
                  /{isHebrew ? 'לילה' : 'night'}
                </span>
              </p>
            ) : provider.pricePerHour ? (
              <p className="font-bold text-lg">
                ₪{provider.pricePerHour}
                <span className="text-sm font-normal text-gray-500">
                  /{isHebrew ? 'שעה' : 'hour'}
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {isHebrew ? 'צור קשר למחיר' : 'Contact for price'}
              </p>
            )}
          </div>
          <Button size="sm" className="group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black">
            {isHebrew ? 'הזמן' : 'Book'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default BookingSearch;
