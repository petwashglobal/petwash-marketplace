import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { 
  Dog, Cat, Rabbit, ChevronRight, ChevronLeft, MapPin, Calendar as CalendarIcon,
  Sparkles, CheckCircle2, Home, Clock, Footprints, Car, Heart, Star
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { cn } from '@/lib/utils';

export type PlatformType = 'sitter' | 'walker' | 'pettrek';

export interface BookingFilters {
  petType: string;
  petSize: string;
  petCount: number;
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
    serviceType: '',
    location: '',
    startDate: undefined,
    endDate: undefined,
  });

  const totalSteps = 6;
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
      title: isHebrew ? 'איזה סוג חיית מחמד?' : 'What type of pet?',
      subtitle: isHebrew ? 'בחר את סוג חיית המחמד שלך' : 'Select your pet type',
    },
    step2: {
      title: isHebrew ? 'מה גודל חיית המחמד?' : 'What size is your pet?',
      subtitle: isHebrew ? 'עזור לנו למצוא את ההתאמה המושלמת' : 'Help us find the perfect match',
    },
    step3: {
      title: isHebrew ? 'כמה חיות מחמד?' : 'How many pets?',
      subtitle: isHebrew ? 'ספר לנו כמה חיות מחמד יש לך' : 'Tell us how many pets you have',
    },
    step4: {
      title: isHebrew ? 'איזה שירות אתה צריך?' : 'What service do you need?',
      subtitle: isHebrew ? 'בחר את סוג השירות המתאים לך' : 'Choose the service type that fits you',
    },
    step5: {
      title: isHebrew ? 'איפה אתה נמצא?' : 'Where are you located?',
      subtitle: isHebrew ? 'הזן את העיר או האזור שלך' : 'Enter your city or area',
      placeholder: isHebrew ? 'הזן עיר...' : 'Enter city...',
    },
    step6: {
      title: isHebrew ? 'מתי אתה צריך?' : 'When do you need it?',
      subtitle: isHebrew ? 'בחר את התאריכים שלך' : 'Select your dates',
      startDate: isHebrew ? 'תאריך התחלה' : 'Start Date',
      endDate: isHebrew ? 'תאריך סיום' : 'End Date',
      pickDate: isHebrew ? 'בחר תאריך' : 'Pick a date',
    },
    nav: {
      next: isHebrew ? 'הבא' : 'Next',
      back: isHebrew ? 'חזור' : 'Back',
      search: isHebrew ? 'חפש עכשיו' : 'Find Now',
      skip: isHebrew ? 'דלג' : 'Skip',
    },
    progress: isHebrew ? `שלב ${step} מתוך ${totalSteps}` : `Step ${step} of ${totalSteps}`,
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!filters.petType;
      case 2: return !!filters.petSize;
      case 3: return filters.petCount > 0;
      case 4: return !!filters.serviceType;
      case 5: return !!filters.location;
      case 6: return !!filters.startDate;
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

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="grid grid-cols-2 gap-4">
            {PET_TYPES.map((pet) => {
              const Icon = pet.icon;
              const isSelected = filters.petType === pet.id;
              const isPuppy = pet.id === 'puppy';
              return (
                <button
                  key={pet.id}
                  onClick={() => setFilters({ ...filters, petType: pet.id })}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg scale-105"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  data-testid={`button-pet-type-${pet.id}`}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-emerald-500" />
                  )}
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-3",
                    isSelected ? "bg-emerald-500" : "bg-gray-100 dark:bg-gray-700"
                  )}>
                    <Icon className={cn(
                      "w-8 h-8",
                      isSelected ? "text-white" : "text-gray-600 dark:text-gray-300",
                      isPuppy && "scale-75"
                    )} />
                  </div>
                  <span className={cn(
                    "font-semibold text-lg",
                    isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {isHebrew ? pet.labelHe : pet.labelEn}
                  </span>
                  {isPuppy && (
                    <span className="text-xs text-gray-500 mt-1">{isHebrew ? 'עד 12 חודשים' : 'Up to 12 months'}</span>
                  )}
                </button>
              );
            })}
          </div>
        );

      case 2:
        return (
          <div className="grid grid-cols-2 gap-4">
            {PET_SIZES.map((size) => {
              const isSelected = filters.petSize === size.id;
              return (
                <button
                  key={size.id}
                  onClick={() => setFilters({ ...filters, petSize: size.id })}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg scale-105"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  data-testid={`button-pet-size-${size.id}`}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-emerald-500" />
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mb-3",
                    isSelected ? "bg-emerald-500" : "bg-gray-100 dark:bg-gray-700"
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
                    isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {isHebrew ? size.labelHe : size.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        );

      case 3:
        return (
          <div className="flex justify-center gap-4">
            {PET_COUNTS.map((count) => {
              const isSelected = filters.petCount === count;
              return (
                <button
                  key={count}
                  onClick={() => setFilters({ ...filters, petCount: count })}
                  className={cn(
                    "w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg scale-105"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  data-testid={`button-pet-count-${count}`}
                >
                  <span className={cn(
                    "text-3xl font-bold",
                    isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {count === 3 ? '3+' : count}
                  </span>
                  <span className="text-sm text-gray-500 mt-1">
                    {count === 1 ? (isHebrew ? 'חיה' : 'pet') : (isHebrew ? 'חיות' : 'pets')}
                  </span>
                </button>
              );
            })}
          </div>
        );

      case 4:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {getServices().map((service) => {
              const Icon = service.icon;
              const isSelected = filters.serviceType === service.id;
              return (
                <button
                  key={service.id}
                  onClick={() => setFilters({ ...filters, serviceType: service.id })}
                  className={cn(
                    "relative flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-300",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  data-testid={`button-service-${service.id}`}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-emerald-500" />
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    isSelected ? "bg-emerald-500" : "bg-gray-100 dark:bg-gray-700"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      isSelected ? "text-white" : "text-gray-600 dark:text-gray-300"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h4 className={cn(
                      "font-semibold mb-1",
                      isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-gray-800 dark:text-gray-200"
                    )}>
                      {isHebrew ? service.labelHe : service.labelEn}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isHebrew ? service.descHe : service.descEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t.step5.placeholder}
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="pl-12 h-14 text-lg rounded-xl"
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
                <button
                  key={city}
                  onClick={() => setFilters({ ...filters, location: city })}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    filters.location === city
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  )}
                  data-testid={`button-city-${city.toLowerCase().replace(' ', '-')}`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.step6.startDate}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-14 justify-start text-left font-normal rounded-xl",
                      !filters.startDate && "text-gray-400"
                    )}
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {filters.startDate ? format(filters.startDate, 'PPP') : t.step6.pickDate}
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
                {t.step6.endDate} ({t.nav.skip.toLowerCase()})
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-14 justify-start text-left font-normal rounded-xl",
                      !filters.endDate && "text-gray-400"
                    )}
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {filters.endDate ? format(filters.endDate, 'PPP') : t.step6.pickDate}
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
      default: return t.step1;
    }
  };

  const stepInfo = getStepInfo();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/80 text-sm font-medium">{t.progress}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
                data-testid="button-close-wizard"
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  i + 1 < step
                    ? "bg-white text-emerald-600"
                    : i + 1 === step
                    ? "bg-white/30 text-white border-2 border-white"
                    : "bg-white/10 text-white/50"
                )}
              >
                {i + 1 < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
            ))}
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
              className="h-12 px-6 rounded-xl"
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              {t.nav.back}
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "h-12 px-8 rounded-xl font-semibold",
                step === totalSteps
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  : ""
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
      className="h-14 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg"
      data-testid="button-start-booking-wizard"
    >
      <Star className="w-5 h-5 mr-2" />
      {isHebrew ? 'התחל חיפוש' : 'Start Search'}
    </Button>
  );
}
