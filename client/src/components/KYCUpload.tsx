import { useState, useRef } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileCheck, AlertCircle, CheckCircle2, Clock, XCircle,
  Shield, Camera, CreditCard, Globe, Car, Heart, UserCheck,
} from 'lucide-react';
import { t, type Language } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { trackKYCSubmitted } from '@/lib/analytics';

interface KYCUploadProps {
  language: Language;
}

type DocType =
  | 'national_id'
  | 'passport'
  | 'drivers_license'
  | 'disability_certificate'
  | 'retirement_certificate';

type KYCStatus = 'pending' | 'approved' | 'rejected' | 'expired' | null;
type UploadStep = 'select_type' | 'upload_docs' | 'submitted';

const DOC_TYPES: { id: DocType; icon: React.ReactNode; labelHe: string; labelEn: string; descHe: string; descEn: string; needsBack: boolean }[] = [
  {
    id: 'national_id',
    icon: <CreditCard className="w-5 h-5" />,
    labelHe: 'תעודת זהות ישראלית',
    labelEn: 'Israeli National ID',
    descHe: 'תצלום קדמי ואחורי של ת.ז.',
    descEn: 'Front & back photo of ID card',
    needsBack: true,
  },
  {
    id: 'passport',
    icon: <Globe className="w-5 h-5" />,
    labelHe: 'דרכון',
    labelEn: 'Passport',
    descHe: 'עמוד הנתונים הביומטריים',
    descEn: 'Biometric data page',
    needsBack: false,
  },
  {
    id: 'drivers_license',
    icon: <Car className="w-5 h-5" />,
    labelHe: 'רישיון נהיגה',
    labelEn: 'Driver\'s License',
    descHe: 'תצלום קדמי ואחורי',
    descEn: 'Front & back photo',
    needsBack: true,
  },
  {
    id: 'disability_certificate',
    icon: <Heart className="w-5 h-5" />,
    labelHe: 'תעודת נכה',
    labelEn: 'Disability Certificate',
    descHe: 'תעודה בתוקף ממשרד הבריאות',
    descEn: 'Valid certificate from Ministry of Health',
    needsBack: false,
  },
  {
    id: 'retirement_certificate',
    icon: <UserCheck className="w-5 h-5" />,
    labelHe: 'תעודת גמלאי / קשיש',
    labelEn: 'Senior / Pension Certificate',
    descHe: 'אישור ממשרד הבריאות או ביטוח לאומי',
    descEn: 'Certificate from National Insurance',
    needsBack: false,
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIN_FILE_SIZE = 50 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

export function KYCUpload({ language }: KYCUploadProps) {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const isHe = language === 'he';

  const [step, setStep] = useState<UploadStep>('select_type');
  const [docType, setDocType] = useState<DocType | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [kycStatus, setKycStatus] = useState<KYCStatus>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const selfieRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const selectedDoc = DOC_TYPES.find(d => d.id === docType);

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ variant: 'destructive', title: t('kyc.error', language), description: 'Only JPEG, PNG, WebP, and HEIC images are accepted' });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: 'destructive', title: t('kyc.error', language), description: t('kyc.fileTooLarge', language) });
      return false;
    }
    if (file.size < MIN_FILE_SIZE) {
      toast({ variant: 'destructive', title: t('kyc.error', language), description: t('kyc.fileTooSmall', language) });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user || !docType || !selfieFile || !idFrontFile) {
      toast({ variant: 'destructive', title: t('kyc.error', language), description: 'Please provide all required files' });
      return;
    }
    if (!consentGiven) {
      toast({ variant: 'destructive', title: t('kyc.error', language), description: isHe ? 'יש לאשר את ההסכמה לעיבוד המידע' : 'You must consent to identity verification processing' });
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      formData.append('idFront', idFrontFile);
      if (idBackFile) formData.append('idBack', idBackFile);
      formData.append('documentType', docType);
      formData.append('documentCountry', 'IL');
      formData.append('consentGiven', 'true');

      setUploadProgress(30);

      const res = await fetch('/api/kyc/v2/verify', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      setUploadProgress(80);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Verification failed');
      }

      setUploadProgress(100);
      trackKYCSubmitted(user.uid, docType);
      setKycStatus('pending');
      setStep('submitted');

      toast({ title: t('kyc.success', language), description: t('kyc.successMsg', language) });
    } catch (error: any) {
      logger.error('KYC submit error', error);
      toast({ variant: 'destructive', title: t('kyc.error', language), description: error.message || t('kyc.uploadFailed', language) });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const FileUploadBox = ({
    label, file, onFile, inputRef, testId, accept,
  }: {
    label: string;
    file: File | null;
    onFile: (f: File | null) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    testId: string;
    accept?: string;
  }) => (
    <div
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
        file ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
      }`}
      onClick={() => inputRef.current?.click()}
      data-testid={testId}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept || ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0] || null;
          if (f && validateFile(f)) onFile(f);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-green-700">
          <FileCheck className="w-5 h-5" />
          <span className="text-sm font-medium truncate max-w-[160px]">{file.name}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-gray-400">
          <Upload className="w-6 h-6" />
          <span className="text-xs font-medium">{label}</span>
        </div>
      )}
    </div>
  );

  if (step === 'submitted' || kycStatus === 'pending') {
    return (
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
        <CardContent className="pt-10 pb-10 text-center">
          <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">{isHe ? 'בדיקה בתהליך' : 'Under Review'}</h3>
          <p className="text-gray-600 text-sm">{t('kyc.reviewing', language)}</p>
          <Badge variant="outline" className="mt-4 text-yellow-700 border-yellow-300 bg-yellow-50">
            {isHe ? 'ממתין לאימות' : 'Pending Verification'}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl" dir={isHe ? 'rtl' : 'ltr'}>
          <Shield className="w-5 h-5 text-blue-600" />
          {isHe ? 'אימות זהות — KYC' : 'Identity Verification — KYC'}
        </CardTitle>
        <CardDescription dir={isHe ? 'rtl' : 'ltr'}>
          {isHe ? 'אמת את זהותך כדי לקבל הנחות וגישה מלאה' : 'Verify your identity to unlock discounts and full access'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">

        {/* Step 1: Select document type */}
        <div className="space-y-3">
          <Label className="font-semibold text-gray-800" dir={isHe ? 'rtl' : 'ltr'}>
            {isHe ? 'בחר סוג מסמך' : 'Select Document Type'}
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {DOC_TYPES.map(dt => (
              <div
                key={dt.id}
                onClick={() => setDocType(dt.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  docType === dt.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-white'
                }`}
                dir={isHe ? 'rtl' : 'ltr'}
                data-testid={`doc-type-${dt.id}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${docType === dt.id ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500'}`}>
                  {dt.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{isHe ? dt.labelHe : dt.labelEn}</p>
                  <p className="text-xs text-gray-500">{isHe ? dt.descHe : dt.descEn}</p>
                </div>
                {docType === dt.id && <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Upload files */}
        {docType && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
            <Label className="font-semibold text-gray-800" dir={isHe ? 'rtl' : 'ltr'}>
              {isHe ? 'העלאת קבצים' : 'Upload Files'}
            </Label>

            {/* Selfie */}
            <div className="space-y-1">
              <p className="text-xs text-gray-600 flex items-center gap-1" dir={isHe ? 'rtl' : 'ltr'}>
                <Camera className="w-3 h-3" />
                {isHe ? 'סלפי / תמונת פנים — חובה' : 'Selfie / Face photo — required'}
              </p>
              <FileUploadBox
                label={isHe ? 'צלם סלפי' : 'Take Selfie'}
                file={selfieFile}
                onFile={setSelfieFile}
                inputRef={selfieRef}
                testId="input-kyc-selfie"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>

            {/* ID Front */}
            <div className="space-y-1">
              <p className="text-xs text-gray-600" dir={isHe ? 'rtl' : 'ltr'}>
                {isHe ? 'חזית המסמך — חובה' : 'Document front — required'}
              </p>
              <FileUploadBox
                label={isHe ? 'חזית המסמך' : 'Front of document'}
                file={idFrontFile}
                onFile={setIdFrontFile}
                inputRef={frontRef}
                testId="input-kyc-front"
              />
            </div>

            {/* ID Back (only if needed) */}
            {selectedDoc?.needsBack && (
              <div className="space-y-1">
                <p className="text-xs text-gray-600" dir={isHe ? 'rtl' : 'ltr'}>
                  {isHe ? 'גב המסמך — מומלץ' : 'Document back — recommended'}
                </p>
                <FileUploadBox
                  label={isHe ? 'גב המסמך' : 'Back of document'}
                  file={idBackFile}
                  onFile={setIdBackFile}
                  inputRef={backRef}
                  testId="input-kyc-back"
                />
              </div>
            )}

            {/* Consent checkbox */}
            <div
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${consentGiven ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
              onClick={() => setConsentGiven(v => !v)}
              dir={isHe ? 'rtl' : 'ltr'}
              data-testid="checkbox-consent"
            >
              <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${consentGiven ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                {consentGiven && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <p className="text-xs text-gray-600">
                {isHe
                  ? 'אני מסכים/ה לעיבוד מסמכי הזהות שלי לצורך אימות, בהתאם לחוק הגנת הפרטיות הישראלי 2025.'
                  : 'I consent to the processing of my identity documents for verification, in accordance with Israeli Privacy Law 2025.'}
              </p>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{isHe ? 'מעלה ומנתח...' : 'Uploading & analyzing...'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!selfieFile || !idFrontFile || !consentGiven || uploading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-upload-kyc"
            >
              {uploading ? (isHe ? 'שולח...' : 'Submitting...') : (isHe ? 'שלח לאימות' : 'Submit for Verification')}
            </Button>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs" dir={isHe ? 'rtl' : 'ltr'}>
                {isHe
                  ? 'המסמכים מעובדים אך ורק בזיכרון RAM ואינם נשמרים לאחר האימות. תהליך Zero-Storage מוצפן ומאובטח.'
                  : 'Documents are processed in RAM only and never stored after verification. Zero-storage encrypted pipeline.'}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-white p-4 rounded-lg space-y-2">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm" dir={isHe ? 'rtl' : 'ltr'}>
            <AlertCircle className="w-4 h-4 text-blue-600" />
            {isHe ? 'הנחיות' : 'Guidelines'}
          </h4>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside" dir={isHe ? 'rtl' : 'ltr'}>
            <li>{isHe ? 'תמונה ברורה, מוארת, ללא טשטוש' : 'Clear, well-lit photo with no blur'}</li>
            <li>{isHe ? 'כל פרטי המסמך חייבים להיות גלויים' : 'All document details must be visible'}</li>
            <li>{isHe ? 'אין לצלם מסך — רק מסמך מקורי' : 'Do not photograph a screen — original document only'}</li>
            <li>{isHe ? 'גודל קובץ: 50KB–10MB (JPEG/PNG/WebP/HEIC)' : 'File size: 50KB–10MB (JPEG/PNG/WebP/HEIC)'}</li>
            <li>{isHe ? 'סלפי: פנים מלאות, ישירות אל המצלמה' : 'Selfie: full face, looking directly at camera'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
