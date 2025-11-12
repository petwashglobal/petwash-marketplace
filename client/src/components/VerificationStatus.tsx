import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { t, type Language } from '@/lib/i18n';
import { logger } from "@/lib/logger";

interface VerificationData {
  senior: boolean;
  disability: boolean;
  seniorPending?: boolean;
  disabilityPending?: boolean;
}

interface VerificationStatusProps {
  uid: string;
  language: Language;
}

export function VerificationStatus({ uid, language }: VerificationStatusProps) {
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const { toast } = useToast();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    loadVerificationStatus();
  }, [uid]);

  const loadVerificationStatus = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid, 'profile', 'data'));
      const data = userDoc.data() || {};
      setVerificationData({
        senior: !!data.seniorVerified,
        disability: !!data.disabilityVerified,
        seniorPending: !!data.seniorPending,
        disabilityPending: !!data.disabilityPending,
      });
    } catch (error) {
      logger.error('Error loading verification status', error);
    }
  };

  const startUpload = async (type: 'senior' | 'disability', file: File) => {
    // Validate file size (10 MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t('verify.fileTooLarge', language),
        description: t('verify.fileSizeLimit', language),
        variant: 'destructive',
      });
      return;
    }

    // iOS Safari fallback: if file.type is empty, set default based on extension
    let contentType = file.type;
    if (!contentType || contentType === '') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        contentType = 'application/pdf';
      } else if (ext === 'jpg' || ext === 'jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === 'png') {
        contentType = 'image/png';
      } else {
        contentType = 'image/jpeg'; // Default fallback for iOS camera
      }
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(contentType)) {
      toast({
        title: t('verify.invalidFile', language),
        description: t('verify.invalidFileDesc', language),
        variant: 'destructive',
      });
      return;
    }

    setBusy(true);
    setUploadProgress(0);

    try {
      // Upload to Firebase Storage with resumable upload
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const storageRef = ref(storage, `users/${uid}/kyc/${type}-${timestamp}.${ext}`);
      
      // Use uploadBytesResumable for progress tracking and better iOS Safari support
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: contentType,
        customMetadata: {
          uploadedBy: uid,
          uploadType: type,
          uploadTimestamp: timestamp.toString()
        }
      });

      // Track upload progress
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
            
            // Track progress events for analytics
            if (progress === 100) {
              trackEvent({
                action: 'verification_upload_complete',
                category: 'user_verification',
                label: type,
                language,
              });
            }
          },
          (error) => {
            logger.error('Upload error', error);
            trackEvent({
              action: 'verification_upload_error',
              category: 'user_verification',
              label: `${type}_${error.code}`,
              language,
            });
            reject(error);
          },
          () => {
            resolve();
          }
        );
      });

      // Get download URL
      const url = await getDownloadURL(storageRef);

      // Update Firestore with document URL and pending status
      const submittedAt = new Date().toISOString();
      await setDoc(doc(db, 'users', uid, 'profile', 'data'), {
        [`${type}DocUrl`]: url,
        [`${type}Pending`]: true,
        [`${type}SubmittedAt`]: submittedAt,
        [`${type}DocType`]: contentType,
      }, { merge: true });

      // Track analytics event
      trackEvent({
        action: 'verification_upload_success',
        category: 'user_verification',
        label: type,
        language,
      });

      // Show success message
      toast({
        title: t('verify.uploadSuccess', language),
        description: t('verify.uploadSuccessDesc', language),
      });

      // Reload verification status
      await loadVerificationStatus();
    } catch (error) {
      logger.error('Upload error', error);
      
      // Track error for telemetry
      trackEvent({
        action: 'verification_upload_failed',
        category: 'user_verification',
        label: type,
        language,
      });

      toast({
        title: t('verify.uploadError', language),
        description: t('verify.uploadErrorDesc', language),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  const getStatusBadge = (verified: boolean, pending?: boolean) => {
    if (verified) {
      return (
        <div className="flex flex-col items-end gap-1">
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('verify.verified', language)}
          </Badge>
        </div>
      );
    }
    if (pending) {
      return (
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            {t('verify.underReview', language)}
          </Badge>
          <span className="text-xs text-gray-500">{t('verify.reviewETA', language)}</span>
        </div>
      );
    }
    return (
      <Badge variant="secondary">
        {t('verify.notVerified', language)}
      </Badge>
    );
  };

  if (!verificationData) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      <VerificationRow
        label={t('verify.seniorDiscount', language)}
        badge={getStatusBadge(verificationData.senior, verificationData.seniorPending)}
        showUpload={!verificationData.senior && !verificationData.seniorPending}
        onUpload={(file) => startUpload('senior', file)}
        disabled={busy}
        uploadLabel={t('verify.uploadId', language)}
        uploadingLabel={t('verify.uploading', language)}
        language={language}
        progress={uploadProgress}
      />
      <VerificationRow
        label={t('verify.disabilityDiscount', language)}
        badge={getStatusBadge(verificationData.disability, verificationData.disabilityPending)}
        showUpload={!verificationData.disability && !verificationData.disabilityPending}
        onUpload={(file) => startUpload('disability', file)}
        disabled={busy}
        uploadLabel={t('verify.uploadId', language)}
        uploadingLabel={t('verify.uploading', language)}
        language={language}
        progress={uploadProgress}
      />
    </div>
  );
}

interface VerificationRowProps {
  label: string;
  badge: React.ReactNode;
  showUpload: boolean;
  onUpload: (file: File) => void;
  disabled: boolean;
  uploadLabel: string;
  uploadingLabel: string;
  language: Language;
  progress?: number;
}

function VerificationRow({
  label,
  badge,
  showUpload,
  onUpload,
  disabled,
  uploadLabel,
  uploadingLabel,
  language,
  progress = 0,
}: VerificationRowProps) {
  const inputId = `verification-upload-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-gray-600 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {badge}
        {showUpload && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <input
                id={inputId}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
                data-testid={`input-${inputId}`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={uploadLabel}
                disabled={disabled}
                onClick={() => document.getElementById(inputId)?.click()}
                data-testid={`button-${inputId}`}
              >
                <Upload className="w-3 h-3 mr-1" />
                {disabled ? uploadingLabel : uploadLabel}
              </Button>
            </div>
            {disabled && progress > 0 && (
              <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
