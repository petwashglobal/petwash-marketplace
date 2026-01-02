import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dog, Cat, Rabbit, ChevronRight, ChevronLeft, MapPin, Calendar as CalendarIcon,
  Sparkles, CheckCircle2, Home, Clock, Footprints, Car, Heart, Star, 
  Plus, Minus, Truck, Scissors, Pill, MessageSquare, Crown, Gem
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { cn } from '@/lib/utils';

export type PlatformType = 'sitter' | 'walker' | 'pettrek';

export interface PetSelection {
  dogs: number;
  puppies: number;
  cats: number;
  smallAnimals: number;
}

export interface AddOnService {
  id: string;
  selected: boolean;
  quantity: number;
}

export interface BookingFilters {
  petType: string;
  petSize: string;
  petCount: number;
  pets: PetSelection;
  addOns: AddOnService[];
  specialNotes: string;
  serviceType: string;
  location: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface BookingWizardProps {
  platform: PlatformType;
  onComplete: (filters: BookingFilters) => void;
  onClose?: () => void;
}

const PET_TYPES = [
  { id: 'dog', icon: Dog, labelEn: 'Dog', labelHe: 'כלב' },
  { id: 'puppy', icon: Dog, labelEn: 'Puppy', labelHe: 'גור' },
  { id: 'cat', icon: Cat, labelEn: 'Cat', labelHe: 'חתול' },
  { id: 'other', icon: Rabbit, labelEn: 'Small Animal', labelHe: 'חיה קטנה' },
];

const PET_SIZES = [
  { id: 'small', labelEn: 'Small (0-10kg)', labelHe: 'קטן (0-10 ק"ג)', weight: '0-10kg' },
  { id: 'medium', labelEn: 'Medium (10-25kg)', labelHe: 'בינוני (10-25 ק"ג)', weight: '10-25kg' },
  { id: 'large', labelEn: 'Large (25-45kg)', labelHe: 'גדול (25-45 ק"ג)', weight: '25-45kg' },
  { id: 'giant', labelEn: 'Giant (45kg+)', labelHe: 'ענק (45+ ק"ג)', weight: '45kg+' },
];

const PET_COUNTS = [1, 2, 3];

const ADD_ON_SERVICES = [
  { 
    id: 'pickup', 
    icon: Truck, 
    labelEn: 'Pet Pickup', 
    labelHe: 'איסוף חיית מחמד',
    descEn: 'We collect your pet from your home',
    descHe: 'אנחנו אוספים את חיית המחמד שלך מהבית',
    pricePerTrip: 35,
    currency: '₪'
  },
  { 
    id: 'dropoff', 
    icon: Truck, 
    labelEn: 'Pet Drop-off', 
    labelHe: 'החזרת חיית מחמד',
    descEn: 'We return your pet to your home',
    descHe: 'אנחנו מחזירים את חיית המחמד שלך הביתה',
    pricePerTrip: 35,
    currency: '₪'
  },
  { 
    id: 'grooming', 
    icon: Scissors, 
    labelEn: 'Grooming Service', 
    labelHe: 'שירות טיפוח',
    descEn: 'Bath, brush & basic grooming',
    descHe: 'רחצה, הברשה וטיפוח בסיסי',
    pricePerTrip: 85,
    currency: '₪'
  },
  { 
    id: 'medication', 
    icon: Pill, 
    labelEn: 'Medication Administration', 
    labelHe: 'מתן תרופות',
    descEn: 'Daily medication as prescribed',
    descHe: 'מתן תרופות יומי לפי מרשם',
    pricePerTrip: 25,
    currency: '₪'
  },
];

const SITTER_SERVICES = [
  { id: 'hosting', icon: Home, labelEn: 'Pet Boarding', labelHe: 'אירוח בבית המטפל', descEn: "Your pet stays at the sitter's home", descHe: 'חיית המחמד שלך תתארח אצל המטפל' },
  { id: 'sitting', icon: Home, labelEn: 'House Sitting', labelHe: 'שמירה בבית שלך', descEn: 'Sitter stays in your home', descHe: 'המטפל יגיע לביתך' },
  { id: 'daycare', icon: Clock, labelEn: 'Daycare', labelHe: 'גן יום', descEn: 'Drop off during the day', descHe: 'הורדה והחזרה במהלך היום' },
  { id: 'visits', icon: Heart, labelEn: 'Drop-in Visits', labelHe: 'ביקורי בית', descEn: '30-60min check-ins at your home', descHe: 'ביקורים קצרים בבית שלך' },
];

const WALKER_SERVICES = [
  { id: 'standard', icon: Footprints, labelEn: 'Standard Walk', labelHe: 'הליכה רגילה', descEn: '30-60 minute neighborhood walk', descHe: 'הליכה של 30-60 דקות בשכונה' },
  { id: 'adventure', icon: Car, labelEn: 'Adventure Walk', labelHe: 'הליכת הרפתקאות', descEn: 'Parks, trails, beach adventures', descHe: 'פארקים, שבילים, חוף הים' },
  { id: 'jogging', icon: Footprints, labelEn: 'Jogging/Running', labelHe: 'ריצה', descEn: 'Active running with your dog', descHe: 'ריצה עם הכלב שלך' },
  { id: 'group', icon: Dog, labelEn: 'Group Walk', labelHe: 'הליכה קבוצתית', descEn: 'Social walks with other dogs', descHe: 'הליכות חברתיות עם כלבים אחרים' },
];

const PETTREK_SERVICES = [
  { id: 'transport', icon: Car, labelEn: 'Pet Transport', labelHe: 'הסעת חיית מחמד', descEn: 'Safe transport to any destination', descHe: 'הסעה בטוחה ליעד כלשהו' },
  { id: 'vet', icon: Heart, labelEn: 'Vet Taxi', labelHe: 'הסעה לוטרינר', descEn: 'Transport to/from veterinarian', descHe: 'הסעה לוטרינר ובחזרה' },
  { id: 'groomer', icon: Sparkles, labelEn: 'Groomer Taxi', labelHe: 'הסעה לספר', descEn: 'Transport to/from groomer', descHe: 'הסעה לספר ובחזרה' },
  { id: 'airport', icon: Car, labelEn: 'Airport Service', labelHe: 'שירות נמל תעופה', descEn: 'Airport pickup/dropoff', descHe: 'איסוף והורדה בנמל התעופה' },
];

const ISRAELI_CITIES = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva',
  'Ashdod', 'Netanya', 'Beer Sheva', 'Herzliya', 'Ramat Gan',
  'Holon', 'Rehovot', 'Kfar Saba', 'Givatayim', 'Raanana'
];

export function BookingWizard({ platform, onComplete, onClose }: BookingWizardProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState<BookingFilters>({
    petType: '',
    petSize: '',
    petCount: 1,
    pets: { dogs: 0, puppies: 0, cats: 0, smallAnimals: 0 },
    addOns: ADD_ON_SERVICES.map(a => ({ id: a.id, selected: false, quantity: 1 })),
    specialNotes: '',
    serviceType: '',
    location: '',
    startDate: undefined,
    endDate: undefined,
  });

  const totalSteps = 8;
  const progress = (step / totalSteps) * 100;

  const getServices = () => {
    switch (platform) {
      case 'sitter': return SITTER_SERVICES;
      case 'walker': return WALKER_SERVICES;
      case 'pettrek': return PETTREK_SERVICES;
      default: return SITTER_SERVICES;
    }
  };

  const t = {
    step1: {
      title: isHebrew ? 'איזה שירות אתה צריך?' : 'What service do you need?',
      subtitle: isHebrew ? 'בחר את סוג השירות המתאים לך' : 'Choose the service type that fits you',
    },
    step2: {
      title: isHebrew ? 'כמה חיות מחמד?' : 'How many pets?',
      subtitle: isHebrew ? 'בחר את מספר החיות לכל סוג' : 'Select quantity for each pet type',
    },
    step3: {
      title: isHebrew ? 'מה גודל חיית המחמד?' : 'What size is your pet?',
      subtitle: isHebrew ? 'עזור לנו למצוא את ההתאמה המושלמת' : 'Help us find the perfect match',
    },
    step4: {
      title: isHebrew ? 'איפה אתה נמצא?' : 'Where are you located?',
      subtitle: isHebrew ? 'הזן את העיר או האזור שלך' : 'Enter your city or area',
      placeholder: isHebrew ? 'הזן עיר...' : 'Enter city...',
    },
    step5: {
      title: isHebrew ? 'מתי אתה צריך?' : 'When do you need it?',
      subtitle: isHebrew ? 'בחר את התאריכים שלך' : 'Select your dates',
      startDate: isHebrew ? 'תאריך התחלה' : 'Start Date',
      endDate: isHebrew ? 'תאריך סיום' : 'End Date',
      pickDate: isHebrew ? 'בחר תאריך' : 'Pick a date',
    },
    step6: {
      title: isHebrew ? 'שירותים נוספים' : 'Extra Services',
      subtitle: isHebrew ? 'הוסף שירותים יוקרתיים לחוויה מושלמת' : 'Add premium services for the perfect experience',
    },
    step7: {
      title: isHebrew ? 'הוראות מיוחדות' : 'Special Instructions',
      subtitle: isHebrew ? 'שתף הערות חשובות עם הקבלן שלנו' : 'Share important notes with our contractor',
      placeholder: isHebrew ? 'כאן תוכל לציין דרישות מיוחדות, אלרגיות, הרגלים, או כל מידע חשוב אחר...' : 'Add any special requirements, allergies, habits, or other important information...',
    },
    step8: {
      title: isHebrew ? 'סיכום הזמנה' : 'Booking Summary',
      subtitle: isHebrew ? 'סקור את ההזמנה שלך' : 'Review your booking details',
    },
    nav: {
      next: isHebrew ? 'הבא' : 'Next',
      back: isHebrew ? 'חזור' : 'Back',
      search: isHebrew ? 'מצא עכשיו' : 'Find Now',
      skip: isHebrew ? 'דלג' : 'Skip',
    },
    progress: isHebrew ? `שלב ${step} מתוך ${totalSteps}` : `Step ${step} of ${totalSteps}`,
  };

  const getTotalPets = () => filters.pets.dogs + filters.pets.puppies + filters.pets.cats + filters.pets.smallAnimals;
  
  const canProceed = () => {
    switch (step) {
      case 1: return !!filters.serviceType;
      case 2: return getTotalPets() > 0;
      case 3: return !!filters.petSize;
      case 4: return !!filters.location;
      case 5: return !!filters.startDate;
      case 6: return true;
      case 7: return true;
      case 8: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(filters);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const updatePetCount = (type: keyof PetSelection, delta: number) => {
    const newValue = Math.max(0, Math.min(5, filters.pets[type] + delta));
    const newPets = { ...filters.pets, [type]: newValue };
    const totalPets = newPets.dogs + newPets.puppies + newPets.cats + newPets.smallAnimals;
    
    const derivePetType = () => {
      if (newPets.dogs > 0 || newPets.puppies > 0) {
        if (newPets.cats > 0) return 'mixed';
        return newPets.puppies > 0 ? 'puppy' : 'dog';
      }
      if (newPets.cats > 0) return 'cat';
      if (newPets.smallAnimals > 0) return 'other';
      return '';
    };
    
    setFilters({ 
      ...filters, 
      pets: newPets,
      petType: derivePetType(),
      petCount: totalPets
    });
  };

  const toggleAddOn = (id: string) => {
    setFilters({
      ...filters,
      addOns: filters.addOns.map(a => 
        a.id === id ? { ...a, selected: !a.selected } : a
      )
    });
  };

  const calculateEstimate = () => {
    const days = filters.startDate && filters.endDate 
      ? Math.max(1, differenceInDays(filters.endDate, filters.startDate))
      : 1;
    const basePetRate = 120;
    const petCost = getTotalPets() * basePetRate * days;
    const addOnCost = filters.addOns
      .filter(a => a.selected)
      .reduce((sum, a) => {
        const service = ADD_ON_SERVICES.find(s => s.id === a.id);
        return sum + (service?.pricePerTrip || 0);
      }, 0);
    return { petCost, addOnCost, days, total: petCost + addOnCost };
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {getServices().map((service) => {
              const Icon = service.icon;
              const isSelected = filters.serviceType === service.id;
              return (
                <motion.button
                  key={service.id}
                  onClick={() => setFilters({ ...filters, serviceType: service.id })}
                  className={cn(
                    "relative flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-300",
                    isSelected
                      ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 shadow-lg shadow-amber-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`button-service-${service.id}`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    isSelected 
                      ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                      : "bg-gray-100 dark:bg-gray-700"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      isSelected ? "text-white" : "text-gray-600 dark:text-gray-300"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h4 className={cn(
                      "font-semibold mb-1",
                      isSelected ? "text-amber-700 dark:text-amber-400" : "text-gray-800 dark:text-gray-200"
                    )}>
                      {isHebrew ? service.labelHe : service.labelEn}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isHebrew ? service.descHe : service.descEn}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        );

      case 2:
        const petTypes = [
          { key: 'dogs' as const, icon: Dog, labelEn: 'Dogs', labelHe: 'כלבים' },
          { key: 'puppies' as const, icon: Dog, labelEn: 'Puppies', labelHe: 'גורים', small: true },
          { key: 'cats' as const, icon: Cat, labelEn: 'Cats', labelHe: 'חתולים' },
          { key: 'smallAnimals' as const, icon: Rabbit, labelEn: 'Small Animals', labelHe: 'חיות קטנות' },
        ];
        return (
          <div className="space-y-4">
            {petTypes.map(({ key, icon: Icon, labelEn, labelHe, small }) => (
              <motion.div
                key={key}
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                  filters.pets[key] > 0
                    ? "border-amber-500 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10"
                    : "border-gray-200 dark:border-gray-700"
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    filters.pets[key] > 0
                      ? "bg-gradient-to-br from-amber-500 to-orange-600"
                      : "bg-gray-100 dark:bg-gray-700"
                  )}>
                    <Icon className={cn(
                      filters.pets[key] > 0 ? "text-white" : "text-gray-500",
                      small ? "w-5 h-5" : "w-6 h-6"
                    )} />
                  </div>
                  <span className={cn(
                    "font-semibold text-lg",
                    filters.pets[key] > 0 ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {isHebrew ? labelHe : labelEn}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updatePetCount(key, -1)}
                    disabled={filters.pets[key] === 0}
                    className="h-10 w-10 rounded-full border-2"
                    data-testid={`button-decrease-${key}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-xl text-gray-900 dark:text-white">
                    {filters.pets[key]}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updatePetCount(key, 1)}
                    disabled={filters.pets[key] >= 5}
                    className="h-10 w-10 rounded-full border-2 border-amber-300 hover:bg-amber-50"
                    data-testid={`button-increase-${key}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
            {getTotalPets() > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700">
                <div className="flex items-center gap-2">
                  <Gem className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    {isHebrew ? `סה"כ: ${getTotalPets()} חיות מחמד` : `Total: ${getTotalPets()} pets`}
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="grid grid-cols-2 gap-4">
            {PET_SIZES.map((size) => {
              const isSelected = filters.petSize === size.id;
              return (
                <motion.button
                  key={size.id}
                  onClick={() => setFilters({ ...filters, petSize: size.id })}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300",
                    isSelected
                      ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 shadow-lg shadow-amber-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  data-testid={`button-pet-size-${size.id}`}
                >
                  {isSelected && (
                    <Crown className="absolute top-3 right-3 w-5 h-5 text-amber-500" />
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mb-3",
                    isSelected ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gray-100 dark:bg-gray-700"
                  )}>
                    <Dog className={cn(
                      isSelected ? "text-white" : "text-gray-600 dark:text-gray-300",
                      size.id === 'small' && "w-5 h-5",
                      size.id === 'medium' && "w-6 h-6",
                      size.id === 'large' && "w-7 h-7",
                      size.id === 'giant' && "w-8 h-8"
                    )} />
                  </div>
                  <span className={cn(
                    "font-semibold",
                    isSelected ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {isHebrew ? size.labelHe : size.labelEn}
                  </span>
                </motion.button>
              );
            })}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
              <Input
                type="text"
                placeholder={t.step4.placeholder}
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="pl-12 h-14 text-lg rounded-xl border-2 focus:border-amber-500"
                list="cities"
                data-testid="input-location"
              />
              <datalist id="cities">
                {ISRAELI_CITIES.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-wrap gap-2">
              {ISRAELI_CITIES.slice(0, 8).map((city) => (
                <motion.button
                  key={city}
                  onClick={() => setFilters({ ...filters, location: city })}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    filters.location === city
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid={`button-city-${city.toLowerCase().replace(' ', '-')}`}
                >
                  {city}
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.step5.startDate}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-14 justify-start text-left font-normal rounded-xl border-2",
                      filters.startDate ? "border-amber-500" : "text-gray-400"
                    )}
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5 text-amber-500" />
                    {filters.startDate ? format(filters.startDate, 'PPP') : t.step5.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => setFilters({ ...filters, startDate: date })}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.step5.endDate}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-14 justify-start text-left font-normal rounded-xl border-2",
                      filters.endDate ? "border-amber-500" : "text-gray-400"
                    )}
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5 text-amber-500" />
                    {filters.endDate ? format(filters.endDate, 'PPP') : t.step5.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => setFilters({ ...filters, endDate: date })}
                    disabled={(date) => date < (filters.startDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {filters.startDate && filters.endDate && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    {isHebrew 
                      ? `${differenceInDays(filters.endDate, filters.startDate)} לילות` 
                      : `${differenceInDays(filters.endDate, filters.startDate)} nights`}
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            {ADD_ON_SERVICES.map((service) => {
              const Icon = service.icon;
              const addOn = filters.addOns.find(a => a.id === service.id);
              const isSelected = addOn?.selected || false;
              return (
                <motion.div
                  key={service.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                    isSelected
                      ? "border-amber-500 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-900/30 dark:to-orange-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                  )}
                  onClick={() => toggleAddOn(service.id)}
                  whileHover={{ scale: 1.01 }}
                  data-testid={`addon-${service.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      isSelected
                        ? "bg-gradient-to-br from-amber-500 to-orange-600"
                        : "bg-gray-100 dark:bg-gray-700"
                    )}>
                      <Icon className={cn("w-6 h-6", isSelected ? "text-white" : "text-gray-500")} />
                    </div>
                    <div>
                      <h4 className={cn(
                        "font-semibold",
                        isSelected ? "text-amber-700 dark:text-amber-400" : "text-gray-800 dark:text-gray-200"
                      )}>
                        {isHebrew ? service.labelHe : service.labelEn}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {isHebrew ? service.descHe : service.descEn}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "font-bold text-lg",
                      isSelected ? "text-amber-600" : "text-gray-500"
                    )}>
                      {service.currency}{service.pricePerTrip}
                    </span>
                    <Checkbox 
                      checked={isSelected} 
                      className="h-6 w-6 border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                  </div>
                </motion.div>
              );
            })}
            <p className="text-center text-sm text-gray-500 mt-4">
              {isHebrew ? 'אופציונלי - ניתן לדלג' : 'Optional - you can skip this step'}
            </p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="relative">
              <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-amber-500" />
              <Textarea
                placeholder={t.step7.placeholder}
                value={filters.specialNotes}
                onChange={(e) => setFilters({ ...filters, specialNotes: e.target.value })}
                className="pl-12 min-h-[150px] text-lg rounded-xl border-2 focus:border-amber-500 resize-none"
                data-testid="textarea-special-notes"
              />
            </div>
            <p className="text-center text-sm text-gray-500">
              {isHebrew ? 'אופציונלי - ניתן לדלג' : 'Optional - you can skip this step'}
            </p>
          </div>
        );

      case 8:
        const estimate = calculateEstimate();
        return (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-amber-800/30 border-2 border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-6 h-6 text-amber-600" />
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  {isHebrew ? 'סיכום הזמנה' : 'Booking Summary'}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{isHebrew ? 'שירות' : 'Service'}:</span>
                  <span className="font-semibold">{getServices().find(s => s.id === filters.serviceType)?.labelEn || '-'}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{isHebrew ? 'חיות מחמד' : 'Pets'}:</span>
                  <span className="font-semibold">
                    {filters.pets.dogs > 0 && `${filters.pets.dogs} ${isHebrew ? 'כלבים' : 'dogs'}`}
                    {filters.pets.cats > 0 && ` + ${filters.pets.cats} ${isHebrew ? 'חתולים' : 'cats'}`}
                    {filters.pets.puppies > 0 && ` + ${filters.pets.puppies} ${isHebrew ? 'גורים' : 'puppies'}`}
                    {filters.pets.smallAnimals > 0 && ` + ${filters.pets.smallAnimals} ${isHebrew ? 'קטנות' : 'small'}`}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{isHebrew ? 'מיקום' : 'Location'}:</span>
                  <span className="font-semibold">{filters.location || '-'}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{isHebrew ? 'תאריכים' : 'Dates'}:</span>
                  <span className="font-semibold">
                    {filters.startDate && format(filters.startDate, 'dd/MM')} - {filters.endDate && format(filters.endDate, 'dd/MM')}
                    {estimate.days > 0 && ` (${estimate.days} ${isHebrew ? 'לילות' : 'nights'})`}
                  </span>
                </div>
                {filters.addOns.filter(a => a.selected).length > 0 && (
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>{isHebrew ? 'תוספות' : 'Add-ons'}:</span>
                    <span className="font-semibold">
                      {filters.addOns.filter(a => a.selected).map(a => 
                        ADD_ON_SERVICES.find(s => s.id === a.id)?.labelEn
                      ).join(', ')}
                    </span>
                  </div>
                )}
                {filters.specialNotes && (
                  <div className="pt-3 border-t border-amber-200 dark:border-amber-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{isHebrew ? 'הערות' : 'Notes'}:</span>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{filters.specialNotes}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <div className="flex justify-between items-center">
                <span className="text-lg">{isHebrew ? 'הערכת מחיר' : 'Estimated Total'}</span>
                <span className="text-2xl font-bold">₪{estimate.total}</span>
              </div>
              <p className="text-amber-100 text-sm mt-1">
                {isHebrew ? 'המחיר הסופי ייקבע לאחר בחירת קבלן' : 'Final price after contractor selection'}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepInfo = () => {
    switch (step) {
      case 1: return t.step1;
      case 2: return t.step2;
      case 3: return t.step3;
      case 4: return t.step4;
      case 5: return t.step5;
      case 6: return t.step6;
      case 7: return t.step7;
      case 8: return t.step8;
      default: return t.step1;
    }
  };

  const stepInfo = getStepInfo();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-amber-200/50 dark:border-amber-800/30">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_3s_infinite]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-white" />
                <span className="text-white/90 text-sm font-medium">{t.progress}</span>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white transition-colors w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  data-testid="button-close-wizard"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div 
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            <div className="flex justify-between mt-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    i + 1 < step
                      ? "bg-white text-amber-600 shadow-lg"
                      : i + 1 === step
                      ? "bg-white/30 text-white border-2 border-white shadow-lg"
                      : "bg-white/10 text-white/50"
                  )}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {stepInfo.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {stepInfo.subtitle}
            </p>
          </div>

          <div className="min-h-[280px] flex items-center justify-center">
            {renderStepContent()}
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="h-12 px-6 rounded-xl border-2 hover:border-amber-300"
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              {t.nav.back}
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "h-12 px-8 rounded-xl font-semibold transition-all",
                step === totalSteps
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              )}
              data-testid="button-wizard-next"
            >
              {step === totalSteps ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t.nav.search}
                </>
              ) : (
                <>
                  {t.nav.next}
                  <ChevronRight className="w-5 h-5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookingWizardTrigger({ 
  platform,
  onComplete 
}: { 
  platform: PlatformType;
  onComplete: (filters: BookingFilters) => void;
}) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [isOpen, setIsOpen] = useState(false);

  const handleComplete = (filters: BookingFilters) => {
    setIsOpen(false);
    onComplete(filters);
  };

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <BookingWizard
          platform={platform}
          onComplete={handleComplete}
          onClose={() => setIsOpen(false)}
        />
      </div>
    );
  }

  return (
    <Button
      onClick={() => setIsOpen(true)}
      className="h-14 px-8 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/30 transition-all"
      data-testid="button-start-booking-wizard"
    >
      <Crown className="w-5 h-5 mr-2" />
      {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
    </Button>
  );
}
