import { useState, useRef, useCallback, useEffect } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Globe,
  Camera,
  X,
  Image as ImageIcon,
  Sparkles,
  Lock,
  Award,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Language } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';
import { logger } from '@/lib/logger';

interface KYCStatus {
  status: string | null;
  type?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

const TRUSTED_COUNTRIES = [
  { code: 'IL', name: 'Israel (ישראל)' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'ES', name: 'Spain (España)' },
  { code: 'PT', name: 'Portugal' },
];

const DOCUMENT_TYPES = {
  national_id: { 
    icon: '🪪',
    countries: ['IL'],
  },
  disability: {
    icon: '♿',
    countries: ['IL'],
  },
  senior: {
    icon: '👴',
    countries: ['IL'],
  },
  passport: {
    icon: '🛂',
    countries: ['all'],
  },
  drivers_license: {
    icon: '🚗',
    countries: ['all'],
  },
  residence_permit: {
    icon: '📄',
    countries: ['all'],
  },
};

export default function Verify() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { trackEvent } = useAnalytics();
  const [language, setLanguage] = useState<Language>((localStorage.getItem('petwash_lang') as Language) || 'he');
  const isHebrew = language === 'he';

  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string>('IL');
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [nameOnDoc, setNameOnDoc] = useState('');
  const [dob, setDob] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    title: isHebrew ? 'אימות מסמך זהות' : 'Identity Verification',
    subtitle: isHebrew ? 'אמת את זהותך והפוך לחבר VIP מאומת' : 'Verify Your Identity & Become a Verified VIP Member',
    selectCountry: isHebrew ? 'בחר מדינה' : 'Select Country',
    selectDocType: isHebrew ? 'סוג מסמך' : 'Document Type',
    uploadDoc: isHebrew ? 'העלה מסמך' : 'Upload Document',
    dragDrop: isHebrew ? 'גרור ושחרר קובץ כאן' : 'Drag & drop your file here',
    or: isHebrew ? 'או' : 'or',
    clickUpload: isHebrew ? 'לחץ להעלאה' : 'Click to upload',
    maxSize: isHebrew ? 'גודל מקסימלי: 10MB' : 'Maximum size: 10MB',
    formats: isHebrew ? 'פורמטים נתמכים: JPEG, PNG, PDF' : 'Supported formats: JPEG, PNG, PDF',
    nameOnDoc: isHebrew ? 'שם כפי שמופיע במסמך' : 'Name on Document',
    dob: isHebrew ? 'תאריך לידה' : 'Date of Birth',
    idNumber: isHebrew ? 'מספר תעודה (אופציונלי)' : 'Document Number (Optional)',
    submit: isHebrew ? 'שלח לאימות' : 'Submit for Verification',
    processing: isHebrew ? 'מעבד...' : 'Processing...',
    pending: isHebrew ? 'בבדיקה' : 'Under Review',
    approved: isHebrew ? 'מאושר ✓' : 'Approved ✓',
    rejected: isHebrew ? 'נדחה' : 'Rejected',
    benefits: isHebrew ? 'הטבות חברים מאומתים' : 'Verified Member Benefits',
    discount: isHebrew ? 'הנחה על כל השטיפות' : 'Discount on all washes',
    priority: isHebrew ? 'תמיכה עדיפה' : 'Priority support',
    exclusive: isHebrew ? 'גישה להטבות בלעדיות' : 'Access to exclusive perks',
    trustedOnly: isHebrew ? 'זמין רק למדינות מהימנות' : 'Available for trusted countries only',
    documentTypes: {
      national_id: isHebrew ? 'תעודת זהות ישראלית' : 'Israeli National ID',
      disability: isHebrew ? 'תעודת נכה' : 'Disability Certificate',
      senior: isHebrew ? 'תעודת פנסיונרים' : 'Senior Certificate',
      passport: isHebrew ? 'דרכון' : 'Passport',
      drivers_license: isHebrew ? 'רישיון נהיגה' : 'Driver\'s License',
      residence_permit: isHebrew ? 'רישיון שהייה' : 'Residence Permit',
    } as Record<string, string>,
  };

  // Fetch KYC status on load
  useEffect(() => {
    const fetchStatus = async () => {
      if (!firebaseUser?.uid) {
        setStatusLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/kyc/status/${firebaseUser.uid}`);
        if (response.ok) {
          const data = await response.json();
          setKycStatus(data);
        }
      } catch (error) {
        logger.error('Error fetching KYC status', error);
      } finally {
        setStatusLoading(false);
      }
    };

    fetchStatus();
  }, [firebaseUser?.uid]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError('');
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(isHebrew ? 'סוג קובץ לא נתמך' : 'Unsupported file type');
      return;
    }

    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError(isHebrew ? 'הקובץ גדול מדי (מקסימום 10MB)' : 'File too large (max 10MB)');
      return;
    }

    const minSize = 50 * 1024; // 50KB
    if (selectedFile.size < minSize) {
      setError(isHebrew ? 'הקובץ קטן מדי (מינימום 50KB)' : 'File too small (min 50KB)');
      return;
    }

    setFile(selectedFile);

    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(''); // PDF
    }
  }, [isHebrew]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!file || !selectedDocType || !firebaseUser) {
      setError(isHebrew ? 'אנא מלא את כל השדות' : 'Please fill all required fields');
      return;
    }

    setError('');
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uid', firebaseUser.uid);
      formData.append('type', selectedDocType);
      formData.append('countryCode', selectedCountry);
      if (nameOnDoc) formData.append('nameOnDoc', nameOnDoc);
      if (dob) formData.append('dob', dob);
      if (idNumber) formData.append('idNumber', idNumber);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/kyc/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      setSuccess(isHebrew ? 'המסמך הועלה בהצלחה! צוות שלנו יבדוק אותו בקרוב.' : 'Document uploaded successfully! Our team will review it soon.');
      
      // Track event
      trackEvent({
        action: 'kyc_document_uploaded',
        category: 'verification',
        label: selectedDocType,
        userId: firebaseUser.uid,
        language,
      });

      // Reset form
      setTimeout(() => {
        setFile(null);
        setPreview('');
        setSelectedDocType('');
        setNameOnDoc('');
        setDob('');
        setIdNumber('');
        setKycStatus({ status: 'pending' });
      }, 2000);
    } catch (error: any) {
      logger.error('KYC upload error', error);
      setError(error.message || (isHebrew ? 'שגיאה בהעלאת המסמך' : 'Error uploading document'));
    } finally {
      setUploading(false);
    }
  };

  const availableDocTypes = Object.entries(DOCUMENT_TYPES).filter(([key, value]) => {
    if (value.countries.includes('all')) return true;
    return value.countries.includes(selectedCountry);
  });

  if (authLoading || statusLoading) {
    return (
      <Layout language={language} onLanguageChange={setLanguage}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
              <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <p className="text-lg text-purple-200">{isHebrew ? 'טוען...' : 'Loading...'}</p>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="container max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6, delay: 0.1 }}
              className="w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center luxury-shadow-xl"
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="luxury-heading-xl mb-4">
              {t.title}
            </h1>
            <p className="text-xl text-gray-600 font-light">{t.subtitle}</p>
          </motion.div>

          {/* Status Display */}
          {kycStatus && kycStatus.status && (
            <motion.div 
              className="max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Alert className={`${
                kycStatus.status === 'approved' ? 'bg-green-500/20 border-green-400/50' :
                kycStatus.status === 'rejected' ? 'bg-red-500/20 border-red-400/50' :
                'bg-yellow-500/20 border-yellow-400/50'
              } backdrop-blur-xl`}>
                <div className="flex items-center gap-3">
                  {kycStatus.status === 'approved' && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                  {kycStatus.status === 'rejected' && <AlertCircle className="w-6 h-6 text-red-400" />}
                  {kycStatus.status === 'pending' && <Clock className="w-6 h-6 text-yellow-400 animate-pulse" />}
                  <AlertDescription className="text-white text-lg">
                    {kycStatus.status === 'approved' && t.approved}
                    {kycStatus.status === 'rejected' && `${t.rejected}: ${kycStatus.rejectionReason}`}
                    {kycStatus.status === 'pending' && t.pending}
                  </AlertDescription>
                </div>
              </Alert>
            </motion.div>
          )}

          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Upload Card */}
            <motion.div 
              className="md:col-span-2"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="luxury-glass-card luxury-shadow-xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-400/30">
                    <Upload className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="luxury-heading-md">{t.uploadDoc}</h2>
                </div>

                <div className="space-y-6">
                  {/* Country Selection */}
                  <div>
                    <Label className="text-white mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {t.selectCountry}
                    </Label>
                    <Select value={selectedCountry} onValueChange={(value) => {
                      setSelectedCountry(value);
                      setSelectedDocType('');
                    }}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRUSTED_COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Document Type Selection */}
                  <div>
                    <Label className="text-white mb-2 flex items-center gap-2">
                      <FileCheck className="w-4 h-4" />
                      {t.selectDocType}
                    </Label>
                    <Select value={selectedDocType} onValueChange={setSelectedDocType} disabled={!selectedCountry}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder={isHebrew ? 'בחר סוג מסמך' : 'Select document type'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDocTypes.map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span>{value.icon}</span>
                              <span>{t.documentTypes[key]}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* File Upload Area */}
                  <div>
                    <Label className="text-white mb-2">{t.uploadDoc}</Label>
                    <div
                      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                        isDragging
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        className="hidden"
                      />

                      {!file ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="mb-4">
                            {isDragging ? (
                              <ImageIcon className="w-16 h-16 mx-auto text-cyan-400 animate-bounce" />
                            ) : (
                              <Camera className="w-16 h-16 mx-auto text-purple-300" />
                            )}
                          </div>
                          <p className="text-white text-lg mb-2">{t.dragDrop}</p>
                          <p className="text-purple-300 mb-4">{t.or}</p>
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {t.clickUpload}
                          </Button>
                          <div className="mt-4 space-y-1 text-sm text-purple-300">
                            <p>{t.maxSize}</p>
                            <p>{t.formats}</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative"
                        >
                          {preview ? (
                            <div className="relative">
                              <img
                                src={preview}
                                alt="Preview"
                                className="max-h-64 mx-auto rounded-lg shadow-lg"
                              />
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-2 right-2 rounded-full"
                                onClick={() => {
                                  setFile(null);
                                  setPreview('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-white/10 p-4 rounded-lg">
                              <div className="flex items-center gap-3">
                                <FileCheck className="w-8 h-8 text-green-400" />
                                <div className="text-left">
                                  <p className="text-white font-semibold">{file.name}</p>
                                  <p className="text-sm text-purple-300">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => {
                                  setFile(null);
                                  setPreview('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Additional Fields */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 font-medium">{t.nameOnDoc}</Label>
                      <Input
                        value={nameOnDoc}
                        onChange={(e) => setNameOnDoc(e.target.value)}
                        className="luxury-glass-minimal"
                        placeholder={isHebrew ? 'שם מלא' : 'Full name'}
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 font-medium">{t.dob}</Label>
                        <DatePicker
                          value={dob}
                          onChange={setDob}
                          placeholder={t.dob}
                          className="luxury-glass-minimal"
                          testId="input-dob-verify"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700 font-medium">{t.idNumber}</Label>
                        <Input
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          className="luxury-glass-minimal"
                          placeholder={isHebrew ? 'אופציונלי' : 'Optional'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error/Success Messages */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Alert className="bg-red-500/20 border-red-400/50">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                    {success && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Alert className="bg-green-500/20 border-green-400/50">
                          <CheckCircle2 className="w-4 h-4" />
                          <AlertDescription>{success}</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Upload Progress */}
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-center text-purple-200 mt-2">{uploadProgress}%</p>
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!file || !selectedDocType || uploading}
                    className="luxury-btn-primary luxury-shadow-xl w-full h-14 text-lg font-medium"
                  >
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        {t.processing}
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 mr-2" />
                        {t.submit}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Benefits Sidebar */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {/* Benefits Card */}
              <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30">
                    <Award className="w-6 h-6 text-purple-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{t.benefits}</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: <Sparkles className="w-5 h-5" />, text: t.discount },
                    { icon: <Lock className="w-5 h-5" />, text: t.priority },
                    { icon: <Award className="w-5 h-5" />, text: t.exclusive },
                  ].map((benefit, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                    >
                      <div className="text-purple-300">{benefit.icon}</div>
                      <span className="text-white">{benefit.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Trusted Countries Info */}
              <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-400/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-cyan-300" />
                  <h3 className="font-semibold text-white">{t.trustedOnly}</h3>
                </div>
                <p className="text-sm text-cyan-200/80">
                  {TRUSTED_COUNTRIES.map(c => c.name).join(', ')}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 20px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 20s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </Layout>
  );
}
