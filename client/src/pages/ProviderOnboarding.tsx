import { useState, useEffect } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/date-picker';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Camera, 
  CreditCard,
  Shield,
  Clock,
  Users,
  DollarSign,
  Star,
  ArrowRight,
  Loader2,
  X
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getApiUrl } from '@/lib/apiConfig';
import {
  PROVIDER_DECLARATION_TEXT,
  ENHANCED_REASON_LABELS,
  ENHANCED_VERIFICATION_REASONS,
  defaultReasonsForProviderTypes,
  type EnhancedVerificationReason,
} from '@shared/legal/providerDeclaration';

export default function ProviderOnboarding() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isHebrew = language === 'he';

  // Redirect to sign-in if not authenticated.
  // Phase C — also gate on role: if a logged-in user lands here who is
  // NOT trying to become a provider (their role is loyalty / staff /
  // admin / franchise_owner / approved provider), bounce to the
  // canonical post-login decider so they end up on the right page
  // for their actual status. Customers and provider-applicants stay
  // here so they can fill the KYC form.
  //
  // Issue #148 P1: the post-login decider lives on the SERVER at
  // /api/auth/post-login — it is NOT a client <Route>. The previous code
  // tried to navigate to a client path with the same name, which had no
  // <Route> match in App.tsx and caused this page to render briefly and
  // then disappear. We now POST to the API and navigate to the returned
  // nextUrl, mirroring the pattern in SignIn.tsx:160.
  useEffect(() => {
    if (user === null) {
      navigate('/sign-in?redirect=/provider-onboarding');
      return;
    }
    if (!user) return;

    const claims = (user as any)?.reloadUserInfo?.customAttributes
      ? (() => {
          try { return JSON.parse((user as any).reloadUserInfo.customAttributes); }
          catch { return {}; }
        })()
      : {};
    const role: string | undefined = claims?.role;
    // Roles that should NOT see the provider KYC form. Customer +
    // already-approved provider stay (the latter is harmless: the
    // form's apply call will return 409 already-applied).
    const blockedRoles = new Set([
      'loyalty', 'staff', 'admin', 'super_admin', 'management', 'franchise_owner',
    ]);
    if (!role || !blockedRoles.has(role)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/auth/post-login'), {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        const nextUrl: string =
          (typeof data?.nextUrl === 'string' && data.nextUrl) ||
          (typeof data?.redirectTo === 'string' && data.redirectTo) ||
          '/home';
        navigate(nextUrl);
      } catch {
        if (cancelled) return;
        navigate('/home');
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  // Form state
  const [step, setStep] = useState(1);
  const [providerTypes, setProviderTypes] = useState<Array<'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer'>>([]);
  
  // Toggle a provider type in the multi-select list
  const toggleProviderType = (type: 'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer') => {
    setProviderTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  // Helper to check if a type is selected
  const hasProviderType = (type: 'walker' | 'sitter' | 'station_operator' | 'driver' | 'trainer') => 
    providerTypes.includes(type);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+972');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtpId, setPhoneOtpId] = useState<string | null>(null);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('IL');
  
  // Files
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [governmentId, setGovernmentId] = useState<File | null>(null);
  const [insuranceCert, setInsuranceCert] = useState<File | null>(null);
  const [businessLicense, setBusinessLicense] = useState<File | null>(null);

  // Role-specific certifications (2026 spec)
  const [petFirstAidCert, setPetFirstAidCert] = useState<File | null>(null);
  const [petFirstAidNumber, setPetFirstAidNumber] = useState('');
  const [petFirstAidExpiry, setPetFirstAidExpiry] = useState('');
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseClass, setDrivingLicenseClass] = useState('');
  const [drivingLicenseExpiry, setDrivingLicenseExpiry] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');

  // Background check (2026 spec)
  const [residentialHistory, setResidentialHistory] = useState<string[]>(['']);
  const [backgroundCheckConsent, setBackgroundCheckConsent] = useState(false);

  // Role-specific declarations (2026 Legal Compliance)
  // Driver declarations (PetTrek)
  const [declarationValidLicense, setDeclarationValidLicense] = useState(false);
  const [declarationNoSuspension, setDeclarationNoSuspension] = useState(false);
  const [declarationUnderPointsLimit, setDeclarationUnderPointsLimit] = useState(false);
  const [declarationNoDrugsAlcohol, setDeclarationNoDrugsAlcohol] = useState(false);
  const [declarationValidVehicleInsurance, setDeclarationValidVehicleInsurance] = useState(false);
  const [declarationVehicleInspection, setDeclarationVehicleInspection] = useState(false);
  
  // Trainer declarations (Academy)
  const [declarationTrainingCertification, setDeclarationTrainingCertification] = useState(false);
  const [declarationAccreditedCourses, setDeclarationAccreditedCourses] = useState(false);
  const [declarationLiabilityInsurance, setDeclarationLiabilityInsurance] = useState(false);
  
  // Sitter/Walker declarations
  const [declarationPhysicallyFit, setDeclarationPhysicallyFit] = useState(false);
  const [declarationAnimalExperience, setDeclarationAnimalExperience] = useState(false);
  const [declarationFirstAidTraining, setDeclarationFirstAidTraining] = useState(false);
  
  // Universal declarations (all roles)
  const [declarationAccurateInfo, setDeclarationAccurateInfo] = useState(false);
  const [declarationAcceptTerms, setDeclarationAcceptTerms] = useState(false);

  // Israel-safe self-declaration (2026 spec). Mandatory for every provider.
  const [selfDeclarationNoConvictions, setSelfDeclarationNoConvictions] = useState(false);

  // Provider can also opt into high-risk services explicitly. The defaults
  // derived from providerTypes are unioned with these picks server-side.
  const [enhancedReasons, setEnhancedReasons] = useState<EnhancedVerificationReason[]>([]);

  const declarationText = isHebrew ? PROVIDER_DECLARATION_TEXT.he : PROVIDER_DECLARATION_TEXT.en;
  const derivedDefaultReasons = defaultReasonsForProviderTypes(providerTypes);
  const effectiveEnhancedReasons = Array.from(
    new Set<EnhancedVerificationReason>([
      ...derivedDefaultReasons,
      ...enhancedReasons,
    ]),
  );
  const enhancedVerificationRequired = effectiveEnhancedReasons.length > 0;

  // State
  const [loading, setLoading] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [biometricScore, setBiometricScore] = useState<number | null>(null);

  // Auto-populate and auto-verify phone from Firebase user's already-verified number
  useEffect(() => {
    if (!user) return;
    if (user.phoneNumber && !phoneVerified) {
      // Firebase phone is already verified — extract number and skip OTP
      const raw = user.phoneNumber; // e.g. "+972501234567"
      const matchedCode = ['+972', '+1', '+44', '+61', '+49', '+33', '+7', '+91', '+55']
        .find(c => raw.startsWith(c));
      if (matchedCode) {
        setPhoneCountryCode(matchedCode);
        setPhoneNumber(raw.slice(matchedCode.length));
      } else {
        setPhoneNumber(raw);
      }
      setPhoneVerified(true);
    }
    // Pre-fill name from Firebase display name if not already set
    if (user.displayName && !firstName && !lastName) {
      const parts = user.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(' '));
      } else if (parts.length === 1) {
        setFirstName(parts[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Phone OTP Verification Handlers ──────────────────────────────────
  const COUNTRY_CODES = [
    { code: '+972', label: '🇮🇱 +972', name: 'Israel' },
    { code: '+1',   label: '🇺🇸 +1',   name: 'USA / Canada' },
    { code: '+44',  label: '🇬🇧 +44',  name: 'UK' },
    { code: '+61',  label: '🇦🇺 +61',  name: 'Australia' },
    { code: '+49',  label: '🇩🇪 +49',  name: 'Germany' },
    { code: '+33',  label: '🇫🇷 +33',  name: 'France' },
    { code: '+7',   label: '🇷🇺 +7',   name: 'Russia' },
    { code: '+91',  label: '🇮🇳 +91',  name: 'India' },
    { code: '+55',  label: '🇧🇷 +55',  name: 'Brazil' },
  ];

  const sendPhoneOtp = async () => {
    setPhoneOtpError('');
    if (!phoneNumber.trim() || phoneNumber.trim().length < 7) {
      setPhoneOtpError(isHebrew ? 'הזן מספר טלפון תקין' : 'Enter a valid phone number');
      return;
    }
    setPhoneOtpSending(true);
    try {
      const fullPhone = `${phoneCountryCode}${phoneNumber.replace(/^0/, '').replace(/\s+/g, '')}`;
      const token = await user?.getIdToken();
      const res = await fetch(getApiUrl('/api/provider/phone/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone, channel: 'sms' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // If the server is still starting up, show a friendlier message
        const rawMsg: string = data.message || '';
        const isStartingUp = res.status === 503 || rawMsg.toLowerCase().includes('starting up');
        const errorMsg = isStartingUp
          ? (isHebrew ? 'שירות האימות אינו זמין כרגע. אנא נסה שוב.' : 'Verification service is temporarily unavailable. Please try again.')
          : rawMsg || (isHebrew ? 'שליחת קוד נכשלה' : 'Failed to send code');
        setPhoneOtpError(errorMsg);
        return;
      }
      setPhoneOtpId(data.otpId);
      toast({ title: isHebrew ? '📱 קוד נשלח ב-SMS!' : '📱 SMS code sent!', description: isHebrew ? `נשלח ל-${fullPhone}` : `Sent to ${fullPhone}` });
    } catch {
      setPhoneOtpError(isHebrew ? 'שגיאת רשת' : 'Network error');
    } finally {
      setPhoneOtpSending(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setPhoneOtpError('');
    if (!phoneOtpId || phoneOtpCode.length !== 6) {
      setPhoneOtpError(isHebrew ? 'הזן קוד בן 6 ספרות' : 'Enter the 6-digit code');
      return;
    }
    setPhoneOtpVerifying(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(getApiUrl('/api/provider/phone/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ otpId: phoneOtpId, code: phoneOtpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPhoneOtpError(data.message || (isHebrew ? 'קוד שגוי' : 'Wrong code'));
        return;
      }
      setPhoneVerified(true);
      toast({ title: isHebrew ? '✅ טלפון אומת בהצלחה!' : '✅ Phone verified!', description: isHebrew ? 'מספר הטלפון שלך אומת' : 'Your phone number is now verified' });
    } catch {
      setPhoneOtpError(isHebrew ? 'שגיאת רשת' : 'Network error');
    } finally {
      setPhoneOtpVerifying(false);
    }
  };

  const t = {
    title: isHebrew ? 'הצטרפו לצוות Pet Wash' : 'Join the Pet Wash Team',
    subtitle: isHebrew ? 'הירשם כשותף עצמאי והתחל להרוויח' : 'Sign up as an independent contractor and start earning',
    providerTypeTitle: isHebrew ? 'סוג שותף' : 'Provider Type',
    walker: isHebrew ? 'מטייל כלבים (Walk My Pet)' : 'Dog Walker (Walk My Pet)',
    sitter: isHebrew ? 'שמרטף (The Sitter Suite)' : 'Pet Sitter (The Sitter Suite)',
    stationOperator: isHebrew ? 'מפעיל תחנת רחצה (K9000)' : 'Wash Station Operator (K9000)',
    personalInfo: isHebrew ? 'פרטים אישיים' : 'Personal Information',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    phone: isHebrew ? 'טלפון' : 'Phone Number',
    idNumber: isHebrew ? 'תעודת זהות / פספורט / רישיון נהיגה' : 'ID / Passport / Driver\'s License Number',
    idNumberPlaceholder: isHebrew ? 'מספר תעודת זהות, פספורט או רישיון נהיגה' : 'ID, passport or driver\'s license number',
    city: isHebrew ? 'עיר' : 'City',
    country: isHebrew ? 'מדינה' : 'Country',
    biometricKyc: isHebrew ? 'אימות ביומטרי (רמת בנקאות)' : 'Biometric Verification (Banking-Level)',
    kycDescription: isHebrew
      ? 'אנו דורשים אימות זהות מאובטח עם התאמת פנים באמצעות AI ברמת בנקאות'
      : 'Bank-grade identity verification with AI-powered face matching',
    selfiePhoto: isHebrew ? 'סלפי בזמן אמת' : 'Live Selfie Photo',
    governmentId: isHebrew ? 'תעודה ממשלתית' : 'Government ID',
    governmentIdDescription: isHebrew ? 'דרכון, ת.ז., או רישיון נהיגה' : 'Passport, National ID, or Driver\'s License',
    insuranceCert: isHebrew ? 'אישור ביטוח' : 'Insurance Certificate',
    insuranceCertOptional: isHebrew ? 'אופציונלי למטיילים ושמרטפים' : 'Optional for walkers/sitters',
    businessLicense: isHebrew ? 'רישיון עסק' : 'Business License',
    businessLicenseOptional: isHebrew ? 'נדרש למפעילי תחנות' : 'Required for station operators',
    uploadPhoto: isHebrew ? 'העלה תמונה' : 'Upload Photo',
    fileSelected: isHebrew ? 'קובץ נבחר' : 'File Selected',
    submit: isHebrew ? 'שלח בקשה' : 'Submit Application',
    submitting: isHebrew ? 'שולח...' : 'Submitting...',
    next: isHebrew ? 'הבא' : 'Next',
    back: isHebrew ? 'חזור' : 'Back',
    requirements: isHebrew ? 'דרישות' : 'Requirements',
    requirementsList: isHebrew ? [
      'אזרחות או אשרת עבודה בישראל/ארה"ב/אנגליה/אוסטרליה/קנדה',
      'גיל 18+ עם זהות ממשלתית תקפה',
      'טלפון חכם עם GPS',
      'ביטוח אחריות (למטיילים ושמרטפים)',
      'אין רקע פלילי הכולל בעלי חיים'
    ] : [
      'Citizenship or work permit in Israel/USA/UK/Australia/Canada',
      'Age 18+ with valid government ID',
      'Smartphone with GPS',
      'Liability insurance (for walkers/sitters)',
      'No criminal record involving animals'
    ],
    benefits: isHebrew ? 'יתרונות' : 'Benefits',
    benefitsList: isHebrew ? [
      'עבוד בזמנים שלך',
      'הכנס תחרותי (שעתי או לפרויקט)',
      'תשלומים מאובטחים דרך Nayax',
      'גישה לבסיס לקוחות',
      'תמיכה טכנית 24/7'
    ] : [
      'Work your own hours',
      'Competitive earnings (hourly or per project)',
      'Secure payments via Nayax',
      'Access to customer base',
      '24/7 technical support'
    ],
    applicationSuccess: isHebrew ? 'בקשה נשלחה בהצלחה!' : 'Application Submitted Successfully!',
    successMessage: isHebrew 
      ? 'תודה על הרישום. נבדוק את הבקשה תוך 24-48 שעות ונעדכן אותך במייל.'
      : 'Thank you for applying. We will review your application within 24-48 hours and notify you via email.',
    biometricMatch: isHebrew ? 'התאמת פנים' : 'Face Match',
    matchScore: isHebrew ? 'ציון התאמה' : 'Match Score',
    error: isHebrew ? 'שגיאה' : 'Error',
    loginRequired: isHebrew ? 'נדרשת התחברות' : 'Login Required',
    pleaseLogin: isHebrew ? 'אנא התחבר כדי להמשיך בהרשמה' : 'Please log in to continue with registration',
    backgroundCheck: isHebrew ? 'בדיקת רקע פלילי' : 'Background Check',
    backgroundCheckDescription: isHebrew 
      ? 'בדיקת רקע פלילי נדרשת לכל השותפים שלנו כדי להבטיח את בטיחות הלקוחות והחיות שלהם'
      : 'Criminal background check is required for all contractors to ensure the safety of our customers and their pets',
    residentialHistory: isHebrew ? 'היסטוריית מגורים (10 שנים אחרונות)' : 'Residential History (Last 10 Years)',
    residentialHistoryHelp: isHebrew 
      ? 'רשום את כל הכתובות בהן גרת ב-10 השנים האחרונות (עיר, מדינה)'
      : 'List all addresses where you\'ve lived in the last 10 years (city, country)',
    addAddress: isHebrew ? 'הוסף כתובת נוספת' : 'Add Another Address',
    consentTitle: isHebrew ? 'הסכמה לבדיקת רקע' : 'Background Check Consent',
    consentText: isHebrew 
      ? 'אני מסכים/ה שחברת ⁦Pet Wash™⁩ תבצע בדיקת רקע פלילי מקיפה כולל היסטוריית מגורים של 10 שנים. אני מבין/ה שהמידע ישמש אך ורק למטרות אימות זהות ובטיחות.'
      : 'I consent to ⁦Pet Wash™⁩ conducting a comprehensive criminal background check including 10-year residential history. I understand this information will be used solely for identity verification and safety purposes.',
    // Role-specific certifications
    petFirstAidCert: isHebrew ? 'תעודת עזרה ראשונה לחיות מחמד' : 'Pet First Aid Certificate',
    petFirstAidRequired: isHebrew ? 'נדרש לשמרטפים ומטיילים' : 'Required for sitters and walkers',
    certNumber: isHebrew ? 'מספר תעודה' : 'Certificate Number',
    expiryDate: isHebrew ? 'תאריך תפוגה' : 'Expiry Date',
    drivingLicense: isHebrew ? 'רישיון נהיגה' : 'Driving License',
    drivingLicenseRequired: isHebrew ? 'נדרש לנהגי PetTrek' : 'Required for PetTrek drivers',
    licenseNumber: isHebrew ? 'מספר רישיון' : 'License Number',
    licenseClass: isHebrew ? 'סוג רישיון' : 'License Class',
    insurancePolicy: isHebrew ? 'פוליסת ביטוח' : 'Insurance Policy',
    policyNumber: isHebrew ? 'מספר פוליסה' : 'Policy Number',
    provider: isHebrew ? 'חברת ביטוח' : 'Insurance Provider',
  };

  const handleSubmit = async () => {
    const traceId = 'PROV-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Provider Onboarding Trace]', { traceId, timestamp: new Date().toISOString() });
    if (!user) {
      toast({
        variant: 'destructive',
        title: t.loginRequired,
        description: t.pleaseLogin
      });
      return;
    }

    if (!selfiePhoto || !governmentId) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'נדרש סלפי ותעודה ממשלתית' : 'Selfie and government ID required'
      });
      return;
    }

    if (providerTypes.length === 0) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'יש לבחור לפחות סוג שותף אחד' : 'Please select at least one provider type'
      });
      return;
    }

    // Israel-safe self-declaration is mandatory.
    if (!selfDeclarationNoConvictions) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: declarationText.checkboxLabel,
      });
      return;
    }

    setLoading(true);

    try {
      const idToken = await user.getIdToken(true);
      const formData = new FormData();
      
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('phoneNumber', phoneNumber);
      formData.append('idNumber', idNumber);
      formData.append('city', city);
      formData.append('country', country);
      formData.append('providerType', providerTypes[0]);
      formData.append('providerTypes', JSON.stringify(providerTypes));
      formData.append('selfiePhoto', selfiePhoto);
      formData.append('governmentId', governmentId);
      
      formData.append('residentialHistory', JSON.stringify(residentialHistory.filter(addr => addr.trim())));
      formData.append('backgroundCheckConsent', backgroundCheckConsent.toString());

      // Israel-safe self-declaration (2026 spec)
      formData.append('selfDeclarationNoRelevantConvictions', selfDeclarationNoConvictions ? 'true' : 'false');
      formData.append('enhancedVerificationReasons', JSON.stringify(effectiveEnhancedReasons));

      const declarations: Record<string, boolean> = {
        declarationAccurateInfo,
        declarationAcceptTerms,
      };
      if (providerTypes.includes('driver')) {
        Object.assign(declarations, {
          declarationValidLicense,
          declarationNoSuspension,
          declarationUnderPointsLimit,
          declarationNoDrugsAlcohol,
          declarationValidVehicleInsurance,
          declarationVehicleInspection,
        });
      }
      if (providerTypes.includes('trainer')) {
        Object.assign(declarations, {
          declarationTrainingCertification,
          declarationAccreditedCourses,
          declarationLiabilityInsurance,
        });
      }
      if (providerTypes.includes('walker') || providerTypes.includes('sitter')) {
        Object.assign(declarations, {
          declarationPhysicallyFit,
          declarationAnimalExperience,
          declarationFirstAidTraining,
        });
      }
      formData.append('declarations', JSON.stringify(declarations));
      
      if (insuranceCert) formData.append('insuranceCert', insuranceCert);
      if (insurancePolicyNumber) formData.append('insurancePolicyNumber', insurancePolicyNumber);
      if (insuranceProvider) formData.append('insuranceProvider', insuranceProvider);
      if (insuranceExpiry) formData.append('insuranceExpiry', insuranceExpiry);
      
      if (petFirstAidCert) formData.append('petFirstAidCert', petFirstAidCert);
      if (petFirstAidNumber) formData.append('petFirstAidNumber', petFirstAidNumber);
      if (petFirstAidExpiry) formData.append('petFirstAidExpiry', petFirstAidExpiry);
      
      if (drivingLicenseFile) formData.append('drivingLicenseFile', drivingLicenseFile);
      if (drivingLicenseNumber) formData.append('drivingLicenseNumber', drivingLicenseNumber);
      if (drivingLicenseClass) formData.append('drivingLicenseClass', drivingLicenseClass);
      if (drivingLicenseExpiry) formData.append('drivingLicenseExpiry', drivingLicenseExpiry);
      
      if (businessLicense) formData.append('businessLicense', businessLicense);
      formData.append('traceId', traceId);

      console.log('[ProviderOnboarding] Submitting application with fields:', {
        traceId,
        firstName, lastName, phoneNumber: '***', idNumber: idNumber ? 'present' : 'empty',
        city, country, providerType: providerTypes[0], providerTypes,
        hasSelfie: !!selfiePhoto, hasGovId: !!governmentId,
        backgroundCheckConsent, residentialHistoryCount: residentialHistory.filter(a => a.trim()).length,
      });

      const response = await fetch(getApiUrl('/api/provider-onboarding/apply'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await response.json();
      console.log('[ProviderOnboarding] Response:', { traceId, status: response.status, ok: response.ok, data });

      if (response.ok) {
        setApplicationSubmitted(true);
        setBiometricScore(data.biometricMatchScore);
        toast({
          title: t.applicationSuccess,
          description: t.successMessage
        });
      } else {
        console.error('[ProviderOnboarding] Submit failed:', { traceId, status: response.status, error: data.error });
        toast({
          variant: 'destructive',
          title: t.error,
          description: data.error || (isHebrew ? 'שגיאה בשליחת בקשה' : 'Error submitting application')
        });
      }
    } catch (error: any) {
      console.error('[ProviderOnboarding] Submit exception:', { traceId, error: error?.message || error });
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'שגיאה בשליחת בקשה' : 'Error submitting application'
      });
    } finally {
      setLoading(false);
    }
  };

  if (applicationSubmitted) {
    return (
      <div className={`min-h-screen luxury-bg-mesh py-12 px-4 ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
        <div className="max-w-2xl mx-auto luxury-animate-fade-in">
          <div className="luxury-glass-card luxury-shadow-xl border-2 border-green-500/30 p-8">
            <div className="text-center mb-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-4 luxury-animate-scale-in">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <h2 className="luxury-heading-lg text-green-900 dark:text-green-100 mb-2">
                {t.applicationSuccess}
              </h2>
              <p className="luxury-text-body mt-2">
                {t.successMessage}
              </p>
            </div>
            <div className="space-y-6 luxury-animate-fade-in luxury-delay-2">
              {biometricScore !== null && (
                <div className="luxury-glass-card luxury-shadow-md p-6 border-2 border-blue-400/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <h3 className="luxury-heading-sm text-blue-900 dark:text-blue-200">
                      {t.biometricMatch}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-800 dark:text-blue-300">{t.matchScore}:</span>
                    <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {biometricScore.toFixed(1)}%
                    </span>
                  </div>
                  {biometricScore >= 75 && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isHebrew ? 'אימות זהות הצליח!' : 'Identity verification successful!'}
                    </p>
                  )}
                </div>
              )}

              <div className="luxury-glass-panel p-6 space-y-3">
                <h3 className="luxury-heading-sm mb-1">
                  {isHebrew ? 'מה קורה עכשיו?' : 'What happens next?'}
                </h3>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                  <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {isHebrew ? 'זמן בדיקה: עד 24 שעות עסקיות' : 'Review time: up to 24 business hours'}
                    </p>
                    <p className="text-xs text-green-700">
                      {isHebrew ? 'בדרך כלל מהר יותר' : 'Usually faster'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">
                    {isHebrew
                      ? 'תקבל הודעת אימייל ו-SMS ברגע שהבקשה תאושר'
                      : 'You will receive an email and SMS the moment your application is approved'}
                  </p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <DollarSign className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    {isHebrew
                      ? 'לאחר האישור תוכל להתחיל לקבל הזמנות ולהרוויח מיד'
                      : 'Once approved, you can start accepting bookings and earning immediately'}
                  </p>
                </div>
              </div>

              <div className="text-center space-y-1 pt-2">
                <p className="text-sm font-medium text-gray-700">
                  {isHebrew ? 'יש שאלות?' : 'Have questions?'}
                </p>
                <a
                  href="mailto:support@petwash.co.il"
                  className="text-sm text-blue-600 underline underline-offset-2"
                >
                  support@petwash.co.il
                </a>
                <p className="text-xs text-gray-500">
                  {isHebrew ? 'נענה תוך שעה בשעות פעילות' : 'We reply within 1 hour during business hours'}
                </p>
              </div>

              <Link href="/">
                <Button className="luxury-btn-primary luxury-shadow-xl w-full py-4" data-testid="button-back-home">
                  {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen luxury-bg-mesh py-12 px-4 ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
      {/* Close Button - Top Right */}
      <Button
        onClick={() => navigate('/')}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-black transition-colors"
        aria-label={isHebrew ? 'סגור' : 'Close'}
        data-testid="button-close-onboarding"
      >
        <X className="w-5 h-5 text-gray-700 dark:text-black" />
      </Button>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            {t.title}
          </h1>
          <p className="luxury-text-body">
            {t.subtitle}
          </p>
        </div>

        {/* Progress Steps - Luxury Gradient Circles */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 px-4 luxury-animate-slide-up luxury-delay-1">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              1
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'פלטפורמה ופרטים' : 'Platform & Info'}</span>
          </div>
          <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              2
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'מסמכים' : 'Documents'}</span>
          </div>
          <div className={`h-0.5 w-8 ${step >= 3 ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white luxury-shadow-lg' : 'bg-white text-gray-500'}`}>
              3
            </div>
            <span className="hidden lg:inline text-sm font-medium">{isHebrew ? 'רקע' : 'Background'}</span>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-2">
            {/* Step 1: Platform Selection & Personal Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="mb-6">
                    <Label className="luxury-heading-sm mb-3 block">{t.providerTypeTitle}</Label>
                    <p className="text-sm text-gray-500 mb-3">
                      {isHebrew ? 'ניתן לבחור יותר מפלטפורמה אחת' : 'You can select more than one platform'}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div 
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('walker') ? 'ring-2 ring-black bg-black/5' : ''}`} 
                        onClick={() => toggleProviderType('walker')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('walker')} 
                            onCheckedChange={() => toggleProviderType('walker')}
                            id="walker"
                          />
                          <Label htmlFor="walker" className="cursor-pointer flex-1 text-center">
                            <span className="text-2xl mb-2 block">🚶</span>
                            <span className="font-semibold block">{t.walker}</span>
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('sitter') ? 'ring-2 ring-black bg-black/5' : ''}`} 
                        onClick={() => toggleProviderType('sitter')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('sitter')} 
                            onCheckedChange={() => toggleProviderType('sitter')}
                            id="sitter"
                          />
                          <Label htmlFor="sitter" className="cursor-pointer flex-1 text-center">
                            <span className="text-2xl mb-2 block">🏠</span>
                            <span className="font-semibold block">{t.sitter}</span>
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('driver') ? 'ring-2 ring-black bg-black/5' : ''}`} 
                        onClick={() => toggleProviderType('driver')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('driver')} 
                            onCheckedChange={() => toggleProviderType('driver')}
                            id="driver"
                          />
                          <Label htmlFor="driver" className="cursor-pointer flex-1 text-center">
                            <span className="text-2xl mb-2 block">🚗</span>
                            <span className="font-semibold block">{isHebrew ? 'נהג PetTrek' : 'PetTrek Driver'}</span>
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('trainer') ? 'ring-2 ring-black bg-black/5' : ''}`} 
                        onClick={() => toggleProviderType('trainer')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('trainer')} 
                            onCheckedChange={() => toggleProviderType('trainer')}
                            id="trainer"
                          />
                          <Label htmlFor="trainer" className="cursor-pointer flex-1 text-center">
                            <span className="text-2xl mb-2 block">🎓</span>
                            <span className="font-semibold block">{isHebrew ? 'מאלף כלבים' : 'Dog Trainer'}</span>
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`luxury-glass-card p-4 cursor-pointer transition-all ${hasProviderType('station_operator') ? 'ring-2 ring-black bg-black/5' : ''}`} 
                        onClick={() => toggleProviderType('station_operator')}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={hasProviderType('station_operator')} 
                            onCheckedChange={() => toggleProviderType('station_operator')}
                            id="station_operator"
                          />
                          <Label htmlFor="station_operator" className="cursor-pointer flex-1 text-center">
                            <span className="text-2xl mb-2 block">🚿</span>
                            <span className="font-semibold block">{t.stationOperator}</span>
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">{t.firstName}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">{t.lastName}</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                {/* Phone with country code + OTP verification */}
                <div className="space-y-2">
                  <Label>{t.phone} {phoneVerified && <span className="text-green-600 text-xs font-semibold ml-1">✅ {isHebrew ? 'מאומת' : 'Verified'}</span>}</Label>
                  {!phoneVerified && (
                    <>
                      <div className="flex gap-2">
                        <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode} disabled={!!phoneOtpId}>
                          <SelectTrigger className="w-[110px] h-12 bg-white border border-gray-200 rounded-xl text-sm flex-shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map(({ code, label, name }) => (
                              <SelectItem key={code} value={code}>{label} {name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s\-]/g, ''))}
                          placeholder={isHebrew ? 'מספר טלפון' : 'Phone number'}
                          disabled={!!phoneOtpId}
                          className="flex-1 h-12 bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          inputMode="tel"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={sendPhoneOtp}
                          disabled={phoneOtpSending || !!phoneOtpId || !phoneNumber.trim()}
                          className="h-12 px-4 text-sm border-[#C6A35B] text-[#C6A35B] hover:bg-[#C6A35B]/10 whitespace-nowrap flex-shrink-0"
                        >
                          {phoneOtpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isHebrew ? 'שלח קוד' : 'Send Code')}
                        </Button>
                      </div>
                      {phoneOtpId && (
                        <div className="flex gap-2 items-center animate-in slide-in-from-top-2">
                          <Input
                            value={phoneOtpCode}
                            onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder={isHebrew ? 'קוד SMS בן 6 ספרות' : '6-digit SMS code'}
                            inputMode="numeric"
                            maxLength={6}
                            className="flex-1 h-12 bg-white !text-gray-900 border-2 border-[#C6A35B]/40 rounded-xl placeholder:text-gray-400 text-center text-lg font-mono tracking-widest"
                          />
                          <Button
                            type="button"
                            onClick={verifyPhoneOtp}
                            disabled={phoneOtpVerifying || phoneOtpCode.length !== 6}
                            className="h-12 px-5 bg-gradient-to-r from-[#C6A35B] to-[#E7C978] text-black font-bold rounded-xl whitespace-nowrap"
                          >
                            {phoneOtpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : (isHebrew ? 'אמת' : 'Verify')}
                          </Button>
                          <button
                            type="button"
                            onClick={() => { setPhoneOtpId(null); setPhoneOtpCode(''); setPhoneOtpError(''); }}
                            className="text-gray-400 hover:text-gray-600 text-sm underline whitespace-nowrap"
                          >
                            {isHebrew ? 'שנה' : 'Change'}
                          </button>
                        </div>
                      )}
                      {phoneOtpError && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <span>⚠️</span> {phoneOtpError}
                        </p>
                      )}
                      {!phoneOtpId && (
                        <p className="text-gray-400 text-xs">
                          {isHebrew ? 'יש לאמת את מספר הטלפון לפני המשך' : 'Phone verification required before proceeding'}
                        </p>
                      )}
                    </>
                  )}
                  {phoneVerified && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-green-700 text-sm font-medium">
                        {phoneCountryCode}{phoneNumber} {isHebrew ? '— אומת בהצלחה' : '— verified successfully'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="idNumber">{t.idNumber}</Label>
                  <Input
                    id="idNumber"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={t.idNumberPlaceholder}
                    className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                    data-testid="input-id-number"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">{t.city}</Label>
                    <GooglePlacesAutocomplete
                      value={city}
                      onChange={(value, details) => {
                        setCity(details?.city || value);
                        if (details?.country === 'Israel') setCountry('IL');
                        else if (details?.country === 'United States') setCountry('USA');
                        else if (details?.country === 'United Kingdom') setCountry('UK');
                        else if (details?.country === 'Australia') setCountry('AUS');
                        else if (details?.country === 'Canada') setCountry('CAN');
                      }}
                      placeholder={isHebrew ? 'התחל להקליד עיר...' : 'Start typing city...'}
                      country={['il', 'us', 'gb', 'au', 'ca']}
                      inputClassName="bg-white !text-gray-900 border-2 border-gray-200 rounded-xl placeholder:text-gray-400 px-4 py-4 text-base min-h-[48px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">{t.country}</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="w-full h-12 bg-white !text-gray-900 border border-gray-200 rounded-xl" data-testid="select-country">
                        <SelectValue placeholder={isHebrew ? 'בחר מדינה' : 'Select country'} />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-48">
                          <SelectItem value="IL">Israel (ישראל)</SelectItem>
                          <SelectItem value="USA">USA (ארצות הברית)</SelectItem>
                          <SelectItem value="UK">United Kingdom (בריטניה)</SelectItem>
                          <SelectItem value="AUS">Australia (אוסטרליה)</SelectItem>
                          <SelectItem value="CAN">Canada (קנדה)</SelectItem>
                          <SelectItem value="DE">Germany (גרמניה)</SelectItem>
                          <SelectItem value="FR">France (צרפת)</SelectItem>
                          <SelectItem value="IT">Italy (איטליה)</SelectItem>
                          <SelectItem value="ES">Spain (ספרד)</SelectItem>
                          <SelectItem value="NL">Netherlands (הולנד)</SelectItem>
                          <SelectItem value="BE">Belgium (בלגיה)</SelectItem>
                          <SelectItem value="CH">Switzerland (שווייץ)</SelectItem>
                          <SelectItem value="AT">Austria (אוסטריה)</SelectItem>
                          <SelectItem value="SE">Sweden (שוודיה)</SelectItem>
                          <SelectItem value="NO">Norway (נורבגיה)</SelectItem>
                          <SelectItem value="DK">Denmark (דנמרק)</SelectItem>
                          <SelectItem value="FI">Finland (פינלנד)</SelectItem>
                          <SelectItem value="IE">Ireland (אירלנד)</SelectItem>
                          <SelectItem value="PT">Portugal (פורטוגל)</SelectItem>
                          <SelectItem value="GR">Greece (יוון)</SelectItem>
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={() => setStep(2)} 
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={!firstName || !lastName || !phoneNumber || !phoneVerified || !idNumber || !city || providerTypes.length === 0}
                    data-testid="button-next-step2"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Biometric KYC */}
            {step === 2 && (
              <div className="space-y-6">
                <Alert>
                  <Shield className="h-5 w-5" />
                  <AlertDescription>
                    <strong>{t.biometricKyc}</strong>
                    <br />
                    {t.kycDescription}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {/* Selfie Photo */}
                  <div>
                    <Label htmlFor="selfie" className="text-lg font-semibold flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      {t.selfiePhoto}
                    </Label>
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setSelfiePhoto(e.target.files?.[0] || null)}
                      className="mt-2 luxury-glass-minimal"
                      data-testid="input-selfie"
                    />
                    {selfiePhoto && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t.fileSelected}: {selfiePhoto.name}
                      </p>
                    )}
                  </div>

                  {/* Government ID */}
                  <div>
                    <Label htmlFor="governmentId" className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {t.governmentId}
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">{t.governmentIdDescription}</p>
                    <Input
                      id="governmentId"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setGovernmentId(e.target.files?.[0] || null)}
                      className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                      data-testid="input-government-id"
                    />
                    {governmentId && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t.fileSelected}: {governmentId.name}
                      </p>
                    )}
                  </div>

                  {/* Insurance Certificate + Policy Details (Walkers/Sitters) */}
                  {(hasProviderType('walker') || hasProviderType('sitter')) && (
                    <>
                      <div className="luxury-glass-card luxury-shadow-md p-4 space-y-3 border-2 border-blue-400/20">
                        <Label htmlFor="insurance" className="text-lg font-semibold">
                          {t.insurancePolicy}
                        </Label>
                        <p className="text-sm text-gray-500">{t.insuranceCertOptional}</p>
                        
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="insurancePolicyNumber" className="text-sm">{t.policyNumber}</Label>
                            <Input
                              id="insurancePolicyNumber"
                              value={insurancePolicyNumber}
                              onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: POL-123456' : 'e.g. POL-123456'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-insurance-policy-number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="insuranceProvider" className="text-sm">{t.provider}</Label>
                            <Input
                              id="insuranceProvider"
                              value={insuranceProvider}
                              onChange={(e) => setInsuranceProvider(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: כלל ביטוח' : 'e.g. Clal Insurance'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-insurance-provider"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="insuranceExpiry" className="text-sm">{t.expiryDate}</Label>
                          <DatePicker
                            value={insuranceExpiry}
                            onChange={setInsuranceExpiry}
                            placeholder={isHebrew ? 'בחר תאריך תפוגה' : 'Select expiry date'}
                            minDate={new Date()}
                            language={language}
                            testId="input-insurance-expiry"
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="insurance" className="text-sm">{t.insuranceCert}</Label>
                          <Input
                            id="insurance"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setInsuranceCert(e.target.files?.[0] || null)}
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            data-testid="input-insurance"
                          />
                          {insuranceCert && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              {t.fileSelected}: {insuranceCert.name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Pet First Aid Certification (2026 Spec) */}
                      <div className="luxury-glass-card luxury-shadow-md p-4 space-y-3 border-2 border-green-400/20">
                        <Label htmlFor="petFirstAid" className="text-lg font-semibold">
                          {t.petFirstAidCert}
                        </Label>
                        <p className="text-sm text-gray-500">{t.petFirstAidRequired}</p>
                        
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="petFirstAidNumber" className="text-sm">{t.certNumber}</Label>
                            <Input
                              id="petFirstAidNumber"
                              value={petFirstAidNumber}
                              onChange={(e) => setPetFirstAidNumber(e.target.value)}
                              placeholder={isHebrew ? 'לדוגמה: PFA-2024-12345' : 'e.g. PFA-2024-12345'}
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                              data-testid="input-pet-first-aid-number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="petFirstAidExpiry" className="text-sm">{t.expiryDate}</Label>
                            <DatePicker
                              value={petFirstAidExpiry}
                              onChange={setPetFirstAidExpiry}
                              placeholder={isHebrew ? 'בחר תאריך תפוגה' : 'Select expiry date'}
                              minDate={new Date()}
                              language={language}
                              testId="input-pet-first-aid-expiry"
                              className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="petFirstAidCert" className="text-sm">{t.petFirstAidCert}</Label>
                          <Input
                            id="petFirstAidCert"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setPetFirstAidCert(e.target.files?.[0] || null)}
                            className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                            data-testid="input-pet-first-aid-cert"
                          />
                          {petFirstAidCert && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              {t.fileSelected}: {petFirstAidCert.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Business License (Station Operators) */}
                  {hasProviderType('station_operator') && (
                    <div>
                      <Label htmlFor="businessLicense" className="text-lg font-semibold">
                        {t.businessLicense}
                      </Label>
                      <p className="text-sm text-gray-500 mb-2">{t.businessLicenseOptional}</p>
                      <Input
                        id="businessLicense"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setBusinessLicense(e.target.files?.[0] || null)}
                        className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                        data-testid="input-business-license"
                      />
                      {businessLicense && (
                        <p className="text-sm text-green-600 mt-1 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {t.fileSelected}: {businessLicense.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => setStep(1)} className="luxury-btn-secondary" data-testid="button-back-step1">
                    {t.back}
                  </Button>
                  <Button 
                    onClick={() => setStep(3)} 
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={!selfiePhoto || !governmentId}
                    data-testid="button-next-step3"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Declarations & Background Check (2026 Spec) */}
            {step === 3 && (
              <div className="space-y-6">
                <Alert className="border-blue-500 bg-blue-50 dark:bg-white">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <AlertDescription>
                    <strong className="text-blue-900 dark:text-blue-200">{t.backgroundCheck}</strong>
                    <br />
                    <span className="text-blue-800 dark:text-blue-300">{t.backgroundCheckDescription}</span>
                  </AlertDescription>
                </Alert>

                {/* Role-Specific Declarations - USA 2025 Compliance */}
                <div className="luxury-glass-card luxury-shadow-lg border-2 border-purple-400/30 p-6">
                  <h3 className="luxury-heading-sm text-purple-900 dark:text-purple-200 mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {isHebrew ? 'הצהרות נדרשות' : 'Required Declarations'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {isHebrew 
                      ? 'אנא סמן את כל ההצהרות הרלוונטיות לתפקיד שלך. מסמכים יאומתו ידנית על ידי צוות Pet Wash.'
                      : 'Please check all declarations relevant to your role. Documents will be manually verified by Pet Wash team.'}
                  </p>

                  {/* Driver Declarations (PetTrek) */}
                  {hasProviderType('driver') && (
                    <div className="space-y-3 mb-6 p-4 bg-blue-50 dark:bg-white rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200">
                        🚗 {isHebrew ? 'הצהרות נהג (PetTrek)' : 'Driver Declarations (PetTrek)'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationValidLicense} onCheckedChange={(checked) => setDeclarationValidLicense(!!checked)} className="mt-1" data-testid="checkbox-valid-license" />
                        <span className="text-sm">{isHebrew ? 'יש לי רישיון נהיגה ישראלי בתוקף' : 'I have a valid Israeli driving license'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationNoSuspension} onCheckedChange={(checked) => setDeclarationNoSuspension(!!checked)} className="mt-1" data-testid="checkbox-no-suspension" />
                        <span className="text-sm">{isHebrew ? 'רישיון הנהיגה שלי לא נשלל ולא מותלה' : 'My driving license has not been suspended or revoked'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationUnderPointsLimit} onCheckedChange={(checked) => setDeclarationUnderPointsLimit(!!checked)} className="mt-1" data-testid="checkbox-points-limit" />
                        <span className="text-sm">{isHebrew ? 'יש לי פחות מ-12 נקודות ברישיון (לפי חוק)' : 'I have less than 12 points on my license (as per law)'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationNoDrugsAlcohol} onCheckedChange={(checked) => setDeclarationNoDrugsAlcohol(!!checked)} className="mt-1" data-testid="checkbox-no-drugs" />
                        <span className="text-sm">{isHebrew ? 'אני מתחייב לא לנהוג תחת השפעת סמים או אלכוהול' : 'I commit to never drive under influence of drugs or alcohol'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationValidVehicleInsurance} onCheckedChange={(checked) => setDeclarationValidVehicleInsurance(!!checked)} className="mt-1" data-testid="checkbox-vehicle-insurance" />
                        <span className="text-sm">{isHebrew ? 'יש לי ביטוח רכב תקף (ביטוח חובה + מקיף)' : 'I have valid vehicle insurance (mandatory + comprehensive)'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationVehicleInspection} onCheckedChange={(checked) => setDeclarationVehicleInspection(!!checked)} className="mt-1" data-testid="checkbox-vehicle-inspection" />
                        <span className="text-sm">{isHebrew ? 'לרכב שלי יש טסט שנתי בתוקף' : 'My vehicle has a valid annual inspection (טסט)'}</span>
                      </label>
                    </div>
                  )}

                  {/* Trainer Declarations (Academy) */}
                  {hasProviderType('trainer') && (
                    <div className="space-y-3 mb-6 p-4 bg-green-50 dark:bg-white rounded-lg border border-green-200 dark:border-green-800">
                      <h4 className="font-semibold text-green-900 dark:text-green-200">
                        🎓 {isHebrew ? 'הצהרות מאמן (Academy)' : 'Trainer Declarations (Academy)'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationTrainingCertification} onCheckedChange={(checked) => setDeclarationTrainingCertification(!!checked)} className="mt-1" data-testid="checkbox-training-cert" />
                        <span className="text-sm">{isHebrew ? 'יש לי תעודת אילוף כלבים מוכרת או ניסיון מוכח' : 'I have recognized pet training certification or proven experience'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationAccreditedCourses} onCheckedChange={(checked) => setDeclarationAccreditedCourses(!!checked)} className="mt-1" data-testid="checkbox-accredited-courses" />
                        <span className="text-sm">{isHebrew ? 'סיימתי קורסי אילוף מוסמכים' : 'I have completed accredited training courses'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationLiabilityInsurance} onCheckedChange={(checked) => setDeclarationLiabilityInsurance(!!checked)} className="mt-1" data-testid="checkbox-liability-insurance" />
                        <span className="text-sm">{isHebrew ? 'יש לי ביטוח אחריות מקצועית' : 'I carry professional liability insurance'}</span>
                      </label>
                    </div>
                  )}

                  {/* Sitter/Walker Declarations */}
                  {(hasProviderType('walker') || hasProviderType('sitter')) && (
                    <div className="space-y-3 mb-6 p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                      <h4 className="font-semibold text-pink-900 dark:text-pink-200">
                        🐕 {isHebrew ? 'הצהרות שמרטף/מטייל' : 'Sitter/Walker Declarations'}
                      </h4>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationPhysicallyFit} onCheckedChange={(checked) => setDeclarationPhysicallyFit(!!checked)} className="mt-1" data-testid="checkbox-physically-fit" />
                        <span className="text-sm">{isHebrew ? 'אני כשיר/ה פיזית לטיפול בחיות מחמד' : 'I am physically fit to handle pets'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationAnimalExperience} onCheckedChange={(checked) => setDeclarationAnimalExperience(!!checked)} className="mt-1" data-testid="checkbox-animal-experience" />
                        <span className="text-sm">{isHebrew ? 'יש לי ניסיון בטיפול בחיות מחמד' : 'I have experience caring for animals'}</span>
                      </label>
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox checked={declarationFirstAidTraining} onCheckedChange={(checked) => setDeclarationFirstAidTraining(!!checked)} className="mt-1" data-testid="checkbox-first-aid" />
                        <span className="text-sm">{isHebrew ? 'יש לי הכשרה בעזרה ראשונה לחיות מחמד (אופציונלי)' : 'I have pet first aid training (optional)'}</span>
                      </label>
                    </div>
                  )}

                  {/* Universal Declarations (All Roles) */}
                  <div className="space-y-3 p-4 bg-white dark:bg-white/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-black">
                      ✅ {isHebrew ? 'הצהרות כלליות (חובה)' : 'General Declarations (Required)'}
                    </h4>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={declarationAccurateInfo} onCheckedChange={(checked) => setDeclarationAccurateInfo(!!checked)} className="mt-1" data-testid="checkbox-accurate-info" />
                      <span className="text-sm">{isHebrew ? 'כל המידע שמסרתי נכון ומדויק' : 'All information I provided is true and accurate'}</span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={declarationAcceptTerms} onCheckedChange={(checked) => setDeclarationAcceptTerms(!!checked)} className="mt-1" data-testid="checkbox-accept-terms" />
                      <span className="text-sm">{isHebrew ? 'אני מסכים/ה לתנאי השימוש ולהסכם קבלן עצמאי' : 'I agree to the Terms of Service and Independent Contractor Agreement'}</span>
                    </label>
                  </div>

                  {/* Israel-safe self-declaration (2026 spec). Mandatory.  */}
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-200">
                      🛡️ {declarationText.title}
                    </h4>
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      {declarationText.idRequiredNotice}
                    </p>
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      {declarationText.body}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={selfDeclarationNoConvictions}
                        onCheckedChange={(checked) => setSelfDeclarationNoConvictions(!!checked)}
                        className="mt-1"
                        data-testid="checkbox-self-declaration-no-convictions"
                      />
                      <span className="text-sm text-blue-900 dark:text-blue-200">
                        {declarationText.checkboxLabel}
                      </span>
                    </label>

                    {/* Optional opt-in to high-risk service categories */}
                    <div className="mt-2 pt-3 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                        {isHebrew ? 'שירותים שאספק (סמן את כל הרלוונטיים):' : 'Services I will offer (tick all that apply):'}
                      </p>
                      {ENHANCED_VERIFICATION_REASONS.map((reason) => {
                        const checked = enhancedReasons.includes(reason);
                        const label = isHebrew ? ENHANCED_REASON_LABELS[reason].he : ENHANCED_REASON_LABELS[reason].en;
                        return (
                          <label key={reason} className="flex items-start gap-3 cursor-pointer mb-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setEnhancedReasons((prev) =>
                                  c
                                    ? Array.from(new Set([...prev, reason]))
                                    : prev.filter((r) => r !== reason),
                                );
                              }}
                              className="mt-1"
                              data-testid={`checkbox-enhanced-${reason}`}
                            />
                            <span className="text-sm text-blue-900 dark:text-blue-200">{label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {enhancedVerificationRequired && (
                      <div className="mt-2 p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700">
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          ⚠️ {declarationText.enhancedNotice}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Legal Notice - Israeli Law Compliance */}
                  <div className="mt-4 p-3 bg-white dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {isHebrew 
                        ? '⚖️ הערה משפטית: בהתאם לחוק הגנת הפרטיות בישראל, איננו מבקשים מידע על עבר פלילי באופן ישיר. במקום זאת, אנו מסתמכים על הצהרות עצמיות ואימות מסמכים ידני. לפי סעיף 2 לחוק המרשם הפלילי, אין לדרוש גילוי מידע על הרשעות שנמחקו.'
                        : '⚖️ Legal Notice: In accordance with Israeli Privacy Protection Law, we do not directly request criminal record information. Instead, we rely on self-declarations and manual document verification. Per Section 2 of the Criminal Registry Law, disclosure of expunged convictions cannot be required.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Residential History (10 years) - REQUIRED */}
                  <div>
                    <Label className="text-lg font-semibold">
                      {t.residentialHistory}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <p className="text-sm text-gray-500 mb-3">{t.residentialHistoryHelp}</p>
                    
                    {residentialHistory.map((address, index) => (
                      <div key={index} className="mb-2">
                        <Input
                          value={address}
                          onChange={(e) => {
                            const newHistory = [...residentialHistory];
                            newHistory[index] = e.target.value;
                            setResidentialHistory(newHistory);
                          }}
                          placeholder={isHebrew 
                            ? `כתובת ${index + 1}: לדוגמה - תל אביב, ישראל (2018-2023)`
                            : `Address ${index + 1}: e.g. Tel Aviv, Israel (2018-2023)`
                          }
                          className="bg-white !text-gray-900 border border-gray-200 rounded-xl placeholder:text-gray-400"
                          data-testid={`input-address-${index}`}
                        />
                      </div>
                    ))}
                    {residentialHistory.filter(a => a.trim()).length === 0 && (
                      <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {isHebrew ? 'נדרשת לפחות כתובת מגורים אחת כדי להמשיך' : 'At least one address is required to continue'}
                      </p>
                    )}
                    
                    <Button
                      onClick={() => setResidentialHistory([...residentialHistory, ''])}
                      className="luxury-btn-secondary text-sm px-4 py-2 mt-2"
                      data-testid="button-add-address"
                    >
                      {t.addAddress}
                    </Button>
                  </div>

                  {/* Consent Checkbox */}
                  <div className="luxury-glass-card luxury-shadow-md border-2 border-yellow-400/30 p-6">
                    <h3 className="luxury-heading-sm text-yellow-900 dark:text-yellow-200 mb-3">
                      {t.consentTitle}
                    </h3>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backgroundCheckConsent}
                        onChange={(e) => setBackgroundCheckConsent(e.target.checked)}
                        className="mt-1"
                        data-testid="checkbox-background-consent"
                      />
                      <span className="text-sm text-yellow-800 dark:text-yellow-300">
                        {t.consentText}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => setStep(2)} className="luxury-btn-secondary" data-testid="button-back-step2">
                    {t.back}
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    className="luxury-btn-primary luxury-shadow-xl flex-1"
                    disabled={
                      loading ||
                      !backgroundCheckConsent ||
                      !declarationAccurateInfo ||
                      !declarationAcceptTerms ||
                      !selfDeclarationNoConvictions ||
                      residentialHistory.filter(addr => addr.trim()).length === 0 ||
                      // Driver-specific declarations (PetTrek)
                      (hasProviderType('driver') && (
                        !declarationValidLicense ||
                        !declarationNoSuspension ||
                        !declarationUnderPointsLimit ||
                        !declarationNoDrugsAlcohol ||
                        !declarationValidVehicleInsurance ||
                        !declarationVehicleInspection
                      )) ||
                      // Trainer-specific declarations (Academy)
                      (hasProviderType('trainer') && (
                        !declarationTrainingCertification ||
                        !declarationAccreditedCourses ||
                        !declarationLiabilityInsurance
                      )) ||
                      // Sitter/Walker-specific declarations
                      ((hasProviderType('walker') || hasProviderType('sitter')) && (
                        !declarationPhysicallyFit ||
                        !declarationAnimalExperience
                      ))
                    }
                    data-testid="button-submit-application"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2 inline" />
                        {t.submitting}
                      </>
                    ) : (
                      t.submit
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
