import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, MapPin, CalendarDays, Dog, Cat, Bird, ChevronDown,
  Home, Heart, Car, GraduationCap, Droplets, Users, Footprints,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { useLanguage } from "@/lib/languageStore";

type ServiceType = 
  | 'boarding' 
  | 'house-sitting' 
  | 'daycare' 
  | 'dog-walking' 
  | 'pet-taxi' 
  | 'training'
  | 'grooming'
  | 'k9000-wash';

type PetType = 'dog' | 'cat' | 'bird' | 'other';

interface ServiceOption {
  id: ServiceType;
  name: string;
  nameHe: string;
  icon: typeof Home;
  route: string;
}

const SERVICES: ServiceOption[] = [
  { id: 'boarding', name: 'Pet Boarding', nameHe: 'פנסיון', icon: Home, route: '/sitter-suite' },
  { id: 'house-sitting', name: 'House Sitting', nameHe: 'שמרטפות בבית', icon: Heart, route: '/sitter-suite' },
  { id: 'daycare', name: 'Doggy Daycare', nameHe: 'מעון יום', icon: Users, route: '/sitter-suite' },
  { id: 'dog-walking', name: 'Dog Walking', nameHe: 'טיולי כלבים', icon: Footprints, route: '/walk-my-pet' },
  { id: 'pet-taxi', name: 'Pet Taxi', nameHe: 'הסעות', icon: Car, route: '/pettrek' },
  { id: 'training', name: 'Dog Training', nameHe: 'אילוף', icon: GraduationCap, route: '/academy' },
  { id: 'grooming', name: 'Grooming', nameHe: 'טיפוח', icon: Sparkles, route: '/grooming' },
  { id: 'k9000-wash', name: 'K9000 Smart Hub', nameHe: 'K9000 עמדה חכמה', icon: Droplets, route: '/k9000' },
];

const PET_TYPES = [
  { id: 'dog' as PetType, name: 'Dog', nameHe: 'כלב', icon: Dog, emoji: '🐕' },
  { id: 'cat' as PetType, name: 'Cat', nameHe: 'חתול', icon: Cat, emoji: '🐈' },
  { id: 'bird' as PetType, name: 'Bird', nameHe: 'ציפור', icon: Bird, emoji: '🦜' },
  { id: 'other' as PetType, name: 'Other', nameHe: 'אחר', icon: Dog, emoji: '🐾' },
];

const CITIES = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Herzliya', 'Ramat Gan', 'Netanya',
  'Beer Sheva', 'Ashdod', 'Rishon LeZion', 'Petah Tikva', 'Eilat', 'Kfar Saba',
];

interface LuxuryHeroSearchProps {
  variant?: 'hero' | 'compact' | 'floating';
  showTitle?: boolean;
  className?: string;
}

export function LuxuryHeroSearch({ 
  variant = 'hero', 
  showTitle = true,
  className = '' 
}: LuxuryHeroSearchProps) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  const filteredCities = CITIES.filter(city => 
    city.toLowerCase().includes(locationInput.toLowerCase())
  );

  const handleSearch = () => {
    const service = SERVICES.find(s => s.id === selectedService);
    if (!service) {
      navigate('/services');
      return;
    }

    const params = new URLSearchParams();
    if (selectedPet) params.set('pet', selectedPet);
    if (locationInput) params.set('location', locationInput);
    if (startDate) params.set('start', format(startDate, 'yyyy-MM-dd'));
    if (endDate) params.set('end', format(endDate, 'yyyy-MM-dd'));
    
    navigate(`${service.route}?${params.toString()}`);
  };

  const selectedServiceData = SERVICES.find(s => s.id === selectedService);

  if (variant === 'compact') {
    return (
      <div className={`bg-white/80 backdrop-blur-xl border border-black/10 rounded-2xl p-4 shadow-2xl ${className}`}>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
            <Input
              placeholder={isHebrew ? 'איזה שירות אתה צריך?' : 'What service do you need?'}
              className="pl-10 border-black/10 focus:ring-black/20 bg-white/50"
              data-testid="search-input-compact"
            />
          </div>
          <Button 
            onClick={handleSearch}
            className="bg-black text-white hover:bg-black/90 px-8"
            data-testid="search-button-compact"
          >
            <Search className="h-4 w-4 mr-2" />
            {isHebrew ? 'חפש' : 'Search'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`relative ${className}`}
    >
      <div className="relative z-10 max-w-4xl mx-auto">
        
        {showTitle && (
          <div className="text-center mb-12">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[11px] font-normal tracking-[4px] text-black/50 uppercase mb-4"
              style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
            >
              {isHebrew ? 'מצא את הטיפול המושלם' : 'Find Perfect Care'}
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-light text-black tracking-wide"
              style={{ fontFamily: "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif" }}
            >
              {isHebrew ? 'חפש שירות' : 'Search Services'}
            </motion.h2>
          </div>
        )}

        <div 
          className="bg-white/70 backdrop-blur-2xl border border-black/10 rounded-3xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)]"
          style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
          }}
        >
          
          <div className="mb-8">
            <p className="text-xs text-black/40 uppercase tracking-[2px] mb-4 font-light">
              {isHebrew ? 'סוג חיית מחמד' : 'Pet Type'}
            </p>
            <div className="flex flex-wrap gap-3">
              {PET_TYPES.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(selectedPet === pet.id ? null : pet.id)}
                  data-testid={`pet-pill-${pet.id}`}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 ${
                    selectedPet === pet.id
                      ? 'bg-black text-white border-black'
                      : 'bg-white/80 text-black border-black/10 hover:border-black/30'
                  }`}
                >
                  <span>{pet.emoji}</span>
                  <span className="text-sm font-light tracking-wide">
                    {isHebrew ? pet.nameHe : pet.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            
            <div className="relative md:col-span-2">
              <p className="text-xs text-black/40 uppercase tracking-[2px] mb-2 font-light">
                {isHebrew ? 'סוג שירות' : 'Service Type'}
              </p>
              <button
                onClick={() => setShowServiceMenu(!showServiceMenu)}
                data-testid="service-dropdown"
                className="w-full flex items-center justify-between px-4 py-3 bg-white/80 border border-black/10 rounded-xl hover:border-black/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {selectedServiceData ? (
                    <>
                      <selectedServiceData.icon className="h-5 w-5 text-black/60" />
                      <span className="text-black font-light">
                        {isHebrew ? selectedServiceData.nameHe : selectedServiceData.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-black/40 font-light">
                      {isHebrew ? 'בחר שירות' : 'Select service'}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-black/40 transition-transform ${showServiceMenu ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showServiceMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 top-full mt-2 left-0 right-0 bg-white border border-black/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    {SERVICES.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => {
                          setSelectedService(service.id);
                          setShowServiceMenu(false);
                        }}
                        data-testid={`service-option-${service.id}`}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors text-left"
                      >
                        <service.icon className="h-5 w-5 text-black/60" />
                        <span className="font-light text-black">
                          {isHebrew ? service.nameHe : service.name}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative md:col-span-2">
              <p className="text-xs text-black/40 uppercase tracking-[2px] mb-2 font-light">
                {isHebrew ? 'מיקום' : 'Location'}
              </p>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-black/40" />
                <Input
                  value={locationInput}
                  onChange={(e) => {
                    setLocationInput(e.target.value);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                  placeholder={isHebrew ? 'הזן עיר או אזור' : 'Enter city or area'}
                  className="pl-12 py-3 h-auto bg-white/80 border-black/10 focus:ring-black/20 rounded-xl font-light"
                  data-testid="location-input"
                />
                
                <AnimatePresence>
                  {showLocationSuggestions && filteredCities.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 top-full mt-2 left-0 right-0 bg-white border border-black/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                    >
                      {filteredCities.map((city) => (
                        <button
                          key={city}
                          onClick={() => {
                            setLocationInput(city);
                            setShowLocationSuggestions(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors text-left"
                        >
                          <MapPin className="h-4 w-4 text-black/40" />
                          <span className="font-light text-black">{city}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <p className="text-xs text-black/40 uppercase tracking-[2px] mb-2 font-light">
                {isHebrew ? 'תאריך התחלה' : 'Start Date'}
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-testid="start-date-picker"
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/80 border border-black/10 rounded-xl hover:border-black/30 transition-colors text-left"
                  >
                    <CalendarDays className="h-5 w-5 text-black/40" />
                    <span className={`font-light ${startDate ? 'text-black' : 'text-black/40'}`}>
                      {startDate ? format(startDate, 'MMM d, yyyy') : (isHebrew ? 'בחר תאריך' : 'Select date')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-black/10" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && (!endDate || date > endDate)) {
                        setEndDate(addDays(date, 1));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <p className="text-xs text-black/40 uppercase tracking-[2px] mb-2 font-light">
                {isHebrew ? 'תאריך סיום' : 'End Date'}
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-testid="end-date-picker"
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/80 border border-black/10 rounded-xl hover:border-black/30 transition-colors text-left"
                  >
                    <CalendarDays className="h-5 w-5 text-black/40" />
                    <span className={`font-light ${endDate ? 'text-black' : 'text-black/40'}`}>
                      {endDate ? format(endDate, 'MMM d, yyyy') : (isHebrew ? 'בחר תאריך' : 'Select date')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-black/10" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < (startDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Button
              onClick={handleSearch}
              data-testid="search-button-hero"
              className="w-full bg-black text-white hover:bg-black/90 py-6 text-lg font-light tracking-wide rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_30px_rgba(0,0,0,0.2)] transition-all"
              style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
            >
              <Search className="h-5 w-5 mr-3" />
              {isHebrew ? 'חפש עכשיו' : 'Search Now'}
            </Button>
          </motion.div>

          <p className="text-center text-xs text-black/30 mt-6 font-light">
            {isHebrew 
              ? 'אלפי נותני שירות מאומתים ברחבי ישראל'
              : 'Thousands of verified providers across Israel'
            }
          </p>
        </div>

        <div className="absolute -z-10 inset-0 blur-3xl opacity-30">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-to-br from-black/5 to-transparent rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-gradient-to-tl from-black/5 to-transparent rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}
