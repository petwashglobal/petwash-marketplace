import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, MapPin, Shield, Clock, Award, ChevronDown, ChevronUp, Check, Calendar, MessageCircle, Heart, Zap, Users, Home, AlertCircle, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
  completedBookings: number;
  yearsExperience: number;
  responseTime: string;
  responseTimeHe?: string;
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
  // — new competitive fields —
  repeatClientCount?: number;
  responseRate?: number;
  isNew?: boolean;
  hasFencedYard?: boolean;
  hasNoPetsAtHome?: boolean;
  hasBackgroundCheck?: boolean;
  bookingsThisMonth?: number;
  joinedDate?: string;
}

const platformConfig = {
  sitter: {
    title: 'Pet Sitter', titleHe: 'שמרטף חיות מחמד',
    providerLabel: 'Host', providerLabelHe: 'מארח',
    atProviderLabel: 'Pet stays at host home', atProviderLabelHe: 'חיית המחמד נשארת בבית המארח',
    atClientLabel: 'Host stays at your home', atClientLabelHe: 'המארח נשאר בבית שלך',
    color: '#00C569',
  },
  walker: {
    title: 'Dog Walker', titleHe: 'מטייל כלבים',
    providerLabel: 'Walker', providerLabelHe: 'מטייל',
    atProviderLabel: 'Group walk', atProviderLabelHe: 'טיול קבוצתי',
    atClientLabel: 'Private walk from your home', atClientLabelHe: 'טיול פרטי מהבית שלך',
    color: '#00C569',
  },
  driver: {
    title: 'Pet Driver', titleHe: 'נהג חיות מחמד',
    providerLabel: 'Driver', providerLabelHe: 'נהג',
    atProviderLabel: 'Standard transport', atProviderLabelHe: 'הסעה רגילה',
    atClientLabel: 'Premium door-to-door', atClientLabelHe: 'פרימיום מדלת לדלת',
    color: '#00C569',
  },
  groomer: {
    title: 'Pet Groomer', titleHe: 'מטפח חיות מחמד',
    providerLabel: 'Groomer', providerLabelHe: 'מטפח',
    atProviderLabel: 'At salon', atProviderLabelHe: 'בסלון',
    atClientLabel: 'Mobile grooming at your home', atClientLabelHe: 'טיפוח נייד בבית שלך',
    color: '#00C569',
  },
  trainer: {
    title: 'Dog Trainer', titleHe: 'מאלף כלבים',
    providerLabel: 'Trainer', providerLabelHe: 'מאלף',
    atProviderLabel: 'At training facility', atProviderLabelHe: 'במתקן האימונים',
    atClientLabel: 'Private session at your home', atClientLabelHe: 'אימון פרטי בבית שלך',
    color: '#00C569',
  },
};

export function ProviderProfilePage(props: ProviderProfileProps) {
  const {
    platform, providerName, tagline, taglineHe, location,
    ratingAverage, reviewCount, completedBookings, yearsExperience,
    responseTime, responseTimeHe, heroImageUrl, galleryImages,
    bio, bioHe, languages, acceptedPets, acceptedPetsHe, maxPetsPerBooking,
    servicesAtProvider, servicesAtClient, addOns, highlights, highlightsHe,
    verifiedBadges, reviews, faqItems, isVerified, isTopRated,
    language = 'en', onBook, onMessage,
    repeatClientCount = 0, responseRate, isNew = false,
    hasFencedYard, hasNoPetsAtHome, hasBackgroundCheck,
    bookingsThisMonth, joinedDate,
  } = props;

  const [, navigate] = useLocation();
  const [serviceMode, setServiceMode] = useState<ServiceMode>('providerLocation');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isHebrew = language === 'he';
  const config = platformConfig[platform];
  const activeServices = serviceMode === 'providerLocation' ? servicesAtProvider : servicesAtClient;
  const displayHighlights = isHebrew && highlightsHe ? highlightsHe : highlights;
  const displayBio = isHebrew && bioHe ? bioHe : bio;
  const displayTagline = isHebrew && taglineHe ? taglineHe : tagline;
  const displayAcceptedPets = isHebrew && acceptedPetsHe ? acceptedPetsHe : acceptedPets;
  const displayResponseTime = isHebrew && responseTimeHe ? responseTimeHe : responseTime;
  const quickResponder = (responseRate ?? 0) >= 90;

  const toggleAddOn = (id: string) => {
    setSelectedAddOns(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const hasHomeSetup = hasFencedYard !== undefined || hasNoPetsAtHome !== undefined || hasBackgroundCheck !== undefined;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-gray-400 flex items-center gap-2">
          <span className="cursor-pointer hover:text-gray-600" onClick={() => navigate('/')}>⁦PetWash™⁩</span>
          <span>/</span>
          <span className="cursor-pointer hover:text-gray-600" onClick={() => navigate(`/${platform}-suite`)}>
            {isHebrew ? config.titleHe : config.title}
          </span>
          <span>/</span>
          <span className="text-gray-600">{location}</span>
        </nav>

        {/* Hero Gallery */}
        <section className="mb-10">
          <div className="grid grid-cols-4 gap-3 h-[500px]">
            <div className="col-span-2 row-span-2 relative group overflow-hidden rounded-3xl">
              <img
                src={heroImageUrl}
                alt={providerName}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

              {/* "New" badge — Airbnb-style */}
              {isNew && (
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
                    {isHebrew ? 'מאומת ⁦PetWash™⁩' : '⁦PetWash™⁩ Verified'}
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
              <div key={idx} className="relative group overflow-hidden rounded-2xl cursor-pointer">
                <img
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
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
                  onClick={() => setIsSaved(s => !s)}
                  aria-label={isSaved ? 'Remove from saved' : 'Save'}
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
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Award className="w-4 h-4" />
                  <span>{completedBookings} {isHebrew ? 'הזמנות' : 'bookings'}</span>
                </div>
                {/* "Responds quickly" chip — Rover micro-UX */}
                {quickResponder && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                      <Zap className="w-3 h-3" />
                      {isHebrew ? 'מגיב מהר' : 'Responds quickly'}
                    </div>
                  </>
                )}
                {/* Repeat clients — Rover star sitter signal */}
                {repeatClientCount > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold border border-violet-100">
                      <Users className="w-3 h-3" />
                      {repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
                    </div>
                  </>
                )}
                {/* Bookings this month — scarcity / social proof */}
                {(bookingsThisMonth ?? 0) > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {isHebrew
                        ? `הוזמן ${bookingsThisMonth} פעמים החודש`
                        : `Booked ${bookingsThisMonth}× this month`}
                    </div>
                  </>
                )}
              </div>
            </header>

            {/* Quick Stats Cards — now 5 cards including response rate */}
            <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Star,    label: isHebrew ? 'דירוג' : 'Rating',    value: ratingAverage.toFixed(1) },
                { icon: Award,   label: isHebrew ? 'ניסיון' : 'Experience', value: `${yearsExperience}+ ${isHebrew ? 'שנים' : 'yrs'}` },
                { icon: Clock,   label: isHebrew ? 'תגובה' : 'Response',  value: displayResponseTime },
                { icon: Shield,  label: isHebrew ? 'הזמנות' : 'Bookings', value: completedBookings.toString() },
                { icon: Users,   label: isHebrew ? 'חוזרים' : 'Repeat',   value: responseRate ? `${responseRate}%` : `${repeatClientCount}` },
              ].map((stat, idx) => (
                <div key={idx} className="bg-gray-50 rounded-2xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <stat.icon className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                  <div className="text-xl font-light text-gray-900">{stat.value}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{stat.label}</div>
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
                  <div className="text-xs text-gray-500 mt-1">{displayResponseTime}</div>
                </div>
              </div>
            </section>

            {/* Home Setup — Rover "About my home" section */}
            {hasHomeSetup && (
              <section>
                <h2 className="text-xl font-medium text-gray-900 mb-4">
                  {isHebrew ? 'אודות הבית' : 'About my home'}
                </h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { key: 'hasFencedYard', value: hasFencedYard, trueLabel: isHebrew ? '✅ חצר מגודרת' : '✅ Fenced yard', falseLabel: isHebrew ? 'אין חצר מגודרת' : 'No fenced yard', icon: Home },
                    { key: 'hasNoPetsAtHome', value: hasNoPetsAtHome, trueLabel: isHebrew ? '✅ ללא חיות בית' : '✅ No pets at home', falseLabel: isHebrew ? 'יש חיות בית' : 'Has other pets', icon: AlertCircle },
                    { key: 'hasBackgroundCheck', value: hasBackgroundCheck, trueLabel: isHebrew ? '✅ עבר בדיקת רקע' : '✅ Background checked', falseLabel: isHebrew ? 'לא בדיקת רקע' : 'No background check', icon: Shield },
                  ].filter(({ value }) => value !== undefined).map(({ key, value, trueLabel, falseLabel, icon: Icon }) => (
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
                            {addOn.priceFrom && (
                              <span className="text-sm text-gray-500">+₪{addOn.priceFrom}</span>
                            )}
                          </div>
                          {addOn.description && (
                            <p className="text-xs text-gray-500 mt-1">{addOn.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Reviews */}
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
                    {review.petType && (
                      <div className="mt-3 text-xs text-gray-400">🐾 {review.petType}</div>
                    )}
                  </article>
                ))}
              </div>

              {reviews.length > 4 && (
                <Button
                  variant="ghost"
                  className="w-full mt-4 text-gray-500 border border-gray-100 rounded-xl"
                  onClick={() => setShowAllReviews(!showAllReviews)}
                >
                  {showAllReviews ? (
                    <><ChevronUp className="w-4 h-4 mr-2" /> {isHebrew ? 'הצג פחות' : 'Show less'}</>
                  ) : (
                    <><ChevronDown className="w-4 h-4 mr-2" /> {isHebrew ? `הצג עוד ${reviews.length - 4} ביקורות` : `Show ${reviews.length - 4} more reviews`}</>
                  )}
                </Button>
              )}
            </section>

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

          {/* Right Column — Sticky Booking Widget (Airbnb-style) */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8">
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

                {/* Scarcity signal */}
                {(bookingsThisMonth ?? 0) >= 3 && (
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
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-600">{isHebrew ? 'תגובה:' : 'Responds:'} <strong>{displayResponseTime}</strong></span>
                  </div>
                  {repeatClientCount > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-gray-600">
                        {repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
                      </span>
                    </div>
                  )}
                  {isVerified && (
                    <div className="flex items-center gap-3 text-sm">
                      <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-emerald-600 font-medium">
                        {isHebrew ? 'מאומת ⁦PetWash™⁩' : '⁦PetWash™⁩ Verified'}
                      </span>
                    </div>
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
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-2xl text-sm border-2 border-gray-200 hover:border-gray-300"
                    onClick={onMessage}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {isHebrew ? 'שלח הודעה' : 'Send Message'}
                  </Button>
                </div>

                {/* Trust Note */}
                <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
                  {isHebrew
                    ? '🔒 לא תחויב עכשיו. תשלום רק לאחר אישור ההזמנה.'
                    : '🔒 You won\'t be charged yet. Payment only after booking confirmed.'}
                </p>
              </div>

              {/* Home Setup Summary (below sticky card) */}
              {hasHomeSetup && (
                <div className="mt-4 p-4 border border-gray-100 rounded-2xl bg-gray-50/50 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {isHebrew ? 'פרטי הבית' : 'Home details'}
                  </p>
                  {hasFencedYard !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{hasFencedYard ? '✅' : '❌'}</span>
                      <span>{isHebrew ? 'חצר מגודרת' : 'Fenced yard'}</span>
                    </div>
                  )}
                  {hasNoPetsAtHome !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{hasNoPetsAtHome ? '✅' : '❌'}</span>
                      <span>{isHebrew ? 'ללא חיות אחרות' : 'No other pets'}</span>
                    </div>
                  )}
                  {hasBackgroundCheck !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{hasBackgroundCheck ? '✅' : '❌'}</span>
                      <span>{isHebrew ? 'עבר בדיקת רקע' : 'Background checked'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ProviderProfilePage;
