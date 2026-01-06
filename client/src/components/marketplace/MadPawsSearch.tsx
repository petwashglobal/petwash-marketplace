import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, MapPin, CalendarDays, Dog, Cat, ChevronDown, ChevronUp,
  Home, Heart, Clock, Route, Car, GraduationCap, Sparkles,
  Star, Shield, CheckCircle, Users, Plus, Minus, AlertTriangle
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

type PetType = 'dog' | 'cat' | 'fish' | 'bird' | 'rabbit' | 'reptile' | 'other';

interface PetTypeOption {
  id: PetType;
  name: string;
  nameHe: string;
  emoji: string;
}

const PET_TYPES: PetTypeOption[] = [
  { id: 'dog', name: 'Dog', nameHe: 'כלב', emoji: '🐕' },
  { id: 'cat', name: 'Cat', nameHe: 'חתול', emoji: '🐈' },
  { id: 'fish', name: 'Fish', nameHe: 'דג', emoji: '🐠' },
  { id: 'bird', name: 'Bird', nameHe: 'ציפור', emoji: '🦜' },
  { id: 'rabbit', name: 'Rabbit', nameHe: 'ארנב', emoji: '🐰' },
  { id: 'reptile', name: 'Reptile', nameHe: 'זוחל', emoji: '🦎' },
  { id: 'other', name: 'Other', nameHe: 'אחר', emoji: '🐾' },
];

interface SpecialService {
  id: string;
  name: string;
  nameHe: string;
  icon: string;
}

const SPECIAL_SERVICES: SpecialService[] = [
  { id: 'water-plants', name: 'Water plants', nameHe: 'השקיית צמחים', icon: '🌱' },
  { id: 'collect-mail', name: 'Collect mail', nameHe: 'איסוף דואר', icon: '📬' },
  { id: 'take-trash', name: 'Take out trash', nameHe: 'הוצאת זבל', icon: '🗑️' },
  { id: 'medication', name: 'Give medication', nameHe: 'מתן תרופות', icon: '💊' },
  { id: 'grooming', name: 'Basic grooming', nameHe: 'טיפוח בסיסי', icon: '✨' },
  { id: 'playtime', name: 'Extra playtime', nameHe: 'משחק נוסף', icon: '🎾' },
];

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

export interface SearchTheme {
  accent: 'pink' | 'emerald' | 'blue' | 'purple' | 'amber';
  buttonGradient: string;
  buttonShadow: string;
  selectedBorder: string;
  selectedBg: string;
  selectedText: string;
  iconColor: string;
  focusRing: string;
  focusBorder: string;
}

const THEMES: Record<string, SearchTheme> = {
  pink: {
    accent: 'pink',
    buttonGradient: 'from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
    buttonShadow: 'shadow-pink-500/25 hover:shadow-pink-500/30',
    selectedBorder: 'border-pink-500',
    selectedBg: 'bg-pink-50',
    selectedText: 'text-pink-700',
    iconColor: 'text-pink-500',
    focusRing: 'focus:ring-pink-500',
    focusBorder: 'focus:border-pink-500',
  },
  emerald: {
    accent: 'emerald',
    buttonGradient: 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600',
    buttonShadow: 'shadow-emerald-500/25 hover:shadow-emerald-500/30',
    selectedBorder: 'border-emerald-500',
    selectedBg: 'bg-emerald-50',
    selectedText: 'text-emerald-700',
    iconColor: 'text-emerald-500',
    focusRing: 'focus:ring-emerald-500',
    focusBorder: 'focus:border-emerald-500',
  },
  blue: {
    accent: 'blue',
    buttonGradient: 'from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
    buttonShadow: 'shadow-blue-500/25 hover:shadow-blue-500/30',
    selectedBorder: 'border-blue-500',
    selectedBg: 'bg-blue-50',
    selectedText: 'text-blue-700',
    iconColor: 'text-blue-500',
    focusRing: 'focus:ring-blue-500',
    focusBorder: 'focus:border-blue-500',
  },
  purple: {
    accent: 'purple',
    buttonGradient: 'from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600',
    buttonShadow: 'shadow-purple-500/25 hover:shadow-purple-500/30',
    selectedBorder: 'border-purple-500',
    selectedBg: 'bg-purple-50',
    selectedText: 'text-purple-700',
    iconColor: 'text-purple-500',
    focusRing: 'focus:ring-purple-500',
    focusBorder: 'focus:border-purple-500',
  },
  amber: {
    accent: 'amber',
    buttonGradient: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
    buttonShadow: 'shadow-amber-500/25 hover:shadow-amber-500/30',
    selectedBorder: 'border-amber-500',
    selectedBg: 'bg-amber-50',
    selectedText: 'text-amber-700',
    iconColor: 'text-amber-500',
    focusRing: 'focus:ring-amber-500',
    focusBorder: 'focus:border-amber-500',
  },
};

interface MadPawsSearchProps {
  onSearch?: (params: SearchParams) => void;
  showResults?: boolean;
  platform?: 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'academy' | 'all';
  theme?: 'pink' | 'emerald' | 'blue' | 'purple' | 'amber';
}

export interface SearchParams {
  location: string;
  service: ServiceType;
  petType: PetType;
  petCount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  specialServices: string[];
  specialRequests: string;
  allergies: string;
}

export function MadPawsSearch({ onSearch, showResults = true, platform = 'all', theme = 'pink' }: MadPawsSearchProps) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const t = THEMES[theme] || THEMES.pink;

  const [location, setLocation] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceType>(
    platform === 'walk-my-pet' ? 'dog-walking' : 
    platform === 'pettrek' ? 'pet-taxi' : 
    platform === 'academy' ? 'training' : 'boarding'
  );
  const [petType, setPetType] = useState<PetType>('dog');
  const [petCount, setPetCount] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [petTypeDropdownOpen, setPetTypeDropdownOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [specialServices, setSpecialServices] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [allergies, setAllergies] = useState('');

  const selectedServiceData = SERVICES.find(s => s.id === selectedService);
  const selectedPetTypeData = PET_TYPES.find(p => p.id === petType);

  const handleSearch = () => {
    const params: SearchParams = {
      location,
      service: selectedService,
      petType,
      petCount,
      startDate,
      endDate,
      specialServices,
      specialRequests,
      allergies,
    };

    if (onSearch) {
      onSearch(params);
    } else {
      const route = getRouteForService(selectedService);
      navigate(`${route}?location=${encodeURIComponent(location)}&pet=${petType}&count=${petCount}&start=${startDate?.toISOString()}&end=${endDate?.toISOString()}`);
    }
  };

  const toggleSpecialService = (serviceId: string) => {
    setSpecialServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(s => s !== serviceId)
        : [...prev, serviceId]
    );
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
                className={`pl-10 h-12 border-gray-200 rounded-xl focus:ring-2 ${t.focusRing} ${t.focusBorder}`}
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
                    {selectedServiceData && <selectedServiceData.icon className={`h-5 w-5 ${t.iconColor}`} />}
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
                            ? `${t.selectedBg} border-2 ${t.selectedBorder}` 
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                        data-testid={`option-service-${service.id}`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? t.iconColor : 'text-gray-400'}`} />
                        <div>
                          <div className={`font-medium ${isSelected ? t.selectedText : 'text-gray-900'}`}>
                            {isHebrew ? service.nameHe : service.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {isHebrew ? service.descriptionHe : service.description}
                          </div>
                        </div>
                        {isSelected && <CheckCircle className={`h-5 w-5 ${t.iconColor} ml-auto`} />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'סוג וכמות חיות מחמד' : 'Pet Type & Count'}
            </label>
            <div className="flex gap-2 h-12">
              <Popover open={petTypeDropdownOpen} onOpenChange={setPetTypeDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex-1 h-12 px-3 flex items-center justify-between bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                    data-testid="dropdown-pet-type"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{selectedPetTypeData?.emoji}</span>
                      <span className="text-gray-900 font-medium text-sm">
                        {isHebrew ? selectedPetTypeData?.nameHe : selectedPetTypeData?.name}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1">
                    {PET_TYPES.map((pet) => {
                      const isSelected = petType === pet.id;
                      return (
                        <button
                          key={pet.id}
                          onClick={() => {
                            setPetType(pet.id);
                            setPetTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                            isSelected 
                              ? `${t.selectedBg} ${t.selectedText}` 
                              : 'hover:bg-gray-50'
                          }`}
                          data-testid={`option-pet-${pet.id}`}
                        >
                          <span className="text-lg">{pet.emoji}</span>
                          <span className={`font-medium text-sm ${isSelected ? '' : 'text-gray-700'}`}>
                            {isHebrew ? pet.nameHe : pet.name}
                          </span>
                          {isSelected && <CheckCircle className={`h-4 w-4 ${t.iconColor} ml-auto`} />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-1 h-12 px-2 bg-white border border-gray-200 rounded-xl">
                <button
                  onClick={() => setPetCount(Math.max(1, petCount - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  disabled={petCount <= 1}
                  data-testid="button-pet-minus"
                >
                  <Minus className="h-4 w-4 text-gray-500" />
                </button>
                <span className="w-6 text-center font-semibold text-gray-900" data-testid="text-pet-count">
                  {petCount}
                </span>
                <button
                  onClick={() => setPetCount(Math.min(10, petCount + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  disabled={petCount >= 10}
                  data-testid="button-pet-plus"
                >
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              </div>
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
              className={`w-full h-12 bg-gradient-to-r ${t.buttonGradient} text-white rounded-xl font-semibold shadow-lg ${t.buttonShadow} transition-all hover:shadow-xl`}
              data-testid="button-search"
            >
              <Search className="h-5 w-5 mr-2" />
              {isHebrew ? 'חיפוש' : 'Search'}
            </Button>
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          data-testid="button-toggle-advanced"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{isHebrew ? 'אפשרויות נוספות' : 'More Options'}</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4" data-testid="section-advanced-options">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                {isHebrew ? 'שירותים נוספים' : 'Additional Services'}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIAL_SERVICES.map((service) => {
                  const isChecked = specialServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleSpecialService(service.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all ${
                        isChecked
                          ? `${t.selectedBg} ${t.selectedBorder} ${t.selectedText} border`
                          : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                      data-testid={`checkbox-service-${service.id}`}
                    >
                      <span>{service.icon}</span>
                      <span className="font-medium">{isHebrew ? service.nameHe : service.name}</span>
                      {isChecked && <CheckCircle className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span>{isHebrew ? 'אלרגיות / מצב בריאותי' : 'Allergies / Health Conditions'}</span>
                  </div>
                </label>
                <Input
                  placeholder={isHebrew ? 'לדוגמה: אלרגיה לחיטה, סוכרת...' : 'e.g., Wheat allergy, diabetes...'}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                  data-testid="input-allergies"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {isHebrew ? 'בקשות מיוחדות' : 'Special Requests'}
                </label>
                <Input
                  placeholder={isHebrew ? 'לדוגמה: צריך טיול ארוך, אוהב לשחק...' : 'e.g., Needs long walks, loves to play...'}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                  data-testid="input-special-requests"
                />
              </div>
            </div>
          </div>
        )}

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
  theme?: 'pink' | 'emerald' | 'blue' | 'purple' | 'amber';
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
  theme = 'pink',
  onClick,
}: ProviderCardProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const t = THEMES[theme] || THEMES.pink;

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
            <div className={`w-20 h-20 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-3xl font-medium ${t.selectedText} shadow-lg`}>
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
                className={`px-2 py-0.5 ${t.selectedBg} ${t.selectedText} text-xs font-medium rounded-full`}
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
            className={`bg-gradient-to-r ${t.buttonGradient} text-white rounded-full px-4 shadow-md`}
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
