import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  Loader2
} from 'lucide-react';
import { Link } from 'wouter';

export default function ProviderOnboarding() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isHebrew = language === 'he';

  // Form state
  const [step, setStep] = useState(1);
  const [inviteCode, setInviteCode] = useState('');
  const [providerType, setProviderType] = useState<'walker' | 'sitter' | 'station_operator'>('walker');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
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

  // State
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeValid, setCodeValid] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [biometricScore, setBiometricScore] = useState<number | null>(null);

  const t = {
    title: isHebrew ? 'הצטרפו לצוות Pet Wash' : 'Join the Pet Wash Team',
    subtitle: isHebrew ? 'הירשם כשותף עצמאי והתחל להרוויח' : 'Sign up as an independent contractor and start earning',
    inviteCodeTitle: isHebrew ? 'קוד הזמנה' : 'Invite Code',
    inviteCodePlaceholder: isHebrew ? 'הזן קוד הזמנה (לדוגמה: WALKER-A8F3H9K2)' : 'Enter invite code (e.g., WALKER-A8F3H9K2)',
    validateCode: isHebrew ? 'אמת קוד' : 'Validate Code',
    validating: isHebrew ? 'מאמת...' : 'Validating...',
    providerTypeTitle: isHebrew ? 'סוג שותף' : 'Provider Type',
    walker: isHebrew ? 'מטייל כלבים (Walk My Pet)' : 'Dog Walker (Walk My Pet)',
    sitter: isHebrew ? 'שמרטף (The Sitter Suite)' : 'Pet Sitter (The Sitter Suite)',
    stationOperator: isHebrew ? 'מפעיל תחנת רחצה (K9000)' : 'Wash Station Operator (K9000)',
    personalInfo: isHebrew ? 'פרטים אישיים' : 'Personal Information',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    phone: isHebrew ? 'טלפון' : 'Phone Number',
    city: isHebrew ? 'עיר' : 'City',
    country: isHebrew ? 'מדינה' : 'Country',
    biometricKyc: isHebrew ? 'אימות ביומטרי (רמת בנקאות)' : 'Biometric Verification (Banking-Level)',
    kycDescription: isHebrew 
      ? 'כמו Uber, אנו דורשים אימות זהות מאובטח עם התאמת פנים באמצעות AI'
      : 'Like Uber, we require secure identity verification with AI-powered face matching',
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
      ? 'אני מסכים/ה שחברת Pet Wash™ תבצע בדיקת רקע פלילי מקיפה כולל היסטוריית מגורים של 10 שנים. אני מבין/ה שהמידע ישמש אך ורק למטרות אימות זהות ובטיחות.'
      : 'I consent to Pet Wash™ conducting a comprehensive criminal background check including 10-year residential history. I understand this information will be used solely for identity verification and safety purposes.',
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

  const validateInviteCode = async () => {
    if (!inviteCode) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'נא להזין קוד הזמנה' : 'Please enter invite code'
      });
      return;
    }

    setValidatingCode(true);

    try {
      const response = await fetch('/api/provider-onboarding/validate-invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode })
      });

      const data = await response.json();

      if (data.valid) {
        setCodeValid(true);
        setProviderType(data.providerType);
        toast({
          title: isHebrew ? 'קוד תקף!' : 'Valid Code!',
          description: isHebrew 
            ? `קוד זה מיועד ל${data.providerType === 'walker' ? 'מטיילי כלבים' : data.providerType === 'sitter' ? 'שמרטפים' : 'מפעילי תחנות'}`
            : `This code is for ${data.providerType}s`
        });
        setStep(2);
      } else {
        toast({
          variant: 'destructive',
          title: t.error,
          description: data.error || (isHebrew ? 'קוד לא תקף' : 'Invalid code')
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t.error,
        description: isHebrew ? 'שגיאה באימות קוד' : 'Error validating code'
      });
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async () => {
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

    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      
      formData.append('inviteCode', inviteCode);
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('phoneNumber', phoneNumber);
      formData.append('city', city);
      formData.append('country', country);
      formData.append('providerType', providerType);
      formData.append('selfiePhoto', selfiePhoto);
      formData.append('governmentId', governmentId);
      
      // Background check data (2026 spec)
      formData.append('residentialHistory', JSON.stringify(residentialHistory.filter(addr => addr.trim())));
      formData.append('backgroundCheckConsent', backgroundCheckConsent.toString());
      
      // Role-specific certifications (2026 spec)
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

      const response = await fetch('/api/provider-onboarding/apply', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setApplicationSubmitted(true);
        setBiometricScore(data.biometricMatchScore);
        toast({
          title: t.applicationSuccess,
          description: t.successMessage
        });
      } else {
        toast({
          variant: 'destructive',
          title: t.error,
          description: data.error || (isHebrew ? 'שגיאה בשליחת בקשה' : 'Error submitting application')
        });
      }
    } catch (error) {
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
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-green-500">
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-green-900 dark:text-green-100">
                {t.applicationSuccess}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {t.successMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {biometricScore !== null && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">
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

              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
                <h3 className="font-bold mb-3 text-gray-900 dark:text-white">
                  {isHebrew ? 'מה הלאה?' : 'What\'s Next?'}
                </h3>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'הצוות שלנו יבדוק את הבקשה תוך 24-48 שעות' : 'Our team will review your application within 24-48 hours'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'תקבל מייל עם סטטוס האישור' : 'You\'ll receive an email with approval status'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'לאחר האישור תוכל להתחיל להרוויח מיד' : 'Once approved, you can start earning immediately'}</span>
                  </li>
                </ul>
              </div>

              <Link href="/">
                <Button className="w-full" size="lg">
                  {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {t.subtitle}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 px-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} text-sm`}>
              1
            </div>
            <span className="hidden lg:inline text-sm">{isHebrew ? 'קוד' : 'Code'}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} text-sm`}>
              2
            </div>
            <span className="hidden lg:inline text-sm">{isHebrew ? 'פרטים' : 'Info'}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} text-sm`}>
              3
            </div>
            <span className="hidden lg:inline text-sm">{isHebrew ? 'מסמכים' : 'Docs'}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className={`flex items-center gap-2 ${step >= 4 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} text-sm`}>
              4
            </div>
            <span className="hidden lg:inline text-sm">{isHebrew ? 'רקע' : 'Check'}</span>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Invite Code */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="inviteCode" className="text-lg font-semibold">
                    {t.inviteCodeTitle}
                  </Label>
                  <Input
                    id="inviteCode"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t.inviteCodePlaceholder}
                    className="mt-2"
                    data-testid="input-invite-code"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    {isHebrew 
                      ? 'קבל קוד הזמנה מהצוות שלנו או מחבר שכבר עובד איתנו'
                      : 'Get an invite code from our team or a friend who already works with us'
                    }
                  </p>
                </div>

                <Button 
                  onClick={validateInviteCode} 
                  className="w-full" 
                  size="lg"
                  disabled={validatingCode || !inviteCode}
                  data-testid="button-validate-code"
                >
                  {validatingCode ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {t.validating}
                    </>
                  ) : (
                    t.validateCode
                  )}
                </Button>

                {/* Benefits Section */}
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                    <h3 className="font-bold mb-3 text-green-900 dark:text-green-200 flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      {t.benefits}
                    </h3>
                    <ul className="space-y-2 text-sm text-green-800 dark:text-green-300">
                      {t.benefitsList.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                    <h3 className="font-bold mb-3 text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t.requirements}
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                      {t.requirementsList.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Personal Information */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">{t.firstName}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">{t.lastName}</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+972-XX-XXXXXXX"
                    data-testid="input-phone"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">{t.city}</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">{t.country}</Label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      data-testid="select-country"
                    >
                      <option value="IL">Israel (ישראל)</option>
                      <option value="USA">USA (ארצות הברית)</option>
                      <option value="UK">United Kingdom (בריטניה)</option>
                      <option value="AUS">Australia (אוסטרליה)</option>
                      <option value="CAN">Canada (קנדה)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => setStep(1)} variant="outline" data-testid="button-back-step1">
                    {t.back}
                  </Button>
                  <Button 
                    onClick={() => setStep(3)} 
                    className="flex-1"
                    disabled={!firstName || !lastName || !phoneNumber || !city}
                    data-testid="button-next-step3"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Biometric KYC */}
            {step === 3 && (
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
                      className="mt-2"
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
                  {(providerType === 'walker' || providerType === 'sitter') && (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
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
                              data-testid="input-insurance-provider"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="insuranceExpiry" className="text-sm">{t.expiryDate}</Label>
                          <Input
                            id="insuranceExpiry"
                            type="date"
                            value={insuranceExpiry}
                            onChange={(e) => setInsuranceExpiry(e.target.value)}
                            data-testid="input-insurance-expiry"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="insurance" className="text-sm">{t.insuranceCert}</Label>
                          <Input
                            id="insurance"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setInsuranceCert(e.target.files?.[0] || null)}
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
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 space-y-3">
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
                              data-testid="input-pet-first-aid-number"
                            />
                          </div>
                          <div>
                            <Label htmlFor="petFirstAidExpiry" className="text-sm">{t.expiryDate}</Label>
                            <Input
                              id="petFirstAidExpiry"
                              type="date"
                              value={petFirstAidExpiry}
                              onChange={(e) => setPetFirstAidExpiry(e.target.value)}
                              data-testid="input-pet-first-aid-expiry"
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
                  {providerType === 'station_operator' && (
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
                  <Button onClick={() => setStep(2)} variant="outline" data-testid="button-back-step2">
                    {t.back}
                  </Button>
                  <Button 
                    onClick={() => setStep(4)} 
                    className="flex-1"
                    disabled={!selfiePhoto || !governmentId}
                    data-testid="button-next-step4"
                  >
                    {t.next}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Criminal Background Check (2026 Spec) */}
            {step === 4 && (
              <div className="space-y-6">
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <AlertDescription>
                    <strong className="text-blue-900 dark:text-blue-200">{t.backgroundCheck}</strong>
                    <br />
                    <span className="text-blue-800 dark:text-blue-300">{t.backgroundCheckDescription}</span>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {/* Residential History (10 years) */}
                  <div>
                    <Label className="text-lg font-semibold">{t.residentialHistory}</Label>
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
                          data-testid={`input-address-${index}`}
                        />
                      </div>
                    ))}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResidentialHistory([...residentialHistory, ''])}
                      className="mt-2"
                      data-testid="button-add-address"
                    >
                      {t.addAddress}
                    </Button>
                  </div>

                  {/* Consent Checkbox */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-700 rounded-xl p-6">
                    <h3 className="font-bold text-yellow-900 dark:text-yellow-200 mb-3">
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
                  <Button onClick={() => setStep(3)} variant="outline" data-testid="button-back-step3">
                    {t.back}
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    className="flex-1"
                    disabled={
                      loading || 
                      !backgroundCheckConsent || 
                      residentialHistory.filter(addr => addr.trim()).length === 0
                    }
                    data-testid="button-submit-application"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        {t.submitting}
                      </>
                    ) : (
                      t.submit
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
