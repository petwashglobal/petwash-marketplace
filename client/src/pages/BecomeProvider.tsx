import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { PhoneInput } from '@/components/PhoneInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GooglePlacesAutocomplete, PlaceDetails } from '@/components/ui/google-places-autocomplete';
import { Progress } from '@/components/ui/progress';
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';
import {
  ChevronRight,
  ChevronLeft,
  User,
  Briefcase,
  MapPin,
  Shield,
  CheckCircle2,
  Dog,
  Cat,
  Car,
  Home,
  Phone,
  Mail,
  Calendar,
  Award,
  Heart,
  Sparkles,
  FileCheck,
  Camera,
  Upload,
  Loader2,
  X
} from 'lucide-react';

// Form validation schema
const applicationFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  dateOfBirth: z.string().refine((date) => {
    const age = (new Date().getFullYear() - new Date(date).getFullYear());
    return age >= 18;
  }, "You must be at least 18 years old"),
  nationalId: z.string().optional(),
  streetAddress: z.string().min(5, "Please enter your full address"),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().optional(),
  serviceTypes: z.array(z.string()).min(1, "Select at least one service type"),
  yearsExperience: z.number().min(0).max(50),
  certifications: z.array(z.string()).optional(),
  biography: z.string().min(50, "Tell us about yourself (at least 50 characters)").max(2000),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  serviceRadius: z.number().min(1).max(100),
  maxPetsAtOnce: z.number().min(1).max(20),
  petTypesAccepted: z.array(z.string()).min(1, "Select at least one pet type"),
  hasOwnVehicle: z.boolean(),
  hasHomeSpace: z.boolean(),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(9, "Emergency contact phone is required"),
  emergencyContactRelation: z.string().min(2, "Relationship is required"),
  privacyConsent: z.boolean().refine(val => val === true, "You must agree to the privacy policy"),
  marketingConsent: z.boolean().optional(),
  dataRetentionAcknowledged: z.boolean().refine(val => val === true, "You must acknowledge the data retention policy"),
});

type ApplicationFormData = z.infer<typeof applicationFormSchema>;

const serviceTypeOptions = [
  { id: 'pet_sitting', icon: Home, label: 'Pet Sitting', labelHe: 'שמירה על חיות מחמד' },
  { id: 'dog_walking', icon: Dog, label: 'Dog Walking', labelHe: 'טיולי כלבים' },
  { id: 'pet_transport', icon: Car, label: 'Pet Transport', labelHe: 'הסעות חיות מחמד' },
  { id: 'grooming', icon: Sparkles, label: 'Grooming Services', labelHe: 'שירותי טיפוח' },
  { id: 'training', icon: Award, label: 'Pet Training', labelHe: 'אילוף חיות מחמד' },
];

const petTypeOptions = [
  { id: 'dog', icon: Dog, label: 'Dogs', labelHe: 'כלבים' },
  { id: 'cat', icon: Cat, label: 'Cats', labelHe: 'חתולים' },
  { id: 'bird', label: 'Birds', labelHe: 'ציפורים' },
  { id: 'rabbit', label: 'Rabbits', labelHe: 'ארנבות' },
  { id: 'fish', label: 'Fish', labelHe: 'דגים' },
  { id: 'reptile', label: 'Reptiles', labelHe: 'זוחלים' },
];

const languageOptions = [
  { id: 'he', label: 'Hebrew', labelHe: 'עברית' },
  { id: 'en', label: 'English', labelHe: 'אנגלית' },
  { id: 'ar', label: 'Arabic', labelHe: 'ערבית' },
  { id: 'ru', label: 'Russian', labelHe: 'רוסית' },
  { id: 'fr', label: 'French', labelHe: 'צרפתית' },
  { id: 'es', label: 'Spanish', labelHe: 'ספרדית' },
];

const steps = [
  { id: 1, title: 'Personal Info', titleHe: 'פרטים אישיים', icon: User },
  { id: 2, title: 'Services', titleHe: 'שירותים', icon: Briefcase },
  { id: 3, title: 'Experience', titleHe: 'ניסיון', icon: Award },
  { id: 4, title: 'Emergency', titleHe: 'חירום', icon: Phone },
  { id: 5, title: 'Legal', titleHe: 'משפטי', icon: Shield },
];

export default function BecomeProvider() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user: firebaseUser } = useFirebaseAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: isHebrew ? 'הקובץ גדול מדי' : 'File too large',
        description: isHebrew ? 'גודל מקסימלי 10MB' : 'Maximum size is 10MB',
        variant: 'destructive',
      });
      return;
    }
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setProfilePhoto(null);
    setProfilePhotoPreview(null);
    setUploadedPhotoUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: firebaseUser?.email || '',
      phoneNumber: '',
      dateOfBirth: '',
      nationalId: '',
      streetAddress: '',
      city: '',
      postalCode: '',
      serviceTypes: [],
      yearsExperience: 0,
      certifications: [],
      biography: '',
      languages: ['he'],
      serviceRadius: 10,
      maxPetsAtOnce: 3,
      petTypesAccepted: ['dog', 'cat'],
      hasOwnVehicle: false,
      hasHomeSpace: false,
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      privacyConsent: false,
      marketingConsent: false,
      dataRetentionAcknowledged: false,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      const formData = new FormData();
      formData.append('applicationData', JSON.stringify(data));
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }
      const token = firebaseUser ? await (firebaseUser as any).getIdToken?.() : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/api/provider-applications', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || err.message || 'Failed to submit');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      toast({
        title: isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted!',
        description: isHebrew 
          ? 'נעבור על הבקשה שלך ונחזור אליך בקרוב.'
          : 'We will review your application and get back to you soon.',
      });
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'משהו השתבש' : 'Something went wrong'),
        variant: 'destructive',
      });
    },
  });

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const onSubmit = (data: ApplicationFormData) => {
    submitMutation.mutate(data);
  };

  const progress = (currentStep / 5) * 100;

  // Redirect if not logged in
  if (!firebaseUser) {
    return (
      <Layout>
        <div className="min-h-screen relative overflow-hidden">
          {/* Luxury Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(198, 166, 100, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)'
          }} />
          
          <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full">
              {/* Premium Glass Card */}
              <div 
                className="p-8 sm:p-10 rounded-3xl text-center backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  {isHebrew ? 'הצטרף לצוות ⁦Pet Wash™⁩' : 'Join ⁦Pet Wash™⁩ Team'}
                </h2>
                
                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                  {isHebrew 
                    ? 'התחבר כדי להתחיל את מסע ההצטרפות לרשת הספקים המובילה בישראל'
                    : 'Sign in to start your journey with Israel\'s leading pet care provider network'}
                </p>
                
                {/* Benefits Preview */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white/10 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-pink-400" />
                    </div>
                    <p className="text-xs text-gray-400">{isHebrew ? 'גמישות' : 'Flexibility'}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white/10 flex items-center justify-center">
                      <Award className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-xs text-gray-400">{isHebrew ? 'הכנסה' : 'Income'}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white/10 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-xs text-gray-400">{isHebrew ? 'ביטוח' : 'Insurance'}</p>
                  </div>
                </div>
                
                <Link href="/login">
                  <Button 
                    className="w-full py-6 text-lg font-semibold rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300"
                    data-testid="button-login"
                  >
                    {isHebrew ? 'התחבר והתחל' : 'Sign In to Start'}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <Layout>
        <div className="min-h-screen relative overflow-hidden">
          {/* Luxury Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(52, 211, 153, 0.3) 0%, transparent 50%)'
          }} />
          
          <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full">
              <div 
                className="p-8 sm:p-10 rounded-3xl text-center backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
              >
                {/* Animated Success Icon */}
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-2xl">
                  <CheckCircle2 className="w-14 h-14 text-white" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  {isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted!'}
                </h2>
                
                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                  {isHebrew 
                    ? 'תודה על הבקשה שלך להצטרף לצוות ⁦Pet Wash™⁩. נבדוק את הפרטים שלך ונחזור אליך תוך 2-3 ימי עסקים.'
                    : 'Thank you for applying to join the ⁦Pet Wash™⁩ team. We will review your details and get back to you within 2-3 business days.'}
                </p>
                
                <div className="space-y-4">
                  <Link href="/my-applications">
                    <Button 
                      className="w-full py-5 text-lg font-semibold rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 shadow-xl"
                      data-testid="button-track-application"
                    >
                      {isHebrew ? 'עקוב אחר הבקשה' : 'Track Application'}
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button 
                      variant="outline" 
                      className="w-full py-5 text-lg rounded-2xl border-white/30 text-white hover:bg-white/10"
                      data-testid="button-back-home"
                    >
                      {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen relative overflow-hidden">
        {/* Luxury Dark Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 40%)'
        }} />
        
        <div className="relative z-10 py-8 sm:py-12 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Premium Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 text-sm font-medium">
                  {isHebrew ? 'הצטרף לצוות המובחר' : 'Join Our Elite Team'}
                </span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
                {isHebrew ? 'הפוך לספק ' : 'Become a '}
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                  ⁦Pet Wash™⁩
                </span>
              </h1>
              
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הצטרף לרשת ספקי השירות המובילה בישראל. הכנסה גמישה, ביטוח מלא, וקהילה תומכת.'
                  : 'Join Israel\'s leading pet care provider network. Flexible income, full insurance, and supportive community.'}
              </p>
            </div>

            {/* Premium Progress Steps */}
            <div className="mb-10">
              <div className="flex justify-between items-center max-w-3xl mx-auto px-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    {/* Step Circle */}
                    <div className="flex flex-col items-center">
                      <div 
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-all duration-300 ${
                          step.id < currentStep 
                            ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/30'
                            : step.id === currentStep 
                              ? 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/30'
                              : 'bg-slate-700/50 border border-slate-600'
                        }`}
                      >
                        {step.id < currentStep ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <step.icon className={`w-6 h-6 ${step.id === currentStep ? 'text-white' : 'text-slate-400'}`} />
                        )}
                      </div>
                      <span className={`text-xs hidden sm:block font-medium ${
                        step.id <= currentStep ? 'text-white' : 'text-slate-500'
                      }`}>
                        {isHebrew ? step.titleHe : step.title}
                      </span>
                    </div>
                    
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className={`w-8 sm:w-16 lg:w-24 h-0.5 mx-2 sm:mx-4 ${
                        step.id < currentStep 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                          : 'bg-slate-700'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Progress Text */}
              <p className="text-center text-amber-400 mt-6 font-medium">
                {isHebrew ? `שלב ${currentStep} מתוך 5` : `Step ${currentStep} of 5`}
              </p>
            </div>

            {/* Premium Form Card */}
            <div 
              className="rounded-3xl p-6 sm:p-8 lg:p-10 backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
              }}
            >
              <form onSubmit={form.handleSubmit(onSubmit)}>
              
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {isHebrew ? 'פרטים אישיים' : 'Personal Information'}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'ספר לנו קצת על עצמך' : 'Tell us a bit about yourself'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'שם פרטי' : 'First Name'} *</Label>
                      <Input 
                        {...form.register('firstName')}
                        placeholder={isHebrew ? 'ישראל' : 'John'}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-first-name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'שם משפחה' : 'Last Name'} *</Label>
                      <Input 
                        {...form.register('lastName')}
                        placeholder={isHebrew ? 'ישראלי' : 'Doe'}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-last-name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'אימייל' : 'Email'} *</Label>
                      <Input 
                        type="email"
                        {...form.register('email')}
                        placeholder="email@example.com"
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                      <PhoneInput
                        value={form.watch('phoneNumber')}
                        onChange={(value) => form.setValue('phoneNumber', value)}
                        language={isHebrew ? 'he' : 'en'}
                        defaultCountryCode="+972"
                      />
                      {form.formState.errors.phoneNumber && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.phoneNumber.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div data-testid="input-dob">
                      <NativeDateSelect
                        value={form.watch('dateOfBirth')}
                        onChange={(date) => form.setValue('dateOfBirth', date)}
                        label={isHebrew ? 'תאריך לידה' : 'Date of Birth'}
                        language={isHebrew ? 'he' : 'en'}
                        minYear={1940}
                        maxYear={new Date().getFullYear() - 18}
                        error={form.formState.errors.dateOfBirth?.message}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'תעודת זהות / פספורט / רישיון נהיגה' : 'ID / Passport / Driver\'s License'} *</Label>
                      <Input 
                        {...form.register('nationalId')}
                        placeholder={isHebrew ? 'מספר תעודה מזהה' : '123456789'}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-national-id"
                      />
                    </div>
                  </div>

                  <div>
                    <GooglePlacesAutocomplete
                      value={form.watch('streetAddress')}
                      onChange={(value, details) => {
                        form.setValue('streetAddress', value);
                        if (details?.city) {
                          form.setValue('city', details.city);
                        }
                        if (details?.postalCode) {
                          form.setValue('postalCode', details.postalCode);
                        }
                      }}
                      onPlaceSelected={(place: PlaceDetails) => {
                        form.setValue('streetAddress', place.formattedAddress);
                        if (place.city) form.setValue('city', place.city);
                        if (place.postalCode) form.setValue('postalCode', place.postalCode);
                      }}
                      label={isHebrew ? 'כתובת' : 'Street Address'}
                      placeholder={isHebrew ? 'הקלד כתובת...' : 'Start typing your address...'}
                      required
                      country={['il']}
                      error={form.formState.errors.streetAddress?.message}
                      className="[&_input]:bg-slate-800/50 [&_input]:border-slate-600 [&_input]:text-white [&_input]:placeholder:text-slate-500 [&_input]:focus:border-amber-500 [&_label]:text-gray-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'עיר' : 'City'} *</Label>
                      <Input 
                        {...form.register('city')}
                        placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-city"
                      />
                      {form.formState.errors.city && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.city.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'מיקוד' : 'Postal Code'}</Label>
                      <Input 
                        {...form.register('postalCode')}
                        placeholder="6100000"
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-postal"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium mb-3 block">
                      {isHebrew ? 'תמונת פרופיל' : 'Profile Photo'} *
                    </Label>
                    <p className="text-gray-500 text-xs mb-3">
                      {isHebrew 
                        ? 'תמונה ברורה שלך תעזור ללקוחות להכיר אותך. תמונת פנים מקצועית מומלצת.'
                        : 'A clear photo helps clients recognize you. Professional headshot recommended.'}
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      data-testid="input-profile-photo"
                    />

                    {profilePhotoPreview ? (
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img
                            src={profilePhotoPreview}
                            alt="Profile preview"
                            className="w-28 h-28 rounded-2xl object-cover border-2 border-amber-500/50 shadow-lg"
                          />
                          <button
                            type="button"
                            onClick={removePhoto}
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                            data-testid="button-remove-photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <p className="text-emerald-400 text-sm font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            {isHebrew ? 'תמונה נבחרה' : 'Photo selected'}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">{profilePhoto?.name}</p>
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            className="text-amber-400 text-xs mt-2 hover:underline"
                          >
                            {isHebrew ? 'החלף תמונה' : 'Change photo'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-600 hover:border-amber-500/50 rounded-2xl p-8 transition-all hover:bg-slate-800/30 group"
                        data-testid="button-upload-photo"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-slate-700/50 group-hover:bg-amber-500/20 flex items-center justify-center transition-all">
                            <Camera className="w-8 h-8 text-slate-400 group-hover:text-amber-400 transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300 font-medium text-sm">
                              {isHebrew ? 'לחץ להעלאת תמונה' : 'Click to upload photo'}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              JPG, PNG {isHebrew ? 'עד' : 'up to'} 10MB
                            </p>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Services */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {isHebrew ? 'שירותים שתרצה לספק' : 'Services You Want to Provide'}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'בחר את סוגי השירותים שלך' : 'Choose your service types'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label className="block text-gray-300 font-medium">{isHebrew ? 'בחר שירותים' : 'Select Services'} *</Label>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-300 text-xs font-medium px-2 py-1 rounded-full bg-blue-500/15 border border-blue-400/30">
                          {isHebrew ? 'ניתן לבחור מספר שירותים' : 'Select multiple'}
                        </span>
                        {form.watch('serviceTypes').length > 0 && (
                          <span className="text-emerald-300 text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30">
                            {form.watch('serviceTypes').length} {isHebrew ? 'נבחרו' : 'selected'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {serviceTypeOptions.map((service) => {
                        const isSelected = form.watch('serviceTypes').includes(service.id);
                        return (
                          <div
                            key={service.id}
                            onClick={() => {
                              const current = form.getValues('serviceTypes');
                              if (isSelected) {
                                form.setValue('serviceTypes', current.filter(s => s !== service.id));
                              } else {
                                form.setValue('serviceTypes', [...current, service.id]);
                              }
                            }}
                            className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                              isSelected 
                                ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10'
                                : 'bg-slate-800/50 border border-slate-600 hover:border-amber-500/30'
                            }`}
                            data-testid={`service-${service.id}`}
                          >
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300">
                              {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-amber-400" />
                              ) : (
                                <div className="w-5 h-5 rounded border-2 border-slate-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {service.icon && <service.icon className={`w-7 h-7 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />}
                              <span className={`font-medium ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                                {isHebrew ? service.labelHe : service.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {form.formState.errors.serviceTypes && (
                      <p className="text-red-400 text-sm mt-2">{form.formState.errors.serviceTypes.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="mb-4 block text-gray-300 font-medium">{isHebrew ? 'סוגי חיות מחמד' : 'Pet Types Accepted'} *</Label>
                    <div className="flex flex-wrap gap-3">
                      {petTypeOptions.map((pet) => {
                        const isSelected = form.watch('petTypesAccepted').includes(pet.id);
                        return (
                          <div
                            key={pet.id}
                            onClick={() => {
                              const current = form.getValues('petTypesAccepted');
                              if (isSelected) {
                                form.setValue('petTypesAccepted', current.filter(p => p !== pet.id));
                              } else {
                                form.setValue('petTypesAccepted', [...current, pet.id]);
                              }
                            }}
                            className={`px-5 py-3 rounded-xl cursor-pointer transition-all font-medium ${
                              isSelected 
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                                : 'bg-slate-800/50 border border-slate-600 text-gray-400 hover:border-amber-500/30'
                            }`}
                            data-testid={`pet-${pet.id}`}
                          >
                            {isHebrew ? pet.labelHe : pet.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'רדיוס שירות (ק"מ)' : 'Service Radius (km)'}</Label>
                      <Input 
                        type="number"
                        {...form.register('serviceRadius', { valueAsNumber: true })}
                        min={1}
                        max={100}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-radius"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 font-medium">{isHebrew ? 'מקסימום חיות במקביל' : 'Max Pets at Once'}</Label>
                      <Input 
                        type="number"
                        {...form.register('maxPetsAtOnce', { valueAsNumber: true })}
                        min={1}
                        max={20}
                        className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-max-pets"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-800/30 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasVehicle"
                        checked={form.watch('hasOwnVehicle')}
                        onCheckedChange={(checked) => form.setValue('hasOwnVehicle', !!checked)}
                        className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        data-testid="checkbox-vehicle"
                      />
                      <Label htmlFor="hasVehicle" className="cursor-pointer text-gray-300">
                        {isHebrew ? 'יש לי רכב פרטי' : 'I have my own vehicle'}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasHome"
                        checked={form.watch('hasHomeSpace')}
                        onCheckedChange={(checked) => form.setValue('hasHomeSpace', !!checked)}
                        className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        data-testid="checkbox-home"
                      />
                      <Label htmlFor="hasHome" className="cursor-pointer text-gray-300">
                        {isHebrew ? 'יש לי מקום בבית לאירוח חיות' : 'I have space at home to host pets'}
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Experience */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {isHebrew ? 'ניסיון וכישורים' : 'Experience & Qualifications'}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'שתף את הניסיון שלך' : 'Share your expertise'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium">{isHebrew ? 'שנות ניסיון עם חיות מחמד' : 'Years of Pet Experience'}</Label>
                    <Input 
                      type="number"
                      {...form.register('yearsExperience', { valueAsNumber: true })}
                      min={0}
                      max={50}
                      className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white focus:border-amber-500 focus:ring-amber-500/20 rounded-xl max-w-xs"
                      data-testid="input-experience"
                    />
                  </div>

                  <div>
                    <Label className="mb-4 block text-gray-300 font-medium">{isHebrew ? 'שפות' : 'Languages'} *</Label>
                    <div className="flex flex-wrap gap-3">
                      {languageOptions.map((lang) => {
                        const isSelected = form.watch('languages').includes(lang.id);
                        return (
                          <div
                            key={lang.id}
                            onClick={() => {
                              const current = form.getValues('languages');
                              if (isSelected && current.length > 1) {
                                form.setValue('languages', current.filter(l => l !== lang.id));
                              } else if (!isSelected) {
                                form.setValue('languages', [...current, lang.id]);
                              }
                            }}
                            className={`px-5 py-3 rounded-xl cursor-pointer transition-all font-medium ${
                              isSelected 
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                                : 'bg-slate-800/50 border border-slate-600 text-gray-400 hover:border-amber-500/30'
                            }`}
                            data-testid={`lang-${lang.id}`}
                          >
                            {isHebrew ? lang.labelHe : lang.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium">{isHebrew ? 'ספר לנו על עצמך' : 'Tell us about yourself'} *</Label>
                    <p className="text-sm text-gray-500 mb-3">
                      {isHebrew 
                        ? 'שתף את הניסיון שלך עם חיות מחמד, למה אתה אוהב לעבוד איתם, ומה הופך אותך לספק שירות מצוין.'
                        : 'Share your experience with pets, why you love working with them, and what makes you a great service provider.'}
                    </p>
                    <Textarea 
                      {...form.register('biography')}
                      rows={6}
                      placeholder={isHebrew 
                        ? 'אני אוהב חיות מחמד מגיל צעיר...'
                        : 'I have loved pets since I was young...'}
                      className="mt-2 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                      data-testid="input-biography"
                    />
                    {form.formState.errors.biography && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.biography.message}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {form.watch('biography')?.length || 0}/2000
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Emergency Contact */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {isHebrew ? 'איש קשר לחירום' : 'Emergency Contact'}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'למקרים בלתי צפויים' : 'For unexpected situations'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium">{isHebrew ? 'שם מלא' : 'Full Name'} *</Label>
                    <Input 
                      {...form.register('emergencyContactName')}
                      placeholder={isHebrew ? 'שרה כהן' : 'Sarah Cohen'}
                      className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                      data-testid="input-emergency-name"
                    />
                    {form.formState.errors.emergencyContactName && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.emergencyContactName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium">{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                    <Input 
                      type="tel"
                      {...form.register('emergencyContactPhone')}
                      placeholder="050-987-6543"
                      className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                      data-testid="input-emergency-phone"
                    />
                    {form.formState.errors.emergencyContactPhone && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.emergencyContactPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-300 font-medium">{isHebrew ? 'קרבה משפחתית' : 'Relationship'} *</Label>
                    <Input 
                      {...form.register('emergencyContactRelation')}
                      placeholder={isHebrew ? 'אח/אחות, הורה, בן/בת זוג' : 'Sibling, Parent, Spouse'}
                      className="mt-2 h-12 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                      data-testid="input-emergency-relation"
                    />
                    {form.formState.errors.emergencyContactRelation && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.emergencyContactRelation.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Legal & Consent */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {isHebrew ? 'הסכמות משפטיות' : 'Legal Consents'}
                      </h2>
                      <p className="text-gray-400 text-sm">{isHebrew ? 'השלב האחרון!' : 'Final step!'}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-start gap-3">
                      <Shield className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold text-white mb-1">
                          {isHebrew ? 'חוק הפרטיות הישראלי 2025' : 'Israeli Privacy Law 2025'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {isHebrew 
                            ? 'המידע שלך מוגן לפי חוק הגנת הפרטיות הישראלי. אנו מתחייבים לשמור על פרטיותך.'
                            : 'Your data is protected under Israeli Privacy Law. We are committed to protecting your privacy.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 p-5 rounded-2xl bg-slate-800/30 border border-slate-700">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="privacyConsent"
                        checked={form.watch('privacyConsent')}
                        onCheckedChange={(checked) => form.setValue('privacyConsent', !!checked)}
                        className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                        data-testid="checkbox-privacy"
                      />
                      <Label htmlFor="privacyConsent" className="cursor-pointer text-gray-300">
                        {isHebrew 
                          ? 'קראתי ואני מסכים/ה למדיניות הפרטיות ותנאי השימוש *'
                          : 'I have read and agree to the Privacy Policy and Terms of Service *'}
                      </Label>
                    </div>
                    {form.formState.errors.privacyConsent && (
                      <p className="text-red-400 text-sm">{form.formState.errors.privacyConsent.message}</p>
                    )}

                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="dataRetention"
                        checked={form.watch('dataRetentionAcknowledged')}
                        onCheckedChange={(checked) => form.setValue('dataRetentionAcknowledged', !!checked)}
                        className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                        data-testid="checkbox-retention"
                      />
                      <Label htmlFor="dataRetention" className="cursor-pointer text-gray-300">
                        {isHebrew 
                          ? 'אני מאשר/ת שהנתונים שלי יישמרו לצורך עיבוד הבקשה ושיפור השירות *'
                          : 'I acknowledge that my data will be stored for application processing and service improvement *'}
                      </Label>
                    </div>
                    {form.formState.errors.dataRetentionAcknowledged && (
                      <p className="text-red-400 text-sm">{form.formState.errors.dataRetentionAcknowledged.message}</p>
                    )}

                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="marketing"
                        checked={form.watch('marketingConsent')}
                        onCheckedChange={(checked) => form.setValue('marketingConsent', !!checked)}
                        className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                        data-testid="checkbox-marketing"
                      />
                      <Label htmlFor="marketing" className="cursor-pointer text-gray-500">
                        {isHebrew 
                          ? 'אני מסכים/ה לקבל עדכונים והצעות מיוחדות (אופציונלי)'
                          : 'I agree to receive updates and special offers (optional)'}
                      </Label>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <FileCheck className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold text-white mb-2">
                          {isHebrew ? 'מה קורה אחרי?' : 'What happens next?'}
                        </h3>
                        <ul className="text-sm text-gray-400 space-y-2">
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">1</span>
                            {isHebrew ? 'נבדוק את הבקשה שלך' : 'We review your application'}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span>
                            {isHebrew ? 'תתבקש להעלות מסמכים' : 'You\'ll upload required documents'}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">3</span>
                            {isHebrew ? 'בדיקת רקע' : 'Background check'}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">4</span>
                            {isHebrew ? 'אישור סופי ותחילת עבודה!' : 'Final approval and start working!'}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-10 pt-8 border-t border-slate-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-6 py-5 rounded-xl border-slate-600 text-gray-300 hover:bg-slate-800 disabled:opacity-30"
                  data-testid="button-prev"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {isHebrew ? 'הקודם' : 'Previous'}
                </Button>

                {currentStep < 5 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-8 py-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    data-testid="button-next"
                  >
                    {isHebrew ? 'הבא' : 'Next'}
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="flex items-center gap-2 px-8 py-5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    data-testid="button-submit"
                  >
                    {submitMutation.isPending 
                      ? (isHebrew ? 'שולח...' : 'Submitting...')
                      : (isHebrew ? 'הגש בקשה' : 'Submit Application')}
                    <CheckCircle2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Trust Indicators */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="flex items-center gap-4 p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.2)'
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{isHebrew ? 'מאובטח' : 'Secure'}</p>
                <p className="text-xs text-gray-400">{isHebrew ? 'הצפנה מקצה לקצה' : 'End-to-end encryption'}</p>
              </div>
            </div>
            <div 
              className="flex items-center gap-4 p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(244,63,94,0.1) 0%, rgba(244,63,94,0.05) 100%)',
                border: '1px solid rgba(244,63,94,0.2)'
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <Heart className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{isHebrew ? 'אוהבי חיות' : 'Pet Lovers'}</p>
                <p className="text-xs text-gray-400">{isHebrew ? 'קהילה של מקצוענים' : 'Professional community'}</p>
              </div>
            </div>
            <div 
              className="flex items-center gap-4 p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%)',
                border: '1px solid rgba(245,158,11,0.2)'
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{isHebrew ? 'מובילים בישראל' : 'Israel\'s #1'}</p>
                <p className="text-xs text-gray-400">{isHebrew ? 'רשת טיפוח מובילה' : 'Leading pet care network'}</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
