import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  FileCheck
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

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
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
      const response = await apiRequest('POST', '/api/provider-applications', data);
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
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="luxury-glass-card p-8 max-w-md w-full text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h2 className="luxury-heading-lg mb-4">
              {isHebrew ? 'התחברות נדרשת' : 'Login Required'}
            </h2>
            <p className="luxury-text-body mb-6">
              {isHebrew 
                ? 'יש להתחבר כדי להגיש בקשה להצטרפות לצוות הנותנים שלנו.'
                : 'Please log in to apply to become a provider on our platform.'}
            </p>
            <Link href="/login">
              <Button className="luxury-btn-primary w-full" data-testid="button-login">
                {isHebrew ? 'התחבר' : 'Log In'}
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="luxury-glass-card p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">
              {isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted!'}
            </h2>
            <p className="luxury-text-body mb-6">
              {isHebrew 
                ? 'תודה על הבקשה שלך להצטרף לצוות Pet Wash™. נבדוק את הפרטים שלך ונחזור אליך תוך 2-3 ימי עסקים.'
                : 'Thank you for applying to join the Pet Wash™ team. We will review your details and get back to you within 2-3 business days.'}
            </p>
            <div className="space-y-3">
              <Link href="/my-applications">
                <Button className="luxury-btn-primary w-full" data-testid="button-track-application">
                  {isHebrew ? 'עקוב אחר הבקשה' : 'Track Application'}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full" data-testid="button-back-home">
                  {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              {isHebrew ? 'הצטרף לצוות שלנו' : 'Join Our Team'}
            </Badge>
            <h1 className="luxury-heading-xl mb-2">
              {isHebrew ? 'הפוך לספק שירות' : 'Become a Provider'}
            </h1>
            <p className="luxury-text-body max-w-2xl mx-auto">
              {isHebrew 
                ? 'הצטרף לרשת ספקי השירות המובילה בישראל. אנו מחפשים אנשים מסורים שאוהבים חיות מחמד.'
                : 'Join Israel\'s leading pet care provider network. We\'re looking for dedicated animal lovers.'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-2 mb-4" />
            <div className="flex justify-between">
              {steps.map((step) => (
                <div 
                  key={step.id}
                  className={`flex flex-col items-center ${
                    step.id <= currentStep ? 'text-purple-600' : 'text-gray-400'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    step.id < currentStep 
                      ? 'bg-green-500 text-white'
                      : step.id === currentStep 
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    {step.id < currentStep ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs hidden sm:block">
                    {isHebrew ? step.titleHe : step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="luxury-glass-card p-6 sm:p-8">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="luxury-heading-md mb-6">
                    {isHebrew ? 'פרטים אישיים' : 'Personal Information'}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{isHebrew ? 'שם פרטי' : 'First Name'} *</Label>
                      <Input 
                        {...form.register('firstName')}
                        placeholder={isHebrew ? 'ישראל' : 'John'}
                        className="mt-1"
                        data-testid="input-first-name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>{isHebrew ? 'שם משפחה' : 'Last Name'} *</Label>
                      <Input 
                        {...form.register('lastName')}
                        placeholder={isHebrew ? 'ישראלי' : 'Doe'}
                        className="mt-1"
                        data-testid="input-last-name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{isHebrew ? 'אימייל' : 'Email'} *</Label>
                      <Input 
                        type="email"
                        {...form.register('email')}
                        placeholder="email@example.com"
                        className="mt-1"
                        data-testid="input-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                      <Input 
                        type="tel"
                        {...form.register('phoneNumber')}
                        placeholder="050-123-4567"
                        className="mt-1"
                        data-testid="input-phone"
                      />
                      {form.formState.errors.phoneNumber && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.phoneNumber.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{isHebrew ? 'תאריך לידה' : 'Date of Birth'} *</Label>
                      <Input 
                        type="date"
                        {...form.register('dateOfBirth')}
                        className="mt-1"
                        data-testid="input-dob"
                      />
                      {form.formState.errors.dateOfBirth && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.dateOfBirth.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>{isHebrew ? 'תעודת זהות' : 'National ID'}</Label>
                      <Input 
                        {...form.register('nationalId')}
                        placeholder="123456789"
                        className="mt-1"
                        data-testid="input-national-id"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>{isHebrew ? 'כתובת' : 'Street Address'} *</Label>
                    <Input 
                      {...form.register('streetAddress')}
                      placeholder={isHebrew ? 'רחוב דיזנגוף 100' : '100 Dizengoff Street'}
                      className="mt-1"
                      data-testid="input-address"
                    />
                    {form.formState.errors.streetAddress && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.streetAddress.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{isHebrew ? 'עיר' : 'City'} *</Label>
                      <Input 
                        {...form.register('city')}
                        placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                        className="mt-1"
                        data-testid="input-city"
                      />
                      {form.formState.errors.city && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.city.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>{isHebrew ? 'מיקוד' : 'Postal Code'}</Label>
                      <Input 
                        {...form.register('postalCode')}
                        placeholder="6100000"
                        className="mt-1"
                        data-testid="input-postal"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Services */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="luxury-heading-md mb-6">
                    {isHebrew ? 'שירותים שתרצה לספק' : 'Services You Want to Provide'}
                  </h2>
                  
                  <div>
                    <Label className="mb-3 block">{isHebrew ? 'בחר שירותים' : 'Select Services'} *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                            }`}
                            data-testid={`service-${service.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {service.icon && <service.icon className={`w-6 h-6 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />}
                              <span className={isSelected ? 'font-semibold text-purple-700 dark:text-purple-300' : ''}>
                                {isHebrew ? service.labelHe : service.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {form.formState.errors.serviceTypes && (
                      <p className="text-red-500 text-sm mt-2">{form.formState.errors.serviceTypes.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="mb-3 block">{isHebrew ? 'סוגי חיות מחמד' : 'Pet Types Accepted'} *</Label>
                    <div className="flex flex-wrap gap-2">
                      {petTypeOptions.map((pet) => {
                        const isSelected = form.watch('petTypesAccepted').includes(pet.id);
                        return (
                          <Badge
                            key={pet.id}
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer px-4 py-2 ${
                              isSelected ? 'bg-purple-600' : ''
                            }`}
                            onClick={() => {
                              const current = form.getValues('petTypesAccepted');
                              if (isSelected) {
                                form.setValue('petTypesAccepted', current.filter(p => p !== pet.id));
                              } else {
                                form.setValue('petTypesAccepted', [...current, pet.id]);
                              }
                            }}
                            data-testid={`pet-${pet.id}`}
                          >
                            {isHebrew ? pet.labelHe : pet.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{isHebrew ? 'רדיוס שירות (ק"מ)' : 'Service Radius (km)'}</Label>
                      <Input 
                        type="number"
                        {...form.register('serviceRadius', { valueAsNumber: true })}
                        min={1}
                        max={100}
                        className="mt-1"
                        data-testid="input-radius"
                      />
                    </div>
                    <div>
                      <Label>{isHebrew ? 'מקסימום חיות במקביל' : 'Max Pets at Once'}</Label>
                      <Input 
                        type="number"
                        {...form.register('maxPetsAtOnce', { valueAsNumber: true })}
                        min={1}
                        max={20}
                        className="mt-1"
                        data-testid="input-max-pets"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasVehicle"
                        checked={form.watch('hasOwnVehicle')}
                        onCheckedChange={(checked) => form.setValue('hasOwnVehicle', !!checked)}
                        data-testid="checkbox-vehicle"
                      />
                      <Label htmlFor="hasVehicle" className="cursor-pointer">
                        {isHebrew ? 'יש לי רכב פרטי' : 'I have my own vehicle'}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasHome"
                        checked={form.watch('hasHomeSpace')}
                        onCheckedChange={(checked) => form.setValue('hasHomeSpace', !!checked)}
                        data-testid="checkbox-home"
                      />
                      <Label htmlFor="hasHome" className="cursor-pointer">
                        {isHebrew ? 'יש לי מקום בבית לאירוח חיות' : 'I have space at home to host pets'}
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Experience */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="luxury-heading-md mb-6">
                    {isHebrew ? 'ניסיון וכישורים' : 'Experience & Qualifications'}
                  </h2>

                  <div>
                    <Label>{isHebrew ? 'שנות ניסיון עם חיות מחמד' : 'Years of Pet Experience'}</Label>
                    <Input 
                      type="number"
                      {...form.register('yearsExperience', { valueAsNumber: true })}
                      min={0}
                      max={50}
                      className="mt-1 max-w-xs"
                      data-testid="input-experience"
                    />
                  </div>

                  <div>
                    <Label className="mb-3 block">{isHebrew ? 'שפות' : 'Languages'} *</Label>
                    <div className="flex flex-wrap gap-2">
                      {languageOptions.map((lang) => {
                        const isSelected = form.watch('languages').includes(lang.id);
                        return (
                          <Badge
                            key={lang.id}
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer px-4 py-2 ${
                              isSelected ? 'bg-purple-600' : ''
                            }`}
                            onClick={() => {
                              const current = form.getValues('languages');
                              if (isSelected && current.length > 1) {
                                form.setValue('languages', current.filter(l => l !== lang.id));
                              } else if (!isSelected) {
                                form.setValue('languages', [...current, lang.id]);
                              }
                            }}
                            data-testid={`lang-${lang.id}`}
                          >
                            {isHebrew ? lang.labelHe : lang.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>{isHebrew ? 'ספר לנו על עצמך' : 'Tell us about yourself'} *</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
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
                      className="mt-1"
                      data-testid="input-biography"
                    />
                    {form.formState.errors.biography && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.biography.message}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      {form.watch('biography')?.length || 0}/2000
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Emergency Contact */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="luxury-heading-md mb-6">
                    {isHebrew ? 'איש קשר לחירום' : 'Emergency Contact'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {isHebrew 
                      ? 'נצטרך איש קשר לחירום למקרים בלתי צפויים.'
                      : 'We need an emergency contact for unexpected situations.'}
                  </p>

                  <div>
                    <Label>{isHebrew ? 'שם מלא' : 'Full Name'} *</Label>
                    <Input 
                      {...form.register('emergencyContactName')}
                      placeholder={isHebrew ? 'שרה כהן' : 'Sarah Cohen'}
                      className="mt-1"
                      data-testid="input-emergency-name"
                    />
                    {form.formState.errors.emergencyContactName && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.emergencyContactName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                    <Input 
                      type="tel"
                      {...form.register('emergencyContactPhone')}
                      placeholder="050-987-6543"
                      className="mt-1"
                      data-testid="input-emergency-phone"
                    />
                    {form.formState.errors.emergencyContactPhone && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.emergencyContactPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>{isHebrew ? 'קרבה משפחתית' : 'Relationship'} *</Label>
                    <Input 
                      {...form.register('emergencyContactRelation')}
                      placeholder={isHebrew ? 'אח/אחות, הורה, בן/בת זוג' : 'Sibling, Parent, Spouse'}
                      className="mt-1"
                      data-testid="input-emergency-relation"
                    />
                    {form.formState.errors.emergencyContactRelation && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.emergencyContactRelation.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Legal & Consent */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="luxury-heading-md mb-6">
                    {isHebrew ? 'הסכמות משפטיות' : 'Legal Consents'}
                  </h2>

                  <div className="luxury-glass-minimal p-4 rounded-xl mb-6">
                    <div className="flex items-start gap-3">
                      <Shield className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold mb-1">
                          {isHebrew ? 'חוק הפרטיות הישראלי 2025' : 'Israeli Privacy Law 2025'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isHebrew 
                            ? 'המידע שלך מוגן לפי חוק הגנת הפרטיות הישראלי. אנו מתחייבים לשמור על פרטיותך.'
                            : 'Your data is protected under Israeli Privacy Law. We are committed to protecting your privacy.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="privacyConsent"
                        checked={form.watch('privacyConsent')}
                        onCheckedChange={(checked) => form.setValue('privacyConsent', !!checked)}
                        data-testid="checkbox-privacy"
                      />
                      <Label htmlFor="privacyConsent" className="cursor-pointer">
                        {isHebrew 
                          ? 'קראתי ואני מסכים/ה למדיניות הפרטיות ותנאי השימוש *'
                          : 'I have read and agree to the Privacy Policy and Terms of Service *'}
                      </Label>
                    </div>
                    {form.formState.errors.privacyConsent && (
                      <p className="text-red-500 text-sm">{form.formState.errors.privacyConsent.message}</p>
                    )}

                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="dataRetention"
                        checked={form.watch('dataRetentionAcknowledged')}
                        onCheckedChange={(checked) => form.setValue('dataRetentionAcknowledged', !!checked)}
                        data-testid="checkbox-retention"
                      />
                      <Label htmlFor="dataRetention" className="cursor-pointer">
                        {isHebrew 
                          ? 'אני מאשר/ת שהנתונים שלי יישמרו לצורך עיבוד הבקשה ושיפור השירות *'
                          : 'I acknowledge that my data will be stored for application processing and service improvement *'}
                      </Label>
                    </div>
                    {form.formState.errors.dataRetentionAcknowledged && (
                      <p className="text-red-500 text-sm">{form.formState.errors.dataRetentionAcknowledged.message}</p>
                    )}

                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="marketing"
                        checked={form.watch('marketingConsent')}
                        onCheckedChange={(checked) => form.setValue('marketingConsent', !!checked)}
                        data-testid="checkbox-marketing"
                      />
                      <Label htmlFor="marketing" className="cursor-pointer text-gray-600 dark:text-gray-400">
                        {isHebrew 
                          ? 'אני מסכים/ה לקבל עדכונים והצעות מיוחדות (אופציונלי)'
                          : 'I agree to receive updates and special offers (optional)'}
                      </Label>
                    </div>
                  </div>

                  <div className="luxury-glass-minimal p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <div className="flex items-start gap-3">
                      <FileCheck className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold mb-1">
                          {isHebrew ? 'מה קורה אחרי?' : 'What happens next?'}
                        </h3>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <li>1. {isHebrew ? 'נבדוק את הבקשה שלך' : 'We review your application'}</li>
                          <li>2. {isHebrew ? 'תתבקש להעלות מסמכים' : 'You\'ll upload required documents'}</li>
                          <li>3. {isHebrew ? 'בדיקת רקע' : 'Background check'}</li>
                          <li>4. {isHebrew ? 'אישור סופי ותחילת עבודה!' : 'Final approval and start working!'}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2"
                  data-testid="button-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {isHebrew ? 'הקודם' : 'Previous'}
                </Button>

                {currentStep < 5 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="luxury-btn-primary flex items-center gap-2"
                    data-testid="button-next"
                  >
                    {isHebrew ? 'הבא' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="luxury-btn-primary flex items-center gap-2"
                    data-testid="button-submit"
                  >
                    {submitMutation.isPending 
                      ? (isHebrew ? 'שולח...' : 'Submitting...')
                      : (isHebrew ? 'הגש בקשה' : 'Submit Application')}
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 luxury-glass-minimal rounded-xl">
              <Shield className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-semibold text-sm">{isHebrew ? 'מאובטח' : 'Secure'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'הצפנה מקצה לקצה' : 'End-to-end encryption'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 luxury-glass-minimal rounded-xl">
              <Heart className="w-8 h-8 text-red-500" />
              <div>
                <p className="font-semibold text-sm">{isHebrew ? 'אוהבי חיות' : 'Pet Lovers'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'קהילה של מקצוענים' : 'Professional community'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 luxury-glass-minimal rounded-xl">
              <Award className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="font-semibold text-sm">{isHebrew ? 'מובילים בישראל' : 'Israel\'s #1'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'רשת טיפוח מובילה' : 'Leading pet care network'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
