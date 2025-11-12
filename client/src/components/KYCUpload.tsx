import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileCheck, AlertCircle, CheckCircle2, Clock, XCircle, Shield } from 'lucide-react';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";
import { trackKYCSubmitted } from '@/lib/analytics';

interface KYCUploadProps {
  language: Language;
}

type KYCType = 'senior' | 'disability';
type KYCStatus = 'pending' | 'approved' | 'rejected' | 'expired' | null;

export function KYCUpload({ language }: KYCUploadProps) {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  
  const [kycType, setKycType] = useState<KYCType>('senior');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [kycStatus, setKycStatus] = useState<KYCStatus>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  const reqList = [
    t('kyc.req1', language),
    t('kyc.req2', language),
    t('kyc.req3', language),
    t('kyc.req4', language),
    t('kyc.req5', language),
  ];

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const minSize = 50 * 1024; // 50KB

    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: t('kyc.error', language),
        description: t('kyc.unsupportedType', language)
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: t('kyc.error', language),
        description: t('kyc.fileTooLarge', language)
      });
      return false;
    }

    if (file.size < minSize) {
      toast({
        variant: "destructive",
        title: t('kyc.error', language),
        description: t('kyc.fileTooSmall', language)
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) {
      toast({
        variant: "destructive",
        title: t('kyc.error', language),
        description: t('kyc.fileRequired', language)
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `users/${user.uid}/kyc/${kycType}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          logger.error('Upload error', error);
          toast({
            variant: "destructive",
            title: t('kyc.error', language),
            description: t('kyc.uploadFailed', language)
          });
          setUploading(false);
        },
        async () => {
          // Upload complete
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          logger.info('File uploaded', { downloadURL });

          // Create KYC document in Firestore
          await setDoc(doc(db, 'users', user.uid), {
            kyc: {
              type: kycType,
              status: 'pending',
              submittedAt: new Date(),
              reviewedAt: null,
              reviewerUid: null,
              docPaths: [fileName],
              idHash: '', // Will be filled by server
              expiresAt: null,
              notes: ''
            }
          }, { merge: true });

          // Track KYC submission in GA4
          trackKYCSubmitted(user.uid, kycType);

          setKycStatus('pending');
          setFile(null);
          setUploadProgress(0);
          setUploading(false);

          toast({
            title: t('kyc.success', language),
            description: t('kyc.successMsg', language)
          });
        }
      );
    } catch (error) {
      logger.error('Upload error', error);
      toast({
        variant: "destructive",
        title: t('kyc.error', language),
        description: t('kyc.uploadFailed', language)
      });
      setUploading(false);
    }
  };

  const getStatusIcon = () => {
    switch (kycStatus) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Upload className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (kycStatus) {
      case 'pending': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'approved': return 'bg-green-50 border-green-200 text-green-800';
      case 'rejected': return 'bg-red-50 border-red-200 text-red-800';
      case 'expired': return 'bg-orange-50 border-orange-200 text-orange-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Shield className="w-5 h-5 text-blue-600" />
          {t('kyc.title', language)}
        </CardTitle>
        <CardDescription>{t('kyc.description', language)}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Current Status */}
        {kycStatus && (
          <Alert className={`${getStatusColor()} border`}>
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <h4 className="font-semibold mb-1">{t('kyc.status', language)}: {t(`kyc.${kycStatus}`, language)}</h4>
                {kycStatus === 'pending' && <AlertDescription>{t('kyc.reviewing', language)}</AlertDescription>}
                {kycStatus === 'approved' && <AlertDescription>{t('kyc.approvedMsg', language)}</AlertDescription>}
                {kycStatus === 'rejected' && (
                  <AlertDescription>
                    {t('kyc.rejectedMsg', language)}
                    {rejectionReason && <div className="mt-2"><strong>{t('kyc.reason', language)}:</strong> {rejectionReason}</div>}
                  </AlertDescription>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Upload Form */}
        {(!kycStatus || kycStatus === 'rejected' || kycStatus === 'expired') && (
          <>
            <div className="space-y-3">
              <Label>{t('kyc.selectType', language)}</Label>
              <RadioGroup value={kycType} onValueChange={(value) => setKycType(value as KYCType)}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="senior" id="senior" />
                  <Label htmlFor="senior" className="flex-1 cursor-pointer">{t('kyc.senior', language)}</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="disability" id="disability" />
                  <Label htmlFor="disability" className="flex-1 cursor-pointer">{t('kyc.disability', language)}</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>{t('kyc.uploadDoc', language)}</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="flex-1"
                  data-testid="input-kyc-file"
                />
                {file && <FileCheck className="w-5 h-5 text-green-600" />}
              </div>
              {file && (
                <p className="text-sm text-gray-600">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{t('kyc.uploading', language)}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-upload-kyc"
            >
              {uploading ? t('kyc.uploading', language) : t('kyc.uploadBtn', language)}
            </Button>

            {/* Guidelines */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t('kyc.guidelines', language)}
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                {reqList.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
              <p className="text-xs text-blue-700 mt-3">{t('kyc.guidelineText', language)}</p>
              <p className="text-xs text-blue-600">{t('kyc.privacyNote', language)}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
