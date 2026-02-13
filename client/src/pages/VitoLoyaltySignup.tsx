import { useState, useRef, useEffect } from "react";
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
import {
  Crown, Shield, Star, Sparkles, Upload, FileCheck, ArrowRight, ArrowLeft,
  Plus, X, Check, Lock, Users, Gift, Calendar, Heart, Zap, TrendingUp,
  Award, Diamond, Globe, Clock, MapPin, Briefcase, ChevronDown, Activity,
  Dog, Cat, Gem, Trophy
} from "lucide-react";

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

const TIER_DATA = [
  { id: 'bronze', points: '0', color: '#CD7F32', gradient: 'from-amber-700 via-amber-500 to-amber-700' },
  { id: 'silver', points: '1,000', color: '#C0C0C0', gradient: 'from-gray-400 via-gray-200 to-gray-400' },
  { id: 'gold', points: '5,000', color: '#FFD700', gradient: 'from-yellow-600 via-yellow-400 to-yellow-600' },
  { id: 'platinum', points: '15,000', color: '#E5E4E2', gradient: 'from-slate-300 via-white to-slate-300' },
  { id: 'diamond', points: '30,000', color: '#B9F2FF', gradient: 'from-cyan-400 via-blue-300 to-cyan-400' },
  { id: 'royal_black', points: '50,000', color: '#1a1a2e', gradient: 'from-gray-900 via-gray-700 to-gray-900' },
  { id: 'crown', points: '100,000', color: '#C9A96E', gradient: 'from-yellow-600 via-amber-300 to-yellow-600' },
];

const PLATFORMS = [
  { name: 'K9000™', icon: '🚿', desc: 'Self-Service Wash' },
  { name: 'Sitter Suite™', icon: '🏠', desc: 'Pet Sitting' },
  { name: 'Walk My Pet™', icon: '🚶', desc: 'Dog Walking' },
  { name: 'PetTrek™', icon: '🚗', desc: 'Pet Transport' },
  { name: 'Pet Wash Academy™', icon: '🎓', desc: 'Training' },
  { name: 'The Plush Lab™', icon: '🧸', desc: 'AI Avatars' },
  { name: 'Wash Hub™', icon: '💎', desc: 'Premium Hub' },
];

export default function VitoLoyaltySignup({ language, onLanguageChange }: VitoLoyaltySignupProps) {
  const { toast } = useToast();
  const isRTL = language === 'he' || language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
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
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [smsConsent, setSmsConsent] = useState(true);
  const [termsConsent, setTermsConsent] = useState(true);

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
    const interval = setInterval(() => {
      setActiveActivityIndex(prev => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const stepLabels = [
    t('vito.sectionPersonal', language),
    t('vito.sectionContact', language),
    t('vito.sectionPets', language),
    t('vito.sectionVerify', language),
    t('vito.sectionPreferences', language),
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
          toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.sectionPersonal', language) });
          return false;
        }
        const dobDate = new Date(dob);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 13);
        if (dobDate > minAge) { toast({ variant: 'destructive', title: t('vito.required', language), description: 'Must be at least 13 years old' }); return false; }
        return true;
      case 2: return true;
      case 3:
        for (const pet of pets) {
          if (!pet.name.trim() || !pet.type) { toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.sectionPets', language) }); return false; }
        }
        return true;
      case 4: return true;
      case 5:
        if (!termsConsent) { toast({ variant: 'destructive', title: t('vito.required', language), description: t('vito.termsConsent', language) }); return false; }
        if (!captchaToken) { toast({ variant: 'destructive', title: t('vito.required', language), description: 'Security verification required' }); return false; }
        return true;
      default: return true;
    }
  };

  const nextStep = () => { if (validateStep(currentStep) && currentStep < TOTAL_STEPS) { setCurrentStep(currentStep + 1); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  const prevStep = () => { if (currentStep > 1) { setCurrentStep(currentStep - 1); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

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
      formData.append('idType', docType);
      formData.append('idNumber', docNumber.trim());
      if (docFile) formData.append('idDocument', docFile);
      formData.append('referralSource', referralSource);
      formData.append('referralCode', referralCode.trim());
      formData.append('marketingConsent', String(marketingConsent));
      formData.append('smsConsent', String(smsConsent));
      formData.append('termsConsent', String(termsConsent));
      formData.append('language', language);
      if (captchaToken) formData.append('captchaToken', captchaToken);

      const response = await fetch(getApiUrl('/api/vito/register'), { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = t('vito.stepOf', language).replace('{current}', String(currentStep)).replace('{total}', String(TOTAL_STEPS));

  const metalBg = 'background: linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 25%, #16213e 50%, #1a1a2e 75%, #0d0d0d 100%)';
  const metallicCard = 'bg-[rgba(255,255,255,0.03)] border border-[rgba(201,169,110,0.12)] backdrop-blur-xl';
  const goldAccent = '#C9A96E';

  if (submitted) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
        <div className="min-h-screen" style={{ background: metalBg }} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className={`${metallicCard} p-8 sm:p-12 text-center space-y-6`}
              style={{ borderRadius: '2px' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="w-24 h-24 mx-auto flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${goldAccent}, #d4af37)`, borderRadius: '2px' }}
              >
                <Crown className="w-12 h-12 text-black" />
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('vito.successTitle', language)}
              </h1>
              <p className="text-white/60 text-lg">{t('vito.successMessage', language)}</p>
              <div className="flex items-center justify-center gap-2 text-sm text-white/30">
                <Lock className="w-4 h-4" />
                <span>{t('vito.secureNote', language)}</span>
              </div>
              <Link href="/login">
                <Button className="mt-4 px-8 py-3 text-black font-bold" style={{ borderRadius: '2px', background: `linear-gradient(135deg, ${goldAccent}, #d4af37)` }}>
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
      <div className="min-h-screen" style={{ background: metalBg }} dir={isRTL ? 'rtl' : 'ltr'}>

        {/* HERO SECTION */}
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 30% 20%, ${goldAccent}15 0%, transparent 50%), radial-gradient(circle at 70% 80%, ${goldAccent}10 0%, transparent 50%)` }} />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center space-y-6">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 mx-auto flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${goldAccent}, #d4af37)`, borderRadius: '2px' }}
              >
                <Crown className="w-10 h-10 text-black" />
              </motion.div>
              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] font-medium" style={{ color: goldAccent }}>{t('vito.heroTagline', language)}</p>
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('vito.heroTitle', language)}
                </h1>
                <p className="text-lg sm:text-xl text-white/50 max-w-3xl mx-auto" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('vito.heroSubtitle', language)}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-black" style={{ background: `linear-gradient(135deg, ${goldAccent}, #d4af37)`, borderRadius: '2px' }}>
                  <Sparkles className="w-4 h-4" />{t('vito.freeExclusive', language)}
                </span>
                <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white/80 border" style={{ borderRadius: '2px', borderColor: `${goldAccent}40` }}>
                  <Shield className="w-4 h-4" style={{ color: goldAccent }} />{t('vito.verifiedBadge', language)}
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
                className="inline-flex items-center gap-3 px-10 py-4 text-lg font-bold text-black mt-4"
                style={{ background: `linear-gradient(135deg, ${goldAccent}, #d4af37)`, borderRadius: '2px' }}
              >
                <Crown className="w-5 h-5" />
                {t('vito.submitApplication', language)}
                {isRTL ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </motion.button>
            </motion.div>
          </div>
        </section>

        {/* LIVE STATS BAR */}
        <section className="border-t border-b" style={{ borderColor: `${goldAccent}15` }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 text-center">
              {[
                { value: animatedStats.members.toLocaleString(), label: t('vito.statsMembers', language), icon: <Users className="w-5 h-5" /> },
                { value: animatedStats.providers.toLocaleString(), label: t('vito.statsProviders', language), icon: <Briefcase className="w-5 h-5" /> },
                { value: animatedStats.services.toLocaleString(), label: t('vito.statsServices', language), icon: <Activity className="w-5 h-5" /> },
                { value: '12', label: t('vito.statsCountries', language), icon: <Globe className="w-5 h-5" /> },
                { value: '4.9', label: t('vito.statsRating', language), icon: <Star className="w-5 h-5" /> },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="flex items-center justify-center gap-2 mb-2" style={{ color: goldAccent }}>{stat.icon}</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{stat.value}</div>
                  <div className="text-xs uppercase tracking-wider text-white/40 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* THE STORY */}
        <section className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-sm uppercase tracking-[0.2em] font-medium" style={{ color: goldAccent }}>{t('vito.clubStory', language)}</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  Vito™
                </h2>
                <p className="text-white/50 text-lg leading-relaxed" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('vito.clubStoryText', language)}
                </p>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {[
                    { icon: <Heart className="w-5 h-5" />, label: t('vito.benefit4', language) },
                    { icon: <Shield className="w-5 h-5" />, label: t('vito.benefit5', language) },
                    { icon: <Zap className="w-5 h-5" />, label: t('vito.benefit6', language) },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-3" style={{ background: `${goldAccent}08`, borderRadius: '2px', border: `1px solid ${goldAccent}15` }}>
                      <div className="flex justify-center mb-2" style={{ color: goldAccent }}>{item.icon}</div>
                      <p className="text-xs text-white/50">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${metallicCard} p-6 space-y-4`} style={{ borderRadius: '2px' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4" style={{ color: goldAccent }} />
                  <span className="text-sm font-medium text-white/60">{t('vito.recentActivity', language)}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
                {[
                  t('vito.activity1', language),
                  t('vito.activity2', language),
                  t('vito.activity3', language),
                  t('vito.activity4', language),
                  t('vito.activity5', language),
                ].map((activity, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: i === activeActivityIndex ? 1 : 0.3, scale: i === activeActivityIndex ? 1.02 : 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-start gap-3 p-3 transition-all"
                    style={{ borderRadius: '2px', background: i === activeActivityIndex ? `${goldAccent}08` : 'transparent', border: i === activeActivityIndex ? `1px solid ${goldAccent}20` : '1px solid transparent' }}
                  >
                    <div className="w-2 h-2 mt-2 rounded-full flex-shrink-0" style={{ background: i === activeActivityIndex ? goldAccent : `${goldAccent}40` }} />
                    <div>
                      <p className="text-sm text-white/70">{activity}</p>
                      <p className="text-xs text-white/30 mt-1">{Math.floor(Math.random() * 45 + 1)}m ago</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* TIMELINE / MILESTONES */}
        <section className="py-16 sm:py-20" style={{ background: `${goldAccent}03` }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.2em] font-medium mb-3" style={{ color: goldAccent }}>{t('vito.milestones', language)}</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('vito.milestones', language)}
              </h2>
            </motion.div>
            <div className="relative">
              <div className="absolute top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, transparent, ${goldAccent}40, transparent)`, [isRTL ? 'right' : 'left']: '50%', transform: 'translateX(-50%)' }} />
              {[
                { date: t('vito.milestone1Date', language), text: t('vito.milestone1', language), icon: <Zap className="w-5 h-5" />, past: true },
                { date: t('vito.milestone2Date', language), text: t('vito.milestone2', language), icon: <Crown className="w-5 h-5" />, past: true },
                { date: t('vito.milestone3Date', language), text: t('vito.milestone3', language), icon: <Globe className="w-5 h-5" />, past: false },
                { date: t('vito.milestone4Date', language), text: t('vito.milestone4', language), icon: <Sparkles className="w-5 h-5" />, past: false },
              ].map((milestone, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative flex items-center mb-10 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                >
                  <div className={`flex-1 ${i % 2 === 0 ? 'md:text-end md:pe-10' : 'md:text-start md:ps-10'} text-start ps-14 md:ps-0`}>
                    <div className={`inline-block ${metallicCard} p-5`} style={{ borderRadius: '2px', borderColor: milestone.past ? `${goldAccent}30` : `${goldAccent}10` }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: milestone.past ? goldAccent : `${goldAccent}50` }}>
                        {milestone.date}
                      </span>
                      <p className={`text-sm mt-2 ${milestone.past ? 'text-white/70' : 'text-white/40'}`}>{milestone.text}</p>
                    </div>
                  </div>
                  <div className="absolute md:relative w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ [isRTL ? 'right' : 'left']: 0 }}>
                    <div className="w-10 h-10 flex items-center justify-center" style={{ background: milestone.past ? `${goldAccent}20` : `${goldAccent}08`, border: `1px solid ${milestone.past ? goldAccent : `${goldAccent}30`}`, borderRadius: '2px', color: milestone.past ? goldAccent : `${goldAccent}50` }}>
                      {milestone.icon}
                    </div>
                  </div>
                  <div className="flex-1 hidden md:block" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 7-STAR TIER SYSTEM */}
        <section className="py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.2em] font-medium mb-3" style={{ color: goldAccent }}>{t('vito.tierPreviewTitle', language)}</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                7-Star Loyalty System
              </h2>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {TIER_DATA.map((tier, i) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className={`${metallicCard} p-4 text-center cursor-default group`}
                  style={{ borderRadius: '2px' }}
                >
                  <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center" style={{ background: `${tier.color}20`, borderRadius: '2px', border: `1px solid ${tier.color}40` }}>
                    <div className="w-4 h-4 rounded-full" style={{ background: tier.color, boxShadow: `0 0 10px ${tier.color}40` }} />
                  </div>
                  <p className="text-xs font-bold text-white uppercase tracking-wide">{t(`vito.tier${tier.id.charAt(0).toUpperCase() + tier.id.slice(1).replace('_b', 'B').replace('_', '')}` as any, language) || tier.id}</p>
                  <p className="text-[10px] text-white/30 mt-1">{tier.points} {t('vito.tierPoints', language)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PROVIDERS & PLATFORMS */}
        <section className="py-16 sm:py-20" style={{ background: `${goldAccent}03` }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.2em] font-medium mb-3" style={{ color: goldAccent }}>{t('vito.providersTitle', language)}</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('vito.platformsTitle', language)}
              </h2>
              <p className="text-white/40 max-w-2xl mx-auto">{t('vito.providersSubtitle', language)}</p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
              {[
                { label: t('vito.providerSitters', language), count: '120+', icon: <Heart className="w-5 h-5" /> },
                { label: t('vito.providerWalkers', language), count: '85+', icon: <MapPin className="w-5 h-5" /> },
                { label: t('vito.providerGroomers', language), count: '45+', icon: <Sparkles className="w-5 h-5" /> },
                { label: t('vito.providerDrivers', language), count: '30+', icon: <TrendingUp className="w-5 h-5" /> },
                { label: t('vito.providerVets', language), count: '25+', icon: <Shield className="w-5 h-5" /> },
                { label: t('vito.providerTrainers', language), count: '37+', icon: <Award className="w-5 h-5" /> },
              ].map((provider, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`${metallicCard} p-5 text-center group hover:border-[rgba(201,169,110,0.3)] transition-all`}
                  style={{ borderRadius: '2px' }}
                >
                  <div className="mb-3" style={{ color: goldAccent }}>{provider.icon}</div>
                  <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{provider.count}</p>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">{provider.label}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {PLATFORMS.map((platform, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm"
                  style={{ background: `${goldAccent}06`, border: `1px solid ${goldAccent}15`, borderRadius: '2px' }}
                >
                  <span className="text-lg">{platform.icon}</span>
                  <span className="text-white/60 font-medium">{platform.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT'S COMING NEXT */}
        <section className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.2em] font-medium mb-3" style={{ color: goldAccent }}>{t('vito.futureTitle', language)}</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {t('vito.futureTitle', language)}
              </h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { text: t('vito.futureItem1', language), icon: <Gem className="w-5 h-5" />, tag: '2026 Q2' },
                { text: t('vito.futureItem2', language), icon: <Activity className="w-5 h-5" />, tag: '2026 Q3' },
                { text: t('vito.futureItem3', language), icon: <Diamond className="w-5 h-5" />, tag: '2026 Q4' },
                { text: t('vito.futureItem4', language), icon: <Crown className="w-5 h-5" />, tag: '2027 Q1' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`${metallicCard} p-6 flex items-start gap-4 group hover:border-[rgba(201,169,110,0.3)] transition-all`}
                  style={{ borderRadius: '2px' }}
                >
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: `${goldAccent}10`, border: `1px solid ${goldAccent}20`, borderRadius: '2px', color: goldAccent }}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white/70">{item.text}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: goldAccent, background: `${goldAccent}10`, borderRadius: '2px' }}>
                      {item.tag}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* MEMBER BENEFITS */}
        <section className="py-16 sm:py-20" style={{ background: `${goldAccent}03` }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
              <p className="text-sm uppercase tracking-[0.2em] font-medium mb-3" style={{ color: goldAccent }}>{t('vito.benefitsTitle', language)}</p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: <Star className="w-6 h-6" />, text: t('vito.benefit1', language) },
                { icon: <Gift className="w-6 h-6" />, text: t('vito.benefit2', language) },
                { icon: <Calendar className="w-6 h-6" />, text: t('vito.benefit3', language) },
                { icon: <Heart className="w-6 h-6" />, text: t('vito.benefit4', language) },
                { icon: <Users className="w-6 h-6" />, text: t('vito.benefit5', language) },
                { icon: <Sparkles className="w-6 h-6" />, text: t('vito.benefit6', language) },
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`${metallicCard} p-5 text-center space-y-3 group hover:border-[rgba(201,169,110,0.3)] transition-all`}
                  style={{ borderRadius: '2px' }}
                >
                  <div className="flex justify-center" style={{ color: goldAccent }}>{benefit.icon}</div>
                  <p className="text-xs text-white/60 leading-relaxed">{benefit.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* APPLICATION FORM */}
        <section className="py-16 sm:py-20" ref={formRef} id="join-form">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {!showForm ? (
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center space-y-6">
                <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {t('vito.joinFormTitle', language)}
                </h2>
                <p className="text-white/50">{t('vito.joinFormSubtitle', language)}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-3 px-10 py-4 text-lg font-bold text-black"
                  style={{ background: `linear-gradient(135deg, ${goldAccent}, #d4af37)`, borderRadius: '2px' }}
                >
                  <Crown className="w-5 h-5" />
                  {t('vito.submitApplication', language)}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`${metallicCard} p-6 sm:p-8 space-y-6`}
                style={{ borderRadius: '2px' }}
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    {t('vito.joinFormTitle', language)}
                  </h2>
                  <p className="text-sm text-white/40">{t('vito.joinFormSubtitle', language)}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">{stepIndicator}</span>
                    <span className="text-sm font-medium" style={{ color: goldAccent }}>{stepLabels[currentStep - 1]}</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                      <div key={i} className="h-1.5 flex-1 transition-all duration-300" style={{ borderRadius: '2px', background: i < currentStep ? `linear-gradient(135deg, ${goldAccent}, #d4af37)` : 'rgba(255,255,255,0.05)' }} />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={currentStep} initial={{ opacity: 0, x: isRTL ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRTL ? 30 : -30 }} transition={{ duration: 0.3 }} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-white/70 font-medium">{t('vito.firstName', language)} <span style={{ color: goldAccent }}>*</span></Label>
                            <Input id="vito-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-[#C9A96E]" style={{ borderRadius: '2px' }} />
                          </div>
                          <div>
                            <Label className="text-white/70 font-medium">{t('vito.lastName', language)} <span style={{ color: goldAccent }}>*</span></Label>
                            <Input id="vito-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-[#C9A96E]" style={{ borderRadius: '2px' }} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.email', language)} <span style={{ color: goldAccent }}>*</span></Label>
                          <Input id="vito-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-[#C9A96E]" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.phone', language)} <span style={{ color: goldAccent }}>*</span></Label>
                          <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountryCode="+972" />
                        </div>
                        <div>
                          <NativeDateSelect value={dob} onChange={setDob} label={`${t('vito.dob', language)} *`} language={language} minYear={new Date().getFullYear() - 120} maxYear={new Date().getFullYear() - 13} />
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.gender', language)} <span style={{ color: goldAccent }}>*</span></Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="h-10 mt-1 bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
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
                          <Label className="text-white/70 font-medium">{t('vito.country', language)}</Label>
                          <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger className="h-10 mt-1 bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent className="max-h-[200px]">{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.city', language)}</Label>
                          <Input id="vito-city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-[#C9A96E]" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <GooglePlacesAutocomplete value={address} onChange={(val) => setAddress(val)} label={`${t('vito.address', language)} (${t('vito.optional', language)})`} placeholder={t('vito.address', language)} />
                        </div>
                      </div>
                    )}
                    {currentStep === 3 && (
                      <div className="space-y-4">
                        {pets.map((pet, index) => (
                          <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-3 relative" style={{ borderRadius: '2px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${goldAccent}10` }}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-white/70">{t('vito.sectionPets', language)} #{index + 1}</span>
                              {pets.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removePet(index)} className="text-red-400 hover:text-red-300 h-8" style={{ borderRadius: '2px' }}>
                                  <X className="w-4 h-4 mr-1" />{t('vito.removePet', language)}
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-white/60 text-sm">{t('vito.petName', language)} <span style={{ color: goldAccent }}>*</span></Label>
                                <Input value={pet.name} onChange={(e) => updatePet(index, 'name', e.target.value)} required className="bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }} />
                              </div>
                              <div>
                                <Label className="text-white/60 text-sm">{t('vito.petType', language)} <span style={{ color: goldAccent }}>*</span></Label>
                                <Select value={pet.type} onValueChange={(val) => updatePet(index, 'type', val)}>
                                  <SelectTrigger className="h-10 mt-1 bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Dog">{t('vito.petDog', language)}</SelectItem>
                                    <SelectItem value="Cat">{t('vito.petCat', language)}</SelectItem>
                                    <SelectItem value="Other">{t('vito.petOther', language)}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-white/60 text-sm">{t('vito.petBreed', language)} ({t('vito.optional', language)})</Label>
                              <Input value={pet.breed} onChange={(e) => updatePet(index, 'breed', e.target.value)} className="bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }} />
                            </div>
                            <NativeDateSelect value={pet.dob} onChange={(val) => updatePet(index, 'dob', val)} label={`${t('vito.petDob', language)} (${t('vito.optional', language)})`} language={language} minYear={new Date().getFullYear() - 30} maxYear={new Date().getFullYear()} />
                          </motion.div>
                        ))}
                        {pets.length < 5 && (
                          <Button type="button" variant="outline" onClick={addPet} className="w-full border-dashed text-white/50 hover:text-white" style={{ borderRadius: '2px', borderColor: `${goldAccent}40`, background: 'transparent' }}>
                            <Plus className="w-4 h-4 mr-2" />{t('vito.addAnotherPet', language)}
                          </Button>
                        )}
                      </div>
                    )}
                    {currentStep === 4 && (
                      <div className="space-y-4">
                        <div className="p-4 text-center space-y-2" style={{ borderRadius: '2px', background: `${goldAccent}05`, border: `1px solid ${goldAccent}20` }}>
                          <Shield className="w-8 h-8 mx-auto" style={{ color: goldAccent }} />
                          <h3 className="font-semibold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{t('vito.idVerification', language)}</h3>
                          <p className="text-sm text-white/50">{t('vito.idDescription', language)}</p>
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.idType', language)}</Label>
                          <Select value={docType} onValueChange={setDocType}>
                            <SelectTrigger className="h-10 mt-1 bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="driving_license">{t('vito.idDriverLicense', language)}</SelectItem>
                              <SelectItem value="national_id">{t('vito.idNationalId', language)}</SelectItem>
                              <SelectItem value="passport">{t('vito.idPassport', language)}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.idNumber', language)}</Label>
                          <Input id="vito-docNumber" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }} />
                        </div>
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.idUpload', language)}</Label>
                          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
                          <div className="mt-1 border-2 border-dashed p-6 text-center cursor-pointer hover:bg-white/5 transition-colors" style={{ borderRadius: '2px', borderColor: docFile ? goldAccent : 'rgba(255,255,255,0.1)' }} onClick={() => fileInputRef.current?.click()}>
                            {docFile ? (
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <FileCheck className="w-5 h-5" style={{ color: goldAccent }} />
                                <span className="text-white/70">{t('vito.fileSelected', language)}: {docFile.name}</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="w-8 h-8 mx-auto text-white/20" />
                                <p className="text-sm text-white/40">{t('vito.chooseFile', language)}</p>
                                <p className="text-xs text-white/20">{t('vito.idUploadHint', language)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {currentStep === 5 && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-white/70 font-medium">{t('vito.referralSource', language)}</Label>
                          <Select value={referralSource} onValueChange={setReferralSource}>
                            <SelectTrigger className="h-10 mt-1 bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }}><SelectValue placeholder="--" /></SelectTrigger>
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
                          <Label className="text-white/70 font-medium">{t('vito.referralCode', language)}</Label>
                          <Input id="vito-referralCode" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className="bg-white/5 border-white/10 text-white" style={{ borderRadius: '2px' }} />
                        </div>
                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <div className="flex items-start gap-2">
                            <Checkbox id="vito-marketing" checked={marketingConsent} onCheckedChange={(checked) => setMarketingConsent(!!checked)} />
                            <Label htmlFor="vito-marketing" className="text-sm text-white/50 cursor-pointer leading-snug">{t('vito.marketingConsent', language)}</Label>
                          </div>
                          <div className="flex items-start gap-2">
                            <Checkbox id="vito-sms" checked={smsConsent} onCheckedChange={(checked) => setSmsConsent(!!checked)} />
                            <Label htmlFor="vito-sms" className="text-sm text-white/50 cursor-pointer leading-snug">{t('vito.smsConsent', language)}</Label>
                          </div>
                          <div className="flex items-start gap-2">
                            <Checkbox id="vito-terms" checked={termsConsent} onCheckedChange={(checked) => setTermsConsent(!!checked)} />
                            <Label htmlFor="vito-terms" className="text-sm text-white/50 cursor-pointer leading-snug">{t('vito.termsConsent', language)} <span style={{ color: goldAccent }}>*</span></Label>
                          </div>
                        </div>
                        <div className="pt-4">
                          <SecurityCheckpoint onVerified={(token) => setCaptchaToken(token)} language={language} action="vito_register" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  {currentStep > 1 ? (
                    <Button type="button" variant="outline" onClick={prevStep} className="flex items-center gap-2 text-white/70 border-white/10 bg-transparent hover:bg-white/5" style={{ borderRadius: '2px' }}>
                      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}{t('vito.back', language)}
                    </Button>
                  ) : <div />}
                  {currentStep < TOTAL_STEPS ? (
                    <Button type="button" onClick={nextStep} className="flex items-center gap-2 font-bold text-black" style={{ borderRadius: '2px', background: `linear-gradient(135deg, ${goldAccent}, #d4af37)` }}>
                      {t('vito.next', language)}{isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 font-bold text-black" style={{ borderRadius: '2px', background: `linear-gradient(135deg, ${goldAccent}, #d4af37)` }}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Sparkles className="w-4 h-4" /></motion.div>
                          {t('vito.submitting', language)}
                        </span>
                      ) : (<><Crown className="w-4 h-4" />{t('vito.submitApplication', language)}</>)}
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-white/20 pt-2">
                  <Lock className="w-3 h-3" /><span>{t('vito.secureNote', language)}</span>
                </div>
                <div className="text-center text-sm text-white/40 pt-2">
                  {t('vito.alreadyMember', language)}{' '}
                  <Link href="/login" className="underline font-medium" style={{ color: goldAccent }}>{t('vito.signInHere', language)}</Link>
                </div>
              </motion.div>
            )}
          </div>
        </section>

      </div>
    </Layout>
  );
}