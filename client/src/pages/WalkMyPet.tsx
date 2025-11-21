import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Star, MapPin, Heart, Search, Filter, Shield, CheckCircle2, 
  Award, TrendingUp, Users, Clock, DollarSign, Camera, 
  MessageCircle, Zap, Navigation, Activity, Smartphone,
  Video, Wifi, Trophy, Target, ThumbsUp, Sparkles,
  Calendar, Timer, Route, BarChart, Crown, Medal
} from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { GlassCard, ProgressCircle, SparklineChart } from '@/components/LuxuryWidgets';
import { EmergencyWalkBooking } from '@/components/EmergencyWalkBooking';
import { useSEO, pageSEO } from '@/lib/seo';

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

interface WalkerProfile {
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
  specialties: string[];
  certifications: string[];
  instantBook?: boolean;
  verified?: boolean;
  responseTime?: string;
  completedWalks?: number;
  dogSizes?: string[];
  availabilityCalendar?: AvailabilitySlot[];
}

const DOG_SIZES = ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'];
const SPECIALTIES = [
  'Puppy Training',
  'Senior Dogs',
  'Reactive Dogs',
  'Multiple Dogs',
  'Off-Leash',
  'Jogging/Running',
];

// Mock walker data (fallback if API returns no data)
const MOCK_WALKERS: WalkerProfile[] = [
  {
    id: '1',
    fullName: 'David Cohen',
    city: 'Tel Aviv',
    bio: 'Professional dog walker with 8 years of experience. Specialized in training reactive dogs and large breeds. Certified in pet first aid and CPR.',
    experienceYears: 8,
    hourlyRateIls: 85,
    available: true,
    profilePhotoUrl: null,
    rating: 4.95,
    totalReviews: 253,
    specialties: ['Reactive Dogs', 'Multiple Dogs', 'Jogging/Running', 'Off-Leash'],
    certifications: ['Pet First Aid', 'Dog Behavior Specialist'],
    instantBook: true,
    verified: true,
    responseTime: '8 min',
    completedWalks: 847,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '07:00', endTime: '19:00' },
      { day: 'Tuesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Wednesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Thursday', startTime: '07:00', endTime: '19:00' },
      { day: 'Friday', startTime: '07:00', endTime: '15:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '18:00' },
    ],
  },
  {
    id: '2',
    fullName: 'Maya Levi',
    city: 'Jerusalem',
    bio: 'Passionate dog lover specializing in senior dogs and puppies. Former veterinary assistant with deep understanding of dog health and behavior.',
    experienceYears: 5,
    hourlyRateIls: 75,
    available: true,
    profilePhotoUrl: null,
    rating: 4.98,
    totalReviews: 189,
    specialties: ['Senior Dogs', 'Puppy Training'],
    certifications: ['Pet First Aid', 'Veterinary Assistant'],
    instantBook: true,
    verified: true,
    responseTime: '12 min',
    completedWalks: 523,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '09:00', endTime: '18:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '18:00' },
      { day: 'Wednesday', startTime: '09:00', endTime: '18:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '10:00', endTime: '16:00' },
    ],
  },
  {
    id: '3',
    fullName: 'Yoni Peretz',
    city: 'Haifa',
    bio: 'High-energy walker perfect for active breeds! Experienced with high-energy breeds like Huskies and German Shepherds. GPS tracking guaranteed.',
    experienceYears: 6,
    hourlyRateIls: 90,
    available: true,
    profilePhotoUrl: null,
    rating: 4.92,
    totalReviews: 201,
    specialties: ['Jogging/Running', 'Off-Leash', 'Multiple Dogs'],
    certifications: ['Pet First Aid', 'Canine Fitness Trainer'],
    instantBook: true,
    verified: true,
    responseTime: '10 min',
    completedWalks: 612,
    dogSizes: ['Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '06:00', endTime: '20:00' },
      { day: 'Tuesday', startTime: '06:00', endTime: '20:00' },
      { day: 'Wednesday', startTime: '06:00', endTime: '20:00' },
      { day: 'Thursday', startTime: '06:00', endTime: '20:00' },
      { day: 'Friday', startTime: '06:00', endTime: '20:00' },
      { day: 'Saturday', startTime: '08:00', endTime: '16:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '16:00' },
    ],
  },
  {
    id: '4',
    fullName: 'Noa Mizrahi',
    city: 'Tel Aviv',
    bio: 'Gentle walker specializing in anxious and fearful dogs. Trained in dog psychology and behavior modification. Perfect for reactive dogs.',
    experienceYears: 7,
    hourlyRateIls: 95,
    available: true,
    profilePhotoUrl: null,
    rating: 4.97,
    totalReviews: 245,
    specialties: ['Reactive Dogs', 'Puppy Training', 'Senior Dogs'],
    certifications: ['Pet First Aid', 'Dog Psychology Specialist'],
    instantBook: true,
    verified: true,
    responseTime: '7 min',
    completedWalks: 734,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '10:00', endTime: '17:00' },
      { day: 'Tuesday', startTime: '10:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '10:00', endTime: '17:00' },
      { day: 'Thursday', startTime: '10:00', endTime: '17:00' },
      { day: 'Friday', startTime: '10:00', endTime: '15:00' },
    ],
  },
  {
    id: '5',
    fullName: 'Eitan Kaplan',
    city: 'Beersheba',
    bio: 'Professional dog walker with military K9 experience. Specialized in obedience training and working with protection breeds.',
    experienceYears: 10,
    hourlyRateIls: 100,
    available: true,
    profilePhotoUrl: null,
    rating: 4.91,
    totalReviews: 287,
    specialties: ['Multiple Dogs', 'Off-Leash', 'Reactive Dogs'],
    certifications: ['Pet First Aid', 'K9 Handler', 'Professional Dog Trainer'],
    instantBook: true,
    verified: true,
    responseTime: '9 min',
    completedWalks: 956,
    dogSizes: ['Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '05:30', endTime: '21:00' },
      { day: 'Tuesday', startTime: '05:30', endTime: '21:00' },
      { day: 'Wednesday', startTime: '05:30', endTime: '21:00' },
      { day: 'Thursday', startTime: '05:30', endTime: '21:00' },
      { day: 'Friday', startTime: '05:30', endTime: '21:00' },
      { day: 'Saturday', startTime: '07:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '07:00', endTime: '18:00' },
    ],
  },
  {
    id: '6',
    fullName: 'Shira Goldstein',
    city: 'Tel Aviv',
    bio: 'Dedicated walker with animal shelter background. Experience with all breeds and temperaments. Available for mid-day walks and puppy breaks.',
    experienceYears: 4,
    hourlyRateIls: 70,
    available: true,
    profilePhotoUrl: null,
    rating: 4.89,
    totalReviews: 142,
    specialties: ['Puppy Training', 'Senior Dogs', 'Multiple Dogs'],
    certifications: ['Pet First Aid'],
    instantBook: false,
    verified: true,
    responseTime: '15 min',
    completedWalks: 398,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '11:00', endTime: '16:00' },
      { day: 'Tuesday', startTime: '11:00', endTime: '16:00' },
      { day: 'Wednesday', startTime: '11:00', endTime: '16:00' },
      { day: 'Thursday', startTime: '11:00', endTime: '16:00' },
      { day: 'Sunday', startTime: '12:00', endTime: '18:00' },
    ],
  },
  {
    id: '7',
    fullName: 'Amit Shapira',
    city: 'Herzliya',
    bio: 'Professional walker and adventure guide! Organize group dog walks and beach outings. Your dog will make new friends!',
    experienceYears: 5,
    hourlyRateIls: 80,
    available: true,
    profilePhotoUrl: null,
    rating: 4.93,
    totalReviews: 198,
    specialties: ['Multiple Dogs', 'Off-Leash', 'Jogging/Running'],
    certifications: ['Pet First Aid'],
    instantBook: true,
    verified: true,
    responseTime: '11 min',
    completedWalks: 567,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '08:00', endTime: '18:00' },
      { day: 'Tuesday', startTime: '08:00', endTime: '18:00' },
      { day: 'Wednesday', startTime: '08:00', endTime: '18:00' },
      { day: 'Thursday', startTime: '08:00', endTime: '18:00' },
      { day: 'Friday', startTime: '08:00', endTime: '14:00' },
      { day: 'Saturday', startTime: '09:00', endTime: '17:00' },
      { day: 'Sunday', startTime: '09:00', endTime: '17:00' },
    ],
  },
  {
    id: '8',
    fullName: 'Tali Ben-David',
    city: 'Ramat Gan',
    bio: 'Walker specializing in small breeds and toy dogs. Gentle handling with lots of patience. Medication administration certified.',
    experienceYears: 6,
    hourlyRateIls: 75,
    available: true,
    profilePhotoUrl: null,
    rating: 4.96,
    totalReviews: 223,
    specialties: ['Senior Dogs', 'Puppy Training', 'Reactive Dogs'],
    certifications: ['Pet First Aid', 'Pet Medication Administration'],
    instantBook: true,
    verified: true,
    responseTime: '8 min',
    completedWalks: 689,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '07:00', endTime: '19:00' },
      { day: 'Tuesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Wednesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Thursday', startTime: '07:00', endTime: '19:00' },
      { day: 'Friday', startTime: '07:00', endTime: '14:00' },
      { day: 'Sunday', startTime: '09:00', endTime: '17:00' },
    ],
  },
  {
    id: '9',
    fullName: 'Ron Avraham',
    city: 'Tel Aviv',
    bio: 'Tech-savvy walker with drone monitoring! Premium walks with aerial footage and real-time GPS tracking. Complete visibility guaranteed.',
    experienceYears: 4,
    hourlyRateIls: 110,
    available: true,
    profilePhotoUrl: null,
    rating: 4.94,
    totalReviews: 167,
    specialties: ['Multiple Dogs', 'Off-Leash', 'Jogging/Running'],
    certifications: ['Pet First Aid', 'Drone Pilot'],
    instantBook: true,
    verified: true,
    responseTime: '6 min',
    completedWalks: 445,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '10:00', endTime: '20:00' },
      { day: 'Tuesday', startTime: '10:00', endTime: '20:00' },
      { day: 'Wednesday', startTime: '10:00', endTime: '20:00' },
      { day: 'Thursday', startTime: '10:00', endTime: '20:00' },
      { day: 'Friday', startTime: '10:00', endTime: '16:00' },
      { day: 'Saturday', startTime: '12:00', endTime: '18:00' },
    ],
  },
  {
    id: '10',
    fullName: 'Lior Friedman',
    city: 'Netanya',
    bio: 'Walker and trainer specializing in behavior modification. Former military dog handler with expertise in discipline and structure.',
    experienceYears: 9,
    hourlyRateIls: 105,
    available: true,
    profilePhotoUrl: null,
    rating: 4.95,
    totalReviews: 271,
    specialties: ['Reactive Dogs', 'Multiple Dogs', 'Off-Leash'],
    certifications: ['Pet First Aid', 'Professional Dog Trainer'],
    instantBook: true,
    verified: true,
    responseTime: '7 min',
    completedWalks: 812,
    dogSizes: ['Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '06:00', endTime: '18:00' },
      { day: 'Tuesday', startTime: '06:00', endTime: '18:00' },
      { day: 'Wednesday', startTime: '06:00', endTime: '18:00' },
      { day: 'Thursday', startTime: '06:00', endTime: '18:00' },
      { day: 'Friday', startTime: '06:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '16:00' },
    ],
  },
  {
    id: '11',
    fullName: 'Dana Katz',
    city: 'Petah Tikva',
    bio: 'Walker with veterinary technician background. Handle dogs with special medical needs and administer medications during walks.',
    experienceYears: 7,
    hourlyRateIls: 90,
    available: true,
    profilePhotoUrl: null,
    rating: 4.97,
    totalReviews: 211,
    specialties: ['Senior Dogs', 'Puppy Training', 'Reactive Dogs'],
    certifications: ['Pet First Aid', 'Veterinary Technician'],
    instantBook: true,
    verified: true,
    responseTime: '10 min',
    completedWalks: 623,
    dogSizes: ['Small (0-10kg)', 'Medium (10-25kg)', 'Large (25-45kg)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '09:00', endTime: '17:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '13:00', endTime: '19:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'Friday', startTime: '09:00', endTime: '14:00' },
      { day: 'Sunday', startTime: '10:00', endTime: '16:00' },
    ],
  },
  {
    id: '12',
    fullName: 'Ariel Rosenberg',
    city: 'Haifa',
    bio: 'Adventure-loving walker specializing in hiking and trail walks! Take dogs on exciting outdoor adventures in nature reserves and forests.',
    experienceYears: 6,
    hourlyRateIls: 95,
    available: true,
    profilePhotoUrl: null,
    rating: 4.92,
    totalReviews: 184,
    specialties: ['Off-Leash', 'Jogging/Running', 'Multiple Dogs'],
    certifications: ['Pet First Aid', 'Trail Guide'],
    instantBook: true,
    verified: true,
    responseTime: '12 min',
    completedWalks: 534,
    dogSizes: ['Medium (10-25kg)', 'Large (25-45kg)', 'Giant (45kg+)'],
    availabilityCalendar: [
      { day: 'Monday', startTime: '07:00', endTime: '19:00' },
      { day: 'Tuesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Thursday', startTime: '07:00', endTime: '19:00' },
      { day: 'Friday', startTime: '07:00', endTime: '15:00' },
      { day: 'Saturday', startTime: '08:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '18:00' },
    ],
  },
];

export default function WalkMyPet() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  // Apply SEO metadata
  useSEO(pageSEO.walkMyPet);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, 150]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedDogSizes, setSelectedDogSizes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  
  const { data: walkersFromApi, isLoading } = useQuery<WalkerProfile[]>({
    queryKey: ['/api/walkers/search', selectedCity],
  });

  // Use API data if available, otherwise fall back to mock data
  const walkers = walkersFromApi && walkersFromApi.length > 0 ? walkersFromApi : MOCK_WALKERS;

  const filteredWalkers = walkers?.filter(walker => {
    const matchesSearch = walker.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      walker.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = walker.hourlyRateIls >= priceRange[0] && walker.hourlyRateIls <= priceRange[1];
    const matchesSpecialties = selectedSpecialties.length === 0 || 
      selectedSpecialties.some(spec => walker.specialties.includes(spec));
    const matchesDogSizes = selectedDogSizes.length === 0 || 
      selectedDogSizes.some(size => walker.dogSizes?.includes(size));
    const matchesInstantBook = !instantBookOnly || walker.instantBook;
    const matchesCertified = !certifiedOnly || walker.verified;
    const matchesAvailable = !availableToday || walker.available;
    return matchesSearch && matchesPrice && matchesSpecialties && matchesDogSizes && 
           matchesInstantBook && matchesCertified && matchesAvailable;
  });

  const featuredWalkers = walkers?.filter(w => w.rating >= 4.9 && w.completedWalks && w.completedWalks >= 100).slice(0, 4);

  const t = {
    hero: {
      title: isHebrew ? 'Walk My Pet™' : 'Walk My Pet™',
      subtitle: isHebrew 
        ? 'שירות הליכה פרימיום עם מעקב GPS בזמן אמת וטכנולוגיית בלוקצ\'יין. מאומת, מבוטח, שקוף' 
        : 'Premium Dog Walking with Real-Time GPS Tracking & Blockchain Audit Trail. Verified, Insured, Transparent.',
      becomeWalker: isHebrew ? 'הפוך לווקר' : 'Become a Walker',
      earnMoney: isHebrew ? 'הכנסות תחרותיות + טיפים (תלוי במיקום וניסיון)' : 'Competitive Earnings + Tips (Varies by Location & Experience)',
      searchPlaceholder: isHebrew ? 'חפש לפי שם, עיר, או התמחות...' : 'Search by name, city, or specialty...',
      searchNow: isHebrew ? 'חפש עכשיו' : 'Search Now',
    },
    stats: {
      walkers: { value: '800+', label: isHebrew ? 'ווקרים מקצועיים' : 'Professional Walkers' },
      walks: { value: '75,000+', label: isHebrew ? 'הליכות הושלמו' : 'Walks Completed' },
      rating: { value: '4.9★', label: isHebrew ? 'דירוג ממוצע' : 'Average Rating' },
      gps: { value: '100%', label: isHebrew ? 'מעקב GPS' : 'GPS Tracked' },
    },
    trust: {
      title: isHebrew ? 'למה לבחור ב-Walk My Pet™?' : 'Why Choose Walk My Pet™?',
      badge1Title: isHebrew ? 'מעקב GPS בזמן אמת' : 'Real-Time GPS Tracking',
      badge1Desc: isHebrew ? 'עקוב אחרי הליכת הכלב שלך בזמן אמת עם מפה חיה, מרחק, ומהירות' : 'Follow your dog\'s walk in real-time with live map, distance, and speed',
      badge2Title: isHebrew ? 'רשומת בלוקצ\'יין בלתי ניתנת לשינוי' : 'Immutable Blockchain Audit Trail',
      badge2Desc: isHebrew ? 'כל צ\'ק-אין/אאוט נרשם לנצח - אי אפשר לזייף או לשנות' : 'Every check-in/check-out recorded forever - impossible to fake or alter',
      badge3Title: isHebrew ? 'ניטור נתוני חיים' : 'Vital Data Monitoring',
      badge3Desc: isHebrew ? 'דופק, צעדים, הידרציה, וטמפרטורה נעקבים ונרשמים בכל הליכה' : 'Heart rate, steps, hydration, and temperature tracked & logged every walk',
      badge4Title: isHebrew ? 'ביטוח ₪2M' : '₪2M Insurance Coverage',
      badge4Desc: isHebrew ? 'כל ווקר מבוטח במלוא עד 2 מיליון ש"ח - הכלב שלך מוגן' : 'Every walker fully insured up to ₪2M - your dog is protected',
      badge5Title: isHebrew ? 'וידאו לייב (בקרוב)' : 'Live Video (Coming Soon)',
      badge5Desc: isHebrew ? 'צפה בכלב שלך בזמן אמת עם שידור חי מהווקר' : 'Watch your dog in real-time with live streaming from walker',
      badge6Title: isHebrew ? 'תמחור שקוף' : 'Transparent Pricing',
      badge6Desc: isHebrew ? 'אין דמי הפתעה. 24% עמלה, 76% לווקר. פשוט והוגן' : 'No surprise fees. 24% platform fee, 76% to walker. Simple and fair',
    },
    featured: {
      title: isHebrew ? 'ווקרים מובילים ⭐' : 'Top Rated Walkers ⭐',
      subtitle: isHebrew ? 'הווקרים המדורגים ביותר שלנו עם ניסיון מוכח' : 'Our highest-rated walkers with proven experience',
      completed: isHebrew ? 'הליכות הושלמו' : 'walks completed',
      responseTime: isHebrew ? 'זמן תגובה' : 'response time',
      bookNow: isHebrew ? 'הזמן עכשיו' : 'Book Now',
      viewProfile: isHebrew ? 'צפה בפרופיל' : 'View Profile',
    },
    earnings: {
      title: isHebrew ? '💰 מחשבון הכנסות לווקרים' : '💰 Walker Earnings Calculator',
      subtitle: isHebrew ? 'ראה כמה אתה יכול להרוויח כווקר מקצועי' : 'See how much you can earn as a professional dog walker',
      walksPerWeek: isHebrew ? 'הליכות בשבוע' : 'Walks per week',
      avgRate: isHebrew ? 'תעריף ממוצע לשעה' : 'Avg hourly rate',
      avgDuration: isHebrew ? 'משך ממוצע (דקות)' : 'Avg duration (min)',
      weeklyEarnings: isHebrew ? 'הכנסה שבועית' : 'Weekly Earnings',
      monthlyEarnings: isHebrew ? 'הכנסה חודשית' : 'Monthly Earnings',
      yearlyEarnings: isHebrew ? 'הכנסה שנתית' : 'Yearly Earnings',
      afterPlatformFee: isHebrew ? '(אחרי 24% עמלת פלטפורמה)' : '(after 24% platform fee)',
    },
    howItWorks: {
      title: isHebrew ? 'איך זה עובד?' : 'How It Works',
      step1Title: isHebrew ? '1. בחר ווקר' : '1. Choose a Walker',
      step1Desc: isHebrew ? 'סנן לפי מיקום, מחיר, התמחות, וגודל כלב. קרא ביקורות וצפה בדירוגים' : 'Filter by location, price, specialty, and dog size. Read reviews and check ratings',
      step2Title: isHebrew ? '2. הזמן בקלות' : '2. Book Easily',
      step2Desc: isHebrew ? 'בחר תאריך, שעה, ומשך. הזן פרטי כלב. תשלום מאובטח עם Nayax' : 'Select date, time, and duration. Enter dog details. Secure payment with Nayax',
      step3Title: isHebrew ? '3. עקוב בזמן אמת' : '3. Track in Real-Time',
      step3Desc: isHebrew ? 'קבל התראה כשהווקר מגיע. עקוב אחרי מסלול הליכה חי עם GPS. צפה בנתוני חיים' : 'Get notified when walker arrives. Track live walk route with GPS. View vital stats',
      step4Title: isHebrew ? '4. קבל דוח מפורט' : '4. Get Detailed Report',
      step4Desc: isHebrew ? 'קבל מרחק, משך, מפה, תמונות, ודוח נתוני חיים. דרג וטיפ לווקר' : 'Receive distance, duration, map, photos, and vital stats report. Rate and tip walker',
    },
    requirements: {
      title: isHebrew ? 'דרישות לווקרים' : 'Walker Requirements',
      subtitle: isHebrew ? 'מה צריך כדי להפוך לווקר מקצועי?' : 'What does it take to become a professional walker?',
      req1: isHebrew ? 'גיל 21+ עם רישיון נהיגה תקף' : 'Age 21+ with valid driver\'s license',
      req2: isHebrew ? 'ניסיון עם כלבים (1+ שנים)' : 'Experience with dogs (1+ years)',
      req3: isHebrew ? 'ביטוח אחריות מקצועית' : 'Professional liability insurance',
      req4: isHebrew ? 'סמארטפון עם GPS ו-4G' : 'Smartphone with GPS & 4G',
      req5: isHebrew ? 'בדיקת רקע נקי' : 'Clean background check',
      req6: isHebrew ? 'תעודת עזרה ראשונה לחיות מחמד' : 'Pet first aid certification',
      req7: isHebrew ? 'זמינות 10+ שעות בשבוע' : 'Availability 10+ hours/week',
      req8: isHebrew ? 'KYC מלא עם אימות ביומטרי' : 'Full KYC with biometric verification',
    },
    testimonials: {
      title: isHebrew ? 'מה אומרים הלקוחות שלנו?' : 'What Our Customers Say',
      test1Name: isHebrew ? 'Emily Thompson, Toronto' : 'Emily Thompson, Toronto',
      test1Text: isHebrew ? 'The walker was amazing! I watched the entire walk in real-time, got photos and detailed map. My dog came back happy and tired. 5-star service!' : 'The walker was amazing! I watched the entire walk in real-time, got photos and detailed map. My dog came back happy and tired. 5-star service!',
      test2Name: isHebrew ? 'James Anderson, Sydney' : 'James Anderson, Sydney',
      test2Text: isHebrew ? 'I use Walk My Pet 3 times a week. GPS tracking gives me peace of mind, and walkers are always professional. Highly recommended!' : 'I use Walk My Pet 3 times a week. GPS tracking gives me peace of mind, and walkers are always professional. Highly recommended!',
      test3Name: isHebrew ? 'Sophie Bennett, London' : 'Sophie Bennett, London',
      test3Text: isHebrew ? 'Recently switched to a new walker and the process was smooth. App is easy to use, and reports are super detailed. Worth every dollar!' : 'Recently switched to a new walker and the process was smooth. App is easy to use, and reports are super detailed. Worth every dollar!',
      test4Name: isHebrew ? 'Michael Roberts, Vancouver' : 'Michael Roberts, Vancouver',
      test4Text: isHebrew ? 'My walker treats my two dogs like his own. Always on time, always professional. Blockchain gives me confidence they actually walked!' : 'My walker treats my two dogs like his own. Always on time, always professional. Blockchain gives me confidence they actually walked!',
    },
    filters: {
      title: isHebrew ? 'סנן ווקרים' : 'Filter Walkers',
      priceRange: isHebrew ? 'טווח מחיר (₪/שעה)' : 'Price Range (₪/hour)',
      specialties: isHebrew ? 'התמחויות' : 'Specialties',
      dogSizes: isHebrew ? 'גודל כלבים' : 'Dog Sizes',
      clear: isHebrew ? 'נקה הכל' : 'Clear All',
    },
    allWalkers: {
      title: isHebrew ? 'כל הווקרים' : 'All Walkers',
      showing: isHebrew ? 'מציג' : 'Showing',
      walkers: isHebrew ? 'ווקרים' : 'walkers',
    },
  };

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        
        {/* LUXURY HERO SECTION */}
        <div className="relative overflow-hidden luxury-bg-primary text-white py-32 luxury-animate-fade-in">
          
          <div className="relative luxury-container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left: Headline + CTAs */}
              <div className="space-y-8">
                <div className="space-y-6">
                  {/* Premium Badge */}
                  <div className="luxury-badge luxury-badge-gold inline-flex items-center gap-2 luxury-shadow-md">
                    <Crown className="w-6 h-6" />
                    <span className="text-sm font-bold tracking-wider">7-STAR LUXURY SERVICE</span>
                  </div>
                  
                  <h1 className="luxury-heading-xl luxury-animate-slide-up">
                    {t.hero.title}
                  </h1>
                  <p className="luxury-text-body text-white/95 text-xl luxury-animate-slide-up luxury-delay-1">
                    {t.hero.subtitle}
                  </p>
                </div>

                {/* Premium Stats Grid - Glassmorphism */}
                <div className="luxury-grid-2 luxury-gap-md luxury-animate-scale-in luxury-delay-2">
                  <div className="luxury-glass-card luxury-hover-lift p-6 border-2 border-white/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl luxury-bg-primary flex items-center justify-center luxury-shadow-md">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white">{t.stats.walkers.value}</div>
                    </div>
                    <div className="text-sm font-medium text-white/90">{t.stats.walkers.label}</div>
                  </div>
                  <div className="luxury-glass-card luxury-hover-lift p-6 border-2 border-white/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl luxury-bg-primary flex items-center justify-center luxury-shadow-md">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white">{t.stats.walks.value}</div>
                    </div>
                    <div className="text-sm font-medium text-white/90">{t.stats.walks.label}</div>
                  </div>
                  <div className="luxury-glass-card luxury-hover-lift p-6 border-2 border-white/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl luxury-bg-primary flex items-center justify-center luxury-shadow-md">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white">{t.stats.rating.value}</div>
                    </div>
                    <div className="text-sm font-medium text-white/90">{t.stats.rating.label}</div>
                  </div>
                  <div className="luxury-glass-card luxury-hover-lift p-6 border-2 border-white/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl luxury-bg-primary flex items-center justify-center luxury-shadow-md">
                        <Navigation className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white">{t.stats.gps.value}</div>
                    </div>
                    <div className="text-sm font-medium text-white/90">{t.stats.gps.label}</div>
                  </div>
                </div>

                {/* Premium CTA Buttons */}
                <div className="flex flex-wrap gap-4 luxury-animate-fade-in luxury-delay-3">
                  <button 
                    className="luxury-btn-primary luxury-shadow-xl px-10 py-8 text-xl flex items-center gap-3"
                    onClick={() => {
                      const resultsSection = document.getElementById('walkers-results');
                      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    data-testid="button-find-walker"
                  >
                    <Search className="w-6 h-6" />
                    {isHebrew ? 'מצא ווקר' : 'Find a Walker'}
                    <Sparkles className="w-5 h-5" />
                  </button>
                  
                  <Link href="/provider-onboarding?type=walker">
                    <button 
                      className="luxury-btn-secondary px-10 py-8 text-xl flex items-center gap-3"
                      data-testid="button-become-walker"
                    >
                      <Trophy className="w-6 h-6" />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          {t.hero.becomeWalker}
                          <Medal className="w-5 h-5" />
                        </div>
                        <div className="text-sm font-semibold opacity-90">{t.hero.earnMoney}</div>
                      </div>
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right: Search Card */}
              <div className="lg:block luxury-animate-scale-in luxury-delay-2">
                <div className="luxury-glass-card luxury-shadow-xl p-8">
                  <div className="space-y-6">
                    <h3 className="luxury-heading-md">
                      {isHebrew ? 'מצא את הווקר המושלם 🐕' : 'Find Your Perfect Walker 🐕'}
                    </h3>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input 
                        placeholder={t.hero.searchPlaceholder}
                        className="pl-12 h-14 text-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-walkers"
                      />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        className={`px-4 py-2 cursor-pointer transition-all ${
                          instantBookOnly 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
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
                            ? 'bg-purple-600 text-white hover:bg-purple-700' 
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                        onClick={() => setAvailableToday(!availableToday)}
                        data-testid="badge-filter-available-today"
                      >
                        {availableToday && '✓ '}
                        {isHebrew ? 'זמין היום' : 'Available Today'}
                      </Badge>
                    </div>

                    <button 
                      className="luxury-btn-primary luxury-shadow-lg w-full h-14 text-lg"
                      onClick={() => {
                        const resultsSection = document.getElementById('walkers-results');
                        resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      data-testid="button-search"
                    >
                      {t.hero.searchNow}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EMERGENCY WALK BANNER */}
        <div className="luxury-container -mt-8 mb-8 relative z-10">
          <div className="luxury-glass-card luxury-shadow-xl p-8 bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 border-2 border-white/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-white space-y-2">
                <h2 className="text-3xl font-black flex items-center gap-3">
                  <Zap className="h-8 w-8 animate-pulse" />
                  {isHebrew ? 'צריך מטייל עכשיו?' : 'Need a Walker Now?'}
                </h2>
                <p className="text-xl text-yellow-100">
                  {isHebrew 
                    ? 'שירות חירום - הגעה מובטחת תוך 90 דקות! 🚨'
                    : 'Emergency Service - Guaranteed 90-Minute Arrival! 🚨'}
                </p>
                <p className="text-sm text-yellow-50 opacity-90">
                  {isHebrew 
                    ? 'מטיילים מקצועיים עם דירוג 4.0+ • מעקב GPS בזמן אמת • תמחור שקוף'
                    : 'Professional walkers rated 4.0+ • Real-time GPS • Transparent pricing'}
                </p>
              </div>
              <div className="flex-shrink-0">
                <EmergencyWalkBooking />
              </div>
            </div>
          </div>
        </div>

        {/* TRUST & SAFETY BADGES */}
        <div className="luxury-section luxury-container">
          <div className="text-center mb-12">
            <h2 className="luxury-heading-lg mb-4">
              {t.trust.title}
            </h2>
          </div>

          <div className="luxury-grid-3 luxury-gap-lg">
            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-1">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <Navigation className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge1Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge1Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-2">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <Shield className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge2Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge2Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-3">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <Activity className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge3Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge3Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <Shield className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge4Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge4Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <Video className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge5Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge5Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="luxury-glass-minimal p-6 luxury-hover-lift luxury-animate-fade-in luxury-delay-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center luxury-shadow-sm">
                  <DollarSign className="w-8 h-8 text-[#667eea]" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm mb-2">
                    {t.trust.badge6Title}
                  </h3>
                  <p className="luxury-text-body text-sm">
                    {t.trust.badge6Desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURED WALKERS */}
        {featuredWalkers && featuredWalkers.length > 0 && (
          <div className="luxury-section luxury-bg-soft">
            <div className="luxury-container">
              <div className="text-center mb-12">
                <h2 className="luxury-heading-lg mb-4">
                  {t.featured.title}
                </h2>
                <p className="luxury-text-body text-xl">
                  {t.featured.subtitle}
                </p>
              </div>

              <div className="luxury-grid-4 luxury-gap-lg">
                {featuredWalkers.map((walker, idx) => (
                  <div key={walker.id} className={`luxury-glass-card luxury-shadow-md luxury-hover-glow p-0 overflow-hidden luxury-animate-scale-in luxury-delay-${Math.min(idx + 1, 10)}`}>
                    <div className="aspect-square luxury-bg-soft flex items-center justify-center relative overflow-hidden">
                      {walker.profilePhotoUrl ? (
                        <div className="w-full h-full relative">
                          <div className="absolute inset-0 luxury-bg-primary opacity-10"></div>
                          <img src={walker.profilePhotoUrl} alt={walker.fullName} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-full luxury-bg-primary flex items-center justify-center luxury-shadow-lg relative"
                          style={{
                            border: '4px solid transparent',
                            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #667eea, #764ba2)',
                            backgroundOrigin: 'border-box',
                            backgroundClip: 'padding-box, border-box'
                          }}>
                          <div className="text-5xl font-black text-white">
                            {walker.fullName.charAt(0)}
                          </div>
                        </div>
                      )}
                      <div className="luxury-badge-gold absolute top-3 right-3 flex items-center gap-1 px-3 py-1">
                        <Crown className="w-3 h-3" />
                        <span className="text-xs font-bold">TOP</span>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="luxury-heading-sm flex items-center gap-2">
                          {walker.fullName}
                          {walker.verified && <CheckCircle2 className="w-4 h-4 text-[#667eea]" />}
                        </h3>
                        <div className="flex items-center gap-1 luxury-text-small">
                          <MapPin className="w-4 h-4" />
                          {walker.city}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="luxury-badge luxury-badge-gold flex items-center gap-1 px-2 py-1">
                          <Star className="w-3 h-3" />
                          <span className="text-xs font-bold">{walker.rating}</span>
                        </div>
                        <span className="luxury-text-small">({walker.totalReviews})</span>
                      </div>

                      <div className="luxury-text-small">
                        {walker.completedWalks} {t.featured.completed}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="luxury-text-gradient text-2xl font-black">
                          ₪{walker.hourlyRateIls}
                          <span className="text-sm luxury-text-body">/hr</span>
                        </div>
                      </div>

                      <Link href={`/walk-my-pet/book/${walker.id}`}>
                        <button className="luxury-btn-primary w-full" data-testid={`button-book-${walker.id}`}>
                          {t.featured.bookNow}
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EARNINGS CALCULATOR */}
        <div className="luxury-section luxury-container">
          <div className="luxury-glass-card luxury-shadow-lg p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="luxury-heading-lg mb-4">
                {t.earnings.title}
              </h2>
              <p className="luxury-text-body text-xl">
                {t.earnings.subtitle}
              </p>
            </div>

            <EarningsCalculator isHebrew={isHebrew} t={t.earnings} />
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-12">
              <h2 className="luxury-heading-lg mb-4">
                {t.howItWorks.title}
              </h2>
            </div>

            <div className="luxury-grid-4 luxury-gap-lg relative">
              {/* Step 1 */}
              <div className="luxury-glass-card luxury-hover-lift p-6 text-center relative">
                <div className="w-20 h-20 rounded-full luxury-bg-primary flex items-center justify-center mx-auto mb-4 luxury-shadow-lg relative">
                  <span className="luxury-text-gradient text-4xl font-black absolute inset-0 flex items-center justify-center">1</span>
                </div>
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center mx-auto mb-4 luxury-shadow-sm">
                  <Search className="w-8 h-8 text-[#667eea]" />
                </div>
                <h3 className="luxury-heading-sm mb-3">
                  {t.howItWorks.step1Title}
                </h3>
                <p className="luxury-text-body text-sm">
                  {t.howItWorks.step1Desc}
                </p>
                {/* Connector Arrow */}
                <div className="hidden lg:block absolute top-1/2 -right-8 transform -translate-y-1/2">
                  <div className="luxury-divider-vertical h-1 w-16 rotate-90"></div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="luxury-glass-card luxury-hover-lift p-6 text-center relative">
                <div className="w-20 h-20 rounded-full luxury-bg-primary flex items-center justify-center mx-auto mb-4 luxury-shadow-lg relative">
                  <span className="luxury-text-gradient text-4xl font-black absolute inset-0 flex items-center justify-center">2</span>
                </div>
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center mx-auto mb-4 luxury-shadow-sm">
                  <Calendar className="w-8 h-8 text-[#667eea]" />
                </div>
                <h3 className="luxury-heading-sm mb-3">
                  {t.howItWorks.step2Title}
                </h3>
                <p className="luxury-text-body text-sm">
                  {t.howItWorks.step2Desc}
                </p>
                {/* Connector Arrow */}
                <div className="hidden lg:block absolute top-1/2 -right-8 transform -translate-y-1/2">
                  <div className="luxury-divider-vertical h-1 w-16 rotate-90"></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="luxury-glass-card luxury-hover-lift p-6 text-center relative">
                <div className="w-20 h-20 rounded-full luxury-bg-primary flex items-center justify-center mx-auto mb-4 luxury-shadow-lg relative">
                  <span className="luxury-text-gradient text-4xl font-black absolute inset-0 flex items-center justify-center">3</span>
                </div>
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center mx-auto mb-4 luxury-shadow-sm">
                  <Navigation className="w-8 h-8 text-[#667eea]" />
                </div>
                <h3 className="luxury-heading-sm mb-3">
                  {t.howItWorks.step3Title}
                </h3>
                <p className="luxury-text-body text-sm">
                  {t.howItWorks.step3Desc}
                </p>
                {/* Connector Arrow */}
                <div className="hidden lg:block absolute top-1/2 -right-8 transform -translate-y-1/2">
                  <div className="luxury-divider-vertical h-1 w-16 rotate-90"></div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="luxury-glass-card luxury-hover-lift p-6 text-center">
                <div className="w-20 h-20 rounded-full luxury-bg-primary flex items-center justify-center mx-auto mb-4 luxury-shadow-lg relative">
                  <span className="luxury-text-gradient text-4xl font-black absolute inset-0 flex items-center justify-center">4</span>
                </div>
                <div className="w-16 h-16 rounded-2xl luxury-bg-soft flex items-center justify-center mx-auto mb-4 luxury-shadow-sm">
                  <BarChart className="w-8 h-8 text-[#667eea]" />
                </div>
                <h3 className="luxury-heading-sm mb-3">
                  {t.howItWorks.step4Title}
                </h3>
                <p className="luxury-text-body text-sm">
                  {t.howItWorks.step4Desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* WALKER REQUIREMENTS */}
        <div className="luxury-section luxury-container">
          <div className="text-center mb-12">
            <h2 className="luxury-heading-lg mb-4">
              {t.requirements.title}
            </h2>
            <p className="luxury-text-body text-xl">
              {t.requirements.subtitle}
            </p>
          </div>

          <div className="luxury-grid-4 luxury-gap-md">
            {[
              t.requirements.req1,
              t.requirements.req2,
              t.requirements.req3,
              t.requirements.req4,
              t.requirements.req5,
              t.requirements.req6,
              t.requirements.req7,
              t.requirements.req8,
            ].map((req, index) => (
              <div key={index} className={`luxury-glass-minimal p-4 flex items-center gap-3 luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}>
                <div className="w-8 h-8 rounded-full luxury-bg-primary flex items-center justify-center flex-shrink-0 luxury-shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <span className="luxury-text-body text-sm">{req}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TESTIMONIALS */}
        <div className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-12">
              <h2 className="luxury-heading-lg mb-4">
                {t.testimonials.title}
              </h2>
            </div>

            <div className="luxury-grid-4 luxury-gap-lg">
              {[
                { name: t.testimonials.test1Name, text: t.testimonials.test1Text },
                { name: t.testimonials.test2Name, text: t.testimonials.test2Text },
                { name: t.testimonials.test3Name, text: t.testimonials.test3Text },
                { name: t.testimonials.test4Name, text: t.testimonials.test4Text },
              ].map((testimonial, index) => (
                <div key={index} className={`luxury-glass-card luxury-shadow-md p-6 luxury-hover-lift luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 10)}`}>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="luxury-text-body text-sm mb-4 italic">
                    "{testimonial.text}"
                  </p>
                  <div className="luxury-heading-sm text-sm">
                    {testimonial.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ALL WALKERS GRID */}
        <div id="walkers-results" className="luxury-section luxury-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="luxury-heading-lg">
                {t.allWalkers.title}
              </h2>
              <p className="luxury-text-body mt-2">
                {t.allWalkers.showing} {filteredWalkers?.length || 0} {t.allWalkers.walkers}
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              {t.filters.title}
            </Button>
          </div>

          {showFilters && (
            <div className="luxury-glass-panel luxury-shadow-md p-6 mb-8 luxury-animate-slide-up">
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-3 block">{t.filters.priceRange}</Label>
                  <Slider
                    value={priceRange}
                    onValueChange={setPriceRange}
                    min={0}
                    max={150}
                    step={10}
                    className="mb-2"
                    data-testid="slider-price-range"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                    <span>₪{priceRange[0]}</span>
                    <span>₪{priceRange[1]}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-lg font-semibold mb-3 block">{t.filters.specialties}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {SPECIALTIES.map((specialty) => (
                      <div key={specialty} className="flex items-center space-x-2">
                        <Checkbox
                          id={specialty}
                          checked={selectedSpecialties.includes(specialty)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedSpecialties([...selectedSpecialties, specialty]);
                            } else {
                              setSelectedSpecialties(selectedSpecialties.filter(s => s !== specialty));
                            }
                          }}
                          data-testid={`checkbox-specialty-${specialty.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                        <label htmlFor={specialty} className="text-sm cursor-pointer">
                          {specialty}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-lg font-semibold mb-3 block">{t.filters.dogSizes}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {DOG_SIZES.map((size) => (
                      <div key={size} className="flex items-center space-x-2">
                        <Checkbox
                          id={size}
                          checked={selectedDogSizes.includes(size)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDogSizes([...selectedDogSizes, size]);
                            } else {
                              setSelectedDogSizes(selectedDogSizes.filter(s => s !== size));
                            }
                          }}
                          data-testid={`checkbox-dogsize-${size.split(' ')[0].toLowerCase()}`}
                        />
                        <label htmlFor={size} className="text-sm cursor-pointer">
                          {size}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setPriceRange([0, 150]);
                  setSelectedSpecialties([]);
                  setSelectedDogSizes([]);
                  setInstantBookOnly(false);
                  setCertifiedOnly(false);
                  setAvailableToday(false);
                }}
                className="mt-4"
                data-testid="button-clear-filters"
              >
                {t.filters.clear}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="luxury-glass-card luxury-shadow-md p-12 text-center">
              <div className="luxury-spinner mx-auto mb-4"></div>
              <p className="luxury-text-body">Loading walkers...</p>
            </div>
          ) : (
            <div className="luxury-grid-3 luxury-gap-lg">
              {filteredWalkers?.map((walker) => (
                <WalkerCard key={walker.id} walker={walker} isHebrew={isHebrew} />
              ))}
            </div>
          )}
        </div>

        {/* FINAL CTA */}
        <div className="luxury-section luxury-bg-primary text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="luxury-heading-lg mb-4 text-white">
              {isHebrew ? 'מוכן להתחיל?' : 'Ready to Get Started?'}
            </h2>
            <p className="luxury-text-body text-xl mb-8 text-white/95">
              {isHebrew 
                ? 'הצטרף לאלפי בעלי כלבים מרוצים או התחל להרוויח כווקר מקצועי' 
                : 'Join thousands of happy dog owners or start earning as a professional walker'}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button 
                className="luxury-btn-secondary luxury-shadow-xl text-lg px-8 py-6"
                onClick={() => {
                  const resultsSection = document.getElementById('walkers-results');
                  resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                data-testid="button-final-find-walker"
              >
                {isHebrew ? 'מצא ווקר עכשיו' : 'Find a Walker Now'}
              </button>
              
              <Link href="/provider-onboarding?type=walker">
                <button 
                  className="luxury-btn-primary luxury-shadow-xl text-lg px-8 py-6"
                  data-testid="button-final-become-walker"
                >
                  {isHebrew ? 'הצטרף כווקר' : 'Join as Walker'}
                </button>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

// Earnings Calculator Component
function EarningsCalculator({ isHebrew, t }: { isHebrew: boolean; t: any }) {
  const [walksPerWeek, setWalksPerWeek] = useState(10);
  const [avgRate, setAvgRate] = useState(80);
  const [avgDuration, setAvgDuration] = useState(60);

  const weeklyEarnings = (walksPerWeek * avgRate * (avgDuration / 60) * 0.76);
  const monthlyEarnings = weeklyEarnings * 4.33;
  const yearlyEarnings = monthlyEarnings * 12;

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <Label className="text-lg font-semibold mb-3 block">{t.walksPerWeek}: {walksPerWeek}</Label>
          <Slider
            value={[walksPerWeek]}
            onValueChange={(val) => setWalksPerWeek(val[0])}
            min={1}
            max={30}
            step={1}
            data-testid="slider-walks-per-week"
          />
        </div>

        <div>
          <Label className="text-lg font-semibold mb-3 block">{t.avgRate}: ₪{avgRate}</Label>
          <Slider
            value={[avgRate]}
            onValueChange={(val) => setAvgRate(val[0])}
            min={50}
            max={150}
            step={5}
            data-testid="slider-avg-rate"
          />
        </div>

        <div>
          <Label className="text-lg font-semibold mb-3 block">{t.avgDuration}: {avgDuration}</Label>
          <Slider
            value={[avgDuration]}
            onValueChange={(val) => setAvgDuration(val[0])}
            min={30}
            max={120}
            step={15}
            data-testid="slider-avg-duration"
          />
        </div>
      </div>

      <div className="space-y-4">
        <GlassCard className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t.weeklyEarnings}</div>
          <div className="text-4xl font-black text-green-600 dark:text-green-400">
            ₪{weeklyEarnings.toFixed(0)}
          </div>
        </GlassCard>

        <GlassCard className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t.monthlyEarnings}</div>
          <div className="text-4xl font-black text-blue-600 dark:text-blue-400">
            ₪{monthlyEarnings.toFixed(0)}
          </div>
        </GlassCard>

        <GlassCard className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t.yearlyEarnings}</div>
          <div className="text-4xl font-black text-purple-600 dark:text-purple-400">
            ₪{yearlyEarnings.toFixed(0)}
          </div>
        </GlassCard>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {t.afterPlatformFee}
        </p>
      </div>
    </div>
  );
}

// Walker Card Component
function WalkerCard({ walker, isHebrew }: { walker: WalkerProfile; isHebrew: boolean }) {
  return (
    <div className="luxury-glass-card luxury-shadow-md luxury-hover-glow p-0 overflow-hidden luxury-animate-fade-in">
      <div className="aspect-[4/3] luxury-bg-soft flex items-center justify-center relative overflow-hidden">
        {walker.profilePhotoUrl ? (
          <div className="w-full h-full relative">
            <div className="absolute inset-0 luxury-bg-primary opacity-10"></div>
            <img src={walker.profilePhotoUrl} alt={walker.fullName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full luxury-bg-primary flex items-center justify-center luxury-shadow-lg relative"
            style={{
              border: '4px solid transparent',
              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #667eea, #764ba2)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box'
            }}>
            <div className="text-5xl font-black text-white">
              {walker.fullName.charAt(0)}
            </div>
          </div>
        )}
        {walker.available && (
          <div className="luxury-badge-success absolute top-3 left-3 px-3 py-1 text-xs font-bold">
            {isHebrew ? 'זמין' : 'Available'}
          </div>
        )}
        {walker.instantBook && (
          <div className="luxury-badge absolute top-3 right-3 flex items-center gap-1 px-3 py-1 text-xs font-bold">
            <Zap className="w-3 h-3" />
            {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <h3 className="luxury-heading-sm flex items-center gap-2">
            {walker.fullName}
            {walker.verified && <CheckCircle2 className="w-4 h-4 text-[#667eea]" />}
          </h3>
          <div className="flex items-center gap-1 luxury-text-small">
            <MapPin className="w-4 h-4" />
            {walker.city}
          </div>
        </div>

        <p className="luxury-text-body text-sm line-clamp-2">
          {walker.bio}
        </p>

        <div className="flex flex-wrap gap-1">
          {walker.specialties.slice(0, 3).map((spec) => (
            <span key={spec} className="luxury-badge text-xs px-2 py-1">
              {spec}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="luxury-badge luxury-badge-gold flex items-center gap-1 px-2 py-1">
            <Star className="w-3 h-3" />
            <span className="text-xs font-bold">{walker.rating}</span>
          </div>
          <span className="luxury-text-small">({walker.totalReviews})</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="luxury-text-small">
            {walker.experienceYears} {isHebrew ? 'שנות ניסיון' : 'years exp'}
          </div>
          {walker.completedWalks && (
            <div className="luxury-text-small">
              {walker.completedWalks} {isHebrew ? 'הליכות' : 'walks'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="luxury-heading-lg luxury-text-gradient">
            ₪{walker.hourlyRateIls}
            <span className="text-sm luxury-text-body">/hr</span>
          </div>
          <button className="luxury-btn-ghost p-2" data-testid={`button-favorite-${walker.id}`}>
            <Heart className="w-5 h-5" />
          </button>
        </div>

        <Link href={`/walk-my-pet/book/${walker.id}`}>
          <button className="luxury-btn-primary w-full" data-testid={`button-book-walker-${walker.id}`}>
            {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
          </button>
        </Link>
      </div>
    </div>
  );
}
