import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Shield, Eye, EyeOff, Upload, Calendar } from 'lucide-react';
import { getApiUrl } from '@/lib/apiConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { SecurityCheckpoint } from '@/components/ReCaptcha';

interface AppleStyleRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onRegistrationComplete?: (user: any) => void;
}

interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  country: string;
  gender: string;
  profilePicture?: File;
  idDocument?: File;
  petType: string;
  isClubMember: boolean;
  wantsReminders: boolean;
  wantsMarketing: boolean;
  acceptsTerms: boolean;
  acceptsPrivacy: boolean;
  wantsVerification: boolean; // For senior/disability discount verification
}


const COUNTRY_DATA = [
  { code: 'IL', names: { en: 'Israel', he: 'ישראל', ar: 'إسرائيل', ru: 'Израиль', fr: 'Israël', es: 'Israel' } },
  { code: 'US', names: { en: 'United States', he: 'ארצות הברית', ar: 'الولايات المتحدة', ru: 'США', fr: 'États-Unis', es: 'Estados Unidos' } },
  { code: 'CA', names: { en: 'Canada', he: 'קנדה', ar: 'كندا', ru: 'Канада', fr: 'Canada', es: 'Canadá' } },
  { code: 'GB', names: { en: 'United Kingdom', he: 'בריטניה', ar: 'المملكة المتحدة', ru: 'Великобритания', fr: 'Royaume-Uni', es: 'Reino Unido' } },
  { code: 'AU', names: { en: 'Australia', he: 'אוסטרליה', ar: 'أستراليا', ru: 'Австралия', fr: 'Australie', es: 'Australia' } },
  { code: 'FR', names: { en: 'France', he: 'צרפת', ar: 'فرنسا', ru: 'Франция', fr: 'France', es: 'Francia' } },
  { code: 'DE', names: { en: 'Germany', he: 'גרמניה', ar: 'ألمانيا', ru: 'Германия', fr: 'Allemagne', es: 'Alemania' } },
  { code: 'JP', names: { en: 'Japan', he: 'יפן', ar: 'اليابان', ru: 'Япония', fr: 'Japon', es: 'Japón' } },
  { code: 'KR', names: { en: 'South Korea', he: 'דרום קוריאה', ar: 'كوريا الجنوبية', ru: 'Южная Корея', fr: 'Corée du Sud', es: 'Corea del Sur' } },
  { code: 'CN', names: { en: 'China', he: 'סין', ar: 'الصين', ru: 'Китай', fr: 'Chine', es: 'China' } },
  { code: 'OTHER', names: { en: 'Other', he: 'אחר', ar: 'أخرى', ru: 'Другое', fr: 'Autre', es: 'Otro' } },
];

const GENDER_DATA = [
  { value: 'unspecified', names: { en: 'Prefer not to say', he: 'מעדיף/ה לא לציין', ar: 'أفضل عدم القول', ru: 'Не хочу указывать', fr: 'Préfère ne pas dire', es: 'Prefiero no decir' } },
  { value: 'male', names: { en: 'Male', he: 'זכר', ar: 'ذكر', ru: 'Мужской', fr: 'Homme', es: 'Masculino' } },
  { value: 'female', names: { en: 'Female', he: 'נקבה', ar: 'أنثى', ru: 'Женский', fr: 'Femme', es: 'Femenino' } },
  { value: 'other', names: { en: 'Other', he: 'אחר', ar: 'أخرى', ru: 'Другое', fr: 'Autre', es: 'Otro' } },
];

const PET_TYPE_DATA = [
  { value: 'dog', names: { en: 'Dog', he: 'כלב', ar: 'كلب', ru: 'Собака', fr: 'Chien', es: 'Perro' } },
  { value: 'cat', names: { en: 'Cat', he: 'חתול', ar: 'قطة', ru: 'Кошка', fr: 'Chat', es: 'Gato' } },
  { value: 'both', names: { en: 'Both', he: 'שניהם', ar: 'كلاهما', ru: 'Оба', fr: 'Les deux', es: 'Ambos' } },
  { value: 'other', names: { en: 'Other', he: 'אחר', ar: 'أخرى', ru: 'Другое', fr: 'Autre', es: 'Otro' } },
];

export function AppleStyleRegistration({ isOpen, onClose, language, onRegistrationComplete }: AppleStyleRegistrationProps) {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    country: 'IL',
    gender: '',
    petType: 'dog',
    isClubMember: true, // Pre-checked for loyalty benefits
    wantsReminders: true, // Pre-checked for service reminders
    wantsMarketing: false, // Not pre-checked per privacy law
    acceptsTerms: false, // Must be manually checked
    acceptsPrivacy: false, // Must be manually checked
    wantsVerification: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  
  const { toast } = useToast();
  // CRITICAL: No RTL layout changes - Hebrew mode only changes text content

  const registrationMutation = useMutation({
    mutationFn: async (data: RegistrationData) => {
      const formDataToSend = new FormData();
      
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'dateOfBirth') {
          formDataToSend.append('dateOfBirth', String(value));
        } else if (key === 'profilePicture' && value) {
          formDataToSend.append('profilePicture', value);
        } else if (key === 'idDocument' && value) {
          formDataToSend.append('idDocument', value);
        } else if (typeof value !== 'object') {
          formDataToSend.append(key, String(value));
        }
      });

      if (captchaToken) {
        formDataToSend.append('captchaToken', captchaToken);
      }

      const response = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        body: formDataToSend,
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('registration.successTitle', language),
        description: t('registration.successDescription', language),
      });
      
      if (onRegistrationComplete) {
        onRegistrationComplete(data);
      }
      onClose();
    },
    onError: (error) => {
      toast({
        title: t('registration.failedTitle', language),
        description: t('registration.failedDescription', language),
        variant: "destructive",
      });
    },
  });

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, profilePicture: file }));
      const reader = new FileReader();
      reader.onload = (e) => setProfilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!captchaToken) {
      toast({
        title: language === 'he' ? 'נדרש אימות אבטחה' : 'Security verification required',
        description: language === 'he' ? 'אנא השלם את אימות האבטחה לפני ההרשמה' : 'Please complete the security verification before registering',
        variant: "destructive",
      });
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      toast({
        title: t('registration.missingInfoTitle', language),
        description: t('registration.missingInfoDescription', language),
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('registration.passwordMismatchTitle', language),
        description: t('registration.passwordMismatchDescription', language),
        variant: "destructive",
      });
      return;
    }

    if (!formData.acceptsTerms || !formData.acceptsPrivacy) {
      toast({
        title: t('registration.termsRequiredTitle', language),
        description: t('registration.termsRequiredDescription', language),
        variant: "destructive",
      });
      return;
    }

    registrationMutation.mutate(formData);
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl ltr">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-black" />
              <h1 className="text-2xl font-bold text-black">
                {t('registration.title', language)}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label={t('registration.close', language)}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Profile Picture */}
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-gray-400" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-full cursor-pointer hover:bg-gray-800 transition-colors">
                <Upload className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {t('registration.addProfilePic', language)}
            </p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">
                {t('registration.firstName', language)} *
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="text-lg p-3 mt-1"
                placeholder={t('registration.firstNamePlaceholder', language)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">
                {t('registration.lastName', language)} *
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="text-lg p-3 mt-1"
                placeholder={t('registration.lastNamePlaceholder', language)}
                required
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">{t('registration.emailAddress', language)} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="text-lg p-3 mt-1"
                placeholder={t('registration.emailPlaceholder', language)}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">{t('registration.phoneNumber', language)} *</Label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                language={language === 'he' ? 'he' : 'en'}
                defaultCountryCode="+972"
              />
            </div>
          </div>

          {/* Password Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">{t('registration.password', language)} *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="text-lg p-3 mt-1 pr-12"
                  placeholder={t('registration.passwordPlaceholder', language)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t('registration.confirmPassword', language)} *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="text-lg p-3 mt-1 pr-12"
                  placeholder={t('registration.confirmPasswordPlaceholder', language)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <NativeDateSelect
            value={formData.dateOfBirth}
            onChange={(date) => setFormData(prev => ({ ...prev, dateOfBirth: date }))}
            label={t('registration.dateOfBirth', language)}
            language={language}
            minYear={1940}
            maxYear={new Date().getFullYear() - 13}
          />

          <div>
            <Label>{t('registration.country', language)}</Label>
            <Select value={formData.country} onValueChange={(val) => setFormData(prev => ({ ...prev, country: val }))}>
              <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="--" /></SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {COUNTRY_DATA.map(c => (
                  <SelectItem key={c.code} value={c.code}>{(c.names as Record<string, string>)[language] || c.names.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('registration.gender', language)}</Label>
            <Select value={formData.gender} onValueChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}>
              <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="--" /></SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {GENDER_DATA.map(g => (
                  <SelectItem key={g.value} value={g.value}>{(g.names as Record<string, string>)[language] || g.names.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('registration.petType', language)}</Label>
            <Select value={formData.petType} onValueChange={(val) => setFormData(prev => ({ ...prev, petType: val }))}>
              <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="--" /></SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {PET_TYPE_DATA.map(p => (
                  <SelectItem key={p.value} value={p.value}>{(p.names as Record<string, string>)[language] || p.names.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ID Upload Section - Only visible if verification requested */}
          {formData.wantsVerification && (
            <div className="space-y-4 bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <h3 className="font-semibold text-blue-900">
                {t('registration.idVerification', language)}
              </h3>
              <p className="text-sm text-blue-800">
                {t('registration.seniorDiscountInfo', language)}
              </p>
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormData(prev => ({ ...prev, idDocument: file }));
                    }
                  }}
                  className="hidden"
                  id="idUpload"
                />
                <label htmlFor="idUpload" className="cursor-pointer">
                  <Upload className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-900">
                    {t('registration.uploadID', language)}
                  </p>
                  <p className="text-xs text-blue-600">
                    {t('registration.fileTypes', language)}
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Preferences - Pre-checked legal options */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="clubMember"
                checked={formData.isClubMember}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isClubMember: !!checked }))}
              />
              <Label htmlFor="clubMember" className="text-sm">
                {t('registration.loyaltyBenefits', language)}
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="reminders"
                checked={formData.wantsReminders}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, wantsReminders: !!checked }))}
              />
              <Label htmlFor="reminders" className="text-sm">
                {t('registration.serviceReminders', language)}
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="marketing"
                checked={formData.wantsMarketing}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, wantsMarketing: !!checked }))}
              />
              <Label htmlFor="marketing" className="text-sm">
                {t('registration.marketingConsent', language)}
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="verification"
                checked={formData.wantsVerification}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, wantsVerification: !!checked }))}
              />
              <div>
                <Label htmlFor="verification" className="text-sm font-medium">
                  {t('registration.seniorDiscountInfo', language)}
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  {t('registration.seniorDiscountInfo', language)}
                </p>
              </div>
            </div>
          </div>

          {/* Required Legal Checkboxes */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={formData.acceptsTerms}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptsTerms: !!checked }))}
                required
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed">
                {t('registration.termsConsent', language)} {t('registration.termsLink', language)} *
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="privacy"
                checked={formData.acceptsPrivacy}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptsPrivacy: !!checked }))}
                required
              />
              <Label htmlFor="privacy" className="text-sm leading-relaxed">
                {t('registration.termsConsent', language)} {t('registration.privacyLink', language)} *
              </Label>
            </div>
          </div>

          {/* Security Checkpoint */}
          <div className="pt-2">
            <SecurityCheckpoint
              onVerified={(token) => setCaptchaToken(token)}
              onFailed={() => setCaptchaToken(null)}
              language={language}
              action="register"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={registrationMutation.isPending || !captchaToken}
            className="w-full bg-black text-white hover:bg-gray-800 py-4 text-xl font-semibold rounded-xl transition-colors shadow-lg"
          >
            {registrationMutation.isPending
              ? t('registration.creatingAccount', language)
              : t('registration.joinClub', language)
            }
          </Button>

          {/* Footer Note */}
          <div className="text-center text-sm text-gray-500">
            <p>
              {t('registration.loyaltyBenefits', language)}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}