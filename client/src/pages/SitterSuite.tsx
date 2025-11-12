import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/LuxuryWidgets';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Star, MapPin, Heart, Search, Filter, Shield, CheckCircle2, 
  Award, TrendingUp, Users, Clock, ThumbsUp, Sparkles,
  Calendar, DollarSign, Camera, MessageCircle, Zap, Crown
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';

interface SitterProfile {
  id: string;
  fullName: string;
  city: string;
  bio: string;
  experienceYears: number;
  hourlyRateIls: number;
  available: boolean;
  profilePhotoUrl: string | null;
  rating: number;
  totalReviews: number;
  services: string[];
  instantBook?: boolean;
  verified?: boolean;
  responseTime?: string;
}

const SERVICES_OPTIONS = [
  'Dog Sitting',
  'Cat Sitting',
  'Overnight Care',
  'Drop-in Visits',
  'House Sitting',
  'Pet Medication',
];

// Mock sitter data (fallback if API returns no data)
const MOCK_SITTERS: SitterProfile[] = [
  {
    id: '1',
    fullName: 'Maya Goldstein',
    city: 'Tel Aviv',
    bio: 'Experienced pet sitter with 8 years of caring for dogs and cats. Certified in pet first aid and CPR. I treat every pet like family and provide daily photo updates. My home has a large backyard perfect for energetic dogs!',
    experienceYears: 8,
    hourlyRateIls: 85,
    available: true,
    profilePhotoUrl: null,
    rating: 4.95,
    totalReviews: 124,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Drop-in Visits', 'Pet Medication'],
    instantBook: true,
    verified: true,
    responseTime: '< 30min',
  },
  {
    id: '2',
    fullName: 'Yonatan Mizrahi',
    city: 'Jerusalem',
    bio: 'Veterinary technician with 10 years of professional experience. Specialized in senior pet care and administering medications. Patient, gentle, and knowledgeable about pet health and behavior.',
    experienceYears: 10,
    hourlyRateIls: 110,
    available: true,
    profilePhotoUrl: null,
    rating: 4.98,
    totalReviews: 156,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Pet Medication', 'House Sitting'],
    instantBook: true,
    verified: true,
    responseTime: '< 1hr',
  },
  {
    id: '3',
    fullName: 'Shira Cohen',
    city: 'Haifa',
    bio: 'Dog lover and certified dog trainer. I specialize in caring for puppies and dogs with behavioral needs. Active lifestyle - daily walks, playtime, and positive reinforcement training included!',
    experienceYears: 6,
    hourlyRateIls: 95,
    available: true,
    profilePhotoUrl: null,
    rating: 4.92,
    totalReviews: 98,
    services: ['Dog Sitting', 'Drop-in Visits', 'Overnight Care'],
    instantBook: true,
    verified: true,
    responseTime: '< 45min',
  },
  {
    id: '4',
    fullName: 'David Katz',
    city: 'Tel Aviv',
    bio: 'Cat specialist with expertise in multi-cat households. Experienced with shy, anxious, and special needs cats. I provide a calm, quiet environment and respect each cat\'s unique personality.',
    experienceYears: 7,
    hourlyRateIls: 80,
    available: true,
    profilePhotoUrl: null,
    rating: 4.89,
    totalReviews: 87,
    services: ['Cat Sitting', 'Overnight Care', 'Drop-in Visits', 'Pet Medication'],
    instantBook: false,
    verified: true,
    responseTime: '< 2hrs',
  },
  {
    id: '5',
    fullName: 'Rachel Avraham',
    city: 'Netanya',
    bio: 'Professional house sitter and pet caregiver. I stay in your home 24/7 to provide round-the-clock care for your pets and property. Extensive experience with multiple pets and large breeds.',
    experienceYears: 12,
    hourlyRateIls: 120,
    available: true,
    profilePhotoUrl: null,
    rating: 4.96,
    totalReviews: 142,
    services: ['House Sitting', 'Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Pet Medication'],
    instantBook: true,
    verified: true,
    responseTime: '< 1hr',
  },
  {
    id: '6',
    fullName: 'Eitan Levy',
    city: 'Beer Sheva',
    bio: 'Active outdoors enthusiast perfect for high-energy dogs! Daily runs, hiking trails, and beach trips available. I work from home so your pet gets constant attention and companionship.',
    experienceYears: 5,
    hourlyRateIls: 75,
    available: true,
    profilePhotoUrl: null,
    rating: 4.88,
    totalReviews: 76,
    services: ['Dog Sitting', 'Drop-in Visits', 'Overnight Care'],
    instantBook: true,
    verified: true,
    responseTime: '< 1hr',
  },
  {
    id: '7',
    fullName: 'Noa Berkowitz',
    city: 'Ramat Gan',
    bio: 'Gentle and patient caregiver specializing in elderly pets and those with medical needs. Certified in pet first aid. I understand the special care senior pets require and provide compassionate, attentive service.',
    experienceYears: 9,
    hourlyRateIls: 100,
    available: true,
    profilePhotoUrl: null,
    rating: 4.97,
    totalReviews: 134,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Pet Medication', 'Drop-in Visits'],
    instantBook: true,
    verified: true,
    responseTime: '< 30min',
  },
  {
    id: '8',
    fullName: 'Asher Rosenberg',
    city: 'Herzliya',
    bio: 'Former shelter volunteer with experience caring for 100+ dogs and cats. Comfortable with all temperaments and sizes. My spacious apartment allows separate areas for pets who prefer privacy.',
    experienceYears: 4,
    hourlyRateIls: 70,
    available: true,
    profilePhotoUrl: null,
    rating: 4.85,
    totalReviews: 62,
    services: ['Dog Sitting', 'Cat Sitting', 'Drop-in Visits'],
    instantBook: false,
    verified: true,
    responseTime: '< 3hrs',
  },
  {
    id: '9',
    fullName: 'Tamar Friedman',
    city: 'Rehovot',
    bio: 'Experienced with exotic pets and small animals! In addition to dogs and cats, I care for rabbits, birds, hamsters, and reptiles. Knowledgeable about specialized diets and habitats.',
    experienceYears: 6,
    hourlyRateIls: 90,
    available: true,
    profilePhotoUrl: null,
    rating: 4.91,
    totalReviews: 89,
    services: ['Cat Sitting', 'House Sitting', 'Drop-in Visits', 'Overnight Care'],
    instantBook: true,
    verified: true,
    responseTime: '< 1hr',
  },
  {
    id: '10',
    fullName: 'Ori Shapira',
    city: 'Kfar Saba',
    bio: 'Pet sitting is my full-time profession. Available for last-minute bookings and flexible scheduling. I provide detailed care reports and photos 3x daily. Your pet\'s happiness is my priority!',
    experienceYears: 7,
    hourlyRateIls: 85,
    available: true,
    profilePhotoUrl: null,
    rating: 4.93,
    totalReviews: 118,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Drop-in Visits'],
    instantBook: true,
    verified: true,
    responseTime: '< 15min',
  },
  {
    id: '11',
    fullName: 'Liora Golan',
    city: 'Petah Tikva',
    bio: 'Certified animal behaviorist with expertise in anxiety and separation issues. I use positive reinforcement techniques and create customized care plans for each pet. Specialized in nervous rescues.',
    experienceYears: 11,
    hourlyRateIls: 115,
    available: true,
    profilePhotoUrl: null,
    rating: 4.99,
    totalReviews: 167,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'House Sitting', 'Pet Medication'],
    instantBook: true,
    verified: true,
    responseTime: '< 30min',
  },
  {
    id: '12',
    fullName: 'Avi Weinstein',
    city: 'Rishon LeZion',
    bio: 'Retired veterinarian now offering professional pet sitting services. 30+ years of animal care experience. Perfect for pets requiring medication, special diets, or post-surgery care.',
    experienceYears: 30,
    hourlyRateIls: 140,
    available: true,
    profilePhotoUrl: null,
    rating: 5.0,
    totalReviews: 203,
    services: ['Dog Sitting', 'Cat Sitting', 'Overnight Care', 'Pet Medication', 'House Sitting', 'Drop-in Visits'],
    instantBook: false,
    verified: true,
    responseTime: '< 2hrs',
  },
];

export default function SitterSuite() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  
  const { data: sittersFromAPI, isLoading } = useQuery<SitterProfile[]>({
    queryKey: ['/api/sitter-suite/sitters', selectedCity],
  });

  // Use API data if available, otherwise fallback to mock data
  const sitters = sittersFromAPI && sittersFromAPI.length > 0 ? sittersFromAPI : MOCK_SITTERS;

  const filteredSitters = sitters?.filter(sitter => {
    const matchesSearch = sitter.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sitter.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = sitter.hourlyRateIls >= priceRange[0] && sitter.hourlyRateIls <= priceRange[1];
    const matchesServices = selectedServices.length === 0 || 
      selectedServices.some(service => sitter.services.includes(service));
    const matchesInstantBook = !instantBookOnly || sitter.instantBook;
    const matchesCertified = !certifiedOnly || sitter.verified;
    const matchesAvailable = !availableToday || sitter.available;
    return matchesSearch && matchesPrice && matchesServices && matchesInstantBook && matchesCertified && matchesAvailable;
  });

  const featuredSitters = sitters?.filter(s => s.rating >= 4.8 && s.totalReviews >= 20).slice(0, 3);

  const t = {
    hero: {
      title: isHebrew ? 'The Sitter Suite™' : 'The Sitter Suite™',
      subtitle: isHebrew 
        ? 'מרקטפלייס פרימיום לשמרטפים מקצועיים. בטוח, מאומת, שקוף' 
        : 'Premium Pet Sitting Marketplace. Safe, Verified, Transparent.',
      becomeSitter: isHebrew ? 'הפוך לשמרטף' : 'Become a Sitter',
      earnMoney: isHebrew ? 'מובילים מרוויחים תעריפי פרימיום (תלוי במיקום וניסיון)' : 'Top Earners Make Premium Rates (Varies by Location & Experience)',
      searchPlaceholder: isHebrew ? 'חפש לפי שם או עיר...' : 'Search by name or city...',
    },
    stats: {
      sitters: isHebrew ? '+ שמרטפים מאומתים' : '+ Verified Sitters',
      bookings: isHebrew ? '+ הזמנות מוצלחות' : '+ Successful Bookings',
      rating: isHebrew ? 'דירוג ממוצע' : 'Average Rating',
      responseTime: isHebrew ? 'זמן מענה ממוצע' : 'Avg Response Time',
    },
    filters: {
      title: isHebrew ? 'סנן תוצאות' : 'Filter Results',
      priceRange: isHebrew ? 'טווח מחירים' : 'Price Range',
      services: isHebrew ? 'שירותים' : 'Services',
      clear: isHebrew ? 'נקה הכל' : 'Clear All',
    },
    featured: {
      title: isHebrew ? 'שמרטפים מומלצים' : 'Featured Sitters',
      subtitle: isHebrew ? 'השמרטפים המובילים שלנו עם דירוגים מעולים' : 'Our top-rated sitters with excellent reviews',
    },
    trust: {
      title: isHebrew ? 'בטיחות ואמון' : 'Trust & Safety',
      subtitle: isHebrew ? 'השקט הנפשי שלך הוא העדיפות שלנו' : 'Your peace of mind is our priority',
    },
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
        
        {/* 7-STAR LUXURY HERO SECTION - Burj Al Arab Inspired */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-pink-600 to-purple-700 text-white py-32">
          {/* Premium Rose Gold Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-900/40 via-purple-500/30 to-pink-900/40"></div>
          
          {/* Animated Luxury Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] animate-pulse"></div>
          </div>
          
          {/* Premium Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* LEFT: Hero Content */}
              <div className="space-y-8">
                {/* Premium Trust Badge */}
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-xl border border-pink-300/30 px-6 py-3 rounded-full shadow-2xl">
                  <Crown className="w-6 h-6 text-pink-300" />
                  <span className="text-sm font-bold tracking-wider text-pink-100">7-STAR LUXURY SERVICE</span>
                </div>

                <div className="space-y-6">
                  <h1 className="text-6xl lg:text-7xl font-black leading-tight tracking-tight drop-shadow-2xl">
                    {t.hero.title}
                  </h1>
                  <p className="text-2xl lg:text-3xl text-pink-100 font-light drop-shadow-lg">
                    {t.hero.subtitle}
                  </p>
                </div>

                {/* Premium Stats Grid - Glassmorphism */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-pink-400 to-purple-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">1,200+</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{isHebrew ? 'שמרטפים' : 'Sitters'}</div>
                    </div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">50K+</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{isHebrew ? 'הזמנות' : 'Bookings'}</div>
                    </div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">4.9 ⭐</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{t.stats.rating}</div>
                    </div>
                  </div>
                </div>

                {/* Premium CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    className="group bg-white text-purple-900 hover:bg-pink-50 text-xl px-10 py-8 rounded-2xl shadow-2xl font-black tracking-wide hover:scale-105 transition-all duration-300 border-4 border-pink-200"
                    onClick={() => {
                      const resultsSection = document.getElementById('sitters-results');
                      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    data-testid="button-browse-sitters"
                  >
                    <Search className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                    {isHebrew ? 'מצא שמרטף' : 'Find a Sitter'}
                    <Heart className="w-5 h-5 ml-2 text-pink-600" />
                  </Button>
                  
                  <Link href="/provider-onboarding?type=sitter">
                    <Button 
                      size="lg" 
                      className="group bg-gradient-to-r from-pink-500 via-purple-500 to-pink-600 hover:from-pink-600 hover:via-purple-600 hover:to-pink-700 text-white text-xl px-10 py-8 rounded-2xl shadow-2xl font-black tracking-wide hover:scale-105 transition-all duration-300 border-4 border-pink-200"
                      data-testid="button-become-sitter"
                    >
                      <Sparkles className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                      {t.hero.becomeSitter}
                      <Award className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>

                {/* Earning Potential Banner - Premium Style */}
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500/30 to-green-500/30 backdrop-blur-xl border-2 border-emerald-300/40 rounded-2xl px-8 py-4 shadow-2xl">
                  <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-2 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-white drop-shadow-lg">{t.hero.earnMoney}</span>
                </div>
              </div>

              {/* RIGHT: Search Card */}
              <div>
                <GlassCard className="p-8 border-white/20">
                  <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                    {isHebrew ? 'מצא את השמרטף המושלם' : 'Find Your Perfect Sitter'}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={t.hero.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 text-lg bg-white dark:bg-gray-800 border-2"
                        data-testid="input-search-sitters"
                      />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        className={`px-4 py-2 cursor-pointer transition-all ${
                          instantBookOnly 
                            ? 'bg-purple-600 text-white hover:bg-purple-700' 
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                        onClick={() => setInstantBookOnly(!instantBookOnly)}
                        data-testid="badge-filter-instant-book"
                      >
                        {instantBookOnly && '✓ '}
                        {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
                      </Badge>
                      <Badge 
                        className={`px-4 py-2 cursor-pointer transition-all ${
                          certifiedOnly 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                        onClick={() => setCertifiedOnly(!certifiedOnly)}
                        data-testid="badge-filter-certified"
                      >
                        {certifiedOnly && '✓ '}
                        {isHebrew ? 'מוסמך' : 'Certified'}
                      </Badge>
                      <Badge 
                        className={`px-4 py-2 cursor-pointer transition-all ${
                          availableToday 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        onClick={() => setAvailableToday(!availableToday)}
                        data-testid="badge-filter-available-today"
                      >
                        {availableToday && '✓ '}
                        {isHebrew ? 'זמין היום' : 'Available Today'}
                      </Badge>
                    </div>

                    <Button 
                      size="lg" 
                      className="w-full h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg font-semibold shadow-xl"
                      onClick={() => {
                        const resultsSection = document.getElementById('sitters-results');
                        resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      data-testid="button-search"
                    >
                      {isHebrew ? 'חפש עכשיו' : 'Search Now'}
                    </Button>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>

        {/* TRUST & SAFETY SECTION - Booking.com Style */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
              {t.trust.title}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">{t.trust.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: isHebrew ? 'בדיקת רקע' : 'Background Checks', desc: isHebrew ? 'כל השמרטפים עוברים בדיקה יסודית' : 'All sitters pass thorough screening' },
              { icon: CheckCircle2, title: isHebrew ? 'ביטוח מלא' : 'Full Insurance', desc: isHebrew ? 'כיסוי עד ₪10,000 לכל הזמנה' : 'Up to ₪10,000 coverage per booking' },
              { icon: Award, title: isHebrew ? 'אישורים' : 'Certifications', desc: isHebrew ? 'שמרטפים מוסמכים ומאומנים' : 'Certified & trained professionals' },
              { icon: ThumbsUp, title: isHebrew ? 'ערבות החזר כסף' : 'Money-Back Guarantee', desc: isHebrew ? 'החזר מלא אם לא מרוצה' : 'Full refund if not satisfied' },
            ].map((item, i) => (
              <GlassCard key={i} className="p-6 text-center hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* FEATURED SITTERS SECTION */}
        {featuredSitters && featuredSitters.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-r from-purple-100/30 to-pink-100/30 dark:from-purple-900/20 dark:to-pink-900/20 rounded-3xl mb-16">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2">
                <Star className="w-4 h-4 mr-1" />
                {isHebrew ? 'מומלץ' : 'Featured'}
              </Badge>
              <h2 className="text-4xl font-bold mb-3">{t.featured.title}</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">{t.featured.subtitle}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {featuredSitters.map((sitter) => (
                <Card 
                  key={sitter.id}
                  className="group hover:shadow-2xl transition-all duration-300 border-2 border-yellow-200 dark:border-yellow-700/50 relative overflow-hidden"
                  data-testid={`card-featured-${sitter.id}`}
                >
                  {/* Featured Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-yellow-500 text-white">
                      <Star className="w-3 h-3 mr-1" />
                      {isHebrew ? 'מומלץ' : 'Top Rated'}
                    </Badge>
                  </div>

                  {/* Large Profile Photo */}
                  <div className="relative h-64 overflow-hidden">
                    {sitter.profilePhotoUrl ? (
                      <img 
                        src={sitter.profilePhotoUrl} 
                        alt={sitter.fullName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-white text-6xl font-bold">{sitter.fullName.charAt(0)}</span>
                      </div>
                    )}
                    {/* Instant Book Badge */}
                    {sitter.instantBook && (
                      <div className="absolute bottom-4 left-4">
                        <Badge className="bg-green-500 text-white">
                          <Zap className="w-3 h-3 mr-1" />
                          {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{sitter.fullName}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <MapPin className="w-4 h-4" />
                          {sitter.city}
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-lg">{sitter.rating.toFixed(1)}</span>
                          </div>
                          <span className="text-gray-500">({sitter.totalReviews} {isHebrew ? 'ביקורות' : 'reviews'})</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300 line-clamp-3">{sitter.bio}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <Clock className="w-4 h-4" />
                        <span>{sitter.experienceYears}+ {isHebrew ? 'שנות ניסיון' : 'yrs exp'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <MessageCircle className="w-4 h-4" />
                        <span>{sitter.responseTime || '< 1hr'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sitter.services.slice(0, 4).map((service, i) => (
                        <Badge key={i} variant="outline" className="border-purple-300">
                          {service}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                          ₪{sitter.hourlyRateIls}
                        </div>
                        <div className="text-sm text-gray-500">{isHebrew ? 'לשעה' : 'per hour'}</div>
                      </div>
                      
                      {user ? (
                        <Link href={`/sitter-suite/book/${sitter.id}`}>
                          <Button 
                            size="lg"
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                            data-testid={`button-book-featured-${sitter.id}`}
                          >
                            {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/signin">
                          <Button size="lg">
                            {isHebrew ? 'התחבר להזמנה' : 'Sign in to book'}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ALL SITTERS GRID WITH FILTERS */}
        <div id="sitters-results" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Filters Bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? 'כל השמרטפים' : 'All Sitters'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {filteredSitters?.length || 0} {isHebrew ? 'שמרטפים זמינים' : 'sitters available'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4" />
              {isHebrew ? 'סינון' : 'Filters'}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <GlassCard className="p-6 mb-8">
              <div className="grid md:grid-cols-3 gap-8">
                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-white">
                    {t.filters.priceRange}: ₪{priceRange[0]} - ₪{priceRange[1]}
                  </label>
                  <Slider
                    min={0}
                    max={200}
                    step={10}
                    value={priceRange}
                    onValueChange={setPriceRange}
                    className="mt-2"
                    data-testid="slider-price-range"
                  />
                </div>

                {/* Services Filter */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-white">
                    {t.filters.services}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {SERVICES_OPTIONS.map((service) => (
                      <div key={service} className="flex items-center gap-2">
                        <Checkbox
                          id={service}
                          checked={selectedServices.includes(service)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServices([...selectedServices, service]);
                            } else {
                              setSelectedServices(selectedServices.filter(s => s !== service));
                            }
                          }}
                          data-testid={`checkbox-service-${service.toLowerCase().replace(/ /g, '-')}`}
                        />
                        <label htmlFor={service} className="text-sm cursor-pointer">
                          {service}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setPriceRange([0, 200]);
                  setSelectedServices([]);
                  setInstantBookOnly(false);
                  setCertifiedOnly(false);
                  setAvailableToday(false);
                }}
                className="mt-4"
                data-testid="button-clear-filters"
              >
                {t.filters.clear}
              </Button>
            </GlassCard>
          )}

          {/* Sitters Grid */}
          {!user && (
            <Card className="mb-8 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  {isHebrew ? 'התחבר להזמנה' : 'Sign in to book'}
                </CardTitle>
                <CardDescription>
                  {isHebrew 
                    ? 'צור חשבון כדי להתחבר לשמרטפים מהימנים ולהזמין שירותי טיפול בחיות מחמד'
                    : 'Create an account to connect with trusted sitters and book pet care services'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Link href="/signin">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                      {isHebrew ? 'התחבר' : 'Sign In'}
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="outline">
                      {isHebrew ? 'צור חשבון' : 'Create Account'}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                  <CardHeader>
                    <div className="space-y-3">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : filteredSitters && filteredSitters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSitters.map((sitter) => (
                <Card 
                  key={sitter.id}
                  className="group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                  data-testid={`card-sitter-${sitter.id}`}
                >
                  {/* Profile Photo */}
                  <div className="relative h-56 overflow-hidden">
                    {sitter.profilePhotoUrl ? (
                      <img 
                        src={sitter.profilePhotoUrl} 
                        alt={sitter.fullName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-white text-5xl font-bold">{sitter.fullName.charAt(0)}</span>
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      {sitter.available && (
                        <Badge className="bg-green-500 text-white">
                          {isHebrew ? 'זמין' : 'Available'}
                        </Badge>
                      )}
                    </div>

                    {/* Favorite Button */}
                    <button 
                      className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-gray-600 hover:text-pink-500 hover:scale-110 transition-all shadow-lg"
                      data-testid={`button-favorite-${sitter.id}`}
                    >
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>

                  <CardHeader>
                    <CardTitle className="text-xl group-hover:text-purple-600 transition-colors">
                      {sitter.fullName}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      {sitter.city}
                    </div>
                    
                    {sitter.totalReviews > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i}
                              className={`w-4 h-4 ${i < Math.floor(sitter.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span className="font-semibold">{sitter.rating.toFixed(1)}</span>
                        <span className="text-gray-500 text-sm">({sitter.totalReviews})</span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {sitter.bio}
                    </p>

                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        {sitter.experienceYears}+ {isHebrew ? 'שנים' : 'years'}
                      </Badge>
                      {sitter.verified && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {isHebrew ? 'מאומת' : 'Verified'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sitter.services.slice(0, 3).map((service, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                      {sitter.services.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{sitter.services.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                          ₪{sitter.hourlyRateIls}
                        </div>
                        <div className="text-xs text-gray-500">{isHebrew ? 'לשעה' : 'per hour'}</div>
                      </div>
                      
                      {user ? (
                        <Link href={`/sitter-suite/book/${sitter.id}`}>
                          <Button 
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                            data-testid={`button-book-${sitter.id}`}
                          >
                            {isHebrew ? 'הזמן' : 'Book'}
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/signin">
                          <Button variant="outline">
                            {isHebrew ? 'התחבר' : 'Sign in'}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-16">
              <CardContent>
                <Search className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                <h3 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">
                  {isHebrew ? 'לא נמצאו שמרטפים' : 'No sitters found'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'נסה לשנות את החיפוש או הסינונים' : 'Try adjusting your search or filters'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* HOW IT WORKS SECTION */}
        <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
                {isHebrew ? 'איך זה עובד?' : 'How It Works'}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                {isHebrew ? 'פשוט, מהיר ובטוח' : 'Simple, Fast & Secure'}
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { 
                  num: '1', 
                  icon: Search,
                  title: isHebrew ? 'חפש ודפדף' : 'Search & Browse',
                  desc: isHebrew ? 'עיין בשמרטפים מאומתים באזורך. בדוק ביקורות, ניסיון וזמינות' : 'Browse verified sitters in your area. Check reviews, experience & availability'
                },
                { 
                  num: '2', 
                  icon: MessageCircle,
                  title: isHebrew ? 'התחבר' : 'Connect',
                  desc: isHebrew ? 'שוחח עם שמרטפים, שאל שאלות והבן את הצרכים שלך' : 'Chat with sitters, ask questions & discuss your needs'
                },
                { 
                  num: '3', 
                  icon: Calendar,
                  title: isHebrew ? 'הזמן בבטחה' : 'Book Securely',
                  desc: isHebrew ? 'בחר תאריכים ושלם בבטחה דרך Nayax. תשלום שקוף עם 10% עמלת פלטפורמה' : 'Select dates & pay securely via Nayax. Transparent pricing with 10% platform fee'
                },
                { 
                  num: '4', 
                  icon: ThumbsUp,
                  title: isHebrew ? 'נוח והערך' : 'Relax & Review',
                  desc: isHebrew ? 'חיית המחמד שלך בידיים מהימנות. השאר ביקורת לאחר סיום השירות' : 'Your pet is in trusted hands. Leave a review after service completion'
                },
              ].map((step) => (
                <div key={step.num} className="text-center space-y-4">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
                      {step.num}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg">
                      <step.icon className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TESTIMONIALS SECTION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              {isHebrew ? 'מה לקוחות אומרים' : 'What Pet Parents Say'}
            </h2>
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Star className="w-6 h-6 fill-current" />
              <Star className="w-6 h-6 fill-current" />
              <Star className="w-6 h-6 fill-current" />
              <Star className="w-6 h-6 fill-current" />
              <Star className="w-6 h-6 fill-current" />
              <span className="text-gray-700 dark:text-gray-300 ml-2">4.9/5 {isHebrew ? 'מתוך 12,000+ ביקורות' : 'from 12,000+ reviews'}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Jessica Williams',
                city: 'Toronto, Canada',
                text: 'Amazing experience! Our sitter was professional, caring, and sent us photos every day. Highly recommend!',
                rating: 5,
                petType: '🐕 Golden Retriever'
              },
              {
                name: 'David Thompson',
                city: 'Sydney, Australia',
                text: 'We found the perfect sitter for our cat. The platform made it so easy to book and communicate.',
                rating: 5,
                petType: '🐈 Persian Cat'
              },
              {
                name: 'Rachel Anderson',
                city: 'London, England',
                text: 'Peace of mind while on vacation! Our dog was so happy and well cared for. Will book again!',
                rating: 5,
                petType: '🐕 Labrador'
              },
              {
                name: 'Michael Roberts',
                city: 'Vancouver, Canada',
                text: 'Our anxious rescue dog felt comfortable immediately. The sitter was patient, experienced, and understanding. Best pet care we\'ve ever had!',
                rating: 5,
                petType: '🐕 Mixed Breed Rescue'
              },
              {
                name: 'Sophie Bennett',
                city: 'Melbourne, Australia',
                text: 'Needed last-minute help and found a sitter within hours! Professional service with real-time updates. My cats were happy and healthy.',
                rating: 5,
                petType: '🐈 Two Siamese Cats'
              },
              {
                name: 'James Mitchell',
                city: 'Manchester, England',
                text: 'The sitter administered my dog\'s medication perfectly and kept detailed care logs. Trustworthy and reliable professional!',
                rating: 5,
                petType: '🐕 German Shepherd'
              },
              {
                name: 'Emma Parker',
                city: 'Calgary, Canada',
                text: 'Booked overnight care for our puppy. Received video updates and he came home tired and happy! Will definitely use again.',
                rating: 5,
                petType: '🐕 Beagle Puppy'
              },
              {
                name: 'Oliver Davis',
                city: 'Brisbane, Australia',
                text: 'Our senior cat needs special care and the sitter was incredibly gentle and knowledgeable. Gave us peace of mind during our trip.',
                rating: 5,
                petType: '🐈 Senior Cat (16 years)'
              },
              {
                name: 'Charlotte Wilson',
                city: 'Birmingham, England',
                text: 'The platform\'s insurance and background checks gave me confidence. The sitter exceeded expectations - professional and loving!',
                rating: 5,
                petType: '🐕 Poodle'
              },
            ].map((review, i) => (
              <GlassCard key={i} className="p-6">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-4 italic">"{review.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {review.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">{review.name}</div>
                    <div className="text-sm text-gray-500">{review.city}</div>
                    {review.petType && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{review.petType}</div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* FINAL CTA SECTION */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-5xl font-bold mb-6">
              {isHebrew ? 'מוכן להתחיל?' : 'Ready to Get Started?'}
            </h2>
            <p className="text-2xl mb-8 text-white/90">
              {isHebrew 
                ? 'הצטרף לאלפי בעלי חיות מחמד מרוצים שמצאו את השמרטף המושלם'
                : 'Join thousands of happy pet parents who found their perfect sitter'}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                size="lg"
                className="bg-white text-purple-700 hover:bg-gray-100 text-xl px-10 py-7 rounded-xl shadow-2xl font-bold"
              >
                <Search className="w-6 h-6 mr-2" />
                {isHebrew ? 'מצא שמרטף עכשיו' : 'Find a Sitter Now'}
              </Button>
              <Link href="/provider-onboarding?type=sitter">
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white/10 text-xl px-10 py-7 rounded-xl font-bold backdrop-blur-sm"
                >
                  <DollarSign className="w-6 h-6 mr-2" />
                  {isHebrew ? 'הרווח כשמרטף' : 'Earn as a Sitter'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
