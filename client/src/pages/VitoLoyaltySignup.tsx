import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from '@/components/PhoneInput';
import { SecurityCheckpoint } from '@/components/ReCaptcha';
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from '@/lib/apiConfig';
import { Link } from "wouter";
import { Crown, Shield, Star, Sparkles, Upload, FileCheck, ArrowRight, ArrowLeft, Plus, X, Check, Lock, Users, Gift, Calendar, Heart } from "lucide-react";

interface VitoLoyaltySignupProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

interface PetEntry {
  name: string;
  type: string;
  breed: string;
  dob: string;
}

const COUNTRIES = [
  'Israel', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium',
  'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Portugal', 'Greece', 'Ireland', 'Poland', 'Czech Republic', 'Hungary',
  'Romania', 'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia',
  'Latvia', 'Lithuania', 'Cyprus', 'Malta', 'Luxembourg', 'Iceland',
  'Russia', 'Ukraine', 'Turkey', 'Japan', 'South Korea', 'China',
  'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia',
  'South Africa', 'Egypt', 'Morocco', 'Tunisia', 'United Arab Emirates',
  'Saudi Arabia', 'Jordan', 'Thailand', 'Singapore', 'Malaysia',
  'Philippines', 'Indonesia', 'Vietnam', 'New Zealand'
];

const TOTAL_STEPS = 5;

export default function VitoLoyaltySignup({ language, onLanguageChange }: VitoLoyaltySignupProps) {
  const { toast } = useToast();
  const isRTL = language === 'he' || language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');

  const [country, setCountry] = useState('Israel');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  const [pets, setPets] = useState<PetEntry[]>([{ name: '', type: 'Dog', breed: '', dob: '' }]);

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const [referralSource, setReferralSource] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [smsConsent, setSmsConsent] = useState(true);
  const [termsConsent, setTermsConsent] = useState(true);

  const stepLabels = [
    t('vito.sectionPersonal', language),
    t('vito.sectionContact', language),
    t('vito.sectionPets', language),
    t('vito.sectionVerify', language),
    t('vito.sectionPreferences', language),
  ];

  const addPet = () => {
    if (pets.length < 5) {
      setPets([...pets, { name: '', type: 'Dog', breed: '', dob: '' }]);
    }
  };

  const removePet = (index: number) => {
    if (pets.length > 1) {
      setPets(pets.filter((_, i) => i !== index));
    }
  };

  const updatePet = (index: number, field: keyof PetEntry, value: string) => {
    const updated = [...pets];
    updated[index] = { ...updated[index], [field]: value };
    setPets(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 10MB' });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload JPEG, PNG or PDF' });
      return;
    }
    setDocFile(file);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !dob || !gender) {
          toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.sectionPersonal', language) });
          return false;
        }
        const dobDate = new Date(dob);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 13);
        if (dobDate > minAge) {
          toast({ variant: 'destructive', title: t('vito.required', language), description: 'Must be at least 13 years old' });
          return false;
        }
        return true;
      case 2:
        return true;
      case 3:
        for (const pet of pets) {
          if (!pet.name.trim() || !pet.type) {
            toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.sectionPets', language) });
            return false;
          }
        }
        return true;
      case 4:
        return true;
      case 5:
        if (!termsConsent) {
          toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.termsConsent', language) });
          return false;
        }
        if (!captchaToken) {
          toast({ variant: 'destructive', title: t('vito.required', language), description: 'Security verification required' });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('email', email.trim());
      formData.append('phone', phone.trim());
      formData.append('dob', dob);
      formData.append('gender', gender);
      formData.append('country', country);
      formData.append('city', city.trim());
      formData.append('address', address);
      formData.append('pets', JSON.stringify(pets));
      formData.append('docType', docType);
      formData.append('docNumber', docNumber.trim());
      if (docFile) formData.append('docPhoto', docFile);
      formData.append('referralSource', referralSource);
      formData.append('referralCode', referralCode.trim());
      formData.append('marketingConsent', String(marketingConsent));
      formData.append('smsConsent', String(smsConsent));
      formData.append('termsConsent', String(termsConsent));
      formData.append('language', language);
      if (captchaToken) formData.append('captchaToken', captchaToken);

      const response = await fetch(getApiUrl('/api/vito/register'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = t('vito.stepOf', language)
    .replace('{current}', String(currentStep))
    .replace('{total}', String(TOTAL_STEPS));

  if (submitted) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
        <div className="min-h-screen luxury-bg-mesh" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="luxury-glass-card luxury-shadow-xl p-8 sm:p-12 text-center space-y-6"
              style={{ borderRadius: '2px' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E6A3)' }}
              >
                <Crown className="w-10 h-10 text-white" />
              </motion.div>

              <div className="space-y-8">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [-20, -60, -120, -180],
                      x: [0, (Math.random() - 0.5) * 100],
                    }}
                    transition={{
                      duration: 2,
                      delay: 0.5 + Math.random() * 1.5,
                      ease: 'easeOut',
                    }}
                    className="absolute text-2xl pointer-events-none"
                    style={{
                      left: `${10 + Math.random() * 80}%`,
                      top: '50%',
                    }}
                  >
                    {['✨', '🎉', '⭐', '🌟', '💫', '🎊'][Math.floor(Math.random() * 6)]}
                  </motion.div>
                ))}
              </div>

              <h1 className="luxury-heading-xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('vito.successTitle', language)}
              </h1>
              <p className="text-gray-600 text-lg">
                {t('vito.successMessage', language)}
              </p>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Lock className="w-4 h-4" />
                <span>{t('vito.secureNote', language)}</span>
              </div>

              <Link href="/login">
                <Button className="luxury-btn-primary mt-4" style={{ borderRadius: '2px' }} data-testid="button-go-to-login">
                  {t('vito.signInHere', language)}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen luxury-bg-mesh" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6 mb-10"
          >
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E6A3)' }}
              >
                <Crown className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="luxury-heading-xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('vito.heroTitle', language)}
            </h1>
            <p className="text-gray-600 text-lg max-w-xl mx-auto" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('vito.heroSubtitle', language)}
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <span
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F5E6A3)',
                  color: '#1a1a1a',
                  borderRadius: '2px',
                }}
                data-testid="badge-free-exclusive"
              >
                <Sparkles className="w-4 h-4" />
                {t('vito.freeExclusive', language)}
              </span>
              <span
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-800 text-gray-800"
                style={{ borderRadius: '2px' }}
                data-testid="badge-verified"
              >
                <Shield className="w-4 h-4" />
                {t('vito.verifiedBadge', language)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mt-6">
              {[
                { icon: <Star className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit1', language) },
                { icon: <Gift className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit2', language) },
                { icon: <Calendar className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit3', language) },
                { icon: <Heart className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit4', language) },
                { icon: <Users className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit5', language) },
                { icon: <Sparkles className="w-5 h-5" style={{ color: '#D4AF37' }} />, text: t('vito.benefit6', language) },
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="p-3 border border-gray-100 bg-white/80 text-center space-y-2"
                  style={{ borderRadius: '2px' }}
                  data-testid={`benefit-card-${i + 1}`}
                >
                  <div className="flex justify-center">{benefit.icon}</div>
                  <p className="text-xs text-gray-700 leading-snug">{benefit.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{t('vito.memberCount', language)}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="luxury-glass-card luxury-shadow-xl p-6 sm:p-8 space-y-6"
            style={{ borderRadius: '2px' }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{stepIndicator}</span>
                <span className="text-sm font-medium" style={{ color: '#D4AF37' }}>
                  {stepLabels[currentStep - 1]}
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 transition-all duration-300"
                    style={{
                      borderRadius: '2px',
                      background: i < currentStep
                        ? 'linear-gradient(135deg, #D4AF37, #F5E6A3)'
                        : '#e5e7eb',
                    }}
                    data-testid={`progress-step-${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: isRTL ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vito-firstName" className="text-gray-700 font-medium">
                          {t('vito.firstName', language)} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="vito-firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="luxury-glass-minimal"
                          style={{ borderRadius: '2px' }}
                          data-testid="input-vito-firstName"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vito-lastName" className="text-gray-700 font-medium">
                          {t('vito.lastName', language)} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="vito-lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="luxury-glass-minimal"
                          style={{ borderRadius: '2px' }}
                          data-testid="input-vito-lastName"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="vito-email" className="text-gray-700 font-medium">
                        {t('vito.email', language)} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="vito-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="luxury-glass-minimal"
                        style={{ borderRadius: '2px' }}
                        data-testid="input-vito-email"
                      />
                    </div>

                    <div>
                      <Label className="text-gray-700 font-medium">
                        {t('vito.phone', language)} <span className="text-red-500">*</span>
                      </Label>
                      <PhoneInput
                        value={phone}
                        onChange={setPhone}
                        language={language}
                        defaultCountryCode="+972"
                      />
                    </div>

                    <div data-testid="input-vito-dob">
                      <NativeDateSelect
                        value={dob}
                        onChange={setDob}
                        label={`${t('vito.dob', language)} *`}
                        language={language}
                        minYear={new Date().getFullYear() - 120}
                        maxYear={new Date().getFullYear() - 13}
                      />
                    </div>

                    <div>
                      <Label className="text-gray-700 font-medium">
                        {t('vito.gender', language)} <span className="text-red-500">*</span>
                      </Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="h-10 mt-1" style={{ borderRadius: '2px' }} data-testid="select-vito-gender">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t('vito.genderMale', language)}</SelectItem>
                          <SelectItem value="female">{t('vito.genderFemale', language)}</SelectItem>
                          <SelectItem value="other">{t('vito.genderOther', language)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 font-medium">{t('vito.country', language)}</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="h-10 mt-1" style={{ borderRadius: '2px' }} data-testid="select-vito-country">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {COUNTRIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="vito-city" className="text-gray-700 font-medium">{t('vito.city', language)}</Label>
                      <Input
                        id="vito-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="luxury-glass-minimal"
                        style={{ borderRadius: '2px' }}
                        data-testid="input-vito-city"
                      />
                    </div>

                    <div>
                      <GooglePlacesAutocomplete
                        value={address}
                        onChange={(val) => setAddress(val)}
                        label={`${t('vito.address', language)} (${t('vito.optional', language)})`}
                        placeholder={t('vito.address', language)}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    {pets.map((pet, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border border-gray-100 space-y-3 relative"
                        style={{ borderRadius: '2px', background: 'rgba(255,255,255,0.7)' }}
                        data-testid={`pet-entry-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">
                            {t('vito.sectionPets', language)} #{index + 1}
                          </span>
                          {pets.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePet(index)}
                              className="text-red-500 hover:text-red-700 h-8"
                              style={{ borderRadius: '2px' }}
                              data-testid={`button-remove-pet-${index}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {t('vito.removePet', language)}
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-gray-700 text-sm">
                              {t('vito.petName', language)} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={pet.name}
                              onChange={(e) => updatePet(index, 'name', e.target.value)}
                              required
                              className="luxury-glass-minimal"
                              style={{ borderRadius: '2px' }}
                              data-testid={`input-pet-name-${index}`}
                            />
                          </div>
                          <div>
                            <Label className="text-gray-700 text-sm">
                              {t('vito.petType', language)} <span className="text-red-500">*</span>
                            </Label>
                            <Select value={pet.type} onValueChange={(val) => updatePet(index, 'type', val)}>
                              <SelectTrigger className="h-10 mt-1" style={{ borderRadius: '2px' }} data-testid={`select-pet-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Dog">{t('vito.petDog', language)}</SelectItem>
                                <SelectItem value="Cat">{t('vito.petCat', language)}</SelectItem>
                                <SelectItem value="Other">{t('vito.petOther', language)}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-gray-700 text-sm">
                            {t('vito.petBreed', language)} ({t('vito.optional', language)})
                          </Label>
                          <Input
                            value={pet.breed}
                            onChange={(e) => updatePet(index, 'breed', e.target.value)}
                            className="luxury-glass-minimal"
                            style={{ borderRadius: '2px' }}
                            data-testid={`input-pet-breed-${index}`}
                          />
                        </div>

                        <div data-testid={`input-pet-dob-${index}`}>
                          <NativeDateSelect
                            value={pet.dob}
                            onChange={(val) => updatePet(index, 'dob', val)}
                            label={`${t('vito.petDob', language)} (${t('vito.optional', language)})`}
                            language={language}
                            minYear={new Date().getFullYear() - 30}
                            maxYear={new Date().getFullYear()}
                          />
                        </div>
                      </motion.div>
                    ))}

                    {pets.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addPet}
                        className="w-full border-dashed"
                        style={{ borderRadius: '2px', borderColor: '#D4AF37', color: '#D4AF37' }}
                        data-testid="button-add-pet"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('vito.addAnotherPet', language)}
                      </Button>
                    )}
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div
                      className="p-4 border text-center space-y-2"
                      style={{
                        borderRadius: '2px',
                        background: 'linear-gradient(135deg, rgba(212,175,55,0.05), rgba(245,230,163,0.1))',
                        borderColor: '#D4AF37',
                      }}
                    >
                      <Shield className="w-8 h-8 mx-auto" style={{ color: '#D4AF37' }} />
                      <h3 className="font-semibold text-gray-800" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        {t('vito.idVerification', language)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {t('vito.idDescription', language)}
                      </p>
                    </div>

                    <div>
                      <Label className="text-gray-700 font-medium">{t('vito.idType', language)}</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="h-10 mt-1" style={{ borderRadius: '2px' }} data-testid="select-vito-docType">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="driving_license">{t('vito.idDriverLicense', language)}</SelectItem>
                          <SelectItem value="national_id">{t('vito.idNationalId', language)}</SelectItem>
                          <SelectItem value="passport">{t('vito.idPassport', language)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="vito-docNumber" className="text-gray-700 font-medium">{t('vito.idNumber', language)}</Label>
                      <Input
                        id="vito-docNumber"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        className="luxury-glass-minimal"
                        style={{ borderRadius: '2px' }}
                        data-testid="input-vito-docNumber"
                      />
                    </div>

                    <div>
                      <Label className="text-gray-700 font-medium">{t('vito.idUpload', language)}</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="input-vito-docFile"
                      />
                      <div
                        className="mt-1 border-2 border-dashed p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderRadius: '2px', borderColor: docFile ? '#D4AF37' : '#d1d5db' }}
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-upload-doc"
                      >
                        {docFile ? (
                          <div className="flex items-center justify-center gap-2 text-sm">
                            <FileCheck className="w-5 h-5" style={{ color: '#D4AF37' }} />
                            <span className="text-gray-700">{t('vito.fileSelected', language)}: {docFile.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              style={{ borderRadius: '2px' }}
                              data-testid="button-change-file"
                            >
                              {t('vito.changeFile', language)}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 mx-auto text-gray-400" />
                            <p className="text-sm text-gray-500">{t('vito.chooseFile', language)}</p>
                            <p className="text-xs text-gray-400">{t('vito.idUploadHint', language)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-700 font-medium">{t('vito.referralSource', language)}</Label>
                      <Select value={referralSource} onValueChange={setReferralSource}>
                        <SelectTrigger className="h-10 mt-1" style={{ borderRadius: '2px' }} data-testid="select-vito-referralSource">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="friend">{t('vito.referralFriend', language)}</SelectItem>
                          <SelectItem value="social">{t('vito.referralSocial', language)}</SelectItem>
                          <SelectItem value="search">{t('vito.referralSearch', language)}</SelectItem>
                          <SelectItem value="ad">{t('vito.referralAd', language)}</SelectItem>
                          <SelectItem value="station">{t('vito.referralStation', language)}</SelectItem>
                          <SelectItem value="other">{t('vito.referralOther', language)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="vito-referralCode" className="text-gray-700 font-medium">
                        {t('vito.referralCode', language)}
                      </Label>
                      <Input
                        id="vito-referralCode"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="luxury-glass-minimal"
                        style={{ borderRadius: '2px' }}
                        data-testid="input-vito-referralCode"
                      />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="vito-marketing"
                          checked={marketingConsent}
                          onCheckedChange={(checked) => setMarketingConsent(!!checked)}
                          data-testid="checkbox-vito-marketing"
                        />
                        <Label htmlFor="vito-marketing" className="text-sm text-gray-600 cursor-pointer leading-snug">
                          {t('vito.marketingConsent', language)}
                        </Label>
                      </div>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="vito-sms"
                          checked={smsConsent}
                          onCheckedChange={(checked) => setSmsConsent(!!checked)}
                          data-testid="checkbox-vito-sms"
                        />
                        <Label htmlFor="vito-sms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                          {t('vito.smsConsent', language)}
                        </Label>
                      </div>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="vito-terms"
                          checked={termsConsent}
                          onCheckedChange={(checked) => setTermsConsent(!!checked)}
                          data-testid="checkbox-vito-terms"
                        />
                        <Label htmlFor="vito-terms" className="text-sm text-gray-600 cursor-pointer leading-snug">
                          {t('vito.termsConsent', language)} <span className="text-red-500">*</span>
                        </Label>
                      </div>
                    </div>

                    <div className="pt-4">
                      <SecurityCheckpoint
                        onVerified={(token) => setCaptchaToken(token)}
                        language={language}
                        action="vito_register"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between pt-4 border-t">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="flex items-center gap-2"
                  style={{ borderRadius: '2px' }}
                  data-testid="button-vito-back"
                >
                  {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {t('vito.back', language)}
                </Button>
              ) : (
                <div />
              )}

              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="luxury-btn-primary flex items-center gap-2"
                  style={{ borderRadius: '2px' }}
                  data-testid="button-vito-next"
                >
                  {t('vito.next', language)}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="luxury-btn-primary flex items-center gap-2"
                  style={{ borderRadius: '2px' }}
                  data-testid="button-vito-submit"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </motion.div>
                      {t('vito.submitting', language)}
                    </span>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      {t('vito.submitApplication', language)}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
              <Lock className="w-3 h-3" />
              <span>{t('vito.secureNote', language)}</span>
            </div>

            <div className="text-center text-sm text-gray-500 pt-2">
              {t('vito.alreadyMember', language)}{' '}
              <Link href="/login" className="underline font-medium" style={{ color: '#D4AF37' }} data-testid="link-vito-login">
                {t('vito.signInHere', language)}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
