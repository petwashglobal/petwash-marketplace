/**
 * Biometric Certificate Upload Component
 * תעודת נכה, גימלאים, תעודת זהות, רשיון נהיגה - Complete Upload Flow
 * 
 * Features:
 * - Multi-file upload (document front, back, selfie)
 * - Real-time camera capture support
 * - Country selection
 * - Document type selection
 * - Progress tracking
 * - Biometric verification result display
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, CheckCircle2, XCircle, AlertCircle, FileText, User } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';

interface UploadedFile {
  file: File | null;
  preview: string | null;
}

interface VerificationResult {
  id: number;
  status: 'approved' | 'pending' | 'rejected' | 'manual_review';
  biometricMatchScore: number;
  message: string;
  requiresManualReview: boolean;
}

export function BiometricCertificateUpload() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  
  const [documentType, setDocumentType] = useState<string>('');
  const [documentCountry, setDocumentCountry] = useState<string>('IL');
  const [documentFront, setDocumentFront] = useState<UploadedFile>({ file: null, preview: null });
  const [documentBack, setDocumentBack] = useState<UploadedFile>({ file: null, preview: null });
  const [selfie, setSelfie] = useState<UploadedFile>({ file: null, preview: null });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Fetch approved countries from API
  const { data: approvedCountriesData, isLoading: loadingCountries } = useQuery({
    queryKey: ['/api/biometric-certificates/approved-countries'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const countries = approvedCountriesData?.countries || [];

  const documentTypes = [
    { value: 'national_id', labelEn: 'National ID Card', labelHe: 'תעודת זהות' },
    { value: 'drivers_license', labelEn: "Driver's License", labelHe: 'רשיון נהיגה' },
    { value: 'disability_certificate', labelEn: 'Disability Certificate', labelHe: 'תעודת נכה' },
    { value: 'retirement_certificate', labelEn: 'Retirement Certificate', labelHe: 'תעודת גימלאי' },
    { value: 'club_membership', labelEn: 'Club Membership', labelHe: 'חברות מועדון' }
  ];

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadedFile>>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('biometric.error'),
        description: t('biometric.imageOnly'),
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('biometric.error'),
        description: t('biometric.fileTooLarge'),
        variant: 'destructive'
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setter({
        file,
        preview: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    // Validation
    if (!documentType) {
      toast({
        title: t('biometric.error'),
        description: t('biometric.selectDocType'),
        variant: 'destructive'
      });
      return;
    }

    if (!documentFront.file || !selfie.file) {
      toast({
        title: t('biometric.error'),
        description: t('biometric.imageOnly'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setVerificationResult(null);

      // Create FormData
      const formData = new FormData();
      formData.append('documentFront', documentFront.file);
      if (documentBack.file) {
        formData.append('documentBack', documentBack.file);
      }
      formData.append('selfie', selfie.file);
      formData.append('documentType', documentType);
      formData.append('documentCountry', documentCountry);

      // Simulate progress (actual upload progress would require XHR)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Upload and verify
      const response = await apiRequest('/api/biometric-certificates/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type with boundary
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success) {
        setVerificationResult(response.verification);
        
        toast({
          title: t('biometric.uploadSuccess'),
          description: response.verification.message
        });
      }

    } catch (error: any) {
      console.error('[BiometricCertificate] Upload failed:', error);
      toast({
        title: t('biometric.error'),
        description: error.message || t('kyc.uploadFailed'),
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setDocumentType('');
    setDocumentCountry('IL');
    setDocumentFront({ file: null, preview: null });
    setDocumentBack({ file: null, preview: null });
    setSelfie({ file: null, preview: null });
    setUploadProgress(0);
    setVerificationResult(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case 'manual_review':
      case 'pending':
        return <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'rejected':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      case 'manual_review':
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      default:
        return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {t('biometric.title')}
          </CardTitle>
          <CardDescription>
            {t('biometric.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="documentType" data-testid="label-document-type">
              {t('biometric.documentType')}
            </Label>
            <Select 
              value={documentType} 
              onValueChange={setDocumentType}
              disabled={uploading}
            >
              <SelectTrigger data-testid="select-document-type">
                <SelectValue placeholder={t('biometric.selectDocTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value} data-testid={`option-doc-type-${type.value}`}>
                    {language === 'he' ? type.labelHe : type.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="documentCountry" data-testid="label-document-country">
              {t('biometric.issuingCountry')}
            </Label>
            <Select 
              value={documentCountry} 
              onValueChange={setDocumentCountry}
              disabled={uploading}
            >
              <SelectTrigger data-testid="select-document-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {loadingCountries ? (
                  <SelectItem value="" disabled>
                    {t('biometric.loading')}
                  </SelectItem>
                ) : (
                  countries.map((country: any) => (
                    <SelectItem key={country.code} value={country.code} data-testid={`option-country-${country.code}`}>
                      {language === 'he' ? country.nameHe : country.nameEn}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Document Front Upload */}
          <div className="space-y-2">
            <Label data-testid="label-upload-front">
              {t('biometric.documentFront')}
            </Label>
            <div className="flex gap-2">
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, setDocumentFront)}
                disabled={uploading}
                className="hidden"
                data-testid="input-file-front"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => frontInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
                data-testid="button-upload-front"
              >
                <FileText className="mr-2 h-4 w-4" />
                {documentFront.file ? t('biometric.uploaded') : t('biometric.uploadPhoto')}
              </Button>
            </div>
            {documentFront.preview && (
              <div className="mt-2">
                <img 
                  src={documentFront.preview} 
                  alt="Document front preview" 
                  className="max-w-xs rounded-lg border"
                  data-testid="preview-front"
                />
              </div>
            )}
          </div>

          {/* Document Back Upload (Optional) */}
          <div className="space-y-2">
            <Label data-testid="label-upload-back">
              {t('biometric.documentBack')}
            </Label>
            <div className="flex gap-2">
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, setDocumentBack)}
                disabled={uploading}
                className="hidden"
                data-testid="input-file-back"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => backInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
                data-testid="button-upload-back"
              >
                <FileText className="mr-2 h-4 w-4" />
                {documentBack.file ? t('biometric.uploaded') : t('biometric.uploadPhoto')}
              </Button>
            </div>
            {documentBack.preview && (
              <div className="mt-2">
                <img 
                  src={documentBack.preview} 
                  alt="Document back preview" 
                  className="max-w-xs rounded-lg border"
                  data-testid="preview-back"
                />
              </div>
            )}
          </div>

          {/* Selfie Upload */}
          <div className="space-y-2">
            <Label data-testid="label-upload-selfie">
              {t('biometric.selfie')}
            </Label>
            <Alert>
              <AlertDescription>
                {t('biometric.selfieAlert')}
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => handleFileSelect(e, setSelfie)}
                disabled={uploading}
                className="hidden"
                data-testid="input-file-selfie"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => selfieInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
                data-testid="button-upload-selfie"
              >
                <User className="mr-2 h-4 w-4" />
                {selfie.file ? t('biometric.uploaded') : t('biometric.takeSelfie')}
              </Button>
            </div>
            {selfie.preview && (
              <div className="mt-2">
                <img 
                  src={selfie.preview} 
                  alt="Selfie preview" 
                  className="max-w-xs rounded-lg border"
                  data-testid="preview-selfie"
                />
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Label>{t('biometric.uploadingVerifying')}</Label>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {uploadProgress}%
              </p>
            </div>
          )}

          {/* Verification Result */}
          {verificationResult && (
            <Alert className={getStatusColor(verificationResult.status)}>
              <div className="flex items-start gap-3">
                {getStatusIcon(verificationResult.status)}
                <div className="flex-1 space-y-2">
                  <AlertDescription className="text-base font-medium">
                    {verificationResult.message}
                  </AlertDescription>
                  {verificationResult.biometricMatchScore > 0 && (
                    <div className="text-sm">
                      {t('biometric.matchScore')}{' '}
                      <span className="font-bold">
                        {verificationResult.biometricMatchScore.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {verificationResult.requiresManualReview && (
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t('biometric.manualReview')}
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={uploading || !documentType || !documentFront.file || !selfie.file}
              className="flex-1"
              data-testid="button-submit"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? t('biometric.uploading') : t('biometric.uploadVerify')}
            </Button>
            {verificationResult && (
              <Button
                variant="outline"
                onClick={resetForm}
                data-testid="button-reset"
              >
                {t('biometric.uploadAnother')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
