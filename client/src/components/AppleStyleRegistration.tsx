import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Shield, Eye, EyeOff, Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

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
  dateOfBirth: {
    day: string;
    month: string;
    year: string;
  };
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

const countries = [
  { code: 'IL', name: 'Israel', nameHe: 'ישראל' },
  { code: 'US', name: 'United States', nameHe: 'ארצות הברית' },
  { code: 'CA', name: 'Canada', nameHe: 'קנדה' },
  { code: 'GB', name: 'United Kingdom', nameHe: 'בריטניה' },
  { code: 'FR', name: 'France', nameHe: 'צרפת' },
  { code: 'DE', name: 'Germany', nameHe: 'גרמניה' },
  { code: 'AU', name: 'Other', nameHe: 'אחר' },
  { code: 'JP', name: 'Japan', nameHe: 'יפן' },
  { code: 'KR', name: 'South Korea', nameHe: 'דרום קוריאה' },
  { code: 'CN', name: 'China', nameHe: 'סין' },
];

const months = [
  { value: '01', en: 'January', he: 'ינואר' },
  { value: '02', en: 'February', he: 'פברואר' },
  { value: '03', en: 'March', he: 'מרץ' },
  { value: '04', en: 'April', he: 'אפריל' },
  { value: '05', en: 'May', he: 'מאי' },
  { value: '06', en: 'June', he: 'יוני' },
  { value: '07', en: 'July', he: 'יולי' },
  { value: '08', en: 'August', he: 'אוגוסט' },
  { value: '09', en: 'September', he: 'ספטמבר' },
  { value: '10', en: 'October', he: 'אוקטובר' },
  { value: '11', en: 'November', he: 'נובמבר' },
  { value: '12', en: 'December', he: 'דצמבר' },
];

const petTypes = [
  { value: 'dog', en: 'Dog', he: 'כלב' },
  { value: 'cat', en: 'Cat', he: 'חתול' },
  { value: 'both', en: 'Both', he: 'שניהם' },
  { value: 'other', en: 'Other', he: 'אחר' },
];

export function AppleStyleRegistration({ isOpen, onClose, language, onRegistrationComplete }: AppleStyleRegistrationProps) {
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: { day: '', month: '', year: '' },
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
      
      // Add all form fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'dateOfBirth') {
          formDataToSend.append('dateOfBirth', `${value.year}-${value.month}-${value.day}`);
        } else if (key === 'profilePicture' && value) {
          formDataToSend.append('profilePicture', value);
        } else if (key === 'idDocument' && value) {
          formDataToSend.append('idDocument', value);
        } else if (typeof value !== 'object') {
          formDataToSend.append(key, String(value));
        }
      });

      const response = await fetch('/api/auth/register', {
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

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 80 }, (_, i) => String(2025 - i));

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
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="text-lg p-3 mt-1"
                placeholder={t('registration.phonePlaceholder', language)}
                required
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

          {/* Apple-Style Date of Birth Selectors */}
          <div>
            <Label>{t('registration.dateOfBirth', language)}</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <Label className="text-sm text-gray-600">{t('registration.day', language)}</Label>
                <select
                  value={formData.dateOfBirth.day}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dateOfBirth: { ...prev.dateOfBirth, day: e.target.value }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white"
                >
                  <option value="">{t('registration.day', language)}</option>
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label className="text-sm text-gray-600">{t('registration.month', language)}</Label>
                <select
                  value={formData.dateOfBirth.month}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dateOfBirth: { ...prev.dateOfBirth, month: e.target.value }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white"
                >
                  <option value="">{t('registration.month', language)}</option>
                  {months.map(month => (
                    <option key={month.value} value={month.value}>
                      {language === 'en' ? month.en : month.he}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label className="text-sm text-gray-600">{t('registration.year', language)}</Label>
                <select
                  value={formData.dateOfBirth.year}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dateOfBirth: { ...prev.dateOfBirth, year: e.target.value }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white"
                >
                  <option value="">{t('registration.year', language)}</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Country Selector */}
          <div>
            <Label>{t('registration.country', language)}</Label>
            <select
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white mt-2"
            >
              {countries.map(country => (
                <option key={country.code} value={country.code}>
                  {language === 'en' ? country.name : country.nameHe}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Selector */}
          <div>
            <Label>{t('registration.gender', language)}</Label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white mt-2"
            >
              <option value="">{t('registration.genderPreferNot', language)}</option>
              <option value="male">{t('registration.genderMale', language)}</option>
              <option value="female">{t('registration.genderFemale', language)}</option>
              <option value="other">{t('registration.genderOther', language)}</option>
            </select>
          </div>

          {/* Pet Type */}
          <div>
            <Label>{t('registration.petType', language)}</Label>
            <select
              value={formData.petType}
              onChange={(e) => setFormData(prev => ({ ...prev, petType: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg bg-white mt-2"
            >
              {petTypes.map(pet => (
                <option key={pet.value} value={pet.value}>
                  {language === 'en' ? pet.en : pet.he}
                </option>
              ))}
            </select>
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

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={registrationMutation.isPending}
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