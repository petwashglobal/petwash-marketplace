import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, MapPin, CalendarDays, Dog, Cat, ChevronDown, ChevronUp,
  Home, Heart, Clock, Route, Car, GraduationCap, Sparkles,
  Star, Shield, CheckCircle, Users, Plus, Minus, AlertTriangle, Loader2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, isValid, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { useLanguage } from "@/lib/languageStore";

type ServiceType = 
  | 'boarding' 
  | 'house-sitting' 
  | 'daycare' 
  | 'drop-in' 
  | 'dog-walking' 
  | 'pet-taxi' 
  | 'training'
  | 'grooming';

type PetType = 'puppy' | 'dog' | 'cat' | 'bird' | 'rabbit' | 'fish' | 'reptile' | 'other';

interface PetTypeOption {
  id: PetType;
  name: string;
  nameHe: string;
  emoji: string;
  description: string;
  descriptionHe: string;
}

const PET_TYPES: PetTypeOption[] = [
  { id: 'puppy', name: 'Puppy', nameHe: 'גור', emoji: '🐶', description: 'Under 6 months', descriptionHe: 'עד 6 חודשים' },
  { id: 'dog', name: 'Dog', nameHe: 'כלב', emoji: '🐕', description: 'Over 6 months', descriptionHe: 'מעל 6 חודשים' },
  { id: 'cat', name: 'Cat', nameHe: 'חתול', emoji: '🐈', description: 'Including kittens', descriptionHe: 'כולל גורים' },
  { id: 'bird', name: 'Bird', nameHe: 'ציפור', emoji: '🦜', description: 'All birds', descriptionHe: 'כל הציפורים' },
  { id: 'rabbit', name: 'Rabbit', nameHe: 'ארנב', emoji: '🐰', description: 'Bunnies & rabbits', descriptionHe: 'ארנבים וארנבונים' },
  { id: 'fish', name: 'Fish', nameHe: 'דגים', emoji: '🐠', description: 'Aquarium care', descriptionHe: 'טיפול באקווריום' },
  { id: 'reptile', name: 'Reptile', nameHe: 'זוחל', emoji: '🦎', description: 'Lizards, snakes', descriptionHe: 'לטאות, נחשים' },
  { id: 'other', name: 'Other', nameHe: 'אחר', emoji: '🐾', description: 'Small animals', descriptionHe: 'חיות קטנות' },
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
  { id: 'bath', name: 'Bath / Wash', nameHe: 'רחצה', icon: '🛁' },
  { id: 'nail-trim', name: 'Nail trimming', nameHe: 'גזירת ציפורניים', icon: '✂️' },
  { id: 'pickup', name: 'Pick-up / Drop-off', nameHe: 'איסוף והחזרה', icon: '🚗' },
  { id: 'photo-updates', name: 'Photo updates', nameHe: 'עדכוני תמונות', icon: '📸' },
  { id: 'overnight', name: 'Overnight stay', nameHe: 'לינה', icon: '🌙' },
  { id: 'training', name: 'Basic training', nameHe: 'אילוף בסיסי', icon: '🎓' },
];

interface PetSize {
  id: string;
  name: string;
  nameHe: string;
  weight: string;
  weightHe: string;
}

const PET_SIZES: PetSize[] = [
  { id: 'tiny', name: 'Tiny', nameHe: 'זעיר', weight: '0-5 kg', weightHe: '0-5 ק״ג' },
  { id: 'small', name: 'Small', nameHe: 'קטן', weight: '5-10 kg', weightHe: '5-10 ק״ג' },
  { id: 'medium', name: 'Medium', nameHe: 'בינוני', weight: '10-20 kg', weightHe: '10-20 ק״ג' },
  { id: 'large', name: 'Large', nameHe: 'גדול', weight: '20-40 kg', weightHe: '20-40 ק״ג' },
  { id: 'giant', name: 'Giant', nameHe: 'ענק', weight: '40+ kg', weightHe: '40+ ק״ג' },
];

interface EnergyLevel {
  id: string;
  name: string;
  nameHe: string;
  emoji: string;
}

const ENERGY_LEVELS: EnergyLevel[] = [
  { id: 'low', name: 'Low / Calm', nameHe: 'נמוכה / רגוע', emoji: '😴' },
  { id: 'medium', name: 'Medium', nameHe: 'בינונית', emoji: '🙂' },
  { id: 'high', name: 'High / Active', nameHe: 'גבוהה / פעיל', emoji: '⚡' },
  { id: 'very-high', name: 'Very High', nameHe: 'גבוהה מאוד', emoji: '🚀' },
];

interface SocialLevel {
  id: string;
  name: string;
  nameHe: string;
}

const SOCIAL_LEVELS: SocialLevel[] = [
  { id: 'great', name: 'Great', nameHe: 'מצוין' },
  { id: 'good', name: 'Good with intro', nameHe: 'טוב עם היכרות' },
  { id: 'nervous', name: 'Nervous / Shy', nameHe: 'עצבני / ביישן' },
  { id: 'not-tested', name: 'Not tested', nameHe: 'לא נבדק' },
  { id: 'no', name: 'Not good', nameHe: 'לא טוב' },
];

interface ServiceOption {
  id: ServiceType;
  name: string;
  nameHe: string;
  icon: typeof Home;
  description: string;
  descriptionHe: string;
}

type ServiceCategory = 'overnight' | 'daytime';

interface ServiceCategoryOption {
  id: ServiceCategory;
  name: string;
  nameHe: string;
}

const SERVICE_CATEGORIES: ServiceCategoryOption[] = [
  { id: 'overnight', name: 'Overnight services', nameHe: 'שירותי לילה' },
  { id: 'daytime', name: 'Daytime services', nameHe: 'שירותי יום' },
];

const SERVICES: ServiceOption[] = [
  { 
    id: 'boarding', 
    name: 'Hosting', 
    nameHe: 'אירוח',
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
  { 
    id: 'grooming', 
    name: 'Grooming', 
    nameHe: 'טיפוח',
    icon: Sparkles,
    description: 'Professional pet grooming',
    descriptionHe: 'טיפוח מקצועי'
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
    buttonGradient: 'from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600',
    buttonShadow: 'shadow-fuchsia-500/30 hover:shadow-fuchsia-500/40',
    selectedBorder: 'border-fuchsia-500',
    selectedBg: 'bg-fuchsia-50',
    selectedText: 'text-fuchsia-700',
    iconColor: 'text-fuchsia-500',
    focusRing: 'focus:ring-fuchsia-500',
    focusBorder: 'focus:border-fuchsia-500',
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
    selectedBg: 'bg-white',
    selectedText: 'text-amber-700',
    iconColor: 'text-amber-500',
    focusRing: 'focus:ring-amber-500',
    focusBorder: 'focus:border-amber-500',
  },
};

export interface BookingSearchResponse {
  providers: Array<{
    id: number;
    userId: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
    rating: number;
    totalReviews: number;
    pricePerNight: number | null;
    pricePerHour: number | null;
    city: string;
    isVerified: boolean;
    bio: string | null;
    badges: string[];
  }>;
  total: number;
  searchId: string;
}

function GooglePlacesLocationInput({
  value,
  onChange,
  onCoordsChange,
  placeholder,
  focusRing,
  focusBorder,
}: {
  value: string;
  onChange: (value: string) => void;
  onCoordsChange?: (lat: number | null, lng: number | null) => void;
  placeholder: string;
  focusRing: string;
  focusBorder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(() => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [predictions, setPredictions] = useState<Array<{ placeId: string; description: string; mainText?: string; secondaryText?: string }>>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  const fetchPredictions = async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowCitySuggestions(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setIsLoadingPredictions(true);

    try {
      const params = new URLSearchParams({
        input,
        components: 'country:il',
        language: document.documentElement.lang === 'he' ? 'iw' : 'en',
      });
      const res = await fetch(`/api/google/places-autocomplete?${params}`, {
        signal: abortRef.current.signal,
        credentials: 'include',
        headers: { 'x-places-session': sessionTokenRef.current },
      });
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setShowCitySuggestions((data.predictions || []).length > 0);
      } else {
        setPredictions([]);
        setShowCitySuggestions(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setPredictions([]);
      setShowCitySuggestions(false);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  const selectPrediction = async (pred: { placeId: string; description: string }) => {
    onChange(pred.description);
    setShowCitySuggestions(false);
    setPredictions([]);

    try {
      const params = new URLSearchParams({
        placeId: pred.placeId,
        language: document.documentElement.lang === 'he' ? 'iw' : 'en',
      });
      const currentToken = sessionTokenRef.current;
      const res = await fetch(`/api/google/places-details?${params}`, {
        credentials: 'include',
        headers: { 'x-places-session': currentToken },
      });
      sessionTokenRef.current = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) onCoordsChange?.(data.lat, data.lng);
        if (data.formattedAddress) onChange(data.formattedAddress);
      }
    } catch {
    }
  };

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          onCoordsChange?.(latitude, longitude);
          onChange('Tel Aviv');
        } catch {
          onChange('Tel Aviv');
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out');
            break;
          default:
            setLocationError('Unable to get location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className="relative">
      <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
          if (!newValue) {
            setPredictions([]);
            setShowCitySuggestions(false);
            return;
          }
          setShowCitySuggestions(true);
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => fetchPredictions(newValue), 300);
        }}
        onFocus={() => {
          if (value.length >= 3 && predictions.length > 0) setShowCitySuggestions(true);
          else if (value.length > 0 && predictions.length === 0) setShowCitySuggestions(true);
        }}
        onBlur={() => {
          setTimeout(() => setShowCitySuggestions(false), 200);
        }}
        className={`ps-10 pe-12 h-12 border-gray-200 rounded-xl focus:ring-2 ${focusRing} ${focusBorder}`}
        data-testid="input-search-location"
        autoComplete="off"
      />
      {isLoadingPredictions && (
        <div className="absolute end-12 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
        </div>
      )}
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={isGettingLocation}
        className="absolute end-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        title="Use my location"
        data-testid="button-use-my-location"
      >
        {isGettingLocation ? (
          <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-500">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
          </svg>
        )}
      </button>
      {locationError && (
        <div className="absolute top-full start-0 mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {locationError}
        </div>
      )}
      
      {showCitySuggestions && predictions.length > 0 && (
        <div className="absolute top-full start-0 end-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
          {predictions.map((pred) => (
            <button
              key={pred.placeId}
              type="button"
              className="w-full px-4 py-3 text-start hover:bg-gray-50 flex items-start gap-3 text-sm border-b border-gray-50 last:border-b-0"
              onMouseDown={(e) => {
                e.preventDefault();
                selectPrediction(pred);
              }}
            >
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{pred.mainText || pred.description}</div>
                {pred.secondaryText && (
                  <div className="text-xs text-gray-500 truncate">{pred.secondaryText}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

interface ProviderSearchProps {
  onSearch?: (params: SearchParams, results?: BookingSearchResponse) => void;
  showResults?: boolean;
  platform?: 'sitter-suite' | 'walk-my-pet' | 'pettrek' | 'academy' | 'all';
  theme?: 'pink' | 'emerald' | 'blue' | 'purple' | 'amber';
  initialLocation?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  initialPetType?: PetType | string;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

export interface SearchParams {
  location: string;
  lat: number | null;
  lng: number | null;
  service: ServiceType;
  petType: PetType;
  petCount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  specialServices: string[];
  specialRequests: string;
  allergies: string;
  petName: string;
  petBreed: string;
  petSize: string;
  petAge: string;
  petGender: string;
  energyLevel: string;
  isDesexed: boolean;
  isMicrochipped: boolean;
  isToiletTrained: boolean;
  hasSeparationAnxiety: boolean;
  socialWithDogs: string;
  socialWithCats: string;
  socialWithChildren: string;
  feedingInstructions: string;
  walkingPreferences: string;
  vetName: string;
  vetPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export function ProviderSearch({ 
  onSearch, 
  showResults = true, 
  platform = 'all', 
  theme = 'pink',
  initialLocation = '',
  initialLat,
  initialLng,
  initialPetType,
  initialStartDate,
  initialEndDate
}: ProviderSearchProps) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const t = THEMES[theme] || THEMES.pink;

  const [location, setLocation] = useState(initialLocation || '');
  const [searchLat, setSearchLat] = useState<number | null>(initialLat ?? null);
  const [searchLng, setSearchLng] = useState<number | null>(initialLng ?? null);
  const [selectedService, setSelectedService] = useState<ServiceType>(
    platform === 'walk-my-pet' ? 'dog-walking' : 
    platform === 'pettrek' ? 'pet-taxi' : 
    platform === 'academy' ? 'training' : 'boarding'
  );
  const [petType, setPetType] = useState<PetType>(
    (initialPetType as PetType) || 'dog'
  );
  const [petCount, setPetCount] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialStartDate || addDays(new Date(), 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialEndDate || addDays(new Date(), 3)
  );
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [petTypeDropdownOpen, setPetTypeDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerFocus, setDatePickerFocus] = useState<'start' | 'end'>('start');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<'services' | 'profile' | 'behavior' | 'care' | 'emergency'>('services');
  const [specialServices, setSpecialServices] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [allergies, setAllergies] = useState('');
  
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petSize, setPetSize] = useState('medium');
  const [petAge, setPetAge] = useState('');
  const [petGender, setPetGender] = useState('');
  const [energyLevel, setEnergyLevel] = useState('medium');
  const [isDesexed, setIsDesexed] = useState(false);
  const [isMicrochipped, setIsMicrochipped] = useState(false);
  const [isToiletTrained, setIsToiletTrained] = useState(true);
  const [hasSeparationAnxiety, setHasSeparationAnxiety] = useState(false);
  const [socialWithDogs, setSocialWithDogs] = useState('great');
  const [socialWithCats, setSocialWithCats] = useState('not-tested');
  const [socialWithChildren, setSocialWithChildren] = useState('great');
  const [feedingInstructions, setFeedingInstructions] = useState('');
  const [walkingPreferences, setWalkingPreferences] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [requestMeetAndGreet, setRequestMeetAndGreet] = useState(false);


  const selectedServiceData = SERVICES.find(s => s.id === selectedService);
  const selectedPetTypeData = PET_TYPES.find(p => p.id === petType);

  const handleSearch = () => {
    const locationInput = document.querySelector('[data-testid="input-search-location"]') as HTMLInputElement;
    const actualLocation = locationInput?.value || location;
    if (actualLocation && actualLocation !== location) {
      setLocation(actualLocation);
    }
    
    const route = getRouteForService(selectedService);
    let targetPath = `${route}?location=${encodeURIComponent(actualLocation)}&pet=${petType}&count=${petCount}&start=${startDate?.toISOString() || ''}&end=${endDate?.toISOString() || ''}`;
    if (searchLat !== null && searchLng !== null) {
      targetPath += `&lat=${searchLat}&lng=${searchLng}`;
    }
    
    if (onSearch) {
      onSearch({
        location: actualLocation,
        lat: searchLat,
        lng: searchLng,
        service: selectedService,
        petType,
        petCount,
        startDate,
        endDate,
        specialServices,
        specialRequests,
        allergies,
        petName,
        petBreed,
        petSize,
        petAge,
        petGender,
        energyLevel,
        isDesexed,
        isMicrochipped,
        isToiletTrained,
        hasSeparationAnxiety,
        socialWithDogs,
        socialWithCats,
        socialWithChildren,
        feedingInstructions,
        walkingPreferences,
        vetName,
        vetPhone,
        emergencyContactName,
        emergencyContactPhone,
      });
    }
    
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith(route)) {
      navigate(targetPath);
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
        return '/sitter-suite/browse';
      case 'dog-walking':
        return '/walk-my-pet/browse';
      case 'pet-taxi':
        return '/pettrek/browse';
      case 'training':
        return '/academy/browse';
      default:
        return '/sitter-suite/browse';
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
            <GooglePlacesLocationInput
              value={location}
              onChange={(val) => {
                setLocation(val);
                if (!val) {
                  setSearchLat(null);
                  setSearchLng(null);
                }
              }}
              onCoordsChange={(lat, lng) => {
                setSearchLat(lat);
                setSearchLng(lng);
              }}
              placeholder={isHebrew ? 'הזן כתובת, שכונה או עיר' : 'Enter address, suburb or city'}
              focusRing={t.focusRing}
              focusBorder={t.focusBorder}
            />
          </div>

          <div className="lg:col-span-1 relative">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isHebrew ? 'סוג שירות' : 'Service Type'}
            </label>
            <Popover open={serviceDropdownOpen} onOpenChange={setServiceDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  className="w-full h-12 px-4 flex items-center justify-between bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-start"
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
                        className={`w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-start ${
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
                        {isSelected && <CheckCircle className={`h-5 w-5 ${t.iconColor} ms-auto`} />}
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
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="text-lg shrink-0">{selectedPetTypeData?.emoji}</span>
                      <span className="text-gray-900 font-medium text-sm truncate">
                        {isHebrew ? selectedPetTypeData?.nameHe : selectedPetTypeData?.name}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
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
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-start ${
                            isSelected 
                              ? `${t.selectedBg} ${t.selectedText}` 
                              : 'hover:bg-gray-50'
                          }`}
                          data-testid={`option-pet-${pet.id}`}
                        >
                          <span className="text-xl">{pet.emoji}</span>
                          <div className="flex-1">
                            <span className={`font-medium text-sm block ${isSelected ? '' : 'text-gray-700'}`}>
                              {isHebrew ? pet.nameHe : pet.name}
                            </span>
                            <span className={`text-xs ${isSelected ? 'opacity-80' : 'text-gray-500'}`}>
                              {isHebrew ? pet.descriptionHe : pet.description}
                            </span>
                          </div>
                          {isSelected && <CheckCircle className={`h-4 w-4 ${t.iconColor}`} />}
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
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className="w-full h-12 px-3 flex items-center gap-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors cursor-pointer"
                  data-testid="button-date-picker"
                >
                  <CalendarDays className={`h-4 w-4 shrink-0 ${t.iconColor}`} />
                  <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
                    <span className={`font-medium truncate ${startDate ? 'text-gray-900' : 'text-gray-400'}`}>
                      {startDate && isValid(startDate) 
                        ? format(startDate, 'd MMM', { locale: isHebrew ? he : undefined })
                        : (isHebrew ? 'כניסה' : 'Check-in')}
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className={`font-medium truncate ${endDate ? 'text-gray-900' : 'text-gray-400'}`}>
                      {endDate && isValid(endDate)
                        ? format(endDate, 'd MMM', { locale: isHebrew ? he : undefined })
                        : (isHebrew ? 'יציאה' : 'Check-out')}
                    </span>
                  </div>
                  {startDate && endDate && (
                    <span className={`text-xs ${t.iconColor} font-semibold shrink-0`}>
                      {differenceInDays(endDate, startDate)}{isHebrew ? ' לילות' : ' nights'}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 shadow-2xl border-0 rounded-2xl overflow-hidden" 
                align="center"
                sideOffset={8}
              >
                <div className="bg-white rounded-2xl">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setDatePickerFocus('start')}
                        className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                          datePickerFocus === 'start' 
                            ? `${t.selectedText} border-current` 
                            : 'text-gray-400 border-transparent hover:text-gray-600'
                        }`}
                      >
                        {isHebrew ? 'כניסה' : 'Check-in'}
                        {startDate && isValid(startDate) && (
                          <span className="block text-xs font-normal text-gray-500 mt-0.5">
                            {format(startDate, 'EEE, d MMM yyyy', { locale: isHebrew ? he : undefined })}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setDatePickerFocus('end')}
                        className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                          datePickerFocus === 'end' 
                            ? `${t.selectedText} border-current` 
                            : 'text-gray-400 border-transparent hover:text-gray-600'
                        }`}
                      >
                        {isHebrew ? 'יציאה' : 'Check-out'}
                        {endDate && isValid(endDate) && (
                          <span className="block text-xs font-normal text-gray-500 mt-0.5">
                            {format(endDate, 'EEE, d MMM yyyy', { locale: isHebrew ? he : undefined })}
                          </span>
                        )}
                      </button>
                    </div>
                    {(startDate || endDate) && (
                      <button
                        onClick={() => {
                          setStartDate(undefined);
                          setEndDate(undefined);
                          setDatePickerFocus('start');
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        {isHebrew ? 'נקה' : 'Clear'}
                      </button>
                    )}
                  </div>
                  <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate } as DateRange}
                    onSelect={(range: DateRange | undefined) => {
                      if (!range) {
                        setStartDate(undefined);
                        setEndDate(undefined);
                        return;
                      }
                      setStartDate(range.from);
                      setEndDate(range.to);
                      if (range.from && !range.to) {
                        setDatePickerFocus('end');
                      }
                      if (range.from && range.to) {
                        setTimeout(() => setDatePickerOpen(false), 300);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={{ before: new Date() }}
                    locale={isHebrew ? he : undefined}
                    dir={isHebrew ? 'rtl' : 'ltr'}
                    fromMonth={new Date()}
                    className="p-4"
                    classNames={{
                      months: "flex flex-col sm:flex-row gap-4",
                      month: "space-y-3",
                      caption: "flex justify-center pt-2 pb-3 relative items-center",
                      caption_label: "text-sm font-semibold text-gray-900",
                      nav: "flex items-center",
                      nav_button: "h-8 w-8 p-0 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors touch-manipulation",
                      nav_button_previous: "absolute start-1",
                      nav_button_next: "absolute end-1",
                      table: "w-full border-collapse",
                      head_row: "flex",
                      head_cell: "text-gray-400 w-11 h-9 font-medium text-xs flex items-center justify-center",
                      row: "flex w-full mt-0",
                      cell: `h-11 w-11 text-center text-sm p-0 relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-range-start)]:rounded-l-full [&:has([aria-selected])]:${t.selectedBg} first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full`,
                      day: "h-11 w-11 p-0 font-medium rounded-full text-gray-900 hover:bg-gray-100 transition-colors aria-selected:opacity-100 touch-manipulation cursor-pointer select-none",
                      day_range_start: `day-range-start !${t.accent === 'emerald' ? 'bg-emerald-500' : 'bg-fuchsia-500'} !text-white !font-bold !rounded-full hover:!${t.accent === 'emerald' ? 'bg-emerald-600' : 'bg-fuchsia-600'}`,
                      day_range_end: `day-range-end !${t.accent === 'emerald' ? 'bg-emerald-500' : 'bg-fuchsia-500'} !text-white !font-bold !rounded-full hover:!${t.accent === 'emerald' ? 'bg-emerald-600' : 'bg-fuchsia-600'}`,
                      day_range_middle: `!${t.selectedBg} !${t.selectedText} aria-selected:!rounded-none`,
                      day_selected: `${t.accent === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-fuchsia-500 hover:bg-fuchsia-600'} text-white font-bold rounded-full`,
                      day_today: "bg-gray-100 text-gray-900 font-bold",
                      day_outside: `text-gray-300 opacity-50 aria-selected:${t.selectedBg}/50 aria-selected:${t.selectedText}`,
                      day_disabled: "text-gray-200 opacity-40 cursor-not-allowed line-through",
                      day_hidden: "invisible",
                    }}
                  />
                  {startDate && endDate && (
                    <div className="px-5 pb-4 pt-1 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {differenceInDays(endDate, startDate)} {isHebrew ? 'לילות' : 'nights'}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setDatePickerOpen(false)}
                        className={`rounded-full px-6 bg-gradient-to-r ${t.buttonGradient} text-white`}
                      >
                        {isHebrew ? 'אישור' : 'Done'}
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <Button
              onClick={handleSearch}
              className={`w-full h-12 bg-gradient-to-r ${t.buttonGradient} text-white rounded-xl font-semibold shadow-lg ${t.buttonShadow} transition-all hover:shadow-xl disabled:opacity-50`}
              data-testid="button-search"
            >
              <Search className="h-5 w-5 me-2" />
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
          <div className="mt-4 pt-4 border-t border-gray-100" data-testid="section-advanced-options">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: 'services' as const, name: 'Services', nameHe: 'שירותים', icon: '✨' },
                { id: 'profile' as const, name: 'Pet Profile', nameHe: 'פרופיל', icon: '🐾' },
                { id: 'behavior' as const, name: 'Behavior', nameHe: 'התנהגות', icon: '💚' },
                { id: 'care' as const, name: 'Care & Health', nameHe: 'טיפול ובריאות', icon: '🏥' },
                { id: 'emergency' as const, name: 'Emergency', nameHe: 'חירום', icon: '🚨' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdvancedTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                    advancedTab === tab.id
                      ? `${t.selectedBg} ${t.selectedText}`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <span>{tab.icon}</span>
                  <span>{isHebrew ? tab.nameHe : tab.name}</span>
                </button>
              ))}
            </div>

            {advancedTab === 'services' && (
              <div className="space-y-4">
                <div className={`p-3 bg-gradient-to-r ${t.accent === 'emerald' ? 'from-emerald-50 to-teal-50 border-emerald-200' : 'from-fuchsia-50 to-pink-50 border-fuchsia-200'} rounded-xl border`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox 
                      checked={requestMeetAndGreet} 
                      onCheckedChange={(checked) => setRequestMeetAndGreet(checked as boolean)} 
                      data-testid="checkbox-meet-greet" 
                    />
                    <div>
                      <span className={`text-sm font-medium ${t.accent === 'emerald' ? 'text-emerald-800' : 'text-fuchsia-800'} flex items-center gap-2`}>
                        🤝 {isHebrew ? 'בקש פגישת היכרות' : 'Request Meet & Greet'}
                      </span>
                      <p className={`text-xs ${t.accent === 'emerald' ? 'text-emerald-600' : 'text-fuchsia-600'}`}>
                        {isHebrew 
                          ? 'פגוש את השמרטף לפני ההזמנה לוודא התאמה'
                          : 'Meet the sitter before booking to ensure a good fit'
                        }
                      </p>
                    </div>
                  </label>
                </div>

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
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {isHebrew ? 'בקשות מיוחדות' : 'Special Requests'}
                  </label>
                  <Textarea
                    placeholder={isHebrew ? 'לדוגמה: צריך טיול ארוך, אוהב לשחק, צריך שקט בלילה...' : 'e.g., Needs long walks, loves to play, needs quiet at night...'}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className={`border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                    rows={2}
                    data-testid="input-special-requests"
                  />
                </div>
              </div>
            )}

            {advancedTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'שם חיית המחמד' : 'Pet Name'}
                    </label>
                    <Input
                      placeholder={isHebrew ? 'שם' : 'Name'}
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-pet-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'גזע' : 'Breed'}
                    </label>
                    <Input
                      placeholder={isHebrew ? 'גזע' : 'Breed'}
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-pet-breed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'גיל' : 'Age'}
                    </label>
                    <Input
                      placeholder={isHebrew ? 'לדוגמה: 3 שנים' : 'e.g., 3 years'}
                      value={petAge}
                      onChange={(e) => setPetAge(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-pet-age"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'מין' : 'Gender'}
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPetGender('male')}
                        className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${
                          petGender === 'male' ? `${t.selectedBg} ${t.selectedBorder} ${t.selectedText} border` : 'bg-gray-50 border border-gray-200 text-gray-600'
                        }`}
                        data-testid="button-gender-male"
                      >
                        {isHebrew ? '♂ זכר' : '♂ Male'}
                      </button>
                      <button
                        onClick={() => setPetGender('female')}
                        className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${
                          petGender === 'female' ? `${t.selectedBg} ${t.selectedBorder} ${t.selectedText} border` : 'bg-gray-50 border border-gray-200 text-gray-600'
                        }`}
                        data-testid="button-gender-female"
                      >
                        {isHebrew ? '♀ נקבה' : '♀ Female'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'גודל' : 'Size'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PET_SIZES.map((size) => (
                        <button
                          key={size.id}
                          onClick={() => setPetSize(size.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            petSize === size.id
                              ? `${t.selectedBg} ${t.selectedText}`
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          data-testid={`button-size-${size.id}`}
                        >
                          {isHebrew ? size.nameHe : size.name} ({isHebrew ? size.weightHe : size.weight})
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {isHebrew ? 'רמת אנרגיה' : 'Energy Level'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ENERGY_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setEnergyLevel(level.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            energyLevel === level.id
                              ? `${t.selectedBg} ${t.selectedText}`
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          data-testid={`button-energy-${level.id}`}
                        >
                          <span>{level.emoji}</span>
                          <span>{isHebrew ? level.nameHe : level.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isDesexed} onCheckedChange={(checked) => setIsDesexed(checked as boolean)} data-testid="checkbox-desexed" />
                    <span className="text-sm text-gray-700">{isHebrew ? 'מעוקר/מסורס' : 'Desexed'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isMicrochipped} onCheckedChange={(checked) => setIsMicrochipped(checked as boolean)} data-testid="checkbox-microchipped" />
                    <span className="text-sm text-gray-700">{isHebrew ? 'משובב' : 'Microchipped'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isToiletTrained} onCheckedChange={(checked) => setIsToiletTrained(checked as boolean)} data-testid="checkbox-toilet-trained" />
                    <span className="text-sm text-gray-700">{isHebrew ? 'מחונך לצרכים' : 'Toilet Trained'}</span>
                  </label>
                </div>
              </div>
            )}

            {advancedTab === 'behavior' && (
              <div className="space-y-4">
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={hasSeparationAnxiety} onCheckedChange={(checked) => setHasSeparationAnxiety(checked as boolean)} data-testid="checkbox-separation-anxiety" />
                    <div>
                      <span className="text-sm font-medium text-amber-800">{isHebrew ? 'חרדת נטישה' : 'Separation Anxiety'}</span>
                      <p className="text-xs text-amber-600">{isHebrew ? 'הכלב/חתול מתקשה להישאר לבד' : 'Pet has difficulty being left alone'}</p>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      🐕 {isHebrew ? 'חברותי עם כלבים' : 'Social with Dogs'}
                    </label>
                    <div className="space-y-1">
                      {SOCIAL_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setSocialWithDogs(level.id)}
                          className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-all ${
                            socialWithDogs === level.id
                              ? `${t.selectedBg} ${t.selectedText}`
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          data-testid={`button-social-dogs-${level.id}`}
                        >
                          {isHebrew ? level.nameHe : level.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      🐈 {isHebrew ? 'חברותי עם חתולים' : 'Social with Cats'}
                    </label>
                    <div className="space-y-1">
                      {SOCIAL_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setSocialWithCats(level.id)}
                          className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-all ${
                            socialWithCats === level.id
                              ? `${t.selectedBg} ${t.selectedText}`
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          data-testid={`button-social-cats-${level.id}`}
                        >
                          {isHebrew ? level.nameHe : level.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      👶 {isHebrew ? 'חברותי עם ילדים' : 'Social with Children'}
                    </label>
                    <div className="space-y-1">
                      {SOCIAL_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => setSocialWithChildren(level.id)}
                          className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-all ${
                            socialWithChildren === level.id
                              ? `${t.selectedBg} ${t.selectedText}`
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                          data-testid={`button-social-children-${level.id}`}
                        >
                          {isHebrew ? level.nameHe : level.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {advancedTab === 'care' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>{isHebrew ? 'אלרגיות / מצב בריאותי' : 'Allergies / Health Conditions'}</span>
                    </div>
                  </label>
                  <Textarea
                    placeholder={isHebrew ? 'לדוגמה: אלרגיה לחיטה, סוכרת, בעיות מפרקים...' : 'e.g., Wheat allergy, diabetes, joint problems...'}
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className={`border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                    rows={2}
                    data-testid="input-allergies"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      🍽️ {isHebrew ? 'הוראות האכלה' : 'Feeding Instructions'}
                    </label>
                    <Textarea
                      placeholder={isHebrew ? 'סוג מזון, כמות, זמני האכלה...' : 'Food type, quantity, feeding times...'}
                      value={feedingInstructions}
                      onChange={(e) => setFeedingInstructions(e.target.value)}
                      className={`border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      rows={2}
                      data-testid="input-feeding"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      🚶 {isHebrew ? 'העדפות טיול' : 'Walking Preferences'}
                    </label>
                    <Textarea
                      placeholder={isHebrew ? 'משך טיול, מסלולים מועדפים, פחדים...' : 'Walk duration, preferred routes, fears...'}
                      value={walkingPreferences}
                      onChange={(e) => setWalkingPreferences(e.target.value)}
                      className={`border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      rows={2}
                      data-testid="input-walking"
                    />
                  </div>
                </div>
              </div>
            )}

            {advancedTab === 'emergency' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-700">
                    {isHebrew 
                      ? 'פרטי החירום חיוניים למקרה של בעיה רפואית או מצב חירום. אנא וודאו שאיש הקשר זמין בזמן ששהייתכם מחוץ לבית.'
                      : 'Emergency details are essential in case of medical issues. Please ensure your contact is available while you\'re away.'
                    }
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      🏥 {isHebrew ? 'שם הווטרינר' : 'Vet Name'}
                    </label>
                    <Input
                      placeholder={isHebrew ? 'שם המרפאה / הווטרינר' : 'Clinic / Vet name'}
                      value={vetName}
                      onChange={(e) => setVetName(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-vet-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      📞 {isHebrew ? 'טלפון הווטרינר' : 'Vet Phone'}
                    </label>
                    <Input
                      placeholder="+972 50 000 0000"
                      value={vetPhone}
                      onChange={(e) => setVetPhone(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-vet-phone"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      🚨 {isHebrew ? 'איש קשר לחירום' : 'Emergency Contact Name'}
                    </label>
                    <Input
                      placeholder={isHebrew ? 'שם מלא' : 'Full name'}
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-emergency-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      📱 {isHebrew ? 'טלפון לחירום' : 'Emergency Phone'}
                    </label>
                    <Input
                      placeholder="+972 50 000 0000"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className={`h-10 border-gray-200 rounded-xl ${t.focusRing} ${t.focusBorder}`}
                      data-testid="input-emergency-phone"
                    />
                  </div>
                </div>
              </div>
            )}
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
            <Sparkles className={`h-4 w-4 ${t.iconColor}`} />
            <span>{isHebrew ? 'ביטוח מלא כלול' : 'Full insurance included'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProviderCardProps {
  id: string | number;
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
  bio?: string;
  theme?: 'pink' | 'emerald' | 'blue' | 'purple' | 'amber';
  onClick: () => void;
}

export function ProviderCard({
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
  bio,
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
      <div className={`aspect-[4/3] bg-gradient-to-br ${theme === 'emerald' ? 'from-emerald-100 to-teal-100' : 'from-fuchsia-100 to-pink-100'} relative overflow-hidden`}>
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
          <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
            <Shield className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-gray-700">
              {isHebrew ? 'מאומת' : 'Verified'}
            </span>
          </div>
        )}

        <div className="absolute bottom-3 start-3 flex items-center gap-1 px-2.5 py-1 bg-amber-500 rounded-full shadow-md">
          <Star className="h-3.5 w-3.5 text-white fill-current" />
          <span className="text-sm font-bold text-white">{rating.toFixed(1)}</span>
          <span className="text-xs text-white/80">({reviewCount})</span>
        </div>

        {distance && (
          <div className="absolute bottom-3 end-3 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
            <span className="text-xs font-medium text-gray-600">{distance}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-1" data-testid={`text-name-${id}`}>
          {name}
        </h3>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{location}</span>
        </div>

        {bio && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">{bio}</p>
        )}

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
            <span className="text-sm text-gray-500 ms-1">
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

export function SearchEmptyState({ service }: { service: string }) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="text-center py-16 px-4">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <Search className="w-10 h-10 text-gray-400" />
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
