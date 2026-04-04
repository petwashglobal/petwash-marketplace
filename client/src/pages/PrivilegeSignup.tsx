import { useState, useRef, useEffect } from "react";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createGoogleProvider, getAuthStrategy } from "@/lib/iosAuthHandler";
import { useFirebaseAuth } from "@/auth/AuthProvider";
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
import { executeReCaptcha } from '@/components/ReCaptcha';
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from '@/lib/apiConfig';
import { Link } from "wouter";
import { SiGoogle } from "react-icons/si";
import {
  Crown, Shield, Star, Sparkles, Upload, FileCheck, ArrowRight, ArrowLeft,
  Plus, X, Check, Lock, Users, Gift, Calendar, Heart, Zap, TrendingUp,
  Award, Diamond, Globe, Clock, MapPin, Briefcase, ChevronDown, Activity,
  Dog, Cat, Gem, Trophy, Wallet, CreditCard, QrCode, Loader2
} from "lucide-react";

interface PrivilegeSignupProps {
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

const TIER_DATA = [
  { id: 'bronze', label: 'Bronze', points: '0', color: '#8E9EA8', bg: 'from-slate-400/10 to-slate-300/5' },
  { id: 'silver', label: 'Silver', points: '1,000', color: '#B0BEC5', bg: 'from-slate-300/10 to-slate-200/5' },
  { id: 'gold', label: 'Gold', points: '5,000', color: '#C5BFA0', bg: 'from-stone-300/10 to-stone-200/5' },
  { id: 'platinum', label: 'Platinum', points: '15,000', color: '#A8C0CC', bg: 'from-cyan-200/10 to-sky-200/5' },
  { id: 'diamond', label: 'Diamond', points: '30,000', color: '#7BC4D4', bg: 'from-cyan-400/10 to-teal-300/5' },
  { id: 'royal_black', label: 'Royal Black', points: '50,000', color: '#2E3A4A', bg: 'from-gray-800/10 to-gray-700/5' },
  { id: 'crown', label: 'Crown', points: '100,000', color: '#85C4CE', bg: 'from-teal-300/10 to-cyan-200/5' },
];

const PLATFORMS = [
  { name: '⁦K9000™⁩', icon: '🚿' },
  { name: '⁦Sitter Suite™⁩', icon: '🏠' },
  { name: '⁦Walk My Pet™⁩', icon: '🚶' },
  { name: '⁦PetTrek™⁩', icon: '🚗' },
  { name: 'Academy™', icon: '🎓' },
  { name: '⁦The Plush Lab™⁩', icon: '🧸' },
  { name: '⁦Wash Hub™⁩', icon: '💎' },
];

const gold = '#85C4CE';

export default function PrivilegeSignup({ language, onLanguageChange }: PrivilegeSignupProps) {
  const { toast } = useToast();
  const isRTL = language === 'he' || language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const { user } = useFirebaseAuth();
  const [showForm, setShowForm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeActivityIndex, setActiveActivityIndex] = useState(0);
  const [animatedStats, setAnimatedStats] = useState({ members: 0, providers: 0, services: 0 });

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
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const provider = createGoogleProvider();
      const strategy = getAuthStrategy();
      if (strategy === 'redirect') {
        // iPhone Safari: popup windows are blocked — use redirect flow instead
        await signInWithRedirect(auth, provider);
        // Page will reload; result is handled by getRedirectResult in useEffect below
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: language === 'he' ? 'שגיאת התחברות' : 'Sign-in failed',
          description: err?.message || (language === 'he' ? 'אנא נסה שוב' : 'Please try again'),
        });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Google redirect result (iPhone Safari returns here after sign-in)
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        const displayName = result.user.displayName || '';
        const nameParts = displayName.trim().split(' ');
        if (nameParts[0]) setFirstName(nameParts[0]);
        if (nameParts.slice(1).join(' ')) setLastName(nameParts.slice(1).join(' '));
        if (result.user.email) setEmail(result.user.email);
        setShowForm(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      const displayName = user.displayName || '';
      const nameParts = displayName.trim().split(' ');
      if (nameParts[0]) setFirstName(nameParts[0]);
      if (nameParts.slice(1).join(' ')) setLastName(nameParts.slice(1).join(' '));
      if (user.email) setEmail(user.email);
      setShowForm(true);
      if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast({
        title: language === 'he' ? 'ברוך הבא!' : 'Welcome!',
        description: language === 'he'
          ? `שלום ${nameParts[0] || ''}, פרטיך מולאו אוטומטית`
          : `Hi ${nameParts[0] || ''}, your details have been pre-filled`,
      });
    }
  }, [user]);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const targets = { members: 10247, providers: 342, services: 87500 };
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats({
        members: Math.floor(targets.members * ease),
        providers: Math.floor(targets.providers * ease),
        services: Math.floor(targets.services * ease),
      });
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveActivityIndex(prev => (prev + 1) % 5), 3000);
    return () => clearInterval(interval);
  }, []);

  const stepLabels = [
    t('privilege.sectionPersonal', language),
    t('privilege.sectionContact', language),
    t('privilege.sectionPets', language),
    t('privilege.sectionVerify', language),
    t('privilege.sectionPreferences', language),
  ];

  const addPet = () => { if (pets.length < 5) setPets([...pets, { name: '', type: 'Dog', breed: '', dob: '' }]); };
  const removePet = (index: number) => { if (pets.length > 1) setPets(pets.filter((_, i) => i !== index)); };
  const updatePet = (index: number, field: keyof PetEntry, value: string) => {
    const updated = [...pets];
    updated[index] = { ...updated[index], [field]: value };
    setPets(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 10MB' }); return; }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload JPEG, PNG or PDF' }); return; }
    setDocFile(file);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !dob || !gender) {
          toast({ variant: 'destructive', title: t('privilege.required', language), description: t('privilege.sectionPersonal', language) });
          return false;
        }
        const dobDate = new Date(dob);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 13);
        if (dobDate > minAge) { toast({ variant: 'destructive', title: t('privilege.required', language), description: 'Must be at least 13 years old' }); return false; }
        return true;
      case 2: return true;
      case 3:
        for (const pet of pets) {
          if (!pet.name.trim() || !pet.type) { toast({ variant: 'destructive', title: t('privilege.required', language), description: t('privilege.sectionPets', language) }); return false; }
        }
        return true;
      case 4: return true;
      case 5:
        if (!termsConsent) { toast({ variant: 'destructive', title: t('privilege.required', language), description: t('privilege.termsConsent', language) }); return false; }
        return true;
      default: return true;
    }
  };

  const nextStep = () => { if (validateStep(currentStep) && currentStep < TOTAL_STEPS) { setCurrentStep(currentStep + 1); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  const prevStep = () => { if (currentStep > 1) { setCurrentStep(currentStep - 1); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    const traceId = 'PRIV-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Privilege Registration Trace]', { traceId, timestamp: new Date().toISOString() });
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
      formData.append('idType', docType);
      formData.append('idNumber', docNumber.trim());
      if (docFile) formData.append('idDocument', docFile);
      formData.append('referralSource', referralSource);
      formData.append('referralCode', referralCode.trim());
      formData.append('marketingConsent', String(marketingConsent));
      formData.append('smsConsent', String(smsConsent));
      formData.append('termsConsent', String(termsConsent));
      formData.append('language', language);
      // reCAPTCHA: non-blocking — if script fails (Safari ITP, ad-blockers, slow network)
      // we still allow submission. Server logs the missing token and soft-fails.
      let freshCaptchaToken: string | null = null;
      try {
        freshCaptchaToken = await executeReCaptcha('privilege_register');
      } catch {
        freshCaptchaToken = null;
      }
      formData.append('captchaToken', freshCaptchaToken ?? 'captcha_unavailable');
      formData.append('traceId', traceId);

      // AbortController: 45-second hard timeout prevents silent hangs on slow networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      let response: Response;
      try {
        response = await fetch(getApiUrl('/api/privilege/register'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('[Privilege Registration Trace] Failed', { traceId, error: error?.message });
      const isTimeout = error?.name === 'AbortError';
      toast({
        variant: 'destructive',
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: isTimeout
          ? (language === 'he' ? 'הבקשה לקחה יותר מדי זמן. בדוק חיבור לאינטרנט ונסה שוב.' : 'The request timed out. Check your internet connection and try again.')
          : (error.message || (language === 'he' ? 'משהו השתבש' : 'Something went wrong')),
      });
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = t('privilege.stepOf', language).replace('{current}', String(currentStep)).replace('{total}', String(TOTAL_STEPS));

  if (submitted) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
        <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, type: 'spring' }} className="text-center space-y-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="w-28 h-28 mx-auto flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #d4af37 50%, #b8941f 100%)', borderRadius: '2px' }}
              >
                <Crown className="w-14 h-14 text-white" />
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('privilege.successTitle', language)}
              </h1>
              <p className="text-gray-500 text-lg max-w-md mx-auto">{t('privilege.successMessage', language)}</p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Shield className="w-4 h-4" /><span>{t('privilege.secureNote', language)}</span>
              </div>
              <Link href="/login">
                <Button className="mt-4 px-8 py-3 text-white font-bold" style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)' }}>
                  {t('privilege.signInHere', language)}
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
      <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* HERO - Clean white with floating privilege card */}
        <section className="relative overflow-hidden bg-white pt-16 sm:pt-24 pb-20 sm:pb-28">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center space-y-8">
              <p className="text-sm uppercase tracking-[0.3em] font-medium text-gray-400">{t('privilege.heroTagline', language)}</p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('privilege.heroTitle', language)}
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('privilege.heroSubtitle', language)}
              </p>

              {/* Floating Privilege Card - Dark metallic on white */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="relative mx-auto max-w-sm p-6 text-white overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at 10% -10%, rgba(255,255,255,0.24), transparent 55%), radial-gradient(circle at 95% 110%, rgba(133,196,206,0.15), transparent 55%), linear-gradient(135deg, #05070a, #121b2a 60%, #1a2e3a 100%)',
                  borderRadius: '2px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.12)'
                }}
              >
                <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full blur-3xl" style={{ background: `${gold}08` }} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-[11px] tracking-[0.2em] uppercase text-white/50">⁦Pet Wash™⁩</div>
                      <div className="text-[10px] tracking-[0.15em] uppercase mt-0.5" style={{ color: gold }}>PRIVILEGE CARD</div>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center" style={{ background: `${gold}15`, borderRadius: '2px' }}>
                      <Crown className="w-4 h-4" style={{ color: gold }} />
                    </div>
                  </div>
                  <div className="text-4xl font-bold mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    ₪325
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/80" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                      Signature Member
                    </span>
                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider" style={{ background: `${gold}15`, color: gold, borderRadius: '2px' }}>
                      7 stamps
                    </span>
                  </div>
                  <Button className="w-full text-sm font-bold text-black" style={{ borderRadius: '2px', background: 'white' }}>
                    {t('privilege.submitApplication', language)}
                  </Button>
                </div>
              </motion.div>

              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white" style={{ background: 'linear-gradient(90deg, #c9a96e, #d4af37)', borderRadius: '2px' }}>
                  <Sparkles className="w-4 h-4" style={{ color: gold }} />{t('privilege.freeExclusive', language)}
                </span>
                <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200" style={{ borderRadius: '2px' }}>
                  <Shield className="w-4 h-4" style={{ color: gold }} />{t('privilege.verifiedBadge', language)}
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* PRIVILEGES UNLOCKED - Like the mockup */}
        <section className="bg-white border-t border-gray-100 py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {t('privilege.benefitsTitle', language)}
            </h2>
            <div className="space-y-3">
              {[
                { icon: <Star className="w-5 h-5" />, text: t('privilege.benefit1', language) },
                { icon: <Gift className="w-5 h-5" />, text: t('privilege.benefit2', language) },
                { icon: <Calendar className="w-5 h-5" />, text: t('privilege.benefit3', language) },
                { icon: <Heart className="w-5 h-5" />, text: t('privilege.benefit4', language) },
                { icon: <Users className="w-5 h-5" />, text: t('privilege.benefit5', language) },
                { icon: <Sparkles className="w-5 h-5" />, text: t('privilege.benefit6', language) },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between p-4 bg-white hover:bg-white transition-colors cursor-default group"
                  style={{ borderRadius: '2px' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-white shadow-sm" style={{ borderRadius: '2px', color: gold }}>{item.icon}</div>
                    <span className="text-sm font-medium text-gray-700">{item.text}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-300 ${isRTL ? 'rotate-90' : '-rotate-90'}`} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* LIVE STATS */}
        <section className="bg-white py-14 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 text-center">
              {[
                { value: animatedStats.members.toLocaleString(), label: t('privilege.statsMembers', language), icon: <Users className="w-5 h-5" /> },
                { value: animatedStats.providers.toLocaleString(), label: t('privilege.statsProviders', language), icon: <Briefcase className="w-5 h-5" /> },
                { value: animatedStats.services.toLocaleString(), label: t('privilege.statsServices', language), icon: <Activity className="w-5 h-5" /> },
                { value: '12', label: t('privilege.statsCountries', language), icon: <Globe className="w-5 h-5" /> },
                { value: '4.9', label: t('privilege.statsRating', language), icon: <Star className="w-5 h-5" /> },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <div className="flex justify-center mb-3 text-gray-300">{stat.icon}</div>
                  <div className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{stat.value}</div>
                  <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TIMELINE - Activity feed */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="space-y-5">
                <p className="text-sm uppercase tracking-[0.2em] font-medium text-gray-400">{t('privilege.clubStory', language)}</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>PetWash Privilege</h2>
                <p className="text-gray-500 text-lg leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('privilege.clubStoryText', language)}
                </p>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[
                    { icon: <Heart className="w-5 h-5" />, label: t('privilege.benefit4', language) },
                    { icon: <Shield className="w-5 h-5" />, label: t('privilege.benefit5', language) },
                    { icon: <Zap className="w-5 h-5" />, label: t('privilege.benefit6', language) },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-3 bg-white shadow-sm" style={{ borderRadius: '2px' }}>
                      <div className="flex justify-center mb-2" style={{ color: gold }}>{item.icon}</div>
                      <p className="text-[11px] text-gray-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Timeline card */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white p-6 shadow-lg shadow-gray-100/80" style={{ borderRadius: '2px', border: '1px solid #f0f0f0' }}>
                <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>Timeline</h3>
                <p className="text-xs text-gray-400 mb-5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />{t('privilege.recentActivity', language)}</p>
                <div className="space-y-0">
                  {[
                    { text: t('privilege.activity1', language), amount: '+200', time: '12:03', icon: <CreditCard className="w-4 h-4" /> },
                    { text: t('privilege.activity2', language), amount: '-₪55', time: '1m ago', icon: <QrCode className="w-4 h-4" /> },
                    { text: t('privilege.activity3', language), amount: '+300', time: '2m ago', icon: <Wallet className="w-4 h-4" /> },
                    { text: t('privilege.activity4', language), amount: '+578', time: '5m ago', icon: <Gift className="w-4 h-4" /> },
                    { text: t('privilege.activity5', language), amount: '+100', time: '8m ago', icon: <Star className="w-4 h-4" /> },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: i === activeActivityIndex ? 1 : 0.5 }}
                      transition={{ duration: 0.4 }}
                      className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center bg-white text-gray-400" style={{ borderRadius: '2px' }}>{item.icon}</div>
                        <div>
                          <p className="text-sm text-gray-700">{item.text}</p>
                          <p className="text-[11px] text-gray-400">{item.time}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${item.amount.startsWith('-') ? 'text-red-500' : 'text-green-600'}`}>{item.amount}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 7-STAR TIER SYSTEM */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
              <p className="text-sm uppercase tracking-[0.2em] font-medium text-gray-400 mb-3">{t('privilege.tierPreviewTitle', language)}</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>7-Star Loyalty System</h2>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {TIER_DATA.map((tier, i) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="bg-white p-4 text-center shadow-sm hover:shadow-md transition-all cursor-default"
                  style={{ borderRadius: '2px', borderBottom: `3px solid ${tier.color}` }}
                >
                  <div className="w-8 h-8 mx-auto mb-3 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <div className="w-5 h-5 rounded-full" style={{ background: tier.color, boxShadow: `0 0 12px ${tier.color}30` }} />
                  </div>
                  <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">{tier.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{tier.points} pts</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PROVIDERS & PLATFORMS */}
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
              <p className="text-sm uppercase tracking-[0.2em] font-medium text-gray-400 mb-3">{t('privilege.providersTitle', language)}</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('privilege.platformsTitle', language)}
              </h2>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              {[
                { label: t('privilege.providerSitters', language), count: '120+', icon: <Heart className="w-5 h-5" /> },
                { label: t('privilege.providerWalkers', language), count: '85+', icon: <MapPin className="w-5 h-5" /> },
                { label: t('privilege.providerGroomers', language), count: '45+', icon: <Sparkles className="w-5 h-5" /> },
                { label: t('privilege.providerDrivers', language), count: '30+', icon: <TrendingUp className="w-5 h-5" /> },
                { label: t('privilege.providerVets', language), count: '25+', icon: <Shield className="w-5 h-5" /> },
                { label: t('privilege.providerTrainers', language), count: '37+', icon: <Award className="w-5 h-5" /> },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white p-5 text-center hover:bg-white transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  <div className="mb-3" style={{ color: gold }}>{p.icon}</div>
                  <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{p.count}</p>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{p.label}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((platform, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm bg-white shadow-sm hover:shadow-md transition-shadow"
                  style={{ borderRadius: '2px', border: '1px solid #f0f0f0' }}
                >
                  <span className="text-lg">{platform.icon}</span>
                  <span className="text-gray-600 font-medium">{platform.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FUTURE ROADMAP */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
              <p className="text-sm uppercase tracking-[0.2em] font-medium text-gray-400 mb-3">{t('privilege.futureTitle', language)}</p>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { text: t('privilege.futureItem1', language), icon: <Gem className="w-5 h-5" />, tag: '2026 Q2' },
                { text: t('privilege.futureItem2', language), icon: <Activity className="w-5 h-5" />, tag: '2026 Q3' },
                { text: t('privilege.futureItem3', language), icon: <Diamond className="w-5 h-5" />, tag: '2026 Q4' },
                { text: t('privilege.futureItem4', language), icon: <Crown className="w-5 h-5" />, tag: '2027 Q1' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow"
                  style={{ borderRadius: '2px' }}
                >
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-white" style={{ borderRadius: '2px', color: gold }}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-gray-500 bg-white" style={{ borderRadius: '2px' }}>
                      {item.tag}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* APPLICATION FORM */}
        <section className="py-16 bg-white" ref={formRef} id="join-form">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            {!showForm ? (
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full text-xs text-gray-500 tracking-widest uppercase mb-2">
                  <Crown className="w-3 h-3" style={{ color: gold }} />
                  {language === 'he' ? 'הצטרפות חינם' : 'Free Membership'}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('privilege.joinFormTitle', language)}
                </h2>
                <p className="text-gray-400 max-w-md mx-auto text-sm">{t('privilege.joinFormSubtitle', language)}</p>

                <div className="max-w-sm mx-auto space-y-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-white transition-all duration-200 font-semibold text-gray-700 shadow-sm"
                    style={{ borderRadius: '2px' }}
                  >
                    {googleLoading
                      ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      : <SiGoogle className="w-5 h-5 text-[#4285F4]" />}
                    {language === 'he' ? 'הצטרף עם Gmail' : 'Join with Gmail'}
                  </motion.button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white" />
                    <span className="text-xs text-gray-400">{language === 'he' ? 'או' : 'or'}</span>
                    <div className="flex-1 h-px bg-white" />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(90deg, #c9a96e, #d4af37)', borderRadius: '2px' }}
                  >
                    {language === 'he' ? 'המשך עם טופס' : 'Continue with form'}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>

                <p className="text-xs text-gray-400 pt-2 flex items-center justify-center gap-2">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  {language === 'he' ? 'הצטרפות חינם · ביטול בכל עת · ללא כרטיס אשראי' : 'Free to join · Cancel anytime · No credit card'}
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white p-6 sm:p-8 shadow-xl shadow-gray-100/50 space-y-6"
                style={{ borderRadius: '2px', border: '1px solid #f0f0f0' }}
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    {t('privilege.joinFormTitle', language)}
                  </h2>
                  <p className="text-sm text-gray-400">{t('privilege.joinFormSubtitle', language)}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{stepIndicator}</span>
                    <span className="text-sm font-medium text-gray-700">{stepLabels[currentStep - 1]}</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                      <div key={i} className="h-1.5 flex-1 transition-all duration-300" style={{ borderRadius: '2px', background: i < currentStep ? '#d4af37' : '#f0f0f0' }} />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={currentStep} initial={{ opacity: 0, x: isRTL ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRTL ? 20 : -20 }} transition={{ duration: 0.25 }} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-600 font-medium">{t('privilege.firstName', language)} <span className="text-red-500">*</span></Label>
                            <Input id="privilege-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="bg-white border-gray-200 text-gray-900 focus:border-gray-400" style={{ borderRadius: '2px' }} />
                          </div>
                          <div>
                            <Label className="text-gray-600 font-medium">{t('privilege.lastName', language)} <span className="text-red-500">*</span></Label>
                            <Input id="privilege-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="bg-white border-gray-200 text-gray-900 focus:border-gray-400" style={{ borderRadius: '2px' }} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.email', language)} <span className="text-red-500">*</span></Label>
                          <Input id="privilege-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white border-gray-200 text-gray-900 focus:border-gray-400" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.phone', language)} <span className="text-red-500">*</span></Label>
                          <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
                        </div>
                        <div>
                          <NativeDateSelect value={dob} onChange={setDob} label={`${t('privilege.dob', language)} *`} language={language} minYear={new Date().getFullYear() - 120} maxYear={new Date().getFullYear() - 13} />
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.gender', language)} <span className="text-red-500">*</span></Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="h-10 mt-1 bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">{t('privilege.genderMale', language)}</SelectItem>
                              <SelectItem value="female">{t('privilege.genderFemale', language)}</SelectItem>
                              <SelectItem value="other">{t('privilege.genderOther', language)}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.country', language)}</Label>
                          <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger className="h-10 mt-1 bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent className="max-h-[200px]">{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.city', language)}</Label>
                          <Input id="privilege-city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white border-gray-200 text-gray-900 focus:border-gray-400" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <GooglePlacesAutocomplete value={address} onChange={(val) => setAddress(val)} label={`${t('privilege.address', language)} (${t('privilege.optional', language)})`} placeholder={t('privilege.address', language)} />
                        </div>
                      </div>
                    )}
                    {currentStep === 3 && (
                      <div className="space-y-4">
                        {pets.map((pet, index) => (
                          <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-3 relative bg-white" style={{ borderRadius: '2px' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">{t('privilege.sectionPets', language)} #{index + 1}</span>
                              {pets.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removePet(index)} className="text-red-400 hover:text-red-500 h-8" style={{ borderRadius: '2px' }}>
                                  <X className="w-4 h-4 mr-1" />{t('privilege.removePet', language)}
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-gray-500 text-sm">{t('privilege.petName', language)} <span className="text-red-500">*</span></Label>
                                <Input value={pet.name} onChange={(e) => updatePet(index, 'name', e.target.value)} required className="bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }} />
                              </div>
                              <div>
                                <Label className="text-gray-500 text-sm">{t('privilege.petType', language)} <span className="text-red-500">*</span></Label>
                                <Select value={pet.type} onValueChange={(val) => updatePet(index, 'type', val)}>
                                  <SelectTrigger className="h-10 mt-1 bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Dog">{t('privilege.petDog', language)}</SelectItem>
                                    <SelectItem value="Cat">{t('privilege.petCat', language)}</SelectItem>
                                    <SelectItem value="Other">{t('privilege.petOther', language)}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-gray-500 text-sm">{t('privilege.petBreed', language)} ({t('privilege.optional', language)})</Label>
                              <Input value={pet.breed} onChange={(e) => updatePet(index, 'breed', e.target.value)} className="bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }} />
                            </div>
                            <NativeDateSelect value={pet.dob} onChange={(val) => updatePet(index, 'dob', val)} label={`${t('privilege.petDob', language)} (${t('privilege.optional', language)})`} language={language} minYear={new Date().getFullYear() - 30} maxYear={new Date().getFullYear()} />
                          </motion.div>
                        ))}
                        {pets.length < 5 && (
                          <Button type="button" variant="outline" onClick={addPet} className="w-full border-dashed text-gray-400 hover:text-gray-600 border-gray-300" style={{ borderRadius: '2px', background: 'transparent' }}>
                            <Plus className="w-4 h-4 mr-2" />{t('privilege.addAnotherPet', language)}
                          </Button>
                        )}
                      </div>
                    )}
                    {currentStep === 4 && (
                      <div className="space-y-4">
                        <div className="p-4 text-center space-y-2 bg-white" style={{ borderRadius: '2px' }}>
                          <Shield className="w-8 h-8 mx-auto" style={{ color: gold }} />
                          <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{t('privilege.idVerification', language)}</h3>
                          <p className="text-sm text-gray-500">{t('privilege.idDescription', language)}</p>
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.idType', language)}</Label>
                          <Select value={docType} onValueChange={setDocType}>
                            <SelectTrigger className="h-10 mt-1 bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="driving_license">{t('privilege.idDriverLicense', language)}</SelectItem>
                              <SelectItem value="national_id">{t('privilege.idNationalId', language)}</SelectItem>
                              <SelectItem value="passport">{t('privilege.idPassport', language)}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.idNumber', language)}</Label>
                          <Input id="privilege-docNumber" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.idUpload', language)}</Label>
                          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
                          <div className="mt-1 border-2 border-dashed p-6 text-center cursor-pointer hover:bg-white transition-colors" style={{ borderRadius: '2px', borderColor: docFile ? gold : '#e5e7eb' }} onClick={() => fileInputRef.current?.click()}>
                            {docFile ? (
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <FileCheck className="w-5 h-5" style={{ color: gold }} />
                                <span className="text-gray-600">{t('privilege.fileSelected', language)}: {docFile.name}</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="w-8 h-8 mx-auto text-gray-300" />
                                <p className="text-sm text-gray-400">{t('privilege.chooseFile', language)}</p>
                                <p className="text-xs text-gray-300">{t('privilege.idUploadHint', language)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {currentStep === 5 && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.referralSource', language)}</Label>
                          <Select value={referralSource} onValueChange={setReferralSource}>
                            <SelectTrigger className="h-10 mt-1 bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friend">{t('privilege.referralFriend', language)}</SelectItem>
                              <SelectItem value="social">{t('privilege.referralSocial', language)}</SelectItem>
                              <SelectItem value="search">{t('privilege.referralSearch', language)}</SelectItem>
                              <SelectItem value="ad">{t('privilege.referralAd', language)}</SelectItem>
                              <SelectItem value="station">{t('privilege.referralStation', language)}</SelectItem>
                              <SelectItem value="other">{t('privilege.referralOther', language)}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-600 font-medium">{t('privilege.referralCode', language)}</Label>
                          <Input id="privilege-referralCode" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className="bg-white border-gray-200 text-gray-900" style={{ borderRadius: '2px' }} />
                        </div>
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                          <div className="flex items-start gap-2">
                            <Checkbox id="privilege-marketing" checked={marketingConsent} onCheckedChange={(checked) => setMarketingConsent(!!checked)} />
                            <Label htmlFor="privilege-marketing" className="text-sm text-gray-500 cursor-pointer leading-snug">{t('privilege.marketingConsent', language)}</Label>
                          </div>
                          <div className="flex items-start gap-2">
                            <Checkbox id="privilege-sms" checked={smsConsent} onCheckedChange={(checked) => setSmsConsent(!!checked)} />
                            <Label htmlFor="privilege-sms" className="text-sm text-gray-500 cursor-pointer leading-snug">{t('privilege.smsConsent', language)}</Label>
                          </div>
                          <div className="flex items-start gap-2">
                            <Checkbox id="privilege-terms" checked={termsConsent} onCheckedChange={(checked) => setTermsConsent(!!checked)} />
                            <Label htmlFor="privilege-terms" className="text-sm text-gray-500 cursor-pointer leading-snug">{t('privilege.termsConsent', language)} <span className="text-red-500">*</span></Label>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  {currentStep > 1 ? (
                    <Button type="button" variant="outline" onClick={prevStep} className="flex items-center gap-2 text-gray-500 border-gray-200 bg-white hover:bg-white" style={{ borderRadius: '2px' }}>
                      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}{t('privilege.back', language)}
                    </Button>
                  ) : <div />}
                  {currentStep < TOTAL_STEPS ? (
                    <Button type="button" onClick={nextStep} className="flex items-center gap-2 font-bold text-white" style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)' }}>
                      {t('privilege.next', language)}{isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 font-bold text-white" style={{ borderRadius: '2px', background: 'linear-gradient(90deg, #c9a96e, #d4af37)' }}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles className="w-4 h-4" /></motion.div>
                          {t('privilege.submitting', language)}
                        </span>
                      ) : (<><Crown className="w-4 h-4" style={{ color: gold }} />{t('privilege.submitApplication', language)}</>)}
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-300 pt-2">
                  <Lock className="w-3 h-3" /><span>{t('privilege.secureNote', language)}</span>
                </div>
                <div className="text-center text-sm text-gray-400 pt-2">
                  {t('privilege.alreadyMemberForm', language)}{' '}
                  <Link href="/login" className="underline font-medium text-gray-600">{t('privilege.signInHere', language)}</Link>
                </div>
              </motion.div>
            )}
          </div>
        </section>

      </div>
    </Layout>
  );
}