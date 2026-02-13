/**
 * ⁦Pet Wash™⁩ Provider Application Form - MadPaws-Style 2026 Edition
 * 
 * Premium marketplace application form with:
 * - Multi-platform selection (like MadPaws but for 9 platforms)
 * - Provider-defined pricing wizard
 * - Luxury Gucci-inspired black/white aesthetic
 * - Comprehensive legal acknowledgements
 * - Mobile-first responsive design
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, CheckCircle2, Star, Shield, Heart, 
  Car, Home, Dog, Scissors, GraduationCap, Building,
  ArrowRight, ArrowLeft, Sparkles, Crown, Send,
  Camera, Upload, User, X, Droplets, Sun, Search,
  Check, DollarSign, Calendar, Info, MapPin
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { PhoneInput } from '@/components/PhoneInput';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// MadPaws-style platforms with flexible pricing
const PLATFORMS = [
  { 
    id: 'sitter_suite', 
    icon: Home, 
    nameEn: '⁦The Sitter Suite™⁩', 
    nameHe: 'סוויטת השמרטף™',
    descEn: 'Overnight pet sitting in a loving home',
    descHe: 'שמירה על חיות מחמד בבית אוהב',
    color: 'from-rose-500 to-pink-600',
    priceType: 'nightly',
    suggestedRate: 15000, // 150 ILS in agorot
  },
  { 
    id: 'walk_my_pet', 
    icon: Dog, 
    nameEn: '⁦Walk My Pet™⁩', 
    nameHe: 'טייל את הכלב שלי™',
    descEn: 'Professional dog walking services',
    descHe: 'שירותי טיול כלבים מקצועיים',
    color: 'from-emerald-500 to-teal-600',
    priceType: 'hourly',
    suggestedRate: 5000, // 50 ILS
  },
  { 
    id: 'pet_trek', 
    icon: Car, 
    nameEn: '⁦PetTrek™⁩', 
    nameHe: 'פט-טרק™',
    descEn: 'Safe pet transportation',
    descHe: 'הסעות חיות מחמד בטוחות',
    color: 'from-blue-500 to-indigo-600',
    priceType: 'trip',
    suggestedRate: 8000, // 80 ILS
  },
  { 
    id: 'groomers', 
    icon: Scissors, 
    nameEn: 'Groomers', 
    nameHe: 'מטפחים',
    descEn: 'Professional pet grooming',
    descHe: 'טיפוח חיות מחמד מקצועי',
    color: 'from-purple-500 to-violet-600',
    priceType: 'session',
    suggestedRate: 12000, // 120 ILS
  },
  { 
    id: 'training_academy', 
    icon: GraduationCap, 
    nameEn: 'Training Academy', 
    nameHe: 'אקדמיית אילוף',
    descEn: 'Expert pet training',
    descHe: 'אילוף חיות מחמד מקצועי',
    color: 'from-amber-500 to-orange-600',
    priceType: 'session',
    suggestedRate: 20000, // 200 ILS
  },
  { 
    id: 'daycare', 
    icon: Sun, 
    nameEn: 'Pet Daycare', 
    nameHe: 'מעון יום לחיות',
    descEn: 'Day care for your furry friends',
    descHe: 'מעון יום לחברים הפרוותיים',
    color: 'from-yellow-500 to-amber-600',
    priceType: 'daily',
    suggestedRate: 10000, // 100 ILS
  },
] as const;

const applicationSchema = z.object({
  firstName: z.string().min(2, { message: "First name is required" }),
  lastName: z.string().min(2, { message: "Last name is required" }),
  email: z.string().email({ message: "Valid email required" }),
  phoneNumber: z.string().min(9, { message: "Valid phone number required" }),
  idNumber: z.string().min(5, { message: "ID / Passport / License number is required" }),
  streetAddress: z.string().min(3, { message: "Street address is required" }),
  city: z.string().min(2, { message: "City is required" }),
  postalCode: z.string().optional(),
  country: z.string().default("Israel"),
  selectedPlatforms: z.array(z.string()).min(1, { message: "Select at least one platform" }),
  yearsExperience: z.string().optional(),
  hasOwnTransport: z.boolean().default(false),
  hasPetFirstAid: z.boolean().default(false),
  hasInsurance: z.boolean().default(false),
  availabilityNotes: z.string().optional(),
  aboutMe: z.string().min(20, { message: "Please tell us about yourself (min 20 characters)" }),
  whyJoinPetWash: z.string().min(20, { message: "Please tell us why you want to join (min 20 characters)" }),
  referralSource: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, { message: "Required" }),
  agreeToPrivacy: z.boolean().refine(val => val === true, { message: "Required" }),
  agreeToContractorStatus: z.boolean().refine(val => val === true, { message: "Required" }),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

const WORLD_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait',
  'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
  'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

export default function ProviderApplicationForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [pricing, setPricing] = useState<Record<string, { baseRate: number; additionalPet: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const handleProfilePhotoChange = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: isHebrew ? 'קובץ גדול מדי' : 'File Too Large',
          description: isHebrew ? 'גודל הקובץ המקסימלי הוא 5MB' : 'Maximum file size is 5MB',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setProfilePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const form = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      idNumber: "",
      streetAddress: "",
      city: "",
      postalCode: "",
      country: "Israel",
      selectedPlatforms: [],
      yearsExperience: "",
      hasOwnTransport: false,
      hasPetFirstAid: false,
      hasInsurance: false,
      availabilityNotes: "",
      aboutMe: "",
      whyJoinPetWash: "",
      referralSource: "",
      agreeToTerms: false,
      agreeToPrivacy: false,
      agreeToContractorStatus: false,
    },
  });

  const t = {
    title: isHebrew ? 'הפוך לספק שירות' : 'Become a Provider',
    subtitle: isHebrew 
      ? 'הצטרף למשפחת ⁦Pet Wash™⁩ והתחל להרוויח! הפלטפורמה המובילה לשירותי חיות מחמד בישראל'
      : 'Join the ⁦Pet Wash™⁩ family and start earning! The leading pet services platform in Israel',
    step1Title: isHebrew ? 'בחר את הפלטפורמות שלך' : 'Choose Your Platforms',
    step1Desc: isHebrew ? 'בחר אחד או יותר שירותים שתרצה להציע' : 'Select one or more services you\'d like to offer',
    step2Title: isHebrew ? 'קבע את המחירים שלך' : 'Set Your Prices',
    step2Desc: isHebrew ? 'אתה שולט במחירים - קבע תעריפים תחרותיים' : 'You\'re in control - set competitive rates',
    step3Title: isHebrew ? 'פרטים אישיים' : 'Personal Details',
    step4Title: isHebrew ? 'ניסיון ופרופיל' : 'Experience & Profile',
    step5Title: isHebrew ? 'הסכמים משפטיים' : 'Legal Agreements',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    email: isHebrew ? 'אימייל' : 'Email',
    phone: isHebrew ? 'טלפון' : 'Phone',
    idNumber: isHebrew ? 'תעודת זהות / פספורט / רישיון נהיגה' : 'ID / Passport / Driver\'s License',
    idNumberPlaceholder: isHebrew ? 'מספר תעודה מזהה' : 'ID number',
    streetAddress: isHebrew ? 'כתובת רחוב' : 'Street Address',
    city: isHebrew ? 'עיר' : 'City',
    postalCode: isHebrew ? 'מיקוד' : 'Postal Code',
    country: isHebrew ? 'מדינה' : 'Country',
    addressSection: isHebrew ? 'כתובת' : 'Address',
    addressHint: isHebrew ? 'הקלד כתובת והמערכת תמלא אוטומטית את כל השדות' : 'Start typing and the system will auto-fill all fields',
    experience: isHebrew ? 'שנות ניסיון' : 'Years of Experience',
    hasTransport: isHebrew ? 'יש לי רכב (אופציונלי)' : 'I have my own vehicle (Optional)',
    hasFirstAid: isHebrew ? 'תעודת עזרה ראשונה לבעלי חיים (מומלץ - לא חובה)' : 'Pet first aid certification (Recommended - Not required)',
    hasInsurance: isHebrew ? 'ביטוח אחריות (אופציונלי)' : 'Liability insurance (Optional)',
    availability: isHebrew ? 'זמינות ושעות העדפה' : 'Availability & Preferred Hours',
    aboutMe: isHebrew ? 'ספר/י על עצמך' : 'Tell us about yourself',
    aboutMeHint: isHebrew ? 'ספר על הניסיון שלך עם חיות מחמד ולמה אתה אוהב לעבוד איתן' : 'Share your experience with pets and why you love working with them',
    whyJoin: isHebrew ? 'למה Pet Wash?' : 'Why Pet Wash?',
    whyJoinHint: isHebrew ? 'מה מושך אותך להצטרף לפלטפורמה שלנו?' : 'What attracts you to joining our platform?',
    referral: isHebrew ? 'איך שמעת עלינו?' : 'How did you hear about us?',
    terms: isHebrew ? 'אני מסכים/ה לתנאי השימוש' : 'I agree to the Terms of Service',
    privacy: isHebrew ? 'אני מסכים/ה למדיניות הפרטיות ושמירת הנתונים' : 'I agree to the Privacy Policy and Data Retention',
    contractor: isHebrew 
      ? 'אני מבין/ה שאני קבלן עצמאי ולא עובד של ⁦Pet Wash™⁩' 
      : 'I understand I am an independent contractor, not an employee of ⁦Pet Wash™⁩',
    next: isHebrew ? 'המשך' : 'Continue',
    back: isHebrew ? 'חזרה' : 'Back',
    submit: isHebrew ? 'הגש בקשה' : 'Submit Application',
    submitting: isHebrew ? 'שולח...' : 'Submitting...',
    successTitle: isHebrew ? 'הבקשה התקבלה!' : 'Application Received!',
    successMessage: isHebrew 
      ? 'תודה! הצוות שלנו יבדוק את הבקשה ויצור קשר תוך 48 שעות עסקיות.'
      : 'Thank you! Our team will review your application and contact you within 48 business hours.',
    profilePhoto: isHebrew ? 'תמונת פרופיל' : 'Profile Photo',
    uploadPhoto: isHebrew ? 'העלה תמונה' : 'Upload Photo',
    baseRate: isHebrew ? 'תעריף בסיס' : 'Base Rate',
    perNight: isHebrew ? 'ללילה' : 'per night',
    perHour: isHebrew ? 'לשעה' : 'per hour',
    perTrip: isHebrew ? 'לנסיעה' : 'per trip',
    perSession: isHebrew ? 'למפגש' : 'per session',
    perDay: isHebrew ? 'ליום' : 'per day',
    additionalPet: isHebrew ? 'תוספת לחיה נוספת' : 'Additional pet surcharge',
    suggested: isHebrew ? 'מומלץ' : 'Suggested',
    commission: isHebrew ? '15% עמלת פלטפורמה' : '15% platform commission',
    youEarn: isHebrew ? 'אתה מרוויח' : 'You earn',
  };

  const handlePlatformToggle = (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(p => p !== platformId)
      : [...selectedPlatforms, platformId];
    setSelectedPlatforms(newPlatforms);
    form.setValue('selectedPlatforms', newPlatforms);
    
    // Initialize pricing for new platform
    if (!pricing[platformId]) {
      const platform = PLATFORMS.find(p => p.id === platformId);
      if (platform) {
        setPricing(prev => ({
          ...prev,
          [platformId]: { baseRate: platform.suggestedRate, additionalPet: 2500 }
        }));
      }
    }
  };

  const updatePricing = (platformId: string, field: 'baseRate' | 'additionalPet', value: number) => {
    setPricing(prev => ({
      ...prev,
      [platformId]: { ...prev[platformId], [field]: value }
    }));
  };

  const formatCurrency = (agorot: number) => {
    return `₪${(agorot / 100).toFixed(0)}`;
  };

  const getPriceLabel = (priceType: string) => {
    switch (priceType) {
      case 'nightly': return t.perNight;
      case 'hourly': return t.perHour;
      case 'trip': return t.perTrip;
      case 'session': return t.perSession;
      case 'daily': return t.perDay;
      default: return '';
    }
  };

  const onSubmit = async (data: ApplicationForm) => {
    console.log('[ProviderApplication] Form submit triggered with data:', data);
    setIsSubmitting(true);
    try {
      // Convert first selected platform to legacy providerType
      const legacyType = selectedPlatforms[0]?.replace('_suite', '').replace('_my_pet', '').replace('_academy', '') || 'sitter';
      
      const submitData = {
        ...data,
        providerType: legacyType,
        selectedPlatforms,
        intendedPricing: pricing,
        profilePhotoBase64: profilePhoto || undefined,
      };
      
      console.log('[ProviderApplication] Sending API request...');
      const response = await apiRequest('POST', '/api/provider-intake/submit', submitData);
      const result = await response.json();
      console.log('[ProviderApplication] API response:', result);

      if (result.success) {
        setSubmitted(true);
        queryClient.invalidateQueries({ queryKey: ['/api/provider-intake'] });
        toast({
          title: t.successTitle,
          description: t.successMessage,
        });
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (error: any) {
      console.error('[ProviderApplication] Submission error:', error);
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'שגיאה בשליחת הבקשה' : 'Failed to submit application'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen - Luxury Dark Theme
  if (submitted) {
    return (
      <div className={`min-h-screen relative overflow-hidden ${isHebrew ? 'rtl' : 'ltr'}`}>
        {/* Luxury Dark Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" />
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(52, 211, 153, 0.25) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(16, 185, 129, 0.2) 0%, transparent 50%)'
        }} />
        
        <div className="relative z-10 py-12 px-4">
          <div className="max-w-2xl mx-auto">
            <div 
              className="rounded-3xl p-10 text-center backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="h-14 w-14 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                {t.successTitle}
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                {t.successMessage}
              </p>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Crown className="h-6 w-6 text-amber-400" />
                  <span className="font-semibold text-lg text-white">
                    {isHebrew ? 'מה הלאה?' : 'What\'s Next?'}
                  </span>
                </div>
                <ol className={`text-${isHebrew ? 'right' : 'left'} space-y-3 text-gray-300`}>
                  <li className="flex items-start gap-3">
                    <span className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                    <span>{isHebrew ? 'השלם את אימות הזהות הביומטרי' : 'Complete biometric identity verification'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                    <span>{isHebrew ? 'העלה את המסמכים הנדרשים' : 'Upload required documents'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                    <span>{isHebrew ? 'לאחר אימות מוצלח - תאושר אוטומטית ותתחיל לקבל הזמנות!' : 'After successful verification - get auto-approved and start receiving bookings!'}</span>
                  </li>
                </ol>
              </div>
              
              <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8 py-4 rounded-2xl font-semibold shadow-xl shadow-amber-500/25 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                <ArrowRight className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  return (
    <div className={`min-h-screen relative overflow-hidden ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* Luxury Dark Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(198, 166, 100, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)'
      }} />
      
      <div className="relative z-10 py-8 px-4">
        <div className="max-w-4xl mx-auto">
        
          {/* Header */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
              <ArrowLeft className={`h-4 w-4 ${isHebrew ? 'rotate-180' : ''}`} />
              {isHebrew ? 'חזרה' : 'Back'}
            </Link>
            
            {/* Luxury Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">
                {isHebrew ? 'הצטרף לצוות המובחר' : 'Join Our Elite Team'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              {isHebrew ? 'הפוך לספק ' : 'Become a '}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                ⁦Pet Wash™⁩
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {t.subtitle}
            </p>
          </div>

          {/* Luxury Progress Steps */}
          <div className="mb-10">
            <div className="flex items-center justify-between max-w-3xl mx-auto px-4">
              {[1, 2, 3, 4, 5].map((s, index) => (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold transition-all duration-300 ${
                        step > s 
                          ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/30'
                          : step === s 
                            ? 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/30'
                            : 'bg-slate-700/50 border border-slate-600 text-slate-400'
                      }`}
                    >
                      {step > s ? <Check className="h-6 w-6 text-white" /> : <span className={step === s ? 'text-white' : ''}>{s}</span>}
                    </div>
                  </div>
                  
                  {/* Connector Line */}
                  {index < 4 && (
                    <div className={`w-8 sm:w-16 lg:w-24 h-0.5 mx-2 sm:mx-4 transition-all duration-300 ${
                      step > s 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                        : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            {/* Progress Text */}
            <p className="text-center text-amber-400 mt-6 font-medium">
              {isHebrew ? `שלב ${step} מתוך 5` : `Step ${step} of 5`}
            </p>
          </div>

          {/* Luxury Glass Form Card */}
          <div 
            className="rounded-3xl p-6 md:p-10 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
            }}
          >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error('[ProviderApplication] Form validation errors:', errors);
              toast({
                variant: 'destructive',
                title: isHebrew ? 'שגיאה בטופס' : 'Form Error',
                description: isHebrew ? 'אנא מלא את כל השדות הנדרשים' : 'Please fill in all required fields',
              });
            })}>
              
              {/* Step 1: Platform Selection - Multi-Select */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Home className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {t.step1Title}
                      </h2>
                      <p className="text-gray-400 text-sm">{t.step1Desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30">
                      <Sparkles className="h-4 w-4 text-blue-400" />
                      <span className="text-blue-300 text-sm font-medium">
                        {isHebrew ? 'ניתן לבחור מספר שירותים!' : 'You can select multiple services!'}
                      </span>
                    </div>
                    {selectedPlatforms.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-300 text-sm font-bold">
                          {selectedPlatforms.length} {isHebrew ? 'נבחרו' : 'selected'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PLATFORMS.map((platform) => {
                      const Icon = platform.icon;
                      const isSelected = selectedPlatforms.includes(platform.id);
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => handlePlatformToggle(platform.id)}
                          className={`relative p-6 rounded-2xl border transition-all duration-300 text-${isHebrew ? 'right' : 'left'} ${
                            isSelected 
                              ? `border-amber-500/50 bg-gradient-to-br ${platform.color} text-white shadow-xl shadow-amber-500/20 scale-[1.02]` 
                              : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 hover:shadow-lg backdrop-blur-sm'
                          }`}
                          data-testid={`platform-${platform.id}`}
                        >
                          <div className={`absolute top-3 ${isHebrew ? 'left-3' : 'right-3'} w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            isSelected 
                              ? 'bg-white/30' 
                              : 'bg-white/10 border border-white/20'
                          }`}>
                            {isSelected ? (
                              <Check className="h-5 w-5 text-white" />
                            ) : (
                              <div className="w-4 h-4 rounded border-2 border-white/30" />
                            )}
                          </div>
                          <Icon className={`h-10 w-10 mb-3 ${isSelected ? 'text-white' : 'text-gray-300'}`} />
                          <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-white'}`}>
                            {isHebrew ? platform.nameHe : platform.nameEn}
                          </h3>
                          <p className={`text-sm mt-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                            {isHebrew ? platform.descHe : platform.descEn}
                          </p>
                          <div className={`mt-3 text-sm ${isSelected ? 'text-white/90' : 'text-amber-400'}`}>
                            {t.suggested}: {formatCurrency(platform.suggestedRate)} {getPriceLabel(platform.priceType)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPlatforms.length === 0 && (
                    <p className="text-center text-amber-400 text-sm">
                      {isHebrew ? 'בחר לפחות פלטפורמה אחת להמשך' : 'Select at least one platform to continue'}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Pricing Wizard */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {t.step2Title}
                      </h2>
                      <p className="text-gray-400 text-sm">{t.step2Desc}</p>
                    </div>
                  </div>
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
                    <Info className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-300 text-sm">{t.commission}</span>
                  </div>

                  <div className="space-y-6">
                    {selectedPlatforms.map((platformId) => {
                      const platform = PLATFORMS.find(p => p.id === platformId);
                      if (!platform) return null;
                      const Icon = platform.icon;
                      const currentPricing = pricing[platformId] || { baseRate: platform.suggestedRate, additionalPet: 2500 };
                      const providerEarnings = Math.round(currentPricing.baseRate * 0.85);
                      
                      return (
                        <div 
                          key={platformId}
                          className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
                        >
                          <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${platform.color} shadow-lg`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white">
                                {isHebrew ? platform.nameHe : platform.nameEn}
                              </h3>
                              <p className="text-sm text-gray-400">
                                {isHebrew ? platform.descHe : platform.descEn}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t.baseRate} ({getPriceLabel(platform.priceType)})
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.baseRate / 100}
                                  onChange={(e) => updatePricing(platformId, 'baseRate', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                                  min={0}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-2 text-sm">
                                <span className="text-gray-500">{t.youEarn}:</span>
                                <span className="font-bold text-emerald-400">
                                  {formatCurrency(providerEarnings)}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t.additionalPet}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.additionalPet / 100}
                                  onChange={(e) => updatePricing(platformId, 'additionalPet', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                                  min={0}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Personal Details */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {t.step3Title}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'ספר לנו קצת על עצמך' : 'Tell us a bit about yourself'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 font-medium">{t.firstName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-firstName"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 font-medium">{t.lastName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-lastName"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 font-medium">{t.email} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 font-medium">{t.phone} *</FormLabel>
                          <FormControl>
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              language={isHebrew ? 'he' : 'en'}
                              defaultCountryCode="+972"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-gray-300 font-medium">{t.idNumber} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder={t.idNumberPlaceholder}
                              className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-id-number"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    {/* Address Section with Google Places Auto-Fill */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-amber-400" />
                        <span className="text-gray-300 font-medium">{t.addressSection} *</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{t.addressHint}</p>
                      
                      {/* Street Address with Google Places Autocomplete */}
                      <FormField
                        control={form.control}
                        name="streetAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <GooglePlacesAutocomplete
                                value={field.value}
                                onChange={(value, details) => {
                                  // Set street address from formatted address or the street
                                  const streetValue = details?.street 
                                    ? `${details.street}${details.streetNumber ? ' ' + details.streetNumber : ''}`
                                    : value;
                                  field.onChange(streetValue);
                                }}
                                onPlaceSelected={(place: PlaceDetails) => {
                                  // Auto-fill all address fields from Google Places
                                  const streetValue = place.street 
                                    ? `${place.street}${place.streetNumber ? ' ' + place.streetNumber : ''}`
                                    : place.formattedAddress;
                                  field.onChange(streetValue);
                                  
                                  // Auto-fill city
                                  if (place.city) {
                                    form.setValue('city', place.city);
                                  }
                                  
                                  // Auto-fill postal code
                                  if (place.postalCode) {
                                    form.setValue('postalCode', place.postalCode);
                                  }
                                  
                                  // Auto-fill country
                                  if (place.country) {
                                    form.setValue('country', place.country);
                                  }
                                }}
                                label={t.streetAddress}
                                placeholder={isHebrew ? 'הקלד כתובת מלאה...' : 'Start typing your full address...'}
                                required
                                country={['il']}
                                error={form.formState.errors.streetAddress?.message}
                                className="[&_label]:text-gray-300 [&_label]:font-medium [&_input]:h-12 [&_input]:bg-slate-800/50 [&_input]:border-slate-600 [&_input]:text-white [&_input]:placeholder:text-slate-500 [&_input]:focus:border-amber-500 [&_input]:focus:ring-amber-500/20 [&_input]:rounded-xl"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {/* City and Postal Code Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300 font-medium">{t.city} *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                                  placeholder={isHebrew ? 'עיר' : 'City'}
                                  data-testid="input-city"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300 font-medium">{t.postalCode}</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                                  placeholder={isHebrew ? 'מיקוד' : 'Postal Code'}
                                  data-testid="input-postal-code"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300 font-medium">{t.country}</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="h-12 bg-slate-800/50 border-slate-600 text-white focus:border-amber-500 focus:ring-amber-500/20 rounded-xl" data-testid="select-country">
                                    <SelectValue placeholder={isHebrew ? 'בחר מדינה' : 'Select country'} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {WORLD_COUNTRIES.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Profile Photo - Luxury Style */}
                  <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      {t.profilePhoto}
                    </label>
                    <div className="flex items-center gap-4">
                      {profilePhoto ? (
                        <div className="relative">
                          <img 
                            src={profilePhoto} 
                            alt="Profile" 
                            className="w-24 h-24 rounded-2xl object-cover border-2 border-amber-500/50 shadow-lg shadow-amber-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => setProfilePhoto(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 shadow-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-slate-800/50 flex items-center justify-center border-2 border-dashed border-slate-600">
                          <User className="h-10 w-10 text-slate-500" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoChange}
                          className="hidden"
                        />
                        <span className="inline-flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                          <Camera className="h-4 w-4 text-amber-400" />
                          {profilePhoto ? (isHebrew ? 'שנה תמונה' : 'Change') : t.uploadPhoto}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Experience & Profile */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Star className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {t.step4Title}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'ספר על הניסיון שלך' : 'Share your experience'}</p>
                    </div>
                  </div>

                  {/* Qualifications - Luxury Glass Card */}
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-400" />
                      {isHebrew ? 'הכשרות והסמכות' : 'Qualifications & Certifications'}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      {isHebrew 
                        ? 'סמן את הפריטים שמתאימים לך. כל אלה הם אופציונליים אבל יגדילו את הנראות של הפרופיל שלך.'
                        : 'Check any that apply to you. All are optional but will boost your profile visibility.'}
                    </p>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="hasOwnTransport"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-blue-400" />
                                {t.hasTransport}
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hasPetFirstAid"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Heart className="h-4 w-4 text-pink-400" />
                                {t.hasFirstAid}
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hasInsurance"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-emerald-400" />
                                {t.hasInsurance}
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="yearsExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">{t.experience}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min={0}
                            max={50}
                            className="h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aboutMe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">{t.aboutMe} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={4}
                            placeholder={t.aboutMeHint}
                            className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                            data-testid="textarea-aboutMe"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whyJoinPetWash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">{t.whyJoin} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t.whyJoinHint}
                            className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                            data-testid="textarea-whyJoin"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availabilityNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">{t.availability}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={2}
                            className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 5: Legal Agreements */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {t.step5Title}
                      </h2>
                      <p className="text-gray-400 text-sm">
                        {isHebrew ? 'אנא קרא ואשר את ההסכמים הבאים' : 'Please read and accept the following agreements'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Terms of Service */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                      <FormField
                        control={form.control}
                        name="agreeToTerms"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1 border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                data-testid="checkbox-terms"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-white font-medium cursor-pointer">
                                {t.terms} *
                              </FormLabel>
                              <p className="text-sm text-gray-400 mt-1">
                                <Link href="/legal/terms" className="text-amber-400 hover:text-amber-300 hover:underline">
                                  {isHebrew ? 'צפה בתנאי השימוש המלאים' : 'View full Terms of Service'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Privacy Policy */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                      <FormField
                        control={form.control}
                        name="agreeToPrivacy"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1 border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                data-testid="checkbox-privacy"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-white font-medium cursor-pointer">
                                {t.privacy} *
                              </FormLabel>
                              <p className="text-sm text-gray-400 mt-1">
                                <Link href="/legal/privacy" className="text-amber-400 hover:text-amber-300 hover:underline">
                                  {isHebrew ? 'צפה במדיניות הפרטיות המלאה' : 'View full Privacy Policy'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Independent Contractor Status */}
                    <div className="bg-amber-500/10 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30">
                      <FormField
                        control={form.control}
                        name="agreeToContractorStatus"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1 border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                data-testid="checkbox-contractor"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-amber-200 font-medium cursor-pointer">
                                {t.contractor} *
                              </FormLabel>
                              <p className="text-sm text-amber-300/80 mt-1">
                                {isHebrew 
                                  ? 'כספק שירותים עצמאי, אתה אחראי על המיסים, הביטוח והרישיונות שלך.'
                                  : 'As an independent service provider, you are responsible for your own taxes, insurance, and licenses.'}
                              </p>
                            </div>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 text-sm text-gray-400 border border-white/5">
                    <p>
                      {isHebrew 
                        ? '⁦Pet Wash™⁩ משמש כפלטפורמת תיווך בין בעלי חיות מחמד לספקי שירות עצמאיים. ⁦Pet Wash™⁩ אינה מעסיקה את הספקים ואינה אחראית ישירות לשירותים הניתנים.'
                        : '⁦Pet Wash™⁩ acts as a marketplace connecting pet owners with independent service providers. ⁦Pet Wash™⁩ does not employ providers and is not directly responsible for services rendered.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Luxury Navigation Buttons */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5"
                  >
                    <ArrowLeft className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
                    {t.back}
                  </button>
                )}
                
                <div className={step === 1 ? 'ml-auto' : ''}>
                  {step < 5 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 1 && selectedPlatforms.length === 0) {
                          toast({
                            variant: 'destructive',
                            title: isHebrew ? 'נדרשת בחירה' : 'Selection Required',
                            description: isHebrew ? 'בחר לפחות פלטפורמה אחת' : 'Select at least one platform',
                          });
                          return;
                        }
                        setStep(step + 1);
                      }}
                      className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-semibold shadow-xl shadow-amber-500/25 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]"
                      data-testid="button-next"
                    >
                      {t.next}
                      <ArrowRight className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-2xl font-semibold shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                      data-testid="button-submit"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t.submitting}
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          {t.submit}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>

        {/* Luxury Trust Badges */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center justify-center gap-8 px-6 py-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-2 text-gray-300">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium">{isHebrew ? 'מאובטח' : 'Secure'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Star className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium">{isHebrew ? 'מאומת' : 'Verified'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Heart className="h-5 w-5 text-pink-400" />
              <span className="text-sm font-medium">{isHebrew ? 'אמין' : 'Trusted'}</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
