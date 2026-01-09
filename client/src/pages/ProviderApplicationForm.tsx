/**
 * Pet Wash™ Provider Application Form - Luxury 2026 Edition
 * 
 * Glamorous, high-end application form with:
 * - Premium Gucci-inspired black/white aesthetic
 * - Luxury glassmorphism effects
 * - Elegant typography and animations
 * - E-signature integration ready
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, CheckCircle2, Star, Shield, Heart, 
  Car, Home, Dog, Scissors, GraduationCap, Building,
  ArrowRight, ArrowLeft, Sparkles, Crown, Send,
  Camera, Upload, User, X
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

const providerTypes = [
  { id: 'walker', icon: Dog, label: { en: 'Dog Walker', he: 'מטייל כלבים' }, color: 'from-emerald-500 to-teal-600' },
  { id: 'sitter', icon: Home, label: { en: 'Pet Sitter', he: 'שמרטף' }, color: 'from-purple-500 to-pink-600' },
  { id: 'driver', icon: Car, label: { en: 'PetTrek Driver', he: 'נהג PetTrek' }, color: 'from-blue-500 to-indigo-600' },
  { id: 'groomer', icon: Scissors, label: { en: 'Groomer', he: 'מטפח' }, color: 'from-amber-500 to-orange-600' },
  { id: 'trainer', icon: GraduationCap, label: { en: 'Trainer', he: 'מאלף' }, color: 'from-rose-500 to-red-600' },
  { id: 'station_operator', icon: Building, label: { en: 'Station Operator', he: 'מפעיל תחנה' }, color: 'from-slate-500 to-zinc-600' },
] as const;

const applicationSchema = z.object({
  firstName: z.string().min(2, { message: "First name is required" }),
  lastName: z.string().min(2, { message: "Last name is required" }),
  email: z.string().email({ message: "Valid email required" }),
  phoneNumber: z.string().min(9, { message: "Valid phone number required" }),
  city: z.string().min(2, { message: "City is required" }),
  providerType: z.string().min(1, { message: "Please select a service type" }),
  yearsExperience: z.string().optional(),
  hasOwnTransport: z.boolean().default(false),
  hasPetFirstAid: z.boolean().default(false),
  hasInsurance: z.boolean().default(false),
  availabilityNotes: z.string().optional(),
  aboutMe: z.string().min(20, { message: "Please tell us about yourself (min 20 characters)" }),
  whyJoinPetWash: z.string().min(20, { message: "Please tell us why you want to join (min 20 characters)" }),
  referralSource: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, { message: "You must agree to the terms" }),
  agreeToPrivacy: z.boolean().refine(val => val === true, { message: "You must agree to the privacy policy" }),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

export default function ProviderApplicationForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);

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
      setProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePhoto = () => {
    setProfilePhoto(null);
    setProfilePhotoFile(null);
  };

  const form = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      city: "",
      providerType: "",
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
    },
  });

  const t = {
    title: isHebrew ? 'הצטרף למשפחת Pet Wash™' : 'Join the Pet Wash™ Family',
    subtitle: isHebrew 
      ? 'הפוך לחלק מפלטפורמת הפרימיום המובילה לשירותי חיות מחמד'
      : 'Become part of the leading premium pet services platform',
    step1Title: isHebrew ? 'בחר את השירות שלך' : 'Choose Your Service',
    step2Title: isHebrew ? 'פרטים אישיים' : 'Personal Details',
    step3Title: isHebrew ? 'ניסיון והכשרות' : 'Experience & Qualifications',
    step4Title: isHebrew ? 'ספר לנו על עצמך' : 'Tell Us About Yourself',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    email: isHebrew ? 'אימייל' : 'Email',
    phone: isHebrew ? 'טלפון' : 'Phone',
    city: isHebrew ? 'עיר' : 'City',
    experience: isHebrew ? 'שנות ניסיון' : 'Years of Experience',
    hasTransport: isHebrew ? 'יש לי רכב' : 'I have my own vehicle',
    hasFirstAid: isHebrew ? 'יש לי תעודת עזרה ראשונה לבעלי חיים' : 'I have pet first aid certification',
    hasInsurance: isHebrew ? 'יש לי ביטוח אחריות' : 'I have liability insurance',
    availability: isHebrew ? 'זמינות ושעות העדפה' : 'Availability & Preferred Hours',
    aboutMe: isHebrew ? 'ספר/י לנו על עצמך' : 'Tell us about yourself',
    whyJoin: isHebrew ? 'למה אתה רוצה להצטרף ל-Pet Wash?' : 'Why do you want to join Pet Wash?',
    referral: isHebrew ? 'איך שמעת עלינו?' : 'How did you hear about us?',
    terms: isHebrew ? 'אני מסכים/ה לתנאי השימוש' : 'I agree to the Terms of Service',
    privacy: isHebrew ? 'אני מסכים/ה למדיניות הפרטיות' : 'I agree to the Privacy Policy',
    next: isHebrew ? 'המשך' : 'Continue',
    back: isHebrew ? 'חזרה' : 'Back',
    submit: isHebrew ? 'שלח בקשה' : 'Submit Application',
    submitting: isHebrew ? 'שולח...' : 'Submitting...',
    successTitle: isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted Successfully!',
    successMessage: isHebrew 
      ? 'תודה על הבקשה שלך. הצוות שלנו יבדוק אותה ויצור איתך קשר תוך 48 שעות עסקיות.'
      : 'Thank you for your application. Our team will review it and contact you within 48 business hours.',
    profilePhoto: isHebrew ? 'תמונת פרופיל ציבורית' : 'Public Profile Photo',
    profilePhotoDesc: isHebrew 
      ? 'בחר תמונה שתוצג לציבור בפרופיל שלך (אופציונלי - נפרד מתמונת הזיהוי)'
      : 'Choose a photo to display publicly on your profile (optional - separate from ID verification)',
    uploadPhoto: isHebrew ? 'העלה תמונה' : 'Upload Photo',
    changePhoto: isHebrew ? 'שנה תמונה' : 'Change Photo',
    removePhoto: isHebrew ? 'הסר' : 'Remove',
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    form.setValue('providerType', typeId);
  };

  const onSubmit = async (data: ApplicationForm) => {
    console.log('[ProviderApplication] Form submit triggered with data:', data);
    setIsSubmitting(true);
    try {
      const submitData = {
        ...data,
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

  if (submitted) {
    return (
      <div className={`min-h-screen luxury-bg-mesh py-12 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
        <div className="max-w-2xl mx-auto luxury-animate-fade-in">
          <div className="luxury-glass-card luxury-shadow-2xl border-2 border-green-500/30 p-10">
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 luxury-animate-scale-in">
                <CheckCircle2 className="h-14 w-14 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
                {t.successTitle}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                {t.successMessage}
              </p>
              
              <div className="luxury-glass-panel p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Crown className="h-6 w-6 text-amber-500" />
                  <span className="font-semibold text-lg">
                    {isHebrew ? 'מה הלאה?' : 'What\'s Next?'}
                  </span>
                </div>
                <ul className="space-y-3 text-left">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'הצוות שלנו יבדוק את הבקשה' : 'Our team will review your application'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'תקבל קוד הזמנה אישי באימייל' : 'You\'ll receive a personal invite code by email'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'תשלים את תהליך ההצטרפות עם אימות זהות' : 'Complete onboarding with identity verification'}</span>
                  </li>
                </ul>
              </div>

              <Link href="/">
                <button className="luxury-btn-primary luxury-shadow-xl px-10 py-4 text-lg" data-testid="button-back-home">
                  {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen luxury-bg-mesh py-8 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Luxury Header */}
        <div className="text-center mb-10 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {isHebrew ? 'הצטרף לצוות הפרימיום' : 'Join the Premium Team'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-black via-gray-700 to-black dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent mb-4">
            {t.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Progress Steps - Premium Design */}
        <div className="flex items-center justify-center gap-2 mb-10 luxury-animate-slide-up">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                  step >= s 
                    ? 'bg-gradient-to-br from-black to-gray-800 text-white dark:from-white dark:to-gray-200 dark:text-black shadow-lg' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-6 w-6" /> : s}
              </div>
              {s < 4 && (
                <div className={`w-16 h-1 mx-1 rounded-full transition-all duration-300 ${
                  step > s 
                    ? 'bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="luxury-glass-card luxury-shadow-2xl p-8 md:p-10 luxury-animate-fade-in border border-white/20 dark:border-white/10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error('[ProviderApplication] Form validation errors:', errors);
              toast({
                variant: 'destructive',
                title: isHebrew ? 'שגיאה בטופס' : 'Form Error',
                description: isHebrew ? 'אנא מלא את כל השדות הנדרשים' : 'Please fill in all required fields',
              });
            })}>
              {/* Step 1: Service Type Selection */}
              {step === 1 && (
                <div className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step1Title}
                    </h2>
                    <p className="text-gray-500">
                      {isHebrew ? 'בחר את סוג השירות שתרצה להציע' : 'Select the type of service you\'d like to offer'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {providerTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = selectedType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => handleTypeSelect(type.id)}
                          className={`group relative p-6 rounded-2xl transition-all duration-300 ${
                            isSelected 
                              ? `bg-gradient-to-br ${type.color} text-white shadow-2xl scale-105` 
                              : 'luxury-glass-card hover:scale-102 hover:shadow-xl'
                          }`}
                          data-testid={`button-select-${type.id}`}
                        >
                          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all ${
                            isSelected 
                              ? 'bg-white/20' 
                              : `bg-gradient-to-br ${type.color} text-white`
                          }`}>
                            <Icon className="h-8 w-8" />
                          </div>
                          <span className={`font-bold text-lg block ${isSelected ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                            {type.label[isHebrew ? 'he' : 'en']}
                          </span>
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-6">
                    <button
                      type="button"
                      onClick={() => selectedType && setStep(2)}
                      disabled={!selectedType}
                      className="luxury-btn-primary luxury-shadow-xl px-8 py-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-next-step1"
                    >
                      {t.next}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Personal Information */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step2Title}
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">{t.firstName}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-14 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                              placeholder={isHebrew ? 'הזן שם פרטי' : 'Enter first name'}
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
                          <FormLabel className="text-base font-semibold">{t.lastName}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-14 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                              placeholder={isHebrew ? 'הזן שם משפחה' : 'Enter last name'}
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
                          <FormLabel className="text-base font-semibold">{t.email}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              className="h-14 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                              placeholder={isHebrew ? 'your@email.com' : 'your@email.com'}
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
                          <FormLabel className="text-base font-semibold">{t.phone}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="tel"
                              className="h-14 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                              placeholder={isHebrew ? '050-123-4567' : '+972-50-123-4567'}
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
                          <FormLabel className="text-base font-semibold">{t.city}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="h-14 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                              placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="luxury-btn-secondary px-8 py-4 flex items-center gap-2"
                      data-testid="button-back-step2"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      {t.back}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="luxury-btn-primary luxury-shadow-xl px-8 py-4 flex items-center gap-2"
                      data-testid="button-next-step2"
                    >
                      {t.next}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Experience & Qualifications */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step3Title}
                    </h2>
                  </div>

                  <FormField
                    control={form.control}
                    name="yearsExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">{t.experience}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-14 text-lg luxury-glass-minimal border-2" data-testid="select-experience">
                              <SelectValue placeholder={isHebrew ? 'בחר' : 'Select'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0-1">{isHebrew ? 'פחות משנה' : 'Less than 1 year'}</SelectItem>
                            <SelectItem value="1-3">{isHebrew ? '1-3 שנים' : '1-3 years'}</SelectItem>
                            <SelectItem value="3-5">{isHebrew ? '3-5 שנים' : '3-5 years'}</SelectItem>
                            <SelectItem value="5+">{isHebrew ? '5+ שנים' : '5+ years'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 p-6 luxury-glass-panel rounded-xl">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      {isHebrew ? 'הכשרות ותעודות' : 'Certifications & Qualifications'}
                    </h3>
                    
                    <FormField
                      control={form.control}
                      name="hasOwnTransport"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              className="h-6 w-6"
                              data-testid="checkbox-transport"
                            />
                          </FormControl>
                          <FormLabel className="text-base cursor-pointer">{t.hasTransport}</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hasPetFirstAid"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              className="h-6 w-6"
                              data-testid="checkbox-firstaid"
                            />
                          </FormControl>
                          <FormLabel className="text-base cursor-pointer">{t.hasFirstAid}</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hasInsurance"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              className="h-6 w-6"
                              data-testid="checkbox-insurance"
                            />
                          </FormControl>
                          <FormLabel className="text-base cursor-pointer">{t.hasInsurance}</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="availabilityNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">{t.availability}</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            className="min-h-24 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                            placeholder={isHebrew ? 'לדוגמה: זמין בימי ראשון-חמישי, 8:00-18:00' : 'e.g., Available Sunday-Thursday, 8:00-18:00'}
                            data-testid="input-availability"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="luxury-btn-secondary px-8 py-4 flex items-center gap-2"
                      data-testid="button-back-step3"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      {t.back}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="luxury-btn-primary luxury-shadow-xl px-8 py-4 flex items-center gap-2"
                      data-testid="button-next-step3"
                    >
                      {t.next}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: About & Submit */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {t.step4Title}
                    </h2>
                  </div>

                  {/* Profile Photo Upload */}
                  <div className="luxury-glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="h-5 w-5 text-purple-500" />
                      <h3 className="font-bold text-lg">{t.profilePhoto}</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t.profilePhotoDesc}
                    </p>
                    
                    <div className="flex items-center gap-6">
                      {/* Photo Preview */}
                      <div className="relative">
                        {profilePhoto ? (
                          <div className="relative">
                            <img 
                              src={profilePhoto} 
                              alt="Profile preview" 
                              className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-xl"
                              data-testid="img-profile-preview"
                            />
                            <button
                              type="button"
                              onClick={removeProfilePhoto}
                              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                              data-testid="button-remove-photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-xl">
                            <User className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div className="flex-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleProfilePhotoChange}
                            className="hidden"
                            data-testid="input-profile-photo"
                          />
                          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl">
                            <Upload className="h-5 w-5" />
                            {profilePhoto ? t.changePhoto : t.uploadPhoto}
                          </div>
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          {isHebrew ? 'JPG, PNG או WebP עד 5MB' : 'JPG, PNG, or WebP up to 5MB'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="aboutMe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Heart className="h-5 w-5 text-pink-500" />
                          {t.aboutMe}
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            className="min-h-32 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                            placeholder={isHebrew 
                              ? 'ספר/י לנו על הניסיון שלך עם בעלי חיים, למה את/ה אוהב/ת אותם...' 
                              : 'Tell us about your experience with animals, why you love them...'}
                            data-testid="input-aboutMe"
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
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Star className="h-5 w-5 text-amber-500" />
                          {t.whyJoin}
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            className="min-h-32 text-lg luxury-glass-minimal border-2 focus:border-black dark:focus:border-white transition-colors" 
                            placeholder={isHebrew 
                              ? 'מה מושך אותך בפלטפורמה שלנו? מה אתה מקווה להשיג...' 
                              : 'What attracts you to our platform? What do you hope to achieve...'}
                            data-testid="input-whyJoin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">{t.referral}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-14 text-lg luxury-glass-minimal border-2" data-testid="select-referral">
                              <SelectValue placeholder={isHebrew ? 'בחר' : 'Select'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="google">{isHebrew ? 'גוגל' : 'Google'}</SelectItem>
                            <SelectItem value="facebook">{isHebrew ? 'פייסבוק' : 'Facebook'}</SelectItem>
                            <SelectItem value="instagram">{isHebrew ? 'אינסטגרם' : 'Instagram'}</SelectItem>
                            <SelectItem value="friend">{isHebrew ? 'חבר/ה' : 'Friend'}</SelectItem>
                            <SelectItem value="other">{isHebrew ? 'אחר' : 'Other'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms & Privacy */}
                  <div className="p-6 luxury-glass-panel rounded-xl space-y-4">
                    <FormField
                      control={form.control}
                      name="agreeToTerms"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              className="h-6 w-6 mt-0.5"
                              data-testid="checkbox-terms"
                            />
                          </FormControl>
                          <div>
                            <FormLabel className="text-base cursor-pointer">
                              {t.terms}
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agreeToPrivacy"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              className="h-6 w-6 mt-0.5"
                              data-testid="checkbox-privacy"
                            />
                          </FormControl>
                          <div>
                            <FormLabel className="text-base cursor-pointer">
                              {t.privacy}
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="luxury-btn-secondary px-8 py-4 flex items-center gap-2"
                      data-testid="button-back-step4"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      {t.back}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="luxury-btn-primary luxury-shadow-xl px-10 py-4 flex items-center gap-2 text-lg"
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
                  </div>
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-10 luxury-animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-sm">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">{isHebrew ? 'אבטחה מלאה' : 'Fully Secure'}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-sm">
            <Star className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium">{isHebrew ? 'פלטפורמה מובילה' : 'Leading Platform'}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-sm">
            <Heart className="h-5 w-5 text-pink-500" />
            <span className="text-sm font-medium">{isHebrew ? 'אוהבי חיות אמיתיים' : 'True Pet Lovers'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
