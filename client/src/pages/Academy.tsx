import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/LuxuryWidgets';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import ProviderRegistrationBanner from '@/components/ProviderRegistrationBanner';
import { 
  Star, MapPin, Heart, Search, Filter, Shield, CheckCircle2, 
  Award, TrendingUp, Users, Clock, ThumbsUp, Sparkles,
  Calendar, DollarSign, MessageCircle, Zap, Crown, GraduationCap,
  Target, Briefcase, BookOpen
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';

interface TrainerProfile {
  id: number;
  trainerId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  bio: string;
  specialties: string[] | null;
  certifications: string[] | null;
  experienceYears: number;
  hourlyRate: string;
  serviceTypes: string[] | null;
  availableDays: string[] | null;
  languages: string[] | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  averageRating: string;
  totalSessions: number;
  isActive: boolean;
  isAcceptingBookings: boolean;
  isCertified: boolean;
  verificationStatus: string;
  commissionRate: string;
  responseTime?: string;
  verified?: boolean;
}

const SPECIALTY_OPTIONS = [
  'Obedience Training',
  'Puppy Training',
  'Agility Training',
  'Behavioral Modification',
  'Leash Training',
  'Socialization',
  'Protection Training',
  'Therapy Dog Training',
];

// Mock trainer data (fallback if API returns no data)
const MOCK_TRAINERS: TrainerProfile[] = [
  {
    id: 1,
    trainerId: 'TR-2025-MOCK1',
    userId: 'mock-user-1',
    fullName: 'אריאל כהן',
    email: 'ariel@example.com',
    phone: '+972501234567',
    city: 'Tel Aviv',
    bio: 'Certified dog trainer with 15 years of experience specializing in obedience and behavioral modification. Former K9 unit trainer with Israeli Police. I use positive reinforcement methods and create customized training plans for each dog.',
    specialties: ['Obedience Training', 'Behavioral Modification', 'Protection Training'],
    certifications: ['CPDT-KA', 'CAP2', 'Pet First Aid'],
    experienceYears: 15,
    hourlyRate: '250.00',
    serviceTypes: ['Private Sessions', 'Group Classes', 'Behavior Consultation'],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    languages: ['Hebrew', 'English'],
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    averageRating: '4.98',
    totalSessions: 486,
    isActive: true,
    isAcceptingBookings: true,
    isCertified: true,
    verificationStatus: 'approved',
    commissionRate: '15.00',
    responseTime: '< 30min',
    verified: true,
  },
  {
    id: 2,
    trainerId: 'TR-2025-MOCK2',
    userId: 'mock-user-2',
    fullName: 'נועה לוי',
    email: 'noa@example.com',
    phone: '+972521234568',
    city: 'Jerusalem',
    bio: 'Puppy specialist and certified dog behavior consultant. I help new puppy owners establish good habits from day one and solve common puppy challenges like house training, chewing, and socialization.',
    specialties: ['Puppy Training', 'Socialization', 'Obedience Training'],
    certifications: ['IAABC-ADT', 'Fear Free Certified'],
    experienceYears: 10,
    hourlyRate: '220.00',
    serviceTypes: ['Private Sessions', 'Puppy Classes'],
    availableDays: ['Sunday', 'Tuesday', 'Thursday', 'Friday'],
    languages: ['Hebrew', 'English', 'Russian'],
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    averageRating: '4.95',
    totalSessions: 342,
    isActive: true,
    isAcceptingBookings: true,
    isCertified: true,
    verificationStatus: 'approved',
    commissionRate: '15.00',
    responseTime: '< 1hr',
    verified: true,
  },
  {
    id: 3,
    trainerId: 'TR-2025-MOCK3',
    userId: 'mock-user-3',
    fullName: 'יוסי מזרחי',
    email: 'yossi@example.com',
    phone: '+972541234569',
    city: 'Haifa',
    bio: 'Professional agility trainer and competition judge. Train with me to improve your dog\'s speed, accuracy, and confidence. Perfect for active dogs who need mental and physical stimulation!',
    specialties: ['Agility Training', 'Obedience Training'],
    certifications: ['AKC CGC Evaluator', 'NADAC Judge'],
    experienceYears: 12,
    hourlyRate: '200.00',
    serviceTypes: ['Private Sessions', 'Competition Prep'],
    availableDays: ['Sunday', 'Monday', 'Wednesday', 'Saturday'],
    languages: ['Hebrew', 'English'],
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    averageRating: '4.92',
    totalSessions: 289,
    isActive: true,
    isAcceptingBookings: true,
    isCertified: true,
    verificationStatus: 'approved',
    commissionRate: '15.00',
    responseTime: '< 2hrs',
    verified: true,
  },
  {
    id: 4,
    trainerId: 'TR-2025-MOCK4',
    userId: 'mock-user-4',
    fullName: 'שירה גולדשטיין',
    email: 'shira@example.com',
    phone: '+972551234570',
    city: 'Netanya',
    bio: 'Certified therapy dog trainer helping dogs pass therapy animal evaluations. I also specialize in service dog training and emotional support animal preparation.',
    specialties: ['Therapy Dog Training', 'Behavioral Modification', 'Socialization'],
    certifications: ['Pet Partners Therapy Animal Handler', 'CPDT-KA'],
    experienceYears: 8,
    hourlyRate: '240.00',
    serviceTypes: ['Private Sessions', 'Therapy Dog Prep'],
    availableDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    languages: ['Hebrew', 'English'],
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    averageRating: '4.97',
    totalSessions: 215,
    isActive: true,
    isAcceptingBookings: true,
    isCertified: true,
    verificationStatus: 'approved',
    commissionRate: '15.00',
    responseTime: '< 45min',
    verified: true,
  },
  {
    id: 5,
    trainerId: 'TR-2025-MOCK5',
    userId: 'mock-user-5',
    fullName: 'דניאל ברקוביץ',
    email: 'daniel@example.com',
    phone: '+972561234571',
    city: 'Tel Aviv',
    bio: 'Leash reactivity specialist and fear-free certified trainer. I help dogs overcome anxiety, leash aggression, and fear-based behaviors using gentle, science-based methods.',
    specialties: ['Behavioral Modification', 'Leash Training', 'Socialization'],
    certifications: ['Fear Free Certified', 'CCPDT'],
    experienceYears: 7,
    hourlyRate: '230.00',
    serviceTypes: ['Private Sessions', 'Behavior Consultation'],
    availableDays: ['Sunday', 'Monday', 'Tuesday', 'Thursday'],
    languages: ['Hebrew', 'English', 'French'],
    profilePhotoUrl: null,
    coverPhotoUrl: null,
    averageRating: '4.94',
    totalSessions: 198,
    isActive: true,
    isAcceptingBookings: true,
    isCertified: true,
    verificationStatus: 'approved',
    commissionRate: '15.00',
    responseTime: '< 1hr',
    verified: true,
  },
];

export default function Academy() {
  const { t } = useLanguage();
  const { user } = useFirebaseAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch trainers from API with fallback to mock data
  const { data: trainersData, isLoading } = useQuery<TrainerProfile[]>({
    queryKey: ['/api/academy/trainers'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/academy/trainers');
        if (!response.ok) {
          return MOCK_TRAINERS;
        }
        const data = await response.json();
        return data.length > 0 ? data : MOCK_TRAINERS;
      } catch {
        return MOCK_TRAINERS;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Use mock data if API returns empty or fails
  const trainers = trainersData && trainersData.length > 0 ? trainersData : MOCK_TRAINERS;

  // Filter trainers based on search and filters
  const filteredTrainers = trainers.filter((trainer) => {
    // Search filter
    if (searchQuery && !trainer.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // City filter
    if (selectedCity && trainer.city !== selectedCity) {
      return false;
    }

    // Specialty filter
    if (selectedSpecialties.length > 0) {
      const hasMatchingSpecialty = selectedSpecialties.some(
        (specialty) => trainer.specialties?.includes(specialty)
      );
      if (!hasMatchingSpecialty) return false;
    }

    // Price filter
    const rate = parseFloat(trainer.hourlyRate);
    if (rate < priceRange[0] || rate > priceRange[1]) {
      return false;
    }

    // Rating filter
    const rating = parseFloat(trainer.averageRating);
    if (rating < minRating) {
      return false;
    }

    return true;
  });

  // Get unique cities from trainers
  const cities = Array.from(new Set(trainers.map((t) => t.city))).sort();

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden luxury-animate-fade-in">
          
          <div className="luxury-container relative z-10">
            <div className="text-center max-w-4xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 luxury-badge luxury-shadow-lg mb-6 luxury-animate-slide-up luxury-delay-1">
                <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold">
                  {t('Pet Wash Academy™')}
                </span>
              </div>
              
              <h1 className="luxury-heading-xl mb-6 luxury-animate-slide-up luxury-delay-2">
                {t('Professional Pet Trainers')}
              </h1>
              
              <p className="luxury-text-body mb-8 max-w-3xl mx-auto luxury-animate-slide-up luxury-delay-3">
                {t('Book certified trainers for obedience, agility, behavioral training, and more. All trainers verified and background-checked.')}
              </p>

              {/* Search Bar */}
              <div className="relative max-w-2xl mx-auto luxury-animate-scale-in luxury-delay-4">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-lg">
                  <Search className="h-5 w-5 text-white" />
                </div>
                <Input
                  placeholder={t('Search trainers by name or specialty...')}
                  className="pl-16 pr-4 py-6 text-lg luxury-glass-card luxury-shadow-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-trainers"
                />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12">
              <div className="luxury-glass-card luxury-shadow-lg p-4 text-center luxury-animate-fade-in luxury-delay-5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <span className="luxury-heading-lg">
                    {filteredTrainers.length}
                  </span>
                </div>
                <p className="luxury-text-small">
                  {t('Certified Trainers')}
                </p>
              </div>

              <div className="luxury-glass-card luxury-shadow-lg p-4 text-center luxury-animate-fade-in luxury-delay-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <span className="luxury-heading-lg">
                    {trainers.reduce((sum, t) => sum + t.totalSessions, 0).toLocaleString()}
                  </span>
                </div>
                <p className="luxury-text-small">
                  {t('Sessions Completed')}
                </p>
              </div>

              <div className="luxury-glass-card luxury-shadow-lg p-4 text-center luxury-animate-fade-in luxury-delay-7">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                  <span className="luxury-heading-lg">
                    {(trainers.reduce((sum, t) => sum + parseFloat(t.averageRating), 0) / trainers.length).toFixed(2)}
                  </span>
                </div>
                <p className="luxury-text-small">
                  {t('Average Rating')}
                </p>
              </div>

              <div className="luxury-glass-card luxury-shadow-lg p-4 text-center luxury-animate-fade-in luxury-delay-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <span className="luxury-heading-lg">
                    100%
                  </span>
                </div>
                <p className="luxury-text-small">
                  {t('Certified & Verified')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Results */}
        <section className="luxury-container py-12">
          <div className="flex items-center justify-between mb-8 luxury-animate-fade-in luxury-delay-1">
            <div>
              <h2 className="luxury-heading-md mb-2">
                {t('Available Trainers')} ({filteredTrainers.length})
              </h2>
              <p className="luxury-text-small">
                {t('All trainers background-checked and certified')}
              </p>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="luxury-btn-secondary gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              {t('Filters')}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 mb-8 luxury-animate-scale-in">
              <div className="grid md:grid-cols-3 gap-6">
                {/* City Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    <MapPin className="inline h-4 w-4 mr-2" />
                    {t('City')}
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    data-testid="select-city"
                  >
                    <option value="">{t('All Cities')}</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    <DollarSign className="inline h-4 w-4 mr-2" />
                    {t('Hourly Rate (₪)')}: ₪{priceRange[0]} - ₪{priceRange[1]}
                  </label>
                  <Slider
                    min={0}
                    max={500}
                    step={10}
                    value={priceRange}
                    onValueChange={setPriceRange}
                    className="mt-2"
                    data-testid="slider-price-range"
                  />
                </div>

                {/* Minimum Rating */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    <Star className="inline h-4 w-4 mr-2" />
                    {t('Minimum Rating')}
                  </label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    data-testid="select-min-rating"
                  >
                    <option value="0">{t('Any Rating')}</option>
                    <option value="4.5">4.5+ ⭐⭐⭐⭐</option>
                    <option value="4.7">4.7+ ⭐⭐⭐⭐</option>
                    <option value="4.9">4.9+ ⭐⭐⭐⭐⭐</option>
                  </select>
                </div>
              </div>

              {/* Specialty Filters */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  <BookOpen className="inline h-4 w-4 mr-2" />
                  {t('Specialties')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map((specialty) => (
                    <Button
                      key={specialty}
                      variant={selectedSpecialties.includes(specialty) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleSpecialty(specialty)}
                      data-testid={`button-specialty-${specialty.toLowerCase().replace(/ /g, '-')}`}
                    >
                      {t(specialty)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {(selectedCity || selectedSpecialties.length > 0 || priceRange[0] > 0 || priceRange[1] < 500 || minRating > 0) && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedCity('');
                      setSelectedSpecialties([]);
                      setPriceRange([0, 500]);
                      setMinRating(0);
                    }}
                    data-testid="button-clear-filters"
                  >
                    {t('Clear all filters')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Trainer Cards Grid */}
          {isLoading ? (
            <div className="luxury-grid-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="luxury-glass-card luxury-shadow-lg p-6 animate-pulse">
                  <div className="h-48 bg-gradient-to-br from-amber-200/30 to-yellow-200/30 rounded-lg mb-4" />
                  <div className="h-6 luxury-skeleton rounded mb-2" />
                  <div className="h-4 luxury-skeleton rounded" />
                </div>
              ))}
            </div>
          ) : filteredTrainers.length === 0 ? (
            <div className="luxury-glass-card luxury-shadow-xl p-12 text-center">
              <div className="p-4 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl inline-block mb-4">
                <Search className="h-16 w-16 text-gray-500 dark:text-gray-400" />
              </div>
              <h3 className="luxury-heading-md mb-2">
                {t('No trainers found')}
              </h3>
              <p className="luxury-text-body mb-4">
                {t('Try adjusting your filters or search criteria')}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCity('');
                  setSelectedSpecialties([]);
                  setPriceRange([0, 500]);
                  setMinRating(0);
                }}
                className="luxury-btn-secondary"
                data-testid="button-reset-search"
              >
                {t('Reset filters')}
              </button>
            </div>
          ) : (
            <div className="luxury-grid-3">
              {filteredTrainers.map((trainer) => (
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
            </div>
          )}

          {/* Become a Trainer - Provider Registration */}
          <ProviderRegistrationBanner variant="section" platform="trainer" className="mt-16" />
        </section>
      </div>
    </Layout>
  );
}

// Trainer Card Component
function TrainerCard({ trainer }: { trainer: TrainerProfile }) {
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="luxury-glass-card luxury-hover-glow luxury-shadow-xl overflow-hidden luxury-animate-scale-in">
      {/* Cover Photo / Gradient */}
      <div className="relative h-32 bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500">
        {trainer.verified && (
          <div className="absolute top-3 left-3">
            <span className="luxury-badge-success luxury-shadow-lg">
              <div className="inline-block p-1 bg-white/20 rounded mr-1">
                <Shield className="h-3 w-3" />
              </div>
              {t('Verified')}
            </span>
          </div>
        )}
        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white transition-colors luxury-shadow-lg"
          data-testid={`button-favorite-${trainer.id}`}
        >
          <Heart
            className={`h-4 w-4 ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
            }`}
          />
        </button>
      </div>

      {/* Profile Photo */}
      <div className="relative px-6 -mt-12">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-800 luxury-shadow-xl">
          {trainer.fullName.charAt(0)}
        </div>
      </div>

      <div className="p-6 pt-4">
        {/* Name & Location */}
        <div className="mb-3">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {trainer.fullName}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            {trainer.city}
          </div>
        </div>

        {/* Rating & Experience */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {trainer.averageRating}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              ({trainer.totalSessions} {t('sessions')})
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <Briefcase className="h-4 w-4" />
            {trainer.experienceYears} {t('years')}
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
          {trainer.bio}
        </p>

        {/* Specialties */}
        <div className="flex flex-wrap gap-1 mb-4">
          {trainer.specialties?.slice(0, 3).map((specialty) => (
            <span
              key={specialty}
              className="luxury-badge text-xs"
            >
              {t(specialty)}
            </span>
          ))}
          {trainer.specialties && trainer.specialties.length > 3 && (
            <span className="luxury-badge text-xs">
              +{trainer.specialties.length - 3}
            </span>
          )}
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          {trainer.responseTime && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="h-3 w-3" />
              {trainer.responseTime}
            </div>
          )}
          {trainer.isCertified && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {t('Certified')}
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="luxury-heading-lg luxury-text-gradient">
              ₪{parseFloat(trainer.hourlyRate).toFixed(0)}
            </div>
            <div className="luxury-text-small">
              {t('per hour')}
            </div>
          </div>

          <Link href={`/academy/trainer/${trainer.id}`}>
            <button
              className="luxury-btn-primary flex items-center gap-2"
              data-testid={`button-view-trainer-${trainer.id}`}
            >
              <Calendar className="h-4 w-4" />
              {t('View Profile')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
