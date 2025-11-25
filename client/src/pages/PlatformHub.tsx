import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Search, MapPin, Calendar, Dog, Cat, Rabbit, 
  Home, Car, Scissors, GraduationCap, Droplets,
  Shield, Clock, CreditCard, Star, Award, Phone,
  CheckCircle2, Heart, Camera, Map, MessageCircle,
  Sparkles, ChevronRight, Play, Users, Globe,
  BadgeCheck, Smartphone, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';

type PetType = 'puppy' | 'dog' | 'cat' | 'other' | null;
type ServiceType = 'boarding' | 'sitting' | 'daycare' | 'walking' | 'transport' | 'grooming' | 'training' | 'wash' | null;

const petTypes = [
  { id: 'puppy', icon: '🐕', label: 'Puppy', labelHe: 'גור', desc: 'Under 6 months', descHe: 'עד 6 חודשים' },
  { id: 'dog', icon: '🐕‍🦺', label: 'Dog', labelHe: 'כלב', desc: 'Over 6 months', descHe: 'מעל 6 חודשים' },
  { id: 'cat', icon: '🐱', label: 'Cat', labelHe: 'חתול', desc: 'Including kittens', descHe: 'כולל גורי חתולים' },
  { id: 'other', icon: '🐰', label: 'Other', labelHe: 'אחר', desc: 'Small animals', descHe: 'חיות קטנות' },
];

const services = [
  {
    id: 'boarding',
    icon: Home,
    color: 'from-pink-500 to-rose-600',
    name: 'Pet Boarding',
    nameHe: 'פנסיון לחיות מחמד',
    desc: 'Overnight care in a loving sitter\'s home',
    descHe: 'טיפול לילי בבית מארח אוהב',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop',
  },
  {
    id: 'sitting',
    icon: Heart,
    color: 'from-purple-500 to-violet-600',
    name: 'House Sitting',
    nameHe: 'שמרטפות בבית',
    desc: 'Your sitter stays in your home with your pet',
    descHe: 'המטפל נשאר בביתך עם חיית המחמד',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
  },
  {
    id: 'daycare',
    icon: Users,
    color: 'from-orange-500 to-amber-600',
    name: 'Doggy Daycare',
    nameHe: 'מעון יום לכלבים',
    desc: 'Daytime care while you work',
    descHe: 'טיפול יומי בזמן שאתה בעבודה',
    path: '/sitter-suite',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop',
  },
  {
    id: 'walking',
    icon: Dog,
    color: 'from-blue-500 to-cyan-600',
    name: 'Dog Walking',
    nameHe: 'טיולי כלבים',
    desc: '30 or 60 minute walks with GPS tracking',
    descHe: 'טיולים של 30 או 60 דקות עם מעקב GPS',
    path: '/walk-my-pet',
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400&h=300&fit=crop',
  },
  {
    id: 'transport',
    icon: Car,
    color: 'from-indigo-500 to-blue-600',
    name: 'Pet Transport',
    nameHe: 'הסעות חיות מחמד',
    desc: 'Safe transportation to vet, groomer & more',
    descHe: 'הסעה בטוחה לווטרינר, מטפח ועוד',
    path: '/pettrek',
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop',
  },
  {
    id: 'grooming',
    icon: Scissors,
    color: 'from-teal-500 to-emerald-600',
    name: 'Pet Grooming',
    nameHe: 'טיפוח חיות מחמד',
    desc: 'Professional grooming & styling',
    descHe: 'טיפוח ועיצוב מקצועי',
    path: '/groomers',
    image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&h=300&fit=crop',
  },
  {
    id: 'training',
    icon: GraduationCap,
    color: 'from-violet-500 to-purple-600',
    name: 'Dog Training',
    nameHe: 'אילוף כלבים',
    desc: 'Private training with certified trainers',
    descHe: 'אימון פרטי עם מאלפים מוסמכים',
    path: '/academy',
    image: 'https://images.unsplash.com/photo-1587764379873-97837921fd44?w=400&h=300&fit=crop',
  },
  {
    id: 'wash',
    icon: Droplets,
    color: 'from-emerald-500 to-green-600',
    name: 'K9000™ Wash',
    nameHe: 'K9000™ שטיפה',
    desc: 'Self-service wash stations 24/7',
    descHe: 'עמדות שטיפה בשירות עצמי 24/7',
    path: '/k9000',
    image: 'https://images.unsplash.com/photo-1581888227599-779811939961?w=400&h=300&fit=crop',
  },
];

const trustFeatures = [
  {
    icon: Shield,
    title: 'Background Verified',
    titleHe: 'אימות רקע',
    desc: 'Every provider passes enhanced background checks',
    descHe: 'כל נותן שירות עובר בדיקות רקע מורחבות',
  },
  {
    icon: Award,
    title: '₪25,000 Guarantee',
    titleHe: 'ערבות ₪25,000',
    desc: 'Pet Wash Protect covers eligible vet care',
    descHe: 'הגנת Pet Wash מכסה טיפול וטרינרי מזכה',
  },
  {
    icon: Phone,
    title: '24/7 Support',
    titleHe: 'תמיכה 24/7',
    desc: 'Our team is always here when you need us',
    descHe: 'הצוות שלנו תמיד כאן כשאתה צריך אותנו',
  },
  {
    icon: Camera,
    title: 'Photo Updates',
    titleHe: 'עדכוני תמונות',
    desc: 'Receive cute photos during every service',
    descHe: 'קבל תמונות חמודות במהלך כל שירות',
  },
  {
    icon: Map,
    title: 'GPS Tracking',
    titleHe: 'מעקב GPS',
    desc: 'Track walks and transport in real-time',
    descHe: 'עקוב אחר טיולים והסעות בזמן אמת',
  },
  {
    icon: CreditCard,
    title: '72-Hour Escrow',
    titleHe: 'נאמנות 72 שעות',
    desc: 'Secure payments via Nayax Israel',
    descHe: 'תשלומים מאובטחים דרך Nayax ישראל',
  },
];

const howItWorks = [
  {
    step: 1,
    title: 'Search & Compare',
    titleHe: 'חפש והשווה',
    desc: 'Browse verified providers with photos, reviews, and ratings',
    descHe: 'עיין בנותני שירות מאומתים עם תמונות, ביקורות ודירוגים',
    image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&h=300&fit=crop',
  },
  {
    step: 2,
    title: 'Meet & Greet',
    titleHe: 'פגישת היכרות',
    desc: 'Schedule a free meet & greet to find the perfect match',
    descHe: 'קבע פגישת היכרות חינם למציאת ההתאמה המושלמת',
    image: 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&h=300&fit=crop',
  },
  {
    step: 3,
    title: 'Book & Relax',
    titleHe: 'הזמן ותירגע',
    desc: 'Book securely and get updates with photos',
    descHe: 'הזמן בצורה מאובטחת וקבל עדכונים עם תמונות',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
  },
];

const testimonials = [
  {
    name: 'שרה כהן',
    nameEn: 'Sarah Cohen',
    location: 'Tel Aviv',
    rating: 5,
    text: 'השירות הכי טוב שניסיתי! הכלב שלי אוהב את המטיילת',
    textEn: 'Best service I\'ve tried! My dog loves his walker',
    avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
  },
  {
    name: 'David Levi',
    nameEn: 'David Levi',
    location: 'Herzliya',
    rating: 5,
    text: 'Amazing pet sitters. My cat was so happy when I returned',
    textEn: 'Amazing pet sitters. My cat was so happy when I returned',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
  },
  {
    name: 'מיכל ברק',
    nameEn: 'Michal Barak',
    location: 'Ramat Gan',
    rating: 5,
    text: 'הזמנתי הסעה לווטרינר והנהג היה מקצועי ואוהב חיות',
    textEn: 'Booked transport to vet and the driver was professional and pet-loving',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
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
    a: 'Yes! Every provider on Pet Wash passes an enhanced background check and is individually reviewed by our team before being approved.',
    aHe: 'כן! כל נותן שירות ב-Pet Wash עובר בדיקת רקע מורחבת ונבדק באופן אישי על ידי הצוות שלנו לפני האישור.',
  },
  {
    q: 'What is the Pet Wash Guarantee?',
    qHe: 'מהי ערבות Pet Wash?',
    a: 'Pet Wash Protect covers up to ₪25,000 in eligible veterinary care for incidents during booked services. Plus 24/7 support and reservation protection.',
    aHe: 'הגנת Pet Wash מכסה עד ₪25,000 בטיפול וטרינרי מזכה לאירועים במהלך שירותים מוזמנים. בנוסף לתמיכה 24/7 והגנת הזמנות.',
  },
  {
    q: 'Can I meet the sitter before booking?',
    qHe: 'האם אפשר לפגוש את השמרטף לפני ההזמנה?',
    a: 'Absolutely! We recommend scheduling a free meet & greet with your potential sitter. This lets you see how they interact with your pet.',
    aHe: 'בהחלט! אנו ממליצים לקבוע פגישת היכרות חינם עם השמרטף הפוטנציאלי. זה מאפשר לך לראות איך הם מתקשרים עם חיית המחמד שלך.',
  },
  {
    q: 'How does GPS tracking work for walks?',
    qHe: 'איך עובד מעקב GPS לטיולים?',
    a: 'After each walk, you\'ll receive a Rover Card with a map showing the exact route, distance, duration, potty breaks, and cute photos of your pup!',
    aHe: 'אחרי כל טיול, תקבל כרטיס דיווח עם מפה שמציגה את המסלול המדויק, המרחק, משך הזמן, הפסקות שירותים, ותמונות חמודות של הכלב שלך!',
  },
];

const cities = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Herzliya', 'Ramat Gan', 
  'Netanya', 'Beer Sheva', 'Ashdod', 'Rishon LeZion', 'Petah Tikva',
  'Eilat', 'Kfar Saba', 'Ra\'anana', 'Modiin', 'Rehovot', 'Holon'
];

export default function PlatformHub() {
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const isHebrew = language === 'he';
  
  const [selectedPet, setSelectedPet] = useState<PetType>(null);
  const [selectedService, setSelectedService] = useState<ServiceType>(null);
  const [location, setLocation] = useState('');

  const handleSearch = () => {
    if (selectedService) {
      const service = services.find(s => s.id === selectedService);
      if (service) {
        navigate(service.path);
      }
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Hero Section - MadPaws/Rover inspired */}
        <section className="relative overflow-hidden bg-gradient-to-br from-white via-emerald-50/30 to-white py-16 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,197,105,0.08),transparent_50%)]" />
          
          <div className="container mx-auto px-4 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Search Widget */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-4 py-1.5" data-testid="badge-award">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isHebrew ? '🏆 זוכי פרס 2025' : '🏆 2025 Award Winner'}
                  </Badge>
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {isHebrew 
                      ? 'טיפול אמין בחיות מחמד, בכל זמן, בכל מקום'
                      : 'Trusted pet care, anytime, anywhere'
                    }
                  </h1>
                  <p className="text-xl text-gray-600">
                    {isHebrew
                      ? 'מצא שמרטפים ומטיילי כלבים מאומתים בסביבתך'
                      : 'Find trusted pet sitters & dog walkers near you'
                    }
                  </p>
                </div>

                {/* Pet Type Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">
                    {isHebrew ? 'מי צריך טיפול?' : 'Who needs looking after?'}
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {petTypes.map((pet) => (
                      <button
                        key={pet.id}
                        onClick={() => setSelectedPet(pet.id as PetType)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                          selectedPet === pet.id
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-emerald-300'
                        }`}
                        data-testid={`button-pet-${pet.id}`}
                      >
                        <div className="text-2xl mb-1">{pet.icon}</div>
                        <div className="text-sm font-medium text-gray-900">
                          {isHebrew ? pet.labelHe : pet.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isHebrew ? pet.descHe : pet.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      {isHebrew ? 'סוג שירות' : 'Service type'}
                    </label>
                    <select
                      value={selectedService || ''}
                      onChange={(e) => setSelectedService(e.target.value as ServiceType)}
                      className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-0 transition-colors"
                      data-testid="select-service"
                    >
                      <option value="">{isHebrew ? 'בחר שירות' : 'Select service'}</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {isHebrew ? s.nameHe : s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      {isHebrew ? 'מיקום' : 'Location'}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={isHebrew ? 'הזן עיר או כתובת' : 'Enter city or address'}
                        className="pl-10 p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500"
                        data-testid="input-location"
                      />
                    </div>
                  </div>
                </div>

                {/* Search Button */}
                <Button
                  onClick={handleSearch}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                  data-testid="button-search"
                >
                  <Search className="w-5 h-5 mr-2" />
                  {isHebrew ? 'חפש נותני שירות' : 'Search for providers'}
                </Button>

                {/* Trust Badge */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span>4.9 {isHebrew ? 'מתוך 3,000+ ביקורות' : 'from 3,000+ reviews'}</span>
                </div>
              </div>

              {/* Right: Hero Image */}
              <div className="relative hidden lg:block">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop"
                    alt="Happy dog with sitter"
                    className="w-full h-[500px] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  
                  {/* Floating Stats */}
                  <div className="absolute bottom-6 left-6 right-6 flex gap-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg flex-1">
                      <div className="text-2xl font-bold text-emerald-600">10,000+</div>
                      <div className="text-sm text-gray-600">{isHebrew ? 'נותני שירות מאומתים' : 'Verified providers'}</div>
                    </div>
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg flex-1">
                      <div className="text-2xl font-bold text-emerald-600">50,000+</div>
                      <div className="text-sm text-gray-600">{isHebrew ? 'חיות מחמד מאושרות' : 'Happy pets served'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Grid - Rover/MadPaws inspired */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'שירות לכל הזדמנות' : 'A service for every occasion'}
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {isHebrew
                  ? 'מפנסיון ועד טיפוח, מטיולים ועד אילוף - יש לנו הכל'
                  : 'From boarding to grooming, walks to training - we\'ve got it all'
                }
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <Link key={service.id} href={service.path}>
                    <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border-0 shadow-md h-full" data-testid={`card-service-${service.id}`}>
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={service.image}
                          alt={service.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className={`absolute top-4 left-4 w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                          {isHebrew ? service.nameHe : service.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {isHebrew ? service.descHe : service.desc}
                        </p>
                        <div className="mt-4 flex items-center text-emerald-600 font-medium text-sm">
                          {isHebrew ? 'מצא נותני שירות' : 'Find providers'}
                          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Trust & Safety - Rover Protect inspired */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 mb-4">
                  <Shield className="w-4 h-4 mr-1" />
                  Pet Wash Protect™
                </Badge>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                  {isHebrew ? 'הזמן בשקט נפשי' : 'Book with peace of mind'}
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  {isHebrew
                    ? 'כל הזמנה מוגנת על ידי Pet Wash Protect, כולל אימות רקע, ביטוח ותמיכה 24/7'
                    : 'Every booking is protected by Pet Wash Protect, including background checks, insurance, and 24/7 support'
                  }
                </p>

                <div className="grid sm:grid-cols-2 gap-6">
                  {trustFeatures.map((feature, idx) => {
                    const Icon = feature.icon;
                    return (
                      <div key={idx} className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {isHebrew ? feature.titleHe : feature.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {isHebrew ? feature.descHe : feature.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex gap-4">
                  <Link href="/sitter-suite">
                    <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white" data-testid="button-book-sitter">
                      {isHebrew ? 'מצא שמרטף' : 'Book a local sitter'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/about">
                    <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50" data-testid="button-learn-more">
                      {isHebrew ? 'למד עוד' : 'Learn more'}
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&h=500&fit=crop"
                  alt="Trusted pet care"
                  className="rounded-3xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - 3 Steps */}
        <section className="py-20 bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'איך זה עובד?' : 'How does Pet Wash work?'}
              </h2>
              <p className="text-lg text-gray-600">
                {isHebrew
                  ? 'שלושה צעדים פשוטים לטיפול מושלם בחיית המחמד שלך'
                  : 'Three simple steps to perfect care for your pet'
                }
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {howItWorks.map((step, idx) => (
                <div key={idx} className="text-center">
                  <div className="relative mb-6">
                    <div className="w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden shadow-xl">
                      <img
                        src={step.image}
                        alt={step.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 mt-6">
                    {isHebrew ? step.titleHe : step.title}
                  </h3>
                  <p className="text-gray-600">
                    {isHebrew ? step.descHe : step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'מה הלקוחות שלנו אומרים' : 'What our customers say'}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, idx) => (
                <Card key={idx} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex mb-4">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 mb-6 italic">
                      "{isHebrew ? testimonial.text : testimonial.textEn}"
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-semibold text-gray-900">
                          {isHebrew ? testimonial.name : testimonial.nameEn}
                        </div>
                        <div className="text-sm text-gray-500">{testimonial.location}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, idx) => (
                <AccordionItem 
                  key={idx} 
                  value={`faq-${idx}`}
                  className="bg-white rounded-xl border-0 shadow-md px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline py-5">
                    {isHebrew ? faq.qHe : faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 pb-5">
                    {isHebrew ? faq.aHe : faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Cities Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'נותני שירות בכל רחבי ישראל' : 'Providers across Israel'}
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {cities.map((city) => (
                <Badge 
                  key={city}
                  variant="outline"
                  className="px-4 py-2 text-sm border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-colors"
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  {city}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* App Download CTA */}
        <section className="py-20 bg-gradient-to-r from-emerald-600 to-green-700">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  {isHebrew ? 'התחבר מכל מקום עם האפליקציה' : 'Connect anywhere with the app'}
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  {isHebrew
                    ? 'הורד את אפליקציית Pet Wash וקבל גישה לכל השירותים, עדכונים ותמונות - ישירות לטלפון שלך'
                    : 'Download the Pet Wash app and get access to all services, updates, and photos - right on your phone'
                  }
                </p>
                <div className="flex gap-4">
                  <Button className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-6" data-testid="button-app-store">
                    <Smartphone className="w-5 h-5 mr-2" />
                    App Store
                  </Button>
                  <Button className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-6" data-testid="button-play-store">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Google Play
                  </Button>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-64 h-[500px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                    <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=500&fit=crop"
                        alt="Pet Wash App"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
