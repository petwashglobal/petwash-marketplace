/**
 * ⁦Pet Wash™⁩ Provider Application Form - 2026 Edition
 * 
 * Premium marketplace application form with:
 * - Multi-platform selection (9 platforms)
 * - Provider-defined pricing wizard
 * - Clean white/black high-contrast design
 * - Comprehensive legal acknowledgements
 * - Mobile-first responsive design
 */

import { useState, useEffect } from "react";
import { executeReCaptcha } from '@/components/ReCaptcha';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createGoogleProvider } from "@/lib/iosAuthHandler";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, CheckCircle2, Star, Shield, Heart, 
  Car, Home, Dog, Scissors, GraduationCap,
  ArrowRight, ArrowLeft, Sparkles, Crown, Send,
  Camera, User, X, Sun,
  Check, DollarSign, Info, MapPin, Mail,
  ScanLine, ShieldCheck, FileCheck, Upload, Clock, BadgeCheck
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useLanguage } from "@/lib/languageStore";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { PhoneInput } from '@/components/PhoneInput';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Pet Wash™ platforms with flexible pricing
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

function SubmitDocumentsButton({
  intakeId, firebaseUid, idFrontPhoto, idBackPhoto, selfieDocPhoto,
  drivingLicensePhoto, isHebrew, onSuccess,
}: {
  intakeId: string | null;
  firebaseUid: string;
  idFrontPhoto: string | null;
  idBackPhoto: string | null;
  selfieDocPhoto: string | null;
  drivingLicensePhoto: string | null;
  isHebrew: boolean;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/provider-intake/submit-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          intakeId,
          firebaseUid,
          idDocumentFrontBase64: idFrontPhoto,
          idDocumentBackBase64: idBackPhoto,
          selfieDocBase64: selfieDocPhoto,
          drivingLicenseBase64: drivingLicensePhoto,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: isHebrew ? 'המסמכים נשלחו בהצלחה!' : 'Documents submitted!',
          description: isHebrew ? 'אנחנו נבדוק אותם ונעדכן אותך בקרוב.' : 'We\'ll review them and update you shortly.',
        });
        onSuccess();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה בשליחת המסמכים' : 'Document submission failed',
        description: isHebrew ? 'נסה שוב מאוחר יותר' : 'Please try again later',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3.5 rounded-2xl font-semibold shadow-lg shadow-emerald-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
      {loading
        ? (isHebrew ? 'שולח...' : 'Submitting...')
        : (isHebrew ? 'שלח מסמכים לאימות' : 'Submit Documents for Verification')}
    </button>
  );
}

export default function ProviderApplicationForm() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user } = useFirebaseAuth();

  // Read ?type= URL param to pre-select a platform
  const preselectedType = new URLSearchParams(window.location.search).get('type');
  const initialPlatforms = preselectedType && PLATFORMS.some(p => p.id === preselectedType)
    ? [preselectedType]
    : [];

  const [step, setStep] = useState(user ? 1 : 0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialPlatforms);
  const [pricing, setPricing] = useState<Record<string, { baseRate: number; additionalPet: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [idFrontPhoto, setIdFrontPhoto] = useState<string | null>(null);
  const [idBackPhoto, setIdBackPhoto] = useState<string | null>(null);
  const [selfieDocPhoto, setSelfieDocPhoto] = useState<string | null>(null);
  const [drivingLicensePhoto, setDrivingLicensePhoto] = useState<string | null>(null);
  const [submittedIntakeId, setSubmittedIntakeId] = useState<string | null>(null);
  const [docsSubmittedWithForm, setDocsSubmittedWithForm] = useState(false);
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);

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

  const handleDocumentCapture = (setter: (v: string | null) => void) => (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'קובץ גדול מדי' : 'File Too Large',
        description: isHebrew ? 'גודל הקובץ המקסימלי הוא 10MB' : 'Maximum file size is 10MB',
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setter(reader.result as string);
    reader.readAsDataURL(file);
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
      selectedPlatforms: initialPlatforms,
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

  useEffect(() => {
    if (user) {
      const displayName = user.displayName || '';
      const nameParts = displayName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      if (firstName) form.setValue('firstName', firstName);
      if (lastName) form.setValue('lastName', lastName);
      if (user.email) form.setValue('email', user.email);
      if (user.photoURL) setProfilePhoto(user.photoURL);
      if (step === 0) setStep(1);
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const provider = createGoogleProvider();
      await signInWithPopup(auth, provider);
      toast({
        title: isHebrew ? 'התחברת בהצלחה!' : 'Signed in successfully!',
        description: isHebrew ? 'פרטיך מולאו אוטומטית' : 'Your details have been pre-filled',
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: isHebrew ? 'שגיאת התחברות' : 'Sign-in failed',
          description: err?.message || (isHebrew ? 'אנא נסה שוב' : 'Please try again'),
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

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
    form.setValue('selectedPlatforms', newPlatforms, { shouldValidate: true, shouldDirty: true });
    
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
    const freshCaptchaToken = await executeReCaptcha('provider_register').catch(() => null);
    setIsSubmitting(true);
    try {
      // Convert first selected platform to legacy providerType
      const legacyType = selectedPlatforms[0]?.replace('_suite', '').replace('_my_pet', '').replace('_academy', '') || 'sitter';
      
      const hasDocuments = !!(idFrontPhoto && selfieDocPhoto);
      const submitData = {
        ...data,
        providerType: legacyType,
        selectedPlatforms,
        intendedPricing: pricing,
        profilePhotoBase64: profilePhoto || undefined,
        idDocumentFrontBase64: idFrontPhoto || undefined,
        idDocumentBackBase64: idBackPhoto || undefined,
        selfieDocBase64: selfieDocPhoto || undefined,
        drivingLicenseBase64: drivingLicensePhoto || undefined,
        firebaseUid: user?.uid || undefined,
        captchaToken: freshCaptchaToken,
        latitude: addressLat ?? undefined,
        longitude: addressLng ?? undefined,
      };
      
      console.log('[ProviderApplication] Sending API request...');
      const response = await apiRequest('POST', '/api/provider-intake/submit', submitData);
      const result = await response.json();
      console.log('[ProviderApplication] API response:', result);

      if (result.success) {
        setSubmitted(true);
        setSubmittedIntakeId(result.intakeId || null);
        setDocsSubmittedWithForm(hasDocuments && !!result.biometricRecordCreated);
        queryClient.invalidateQueries({ queryKey: ['/api/provider-intake'] });

        // Save address to user profile so it pre-fills everywhere (booking, settings, etc.)
        // Fire-and-forget — application success is not blocked by this
        apiRequest('PATCH', '/api/user/profile', {
          street: data.streetAddress,
          city: data.city,
          postalCode: data.postalCode || '',
          ...(addressLat != null ? { latitude: addressLat } : {}),
          ...(addressLng != null ? { longitude: addressLng } : {}),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
        }).catch(() => {
          // silent — don't surface this to the user
        });

        toast({
          title: t.successTitle,
          description: t.successMessage,
        });
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (error: any) {
      console.error('[ProviderApplication] Submission error:', error);
      let errorDesc = isHebrew
        ? 'אנא בדוק שכל השדות מלאים ונסה שוב'
        : 'Please check all fields and try again';
      if (error?.status >= 500) {
        errorDesc = isHebrew
          ? 'שגיאת שרת - אנא נסה שוב מאוחר יותר'
          : 'Server error — please try again later';
      }
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה בשליחת הבקשה' : 'Submission Error',
        description: errorDesc,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const docCount = [idFrontPhoto, idBackPhoto, selfieDocPhoto, drivingLicensePhoto].filter(Boolean).length;
    const allKeyDocsUploaded = !!(idFrontPhoto && selfieDocPhoto);

    return (
      <div className={`min-h-screen bg-white ${isHebrew ? 'rtl' : 'ltr'}`}>
        <div className="py-12 px-4">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* ── Success Header ── */}
            <div className="rounded-3xl p-8 text-center bg-white border border-gray-200 shadow-lg">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-black mb-3">{t.successTitle}</h2>
              <p className="text-gray-600 mb-2">{t.successMessage}</p>
              {submittedIntakeId && (
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {isHebrew ? 'מספר בקשה:' : 'Application ID:'} {submittedIntakeId}
                </p>
              )}
            </div>

            {/* ── Progress Tracker ── */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-black mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                {isHebrew ? 'מסלול ההצטרפות שלך' : 'Your Onboarding Journey'}
              </h3>
              <div className="space-y-0">
                {[
                  {
                    icon: FileCheck,
                    label: isHebrew ? 'בקשה נשלחה' : 'Application Submitted',
                    desc: isHebrew ? 'הפרטים שלך נקלטו בהצלחה' : 'Your details were received successfully',
                    done: true,
                  },
                  {
                    icon: ScanLine,
                    label: isHebrew ? 'אימות זהות ומסמכים' : 'Identity & Document Verification',
                    desc: docsSubmittedWithForm
                      ? (isHebrew ? 'המסמכים הועלו — בבדיקה' : 'Documents uploaded — under review')
                      : allKeyDocsUploaded
                        ? (isHebrew ? 'המסמכים הועלו — בבדיקה' : 'Documents uploaded — under review')
                        : (isHebrew ? 'נדרש — ראה פרטים למטה' : 'Required — see details below'),
                    done: docsSubmittedWithForm || allKeyDocsUploaded,
                    current: !docsSubmittedWithForm && !allKeyDocsUploaded,
                  },
                  {
                    icon: ShieldCheck,
                    label: isHebrew ? 'בדיקת רקע ואישור' : 'Background Check & Approval',
                    desc: isHebrew ? 'צוות PetWash™ יאשר את הבקשה' : 'The PetWash™ team will approve your application',
                    done: false,
                  },
                  {
                    icon: BadgeCheck,
                    label: isHebrew ? 'פעיל — התחל לקבל הזמנות!' : 'Active — Start Receiving Bookings!',
                    desc: isHebrew ? 'תקבל קוד הזמנה וגישה לפלטפורמה' : "You'll receive an invite code and platform access",
                    done: false,
                  },
                ].map((s, i, arr) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        s.done ? 'bg-emerald-500' : s.current ? 'bg-amber-500' : 'bg-gray-200'
                      }`}>
                        <s.icon className={`h-5 w-5 ${s.done || s.current ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`w-0.5 h-8 mt-1 ${s.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`font-semibold text-sm ${s.done ? 'text-emerald-700' : s.current ? 'text-amber-700' : 'text-gray-500'}`}>
                        {s.label}
                        {s.done && <span className="ml-2 text-emerald-500">✓</span>}
                        {s.current && <span className="ml-2 text-amber-500">←</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Document Upload (if not submitted with form) ── */}
            {!docsSubmittedWithForm && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/60 flex items-center gap-3">
                  <ScanLine className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-black">{isHebrew ? 'אימות זהות ומסמכים' : 'Identity Verification'}</p>
                    <p className="text-xs text-amber-700">{isHebrew ? 'נדרש לפני תחילת עבודה' : 'Required before you start working'}</p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <p className="text-sm text-gray-600">
                    {isHebrew
                      ? 'אנא העלה את המסמכים הבאים כדי להשלים את תהליך הרישום. כל המסמכים מאובטחים ומוצפנים.'
                      : 'Please upload the following documents to complete your registration. All documents are encrypted and secure.'}
                  </p>

                  {/* Selfie */}
                  <div className={`rounded-xl border-2 p-4 transition-colors ${selfieDocPhoto ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-amber-300 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Camera className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-black text-sm">{isHebrew ? '📸 סלפי' : '📸 Selfie'}</p>
                        <p className="text-xs text-gray-500">{isHebrew ? 'פנים ברורות, תאורה טובה' : 'Clear face, good lighting'}</p>
                      </div>
                      {selfieDocPhoto && <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-auto" />}
                    </div>
                    {selfieDocPhoto ? (
                      <div className="flex items-center gap-3">
                        <img src={selfieDocPhoto} className="h-16 w-16 rounded-xl object-cover" alt="Selfie" />
                        <button type="button" onClick={() => setSelfieDocPhoto(null)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                          <X className="h-3 w-3" /> {isHebrew ? 'הסר' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <input type="file" accept="image/*" capture="user" onChange={handleDocumentCapture(setSelfieDocPhoto)} className="hidden" />
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors">
                          <Camera className="h-4 w-4" />
                          {isHebrew ? 'צלם סלפי' : 'Take Selfie'}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* ID Front */}
                  <div className={`rounded-xl border-2 p-4 transition-colors ${idFrontPhoto ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-amber-300 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <ScanLine className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-black text-sm">{isHebrew ? '🪪 תעודת זהות — צד קדמי' : '🪪 Israeli ID — Front'}</p>
                        <p className="text-xs text-gray-500">{isHebrew ? 'הצד עם התמונה והפרטים' : 'The side with your photo and details'}</p>
                      </div>
                      {idFrontPhoto && <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-auto" />}
                    </div>
                    {idFrontPhoto ? (
                      <div className="flex items-center gap-3">
                        <img src={idFrontPhoto} className="h-16 w-28 rounded-xl object-cover" alt="ID Front" />
                        <button type="button" onClick={() => setIdFrontPhoto(null)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                          <X className="h-3 w-3" /> {isHebrew ? 'הסר' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" capture="environment" onChange={handleDocumentCapture(setIdFrontPhoto)} className="hidden" />
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm hover:bg-amber-200 transition-colors">
                            <Camera className="h-4 w-4" />
                            {isHebrew ? 'צלם' : 'Capture'}
                          </span>
                        </label>
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={handleDocumentCapture(setIdFrontPhoto)} className="hidden" />
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                            <Upload className="h-4 w-4" />
                            {isHebrew ? 'העלה' : 'Upload'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* ID Back */}
                  <div className={`rounded-xl border-2 p-4 transition-colors ${idBackPhoto ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <ScanLine className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-black text-sm">{isHebrew ? '🪪 תעודת זהות — צד אחורי' : '🪪 Israeli ID — Back'}</p>
                        <p className="text-xs text-gray-500">{isHebrew ? 'הספח — לא חובה אך מומלץ' : 'The annexe — optional but recommended'}</p>
                      </div>
                      {idBackPhoto && <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-auto" />}
                    </div>
                    {idBackPhoto ? (
                      <div className="flex items-center gap-3">
                        <img src={idBackPhoto} className="h-16 w-28 rounded-xl object-cover" alt="ID Back" />
                        <button type="button" onClick={() => setIdBackPhoto(null)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                          <X className="h-3 w-3" /> {isHebrew ? 'הסר' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" capture="environment" onChange={handleDocumentCapture(setIdBackPhoto)} className="hidden" />
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                            <Camera className="h-4 w-4" />
                            {isHebrew ? 'צלם' : 'Capture'}
                          </span>
                        </label>
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={handleDocumentCapture(setIdBackPhoto)} className="hidden" />
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                            <Upload className="h-4 w-4" />
                            {isHebrew ? 'העלה' : 'Upload'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Driving License — conditional on pet_trek */}
                  {selectedPlatforms.includes('pet_trek') && (
                    <div className={`rounded-xl border-2 p-4 transition-colors ${drivingLicensePhoto ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-blue-200 bg-white'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Car className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-black text-sm">{isHebrew ? '🚗 רישיון נהיגה' : '🚗 Driving License'}</p>
                          <p className="text-xs text-gray-500">{isHebrew ? 'נדרש לשירות הסעת חיות מחמד' : 'Required for pet transportation service'}</p>
                        </div>
                        {drivingLicensePhoto && <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-auto" />}
                      </div>
                      {drivingLicensePhoto ? (
                        <div className="flex items-center gap-3">
                          <img src={drivingLicensePhoto} className="h-16 w-28 rounded-xl object-cover" alt="Driving License" />
                          <button type="button" onClick={() => setDrivingLicensePhoto(null)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                            <X className="h-3 w-3" /> {isHebrew ? 'הסר' : 'Remove'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*" capture="environment" onChange={handleDocumentCapture(setDrivingLicensePhoto)} className="hidden" />
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors">
                              <Camera className="h-4 w-4" />
                              {isHebrew ? 'צלם' : 'Capture'}
                            </span>
                          </label>
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*" onChange={handleDocumentCapture(setDrivingLicensePhoto)} className="hidden" />
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                              <Upload className="h-4 w-4" />
                              {isHebrew ? 'העלה' : 'Upload'}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Documents Button */}
                  {allKeyDocsUploaded && user?.uid && (
                    <SubmitDocumentsButton
                      intakeId={submittedIntakeId}
                      firebaseUid={user.uid}
                      idFrontPhoto={idFrontPhoto}
                      idBackPhoto={idBackPhoto}
                      selfieDocPhoto={selfieDocPhoto}
                      drivingLicensePhoto={drivingLicensePhoto}
                      isHebrew={isHebrew}
                      onSuccess={() => setDocsSubmittedWithForm(true)}
                    />
                  )}
                  {!allKeyDocsUploaded && (
                    <p className="text-xs text-center text-amber-700 font-medium">
                      {isHebrew
                        ? `נדרשים לפחות: סלפי + תעודת זהות (צד קדמי) — ${docCount}/2 הועלו`
                        : `Required: Selfie + ID Front — ${docCount}/2 uploaded`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Documents already submitted confirmation */}
            {docsSubmittedWithForm && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800">{isHebrew ? 'המסמכים נשלחו בהצלחה' : 'Documents Submitted Successfully'}</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {isHebrew
                      ? 'המסמכים שלך נקלטו ונמצאים בבדיקה. תקבל עדכון בדוא"ל תוך 24-48 שעות.'
                      : 'Your documents are received and under review. You\'ll get an email update within 24-48 hours.'}
                  </p>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className={`flex ${isHebrew ? 'flex-row-reverse' : 'flex-row'} gap-3 flex-wrap`}>
              <Link
                href="/provider-application/status"
                className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-amber-500/25 transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
              >
                <Clock className="h-4 w-4" />
                {isHebrew ? 'עקוב אחר הבקשה' : 'Track Application Status'}
              </Link>
              <Link
                href="/"
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-black hover:bg-gray-50 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
              >
                {isHebrew ? 'דף הבית' : 'Home'}
              </Link>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
        
          {/* Header */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-6">
              <ArrowLeft className={`h-4 w-4 ${isHebrew ? 'rotate-180' : ''}`} />
              {isHebrew ? 'חזרה' : 'Back'}
            </Link>
            
            {/* Luxury Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-600 text-sm font-medium">
                {isHebrew ? 'הצטרף לצוות המובחר' : 'Join Our Elite Team'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-4">
              {isHebrew ? 'הפוך לספק ' : 'Become a '}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                ⁦Pet Wash™⁩
              </span>
            </h1>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              {t.subtitle}
            </p>
          </div>

          {/* Step 0: Google / Gmail Sign-In Gate */}
          {step === 0 && (
            <div className="rounded-3xl p-8 md:p-12 bg-white border border-gray-200 shadow-sm mb-10 max-w-lg mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-6 shadow-lg">
                <SiGoogle className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">
                {isHebrew ? 'התחבר כדי להמשיך' : 'Sign in to continue'}
              </h2>
              <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                {isHebrew
                  ? 'התחבר עם Gmail כדי שנוכל למלא את הפרטים שלך אוטומטית ולשמור את ההתקדמות שלך'
                  : 'Sign in with Gmail so we can pre-fill your details automatically and save your progress'}
              </p>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold text-gray-700 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed mb-4"
              >
                {googleLoading
                  ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  : <SiGoogle className="w-5 h-5 text-[#4285F4]" />}
                {isHebrew ? 'המשך עם Gmail' : 'Continue with Gmail'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                {isHebrew ? 'המשך ללא התחברות' : 'Continue without signing in'}
              </button>

              <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3 text-left">
                <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  {isHebrew
                    ? 'רק שמך, כתובת האימייל ותמונת הפרופיל שלך ישמשו למילוי מראש. לעולם לא נשתף את פרטיך עם גורמים שלישיים.'
                    : 'Only your name, email, and profile picture will be used to pre-fill the form. We never share your details with third parties.'}
                </p>
              </div>
            </div>
          )}

          {/* Luxury Progress Steps */}
          {step > 0 && (
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
                            : 'bg-gray-100 border border-gray-300 text-gray-500'
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
                        : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            {/* Progress Text */}
            <p className="text-center text-amber-600 mt-6 font-medium">
              {isHebrew ? `שלב ${step} מתוך 5` : `Step ${step} of 5`}
            </p>
          </div>
          )}

          {step > 0 && (
          <div 
            className="rounded-3xl p-6 md:p-10 bg-white border border-gray-200 shadow-sm"
          >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error('[ProviderApplication] Form validation errors:', errors);
              const stepFieldMap: [number, string[], string, string][] = [
                [1, ['selectedPlatforms'], 'בחירת פלטפורמות (שלב 1)', 'Platform Selection (Step 1)'],
                [3, ['firstName', 'lastName', 'email', 'phoneNumber', 'idNumber', 'streetAddress', 'city'], 'פרטים אישיים (שלב 3)', 'Personal Details (Step 3)'],
                [4, ['aboutMe', 'whyJoinPetWash'], 'ניסיון ופרופיל (שלב 4)', 'Experience & Profile (Step 4)'],
                [5, ['agreeToTerms', 'agreeToPrivacy', 'agreeToContractorStatus'], 'הסכמים משפטיים (שלב 5)', 'Legal Agreements (Step 5)'],
              ];
              const errorKeys = Object.keys(errors);
              let errorStep = 5;
              let stepLabel = '';
              for (const [stepNum, fields, heLbl, enLbl] of stepFieldMap) {
                if (fields.some(f => errorKeys.includes(f))) {
                  errorStep = stepNum;
                  stepLabel = isHebrew ? heLbl : enLbl;
                  break;
                }
              }
              setStep(errorStep);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              toast({
                variant: 'destructive',
                title: isHebrew ? 'שדות חסרים' : 'Missing Fields',
                description: stepLabel 
                  ? (isHebrew ? `אנא מלא את כל השדות הנדרשים ב${stepLabel}` : `Please fill in all required fields in ${stepLabel}`)
                  : (isHebrew ? 'אנא מלא את כל השדות הנדרשים' : 'Please fill in all required fields'),
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
                      <h2 className="text-2xl font-bold text-black">
                        {t.step1Title}
                      </h2>
                      <p className="text-gray-600 text-sm">{t.step1Desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                      <Sparkles className="h-4 w-4 text-blue-400" />
                      <span className="text-blue-700 text-sm font-medium">
                        {isHebrew ? 'ניתן לבחור מספר שירותים!' : 'You can select multiple services!'}
                      </span>
                    </div>
                    {selectedPlatforms.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-700 text-sm font-bold">
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
                          className={`relative p-6 rounded-2xl border transition-all duration-300 ${isHebrew ? 'text-right' : 'text-left'} ${
                            isSelected 
                              ? `border-amber-500/50 bg-gradient-to-br ${platform.color} text-white shadow-xl shadow-amber-500/20 scale-[1.02]` 
                              : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-md'
                          }`}
                          data-testid={`platform-${platform.id}`}
                        >
                          <div className={`absolute top-3 ${isHebrew ? 'left-3' : 'right-3'} w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            isSelected 
                              ? 'bg-white/30' 
                              : 'bg-gray-100 border border-gray-300'
                          }`}>
                            {isSelected ? (
                              <Check className="h-5 w-5 text-white" />
                            ) : (
                              <div className="w-4 h-4 rounded border-2 border-gray-400" />
                            )}
                          </div>
                          <Icon className={`h-10 w-10 mb-3 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                          <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-black'}`}>
                            {isHebrew ? platform.nameHe : platform.nameEn}
                          </h3>
                          <p className={`text-sm mt-1 ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                            {isHebrew ? platform.descHe : platform.descEn}
                          </p>
                          <div className={`mt-3 text-sm ${isSelected ? 'text-white/90' : 'text-amber-600'}`}>
                            {t.suggested}: {formatCurrency(platform.suggestedRate)} {getPriceLabel(platform.priceType)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPlatforms.length === 0 && (
                    <p className="text-center text-amber-600 text-sm">
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
                      <h2 className="text-2xl font-bold text-black">
                        {t.step2Title}
                      </h2>
                      <p className="text-gray-600 text-sm">{t.step2Desc}</p>
                    </div>
                  </div>
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-amber-200 mb-4">
                    <Info className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-700 text-sm">{t.commission}</span>
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
                          className="bg-gray-50 rounded-2xl p-6 border border-gray-200"
                        >
                          <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${platform.color} shadow-lg`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-black">
                                {isHebrew ? platform.nameHe : platform.nameEn}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {isHebrew ? platform.descHe : platform.descEn}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-black mb-2">
                                {t.baseRate} ({getPriceLabel(platform.priceType)})
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.baseRate / 100}
                                  onChange={(e) => updatePricing(platformId, 'baseRate', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
                                  min={0}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-2 text-sm">
                                <span className="text-gray-600">{t.youEarn}:</span>
                                <span className="font-bold text-emerald-600">
                                  {formatCurrency(providerEarnings)}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-black mb-2">
                                {t.additionalPet}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₪</span>
                                <input
                                  type="number"
                                  value={currentPricing.additionalPet / 100}
                                  onChange={(e) => updatePricing(platformId, 'additionalPet', Math.round(parseFloat(e.target.value) * 100))}
                                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20"
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
                      <h2 className="text-2xl font-bold text-black">
                        {t.step3Title}
                      </h2>
                      <p className="text-gray-600 text-sm">{isHebrew ? 'ספר לנו קצת על עצמך' : 'Tell us a bit about yourself'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black font-medium">{t.firstName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-firstName"
                            />
                          </FormControl>
                          <FormMessage className="text-red-600" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black font-medium">{t.lastName} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-lastName"
                            />
                          </FormControl>
                          <FormMessage className="text-red-600" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black font-medium">{t.email} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage className="text-red-600" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black font-medium">{t.phone} *</FormLabel>
                          <FormControl>
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              language={isHebrew ? 'he' : 'en'}
                              defaultCountry="IL"
                            />
                          </FormControl>
                          <FormMessage className="text-red-600" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-black font-medium">{t.idNumber} *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder={t.idNumberPlaceholder}
                              className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                              data-testid="input-id-number"
                            />
                          </FormControl>
                          <FormMessage className="text-red-600" />
                        </FormItem>
                      )}
                    />

                    {/* Address Section with Google Places Auto-Fill */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-amber-400" />
                        <span className="text-black font-medium">{t.addressSection} *</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{t.addressHint}</p>
                      
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
                                  const streetValue = details?.street 
                                    ? `${details.street}${details.streetNumber ? ' ' + details.streetNumber : ''}`
                                    : value;
                                  field.onChange(streetValue);
                                  if (!details) {
                                    setAddressLat(null);
                                    setAddressLng(null);
                                  }
                                }}
                                onPlaceSelected={(place: PlaceDetails) => {
                                  const streetValue = place.street 
                                    ? `${place.street}${place.streetNumber ? ' ' + place.streetNumber : ''}`
                                    : place.formattedAddress;
                                  field.onChange(streetValue);
                                  
                                  if (place.city) {
                                    form.setValue('city', place.city);
                                  }
                                  
                                  if (place.postalCode) {
                                    form.setValue('postalCode', place.postalCode);
                                  }
                                  
                                  if (place.country) {
                                    form.setValue('country', place.country);
                                  }

                                  if (place.lat != null) setAddressLat(place.lat);
                                  if (place.lng != null) setAddressLng(place.lng);
                                }}
                                label={t.streetAddress}
                                placeholder={isHebrew ? 'הקלד כתובת מלאה...' : 'Start typing your full address...'}
                                required
                                country={['il', 'us', 'gb', 'au', 'ca']}
                                darkMode={false}
                                error={form.formState.errors.streetAddress?.message}
                                className="[&_label]:text-black [&_label]:font-medium"
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
                              <FormLabel className="text-black font-medium">{t.city} *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                                  placeholder={isHebrew ? 'עיר' : 'City'}
                                  data-testid="input-city"
                                />
                              </FormControl>
                              <FormMessage className="text-red-600" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-black font-medium">{t.postalCode}</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  inputMode="numeric"
                                  className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                                  placeholder={isHebrew ? 'לדוג׳ 6291302' : 'e.g. 6291302'}
                                  data-testid="input-postal-code"
                                  dir="ltr"
                                />
                              </FormControl>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {isHebrew ? 'מיקוד לא תמיד מולא אוטומטית — ניתן להקליד ידנית (לא חובה)' : 'Postal code may not auto-fill — type manually if needed (optional)'}
                              </p>
                              <FormMessage className="text-red-600" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-black font-medium">{t.country}</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="h-12 bg-white border-gray-300 text-black focus:border-amber-500 focus:ring-amber-500/20 rounded-xl" data-testid="select-country">
                                    <SelectValue placeholder={isHebrew ? 'בחר מדינה' : 'Select country'} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    {WORLD_COUNTRIES.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage className="text-red-600" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Profile Photo - Luxury Style */}
                  <div className="pt-4">
                    <label className="block text-sm font-medium text-black mb-3">
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
                        <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
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
                        <span className="inline-flex items-center gap-2 px-5 py-3 bg-gray-100 border border-gray-300 text-black rounded-xl hover:bg-gray-200 hover:border-gray-400 transition-all duration-300">
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
                      <h2 className="text-2xl font-bold text-black">
                        {t.step4Title}
                      </h2>
                      <p className="text-gray-600 text-sm">{isHebrew ? 'ספר על הניסיון שלך' : 'Share your experience'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    <h3 className="font-semibold text-black mb-2 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-400" />
                      {isHebrew ? 'הכשרות והסמכות' : 'Qualifications & Certifications'}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {isHebrew 
                        ? 'סמן את הפריטים שמתאימים לך. כל אלה הם אופציונליים אבל יגדילו את הנראות של הפרופיל שלך.'
                        : 'Check any that apply to you. All are optional but will boost your profile visibility.'}
                    </p>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="hasOwnTransport"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-gray-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-black cursor-pointer">
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
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-gray-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-black cursor-pointer">
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
                          <FormItem className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-5 w-5 border-gray-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0 text-black cursor-pointer">
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
                        <FormLabel className="text-black font-medium">{t.experience}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min={0}
                            max={50}
                            className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aboutMe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black font-medium">{t.aboutMe} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={4}
                            placeholder={t.aboutMeHint}
                            className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                            data-testid="textarea-aboutMe"
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whyJoinPetWash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black font-medium">{t.whyJoin} *</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder={t.whyJoinHint}
                            className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                            data-testid="textarea-whyJoin"
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availabilityNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black font-medium">{t.availability}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={2}
                            className="bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl resize-none"
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-black font-medium">{t.referral}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder={isHebrew ? 'גוגל, חבר, רשתות חברתיות...' : 'Google, friend, social media...'}
                            className="h-12 bg-white border-gray-300 text-black placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                          />
                        </FormControl>
                        <FormMessage className="text-red-600" />
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
                      <h2 className="text-2xl font-bold text-black">
                        {t.step5Title}
                      </h2>
                      <p className="text-gray-600 text-sm">
                        {isHebrew ? 'אנא קרא ואשר את ההסכמים הבאים' : 'Please read and accept the following agreements'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Terms of Service */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                      <FormField
                        control={form.control}
                        name="agreeToTerms"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={!!field.value} 
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                                className="h-6 w-6 mt-0.5 border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 flex-shrink-0"
                                data-testid="checkbox-terms"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-black font-medium cursor-pointer">
                                {t.terms} *
                              </FormLabel>
                              <p className="text-sm text-gray-600 mt-1">
                                <Link href="/legal/terms" className="text-amber-600 hover:text-amber-500 hover:underline">
                                  {isHebrew ? 'צפה בתנאי השימוש המלאים' : 'View full Terms of Service'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage className="text-red-600" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Privacy Policy */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                      <FormField
                        control={form.control}
                        name="agreeToPrivacy"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={!!field.value} 
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                                className="h-6 w-6 mt-0.5 border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 flex-shrink-0"
                                data-testid="checkbox-privacy"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-black font-medium cursor-pointer">
                                {t.privacy} *
                              </FormLabel>
                              <p className="text-sm text-gray-600 mt-1">
                                <Link href="/legal/privacy" className="text-amber-600 hover:text-amber-500 hover:underline">
                                  {isHebrew ? 'צפה במדיניות הפרטיות המלאה' : 'View full Privacy Policy'}
                                </Link>
                              </p>
                            </div>
                            <FormMessage className="text-red-600" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Independent Contractor Status */}
                    <div className="bg-white rounded-2xl p-6 border border-amber-200">
                      <FormField
                        control={form.control}
                        name="agreeToContractorStatus"
                        render={({ field }) => (
                          <FormItem className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox 
                                checked={!!field.value} 
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                                className="h-6 w-6 mt-0.5 border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 flex-shrink-0"
                                data-testid="checkbox-contractor"
                              />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="!mt-0 text-amber-800 font-medium cursor-pointer">
                                {t.contractor} *
                              </FormLabel>
                              <p className="text-sm text-amber-700 mt-1">
                                {isHebrew 
                                  ? 'כספק שירותים עצמאי, אתה אחראי על המיסים, הביטוח והרישיונות שלך.'
                                  : 'As an independent service provider, you are responsible for your own taxes, insurance, and licenses.'}
                              </p>
                            </div>
                            <FormMessage className="text-red-600" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
                    <p>
                      {isHebrew 
                        ? '⁦Pet Wash™⁩ משמש כפלטפורמת תיווך בין בעלי חיות מחמד לספקי שירות עצמאיים. ⁦Pet Wash™⁩ אינה מעסיקה את הספקים ואינה אחראית ישירות לשירותים הניתנים.'
                        : '⁦Pet Wash™⁩ acts as a marketplace connecting pet owners with independent service providers. ⁦Pet Wash™⁩ does not employ providers and is not directly responsible for services rendered.'}
                    </p>
                  </div>
                </div>
              )}


              {/* Luxury Navigation Buttons */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => { setStep(step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-black transition-colors rounded-xl hover:bg-gray-100"
                  >
                    <ArrowLeft className={`h-5 w-5 ${isHebrew ? 'rotate-180' : ''}`} />
                    {t.back}
                  </button>
                )}
                
                <div className={step === 1 ? 'ml-auto' : ''}>
                  {step < 5 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (step === 1 && selectedPlatforms.length === 0) {
                          toast({
                            variant: 'destructive',
                            title: isHebrew ? 'נדרשת בחירה' : 'Selection Required',
                            description: isHebrew ? 'בחר לפחות פלטפורמה אחת' : 'Select at least one platform',
                          });
                          return;
                        }
                        if (step === 1) {
                          form.setValue('selectedPlatforms', selectedPlatforms, { shouldValidate: true, shouldDirty: true });
                        }
                        const stepFields: Record<number, (keyof ApplicationForm)[]> = {
                          1: ['selectedPlatforms'],
                          2: [],
                          3: ['firstName', 'lastName', 'email', 'phoneNumber', 'idNumber', 'streetAddress', 'city'],
                          4: ['aboutMe', 'whyJoinPetWash'],
                        };
                        const fields = stepFields[step] || [];
                        if (fields.length > 0) {
                          const valid = await form.trigger(fields);
                          if (!valid) {
                            const errorFields = Object.keys(form.formState.errors);
                            const fieldNames = errorFields.map(f => {
                              const labels: Record<string, string> = {
                                firstName: isHebrew ? 'שם פרטי' : 'First Name',
                                lastName: isHebrew ? 'שם משפחה' : 'Last Name',
                                email: isHebrew ? 'אימייל' : 'Email',
                                phoneNumber: isHebrew ? 'טלפון' : 'Phone',
                                idNumber: isHebrew ? 'תעודת זהות' : 'ID Number',
                                streetAddress: isHebrew ? 'כתובת' : 'Address',
                                city: isHebrew ? 'עיר' : 'City',
                                aboutMe: isHebrew ? 'על עצמך' : 'About Me',
                                whyJoinPetWash: isHebrew ? 'למה Pet Wash' : 'Why Pet Wash',
                                selectedPlatforms: isHebrew ? 'בחירת פלטפורמות' : 'Platform Selection',
                              };
                              return labels[f] || f;
                            }).join(', ');
                            toast({
                              variant: 'destructive',
                              title: isHebrew ? 'שדות חסרים' : 'Missing Fields',
                              description: fieldNames || (isHebrew ? 'אנא מלא את כל השדות הנדרשים בשלב זה' : 'Please fill in all required fields in this step'),
                            });
                            return;
                          }
                        }
                        setStep(step + 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
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
          )}

        {/* Luxury Trust Badges */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center justify-center gap-8 px-6 py-4 rounded-2xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 text-black">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium">{isHebrew ? 'מאובטח' : 'Secure'}</span>
            </div>
            <div className="flex items-center gap-2 text-black">
              <Star className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium">{isHebrew ? 'מאומת' : 'Verified'}</span>
            </div>
            <div className="flex items-center gap-2 text-black">
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
