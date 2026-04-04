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
import { getApiUrl } from '@/lib/apiConfig';
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
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
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

const platformOptions = [
  { id: 'sitter_suite', icon: Home, label: 'The Sitter Suite™', labelHe: 'שמרטפות', desc: 'Pet sitting & hosting', descHe: 'שמירה ואירוח חיות מחמד' },
  { id: 'walk_my_pet', icon: Dog, label: 'Walk My Pet™', labelHe: 'טיולי כלבים', desc: 'Dog walking services', descHe: 'שירותי טיולי כלבים' },
  { id: 'wash_academy', icon: Sparkles, label: 'Pet Wash Academy™', labelHe: 'אקדמיית שטיפה', desc: 'Grooming & wash training', descHe: 'הכשרה בטיפוח ושטיפה' },
];

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
  { id: 6, title: 'Photos', titleHe: 'תמונות', icon: Camera },
];

export default function BecomeProvider() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user: firebaseUser } = useFirebaseAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [membershipNumber, setMembershipNumber] = useState<string | null>(null);

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

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - galleryPhotos.length;
    const toAdd = files.slice(0, remaining).filter(f => f.size <= 10 * 1024 * 1024);
    const newPhotos = [...galleryPhotos, ...toAdd];
    setGalleryPhotos(newPhotos);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setGalleryPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryPhoto = (index: number) => {
    setGalleryPhotos(prev => prev.filter((_, i) => i !== index));
    setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
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
      gender: undefined,
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
      formData.append('applicationData', JSON.stringify({ ...data, platforms: selectedPlatforms, gender: form.getValues('gender') || undefined }));
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }
      galleryPhotos.forEach((photo) => { formData.append('galleryPhotos', photo); });
      const token = firebaseUser ? await (firebaseUser as any).getIdToken?.() : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const doFetch = async () => {
        const response = await fetch(getApiUrl('/api/provider-applications'), {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
        return response;
      };
      let response = await doFetch();
      if (response.status === 503) {
        await new Promise(r => setTimeout(r, 800));
        response = await doFetch();
      }
      if (!response.ok) {
        const traceId = response.headers.get('x-trace-id') || '';
        let errBody: any = null;
        try { errBody = await response.json(); } catch { errBody = {}; }
        console.error('[ProviderApplication] Submit failed', { status: response.status, traceId, errBody });
        const status = response.status;
        let userMsg: string;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          userMsg = isHebrew ? 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.' : 'No internet connection. Please check your connection and try again.';
        } else if (status === 401) {
          userMsg = isHebrew ? 'הפגישה פגה. אנא היכנס שוב.' : 'Session expired. Please sign in again.';
        } else if (status === 403) {
          userMsg = isHebrew ? 'אין הרשאה.' : 'Not authorized.';
        } else if (status === 409) {
          userMsg = errBody?.error || (isHebrew ? 'כבר קיימת בקשה פעילה.' : 'You already have an active application.');
        } else if (status === 429) {
          userMsg = isHebrew ? 'יותר מדי ניסיונות. אנא המתן ונסה שוב.' : 'Too many attempts. Please wait and try again.';
        } else if (status === 503) {
          userMsg = isHebrew ? 'השירות לא זמין כרגע. אנא נסה שוב בעוד רגע.' : 'Service temporarily unavailable. Please try again in a moment.';
        } else {
          userMsg = isHebrew ? 'משהו השתבש. אנא נסה שוב.' : 'Something went wrong. Please try again.';
        }
        throw new Error(userMsg);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      setMembershipNumber(data.membershipNumber);
      toast({
        title: isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted!',
        description: data.membershipNumber
          ? (isHebrew ? `מספר חבר: ${data.membershipNumber}` : `Member #: ${data.membershipNumber}`)
          : (isHebrew ? 'נעבור על הבקשה שלך ונחזור אליך בקרוב.' : 'We will review your application and get back to you soon.'),
      });
      navigate('/provider/pending');
    },
    onError: (error: any) => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'משהו השתבש' : 'Something went wrong'),
        variant: 'destructive',
      });
    },
  });

  const stepFields: Record<number, (keyof ApplicationFormData)[]> = {
    1: ['firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'streetAddress', 'city'],
    2: ['serviceTypes'],
    3: ['biography', 'yearsExperience', 'languages', 'serviceRadius', 'maxPetsAtOnce', 'petTypesAccepted'],
    4: ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'],
    5: ['privacyConsent', 'dataRetentionAcknowledged'],
    6: [],
  };

  const nextStep = async () => {
    if (currentStep === 2 && selectedPlatforms.length === 0) {
      toast({
        title: isHebrew ? 'בחר פלטפורמה' : 'Select a Platform',
        description: isHebrew ? 'אנא בחר לפחות פלטפורמה אחת' : 'Please select at least one platform',
        variant: 'destructive',
      });
      return;
    }
    const fields = stepFields[currentStep] || [];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) {
        toast({
          title: isHebrew ? 'נא למלא את כל השדות' : 'Please fill all required fields',
          description: isHebrew ? 'יש שדות חסרים בשלב זה' : 'Some fields in this step need attention',
          variant: 'destructive',
        });
        return;
      }
    }
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const onSubmit = (data: ApplicationFormData) => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: isHebrew ? 'בחר פלטפורמה' : 'Select a Platform',
        description: isHebrew ? 'אנא בחר לפחות פלטפורמה אחת בשלב 2' : 'Please select at least one platform in Step 2',
        variant: 'destructive',
      });
      setCurrentStep(2);
      return;
    }
    submitMutation.mutate(data);
  };

  const progress = (currentStep / 6) * 100;

  // Redirect if not logged in
  if (!firebaseUser) {
    return (
      <Layout>
        <div className="min-h-screen relative overflow-hidden">
          {/* Luxury Background */}
          <div className="absolute inset-0 bg-white" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(198, 166, 100, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)'
          }} />
          
          <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full">
              {/* Premium Glass Card */}
              <div 
                className="p-8 sm:p-10 rounded-3xl text-center backdrop-blur-xl"
                style={{
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)'
                }}
              >
                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-xl">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  {isHebrew ? 'הצטרף לצוות ⁦Pet Wash™⁩' : 'Join ⁦Pet Wash™⁩ Team'}
                </h2>
                
                <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                  {isHebrew 
                    ? 'התחבר כדי להתחיל את מסע ההצטרפות לרשת הספקים המובילה בישראל'
                    : 'Sign in to start your journey with Israel\'s leading pet care provider network'}
                </p>
                
                {/* Benefits Preview */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white flex items-center justify-center">
                      <Heart className="w-6 h-6 text-pink-400" />
                    </div>
                    <p className="text-xs text-gray-500">{isHebrew ? 'גמישות' : 'Flexibility'}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white flex items-center justify-center">
                      <Award className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-xs text-gray-500">{isHebrew ? 'הכנסה' : 'Income'}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white flex items-center justify-center">
                      <Shield className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-xs text-gray-500">{isHebrew ? 'ביטוח' : 'Insurance'}</p>
                  </div>
                </div>
                
                <Link href="/signin?redirect=/become-provider">
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
          <div className="absolute inset-0 bg-emerald-50" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(52, 211, 153, 0.3) 0%, transparent 50%)'
          }} />
          
          <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full">
              <div 
                className="p-8 sm:p-10 rounded-3xl text-center backdrop-blur-xl"
                style={{
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)'
                }}
              >
                {/* Animated Success Icon */}
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-2xl">
                  <CheckCircle2 className="w-14 h-14 text-white" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  {isHebrew ? 'הבקשה נשלחה בהצלחה!' : 'Application Submitted!'}
                </h2>
                
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  {isHebrew 
                    ? 'תודה על הבקשה שלך להצטרף לצוות ⁦Pet Wash™⁩. נבדוק את הפרטים שלך ונחזור אליך תוך 2-3 ימי עסקים.'
                    : 'Thank you for applying to join the ⁦Pet Wash™⁩ team. We will review your details and get back to you within 2-3 business days.'}
                </p>

                {membershipNumber && (
                  <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                    <p className="text-sm text-gray-500 mb-1">
                      {isHebrew ? 'מספר חברות שלך' : 'Your Membership Number'}
                    </p>
                    <p className="text-2xl font-bold text-amber-600 tracking-wide">{membershipNumber}</p>
                  </div>
                )}

                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700">
                    {isHebrew ? 'אישור נשלח לאימייל ולטלפון שלך' : 'Confirmation sent to your email and phone'}
                  </p>
                </div>
                
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
                      className="w-full py-5 text-lg rounded-2xl border-gray-300 text-gray-700 hover:bg-white"
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
        <div className="absolute inset-0 bg-white" />
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
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                {isHebrew ? 'הפוך לספק ' : 'Become a '}
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                  ⁦Pet Wash™⁩
                </span>
              </h1>
              
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
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
                              : 'bg-white border border-gray-300'
                        }`}
                      >
                        {step.id < currentStep ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <step.icon className={`w-6 h-6 ${step.id === currentStep ? 'text-white' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <span className={`text-xs hidden sm:block font-medium ${
                        step.id <= currentStep ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {isHebrew ? step.titleHe : step.title}
                      </span>
                    </div>
                    
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className={`w-8 sm:w-16 lg:w-24 h-0.5 mx-2 sm:mx-4 ${
                        step.id < currentStep 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                          : 'bg-white'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Progress Text */}
              <p className="text-center text-amber-400 mt-6 font-medium">
                {isHebrew ? `שלב ${currentStep} מתוך 6` : `Step ${currentStep} of 6`}
              </p>
            </div>

            {/* Premium Form Card */}
            <div 
              className="rounded-3xl p-6 sm:p-8 lg:p-10 backdrop-blur-xl"
              style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)'
              }}
            >
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                const errorFields = Object.keys(errors);
                if (errorFields.length > 0) {
                  const fieldStepMap: Record<string, number> = {
                    firstName: 1, lastName: 1, email: 1, phoneNumber: 1, dateOfBirth: 1, streetAddress: 1, city: 1, nationalId: 1, gender: 1, postalCode: 1,
                    serviceTypes: 2,
                    biography: 3, yearsExperience: 3, languages: 3, serviceRadius: 3, maxPetsAtOnce: 3, petTypesAccepted: 3, hasOwnVehicle: 3, hasHomeSpace: 3,
                    emergencyContactName: 4, emergencyContactPhone: 4, emergencyContactRelation: 4,
                    privacyConsent: 5, marketingConsent: 5, dataRetentionAcknowledged: 5,
                  };
                  const firstErrorStep = Math.min(...errorFields.map(f => fieldStepMap[f] || 6));
                  if (firstErrorStep !== currentStep) setCurrentStep(firstErrorStep);
                  const firstError = errors[errorFields[0] as keyof ApplicationFormData];
                  toast({
                    title: isHebrew ? 'נא לתקן שגיאות' : 'Please fix errors',
                    description: (firstError?.message as string) || (isHebrew ? 'יש שדות חסרים' : 'Some fields need attention'),
                    variant: 'destructive',
                  });
                }
              })}>
              
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'פרטים אישיים' : 'Personal Information'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'ספר לנו קצת על עצמך' : 'Tell us a bit about yourself'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'שם פרטי' : 'First Name'} *</Label>
                      <Input 
                        {...form.register('firstName')}
                        placeholder={isHebrew ? 'ישראל' : 'John'}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-first-name"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'שם משפחה' : 'Last Name'} *</Label>
                      <Input 
                        {...form.register('lastName')}
                        placeholder={isHebrew ? 'ישראלי' : 'Doe'}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-last-name"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'אימייל' : 'Email'} *</Label>
                      <Input 
                        type="email"
                        {...form.register('email')}
                        placeholder="email@example.com"
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                      <PhoneInput
                        value={form.watch('phoneNumber')}
                        onChange={(value) => form.setValue('phoneNumber', value)}
                        language={isHebrew ? 'he' : 'en'}
                        defaultCountry="IL"
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
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'תעודת זהות / פספורט / רישיון נהיגה' : 'ID / Passport / Driver\'s License'} *</Label>
                      <Input 
                        {...form.register('nationalId')}
                        placeholder={isHebrew ? 'מספר תעודה מזהה' : '123456789'}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-national-id"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium mb-3 block">
                      {isHebrew ? 'מגדר' : 'Gender'}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([
                        { value: 'male', label: 'Male', labelHe: 'זכר' },
                        { value: 'female', label: 'Female', labelHe: 'נקבה' },
                        { value: 'other', label: 'Other', labelHe: 'אחר' },
                        { value: 'prefer_not_to_say', label: 'Prefer not to say', labelHe: 'מעדיף לא לציין' },
                      ] as const).map((option) => {
                        const isSelected = form.watch('gender') === option.value;
                        return (
                          <div
                            key={option.value}
                            onClick={() => form.setValue('gender', option.value)}
                            className={`p-3 rounded-xl cursor-pointer text-center transition-all duration-300 ${
                              isSelected
                                ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10'
                                : 'bg-white border border-gray-300 hover:border-amber-500/30'
                            }`}
                          >
                            <span className={`text-sm font-medium ${isSelected ? 'text-amber-600' : 'text-gray-600'}`}>
                              {isHebrew ? option.labelHe : option.label}
                            </span>
                          </div>
                        );
                      })}
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
                      country={['il', 'us', 'gb', 'au', 'ca']}
                      error={form.formState.errors.streetAddress?.message}
                      className="[&_input]:bg-white [&_input]:border-gray-300 [&_input]:text-gray-900 [&_input]:placeholder:text-gray-400 [&_input]:focus:border-amber-500 [&_label]:text-gray-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'עיר' : 'City'} *</Label>
                      <Input 
                        {...form.register('city')}
                        placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-city"
                      />
                      {form.formState.errors.city && (
                        <p className="text-red-400 text-sm mt-1">{form.formState.errors.city.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'מיקוד' : 'Postal Code'}</Label>
                      <Input 
                        {...form.register('postalCode')}
                        placeholder="6100000"
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-postal"
                      />
                    </div>
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
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'פלטפורמות ושירותים' : 'Platforms & Services'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'בחר את הפלטפורמות והשירותים שלך' : 'Choose your platforms and service types'}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label className="block text-gray-600 font-medium">{isHebrew ? 'בחר פלטפורמות' : 'Choose Platforms'} *</Label>
                      <div className="flex items-center gap-3">
                        <span className="text-purple-300 text-xs font-medium px-2 py-1 rounded-full bg-purple-500/15 border border-purple-400/30">
                          {isHebrew ? 'ניתן לבחור מספר פלטפורמות' : 'Select multiple'}
                        </span>
                        {selectedPlatforms.length > 0 && (
                          <span className="text-emerald-300 text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30">
                            {selectedPlatforms.length} {isHebrew ? 'נבחרו' : 'selected'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {platformOptions.map((platform) => {
                        const isSelected = selectedPlatforms.includes(platform.id);
                        return (
                          <div
                            key={platform.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform.id));
                              } else {
                                setSelectedPlatforms([...selectedPlatforms, platform.id]);
                              }
                            }}
                            className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                              isSelected 
                                ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 shadow-lg shadow-purple-500/10'
                                : 'bg-white border border-gray-300 hover:border-purple-500/30'
                            }`}
                            data-testid={`platform-${platform.id}`}
                          >
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300">
                              {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-purple-400" />
                              ) : (
                                <div className="w-5 h-5 rounded border-2 border-gray-300" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              {platform.icon && <platform.icon className={`w-7 h-7 ${isSelected ? 'text-purple-400' : 'text-gray-400'}`} />}
                              <span className={`font-semibold ${isSelected ? 'text-purple-300' : 'text-gray-600'}`}>
                                {isHebrew ? platform.labelHe : platform.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {isHebrew ? platform.descHe : platform.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {selectedPlatforms.length === 0 && (
                      <p className="text-amber-400 text-sm mb-4">{isHebrew ? 'בחר לפחות פלטפורמה אחת' : 'Select at least one platform'}</p>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label className="block text-gray-600 font-medium">{isHebrew ? 'בחר שירותים' : 'Select Services'} *</Label>
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
                                : 'bg-white border border-gray-300 hover:border-amber-500/30'
                            }`}
                            data-testid={`service-${service.id}`}
                          >
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300">
                              {isSelected ? (
                                <CheckCircle2 className="w-6 h-6 text-amber-400" />
                              ) : (
                                <div className="w-5 h-5 rounded border-2 border-gray-300" />
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {service.icon && <service.icon className={`w-7 h-7 ${isSelected ? 'text-amber-400' : 'text-gray-400'}`} />}
                              <span className={`font-medium ${isSelected ? 'text-amber-300' : 'text-gray-600'}`}>
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
                    <Label className="mb-4 block text-gray-600 font-medium">{isHebrew ? 'סוגי חיות מחמד' : 'Pet Types Accepted'} *</Label>
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
                                : 'bg-white border border-gray-300 text-gray-400 hover:border-amber-500/30'
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
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'רדיוס שירות (ק"מ)' : 'Service Radius (km)'}</Label>
                      <Input 
                        type="number"
                        {...form.register('serviceRadius', { valueAsNumber: true })}
                        min={1}
                        max={100}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-radius"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-600 font-medium">{isHebrew ? 'מקסימום חיות במקביל' : 'Max Pets at Once'}</Label>
                      <Input 
                        type="number"
                        {...form.register('maxPetsAtOnce', { valueAsNumber: true })}
                        min={1}
                        max={20}
                        className="mt-2 h-12 bg-white border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                        data-testid="input-max-pets"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasVehicle"
                        checked={form.watch('hasOwnVehicle')}
                        onCheckedChange={(checked) => form.setValue('hasOwnVehicle', !!checked)}
                        className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        data-testid="checkbox-vehicle"
                      />
                      <Label htmlFor="hasVehicle" className="cursor-pointer text-gray-600">
                        {isHebrew ? 'יש לי רכב פרטי' : 'I have my own vehicle'}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id="hasHome"
                        checked={form.watch('hasHomeSpace')}
                        onCheckedChange={(checked) => form.setValue('hasHomeSpace', !!checked)}
                        className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        data-testid="checkbox-home"
                      />
                      <Label htmlFor="hasHome" className="cursor-pointer text-gray-600">
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
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'ניסיון וכישורים' : 'Experience & Qualifications'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'שתף את הניסיון שלך' : 'Share your expertise'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium">{isHebrew ? 'שנות ניסיון עם חיות מחמד' : 'Years of Pet Experience'}</Label>
                    <Input 
                      type="number"
                      {...form.register('yearsExperience', { valueAsNumber: true })}
                      min={0}
                      max={50}
                      className="mt-2 h-12 bg-white border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl max-w-xs"
                      data-testid="input-experience"
                    />
                  </div>

                  <div>
                    <Label className="mb-4 block text-gray-600 font-medium">{isHebrew ? 'שפות' : 'Languages'} *</Label>
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
                                : 'bg-white border border-gray-300 text-gray-400 hover:border-amber-500/30'
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
                    <Label className="text-gray-600 font-medium">{isHebrew ? 'ספר לנו על עצמך' : 'Tell us about yourself'} *</Label>
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
                      className="mt-2 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
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
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'איש קשר לחירום' : 'Emergency Contact'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'למקרים בלתי צפויים' : 'For unexpected situations'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium">{isHebrew ? 'שם מלא' : 'Full Name'} *</Label>
                    <Input 
                      {...form.register('emergencyContactName')}
                      placeholder={isHebrew ? 'שרה כהן' : 'Sarah Cohen'}
                      className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                      data-testid="input-emergency-name"
                    />
                    {form.formState.errors.emergencyContactName && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.emergencyContactName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium">{isHebrew ? 'טלפון' : 'Phone'} *</Label>
                    <PhoneInput
                      value={form.watch('emergencyContactPhone')}
                      onChange={(value) => form.setValue('emergencyContactPhone', value)}
                      language={isHebrew ? 'he' : 'en'}
                      defaultCountry="IL"
                    />
                    {form.formState.errors.emergencyContactPhone && (
                      <p className="text-red-400 text-sm mt-1">{form.formState.errors.emergencyContactPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium">{isHebrew ? 'קרבה משפחתית' : 'Relationship'} *</Label>
                    <Input 
                      {...form.register('emergencyContactRelation')}
                      placeholder={isHebrew ? 'אח/אחות, הורה, בן/בת זוג' : 'Sibling, Parent, Spouse'}
                      className="mt-2 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
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
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'הסכמות משפטיות' : 'Legal Consents'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'הסכמות והצהרות' : 'Agreements & declarations'}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-start gap-3">
                      <Shield className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
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

                  <div className="space-y-5 p-5 rounded-2xl bg-white border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="privacyConsent"
                        checked={form.watch('privacyConsent')}
                        onCheckedChange={(checked) => form.setValue('privacyConsent', !!checked)}
                        className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                        data-testid="checkbox-privacy"
                      />
                      <Label htmlFor="privacyConsent" className="cursor-pointer text-gray-600">
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
                        className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                        data-testid="checkbox-retention"
                      />
                      <Label htmlFor="dataRetention" className="cursor-pointer text-gray-600">
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
                        className="border-gray-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
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
                        <h3 className="font-semibold text-gray-900 mb-2">
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

              {/* Step 6: Photos */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {isHebrew ? 'תמונות' : 'Photos'}
                      </h2>
                      <p className="text-gray-500 text-sm">{isHebrew ? 'הוסף תמונות פרופיל וגלריה' : 'Add your profile and gallery photos'}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-700">
                      {isHebrew
                        ? 'הוסף תמונות של הבית שלך, חיות המחמד שלך וסביבת העבודה שלך. תמונות אלה עוזרות לבעלי חיות מחמד להרגיש בטוחים בבחירה שלך.'
                        : 'Add photos of your home, your pets, and your working environment. These photos help pet owners feel confident choosing you.'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-gray-600 font-medium mb-3 block">
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
                        className="w-full border-2 border-dashed border-gray-300 hover:border-amber-500/50 rounded-2xl p-8 transition-all hover:bg-white group"
                        data-testid="button-upload-photo"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-white group-hover:bg-amber-500/20 flex items-center justify-center transition-all">
                            <Camera className="w-8 h-8 text-gray-400 group-hover:text-amber-400 transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="text-gray-600 font-medium text-sm">
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

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-gray-600 font-medium">
                        {isHebrew ? 'תמונות גלריה' : 'Gallery Photos'}
                      </Label>
                      <span className="text-gray-400 text-xs">
                        {galleryPreviews.length}/5 {isHebrew ? 'תמונות' : 'photos'}
                      </span>
                    </div>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleGallerySelect}
                      multiple
                      className="hidden"
                      data-testid="input-gallery-photos"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {galleryPreviews.map((preview, index) => (
                        <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                          <img
                            src={preview}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryPhoto(index)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {galleryPhotos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="aspect-square border-2 border-dashed border-gray-300 hover:border-amber-500/50 rounded-2xl transition-all hover:bg-white group flex flex-col items-center justify-center gap-2"
                          data-testid="button-add-gallery"
                        >
                          <div className="w-12 h-12 rounded-full bg-white group-hover:bg-amber-500/20 flex items-center justify-center transition-all">
                            <Upload className="w-6 h-6 text-gray-400 group-hover:text-amber-400 transition-colors" />
                          </div>
                          <p className="text-gray-500 text-xs font-medium">
                            {isHebrew ? 'הוסף תמונה' : 'Add photo'}
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-10 pt-8 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-6 py-5 rounded-xl border-gray-300 text-gray-600 hover:bg-white disabled:opacity-30"
                  data-testid="button-prev"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {isHebrew ? 'הקודם' : 'Previous'}
                </Button>

                {currentStep < 6 ? (
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
                <p className="font-semibold text-gray-900">{isHebrew ? 'מאובטח' : 'Secure'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'הצפנה מקצה לקצה' : 'End-to-end encryption'}</p>
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
                <p className="font-semibold text-gray-900">{isHebrew ? 'אוהבי חיות' : 'Pet Lovers'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'קהילה של מקצוענים' : 'Professional community'}</p>
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
                <p className="font-semibold text-gray-900">{isHebrew ? 'מובילים בישראל' : 'Israel\'s #1'}</p>
                <p className="text-xs text-gray-500">{isHebrew ? 'רשת טיפוח מובילה' : 'Leading pet care network'}</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
