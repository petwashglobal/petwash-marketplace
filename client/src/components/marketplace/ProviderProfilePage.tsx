/**
 * ProviderProfilePage — Real trust data. Hide anything that isn't real.
 *
 * DATA TRUTH AUDIT:
 *   ratingAverage / reviewCount   — from props (from providerProfiles.rating_avg / rating_count)
 *   completedBookings              — from API /api/providers/stats/:userId — real count
 *   repeatClientCount              — from API — null = hide (not fake)
 *   responseRatePct                — from API — null = hide (not fake)
 *   avgResponseTimeMinutes         — from API — null = hide (not fake)
 *   hasBackgroundCheck             — from API — based on background_check_status = 'approved'
 *   hasFencedYard / hasNoPetsAtHome — from API — null = hide (provider hasn't filled in)
 *   isNew                          — from API — completedBookings < 3 (real count)
 *   bookingsThisMonth              — from props — hide if 0 or undefined (never invent)
 *   isSavedByUser                  — from saved_providers table (persisted per user)
 *
 * STICKY WIDGET:
 *   Desktop: right-column sidebar, sticky top-8
 *   Mobile:  fixed bottom bar (above system nav) — no footer overlap
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, MapPin, Shield, Clock, Award, ChevronDown, ChevronUp,
  Check, Calendar, MessageCircle, Heart, Zap, Users, Home,
  AlertCircle, Sparkles, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ServiceMode = 'providerLocation' | 'clientLocation';

export interface ServiceOption {
  id: string;
  label: string;
  labelHe?: string;
  description?: string;
  descriptionHe?: string;
  priceFrom: number;
  priceUnit: string;
  priceUnitHe?: string;
}

export interface AddOnOption {
  id: string;
  label: string;
  labelHe?: string;
  description?: string;
  priceFrom?: number;
}

export interface Review {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  petType?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  questionHe?: string;
  answer: string;
  answerHe?: string;
}

export interface ProviderProfileProps {
  platform: 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';
  providerId: string;
  providerName: string;
  tagline: string;
  taglineHe?: string;
  location: string;
  ratingAverage: number;
  reviewCount: number;
  yearsExperience: number;
  heroImageUrl: string;
  galleryImages: string[];
  bio: string;
  bioHe?: string;
  languages: string[];
  acceptedPets: string;
  acceptedPetsHe?: string;
  maxPetsPerBooking: number;
  servicesAtProvider: ServiceOption[];
  servicesAtClient: ServiceOption[];
  addOns: AddOnOption[];
  highlights: string[];
  highlightsHe?: string[];
  verifiedBadges: string[];
  reviews: Review[];
  faqItems: FAQItem[];
  isVerified: boolean;
  isTopRated: boolean;
  language?: 'en' | 'he';
  onBook?: (serviceMode: ServiceMode, serviceId: string) => void;
  onMessage?: () => void;
  // Optional override for bookings this month — shown only if >= 3 (scarcity threshold)
  bookingsThisMonth?: number;
  joinedDate?: string;
}

// ─── Trust stats type (from /api/providers/stats/:userId) ────────────────────
interface ProviderStats {
  completedBookingsCount: number;
  repeatClientCount: number | null;
  responseRatePct: number | null;
  avgResponseTimeMinutes: number | null;
  responseTimeLabel: string | null;
  isNew: boolean;
  hasBackgroundCheck: boolean;
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
  isAvailableThisWeek: boolean;
  memberSince: string | null;
}

// ─── Platform config ──────────────────────────────────────────────────────────

const platformConfig = {
  sitter:  { title: 'Pet Sitter', titleHe: 'שמרטף חיות מחמד', providerLabel: 'Host', providerLabelHe: 'מארח', atProviderLabel: 'Pet stays at host home', atProviderLabelHe: 'חיית המחמד נשארת בבית המארח', atClientLabel: 'Host stays at your home', atClientLabelHe: 'המארח נשאר בבית שלך', color: '#00C569' },
  walker:  { title: 'Dog Walker', titleHe: 'מטייל כלבים',     providerLabel: 'Walker', providerLabelHe: 'מטייל', atProviderLabel: 'Group walk', atProviderLabelHe: 'טיול קבוצתי', atClientLabel: 'Private walk from your home', atClientLabelHe: 'טיול פרטי מהבית שלך', color: '#00C569' },
  driver:  { title: 'Pet Driver', titleHe: 'נהג חיות מחמד',   providerLabel: 'Driver', providerLabelHe: 'נהג', atProviderLabel: 'Standard transport', atProviderLabelHe: 'הסעה רגילה', atClientLabel: 'Premium door-to-door', atClientLabelHe: 'פרימיום מדלת לדלת', color: '#00C569' },
  groomer: { title: 'Pet Groomer', titleHe: 'מטפח חיות מחמד', providerLabel: 'Groomer', providerLabelHe: 'מטפח', atProviderLabel: 'At salon', atProviderLabelHe: 'בסלון', atClientLabel: 'Mobile grooming at your home', atClientLabelHe: 'טיפוח נייד בבית שלך', color: '#00C569' },
  trainer: { title: 'Dog Trainer', titleHe: 'מאלף כלבים',     providerLabel: 'Trainer', providerLabelHe: 'מאלף', atProviderLabel: 'At training facility', atProviderLabelHe: 'במתקן האימונים', atClientLabel: 'Private session at your home', atClientLabelHe: 'אימון פרטי בבית שלך', color: '#00C569' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProviderProfilePage(props: ProviderProfileProps) {
  const {
    platform, providerId, providerName, tagline, taglineHe, location,
    ratingAverage, reviewCount, yearsExperience,
    heroImageUrl, galleryImages, bio, bioHe, languages,
    acceptedPets, acceptedPetsHe, maxPetsPerBooking,
    servicesAtProvider, servicesAtClient, addOns,
    highlights, highlightsHe, verifiedBadges, reviews, faqItems,
    isVerified, isTopRated, language = 'en', onBook, onMessage,
    bookingsThisMonth, joinedDate,
  } = props;

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isHebrew = language === 'he';
  const config = platformConfig[platform];

  const [serviceMode, setServiceMode] = useState<ServiceMode>('providerLocation');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const activeServices = serviceMode === 'providerLocation' ? servicesAtProvider : servicesAtClient;
  const displayHighlights = isHebrew && highlightsHe ? highlightsHe : highlights;
  const displayBio = isHebrew && bioHe ? bioHe : bio;
  const displayTagline = isHebrew && taglineHe ? taglineHe : tagline;
  const displayAcceptedPets = isHebrew && acceptedPetsHe ? acceptedPetsHe : acceptedPets;

  // ── Real trust stats from backend ────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<ProviderStats>({
    queryKey: ['/api/providers/stats', providerId],
    enabled: !!providerId,
    staleTime: 5 * 60_000,
  });

  // Derive: show "Responds quickly" only when real data says ≥ 90%
  const quickResponder = (stats?.responseRatePct ?? null) !== null && (stats?.responseRatePct ?? 0) >= 90;
  // Show scarcity only when bookingsThisMonth is real and >= 3
  const showScarcity = (bookingsThisMonth ?? 0) >= 3;
  // Home setup section — only if at least one field is non-null
  const hasHomeSetup =
    stats?.hasFencedYard !== null ||
    stats?.hasNoPetsAtHome !== null ||
    stats?.hasBackgroundCheck;

  // ── Save/unsave ──────────────────────────────────────────────────────────
  // Load initial save state
  const { data: savedData } = useQuery<{ saved: { providerId: string }[] }>({
    queryKey: ['/api/saved-providers'],
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (savedData?.saved) {
      setIsSaved(savedData.saved.some(s => s.providerId === providerId));
    }
  }, [savedData, providerId]);

  const saveMutation = useMutation({
    mutationFn: async (saving: boolean) => {
      if (saving) {
        return apiRequest('POST', `/api/saved-providers/${providerId}`, { platform });
      } else {
        return apiRequest('DELETE', `/api/saved-providers/${providerId}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/saved-providers'] });
    },
    onError: () => {
      setIsSaved(s => !s); // rollback optimistic
      toast({ title: isHebrew ? 'שגיאה' : 'Error', variant: 'destructive' });
    },
  });

  const handleSaveToggle = () => {
    if (!user) {
      toast({ title: isHebrew ? 'נדרשת התחברות' : 'Sign in to save', variant: 'default' });
      return;
    }
    const saving = !isSaved;
    setIsSaved(saving); // optimistic
    saveMutation.mutate(saving);
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id],
    );
  };

  // ── Stat cards — only show real data ─────────────────────────────────────
  const statCards = [
    {
      icon: Star,
      label: isHebrew ? 'דירוג' : 'Rating',
      value: ratingAverage.toFixed(1),
      show: true,
    },
    {
      icon: Award,
      label: isHebrew ? 'הזמנות' : 'Bookings',
      value: stats ? String(stats.completedBookingsCount) : '—',
      show: true,
    },
    {
      icon: Clock,
      label: isHebrew ? 'תגובה' : 'Response',
      value: stats?.responseTimeLabel ?? '—',
      show: !!stats?.responseTimeLabel,
    },
    {
      icon: Users,
      label: isHebrew ? 'חוזרים' : 'Repeat',
      value: stats?.responseRatePct !== null ? `${stats?.responseRatePct}%` : null,
      show: stats?.responseRatePct !== null && stats?.responseRatePct !== undefined,
    },
    {
      icon: Shield,
      label: isHebrew ? 'ניסיון' : 'Experience',
      value: `${yearsExperience}+ ${isHebrew ? 'שנים' : 'yrs'}`,
      show: true,
    },
  ].filter(s => s.show);

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-gray-400 flex items-center gap-2">
          <span className="cursor-pointer hover:text-gray-600" onClick={() => navigate('/')}>PetWash™</span>
          <span>/</span>
          <span className="cursor-pointer hover:text-gray-600" onClick={() => navigate(`/${platform}-suite`)}>
            {isHebrew ? config.titleHe : config.title}
          </span>
          <span>/</span>
          <span className="text-gray-600">{location}</span>
        </nav>

        {/* Hero Gallery */}
        <section className="mb-10">
          <div className="grid grid-cols-4 gap-3 h-[360px] sm:h-[500px]">
            <div className="col-span-2 row-span-2 relative group overflow-hidden rounded-3xl">
              <img
                src={heroImageUrl}
                alt={providerName}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

              {/* New badge — only when stats confirm isNew = true */}
              {stats?.isNew && !statsLoading && (
                <div className="absolute top-6 left-6 flex items-center gap-1.5 bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                  <Sparkles className="w-4 h-4" />
                  {isHebrew ? 'חדש בפלטפורמה' : 'New to PetWash'}
                </div>
              )}
              {isVerified && (
                <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {isHebrew ? 'מאומת PetWash™' : 'PetWash™ Verified'}
                  </span>
                </div>
              )}
              {isTopRated && (
                <div className="absolute top-6 right-6 bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                  ⭐ {isHebrew ? 'מדורג גבוה' : 'Top Rated'}
                </div>
              )}
            </div>

            {galleryImages.slice(0, 4).map((img, idx) => (
              <div key={idx} className="relative group overflow-hidden rounded-2xl cursor-pointer bg-gray-100">
                <img
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-12">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-12">

            {/* Provider Header */}
            <header>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-4xl font-light tracking-tight text-gray-900 mb-2">{providerName}</h1>
                  <p className="text-lg text-gray-500 font-light">{displayTagline}</p>
                  {joinedDate && (
                    <p className="text-xs text-gray-400 mt-1">
                      {isHebrew ? `חבר מאז ${joinedDate}` : `Member since ${joinedDate}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSaveToggle}
                  aria-label={isSaved ? (isHebrew ? 'הסר מהשמורים' : 'Remove from saved') : (isHebrew ? 'שמור' : 'Save')}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-200 rounded-full hover:border-gray-300 transition-colors text-sm font-medium text-gray-700"
                >
                  <Heart className={`w-4 h-4 transition-colors ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}`} />
                  {isSaved ? (isHebrew ? 'נשמר' : 'Saved') : (isHebrew ? 'שמור' : 'Save')}
                </button>
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-4 mt-6 text-sm">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-current" />
                  <span className="font-semibold text-gray-900">{ratingAverage.toFixed(1)}</span>
                  <span className="text-gray-400">({reviewCount} {isHebrew ? 'ביקורות' : 'reviews'})</span>
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{location}</span>
                </div>
                {/* Completed bookings — real count from API */}
                {!statsLoading && stats && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Award className="w-4 h-4" />
                      <span>{stats.completedBookingsCount} {isHebrew ? 'הזמנות' : 'bookings'}</span>
                    </div>
                  </>
                )}
                {/* Responds quickly — only when real responseRatePct ≥ 90 */}
                {quickResponder && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                      <Zap className="w-3 h-3" />
                      {isHebrew ? 'מגיב מהר' : 'Responds quickly'}
                    </div>
                  </>
                )}
                {/* Repeat clients — only when real repeatClientCount > 0 */}
                {stats?.repeatClientCount !== null && (stats?.repeatClientCount ?? 0) > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold border border-violet-100">
                      <Users className="w-3 h-3" />
                      {stats!.repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
                    </div>
                  </>
                )}
                {/* Bookings this month — only when prop says >= 3 */}
                {showScarcity && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {isHebrew ? `הוזמן ${bookingsThisMonth} פעמים החודש` : `Booked ${bookingsThisMonth}× this month`}
                    </div>
                  </>
                )}
              </div>
            </header>

            {/* Quick Stats Cards — only real data */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {statCards.map((stat, idx) => (
                <div key={idx} className="bg-gray-50 rounded-2xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <stat.icon className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                  <div className="text-xl font-light text-gray-900">{stat.value}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
              {statsLoading && [1, 2].map(i => (
                <div key={i} className="bg-gray-50 rounded-2xl p-4 animate-pulse">
                  <div className="w-5 h-5 bg-gray-200 rounded-full mx-auto mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-12 mx-auto" />
                </div>
              ))}
            </section>

            {/* About */}
            <section>
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                {isHebrew ? `אודות ${config.providerLabelHe}` : `About this ${config.providerLabel}`}
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{displayBio}</p>

              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                <div className="border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{isHebrew ? 'ניסיון' : 'Experience'}</div>
                  <div className="font-medium text-gray-900">{yearsExperience}+ {isHebrew ? 'שנים' : 'years'}</div>
                  <div className="text-xs text-gray-500 mt-1">{isHebrew ? 'מקצועי ומנוסה' : 'Professional & experienced'}</div>
                </div>
                <div className="border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{isHebrew ? 'מקבל' : 'Accepts'}</div>
                  <div className="font-medium text-gray-900">{displayAcceptedPets}</div>
                  <div className="text-xs text-gray-500 mt-1">{isHebrew ? `עד ${maxPetsPerBooking} להזמנה` : `Up to ${maxPetsPerBooking} per booking`}</div>
                </div>
                <div className="border border-gray-100 rounded-2xl p-4">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{isHebrew ? 'שפות' : 'Languages'}</div>
                  <div className="font-medium text-gray-900">{languages.join(' · ')}</div>
                  {stats?.responseTimeLabel && (
                    <div className="text-xs text-gray-500 mt-1">
                      {isHebrew ? `מגיב תוך ${stats.responseTimeLabel}` : `Replies within ${stats.responseTimeLabel}`}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* About My Home — only shown when provider has filled in at least one field */}
            {hasHomeSetup && !statsLoading && (
              <section>
                <h2 className="text-xl font-medium text-gray-900 mb-4">
                  {isHebrew ? 'אודות הבית' : 'About my home'}
                </h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    {
                      key: 'hasFencedYard',
                      value: stats?.hasFencedYard,
                      trueLabel: isHebrew ? '✅ חצר מגודרת' : '✅ Fenced yard',
                      falseLabel: isHebrew ? 'אין חצר מגודרת' : 'No fenced yard',
                      icon: Home,
                    },
                    {
                      key: 'hasNoPetsAtHome',
                      value: stats?.hasNoPetsAtHome,
                      trueLabel: isHebrew ? '✅ ללא חיות בית' : '✅ No pets at home',
                      falseLabel: isHebrew ? 'יש חיות בית' : 'Has other pets',
                      icon: AlertCircle,
                    },
                    {
                      key: 'hasBackgroundCheck',
                      value: stats?.hasBackgroundCheck,
                      trueLabel: isHebrew ? '✅ עבר בדיקת רקע' : '✅ Background checked',
                      falseLabel: isHebrew ? 'לא בדיקת רקע' : 'No background check',
                      icon: Shield,
                    },
                  ].filter(({ value }) => value !== null && value !== undefined)
                  .map(({ key, value, trueLabel, falseLabel, icon: Icon }) => (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-4 rounded-2xl border ${
                        value ? 'border-emerald-100 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${value ? 'text-emerald-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {value ? trueLabel : falseLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Why Book — Highlights */}
            {displayHighlights.length > 0 && (
              <section>
                <h2 className="text-xl font-medium text-gray-900 mb-4">
                  {isHebrew ? 'למה להזמין' : 'Why book'}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {displayHighlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-emerald-50/50 rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-gray-700">{highlight}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {verifiedBadges.map((badge, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {badge}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Services & Pricing */}
            <section>
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                {isHebrew ? 'שירותים ומחירים' : 'Services & Pricing'}
              </h2>

              <div className="inline-flex p-1 bg-gray-100 rounded-full mb-6">
                <button
                  onClick={() => setServiceMode('providerLocation')}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    serviceMode === 'providerLocation' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {isHebrew ? config.atProviderLabelHe : config.atProviderLabel}
                </button>
                <button
                  onClick={() => setServiceMode('clientLocation')}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    serviceMode === 'clientLocation' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {isHebrew ? config.atClientLabelHe : config.atClientLabel}
                </button>
              </div>

              <div className="space-y-3">
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer group"
                    onClick={() => onBook?.(serviceMode, service.id)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {isHebrew && service.labelHe ? service.labelHe : service.label}
                      </div>
                      {service.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {isHebrew && service.descriptionHe ? service.descriptionHe : service.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{isHebrew ? 'מ-' : 'from'}</div>
                      <div className="text-xl font-light text-gray-900">₪{service.priceFrom}</div>
                      <div className="text-xs text-gray-500">
                        {isHebrew && service.priceUnitHe ? service.priceUnitHe : service.priceUnit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {addOns.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                    {isHebrew ? 'תוספות אופציונליות' : 'Optional Add-ons'}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          selectedAddOns.includes(addOn.id) ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAddOns.includes(addOn.id)}
                          onChange={() => toggleAddOn(addOn.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900">
                              {isHebrew && addOn.labelHe ? addOn.labelHe : addOn.label}
                            </span>
                            {addOn.priceFrom && <span className="text-sm text-gray-500">+₪{addOn.priceFrom}</span>}
                          </div>
                          {addOn.description && <p className="text-xs text-gray-500 mt-1">{addOn.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Reviews */}
            {reviews.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-medium text-gray-900">
                    {isHebrew ? 'ביקורות אורחים' : 'Guest Reviews'}
                  </h2>
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-100">
                    <Star className="w-4 h-4 text-amber-500 fill-current" />
                    <span className="font-semibold text-gray-900">{ratingAverage.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">({reviewCount})</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {(showAllReviews ? reviews : reviews.slice(0, 4)).map((review) => (
                    <article key={review.id} className="p-5 border border-gray-100 rounded-2xl hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
                            {review.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{review.name}</div>
                            <div className="text-xs text-gray-400">{review.date}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-xs font-semibold text-gray-800">{review.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-4">{review.text}</p>
                      {review.petType && <div className="mt-3 text-xs text-gray-400">🐾 {review.petType}</div>}
                    </article>
                  ))}
                </div>

                {reviews.length > 4 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4 text-gray-500 border border-gray-100 rounded-xl"
                    onClick={() => setShowAllReviews(!showAllReviews)}
                  >
                    {showAllReviews
                      ? <><ChevronUp className="w-4 h-4 mr-2" /> {isHebrew ? 'הצג פחות' : 'Show less'}</>
                      : <><ChevronDown className="w-4 h-4 mr-2" /> {isHebrew ? `הצג עוד ${reviews.length - 4} ביקורות` : `Show ${reviews.length - 4} more reviews`}</>
                    }
                  </Button>
                )}
              </section>
            )}

            {/* FAQ */}
            {faqItems.length > 0 && (
              <section>
                <h2 className="text-xl font-medium text-gray-900 mb-4">
                  {isHebrew ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
                </h2>
                <Accordion type="single" collapsible className="space-y-2">
                  {faqItems.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border border-gray-100 rounded-2xl px-5 data-[state=open]:border-gray-200"
                    >
                      <AccordionTrigger className="text-left text-gray-900 hover:no-underline py-4">
                        {isHebrew && faq.questionHe ? faq.questionHe : faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 pb-4">
                        {isHebrew && faq.answerHe ? faq.answerHe : faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}
          </div>

          {/* ── Desktop Right Column: Sticky Booking Widget ─────────────────── */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-8">
              <BookingWidget
                activeServices={activeServices}
                serviceMode={serviceMode}
                isTopRated={isTopRated}
                isVerified={isVerified}
                ratingAverage={ratingAverage}
                reviewCount={reviewCount}
                stats={stats}
                statsLoading={statsLoading}
                showScarcity={showScarcity}
                bookingsThisMonth={bookingsThisMonth}
                isHebrew={isHebrew}
                hasSidebar
                onBook={onBook}
                onMessage={onMessage}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile Fixed Bottom Bar: Booking CTA ────────────────────────────── */}
      {/* Sits above bottom nav (safe area), no overlap with footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 py-3 pb-safe shadow-2xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex-1">
            <div className="text-xs text-gray-400">{isHebrew ? 'מ-' : 'from'}</div>
            <div className="text-xl font-semibold text-gray-900">₪{activeServices[0]?.priceFrom || 0}</div>
          </div>
          {onMessage && (
            <Button
              variant="outline"
              size="sm"
              className="h-12 px-4 rounded-xl border-2 border-gray-200 shrink-0"
              onClick={onMessage}
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          )}
          <Button
            className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25"
            onClick={() => onBook?.(serviceMode, activeServices[0]?.id || '')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            {isHebrew ? 'בדוק זמינות' : 'Check Availability'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Widget (desktop sidebar) ────────────────────────────────────────

function BookingWidget({
  activeServices, serviceMode, isTopRated, isVerified,
  ratingAverage, reviewCount, stats, statsLoading, showScarcity,
  bookingsThisMonth, isHebrew, hasSidebar, onBook, onMessage,
}: {
  activeServices: ServiceOption[];
  serviceMode: ServiceMode;
  isTopRated: boolean;
  isVerified: boolean;
  ratingAverage: number;
  reviewCount: number;
  stats: ProviderStats | undefined;
  statsLoading: boolean;
  showScarcity: boolean;
  bookingsThisMonth?: number;
  isHebrew: boolean;
  hasSidebar?: boolean;
  onBook?: (mode: ServiceMode, serviceId: string) => void;
  onMessage?: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xl shadow-gray-100/50">
      {/* Price Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">{isHebrew ? 'מ-' : 'From'}</div>
          <div className="text-3xl font-light text-gray-900 mt-1">₪{activeServices[0]?.priceFrom || 0}</div>
          <div className="text-sm text-gray-500">{activeServices[0]?.priceUnit}</div>
        </div>
        {isTopRated && (
          <div className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full text-xs font-semibold text-black">
            ⭐ {isHebrew ? 'מומלץ' : 'Top Pick'}
          </div>
        )}
      </div>

      {/* Scarcity signal — only when real prop >= 3 */}
      {showScarcity && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl mb-4 border border-orange-100">
          <TrendingUp className="w-4 h-4 text-orange-500 shrink-0" />
          <p className="text-xs text-orange-700 font-medium">
            {isHebrew
              ? `הוזמן ${bookingsThisMonth} פעמים החודש — מבוקש מאוד!`
              : `Booked ${bookingsThisMonth}× this month — in high demand!`}
          </p>
        </div>
      )}

      {/* Quick Info */}
      <div className="space-y-3 mb-5 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3 text-sm">
          <Star className="w-4 h-4 text-amber-500 fill-current shrink-0" />
          <span className="text-gray-900 font-medium">{ratingAverage.toFixed(1)}</span>
          <span className="text-gray-400">· {reviewCount} {isHebrew ? 'ביקורות' : 'reviews'}</span>
        </div>
        {/* Response time — only when real data */}
        {stats?.responseTimeLabel && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-600">
              {isHebrew ? 'תגובה:' : 'Responds:'} <strong>{stats.responseTimeLabel}</strong>
            </span>
          </div>
        )}
        {/* Repeat clients — only when real count > 0 */}
        {stats?.repeatClientCount !== null && (stats?.repeatClientCount ?? 0) > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <Users className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-gray-600">
              {stats!.repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
            </span>
          </div>
        )}
        {isVerified && (
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-emerald-600 font-medium">
              {isHebrew ? 'מאומת PetWash™' : 'PetWash™ Verified'}
            </span>
          </div>
        )}
        {/* Response rate hidden if not known */}
        {stats?.responseRatePct === null && !statsLoading && (
          <p className="text-xs text-gray-400 italic">
            {isHebrew ? 'אחוז תגובה: לא מספיק נתונים עדיין' : 'Response rate: not enough data yet'}
          </p>
        )}
      </div>

      {/* CTA Buttons */}
      <div className="space-y-3">
        <Button
          className="w-full h-14 rounded-2xl text-base font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25"
          onClick={() => onBook?.(serviceMode, activeServices[0]?.id || '')}
        >
          <Calendar className="w-5 h-5 mr-2" />
          {isHebrew ? 'בדוק זמינות' : 'Check Availability'}
        </Button>
        {onMessage && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl text-sm border-2 border-gray-200 hover:border-gray-300"
            onClick={onMessage}
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            {isHebrew ? 'שלח הודעה' : 'Send Message'}
          </Button>
        )}
      </div>

      {/* Trust note */}
      <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
        {isHebrew
          ? '🔒 לא תחויב עכשיו. תשלום רק לאחר אישור ההזמנה.'
          : '🔒 You won\'t be charged yet. Payment only after booking confirmed.'}
      </p>
    </div>
  );
}

export default ProviderProfilePage;
