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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-pink-900/20">
        
        {/* 7-STAR LUXURY HERO SECTION - Burj Al Arab Inspired */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-900 via-yellow-600 to-amber-700 text-white py-32">
          {/* Premium Gold Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/40 via-amber-500/30 to-yellow-900/40"></div>
          
          {/* Animated Luxury Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] animate-pulse"></div>
          </div>
          
          {/* Premium Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left: Headline + CTAs */}
              <div className="space-y-8">
                <div className="space-y-6">
                  {/* Premium Badge */}
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-xl border border-yellow-300/30 px-6 py-3 rounded-full shadow-2xl">
                    <Crown className="w-6 h-6 text-yellow-300" />
                    <span className="text-sm font-bold tracking-wider text-yellow-100">7-STAR LUXURY SERVICE</span>
                  </div>
                  
                  <h1 className="text-6xl lg:text-7xl font-black leading-tight tracking-tight drop-shadow-2xl">
                    {t.hero.title}
                  </h1>
                  <p className="text-2xl lg:text-3xl text-yellow-100 font-light drop-shadow-lg">
                    {t.hero.subtitle}
                  </p>
                </div>

                {/* Premium Stats Grid - Glassmorphism */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">{t.stats.walkers.value}</div>
                    </div>
                    <div className="text-sm font-medium text-yellow-100 tracking-wide">{t.stats.walkers.label}</div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gradient-to-br from-blue-400 to-cyan-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">{t.stats.walks.value}</div>
                    </div>
                    <div className="text-sm font-medium text-yellow-100 tracking-wide">{t.stats.walks.label}</div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">{t.stats.rating.value}</div>
                    </div>
                    <div className="text-sm font-medium text-yellow-100 tracking-wide">{t.stats.rating.label}</div>
                  </div>
                  <div className="group bg-white/15 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/30 shadow-2xl hover:bg-white/20 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                        <Navigation className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-black text-white drop-shadow-lg">{t.stats.gps.value}</div>
                    </div>
                    <div className="text-sm font-medium text-yellow-100 tracking-wide">{t.stats.gps.label}</div>
                  </div>
                </div>

                {/* Premium CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    className="group bg-white text-amber-900 hover:bg-yellow-50 text-xl px-10 py-8 rounded-2xl shadow-2xl font-black tracking-wide hover:scale-105 transition-all duration-300 border-4 border-yellow-200"
                    onClick={() => {
                      const resultsSection = document.getElementById('walkers-results');
                      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    data-testid="button-find-walker"
                  >
                    <Search className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                    {isHebrew ? 'מצא ווקר' : 'Find a Walker'}
                    <Sparkles className="w-5 h-5 ml-2 text-yellow-600" />
                  </Button>
                  
                  <Link href="/provider-onboarding?type=walker">
                    <Button 
                      size="lg" 
                      className="group bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-500 hover:via-amber-600 hover:to-orange-600 text-white text-xl px-10 py-8 rounded-2xl shadow-2xl font-black tracking-wide hover:scale-105 transition-all duration-300 border-4 border-yellow-200"
                      data-testid="button-become-walker"
                    >
                      <Trophy className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="flex items-center gap-2">
                          {t.hero.becomeWalker}
                          <Medal className="w-5 h-5" />
                        </div>
                        <div className="text-sm font-semibold opacity-95">{t.hero.earnMoney}</div>
                      </div>
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: Search Card */}
              <div className="lg:block">
                <GlassCard className="p-8">
                  <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
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

                    <Button 
                      size="lg" 
                      className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg font-semibold shadow-xl"
                      onClick={() => {
                        const resultsSection = document.getElementById('walkers-results');
                        resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      data-testid="button-search"
                    >
                      {t.hero.searchNow}
                    </Button>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>

        {/* EMERGENCY WALK BANNER */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-8 relative z-10">
          <div className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 p-8 rounded-3xl shadow-2xl border-4 border-white/20">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
              {t.trust.title}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Navigation className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge1Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge1Desc}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                  <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge2Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge2Desc}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                  <Activity className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge3Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge3Desc}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge4Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge4Desc}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-pink-100 dark:bg-pink-900/30 p-3 rounded-xl">
                  <Video className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge5Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge5Desc}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 hover:scale-105 transition-transform">
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-xl">
                  <DollarSign className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t.trust.badge6Title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {t.trust.badge6Desc}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* FEATURED WALKERS */}
        {featuredWalkers && featuredWalkers.length > 0 && (
          <div className="bg-white dark:bg-gray-900/50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                  {t.featured.title}
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  {t.featured.subtitle}
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredWalkers.map((walker) => (
                  <GlassCard key={walker.id} className="p-0 overflow-hidden hover:scale-105 transition-transform">
                    <div className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center relative">
                      {walker.profilePhotoUrl ? (
                        <img src={walker.profilePhotoUrl} alt={walker.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-6xl font-black text-blue-600 dark:text-blue-400">
                          {walker.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        TOP
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {walker.fullName}
                          {walker.verified && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <MapPin className="w-4 h-4" />
                          {walker.city}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="font-bold">{walker.rating}</span>
                        </div>
                        <span className="text-sm text-gray-500">({walker.totalReviews} reviews)</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-600 dark:text-gray-300">
                          {walker.completedWalks} {t.featured.completed}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          ₪{walker.hourlyRateIls}
                          <span className="text-sm text-gray-500">/hr</span>
                        </div>
                      </div>

                      <Link href={`/walk-my-pet/book/${walker.id}`}>
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" data-testid={`button-book-${walker.id}`}>
                          {t.featured.bookNow}
                        </Button>
                      </Link>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EARNINGS CALCULATOR */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                {t.earnings.title}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                {t.earnings.subtitle}
              </p>
            </div>

            <EarningsCalculator isHebrew={isHebrew} t={t.earnings} />
          </GlassCard>
        </div>

        {/* HOW IT WORKS */}
        <div className="bg-white dark:bg-gray-900/50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                {t.howItWorks.title}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <GlassCard className="p-6 text-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {t.howItWorks.step1Title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {t.howItWorks.step1Desc}
                </p>
              </GlassCard>

              <GlassCard className="p-6 text-center">
                <div className="bg-purple-100 dark:bg-purple-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {t.howItWorks.step2Title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {t.howItWorks.step2Desc}
                </p>
              </GlassCard>

              <GlassCard className="p-6 text-center">
                <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Navigation className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {t.howItWorks.step3Title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {t.howItWorks.step3Desc}
                </p>
              </GlassCard>

              <GlassCard className="p-6 text-center">
                <div className="bg-pink-100 dark:bg-pink-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {t.howItWorks.step4Title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {t.howItWorks.step4Desc}
                </p>
              </GlassCard>
            </div>
          </div>
        </div>

        {/* WALKER REQUIREMENTS */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
              {t.requirements.title}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t.requirements.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <GlassCard key={index} className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-200">{req}</span>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* TESTIMONIALS */}
        <div className="bg-white dark:bg-gray-900/50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                {t.testimonials.title}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: t.testimonials.test1Name, text: t.testimonials.test1Text },
                { name: t.testimonials.test2Name, text: t.testimonials.test2Text },
                { name: t.testimonials.test3Name, text: t.testimonials.test3Text },
                { name: t.testimonials.test4Name, text: t.testimonials.test4Text },
              ].map((testimonial, index) => (
                <GlassCard key={index} className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 mb-4 italic">
                    "{testimonial.text}"
                  </p>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>

        {/* ALL WALKERS GRID */}
        <div id="walkers-results" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t.allWalkers.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
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
            <GlassCard className="p-6 mb-8">
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
            </GlassCard>
          )}

          {isLoading ? (
            <div className="text-center py-12">Loading walkers...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWalkers?.map((walker) => (
                <WalkerCard key={walker.id} walker={walker} isHebrew={isHebrew} />
              ))}
            </div>
          )}
        </div>

        {/* FINAL CTA */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-black mb-4">
              {isHebrew ? 'מוכן להתחיל?' : 'Ready to Get Started?'}
            </h2>
            <p className="text-xl mb-8 text-white/90">
              {isHebrew 
                ? 'הצטרף לאלפי בעלי כלבים מרוצים או התחל להרוויח כווקר מקצועי' 
                : 'Join thousands of happy dog owners or start earning as a professional walker'}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-blue-700 hover:bg-gray-100 text-lg px-8 py-6 rounded-xl shadow-2xl font-semibold"
                onClick={() => {
                  const resultsSection = document.getElementById('walkers-results');
                  resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                data-testid="button-final-find-walker"
              >
                {isHebrew ? 'מצא ווקר עכשיו' : 'Find a Walker Now'}
              </Button>
              
              <Link href="/provider-onboarding?type=walker">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white text-lg px-8 py-6 rounded-xl shadow-2xl font-semibold"
                  data-testid="button-final-become-walker"
                >
                  {isHebrew ? 'הצטרף כווקר' : 'Join as Walker'}
                </Button>
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
    <GlassCard className="p-0 overflow-hidden hover:scale-105 transition-transform">
      <div className="aspect-[4/3] bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center relative">
        {walker.profilePhotoUrl ? (
          <img src={walker.profilePhotoUrl} alt={walker.fullName} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl font-black text-blue-600 dark:text-blue-400">
            {walker.fullName.charAt(0)}
          </div>
        )}
        {walker.available && (
          <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            {isHebrew ? 'זמין' : 'Available'}
          </div>
        )}
        {walker.instantBook && (
          <div className="absolute top-3 right-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {isHebrew ? 'הזמנה מיידית' : 'Instant Book'}
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {walker.fullName}
            {walker.verified && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4" />
            {walker.city}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {walker.bio}
        </p>

        <div className="flex flex-wrap gap-1">
          {walker.specialties.slice(0, 3).map((spec) => (
            <Badge key={spec} variant="secondary" className="text-xs">
              {spec}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="font-bold">{walker.rating}</span>
          </div>
          <span className="text-sm text-gray-500">({walker.totalReviews} reviews)</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-300">
            {walker.experienceYears} {isHebrew ? 'שנות ניסיון' : 'years exp'}
          </div>
          {walker.completedWalks && (
            <div className="text-gray-600 dark:text-gray-300">
              {walker.completedWalks} {isHebrew ? 'הליכות' : 'walks'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ₪{walker.hourlyRateIls}
            <span className="text-sm text-gray-500">/hr</span>
          </div>
          <Button size="icon" variant="ghost" data-testid={`button-favorite-${walker.id}`}>
            <Heart className="w-5 h-5" />
          </Button>
        </div>

        <Link href={`/walk-my-pet/book/${walker.id}`}>
          <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" data-testid={`button-book-walker-${walker.id}`}>
            {isHebrew ? 'הזמן עכשיו' : 'Book Now'}
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}
