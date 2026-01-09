/**
 * Pet Wash™ Provider Application Form - MadPaws-Style 2026 Edition
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
  Check, DollarSign, Calendar, Info
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

// MadPaws-style platforms with flexible pricing
const PLATFORMS = [
  { 
    id: 'sitter_suite', 
    icon: Home, 
    nameEn: 'The Sitter Suite™', 
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
    nameEn: 'Walk My Pet™', 
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
    nameEn: 'PetTrek™', 
    nameHe: 'פטטרק™',
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
  city: z.string().min(2, { message: "City is required" }),
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
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      city: "",
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
      ? 'הצטרף לפלטפורמה המובילה לשירותי חיות מחמד בישראל והרוויח בזמן שלך'
      : 'Join the leading pet services platform in Israel and earn on your schedule',
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
    city: isHebrew ? 'עיר' : 'City',
    experience: isHebrew ? 'שנות ניסיון' : 'Years of Experience',
    hasTransport: isHebrew ? 'יש לי רכב' : 'I have my own vehicle',
    hasFirstAid: isHebrew ? 'תעודת עזרה ראשונה לבעלי חיים' : 'Pet first aid certification',
    hasInsurance: isHebrew ? 'ביטוח אחריות' : 'Liability insurance',
    availability: isHebrew ? 'זמינות ושעות העדפה' : 'Availability & Preferred Hours',
    aboutMe: isHebrew ? 'ספר/י על עצמך' : 'Tell us about yourself',
    aboutMeHint: isHebrew ? 'ספר על הניסיון שלך עם חיות מחמד ולמה אתה אוהב לעבוד איתן' : 'Share your experience with pets and why you love working with them',
    whyJoin: isHebrew ? 'למה Pet Wash?' : 'Why Pet Wash?',
    whyJoinHint: isHebrew ? 'מה מושך אותך להצטרף לפלטפורמה שלנו?' : 'What attracts you to joining our platform?',
    referral: isHebrew ? 'איך שמעת עלינו?' : 'How did you hear about us?',
    terms: isHebrew ? 'אני מסכים/ה לתנאי השימוש' : 'I agree to the Terms of Service',
    privacy: isHebrew ? 'אני מסכים/ה למדיניות הפרטיות ושמירת הנתונים' : 'I agree to the Privacy Policy and Data Retention',
    contractor: isHebrew 
      ? 'אני מבין/ה שאני קבלן עצמאי ולא עובד של Pet Wash™' 
      : 'I understand I am an independent contractor, not an employee of Pet Wash™',
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

  // Success Screen
  if (submitted) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-12 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 p-10 text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="h-14 w-14 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t.successTitle}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              {t.successMessage}
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Crown className="h-6 w-6 text-amber-500" />
                <span className="font-semibold text-lg text-gray-900 dark:text-white">
                  {isHebrew ? 'מה הלאה?' : 'What\'s Next?'}
                </span>
              </div>
              <ol className={`text-${isHebrew ? 'right' : 'left'} space-y-3 text-gray-600 dark:text-gray-300`}>
                <li className="flex items-start gap-3">
                  <span className="bg-black text-white dark:bg-white dark:text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <span>{isHebrew ? 'הצוות שלנו יבדוק את הבקשה' : 'Our team will review your application'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-black text-white dark:bg-white dark:text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <span>{isHebrew ? 'נשלח לך הזמנה להמשיך את תהליך ההרשמה' : 'We\'ll send you an invitation to complete onboarding'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-black text-white dark:bg-white dark:text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <span>{isHebrew ? 'אחרי אישור - תתחיל לקבל הזמנות!' : 'After approval - start receiving bookings!'}</span>
                </li>
              </ol>
            </div>
            
            <Link href="/" className="inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity">
              {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
              <ArrowRight className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-8 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
            <ArrowLeft className={`h-4 w-4 ${isHebrew ? 'rotate-180' : ''}`} />
            {isHebrew ? 'חזרה' : 'Back'}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            {t.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    step >= s 
                      ? 'bg-black text-white dark:bg-white dark:text-black' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {step > s ? <Check className="h-5 w-5" /> : s}
                </div>
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-black dark:bg-white transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 md:p-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error('[ProviderApplication] Form validation errors:', errors);
              toast({
                variant: 'destructive',
                title: isHebrew ? 'שגיאה בטופס' : 'Form Error',
                description: isHebrew ? 'אנא מלא את כל השדות הנדרשים' : 'Please fill in all required fields',
              });
            })}>
              
              {/* Step 1: Platform Selection */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step1Title}
                    </h2>
                    <p className="text-gray-500">
                      {t.step1Desc}
                    </p>
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
                          className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-${isHebrew ? 'right' : 'left'} ${
                            isSelected 
                              ? `border-black dark:border-white bg-gradient-to-br ${platform.color} text-white shadow-xl scale-[1.02]` 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg'
                          }`}
                          data-testid={`platform-${platform.id}`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <Check className="h-6 w-6" />
                            </div>
                          )}
                          <Icon className={`h-10 w-10 mb-3 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                          <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {isHebrew ? platform.nameHe : platform.nameEn}
                          </h3>
                          <p className={`text-sm mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                            {isHebrew ? platform.descHe : platform.descEn}
                          </p>
                          <div className={`mt-3 text-sm ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                            {t.suggested}: {formatCurrency(platform.suggestedRate)} {getPriceLabel(platform.priceType)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPlatforms.length === 0 && (
                    <p className="text-center text-amber-600 dark:text-amber-400 text-sm">
                      {isHebrew ? 'בחר לפחות פלטפורמה אחת להמשך' : 'Select at least one platform to continue'}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Pricing Wizard */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step2Title}
                    </h2>
                    <p className="text-gray-500">
                      {t.step2Desc}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-400">
                      <Info className="h-4 w-4" />
                      <span>{t.commission}</span>
                    </div>
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
                          className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6"
                        >
                          <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${platform.color}`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-white">
                                {isHebrew ? platform.nameHe : platform.nameEn}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {isHebrew ? platform.descHe : platform.descEn}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t.baseRate} ({getPriceLabel(platform.priceType)})
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.baseRate / 100}
                                  onChange={(e) => updatePricing(platformId, 'baseRate', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
                                  min={0}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-2 text-sm">
                                <span className="text-gray-500">{t.youEarn}:</span>
                                <span className="font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(providerEarnings)}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t.additionalPet}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.additionalPet / 100}
                                  onChange={(e) => updatePricing(platformId, 'additionalPet', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step3Title}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">{t.firstName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                              data-testid="input-firstName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">{t.lastName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                              data-testid="input-lastName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">{t.email} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">{t.phone} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="tel"
                              className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-gray-700 dark:text-gray-300">{t.city} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Profile Photo */}
                  <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t.profilePhoto}
                    </label>
                    <div className="flex items-center gap-4">
                      {profilePhoto ? (
                        <div className="relative">
                          <img 
                            src={profilePhoto} 
                            alt="Profile" 
                            className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => setProfilePhoto(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                          <User className="h-10 w-10 text-gray-400" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoChange}
                          className="hidden"
                        />
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <Camera className="h-4 w-4" />
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
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step4Title}
                    </h2>
                  </div>

                  {/* Qualifications */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      {isHebrew ? 'הכשרות והסמכות' : 'Qualifications & Certifications'}
                    </h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="hasOwnTransport"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-700 dark:text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4" />
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
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-700 dark:text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Heart className="h-4 w-4" />
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
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-gray-700 dark:text-gray-300 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
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
                        <FormLabel className="text-gray-700 dark:text-gray-300">{t.experience}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min={0}
                            max={50}
                            className="py-3 rounded-xl border-gray-300 dark:border-gray-600"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aboutMe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-gray-300">{t.aboutMe} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={4}
                            placeholder={t.aboutMeHint}
                            className="rounded-xl border-gray-300 dark:border-gray-600 resize-none"
                            data-testid="textarea-aboutMe"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whyJoinPetWash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-gray-300">{t.whyJoin} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t.whyJoinHint}
                            className="rounded-xl border-gray-300 dark:border-gray-600 resize-none"
                            data-testid="textarea-whyJoin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availabilityNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-gray-300">{t.availability}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={2}
                            className="rounded-xl border-gray-300 dark:border-gray-600 resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 5: Legal Agreements */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step5Title}
                    </h2>
                    <p className="text-gray-500">
                      {isHebrew ? 'אנא קרא ואשר את ההסכמים הבאים' : 'Please read and accept the following agreements'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Terms of Service */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
                      <FormField
                        control={form.control}
                        name="agreeToTerms"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1"
                                data-testid="checkbox-terms"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-gray-900 dark:text-white font-medium cursor-pointer">
                                {t.terms} *
                              </FormLabel>
                              <p className="text-sm text-gray-500 mt-1">
                                <Link href="/legal/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                                  {isHebrew ? 'צפה בתנאי השימוש המלאים' : 'View full Terms of Service'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Privacy Policy */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
                      <FormField
                        control={form.control}
                        name="agreeToPrivacy"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1"
                                data-testid="checkbox-privacy"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-gray-900 dark:text-white font-medium cursor-pointer">
                                {t.privacy} *
                              </FormLabel>
                              <p className="text-sm text-gray-500 mt-1">
                                <Link href="/legal/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                                  {isHebrew ? 'צפה במדיניות הפרטיות המלאה' : 'View full Privacy Policy'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Independent Contractor Status */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
                      <FormField
                        control={form.control}
                        name="agreeToContractorStatus"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 mt-1"
                                data-testid="checkbox-contractor"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-amber-900 dark:text-amber-100 font-medium cursor-pointer">
                                {t.contractor} *
                              </FormLabel>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                {isHebrew 
                                  ? 'כספק שירותים עצמאי, אתה אחראי על המיסים, הביטוח והרישיונות שלך.'
                                  : 'As an independent service provider, you are responsible for your own taxes, insurance, and licenses.'}
                              </p>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                      {isHebrew 
                        ? 'Pet Wash™ משמש כפלטפורמת תיווך בין בעלי חיות מחמד לספקי שירות עצמאיים. Pet Wash™ אינה מעסיקה את הספקים ואינה אחראית ישירות לשירותים הניתנים.'
                        : 'Pet Wash™ acts as a marketplace connecting pet owners with independent service providers. Pet Wash™ does not employ providers and is not directly responsible for services rendered.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="flex items-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                      className="flex items-center gap-2 px-8 py-3 bg-black text-white dark:bg-white dark:text-black rounded-full font-semibold hover:opacity-90 transition-opacity"
                      data-testid="button-next"
                    >
                      {t.next}
                      <ArrowRight className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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

        {/* Trust Badges */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-6 text-gray-400">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm">{isHebrew ? 'מאובטח' : 'Secure'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              <span className="text-sm">{isHebrew ? 'מאומת' : 'Verified'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <span className="text-sm">{isHebrew ? 'אמין' : 'Trusted'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
