import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  DollarSign, 
  ChevronRight,
  Heart,
  Car,
  Home,
  Package,
  Star,
  Shield,
  Users,
  CheckCircle2,
  ArrowRight,
  Upload,
  FileText,
  Send,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { GooglePlacesAutocomplete, PlaceDetails } from '@/components/ui/google-places-autocomplete';
import type { CareerPosition } from '@shared/schema';

const roleIcons: Record<string, any> = {
  walker: Heart,
  driver: Car,
  sitter: Home,
  host: Home,
  supplier: Package,
  admin: Briefcase,
  trainer: Star,
};

const roleColors: Record<string, string> = {
  walker: 'from-pink-500 to-rose-600',
  driver: 'from-blue-500 to-indigo-600',
  sitter: 'from-purple-500 to-violet-600',
  host: 'from-amber-500 to-orange-600',
  supplier: 'from-emerald-500 to-teal-600',
  admin: 'from-slate-500 to-gray-600',
  trainer: 'from-yellow-500 to-amber-600',
};

export default function Careers() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  
  const [selectedPosition, setSelectedPosition] = useState<CareerPosition | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    country: 'Israel',
    yearsExperience: 0,
    previousEmployer: '',
    relevantSkills: [] as string[],
    referralSource: '',
    consentDataProcessing: false,
    consentBackgroundCheck: false,
    consentTermsOfService: false,
    consentPrivacyPolicy: false,
    consentMarketing: false,
  });
  
  const { data: positions, isLoading } = useQuery<CareerPosition[]>({
    queryKey: ['/api/careers/positions'],
  });
  
  // Start application mutation (creates draft)
  const startApplicationMutation = useMutation({
    mutationFn: async (positionId: string) => {
      const response = await apiRequest('POST', '/api/careers/start-application', { positionId });
      return response.json();
    },
    onSuccess: async (data: any) => {
      setApplicationId(data.applicationId);
      setSessionId(data.sessionId);
      // Try to load any existing draft data for this application
      if (data.applicationId) {
        await loadDraftProgress(data.applicationId);
      }
    },
    onError: (error: any) => {
      console.error('Failed to start application:', error);
    },
  });
  
  // Autosave mutation
  const autosaveMutation = useMutation({
    mutationFn: async ({ stepNumber, stepName, data }: { stepNumber: number; stepName: string; data: any }) => {
      if (!applicationId) return null;
      setIsSaving(true);
      const response = await apiRequest('POST', `/api/careers/applications/${applicationId}/autosave`, { stepNumber, stepName, data, sessionId });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data) {
        setLastSaved(new Date().toLocaleTimeString());
      }
      setIsSaving(false);
    },
    onError: (error: any) => {
      console.error('Autosave failed:', error);
      setIsSaving(false);
    },
  });
  
  // Load draft data when application is started (rehydration)
  const loadDraftProgress = useCallback(async (appId: number) => {
    try {
      const response = await fetch(`/api/careers/applications/${appId}/progress`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.steps || data.steps.length === 0) return;
      
      // Rehydrate form data from saved steps
      data.steps.forEach((step: { stepNumber: number; data: any }) => {
        if (!step.data) return;
        
        if (step.stepNumber === 1) {
          setFormData(prev => ({
            ...prev,
            firstName: step.data.firstName || prev.firstName,
            lastName: step.data.lastName || prev.lastName,
            email: step.data.email || prev.email,
            phone: step.data.phone || prev.phone,
            dateOfBirth: step.data.dateOfBirth || prev.dateOfBirth,
            address: step.data.address || prev.address,
            city: step.data.city || prev.city,
            country: step.data.country || prev.country,
          }));
        } else if (step.stepNumber === 2) {
          setFormData(prev => ({
            ...prev,
            yearsExperience: step.data.yearsExperience ?? prev.yearsExperience,
            previousEmployer: step.data.previousEmployer || prev.previousEmployer,
            relevantSkills: step.data.relevantSkills || prev.relevantSkills,
            referralSource: step.data.referralSource || prev.referralSource,
          }));
        } else if (step.stepNumber === 3) {
          setFormData(prev => ({
            ...prev,
            consentDataProcessing: step.data.consentDataProcessing ?? prev.consentDataProcessing,
            consentBackgroundCheck: step.data.consentBackgroundCheck ?? prev.consentBackgroundCheck,
            consentTermsOfService: step.data.consentTermsOfService ?? prev.consentTermsOfService,
            consentPrivacyPolicy: step.data.consentPrivacyPolicy ?? prev.consentPrivacyPolicy,
            consentMarketing: step.data.consentMarketing ?? prev.consentMarketing,
          }));
        }
      });
      
      // Find the last completed step and set current step accordingly
      const completedSteps = data.steps.filter((s: { status: string }) => s.status === 'completed');
      if (completedSteps.length > 0) {
        const lastCompleted = Math.max(...completedSteps.map((s: { stepNumber: number }) => s.stepNumber));
        // Resume from next step after last completed, max step 3
        setCurrentStep(Math.min(lastCompleted + 1, 3));
        setLastSaved(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Failed to load draft progress:', error);
    }
  }, []);
  
  const applyMutation = useMutation({
    mutationFn: async (data: typeof formData & { positionId: string; applicationId?: number; sessionId?: string }) => {
      const response = await apiRequest('POST', '/api/careers/apply', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: isRTL ? 'מועמדות נשלחה בהצלחה!' : 'Application Submitted!',
        description: data.message,
      });
      // Store the application ID for resume upload
      setSubmittedApplicationId(data.applicationId);
      setShowApplicationForm(false);
      setShowSuccessDialog(true);
      setCurrentStep(1);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        address: '',
        city: '',
        country: 'Israel',
        yearsExperience: 0,
        previousEmployer: '',
        relevantSkills: [],
        referralSource: '',
        consentDataProcessing: false,
        consentBackgroundCheck: false,
        consentTermsOfService: false,
        consentPrivacyPolicy: false,
        consentMarketing: false,
      });
    },
    onError: (error: any) => {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      });
    },
  });
  
  const featuredPositions = positions?.filter(p => p.isFeatured) || [];
  const allPositions = positions || [];
  
  // Autosave helper - saves current step data
  const saveStepProgress = useCallback((stepNumber: number) => {
    if (!applicationId) return;
    
    const stepNames = ['', 'personal_info', 'experience', 'consents'];
    const stepData: Record<number, any> = {
      1: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        city: formData.city,
        country: formData.country,
      },
      2: {
        yearsExperience: formData.yearsExperience,
        previousEmployer: formData.previousEmployer,
        relevantSkills: formData.relevantSkills,
        referralSource: formData.referralSource,
      },
      3: {
        consentDataProcessing: formData.consentDataProcessing,
        consentBackgroundCheck: formData.consentBackgroundCheck,
        consentTermsOfService: formData.consentTermsOfService,
        consentPrivacyPolicy: formData.consentPrivacyPolicy,
        consentMarketing: formData.consentMarketing,
      },
    };
    
    autosaveMutation.mutate({
      stepNumber,
      stepName: stepNames[stepNumber],
      data: stepData[stepNumber],
    });
  }, [applicationId, formData, autosaveMutation]);
  
  const handleApply = (position: CareerPosition) => {
    setSelectedPosition(position);
    setShowApplicationForm(true);
    setCurrentStep(1);
    setApplicationId(null);
    setSessionId(null);
    setLastSaved(null);
    // Start a new application session
    startApplicationMutation.mutate(position.positionId);
  };
  
  // Move to next step with autosave
  const goToNextStep = (nextStep: number) => {
    // Save current step before moving
    saveStepProgress(currentStep);
    setCurrentStep(nextStep);
  };
  
  // Move to previous step (also save current step to preserve data)
  const goToPreviousStep = (prevStep: number) => {
    // Save current step before moving back to preserve any changes
    saveStepProgress(currentStep);
    setCurrentStep(prevStep);
  };
  
  const handleSubmitApplication = () => {
    if (!selectedPosition) return;
    
    if (!formData.consentDataProcessing || !formData.consentBackgroundCheck || 
        !formData.consentTermsOfService || !formData.consentPrivacyPolicy) {
      toast({
        title: isRTL ? 'נדרשת הסכמה' : 'Consent Required',
        description: isRTL 
          ? 'אנא אשר את כל ההסכמות הנדרשות להמשך' 
          : 'Please accept all required consents to continue',
        variant: 'destructive',
      });
      return;
    }
    
    // Include applicationId and sessionId to finalize the draft
    applyMutation.mutate({
      ...formData,
      positionId: selectedPosition.positionId,
      applicationId: applicationId || undefined,
      sessionId: sessionId || undefined,
    });
  };
  
  // Handle resume file upload
  const handleResumeUpload = async () => {
    if (!resumeFile || !submittedApplicationId) return;
    
    setIsUploadingResume(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('document', resumeFile);
      formDataUpload.append('documentType', 'resume');
      
      const response = await fetch(`/api/careers/applications/${submittedApplicationId}/documents`, {
        method: 'POST',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      toast({
        title: isRTL ? 'קורות החיים הועלו בהצלחה!' : 'Resume Uploaded!',
        description: isRTL ? 'נבחן את המסמכים שלך בקרוב' : 'We will review your documents shortly',
      });
      setResumeFile(null);
      setShowSuccessDialog(false);
      setSubmittedApplicationId(null);
    } catch (error) {
      toast({
        title: isRTL ? 'שגיאה' : 'Error',
        description: isRTL ? 'העלאת הקובץ נכשלה' : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingResume(false);
    }
  };
  
  // Close success dialog without uploading
  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setSubmittedApplicationId(null);
    setResumeFile(null);
  };

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white py-24">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <Badge className="bg-white/20 text-white border-white/30 mb-6 text-sm px-4 py-1">
              {isRTL ? 'הצטרפו למשפחת Pet Wash™' : 'Join the Pet Wash™ Family'}
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight" style={{ fontFamily: 'Didot, Georgia, serif' }}>
              {isRTL ? 'הקריירה שלך מתחילה כאן' : 'Your Career Starts Here'}
            </h1>
            
            <p className="text-xl md:text-2xl text-emerald-100 mb-8 max-w-2xl mx-auto">
              {isRTL 
                ? 'הצטרפו לפלטפורמת הטיפוח לחיות המחמד המובילה בישראל. אנחנו מחפשים אנשים נלהבים שאוהבים בעלי חיים.'
                : 'Join Israel\'s leading pet care platform. We\'re looking for passionate people who love animals.'}
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold px-8"
                onClick={() => document.getElementById('positions')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-view-positions"
              >
                {isRTL ? 'צפה במשרות' : 'View Open Positions'}
                <ChevronRight className="w-5 h-5 ms-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Why Join Us */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Didot, Georgia, serif' }}>
              {isRTL ? 'למה לעבוד איתנו?' : 'Why Join Pet Wash™?'}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {isRTL 
                ? 'אנחנו מציעים סביבת עבודה מתגמלת עם הזדמנויות צמיחה'
                : 'We offer a rewarding work environment with growth opportunities'}
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: DollarSign,
                title: isRTL ? 'שכר תחרותי' : 'Competitive Pay',
                description: isRTL ? 'תעריפים גבוהים בשוק, תשלום מהיר ובונוסים' : 'Top market rates, fast payments & bonuses',
              },
              {
                icon: Clock,
                title: isRTL ? 'גמישות מלאה' : 'Full Flexibility',
                description: isRTL ? 'בחר את השעות שלך ואזורי הפעילות' : 'Choose your hours and service areas',
              },
              {
                icon: Shield,
                title: isRTL ? 'ביטוח מלא' : 'Full Insurance',
                description: isRTL ? 'כיסוי ביטוחי מקיף לשקט נפשי' : 'Comprehensive coverage for peace of mind',
              },
              {
                icon: Users,
                title: isRTL ? 'קהילה תומכת' : 'Supportive Community',
                description: isRTL ? 'צוות מסור שתמיד כאן לעזור' : 'Dedicated team always here to help',
              },
              {
                icon: Star,
                title: isRTL ? 'הכשרה מקצועית' : 'Professional Training',
                description: isRTL ? 'הכשרות וסדנאות להתפתחות מקצועית' : 'Training & workshops for growth',
              },
              {
                icon: Heart,
                title: isRTL ? 'עבודה עם משמעות' : 'Meaningful Work',
                description: isRTL ? 'עזור לחיות מחמד ולבעליהם כל יום' : 'Help pets and their owners every day',
              },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-none shadow-lg hover:shadow-xl transition-shadow bg-white">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
                    <p className="text-gray-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Featured Positions */}
      {featuredPositions.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-4">
                {isRTL ? 'דחוף - מגייסים עכשיו!' : 'Urgent - Hiring Now!'}
              </Badge>
              <h2 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Didot, Georgia, serif' }}>
                {isRTL ? 'משרות מובילות' : 'Featured Positions'}
              </h2>
            </motion.div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {featuredPositions.map((position, index) => {
                const Icon = roleIcons[position.roleType] || Briefcase;
                const colorClass = roleColors[position.roleType] || 'from-gray-500 to-gray-600';
                
                return (
                  <motion.div
                    key={position.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card 
                      className="overflow-hidden border-2 border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer group"
                      onClick={() => handleApply(position)}
                      data-testid={`card-position-${position.positionId}`}
                    >
                      <div className={`h-2 bg-gradient-to-r ${colorClass}`} />
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-7 h-7 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xl font-bold text-gray-900">
                                {isRTL && position.titleHe ? position.titleHe : position.title}
                              </h3>
                              {position.urgencyLevel === 'urgent' && (
                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                  {isRTL ? 'דחוף' : 'Urgent'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-600 mb-4 line-clamp-2">
                              {isRTL && position.shortDescriptionHe ? position.shortDescriptionHe : position.shortDescription}
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {position.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {position.employmentType}
                              </span>
                              {position.salaryRangeMin && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" />
                                  ₪{position.salaryRangeMin}-{position.salaryRangeMax}/{position.salaryPeriod}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}
      
      {/* All Positions */}
      <section id="positions" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Didot, Georgia, serif' }}>
              {isRTL ? 'כל המשרות הפתוחות' : 'All Open Positions'}
            </h2>
            <p className="text-xl text-gray-600">
              {isRTL ? `${allPositions.length} משרות פתוחות` : `${allPositions.length} positions available`}
            </p>
          </motion.div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-14 w-14 bg-gray-200 rounded-xl mb-4" />
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-full mb-4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPositions.map((position, index) => {
                const Icon = roleIcons[position.roleType] || Briefcase;
                const colorClass = roleColors[position.roleType] || 'from-gray-500 to-gray-600';
                
                return (
                  <motion.div
                    key={position.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="h-full hover:shadow-lg transition-all cursor-pointer group border-gray-200 hover:border-emerald-300"
                      onClick={() => handleApply(position)}
                      data-testid={`card-position-list-${position.positionId}`}
                    >
                      <CardContent className="p-6">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-4`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                          {isRTL && position.titleHe ? position.titleHe : position.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {isRTL && position.shortDescriptionHe ? position.shortDescriptionHe : position.shortDescription}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <Badge variant="secondary" className="font-normal">
                            <MapPin className="w-3 h-3 me-1" />
                            {position.location}
                          </Badge>
                          <Badge variant="secondary" className="font-normal">
                            {position.employmentType}
                          </Badge>
                          {position.openPositions && position.openPositions > 1 && (
                            <Badge variant="secondary" className="font-normal bg-emerald-100 text-emerald-700">
                              {position.openPositions} {isRTL ? 'משרות' : 'positions'}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
          
          {!isLoading && allPositions.length === 0 && (
            <Card className="max-w-lg mx-auto">
              <CardContent className="p-12 text-center">
                <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">
                  {isRTL ? 'אין משרות פתוחות כרגע' : 'No Open Positions'}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? 'בדוק שוב בקרוב!' : 'Check back soon!'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
      
      {/* Application Modal */}
      <Dialog open={showApplicationForm} onOpenChange={setShowApplicationForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {isRTL ? 'הגשת מועמדות' : 'Apply for Position'}
                </DialogTitle>
                <DialogDescription>
                  {selectedPosition && (
                    <span className="text-emerald-600 font-medium">
                      {isRTL && selectedPosition.titleHe ? selectedPosition.titleHe : selectedPosition.title}
                    </span>
                  )}
                </DialogDescription>
              </div>
              {/* Autosave indicator */}
              {applicationId && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {isSaving ? (
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'שומר...' : 'Saving...'}
                    </span>
                  ) : lastSaved ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Save className="w-3 h-3" />
                      {isRTL ? `נשמר ${lastSaved}` : `Saved ${lastSaved}`}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </DialogHeader>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-1 mx-1 ${currentStep > step ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          
          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">
                {isRTL ? 'פרטים אישיים' : 'Personal Information'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{isRTL ? 'שם פרטי' : 'First Name'} *</Label>
                  <Input 
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    data-testid="input-firstname"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{isRTL ? 'שם משפחה' : 'Last Name'} *</Label>
                  <Input 
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    data-testid="input-lastname"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">{isRTL ? 'דוא"ל' : 'Email'} *</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="phone">{isRTL ? 'טלפון' : 'Phone'} *</Label>
                <Input 
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">{isRTL ? 'תאריך לידה' : 'Date of Birth'} *</Label>
                <Input 
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  data-testid="input-dob"
                />
              </div>
              <div>
                <Label htmlFor="address">{isRTL ? 'כתובת' : 'Address'} *</Label>
                <GooglePlacesAutocomplete
                  value={formData.address}
                  onChange={(value, details) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      address: value,
                      city: details?.city || prev.city,
                      country: details?.country || prev.country
                    }));
                  }}
                  onPlaceSelected={(place: PlaceDetails) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      address: place.formattedAddress,
                      city: place.city || prev.city,
                      country: place.country || prev.country
                    }));
                  }}
                  placeholder={isRTL ? 'הקלד כתובת...' : 'Start typing your address...'}
                  country={['il']}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">{isRTL ? 'עיר' : 'City'} *</Label>
                  <Input 
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <Label htmlFor="country">{isRTL ? 'מדינה' : 'Country'}</Label>
                  <Input 
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    data-testid="input-country"
                  />
                </div>
              </div>
              
              <Button 
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => goToNextStep(2)}
                disabled={!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.dateOfBirth || !formData.address || !formData.city}
                data-testid="button-next-step1"
              >
                {isRTL ? 'המשך' : 'Continue'}
                <ArrowRight className="w-4 h-4 ms-2" />
              </Button>
            </div>
          )}
          
          {/* Step 2: Experience */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">
                {isRTL ? 'ניסיון והכישורים' : 'Experience & Skills'}
              </h3>
              <div>
                <Label htmlFor="yearsExperience">{isRTL ? 'שנות ניסיון עם בעלי חיים' : 'Years of Experience with Animals'}</Label>
                <Select 
                  value={formData.yearsExperience.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, yearsExperience: parseInt(value) }))}
                >
                  <SelectTrigger data-testid="select-experience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 5, 10].map(years => (
                      <SelectItem key={years} value={years.toString()}>
                        {years === 0 ? (isRTL ? 'ללא ניסיון' : 'No experience') : 
                         years === 10 ? (isRTL ? '10+ שנים' : '10+ years') :
                         (isRTL ? `${years} שנים` : `${years} years`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="previousEmployer">{isRTL ? 'מעסיק קודם (אופציונלי)' : 'Previous Employer (optional)'}</Label>
                <Input 
                  id="previousEmployer"
                  value={formData.previousEmployer}
                  onChange={(e) => setFormData(prev => ({ ...prev, previousEmployer: e.target.value }))}
                  placeholder={isRTL ? 'שם החברה' : 'Company name'}
                  data-testid="input-employer"
                />
              </div>
              <div>
                <Label htmlFor="referralSource">{isRTL ? 'איך שמעת עלינו?' : 'How did you hear about us?'}</Label>
                <Select 
                  value={formData.referralSource}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, referralSource: value }))}
                >
                  <SelectTrigger data-testid="select-referral">
                    <SelectValue placeholder={isRTL ? 'בחר אפשרות' : 'Select option'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">{isRTL ? 'חיפוש Google' : 'Google Search'}</SelectItem>
                    <SelectItem value="facebook">{isRTL ? 'פייסבוק' : 'Facebook'}</SelectItem>
                    <SelectItem value="instagram">{isRTL ? 'אינסטגרם' : 'Instagram'}</SelectItem>
                    <SelectItem value="friend">{isRTL ? 'חבר/מכר' : 'Friend/Referral'}</SelectItem>
                    <SelectItem value="job_site">{isRTL ? 'אתר דרושים' : 'Job Site'}</SelectItem>
                    <SelectItem value="other">{isRTL ? 'אחר' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-4 mt-6">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToPreviousStep(1)}
                  data-testid="button-back-step2"
                >
                  {isRTL ? 'חזור' : 'Back'}
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => goToNextStep(3)}
                  data-testid="button-next-step2"
                >
                  {isRTL ? 'המשך' : 'Continue'}
                  <ArrowRight className="w-4 h-4 ms-2" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 3: Consents & Submit */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">
                {isRTL ? 'הסכמות ואישורים' : 'Consents & Agreements'}
              </h3>
              
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="consentDataProcessing"
                    checked={formData.consentDataProcessing}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, consentDataProcessing: checked as boolean }))}
                    data-testid="checkbox-data-processing"
                  />
                  <Label htmlFor="consentDataProcessing" className="text-sm leading-relaxed cursor-pointer">
                    {isRTL 
                      ? 'אני מסכים/ה לעיבוד הנתונים האישיים שלי לצורך בחינת המועמדות *'
                      : 'I consent to the processing of my personal data for application review *'}
                  </Label>
                </div>
                
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="consentBackgroundCheck"
                    checked={formData.consentBackgroundCheck}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, consentBackgroundCheck: checked as boolean }))}
                    data-testid="checkbox-background-check"
                  />
                  <Label htmlFor="consentBackgroundCheck" className="text-sm leading-relaxed cursor-pointer">
                    {isRTL 
                      ? 'אני מסכים/ה לבדיקת רקע אם תידרש לתפקיד *'
                      : 'I consent to a background check if required for the position *'}
                  </Label>
                </div>
                
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="consentTermsOfService"
                    checked={formData.consentTermsOfService}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, consentTermsOfService: checked as boolean }))}
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="consentTermsOfService" className="text-sm leading-relaxed cursor-pointer">
                    {isRTL 
                      ? 'אני מאשר/ת שקראתי ומסכים/ה לתנאי השימוש *'
                      : 'I confirm I have read and agree to the Terms of Service *'}
                  </Label>
                </div>
                
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="consentPrivacyPolicy"
                    checked={formData.consentPrivacyPolicy}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, consentPrivacyPolicy: checked as boolean }))}
                    data-testid="checkbox-privacy"
                  />
                  <Label htmlFor="consentPrivacyPolicy" className="text-sm leading-relaxed cursor-pointer">
                    {isRTL 
                      ? 'אני מאשר/ת שקראתי ומסכים/ה למדיניות הפרטיות *'
                      : 'I confirm I have read and agree to the Privacy Policy *'}
                  </Label>
                </div>
                
                <div className="flex items-start gap-3 pt-2 border-t">
                  <Checkbox 
                    id="consentMarketing"
                    checked={formData.consentMarketing}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, consentMarketing: checked as boolean }))}
                    data-testid="checkbox-marketing"
                  />
                  <Label htmlFor="consentMarketing" className="text-sm leading-relaxed cursor-pointer text-gray-600">
                    {isRTL 
                      ? 'אני מסכים/ה לקבל עדכונים על משרות נוספות ומבצעים (אופציונלי)'
                      : 'I agree to receive updates about other positions and promotions (optional)'}
                  </Label>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <Shield className="w-4 h-4 inline me-2" />
                  {isRTL 
                    ? 'המידע שלך מאובטח ומעובד בהתאם לחוק הגנת הפרטיות הישראלי (תיקון 13) ותקנות GDPR.'
                    : 'Your data is secure and processed in compliance with Israeli Privacy Law (Amendment 13) and GDPR regulations.'}
                </p>
              </div>
              
              <div className="flex gap-4 mt-6">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToPreviousStep(2)}
                  data-testid="button-back-step3"
                >
                  {isRTL ? 'חזור' : 'Back'}
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmitApplication}
                  disabled={applyMutation.isPending || !formData.consentDataProcessing || !formData.consentBackgroundCheck || !formData.consentTermsOfService || !formData.consentPrivacyPolicy}
                  data-testid="button-submit-application"
                >
                  {applyMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isRTL ? 'שולח...' : 'Submitting...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      {isRTL ? 'שלח מועמדות' : 'Submit Application'}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Success Dialog with Resume Upload */}
      <Dialog open={showSuccessDialog} onOpenChange={handleCloseSuccessDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              {isRTL ? 'המועמדות נשלחה בהצלחה!' : 'Application Submitted!'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isRTL 
                ? 'נבחן את המועמדות שלך ונחזור אליך תוך 3-5 ימי עסקים.'
                : 'We will review your application and get back to you within 3-5 business days.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h4 className="font-semibold text-emerald-800 mb-2">
                {isRTL ? 'מה הלאה?' : 'What\'s Next?'}
              </h4>
              <ul className="text-sm text-emerald-700 space-y-1">
                <li>• {isRTL ? 'בדוק את האימייל שלך לאישור' : 'Check your email for confirmation'}</li>
                <li>• {isRTL ? 'העלה קורות חיים (מומלץ)' : 'Upload your resume (recommended)'}</li>
                <li>• {isRTL ? 'השלם אימות זהות אם נדרש' : 'Complete identity verification if required'}</li>
              </ul>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h4 className="font-medium mb-2">
                {isRTL ? 'העלה קורות חיים (אופציונלי)' : 'Upload Resume (Optional)'}
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                {isRTL ? 'PDF, DOC או DOCX עד 5MB' : 'PDF, DOC or DOCX up to 5MB'}
              </p>
              
              <input
                type="file"
                id="resume-upload"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                data-testid="input-resume-upload"
              />
              
              {resumeFile ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 mb-4">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{resumeFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setResumeFile(null)}
                    className="text-red-500 hover:text-red-700 p-1 h-auto"
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <label 
                  htmlFor="resume-upload" 
                  className="inline-block cursor-pointer"
                >
                  <Button variant="outline" asChild>
                    <span data-testid="button-choose-file">
                      <Upload className="w-4 h-4 me-2" />
                      {isRTL ? 'בחר קובץ' : 'Choose File'}
                    </span>
                  </Button>
                </label>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCloseSuccessDialog}
                data-testid="button-skip-resume"
              >
                {isRTL ? 'דלג' : 'Skip for Now'}
              </Button>
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleResumeUpload}
                disabled={!resumeFile || isUploadingResume}
                data-testid="button-upload-resume"
              >
                {isUploadingResume ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isRTL ? 'מעלה...' : 'Uploading...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {isRTL ? 'העלה קורות חיים' : 'Upload Resume'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
