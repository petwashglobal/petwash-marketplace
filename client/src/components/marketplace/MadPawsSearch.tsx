import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, MapPin, CalendarDays, Dog, Cat, ChevronDown,
  Home, Heart, Clock, Route, Car, GraduationCap, Sparkles,
  Star, Shield, CheckCircle, Users
} from "lucide-react";
import { format, addDays } from "date-fns";
import { useLanguage } from "@/lib/languageStore";

type ServiceType = 
  | 'boarding' 
  | 'house-sitting' 
  | 'daycare' 
  | 'drop-in' 
  | 'dog-walking' 
  | 'pet-taxi' 
  | 'training';

type PetType = 'dog' | 'cat' | 'other';

interface ServiceOption {
  id: ServiceType;
  name: string;
  nameHe: string;
  icon: typeof Home;
  description: string;
  descriptionHe: string;
}

const SERVICES: ServiceOption[] = [
  { 
    id: 'boarding', 
    name: 'Boarding', 
    nameHe: 'לינה בבית המארח',
    icon: Home,
    description: 'Your pet stays at the sitter\'s home',
    descriptionHe: 'חיית המחמד שלך נשארת בבית השמרטף'
  },
  { 
    id: 'house-sitting', 
    name: 'House Sitting', 
    nameHe: 'שמירה בביתך',
    icon: Heart,
    description: 'Sitter stays at your home',
    descriptionHe: 'השמרטף נשאר בביתך'
  },
  { 
    id: 'daycare', 
    name: 'Day Care', 
    nameHe: 'טיפול יומי',
    icon: Users,
    description: 'Daytime care at sitter\'s home',
    descriptionHe: 'טיפול יומי בבית השמרטף'
  },
  { 
    id: 'drop-in', 
    name: 'Drop-in Visits', 
    nameHe: 'ביקורי בית',
    icon: Clock,
    description: 'Short visits to your home',
    descriptionHe: 'ביקורים קצרים בביתך'
  },
  { 
    id: 'dog-walking', 
    name: 'Dog Walking', 
    nameHe: 'טיולי כלבים',
    icon: Route,
    description: 'Daily walks for your dog',
    descriptionHe: 'טיולים יומיים לכלב שלך'
  },
  { 
    id: 'pet-taxi', 
    name: 'Pet Taxi', 
    nameHe: 'הסעות חיות מחמד',
    icon: Car,
    description: 'Safe transport for your pet',
    descriptionHe: 'הסעה בטוחה לחיית המחמד'
  },
  { 
    id: 'training', 
    name: 'Training', 
    nameHe: 'אילוף',
    icon: GraduationCap,
    description: 'Professional pet training',
    descriptionHe: 'אילוף מקצועי'
  },
];

interface MadPawsSearchProps {
  onSearch?: (params: SearchParams) => void;
  showResults?: boolean;
  platform?: 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'academy' | 'all';
}

export interface SearchParams {
  location: string;
  service: ServiceType;
  petType: PetType;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export function MadPawsSearch({ onSearch, showResults = true, platform = 'all' }: MadPawsSearchProps) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const [location, setLocation] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceType>('boarding');
  const [petType, setPetType] = useState<PetType>('dog');
  const [startDate, setStartDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  const selectedServiceData = SERVICES.find(s => s.id === selectedService);

  const handleSearch = () => {
    const params: SearchParams = {
      location,
      service: selectedService,
      petType,
      startDate,
      endDate,
    };

    if (onSearch) {
      onSearch(params);
    } else {
      const route = getRouteForService(selectedService);
      navigate(`${route}?location=${encodeURIComponent(location)}&pet=${petType}&start=${startDate?.toISOString()}&end=${endDate?.toISOString()}`);
    }
  };

  const getRouteForService = (service: ServiceType): string => {
    switch (service) {
      case 'boarding':
      case 'house-sitting':
      case 'daycare':
      case 'drop-in':
        return '/sitter-suite';
      case 'dog-walking':
        return '/walk-my-pet';
      case 'pet-taxi':
        return '/pettrek';
      case 'training':
        return '/academy';
      default:
        return '/sitter-suite';
    }
  };

  const filteredServices = platform === 'all' 
    ? SERVICES 
    : SERVICES.filter(s => {
        if (platform === 'sitter-suite') return ['boarding', 'house-sitting', 'daycare', 'drop-in'].includes(s.id);
        if (platform === 'walk-my-pet') return s.id === 'dog-walking';
        if (platform === 'pettrek') return s.id === 'pet-taxi';
        if (platform === 'academy') return s.id === 'training';
        return true;
      });

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'מיקום' : 'Location'}
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder={isHebrew ? 'הזן עיר או כתובת' : 'Enter city or address'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 h-12 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="input-search-location"
              />
            </div>
          </div>

          <div className="lg:col-span-1 relative">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'סוג שירות' : 'Service Type'}
            </label>
            <Popover open={serviceDropdownOpen} onOpenChange={setServiceDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  className="w-full h-12 px-4 flex items-center justify-between bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-left"
                  data-testid="dropdown-service-type"
                >
                  <div className="flex items-center gap-2">
                    {selectedServiceData && <selectedServiceData.icon className="h-5 w-5 text-pink-500" />}
                    <span className="text-gray-900 font-medium">
                      {isHebrew ? selectedServiceData?.nameHe : selectedServiceData?.name}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <div className="space-y-1">
                  {filteredServices.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedService === service.id;
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          setSelectedService(service.id);
                          setServiceDropdownOpen(false);
                        }}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left ${
                          isSelected 
                            ? 'bg-pink-50 border-2 border-pink-500' 
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                        data-testid={`option-service-${service.id}`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-pink-500' : 'text-gray-400'}`} />
                        <div>
                          <div className={`font-medium ${isSelected ? 'text-pink-700' : 'text-gray-900'}`}>
                            {isHebrew ? service.nameHe : service.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {isHebrew ? service.descriptionHe : service.description}
                          </div>
                        </div>
                        {isSelected && <CheckCircle className="h-5 w-5 text-pink-500 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'סוג חיית מחמד' : 'Pet Type'}
            </label>
            <div className="flex gap-2 h-12">
              <button
                onClick={() => setPetType('dog')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 transition-all ${
                  petType === 'dog'
                    ? 'bg-pink-50 border-pink-500 text-pink-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                data-testid="button-pet-dog"
              >
                <Dog className="h-5 w-5" />
                <span className="font-medium text-sm">{isHebrew ? 'כלב' : 'Dog'}</span>
              </button>
              <button
                onClick={() => setPetType('cat')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 transition-all ${
                  petType === 'cat'
                    ? 'bg-pink-50 border-pink-500 text-pink-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                data-testid="button-pet-cat"
              >
                <Cat className="h-5 w-5" />
                <span className="font-medium text-sm">{isHebrew ? 'חתול' : 'Cat'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'תאריכים' : 'Dates'}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-full h-12 px-4 flex items-center gap-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                  data-testid="button-date-picker"
                >
                  <CalendarDays className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-900 text-sm">
                    {startDate && endDate 
                      ? `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`
                      : isHebrew ? 'בחר תאריכים' : 'Select dates'
                    }
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-3 border-b sm:border-b-0 sm:border-r border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2 px-1">
                      {isHebrew ? 'תאריך התחלה' : 'Start Date'}
                    </p>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2 px-1">
                      {isHebrew ? 'תאריך סיום' : 'End Date'}
                    </p>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < (startDate || new Date())}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <Button
              onClick={handleSearch}
              className="w-full h-12 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-semibold shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/30"
              data-testid="button-search"
            >
              <Search className="h-5 w-5 mr-2" />
              {isHebrew ? 'חיפוש' : 'Search'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield className="h-4 w-4 text-green-500" />
            <span>{isHebrew ? 'כל הספקים מאומתים' : 'All providers verified'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Star className="h-4 w-4 text-amber-500" />
            <span>{isHebrew ? 'דירוג 4.9+ ממוצע' : '4.9+ average rating'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>{isHebrew ? 'ביטוח מלא כלול' : 'Full insurance included'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProviderCardProps {
  id: number;
  name: string;
  photo: string | null;
  location: string;
  rating: number;
  reviewCount: number;
  price: number;
  priceUnit: string;
  priceUnitHe: string;
  distance?: string;
  verified: boolean;
  specialties?: string[];
  onClick: () => void;
}

export function MadPawsProviderCard({
  id,
  name,
  photo,
  location,
  rating,
  reviewCount,
  price,
  priceUnit,
  priceUnitHe,
  distance,
  verified,
  specialties = [],
  onClick,
}: ProviderCardProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
      data-testid={`card-provider-${id}`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-pink-100 to-purple-100 relative overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-3xl font-medium text-pink-600 shadow-lg">
              {name.charAt(0)}
            </div>
          </div>
        )}
        
        {verified && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
            <Shield className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-gray-700">
              {isHebrew ? 'מאומת' : 'Verified'}
            </span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-amber-500 rounded-full shadow-md">
          <Star className="h-3.5 w-3.5 text-white fill-current" />
          <span className="text-sm font-bold text-white">{rating.toFixed(1)}</span>
          <span className="text-xs text-white/80">({reviewCount})</span>
        </div>

        {distance && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
            <span className="text-xs font-medium text-gray-600">{distance}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-1" data-testid={`text-name-${id}`}>
          {name}
        </h3>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <MapPin className="h-4 w-4" />
          <span>{location}</span>
        </div>

        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {specialties.slice(0, 3).map((specialty, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 bg-pink-50 text-pink-600 text-xs font-medium rounded-full"
              >
                {specialty}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <span className="text-2xl font-bold text-gray-900">₪{price}</span>
            <span className="text-sm text-gray-500 ml-1">
              /{isHebrew ? priceUnitHe : priceUnit}
            </span>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full px-4 shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            data-testid={`button-view-${id}`}
          >
            {isHebrew ? 'צפייה' : 'View'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MadPawsEmptyState({ service }: { service: string }) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="text-center py-16 px-4">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <Search className="w-10 h-10 text-pink-400" />
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 mb-2">
        {isHebrew ? 'לא נמצאו ספקים' : 'No providers found'}
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {isHebrew 
          ? 'נסה לשנות את החיפוש שלך או להרחיב את האזור'
          : 'Try adjusting your search or expanding the area'
        }
      </p>
      <Button variant="outline" className="rounded-full">
        {isHebrew ? 'נקה חיפוש' : 'Clear search'}
      </Button>
    </div>
  );
}
