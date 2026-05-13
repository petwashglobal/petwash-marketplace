import { useState } from 'react';
import { Link } from 'wouter';
import { becomeProviderHref, setProviderSignupIntent } from '@/lib/becomeProvider';
import { 
  Search, MapPin, Calendar, 
  Home, Car, GraduationCap, Droplets,
  Shield, Clock, CreditCard, Star, Award, Phone,
  CheckCircle2, Heart, Camera, Map,
  ChevronRight, Users, ArrowRight, ArrowLeft, Footprints
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { LuxuryHeroSearch } from '@/components/marketplace/LuxuryHeroSearch';

type PetType = 'puppy' | 'dog' | 'cat' | 'other' | null;
type ServiceType = 'boarding' | 'sitting' | 'daycare' | 'walking' | 'transport' | 'training' | 'wash' | null;

const petTypes = [
  { id: 'puppy', label: 'Puppy', labelHe: 'גור', desc: 'Under 6 months', descHe: 'עד 6 חודשים', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop&crop=face' },
  { id: 'dog', label: 'Dog', labelHe: 'כלב', desc: 'Over 6 months', descHe: 'מעל 6 חודשים', image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&h=400&fit=crop&crop=face' },
  { id: 'cat', label: 'Cat', labelHe: 'חתול', desc: 'Including kittens', descHe: 'כולל גורי חתולים', image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop&crop=face' },
  { id: 'other', label: 'Other', labelHe: 'אחר', desc: 'Small animals', descHe: 'חיות קטנות', image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&h=400&fit=crop&crop=face' },
];

const services = [
  {
    id: 'boarding',
    icon: Home,
    name: 'Pet Boarding',
    nameHe: 'פנסיון לחיות מחמד',
    desc: 'Overnight care in a loving sitter\'s home',
    descHe: 'טיפול לילי בבית מארח אוהב',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=900&h=600&fit=crop',
    badge: 'THE SITTER SUITE™',
    accent: '#00C569',
  },
  {
    id: 'sitting',
    icon: Heart,
    name: 'House Sitting',
    nameHe: 'שמרטפות בבית',
    desc: 'Your sitter stays in your home with your pet',
    descHe: 'המטפל נשאר בביתך עם חיית המחמד',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&h=600&fit=crop',
    badge: 'THE SITTER SUITE™',
    accent: '#00C569',
  },
  {
    id: 'daycare',
    icon: Users,
    name: 'Doggy Daycare',
    nameHe: 'מעון יום לכלבים',
    desc: 'Daytime care while you work',
    descHe: 'טיפול יומי בזמן שאתה בעבודה',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900&h=600&fit=crop',
    badge: 'THE SITTER SUITE™',
    accent: '#00C569',
  },
  {
    id: 'walking',
    icon: Footprints,
    name: 'Dog Walking',
    nameHe: 'טיולי כלבים',
    desc: '30 or 60 minute walks with GPS tracking',
    descHe: 'טיולים של 30 או 60 דקות עם מעקב GPS',
    path: '/walk-my-pet',
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=900&h=600&fit=crop',
    badge: 'WALK MY PET™',
    accent: '#0099CC',
  },
  {
    id: 'transport',
    icon: Car,
    name: 'Pet Transport',
    nameHe: 'הסעות חיות מחמד',
    desc: 'Safe transportation anywhere you need',
    descHe: 'הסעה בטוחה לכל מקום שתצטרך',
    path: '/pettrek',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=900&h=600&fit=crop',
    badge: 'PETTREK™',
    accent: '#7C3AED',
  },
  {
    id: 'training',
    icon: GraduationCap,
    name: 'Dog Training',
    nameHe: 'אילוף כלבים',
    desc: 'Private training with certified trainers',
    descHe: 'אימון פרטי עם מאלפים מוסמכים',
    path: '/academy',
    image: 'https://images.unsplash.com/photo-1587764379873-97837921fd44?w=900&h=600&fit=crop',
    badge: 'PET WASH ACADEMY™',
    accent: '#D97706',
  },
  {
    id: 'wash',
    icon: Droplets,
    name: 'K9000™ Smart Hub',
    nameHe: 'K9000™ עמדה חכמה',
    desc: 'Outdoor DIY pet wash station 24/7',
    descHe: 'עמדת שטיפה חיצונית בשירות עצמי 24/7',
    path: '/k9000',
    image: 'https://images.unsplash.com/photo-1581888227599-779811939961?w=900&h=600&fit=crop',
    badge: 'K9000™',
    accent: '#00C569',
    isPhysical: true,
  },
];

const trustFeatures = [
  {
    icon: Shield,
    title: 'Background Verified',
    titleHe: 'אימות רקע',
    desc: 'Every provider passes enhanced background checks',
    descHe: 'כל נותן שירות עובר בדיקות רקע מורחבות',
    metric: '100%',
  },
  {
    // PR-LEGAL-B: previously '₪25,000 Guarantee' / 'Pet Wash Protect
    // covers your peace of mind' — replaced with a neutral verification
    // tile per §8 of the Provider & Host Services Agreement.
    icon: Award,
    title: 'Verified providers',
    titleHe: 'ספקים מאומתים',
    desc: 'Identity, documents and references checked',
    descHe: 'זהות, מסמכים והמלצות עברו בדיקה',
    metric: 'Covered',
  },
  {
    icon: Phone,
    title: '24/7 Support',
    titleHe: 'תמיכה 24/7',
    desc: 'Our team is always here when you need us',
    descHe: 'הצוות שלנו תמיד כאן כשאתה צריך אותנו',
    metric: '24/7',
  },
  {
    icon: Camera,
    title: 'Photo Updates',
    titleHe: 'עדכוני תמונות',
    desc: 'Receive photos during every service',
    descHe: 'קבל תמונות במהלך כל שירות',
    metric: 'Live',
  },
  {
    icon: Map,
    title: 'GPS Tracking',
    titleHe: 'מעקב GPS',
    desc: 'Track walks and transport in real-time',
    descHe: 'עקוב אחר טיולים והסעות בזמן אמת',
    metric: 'Real-time',
  },
  {
    icon: CreditCard,
    title: '72-Hour Escrow',
    titleHe: 'נאמנות 72 שעות',
    desc: 'Secure payments via Nayax Israel',
    descHe: 'תשלומים מאובטחים דרך Nayax ישראל',
    metric: 'Secure',
  },
];

const howItWorks = [
  {
    step: 1,
    title: 'Search & Compare',
    titleHe: 'חפש והשווה',
    desc: 'Browse verified providers with photos, reviews, and ratings',
    descHe: 'עיין בנותני שירות מאומתים עם תמונות, ביקורות ודירוגים',
    image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&h=560&fit=crop',
  },
  {
    step: 2,
    title: 'Meet & Greet',
    titleHe: 'פגישת היכרות',
    desc: 'Schedule a free meet & greet to find the perfect match',
    descHe: 'קבע פגישת היכרות חינם למציאת ההתאמה המושלמת',
    image: 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=800&h=560&fit=crop',
  },
  {
    step: 3,
    title: 'Book & Relax',
    titleHe: 'הזמן ותירגע',
    desc: 'Book securely and get updates with photos',
    descHe: 'הזמן בצורה מאובטחת וקבל עדכונים עם תמונות',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=560&fit=crop',
  },
];

const cities = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Herzliya', 'Ramat Gan', 'Netanya',
  'Beer Sheva', 'Ashdod', 'Rishon LeZion', 'Petah Tikva', 'Eilat', 'Kfar Saba',
];

const faqs = [
  {
    q: 'How do I book a pet sitter?',
    qHe: 'איך אני מזמין שמרטף לחיות מחמד?',
    a: 'Simply search for sitters in your area, compare profiles and reviews, schedule a free meet & greet, and book securely through our platform.',
    aHe: 'פשוט חפש שמרטפים באזורך, השווה פרופילים וביקורות, קבע פגישת היכרות חינם, והזמן בצורה מאובטחת דרך הפלטפורמה שלנו.',
  },
  {
    q: 'Are all providers background checked?',
    qHe: 'האם כל נותני השירות עברו בדיקת רקע?',
    a: 'Yes, every provider on Pet Wash undergoes enhanced background verification before they can offer services.',
    aHe: 'כן, כל נותן שירות ב-Pet Wash עובר אימות רקע מורחב לפני שהוא יכול להציע שירותים.',
  },
  {
    // PR-LEGAL-B: this FAQ entry previously described a "Pet Wash Protect"
    // ₪25,000 coverage program. That contradicted §8 of the Provider &
    // Host Services Agreement. Replaced with a §8-aligned safety FAQ
    // entry. No coverage claim, no monetary sum, no underwriter.
    q: 'What does Pet Wash do to keep bookings safe?',
    qHe: 'מה פט וואש עושה כדי לשמור על בטיחות ההזמנות?',
    a: 'Pet Wash operates a technology marketplace and verifies providers (identity, documents and references). Providers may be required to maintain their own insurance depending on the service type and applicable law. Pet Wash is not an insurance company, broker or adviser.',
    aHe: 'פט וואש מפעילה פלטפורמת טכנולוגיה ומאמתת ספקים (זהות, מסמכים והמלצות). ספקים עשויים להידרש להחזיק בביטוח מתאים בהתאם לסוג השירות והדין החל. פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח או יועצת ביטוח.',
  },
  {
    q: 'How does payment work?',
    qHe: 'איך עובד התשלום?',
    a: 'Payments are held in a secure 72-hour escrow via Nayax Israel, released only after successful service completion.',
    aHe: 'התשלומים מוחזקים בנאמנות מאובטחת של 72 שעות דרך Nayax ישראל, ומשוחררים רק לאחר השלמת השירות בהצלחה.',
  },
];

const serif = "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif";
const sans  = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export default function PlatformHub() {
  const [selectedPet, setSelectedPet] = useState<PetType>(null);
  const [selectedService, setSelectedService] = useState<ServiceType>(null);
  const [location, setLocation] = useState('');
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <Layout>
      <div className="min-h-screen bg-white">

        {/* ── HERO ── */}
        <section className="relative bg-white pt-20 pb-28 overflow-hidden">
          {/* Barely-visible metallic mesh background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,197,105,0.04) 0%, transparent 70%)',
          }} />

          <div className="max-w-7xl mx-auto px-6 relative">

            {/* Micro label */}
            <div className="flex justify-center mb-10">
              <span
                className="text-[10px] font-light tracking-[6px] uppercase"
                style={{
                  fontFamily: sans,
                  background: 'linear-gradient(90deg,#9CA3AF 0%,#6B7280 40%,#9CA3AF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Est. 2025 · Israel
              </span>
            </div>

            {/* Main Headline */}
            <div className="text-center max-w-5xl mx-auto">
              <h1
                className="text-6xl md:text-7xl lg:text-8xl font-light text-[#0A0A0A] tracking-tight mb-5 leading-none"
                style={{ fontFamily: serif }}
              >
                {isHebrew ? 'טיפול מושלם' : 'Trusted Pet Care'}
              </h1>

              {/* Metallic divider */}
              <div className="flex justify-center my-9">
                <div className="w-24 h-[1.5px]" style={{
                  background: 'linear-gradient(90deg, transparent 0%, #C6A664 30%, #E8D5A0 50%, #C6A664 70%, transparent 100%)',
                }} />
              </div>

              <p
                className="text-base font-light tracking-[5px] uppercase"
                style={{
                  fontFamily: sans,
                  color: '#9CA3AF',
                  letterSpacing: '0.35em',
                }}
              >
                {isHebrew ? 'שבע פלטפורמות יוקרה' : 'Seven Luxury Platforms'}
              </p>
            </div>
          </div>
        </section>

        {/* ── HERO SEARCH ── */}
        <section className="bg-white py-14 px-6">
          <LuxuryHeroSearch variant="hero" showTitle={true} className="" />
        </section>

        {/* ── PET TYPE SELECTOR ── */}
        <section className="bg-white py-24">
          <div className="max-w-6xl mx-auto px-6">

            <div className="text-center mb-16">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4" style={{ fontFamily: sans, color: '#00C569' }}>
                {isHebrew ? 'בחר סוג חיית מחמד' : 'Select Your Pet'}
              </p>
              <h2 className="text-4xl font-light text-[#0A0A0A]" style={{ fontFamily: serif }}>
                {isHebrew ? 'מי החבר שלך?' : 'Who Is Your Companion?'}
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {petTypes.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(pet.id as PetType)}
                  data-testid={`pet-type-${pet.id}`}
                  className="group relative overflow-hidden transition-all duration-500 focus:outline-none"
                  style={{
                    boxShadow: selectedPet === pet.id
                      ? '0 0 0 2px #C6A664, 0 20px 60px rgba(0,0,0,0.18)'
                      : '0 4px 24px rgba(0,0,0,0.08)',
                    transform: selectedPet === pet.id ? 'translateY(-4px)' : 'translateY(0)',
                  }}
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={pet.image}
                      alt={isHebrew ? pet.labelHe : pet.label}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-107"
                      style={{ transform: selectedPet === pet.id ? 'scale(1.04)' : undefined }}
                    />
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-white text-lg font-light tracking-wide" style={{ fontFamily: serif }}>
                      {isHebrew ? pet.labelHe : pet.label}
                    </h3>
                    <p className="text-white/60 text-xs font-light mt-0.5">{isHebrew ? pet.descHe : pet.desc}</p>
                  </div>

                  {/* Selected metallic check */}
                  {selectedPet === pet.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{
                        background: 'linear-gradient(135deg,#C6A664 0%,#E8D5A0 50%,#C6A664 100%)',
                      }}>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── SERVICES GRID ── */}
        <section className="bg-white py-28">
          <div className="max-w-7xl mx-auto px-6">

            <div className="text-center mb-20">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4" style={{ fontFamily: sans, color: '#00C569' }}>
                {isHebrew ? 'הקולקציה' : 'The Collection'}
              </p>
              <h2 className="text-5xl font-light text-[#0A0A0A]" style={{ fontFamily: serif }}>
                {isHebrew ? 'שבע פלטפורמות' : 'Seven Platforms'}
              </h2>
              {/* Metallic rule */}
              <div className="flex justify-center mt-8">
                <div className="w-16 h-[1px]" style={{
                  background: 'linear-gradient(90deg, transparent, #C6A664 40%, #E8D5A0 50%, #C6A664 60%, transparent)',
                }} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-[#F0F0F0]">
              {services.map((service, index) => (
                <Link
                  key={service.id}
                  href={service.path}
                  data-testid={`service-card-${service.id}`}
                  className="group block border-b border-r border-[#F0F0F0] relative overflow-hidden bg-white"
                  style={{ transition: 'box-shadow 0.4s cubic-bezier(0.22,1,0.36,1)' }}
                >
                  {/* Full-bleed image — no frame, no rounded corners */}
                  <div className="relative overflow-hidden" style={{ paddingBottom: '66.66%' }}>
                    <img
                      src={service.image}
                      alt={isHebrew ? service.nameHe : service.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Cinematic overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                    {/* Platform badge — metallic treatment */}
                    <div className="absolute top-5 left-5">
                      <span
                        className="inline-block px-3 py-1.5 text-[9px] font-light tracking-[2.5px] uppercase"
                        style={{
                          fontFamily: sans,
                          background: 'rgba(255,255,255,0.92)',
                          backdropFilter: 'blur(8px)',
                          color: service.accent,
                          letterSpacing: '0.18em',
                        }}
                      >
                        {service.badge}
                      </span>
                    </div>

                    {/* Physical station tag */}
                    {service.isPhysical && (
                      <div className="absolute top-5 right-5">
                        <span
                          className="inline-block px-3 py-1.5 text-[9px] font-light tracking-[2px] uppercase text-white"
                          style={{
                            background: 'linear-gradient(135deg,#00C569 0%,#00E87A 50%,#00C569 100%)',
                            letterSpacing: '0.15em',
                          }}
                        >
                          24/7
                        </span>
                      </div>
                    )}

                    {/* Index number */}
                    <div className="absolute bottom-5 right-5">
                      <span
                        className="text-white/25 text-6xl font-light select-none"
                        style={{ fontFamily: serif }}
                      >
                        0{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Content — pure white, no border */}
                  <div
                    className="p-8 bg-white transition-all duration-400"
                    style={{ transition: 'background 0.4s' }}
                  >
                    {/* Metallic accent line */}
                    <div className="w-8 h-[1.5px] mb-5" style={{
                      background: `linear-gradient(90deg,${service.accent},transparent)`,
                    }} />

                    <h3
                      className="text-xl font-light text-[#0A0A0A] tracking-wide mb-3 group-hover:text-[#0A0A0A] transition-colors"
                      style={{ fontFamily: serif }}
                    >
                      {isHebrew ? service.nameHe : service.name}
                    </h3>

                    <p className="text-sm font-light text-[#6B7280] leading-relaxed mb-6" style={{ fontFamily: sans }}>
                      {isHebrew ? service.descHe : service.desc}
                    </p>

                    <div
                      className="inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase transition-all duration-300 group-hover:gap-3"
                      style={{ color: service.accent, fontFamily: sans }}
                    >
                      <span>{isHebrew ? 'לחץ לפרטים' : 'Book Now'}</span>
                      {isHebrew
                        ? <ArrowLeft className="w-3.5 h-3.5" />
                        : <ArrowRight className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Hover lift overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{ boxShadow: 'inset 0 0 0 1.5px rgba(198,166,100,0.25)' }}
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── SEARCH WIDGET ── */}
        <section className="bg-white py-20">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-light text-[#0A0A0A] tracking-wide" style={{ fontFamily: serif }}>
                {isHebrew ? 'מצא שירות באזורך' : 'Find Services Near You'}
              </h2>
            </div>

            <div className="flex flex-col md:flex-row gap-0 overflow-hidden" style={{
              boxShadow: '0 2px 40px rgba(0,0,0,0.07)',
            }}>
              <div className="flex-1 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  placeholder={isHebrew ? 'הכנס מיקום' : 'Enter location'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-11 h-14 border-0 border-r border-[#F0F0F0] focus:ring-0 focus-visible:ring-0 rounded-none text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF]"
                  data-testid="location-input"
                />
              </div>
              <Button
                className="h-14 px-10 rounded-none text-white text-sm font-medium tracking-widest uppercase min-w-[120px]"
                style={{
                  background: 'linear-gradient(135deg,#00C569 0%,#00A855 50%,#00C569 100%)',
                  fontFamily: sans,
                }}
                data-testid="search-button"
              >
                <Search className="w-4 h-4 mr-2" />
                {isHebrew ? 'חפש' : 'Search'}
              </Button>
            </div>
          </div>
        </section>

        {/* ── TRUST FEATURES ── */}
        <section className="bg-white py-28">
          <div className="max-w-6xl mx-auto px-6">

            {/* PR-LEGAL-B: replaced the "PET WASH PROTECT™" eyebrow with
                a neutral safety-information label per §8 of the Provider
                & Host Services Agreement. */}
            <div className="text-center mb-20">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4" style={{ fontFamily: sans, color: '#C6A664' }}>
                {isHebrew ? 'מידע בטיחות' : 'SAFETY INFORMATION'}
              </p>
              <h2 className="text-4xl font-light text-[#0A0A0A]" style={{ fontFamily: serif }}>
                {isHebrew ? 'אמון ובטיחות' : 'Trust & Safety'}
              </h2>
            </div>

            {/* Open grid — no borders, pure white, Apple-style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
              {trustFeatures.map((feature, index) => (
                <div key={index} className="group" data-testid={`trust-feature-${index}`}>
                  {/* Metallic metric */}
                  <div
                    className="text-4xl font-light mb-4"
                    style={{
                      fontFamily: serif,
                      background: 'linear-gradient(135deg,#00C569 0%,#00E87A 50%,#00C569 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {feature.metric}
                  </div>

                  {/* Icon + thin rule */}
                  <div className="flex items-center gap-3 mb-4">
                    <feature.icon className="w-5 h-5 text-[#00C569]" strokeWidth={1.5} />
                    <div className="h-px flex-1 bg-gradient-to-r from-[#00C569]/30 to-transparent" />
                  </div>

                  <h3
                    className="text-lg font-light text-[#0A0A0A] mb-2"
                    style={{ fontFamily: serif }}
                  >
                    {isHebrew ? feature.titleHe : feature.title}
                  </h3>
                  <p className="text-sm font-light text-[#6B7280] leading-relaxed" style={{ fontFamily: sans }}>
                    {isHebrew ? feature.descHe : feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="bg-white py-28">
          <div className="max-w-6xl mx-auto px-6">

            <div className="text-center mb-20">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4" style={{ fontFamily: sans, color: '#00C569' }}>
                {isHebrew ? 'התהליך' : 'The Process'}
              </p>
              <h2 className="text-4xl font-light text-[#0A0A0A]" style={{ fontFamily: serif }}>
                {isHebrew ? 'שלושה צעדים פשוטים' : 'Three Simple Steps'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {howItWorks.map((step) => (
                <div key={step.step} className="group" data-testid={`how-it-works-step-${step.step}`}>

                  {/* Image — no border, no frame, clean drop-shadow */}
                  <div
                    className="relative overflow-hidden mb-8"
                    style={{
                      aspectRatio: '4/3',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.10)',
                    }}
                  >
                    <img
                      src={step.image}
                      alt={isHebrew ? step.titleHe : step.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-104"
                    />
                    {/* Barely visible overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/05 transition-all duration-500" />
                  </div>

                  {/* Step number — metallic */}
                  <div
                    className="text-5xl font-light mb-4"
                    style={{
                      fontFamily: serif,
                      background: 'linear-gradient(135deg,#C6A664 0%,#E8D5A0 50%,#B8924A 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    0{step.step}
                  </div>

                  <h3 className="text-xl font-light text-[#0A0A0A] mb-3" style={{ fontFamily: serif }}>
                    {isHebrew ? step.titleHe : step.title}
                  </h3>
                  <p className="text-sm font-light text-[#6B7280] leading-relaxed" style={{ fontFamily: sans }}>
                    {isHebrew ? step.descHe : step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CITIES ── */}
        <section className="bg-white py-20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-light text-[#0A0A0A] tracking-wide" style={{ fontFamily: serif }}>
                {isHebrew ? 'ערים שאנחנו משרתים' : 'Cities We Serve'}
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {cities.map((city) => (
                <span
                  key={city}
                  className="px-6 py-2.5 text-[11px] font-light tracking-[2.5px] uppercase text-[#4B5563] hover:text-[#00C569] transition-colors duration-200 cursor-pointer relative group"
                  style={{ fontFamily: sans, letterSpacing: '0.18em' }}
                  data-testid={`city-${city.toLowerCase().replace(' ', '-')}`}
                >
                  {city}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] group-hover:w-full transition-all duration-300 bg-[#00C569]" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-24">
          <div className="max-w-3xl mx-auto px-6">

            <div className="text-center mb-16">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4" style={{ fontFamily: sans, color: '#9CA3AF' }}>
                FAQ
              </p>
              <h2 className="text-4xl font-light text-[#0A0A0A]" style={{ fontFamily: serif }}>
                {isHebrew ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-0">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="border-t border-[#F0F0F0] last:border-b"
                  data-testid={`faq-item-${index}`}
                >
                  <AccordionTrigger
                    className="text-left font-light text-[#0A0A0A] hover:text-[#00C569] py-7 text-base transition-colors"
                    style={{ fontFamily: sans }}
                  >
                    {isHebrew ? faq.qHe : faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#6B7280] font-light leading-relaxed pb-7 text-sm" style={{ fontFamily: sans }}>
                    {isHebrew ? faq.aHe : faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-white py-32">
          <div className="max-w-3xl mx-auto px-6 text-center">

            {/* Metallic top rule */}
            <div className="flex justify-center mb-10">
              <div className="w-20 h-[1px]" style={{
                background: 'linear-gradient(90deg,transparent,#C6A664 30%,#E8D5A0 50%,#C6A664 70%,transparent)',
              }} />
            </div>

            <h2 className="text-5xl font-light text-[#0A0A0A] tracking-wide mb-6 leading-tight" style={{ fontFamily: serif }}>
              {isHebrew ? 'מוכן להתחיל?' : 'Ready to Begin?'}
            </h2>

            <p className="text-base font-light text-[#6B7280] mb-12 tracking-wide" style={{ fontFamily: sans }}>
              {isHebrew
                ? 'הצטרף לאלפי בעלי חיות מחמד מרוצים בכל הארץ'
                : 'Join thousands of happy pet owners across Israel'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="h-14 px-12 rounded-none text-white text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg,#00C569 0%,#00A855 50%,#00C569 100%)',
                  fontFamily: sans,
                  boxShadow: '0 8px 32px rgba(0,197,105,0.30)',
                }}
                data-testid="cta-find-provider"
              >
                {isHebrew ? 'מצא נותן שירות' : 'Find a Provider'}
              </Button>
              {/* PR-FRES-3: dead Become Provider button now wired through
                  the canonical becomeProvider helper so the provider intent
                  is set BEFORE navigation and post-login routes correctly. */}
              <Link href={becomeProviderHref()} onClick={setProviderSignupIntent}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-12 rounded-none text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:bg-[#0A0A0A] hover:text-white hover:border-[#0A0A0A]"
                  style={{
                    borderColor: '#D1D5DB',
                    color: '#374151',
                    fontFamily: sans,
                  }}
                  data-testid="cta-become-provider"
                >
                  {isHebrew ? 'הפוך לנותן שירות' : 'Become a Provider'}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER BRAND ── */}
        <section className="bg-white py-16 border-t border-[#F0F0F0]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h3
              className="text-2xl font-light tracking-[6px] mb-4"
              style={{
                fontFamily: serif,
                background: 'linear-gradient(135deg,#9CA3AF 0%,#D1D5DB 40%,#9CA3AF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              PET WASH™
            </h3>
            <p className="text-[10px] font-light tracking-[4px] uppercase text-[#9CA3AF]" style={{ fontFamily: sans }}>
              Premium Organic Pet Care Ecosystem
            </p>
            <div className="flex justify-center mt-8 mb-8">
              <div className="w-12 h-[1px]" style={{
                background: 'linear-gradient(90deg,transparent,#C6A664,transparent)',
              }} />
            </div>
            <p className="text-[10px] font-light text-[#D1D5DB] tracking-wider" style={{ fontFamily: sans }}>
              © 2026 Pet Wash™ · Israel
            </p>
          </div>
        </section>

      </div>
    </Layout>
  );
}
