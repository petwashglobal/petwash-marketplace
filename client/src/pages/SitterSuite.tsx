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
import { setProviderSignupIntent } from '@/lib/becomeProvider';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { useSEO, pageSEO } from '@/lib/seo';
import { BookingWizard, BookingFilters } from '@/components/BookingWizard';

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


export default function SitterSuite() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  // Apply SEO metadata
  useSEO(pageSEO.sitterSuite);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, 200]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [bookingFilters, setBookingFilters] = useState<BookingFilters | null>(null);

  const handleWizardComplete = (filters: BookingFilters) => {
    setBookingFilters(filters);
    setShowWizard(false);
    if (filters.location) {
      setSelectedCity(filters.location);
      setSearchQuery(filters.location);
    }
    const resultsSection = document.getElementById('sitters-results');
    resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const { data: sittersFromAPI, isLoading } = useQuery<SitterProfile[]>({
    queryKey: ['/api/sitter-suite/sitters', selectedCity],
  });

  const sitters = sittersFromAPI || [];

  interface TopReview {
    id: number;
    rating: number;
    comment: string | null;
    sitterFirstName: string;
    sitterLastName: string;
    sitterCity: string | null;
  }
  const { data: topReviewsData } = useQuery<{ reviews: TopReview[] }>({
    queryKey: ['/api/sitter-suite/top-reviews'],
  });
  const topReviews = topReviewsData?.reviews ?? [];

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
      title: isHebrew ? '⁦The Sitter Suite™⁩' : '⁦The Sitter Suite™⁩',
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
      <div className="min-h-screen luxury-bg-mesh">
        
        {/* 7-STAR LUXURY HERO SECTION */}
        <div className="relative overflow-hidden luxury-bg-primary text-white py-32 luxury-animate-fade-in">
          {/* Premium Rose Gold Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-900/40 via-pink-600/30 to-pink-900/40"></div>
          
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
                  <h1 className="luxury-heading-xl text-white">
                    {t.hero.title}
                  </h1>
                  <p className="luxury-text-body text-white text-opacity-95 text-xl">
                    {t.hero.subtitle}
                  </p>
                </div>

                {/* Premium Features Grid - No fake stats, only factual features */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-pink-400 to-pink-600 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-xl font-black text-white drop-shadow-lg">{isHebrew ? 'מאומת' : 'Verified'}</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{isHebrew ? 'כל השמרטפים' : 'All Sitters'}</div>
                    </div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      {/* PR-LEGAL-B: previously 'Insured' / 'Full Coverage' badge.
                          Replaced with neutral verification labels per §8 of the
                          Provider & Host Services Agreement. */}
                      <div className="text-xl font-black text-white drop-shadow-lg">{isHebrew ? 'מאומת' : 'Verified'}</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{isHebrew ? 'מטפלים מאומתים' : 'Verified sitters'}</div>
                    </div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform mb-2">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-xl font-black text-white drop-shadow-lg">24/7</div>
                      <div className="text-xs font-medium text-pink-100 tracking-wide mt-1">{isHebrew ? 'תמיכה' : 'Support'}</div>
                    </div>
                  </div>
                </div>

                {/* Premium CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <Button 
                    className="luxury-btn-primary luxury-hover-glow flex items-center gap-3"
                    onClick={() => {
                      const resultsSection = document.getElementById('sitters-results');
                      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    data-testid="button-browse-sitters"
                  >
                    <Search className="w-6 h-6" />
                    {isHebrew ? 'מצא שמרטף' : 'Find a Sitter'}
                    <Heart className="w-5 h-5" />
                  </Button>
                  
                  <Link href="/join/sitter" onClick={setProviderSignupIntent}>
                    <Button 
                      className="luxury-btn-secondary flex items-center gap-3"
                      data-testid="button-become-sitter"
                    >
                      <Sparkles className="w-6 h-6" />
                      {t.hero.becomeSitter}
                      <Award className="w-5 h-5" />
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
              <div className="luxury-animate-slide-up luxury-delay-2">
                <div className="luxury-glass-card luxury-shadow-lg p-8">
                  <h3 className="luxury-heading-md mb-6">
                    {isHebrew ? 'מצא את השמרטף המושלם' : 'Find Your Perfect Sitter'}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Guided Booking Button - ⁦Pet Wash™⁩ Luxury Wizard */}
                    <Button
                      onClick={() => setShowWizard(true)}
                      className="w-full h-16 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold text-lg flex items-center justify-center gap-3 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 transition-all shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:scale-[1.02]"
                      data-testid="button-start-booking-wizard"
                    >
                      <Crown className="w-6 h-6" />
                      {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                      <Sparkles className="w-5 h-5" />
                    </Button>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                      {isHebrew ? '— או חפש ישירות —' : '— or search directly —'}
                    </div>
                    
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={t.hero.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 text-lg bg-white dark:bg-white border-2"
                        data-testid="input-search-sitters"
                      />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2">
                      <span 
                        className={`luxury-badge cursor-pointer ${instantBookOnly ? 'luxury-badge-gold' : ''}`}
                        onClick={() => setInstantBookOnly(!instantBookOnly)}
                        data-testid="badge-filter-instant-book"
                      >
                        {instantBookOnly && '✓ '}
                        {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
                      </span>
                      <span 
                        className={`luxury-badge cursor-pointer ${certifiedOnly ? 'luxury-badge-success' : ''}`}
                        onClick={() => setCertifiedOnly(!certifiedOnly)}
                        data-testid="badge-filter-certified"
                      >
                        {certifiedOnly && '✓ '}
                        {isHebrew ? 'מוסמך' : 'Certified'}
                      </span>
                      <span 
                        className={`luxury-badge cursor-pointer ${availableToday ? 'luxury-badge-success' : ''}`}
                        onClick={() => setAvailableToday(!availableToday)}
                        data-testid="badge-filter-available-today"
                      >
                        {availableToday && '✓ '}
                        {isHebrew ? 'זמין היום' : 'Available Today'}
                      </span>
                    </div>

                    <Button 
                      className="luxury-btn-primary w-full"
                      onClick={() => {
                        const resultsSection = document.getElementById('sitters-results');
                        resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      data-testid="button-search"
                    >
                      {isHebrew ? 'חפש עכשיו' : 'Search Now'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* TRUST & SAFETY SECTION */}
        <div className="luxury-section">
          <div className="luxury-container">
            <div className="text-center mb-12 luxury-animate-fade-in">
              <h2 className="luxury-heading-lg mb-4 luxury-text-gradient">
                {t.trust.title}
              </h2>
              <p className="luxury-text-body">{t.trust.subtitle}</p>
            </div>

            <div className="luxury-grid-4">
              {[
                { icon: Shield, title: isHebrew ? 'בדיקת רקע' : 'Background Checks', desc: isHebrew ? 'כל השמרטפים עוברים בדיקה יסודית' : 'All sitters pass thorough screening' },
                // PR-LEGAL-B: previously 'Full Insurance' / 'Up to ₪10,000
                // coverage per booking'. Replaced with neutral verification
                // tile per §8 of the Provider & Host Services Agreement.
                { icon: CheckCircle2, title: isHebrew ? 'ספקים מאומתים' : 'Verified providers', desc: isHebrew ? 'זהות, מסמכים והמלצות עברו בדיקה' : 'Identity, documents and references checked' },
                { icon: Award, title: isHebrew ? 'אישורים' : 'Certifications', desc: isHebrew ? 'שמרטפים מוסמכים ומאומנים' : 'Certified & trained professionals' },
                { icon: ThumbsUp, title: isHebrew ? 'ערבות החזר כסף' : 'Money-Back Guarantee', desc: isHebrew ? 'החזר מלא אם לא מרוצה' : 'Full refund if not satisfied' },
              ].map((item, i) => (
                <div key={i} className={`luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-scale-in luxury-delay-${i + 1}`}>
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center luxury-shadow-lg">
                    <item.icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="luxury-heading-sm mb-3">{item.title}</h3>
                  <p className="luxury-text-small">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* VALUE PROPOSITION SECTION */}
        <div className="luxury-section bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="luxury-container">
            <div className="text-center mb-12 luxury-animate-fade-in">
              <span className="luxury-badge luxury-badge-gold mb-4 inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {isHebrew ? 'פעם ראשונה בישראל' : 'First in Israel'}
              </span>
              <h2 className="luxury-heading-lg mb-4 text-white">
                {isHebrew ? 'למה לבחור במרקטפלייס של ⁦Pet Wash™⁩?' : 'Why Choose ⁦Pet Wash™⁩ Marketplace?'}
              </h2>
              <p className="luxury-text-body text-gray-300 max-w-3xl mx-auto">
                {isHebrew 
                  ? 'מרקטפלייס השירותים לחיות מחמד הראשון והיוקרתי בישראל עם מקצוענים מאומתים'
                  : "Israel's first premium pet services marketplace with verified professionals"}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  icon: Shield, 
                  title: isHebrew ? 'כולם מאומתים ועברו בדיקת רקע' : 'All Verified & Background Checked',
                  desc: isHebrew 
                    ? 'כל שמרטף, מטייל כלבים, נהג ומאלף עובר בדיקות רקע יסודיות ואימות זהות לפני שמצטרף לפלטפורמה שלנו.'
                    : 'Every sitter, dog walker, driver, and trainer passes thorough background checks and identity verification.',
                  color: 'from-blue-500 to-blue-600'
                },
                { 
                  icon: Heart, 
                  title: isHebrew ? 'רק אוהבי חיות' : 'Animal Lovers Only',
                  desc: isHebrew 
                    ? 'אנחנו מעסיקים רק אוהבי חיות אמיתיים שמתייחסים לכל חיית מחמד כמו לבן משפחה שלהם.'
                    : 'We hire only genuine animal lovers who treat every pet like their own family member.',
                  color: 'from-pink-500 to-pink-600'
                },
                { 
                  icon: Award, 
                  title: isHebrew ? 'הסכמים מחייבים חוקית' : 'Legally Binding Agreements',
                  desc: isHebrew 
                    ? 'כל קבלני המשנה שלנו חתומים על מסמכים מחייבים חוקית שמבטיחים אחריות וסטנדרטים מקצועיים.'
                    : 'All subcontractors sign legally binding documents ensuring accountability and professional standards.',
                  color: 'from-amber-500 to-orange-500'
                },
                { 
                  icon: Users, 
                  title: isHebrew ? 'שמירה על הבית כלולה' : 'House Sitting Included',
                  desc: isHebrew 
                    ? 'השמרטף שלכם ישמור על הבית, ישקה את העציצים, יאסוף דואר וישמור על הכל מאובטח בזמן שאתם בחופשה.'
                    : 'Your sitter will watch your home, water plants, collect mail, and keep everything secure.',
                  color: 'from-green-500 to-emerald-500'
                },
                { 
                  icon: MapPin, 
                  title: isHebrew ? 'נותני שירות מהשכונה' : 'Local Neighborhood Providers',
                  desc: isHebrew 
                    ? 'התחברו עם שכנים מהימנים שמחפשים הכנסה נוספת. הם מכירים את האזור ואכפת להם.'
                    : 'Connect with trusted neighbors looking for extra income. They know the area and they care.',
                  color: 'from-purple-500 to-purple-600'
                },
                { 
                  icon: Calendar, 
                  title: isHebrew ? 'אירוח בבית של נותן השירות' : "Host at Provider's Home",
                  desc: isHebrew 
                    ? 'מעדיפים שחיית המחמד תשהה במקום אחר? נותני השירות מציעים את ביתם עם 2 טיולים ביום, מים טריים ואוכל.'
                    : 'Prefer your pet stays elsewhere? Providers offer their homes with 2 daily walks, fresh water, and food.',
                  color: 'from-cyan-500 to-teal-500'
                },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-scale-in luxury-delay-${Math.min(i + 1, 5)}`}
                  data-testid={`value-prop-card-${i}`}
                >
                  <div className={`w-14 h-14 mb-4 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center luxury-shadow-md`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="luxury-heading-sm mb-3 text-white">{item.title}</h3>
                  <p className="luxury-text-small text-gray-300">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Vacation CTA */}
            <div className="mt-12 luxury-glass-card luxury-shadow-xl p-8 bg-gradient-to-r from-amber-600/30 via-orange-500/30 to-amber-600/30 border-2 border-amber-400/30 luxury-animate-fade-in">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-right">
                  <h3 className="text-2xl font-black text-white mb-2">
                    {isHebrew ? '🏖️ צאו לחופשה בשקט!' : '🏖️ Go on Vacation Stress-Free!'}
                  </h3>
                  <p className="text-lg text-pink-100">
                    {isHebrew 
                      ? 'השאירו את חיית המחמד שלכם בבית עם שמרטף מקצועי. הם ידאגו לטיולים, אוכל, מים וחוויה מושלמת.'
                      : 'Leave your pet at home with a professional sitter. They\'ll handle walks, food, water, and a perfect experience.'}
                  </p>
                </div>
                <Button 
                  className="luxury-btn-primary px-8 py-4 text-lg whitespace-nowrap"
                  onClick={() => {
                    const resultsSection = document.getElementById('sitters-results');
                    resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  data-testid="button-vacation-cta"
                >
                  {isHebrew ? 'מצא שמרטף עכשיו' : 'Find a Sitter Now'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* FEATURED SITTERS SECTION */}
        {featuredSitters && featuredSitters.length > 0 && (
          <div className="luxury-section luxury-bg-soft">
            <div className="luxury-container">
              <div className="text-center mb-12 luxury-animate-fade-in">
                <span className="luxury-badge luxury-badge-gold mb-4 inline-flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  {isHebrew ? 'מומלץ' : 'Featured'}
                </span>
                <h2 className="luxury-heading-lg mb-3">{t.featured.title}</h2>
                <p className="luxury-text-body">{t.featured.subtitle}</p>
              </div>

              <div className="luxury-grid-3">
                {featuredSitters.map((sitter, idx) => (
                  <div 
                    key={sitter.id}
                    className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg relative overflow-hidden luxury-animate-scale-in luxury-delay-${idx + 1}`}
                    data-testid={`card-featured-${sitter.id}`}
                  >
                    {/* Featured Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <span className="luxury-badge luxury-badge-gold">
                        <Star className="w-3 h-3" />
                        {isHebrew ? 'מומלץ' : 'Top Rated'}
                      </span>
                    </div>

                  {/* Large Profile Photo - Circular with Gradient Border */}
                  <div className="relative h-64 flex items-center justify-center p-8">
                    <div className="w-48 h-48 rounded-full p-1 bg-gradient-to-br from-pink-500 via-pink-400 to-pink-600 shadow-2xl luxury-hover-glow">
                      {sitter.profilePhotoUrl ? (
                        <img 
                          src={sitter.profilePhotoUrl} 
                          alt={sitter.fullName}
                          className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-6xl font-bold">{sitter.fullName.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    {/* Instant Book Badge */}
                    {sitter.instantBook && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                        <span className="luxury-badge luxury-badge-success flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
                        </span>
                      </div>
                    )}
                  </div>

                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="luxury-heading-md mb-2">{sitter.fullName}</h3>
                          <div className="luxury-text-small flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4" />
                            {sitter.city}
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="luxury-badge luxury-badge-gold flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-600" />
                              <span className="font-bold">{sitter.rating.toFixed(1)}</span>
                            </span>
                            <span className="luxury-text-small">({sitter.totalReviews} {isHebrew ? 'ביקורות' : 'reviews'})</span>
                          </div>
                        </div>
                      </div>

                      <p className="luxury-text-body line-clamp-3 mb-4">{sitter.bio}</p>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="luxury-text-small">{sitter.experienceYears}+ {isHebrew ? 'שנות ניסיון' : 'yrs exp'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          <span className="luxury-text-small">{sitter.responseTime || '< 1hr'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {sitter.services.slice(0, 4).map((service, i) => (
                          <span key={i} className="luxury-badge">
                            {service}
                          </span>
                        ))}
                      </div>

                      <div className="luxury-divider"></div>

                      <div className="flex items-center justify-between pt-4">
                        <div>
                          <div className="luxury-heading-lg luxury-text-gradient">
                            ₪{sitter.hourlyRateIls}
                          </div>
                          <div className="luxury-text-small">{isHebrew ? 'לשעה' : 'per hour'}</div>
                        </div>
                      
                        {user ? (
                          <Link href={`/sitter-suite/book/${sitter.id}`}>
                            <Button 
                              className="luxury-btn-primary"
                              data-testid={`button-book-featured-${sitter.id}`}
                            >
                              {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
                            </Button>
                          </Link>
                        ) : (
                          <Link href="/signin">
                            <Button className="luxury-btn-secondary">
                              {isHebrew ? 'התחבר להזמנה' : 'Sign in to book'}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="luxury-divider"></div>

        {/* ALL SITTERS GRID WITH FILTERS */}
        <div id="sitters-results" className="luxury-section">
          <div className="luxury-container">
            {/* Filters Bar */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="luxury-heading-lg">
                  {isHebrew ? 'כל השמרטפים' : 'All Sitters'}
                </h2>
                <p className="luxury-text-body">
                  {filteredSitters?.length || 0} {isHebrew ? 'שמרטפים זמינים' : 'sitters available'}
                </p>
              </div>
              <Button
                className="luxury-btn-ghost flex items-center gap-2"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-controls="sitter-filters-panel"
                data-testid="button-toggle-filters"
              >
                <Filter className="w-4 h-4" />
                {isHebrew ? 'סינון' : 'Filters'}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div id="sitter-filters-panel" className="luxury-glass-panel luxury-shadow-md p-6 mb-8">
                <div className="grid md:grid-cols-3 gap-8">
                  {/* Price Range */}
                  <div>
                    <label className="luxury-heading-sm block mb-3">
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
                    <label className="luxury-heading-sm block mb-3">
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
                          <label htmlFor={service} className="luxury-text-small cursor-pointer">
                            {service}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  className="luxury-btn-ghost mt-4"
                  onClick={() => {
                    setPriceRange([0, 200]);
                    setSelectedServices([]);
                    setInstantBookOnly(false);
                    setCertifiedOnly(false);
                    setAvailableToday(false);
                  }}
                  data-testid="button-clear-filters"
                >
                  {t.filters.clear}
                </Button>
              </div>
            )}

          {/* Sitters Grid */}
          {!user && (
            <Card className="mb-8 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-amber-50 dark:from-pink-900/20 dark:to-amber-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-pink-600" />
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
                    <Button className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600">
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
              <div className="luxury-grid-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="luxury-glass-card">
                    <div className="luxury-skeleton h-48" />
                    <div className="p-6 space-y-3">
                      <div className="luxury-skeleton h-6 w-3/4" />
                      <div className="luxury-skeleton h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSitters && filteredSitters.length > 0 ? (
              <div className="luxury-grid-3">
                {filteredSitters.map((sitter, idx) => (
                  <div 
                    key={sitter.id}
                    className={`luxury-glass-card luxury-hover-glow luxury-shadow-md overflow-hidden luxury-animate-scale-in luxury-delay-${(idx % 6) + 1}`}
                    data-testid={`card-sitter-${sitter.id}`}
                  >
                    {/* Profile Photo - Circular with Gradient Border */}
                    <div className="relative h-56 flex items-center justify-center p-6">
                      <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-br from-pink-500 via-pink-400 to-pink-600 shadow-xl">
                        {sitter.profilePhotoUrl ? (
                          <img 
                            src={sitter.profilePhotoUrl} 
                            alt={sitter.fullName}
                            className="w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-5xl font-bold">{sitter.fullName.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                    
                      {/* Status Badge */}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2">
                        {sitter.available && (
                          <span className="luxury-badge luxury-badge-success">
                            {isHebrew ? 'זמין' : 'Available'}
                          </span>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <Button 
                        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:text-pink-500 hover:scale-110 transition-all shadow-xl luxury-hover-glow"
                        data-testid={`button-favorite-${sitter.id}`}
                      >
                        <Heart className="w-6 h-6" />
                      </Button>
                    </div>

                    <div className="p-6">
                      <h3 className="luxury-heading-sm mb-2">
                        {sitter.fullName}
                      </h3>
                      <div className="luxury-text-small flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4" />
                        {sitter.city}
                      </div>
                      
                      {sitter.totalReviews > 0 && (
                        <div className="flex items-center gap-2 mb-4">
                          <span className="luxury-badge luxury-badge-gold flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-600" />
                            <span className="font-bold">{sitter.rating.toFixed(1)}</span>
                          </span>
                          <span className="luxury-text-small">({sitter.totalReviews} {isHebrew ? 'ביקורות' : 'reviews'})</span>
                        </div>
                      )}

                      <p className="luxury-text-small line-clamp-2 mb-4">
                        {sitter.bio}
                      </p>

                      <div className="flex items-center gap-3 mb-4">
                        <span className="luxury-badge">
                          {sitter.experienceYears}+ {isHebrew ? 'שנים' : 'years'}
                        </span>
                        {sitter.verified && (
                          <span className="luxury-badge luxury-badge-success flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {isHebrew ? 'מאומת' : 'Verified'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {sitter.services.slice(0, 3).map((service, i) => (
                          <span key={i} className="luxury-badge text-xs">
                            {service}
                          </span>
                        ))}
                        {sitter.services.length > 3 && (
                          <span className="luxury-badge text-xs">
                            +{sitter.services.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="luxury-divider"></div>

                      <div className="flex items-center justify-between pt-4">
                        <div>
                          <div className="luxury-heading-lg luxury-text-gradient">
                            ₪{sitter.hourlyRateIls}
                          </div>
                          <div className="luxury-text-small">{isHebrew ? 'לשעה' : 'per hour'}</div>
                        </div>
                        
                        {user ? (
                          <Link href={`/sitter-suite/book/${sitter.id}`}>
                            <Button 
                              className="luxury-btn-primary"
                              data-testid={`button-book-${sitter.id}`}
                            >
                              {isHebrew ? 'הזמן' : 'Book'}
                            </Button>
                          </Link>
                        ) : (
                          <Link href="/signin">
                            <Button className="luxury-btn-ghost">
                              {isHebrew ? 'התחבר' : 'Sign in'}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="luxury-glass-card luxury-shadow-md text-center py-20 px-6" data-testid="empty-state">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                  <Heart className="w-12 h-12 text-white" />
                </div>
                <h3 className="luxury-heading-md mb-3">
                  {isHebrew ? 'בקרוב - שמרטפים מקצועיים' : 'Coming Soon - Professional Sitters'}
                </h3>
                <p className="luxury-text-body mb-6 max-w-md mx-auto">
                  {isHebrew 
                    ? 'אנחנו מגייסים שמרטפים מאומתים לפלטפורמה. רוצים להיות הראשונים לדעת כשנשיק?' 
                    : 'We are recruiting verified sitters to our platform. Want to be the first to know when we launch?'}
                </p>
                <Link href="/join/sitter" onClick={setProviderSignupIntent}>
                  <Button className="luxury-btn-primary" data-testid="button-become-sitter">
                    {isHebrew ? 'הפוך לשמרטף' : 'Become a Sitter'}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* HOW IT WORKS SECTION */}
        <div className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-16 luxury-animate-fade-in">
              <h2 className="luxury-heading-lg mb-4 luxury-text-gradient">
                {isHebrew ? 'איך זה עובד?' : 'How It Works'}
              </h2>
              <p className="luxury-text-body">
                {isHebrew ? 'פשוט, מהיר ובטוח' : 'Simple, Fast & Secure'}
              </p>
            </div>
            
            <div className="luxury-grid-4">
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
              ].map((step, idx) => (
                <div key={step.num} className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg text-center p-8 luxury-animate-scale-in luxury-delay-${idx + 1}`}>
                  <div className="relative inline-block mb-6">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-600 via-pink-500 to-pink-700 rounded-2xl flex items-center justify-center text-white text-4xl font-black shadow-2xl luxury-hover-glow">
                      {step.num}
                    </div>
                    <div className="absolute -bottom-3 -right-3 w-14 h-14 bg-white dark:bg-white rounded-xl flex items-center justify-center shadow-xl border-4 border-pink-100 dark:border-pink-900">
                      <step.icon className="w-7 h-7 text-pink-600" />
                    </div>
                    </div>
                    <h3 className="luxury-heading-sm mb-3">{step.title}</h3>
                    <p className="luxury-text-small">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        <div className="luxury-divider"></div>

        {/* TESTIMONIALS SECTION */}
        <div className="luxury-section">
          <div className="luxury-container">
            <div className="text-center mb-12 luxury-animate-fade-in">
              <h2 className="luxury-heading-lg mb-4 luxury-text-gradient">
                {isHebrew ? 'מה לקוחות אומרים' : 'What Pet Parents Say'}
              </h2>
              <div className="flex items-center justify-center gap-2 text-yellow-400">
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <Star className="w-6 h-6 fill-current" />
                <span className="luxury-text-body ml-2">{isHebrew ? 'ביקורות לקוחות' : 'Customer Reviews'}</span>
              </div>
            </div>

            <div className="luxury-grid-3">
            {topReviews.length === 0 ? (
              <p className="col-span-3 text-center luxury-text-body text-muted-foreground">
                {isHebrew ? 'ביקורות יטענו בקרוב' : 'Reviews will appear here soon'}
              </p>
            ) : topReviews.map((review, i) => (
                <div key={review.id} className={`luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-scale-in luxury-delay-${(i % 3) + 1}`}>
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="luxury-text-body mb-4 italic">"{review.comment}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white font-bold luxury-shadow-md">
                      {review.sitterFirstName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="luxury-heading-sm">{review.sitterFirstName} {review.sitterLastName.charAt(0)}.</div>
                      {review.sitterCity && (
                        <div className="luxury-text-small">{review.sitterCity}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* FINAL CTA SECTION */}
        <div className="luxury-section luxury-bg-primary text-white">
          <div className="luxury-container max-w-4xl text-center">
            <h2 className="luxury-heading-xl text-white mb-6">
              {isHebrew ? 'מוכן להתחיל?' : 'Ready to Get Started?'}
            </h2>
            <p className="luxury-text-body text-white text-opacity-95 text-xl mb-8">
              {isHebrew 
                ? 'הצטרף לאלפי בעלי חיות מחמד מרוצים שמצאו את השמרטף המושלם'
                : 'Join thousands of happy pet parents who found their perfect sitter'}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                className="luxury-btn-primary luxury-hover-glow flex items-center gap-2"
              >
                <Search className="w-6 h-6" />
                {isHebrew ? 'מצא שמרטף עכשיו' : 'Find a Sitter Now'}
              </Button>
              <Link href="/join/sitter" onClick={setProviderSignupIntent}>
                <Button 
                  className="luxury-btn-secondary flex items-center gap-2"
                >
                  <DollarSign className="w-6 h-6" />
                  {isHebrew ? 'הרווח כשמרטף' : 'Earn as a Sitter'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <BookingWizard
            platform="sitter"
            onComplete={handleWizardComplete}
            onClose={() => setShowWizard(false)}
          />
        </div>
      )}
    </Layout>
  );
}
