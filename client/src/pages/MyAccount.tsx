import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/apiConfig';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Crown, 
  Gem, 
  Star, 
  Wallet, 
  Gift, 
  Sparkles, 
  Bell, 
  Shield, 
  User, 
  Edit2, 
  Check, 
  X,
  ChevronRight,
  CalendarCheck,
  FileCheck,
  History,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Dog,
  Settings,
  CreditCard,
  Loader2,
  Snowflake,
  Trash2,
  AlertTriangle,
  Download,
  Ban,
  Globe,
  KeyRound,
  QrCode,
  Award,
  Camera,
  CheckCircle2,
  Lock,
  ImagePlus,
  Plus,
  Pencil,
  Copy,
  Inbox,
  PartyPopper,
  Cake,
  Timer,
} from 'lucide-react';
import { useLocation } from 'wouter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePhoneVerification } from '@/hooks/usePhoneVerification';
import { PhoneInput } from '@/components/PhoneInput';
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';
import '@/styles/luxury-dark-2025.css';
import '@/styles/my-account-luxury.css';
import { IsraeliTaxInvoice, buildInvoiceFromTransaction } from '@/components/IsraeliTaxInvoice';
import { PetIntakeForm } from '@/components/PetIntakeForm';

interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

interface UserProfile {
  displayName: string;
  email: string;
  phone: string;
  address: string;
  street: string;
  streetNumber?: string;
  apartment?: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  birthdate: string;
  photoURL: string;
  preferredLanguage: string;
  // Extended personal details
  gender?: string;
  idNumber?: string;
  carPlate?: string;
  carPlate2?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  // Security / consent preferences
  twoFactorEnabled?: boolean;
  marketingConsent?: boolean;
  notificationPreferences: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    marketingEnabled: boolean;
    reminderEnabled: boolean;
    birthdayOffersEnabled: boolean;
    loyaltyUpdatesEnabled: boolean;
    worldDogDayEnabled: boolean;
    blackFridayEnabled: boolean;
    petBirthdayPushEnabled: boolean;
  };
}

const tierConfig: Record<string, { 
  gradient: string;
  bgGradient: string;
  label: string;
  labelHe: string;
  icon: typeof Crown;
  pointsRequired: number;
  nextTier?: string;
  discount: number;
}> = {
  bronze: { 
    gradient: 'from-amber-700 via-amber-600 to-amber-800',
    bgGradient: 'from-amber-900/20 to-amber-800/10',
    label: 'Bronze Member',
    labelHe: 'חבר ברונזה',
    icon: Star,
    pointsRequired: 0,
    nextTier: 'silver',
    discount: 5
  },
  silver: { 
    gradient: 'from-slate-400 via-slate-300 to-slate-500',
    bgGradient: 'from-slate-800/20 to-slate-700/10',
    label: 'Silver Member',
    labelHe: 'חבר כסף',
    icon: Star,
    pointsRequired: 2500,
    nextTier: 'gold',
    discount: 6
  },
  gold: { 
    gradient: 'from-yellow-500 via-yellow-400 to-amber-500',
    bgGradient: 'from-yellow-900/20 to-amber-800/10',
    label: 'Gold Member',
    labelHe: 'חבר זהב',
    icon: Crown,
    pointsRequired: 7500,
    nextTier: 'platinum',
    discount: 7
  },
  platinum: { 
    gradient: 'from-slate-300 via-white to-slate-400',
    bgGradient: 'from-slate-700/20 to-slate-600/10',
    label: 'Platinum Elite',
    labelHe: 'אליטה פלטינום',
    icon: Crown,
    pointsRequired: 15000,
    nextTier: 'diamond',
    discount: 8
  },
  diamond: { 
    gradient: 'from-cyan-300 via-sky-200 to-blue-400',
    bgGradient: 'from-cyan-900/20 to-blue-800/10',
    label: 'Diamond VIP',
    labelHe: 'יהלום VIP',
    icon: Gem,
    pointsRequired: 25000,
    nextTier: 'emerald',
    discount: 9
  },
  emerald: { 
    gradient: 'from-emerald-500 via-emerald-400 to-green-600',
    bgGradient: 'from-emerald-900/20 to-green-800/10',
    label: 'Emerald Elite',
    labelHe: 'אליטה אמרלד',
    icon: Crown,
    pointsRequired: 40000,
    nextTier: 'royal',
    discount: 10
  },
  royal: { 
    gradient: 'from-purple-600 via-violet-500 to-fuchsia-600',
    bgGradient: 'from-purple-900/30 to-violet-800/20',
    label: 'Royal Elite',
    labelHe: 'אליטה מלכותית',
    icon: Crown,
    pointsRequired: 50000,
    discount: 15
  },
};

function formatCurrency(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

function WalletActionButton({ 
  icon: Icon, 
  label, 
  href, 
  color 
}: { 
  icon: typeof Wallet; 
  label: string; 
  href: string; 
  color: string;
}) {
  const [, setLocation] = useLocation();
  
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setLocation(href)}
      onKeyDown={(e) => e.key === 'Enter' && setLocation(href)}
      style={{ background: '#ffffff', cursor: 'pointer' }}
      className="flex flex-col items-center p-5 rounded-2xl border border-gray-100 shadow-sm text-center hover:shadow-md hover:border-gray-200 transition-all duration-300 group w-full"
    >
      <Icon className="w-5 h-5 text-gray-400 mb-3 group-hover:text-stone-700 transition-colors" />
      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{label}</p>
      <ChevronRight className="w-4 h-4 mt-2 text-gray-300 group-hover:text-gray-500 transition-colors" />
    </div>
  );
}

export default function MyAccount() {
  const { user } = useFirebaseAuth();
  const firebaseUser = user;
  const { language } = useLanguage();
  const { toast } = useToast();
  const isHebrew = language === 'he';
  
  const [activeTab, setActiveTab] = useState('profile');
  const [inboxFilter, setInboxFilter] = useState<'all'|'receipt'|'promo'|'voucher'|'system'>('all');
  const [inboxExpanded, setInboxExpanded] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  
  // Account management state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFreezeDialog, setShowFreezeDialog] = useState(false);
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailChangeStep, setEmailChangeStep] = useState<'request' | 'verify'>('request');
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState('');
  const [deleteAcknowledgements, setDeleteAcknowledgements] = useState({
    credits: false,
    data: false,
    egift: false,
  });
  const [freezeReason, setFreezeReason] = useState<string>('');
  const [freezeDuration, setFreezeDuration] = useState<number | undefined>(undefined);
  
  const [showPhoneVerifyDialog, setShowPhoneVerifyDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const phoneVerification = usePhoneVerification();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Pet profile state
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPet, setEditingPet] = useState<any | null>(null);
  const emptyPet = {
    name: '', species: 'dog', breed: '', birthday: '', vaccineDates: {},
    weight: '', color: '', microchip: '',
    allergies: '', favoriteFoods: '', dislikedFoods: '',
    habits: '', routine: '',
    vetName: '', vetPhone: '', notes: '',
  };
  const [petFormData, setPetFormData] = useState<any>(emptyPet);

  const { data: walletData, isLoading: walletLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
    enabled: !!user,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user/profile'],
    enabled: !!user,
  });

  // Seasonal promo code
  const { data: seasonalPromo } = useQuery<{
    active: boolean; season?: string; label?: { en: string; he: string };
    code?: string; claimed?: boolean; expiresAt?: string; discountPercent?: number;
  }>({
    queryKey: ['/api/promo/seasonal'],
    enabled: !!user,
    retry: false,
  });

  // User inbox messages
  const { data: inboxData } = useQuery<{ messages: any[] }>({
    queryKey: ['/api/inbox/user'],
    enabled: !!user,
  });

  // Birthday countdown helper
  function daysUntilBirthday(birthday: string): number {
    if (!birthday) return -1;
    const today = new Date();
    const [, monthStr, dayStr] = birthday.split('-');
    const thisYear = new Date(today.getFullYear(), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    return Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function nextBirthdayDate(birthday: string): string {
    if (!birthday) return '';
    const today = new Date();
    const [, monthStr, dayStr] = birthday.split('-');
    const candidate = new Date(today.getFullYear(), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
    if (candidate < today) candidate.setFullYear(today.getFullYear() + 1);
    return candidate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  }

  // Birthday promo code
  const { data: birthdayPromo, refetch: refetchBirthdayPromo } = useQuery<{
    code: string; claimed: boolean; expiresAt: string; calendarLink: string; discountPercent: number; year: number;
  } | { error: string }>({
    queryKey: ['/api/promo/birthday'],
    enabled: !!user,
    retry: false,
  });

  const [promoCopied, setPromoCopied] = useState(false);

  function handleCopyPromo(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setPromoCopied(true);
      setTimeout(() => setPromoCopied(false), 2000);
    });
  }

  // Pets queries & mutations
  const { data: petsData, isLoading: petsLoading } = useQuery<{ pets: any[] }>({
    queryKey: ['/api/pets'],
    enabled: !!user,
  });

  const addPetMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/pets', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      setShowPetForm(false);
      setEditingPet(null);
      setPetFormData(emptyPet);
      toast({ title: isHebrew ? '✅ חיית המחמד נוספה' : '✅ Pet added' });
    },
    onError: () => toast({ title: isHebrew ? 'שגיאה בהוספת חיית מחמד' : 'Failed to add pet', variant: 'destructive' }),
  });

  const updatePetMutation = useMutation({
    mutationFn: ({ petId, data }: { petId: string; data: any }) =>
      apiRequest(`/api/pets/${petId}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      setShowPetForm(false);
      setEditingPet(null);
      setPetFormData(emptyPet);
      toast({ title: isHebrew ? '✅ הפרטים עודכנו' : '✅ Pet profile updated' });
    },
    onError: () => toast({ title: isHebrew ? 'שגיאה בעדכון' : 'Failed to update pet', variant: 'destructive' }),
  });

  const deletePetMutation = useMutation({
    mutationFn: (petId: string) => apiRequest(`/api/pets/${petId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      toast({ title: isHebrew ? 'חיית המחמד הוסרה' : 'Pet removed' });
    },
  });

  function buildGoogleCalendarUrl(petName: string, vaccine: string, dueDateStr: string): string {
    const dateNoHyphens = dueDateStr.replace(/-/g, '');
    const title = encodeURIComponent(`${petName} — ${vaccine} Vaccine`);
    const details = encodeURIComponent(`PetWash™ Reminder: ${petName} is due for ${vaccine} vaccine on ${dueDateStr}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateNoHyphens}/${dateNoHyphens}&details=${details}&crm=AVAILABLE`;
  }

  function buildPetBirthdayCalendarUrl(petName: string, birthday: string, emoji: string): string {
    const today = new Date();
    const [, monthStr, dayStr] = birthday.split('-');
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    let year = today.getFullYear();
    const next = new Date(year, month, day);
    if (next < today) year += 1;
    const dateStr = `${year}${monthStr}${dayStr}`;
    const title = encodeURIComponent(`${emoji} יום הולדת של ${petName} 🎂`);
    const details = encodeURIComponent(`PetWash™: יום הולדת של ${petName}! זמן לפינוק 🐾`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}&recur=RRULE:FREQ=YEARLY`;
  }

  const PET_SPECIES: { value: string; labelHe: string; labelEn: string; emoji: string }[] = [
    { value: 'dog',     labelHe: 'כלב',      labelEn: 'Dog',      emoji: '🐶' },
    { value: 'cat',     labelHe: 'חתול',     labelEn: 'Cat',      emoji: '🐱' },
    { value: 'rabbit',  labelHe: 'ארנב',     labelEn: 'Rabbit',   emoji: '🐰' },
    { value: 'bird',    labelHe: 'ציפור',    labelEn: 'Bird',     emoji: '🐦' },
    { value: 'fish',    labelHe: 'דג',       labelEn: 'Fish',     emoji: '🐠' },
    { value: 'hamster', labelHe: 'אוגר',     labelEn: 'Hamster',  emoji: '🐹' },
    { value: 'turtle',  labelHe: 'צב',       labelEn: 'Turtle',   emoji: '🐢' },
    { value: 'other',   labelHe: 'אחר',      labelEn: 'Other',    emoji: '🐾' },
  ];

  function getPetEmoji(species: string): string {
    return PET_SPECIES.find(s => s.value === species)?.emoji ?? '🐾';
  }

  function handleOpenPetForm(pet?: any) {
    if (pet) {
      setEditingPet(pet);
      setPetFormData({
        name: pet.name || '', species: pet.species || 'dog', breed: pet.breed || '',
        birthday: pet.birthday || '', vaccineDates: pet.vaccineDates || {},
        weight: pet.weight || '', color: pet.color || '', microchip: pet.microchip || '',
        allergies: pet.allergies || '', favoriteFoods: pet.favoriteFoods || '', dislikedFoods: pet.dislikedFoods || '',
        habits: pet.habits || '', routine: pet.routine || '',
        vetName: pet.vetName || '', vetPhone: pet.vetPhone || '', notes: pet.notes || '',
      });
    } else {
      setEditingPet(null);
      setPetFormData(emptyPet);
    }
    setShowPetForm(true);
  }

  function handleSubmitPet() {
    if (!petFormData.name.trim()) return;
    if (editingPet) {
      updatePetMutation.mutate({ petId: editingPet.id, data: petFormData });
    } else {
      addPetMutation.mutate(petFormData);
    }
  }

  const VACCINE_LABELS: Record<string, { en: string; he: string }> = {
    rabies:        { en: 'Rabies',        he: 'כלבת' },
    dhpp:          { en: 'DHPP',          he: 'DHPP (DTP)' },
    bordatella:    { en: 'Bordetella',    he: 'בורדטלה' },
    leptospirosis: { en: 'Leptospirosis', he: 'לפטוספירה' },
    lyme:          { en: 'Lyme',          he: 'ליים' },
  };

  const { data: verificationStatus } = useQuery<{
    emailVerified: boolean;
    phoneVerified: boolean;
    isFullyVerified: boolean;
    canUploadPhoto: boolean;
    hasProfilePhoto: boolean;
  }>({
    queryKey: ['/api/user/settings/verification-status'],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const token = await user.getIdToken();
      const res = await fetch(getApiUrl('/api/user/settings/verification-status'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch verification status');
      return res.json();
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    setIsUploadingPhoto(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(getApiUrl('/api/user/settings/profile/photo'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          toast({
            title: isHebrew ? 'נדרש אימות' : 'Verification Required',
            description: isHebrew
              ? 'יש לאמת אימייל וטלפון לפני העלאת תמונת פרופיל'
              : 'Please verify your email and phone before uploading a profile photo',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data.error || 'Upload failed');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings/verification-status'] });
      toast({
        title: isHebrew ? 'תמונה עודכנה' : 'Photo Updated',
        description: isHebrew ? 'תמונת הפרופיל שלך עודכנה בהצלחה' : 'Your profile photo has been updated',
      });
    } catch (error: any) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error.message || (isHebrew ? 'העלאת התמונה נכשלה' : 'Photo upload failed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!user) return;
    setIsUploadingPhoto(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(getApiUrl('/api/user/settings/profile/photo'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Delete failed');

      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings/verification-status'] });
      toast({
        title: isHebrew ? 'תמונה הוסרה' : 'Photo Removed',
        description: isHebrew ? 'תמונת הפרופיל הוסרה' : 'Your profile photo has been removed',
      });
    } catch (error: any) {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'הסרת התמונה נכשלה' : 'Failed to remove photo',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const res = await apiRequest('PATCH', '/api/user/profile', updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      setIsEditing(false);
      toast({
        title: isHebrew ? 'הפרופיל עודכן' : 'Profile Updated',
        description: isHebrew ? 'השינויים נשמרו בהצלחה' : 'Your changes have been saved',
      });
    },
  });

  // ── WebAuthn / Passkey (inline in Security tab) ──
  const { data: passkeysData, isLoading: passkeysLoading } = useQuery<{ ok: boolean; credentials: any[] }>({
    queryKey: ['/api/webauthn/credentials'],
    enabled: !!user,
  });
  const passkeys = passkeysData?.credentials || [];

  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const { getApiUrl } = await import('@/lib/apiConfig');
      const optionsRes = await fetch(getApiUrl('/api/webauthn/register/options'), { method: 'POST', credentials: 'include' });
      if (!optionsRes.ok) throw new Error('Failed to get registration options');
      const { options, challengeKey } = await optionsRes.json();
      const { startRegistration } = await import('@simplewebauthn/browser');
      const attResp = await startRegistration(options);
      return apiRequest('POST', '/api/webauthn/register/verify', { response: attResp, challengeKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      toast({ title: isHebrew ? '✅ Face ID / Passkey נרשם בהצלחה!' : '✅ Passkey registered successfully!' });
    },
    onError: (e: any) => {
      if (e?.name === 'NotAllowedError' || e?.message?.includes('cancelled')) return;
      toast({ title: isHebrew ? 'הרישום נכשל' : 'Registration failed', variant: 'destructive' });
    },
  });

  const revokePasskeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/webauthn/credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      toast({ title: isHebrew ? 'מכשיר הוסר' : 'Device removed' });
    },
  });

  // ── Documents: intake forms + invoices ──
  const [intakeFormOpen, setIntakeFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const { data: intakeFormsData, isLoading: intakeFormsLoading } = useQuery<{ forms: any[] }>({
    queryKey: ['/api/pets/intake-forms'],
    enabled: !!user && activeTab === 'documents',
  });

  const { data: myTransactions, isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ['/api/user/transactions'],
    enabled: !!user && activeTab === 'documents',
  });

  const { data: mySignedDocs } = useQuery<{ documents: any[] }>({
    queryKey: ['/api/signatures/documents'],
    enabled: !!user && activeTab === 'documents',
  });

  const { data: accountStatus } = useQuery<{
    status: string;
    frozenAt?: string;
    scheduledDeletionDate?: string;
    egiftTransferPolicy: { transferable: boolean; reason: string };
  }>({
    queryKey: ['/api/account/status'],
    enabled: !!user,
  });

  const freezeAccountMutation = useMutation({
    mutationFn: async (data: { reason: string; freezeDurationDays?: number }) => {
      const res = await apiRequest('POST', '/api/account/freeze', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account/status'] });
      setShowFreezeDialog(false);
      toast({
        title: isHebrew ? 'החשבון הוקפא' : 'Account Frozen',
        description: isHebrew ? 'החשבון שלך הוקפא זמנית. כל הזכויות שלך נשמרות.' : 'Your account is temporarily frozen. All credits are preserved.',
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'לא ניתן להקפיא את החשבון' : 'Failed to freeze account',
        variant: 'destructive',
      });
    },
  });

  const unfreezeAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/account/unfreeze', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account/status'] });
      toast({
        title: isHebrew ? 'החשבון הופעל מחדש' : 'Account Reactivated',
        description: isHebrew ? 'ברוכים השבים! החשבון שלך פעיל שוב.' : 'Welcome back! Your account is active again.',
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (data: { confirmPhrase: string; acknowledgeCreditsLoss: boolean; acknowledgeDataLoss: boolean; acknowledgeEgiftForfeiture: boolean }) => {
      const res = await apiRequest('POST', '/api/account/delete-request', data);
      return res.json();
    },
    onSuccess: (data) => {
      setShowDeleteDialog(false);
      toast({
        title: isHebrew ? 'בקשת מחיקה נשלחה' : 'Deletion Requested',
        description: isHebrew 
          ? `החשבון שלך יימחק ב-${new Date(data.scheduledDeletionDate).toLocaleDateString('he-IL')}. ניתן לבטל תוך 30 יום.`
          : `Your account will be deleted on ${new Date(data.scheduledDeletionDate).toLocaleDateString()}. You can cancel within 30 days.`,
      });
    },
    onError: () => {
      toast({
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'לא ניתן לעבד את הבקשה' : 'Failed to process request',
        variant: 'destructive',
      });
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/account/cancel-deletion', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account/status'] });
      toast({
        title: isHebrew ? 'המחיקה בוטלה' : 'Deletion Cancelled',
        description: isHebrew ? 'החשבון שלך שוחזר במלואו.' : 'Your account has been fully restored.',
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', '/api/account/export', {});
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `petwash-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast({
        title: isHebrew ? 'הנתונים יורדו' : 'Data Exported',
        description: isHebrew ? 'הנתונים שלך הורדו בהצלחה.' : 'Your data has been downloaded.',
      });
    },
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: async (data: { newEmail: string }) => {
      const res = await apiRequest('POST', '/api/user/settings/email/request-change', data);
      return res.json();
    },
    onSuccess: () => {
      setEmailChangeStep('verify');
      toast({
        title: isHebrew ? 'קוד אימות נשלח' : 'Verification Code Sent',
        description: isHebrew ? 'בדוק את תיבת הדואר החדשה שלך.' : 'Check your new email inbox.',
      });
    },
    onError: (error: any) => {
      const isReauthRequired = error?.code === 'REAUTH_REQUIRED';
      toast({
        variant: 'destructive',
        title: isReauthRequired 
          ? (isHebrew ? 'נדרש אימות מחדש' : 'Re-authentication Required')
          : (isHebrew ? 'שגיאה' : 'Error'),
        description: isReauthRequired
          ? (isHebrew ? 'אנא התנתק והתחבר מחדש לפני שינוי האימייל.' : 'Please sign out and sign in again before changing your email.')
          : (error?.message || (isHebrew ? 'לא ניתן לשלוח קוד אימות' : 'Failed to send verification code')),
      });
      if (isReauthRequired) {
        setShowEmailChangeDialog(false);
      }
    },
  });

  const confirmEmailChangeMutation = useMutation({
    mutationFn: async (data: { verificationCode: string }) => {
      const res = await apiRequest('POST', '/api/user/settings/email/confirm-change', data);
      return res.json();
    },
    onSuccess: (data) => {
      setShowEmailChangeDialog(false);
      setNewEmail('');
      setEmailVerificationCode('');
      setEmailChangeStep('request');
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings/profile'] });
      if (firebaseUser) {
        firebaseUser.reload();
      }
      toast({
        title: isHebrew ? 'האימייל עודכן' : 'Email Updated',
        description: data.newEmail,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error?.message || (isHebrew ? 'קוד אימות שגוי' : 'Invalid verification code'),
      });
    },
  });

  const { data: phoneStatus, refetch: refetchPhoneStatus } = useQuery<{ phone: string | null; verified: boolean }>({
    queryKey: ['/api/user/settings/phone/status'],
    enabled: !!user,
  });

  const confirmPhoneVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/user/settings/phone/confirm-verification', {});
      return res.json();
    },
    onSuccess: (data) => {
      setShowPhoneVerifyDialog(false);
      setPhoneNumber('');
      setPhoneVerificationCode('');
      phoneVerification.reset();
      refetchPhoneStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      toast({
        title: isHebrew ? 'הטלפון אומת' : 'Phone Verified',
        description: data.phone,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: error?.message || (isHebrew ? 'אימות הטלפון נכשל' : 'Phone verification failed'),
      });
    },
  });

  const handleSendPhoneCode = async () => {
    if (!phoneNumber) return;
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+972${phoneNumber.replace(/^0/, '')}`;
    await phoneVerification.sendVerificationCode(formattedPhone);
  };

  const handleVerifyPhoneCode = async () => {
    if (!phoneVerificationCode) return;
    const success = await phoneVerification.verifyCode(phoneVerificationCode);
    if (success) {
      confirmPhoneVerificationMutation.mutate();
    }
  };

  const wallet = walletData?.wallet;
  const tier = wallet?.loyaltyTier?.toLowerCase() || 'bronze';
  const tierInfo = tierConfig[tier] || tierConfig.bronze;
  const TierIcon = tierInfo.icon;
  
  const nextTierInfo = tierInfo.nextTier ? tierConfig[tierInfo.nextTier] : null;
  const currentPoints = wallet?.tierPointsThisYear || 0;
  const currentTierThreshold = tierInfo.pointsRequired;
  const nextTierThreshold = nextTierInfo?.pointsRequired || currentTierThreshold;
  const pointsToNext = nextTierInfo 
    ? Math.max(0, nextTierThreshold - currentPoints)
    : 0;
  const progressToNext = nextTierInfo
    ? Math.min(100, Math.max(0, ((currentPoints - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100))
    : 100;

  const profile = profileData || {
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    birthdate: '',
    photoURL: user?.photoURL || '',
    preferredLanguage: language,
    notificationPreferences: {
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      marketingEnabled: true,
      reminderEnabled: true,
      birthdayOffersEnabled: true,
      loyaltyUpdatesEnabled: true,
      worldDogDayEnabled: true,
      blackFridayEnabled: true,
      petBirthdayPushEnabled: true,
    },
  };

  useEffect(() => {
    if (profileData) {
      setEditedProfile(profileData);
    }
  }, [profileData]);

  const handleSaveProfile = () => {
    // Build the combined address string from structured fields before saving
    const parts: string[] = [];
    if (editedProfile.street || editedProfile.streetNumber) {
      const streetLine = [editedProfile.street, editedProfile.streetNumber].filter(Boolean).join(' ');
      if (editedProfile.apartment) parts.push(`${streetLine}, ${editedProfile.apartment}`);
      else parts.push(streetLine);
    }
    if (editedProfile.city) parts.push(editedProfile.city);
    if (editedProfile.postalCode) parts.push(editedProfile.postalCode);
    if (editedProfile.country && editedProfile.country !== 'ישראל' && editedProfile.country !== 'Israel') {
      parts.push(editedProfile.country);
    }
    const combinedAddress = parts.length > 0 ? parts.join(', ') : editedProfile.address;
    updateProfileMutation.mutate({ ...editedProfile, address: combinedAddress });
  };

  return (
    <Layout>
      <div className="pw-account-page min-h-screen py-8 px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="text-center mb-6 pt-2">
            <h1 className="pw-account-title mb-2">
              {isHebrew ? 'החשבון שלי' : 'My Account'}
            </h1>
            <p className="pw-account-subtitle">
              {isHebrew ? 'פרופיל · נקודות · הרשאות בלעדיות' : 'Profile · Points · Exclusive Privileges'}
            </p>
          </div>

          <div className="pw-profile-hero p-7 md:p-10">

            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative group shrink-0">
                {/* Gold metallic avatar ring */}
                <div className="pw-avatar-ring">
                  <div className="pw-avatar-ring-inner">
                    <Avatar className="w-28 h-28">
                      <AvatarImage src={profile.photoURL} alt={profile.displayName} />
                      <AvatarFallback className="text-4xl font-bold bg-[#1a1a24] text-amber-300 w-full h-full flex items-center justify-center">
                        <img src="/gold-user-icon.jpeg" alt="avatar" className="w-full h-full object-cover rounded-full opacity-90" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast({
                          title: isHebrew ? 'קובץ גדול מדי' : 'File Too Large',
                          description: isHebrew ? 'גודל מקסימלי: 5MB' : 'Maximum size: 5MB',
                          variant: 'destructive',
                        });
                        return;
                      }
                      handlePhotoUpload(file);
                    }
                    e.target.value = '';
                  }}
                />
                {verificationStatus?.canUploadPhoto ? (
                  <Button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-2 -left-2 p-2.5 rounded-full shadow-md text-amber-900 border-2 border-[#1a1a24] transition-all duration-200 cursor-pointer"
                    style={{ background: 'var(--gold-gradient)', boxShadow: 'var(--gold-shadow)' }}
                    title={isHebrew ? 'שנה תמונת פרופיל' : 'Change profile photo'}
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                ) : (
                  <div
                    className="absolute -bottom-2 -left-2 p-2.5 rounded-full shadow-md border-2 border-[#1a1a24] cursor-not-allowed"
                    style={{ background: 'rgba(100,100,120,0.6)' }}
                    title={isHebrew ? 'אמתו אימייל וטלפון כדי להוסיף תמונה' : 'Verify email & phone to add photo'}
                  >
                    <Lock className="w-4 h-4 text-white/60" />
                  </div>
                )}
                {profile.photoURL && verificationStatus?.canUploadPhoto && (
                  <Button
                    onClick={handlePhotoDelete}
                    disabled={isUploadingPhoto}
                    className="absolute -top-1 -left-1 p-1.5 rounded-full shadow-sm bg-[#111118] text-red-400 border border-red-900/30 hover:bg-red-950 transition-all duration-200 opacity-0 group-hover:opacity-100"
                    title={isHebrew ? 'הסר תמונה' : 'Remove photo'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                {/* Tier icon medallion */}
                <div className="absolute -bottom-2 -right-2 p-2 rounded-full shadow-md"
                  style={{ background: 'var(--gold-gradient)', boxShadow: 'var(--gold-glow)' }}>
                  <TierIcon className="w-4 h-4 text-amber-900" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-start">
                <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3 tracking-tight">
                  {profile.displayName || (isHebrew ? 'בעל חיית מחמד' : 'Pet Parent')}
                </h2>

                {/* Gold tier badge */}
                <span className={`pw-tier-badge ${
                  wallet?.loyaltyTier === 'PLATINUM' ? 'pw-tier-badge-platinum'
                  : wallet?.loyaltyTier === 'GOLD' ? 'pw-tier-badge-gold'
                  : wallet?.loyaltyTier === 'SILVER' ? 'pw-tier-badge-silver'
                  : 'pw-tier-badge-bronze'
                }`}>
                  <TierIcon className="w-3.5 h-3.5" />
                  {isHebrew ? tierInfo.labelHe : tierInfo.label}
                </span>

                {tierInfo.discount > 0 && (
                  <p className="text-amber-400/80 mt-3 text-xs font-medium flex items-center gap-1.5" style={{ justifyContent: isHebrew ? 'flex-start' : 'flex-start' }}>
                    <Sparkles className="w-3.5 h-3.5" />
                    {isHebrew
                      ? `${tierInfo.discount}% הנחה קבועה על כל השירותים`
                      : `${tierInfo.discount}% permanent discount on all services`}
                  </p>
                )}

                {/* Email & member since */}
                <p className="text-white/40 text-xs mt-3 font-mono">{profile.email || user?.email}</p>
              </div>

              {/* Wallet total — gold metallic */}
              {walletLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-amber-400/50" />
              ) : (
                <div className="text-center shrink-0">
                  <p className="pw-wallet-total-label mb-1">{isHebrew ? 'סך הזכויות' : 'Total Credits'}</p>
                  <p className="pw-wallet-total-value">
                    {formatCurrency(wallet?.totalCreditsValueCents || 0)}
                  </p>
                </div>
              )}
            </div>

            {/* Loyalty progress bar */}
            {nextTierInfo && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between mb-2.5">
                  <span className="text-xs text-white/40 tracking-wide uppercase">
                    {isHebrew ? 'התקדמות לדרגה הבאה' : 'Progress to next tier'}
                  </span>
                  <span className="text-xs font-semibold text-amber-400">
                    {wallet?.tierPointsThisYear || 0} / {nextTierInfo.pointsRequired}
                  </span>
                </div>
                <div className="pw-progress-track">
                  <div className="pw-progress-fill" style={{ width: `${progressToNext}%` }} />
                </div>
                <p className="text-[10px] text-white/30 mt-2 text-center tracking-wide">
                  {isHebrew
                    ? `עוד ${pointsToNext} נקודות לדרגת ${tierConfig[tierInfo.nextTier!].labelHe}`
                    : `${pointsToNext} more points to ${tierConfig[tierInfo.nextTier!].label}`}
                </p>
              </div>
            )}
          </div>

          {/* ── Wallet Balance Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: isHebrew ? 'כרטיסי מתנה' : 'Gift Cards', value: formatCurrency(wallet?.egiftBalanceCents || 0), icon: Gift, emoji: '🎁' },
              { label: isHebrew ? 'חבילות שטיפה' : 'Wash Packs', value: wallet?.washPackageCredits || 0, icon: Sparkles, emoji: '✨' },
              { label: isHebrew ? 'נקודות נאמנות' : 'Loyalty Pts', value: wallet?.loyaltyPointsBalance || 0, icon: Star, emoji: '⭐' },
              { label: isHebrew ? 'קרדיט מבצעים' : 'Promo Credit', value: formatCurrency(wallet?.promoBalanceCents || 0), icon: Gift, emoji: '🏷️' },
              { label: isHebrew ? 'קרדיט הפניות' : 'Referral', value: formatCurrency(wallet?.referralBalanceCents || 0), icon: User, emoji: '🤝' },
            ].map((item, idx) => (
              <div key={idx} className="pw-stat-card">
                <div className="pw-stat-card-icon-wrap pw-stat-card-icon-wrap-gold">
                  <span className="text-xl">{item.emoji}</span>
                </div>
                <p className="pw-stat-value">{item.value}</p>
                <p className="pw-stat-label">{item.label}</p>
              </div>
            ))}
          </div>

          {/* ── Quick Action Buttons — Luxury Noir ── */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { icon: Wallet,       label: isHebrew ? 'הארנק שלי' : 'My Wallet',       href: '/my-wallet',        emoji: '💳' },
              { icon: QrCode,       label: isHebrew ? 'מימוש בתחנה' : 'Redeem',        href: '/stations',         emoji: '📍' },
              { icon: Award,        label: isHebrew ? 'נאמנות' : 'Loyalty',            href: '/loyalty/dashboard', emoji: '🏆' },
              { icon: Gift,         label: isHebrew ? 'כרטיס מתנה' : 'Gift Card',      href: '/buy-gift-card',    emoji: '🎁' },
              { icon: Crown,        label: isHebrew ? 'Prestige' : 'Prestige',          href: '/prestige-club',    emoji: '👑' },
              { icon: CalendarCheck,label: isHebrew ? 'הזמנות' : 'Bookings',           href: '/bookings',         emoji: '📅' },
            ].map((item, idx) => (
              <a key={idx} href={item.href} className="pw-action-btn" style={{ textDecoration: 'none' }}>
                <div className="pw-action-btn-icon-ring">
                  <span className="text-lg">{item.emoji}</span>
                </div>
                <span className="pw-action-btn-label">{item.label}</span>
              </a>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="pw-tabs-list w-full grid grid-cols-7">
              <TabsTrigger 
                value="profile"
                className="pw-tab-trigger"
              >
                <User className="w-4 h-4" />
                {isHebrew ? 'פרופיל' : 'Profile'}
              </TabsTrigger>
              <TabsTrigger 
                value="preferences"
                className="pw-tab-trigger"
              >
                <Settings className="w-4 h-4" />
                {isHebrew ? 'העדפות' : 'Prefs'}
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="pw-tab-trigger"
              >
                <Bell className="w-4 h-4" />
                {isHebrew ? 'התראות' : 'Alerts'}
              </TabsTrigger>
              <TabsTrigger 
                value="security"
                className="pw-tab-trigger"
              >
                <Shield className="w-4 h-4" />
                {isHebrew ? 'אבטחה' : 'Security'}
              </TabsTrigger>
              <TabsTrigger 
                value="pets"
                className="pw-tab-trigger"
              >
                <Dog className="w-4 h-4" />
                {isHebrew ? 'חיות' : 'Pets'}
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="pw-tab-trigger"
              >
                <FileText className="w-4 h-4" />
                {isHebrew ? 'מסמכים' : 'Docs'}
              </TabsTrigger>
              <TabsTrigger
                value="inbox"
                className="pw-tab-trigger relative"
              >
                <Inbox className="w-4 h-4" />
                {isHebrew ? 'הודעות' : 'Inbox'}
                {(inboxData?.messages?.filter((m: any) => !m.readAt).length ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--gold-gradient)', color: '#3d2b00' }}>
                    {inboxData!.messages.filter((m: any) => !m.readAt).length > 9 ? '9+' : inboxData!.messages.filter((m: any) => !m.readAt).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6 space-y-6">
              {verificationStatus && !verificationStatus.isFullyVerified && (
                <div className="bg-white rounded-2xl border border-amber-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-full bg-amber-100">
                      <Shield className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-1">
                        {isHebrew ? 'אמתו את חשבונכם' : 'Verify Your Account'}
                      </h4>
                      <p className="text-amber-700 text-sm mb-3">
                        {isHebrew
                          ? 'אמתו את האימייל והטלפון שלכם כדי לפתוח את כל התכונות כולל תמונת פרופיל, הזמנות ושירותים'
                          : 'Verify your email and phone to unlock all features including profile photo, bookings and services'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <div className={cn("flex items-center gap-2 text-sm px-3 py-1.5 rounded-full", verificationStatus.emailVerified ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                          {verificationStatus.emailVerified ? <CheckCircle2 className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                          {isHebrew ? 'אימייל' : 'Email'} {verificationStatus.emailVerified ? '✓' : ''}
                        </div>
                        <div className={cn("flex items-center gap-2 text-sm px-3 py-1.5 rounded-full", verificationStatus.phoneVerified ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                          {verificationStatus.phoneVerified ? <CheckCircle2 className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                          {isHebrew ? 'טלפון' : 'Phone'} {verificationStatus.phoneVerified ? '✓' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {verificationStatus?.isFullyVerified && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-green-800 font-medium text-sm">
                      {isHebrew ? 'החשבון שלכם מאומת - כל התכונות פתוחות' : 'Your account is verified - all features unlocked'}
                    </p>
                  </div>
                </div>
              )}

              <div className="pw-section-card">
                <div className="pw-section-header">
                  <div className="pw-section-icon-box">
                    <User className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="pw-section-title">{isHebrew ? 'פרטים אישיים' : 'Personal Details'}</p>
                    <p className="pw-section-desc">{isHebrew ? 'עדכן את פרטי הקשר שלך' : 'Update your contact information'}</p>
                  </div>
                  {!isEditing ? (
                    <button className="pw-btn-noir text-sm px-4 py-2 flex items-center gap-2"
                      onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4" />
                      {isHebrew ? 'עריכה' : 'Edit'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button className="pw-btn-gold text-sm px-4 py-2 flex items-center gap-2"
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {isHebrew ? 'שמור' : 'Save'}
                      </button>
                      <button className="pw-btn-noir text-sm px-3 py-2"
                        onClick={() => { setIsEditing(false); setEditedProfile(profile); }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {isHebrew ? 'שם מלא' : 'Full Name'}
                    </Label>
                    {isEditing ? (
                      <Input 
                        value={editedProfile.displayName || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                        className="bg-white border-gray-200 text-gray-900"
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">{profile.displayName || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {isHebrew ? 'אימייל' : 'Email'}
                    </Label>
                    <p className="text-gray-900 text-lg">{profile.email || '-'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {isHebrew ? 'טלפון' : 'Phone'}
                    </Label>
                    {isEditing ? (
                      <PhoneInput
                        value={editedProfile.phone || ''}
                        onChange={(value) => setEditedProfile({ ...editedProfile, phone: value })}
                        language={isHebrew ? 'he' : 'en'}
                        defaultCountry="IL"
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">{profile.phone || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {isHebrew ? 'תאריך לידה' : 'Birthday'}
                    </Label>
                    {isEditing ? (
                      <NativeDateSelect
                        value={editedProfile.birthdate || ''}
                        onChange={(date) => setEditedProfile({ ...editedProfile, birthdate: date })}
                        language={isHebrew ? 'he' : 'en'}
                        minYear={1930}
                        maxYear={new Date().getFullYear() - 13}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">{profile.birthdate || '-'}</p>
                    )}
                  </div>

                  {/* ── Gender ── */}
                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {isHebrew ? 'מגדר' : 'Gender'}
                    </Label>
                    {isEditing ? (
                      <select
                        value={editedProfile.gender || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, gender: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
                        style={{ fontSize: '16px' }}
                      >
                        <option value="">{isHebrew ? 'בחר...' : 'Select...'}</option>
                        <option value="male">{isHebrew ? 'זכר' : 'Male'}</option>
                        <option value="female">{isHebrew ? 'נקבה' : 'Female'}</option>
                        <option value="other">{isHebrew ? 'אחר' : 'Other'}</option>
                        <option value="prefer_not">{isHebrew ? 'מעדיף לא לציין' : 'Prefer not to say'}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900 text-lg">
                        {profile.gender === 'male' ? (isHebrew ? 'זכר' : 'Male')
                          : profile.gender === 'female' ? (isHebrew ? 'נקבה' : 'Female')
                          : profile.gender === 'other' ? (isHebrew ? 'אחר' : 'Other')
                          : profile.gender === 'prefer_not' ? (isHebrew ? 'מעדיף לא לציין' : 'Prefer not to say')
                          : '-'}
                      </p>
                    )}
                  </div>

                  {/* ── Israeli ID ── */}
                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      {isHebrew ? 'תעודת זהות' : 'ID Number'}
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.idNumber || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, idNumber: e.target.value })}
                        className="bg-white border-gray-200 text-gray-900"
                        placeholder={isHebrew ? '9 ספרות...' : '9-digit ID...'}
                        maxLength={9}
                        inputMode="numeric"
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">{profile.idNumber || '-'}</p>
                    )}
                  </div>

                  {/* ── Car Plates ── */}
                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      🚗 {isHebrew ? 'לוחית רישוי ראשונה' : 'Car Plate 1'}
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.carPlate || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, carPlate: e.target.value.toUpperCase() })}
                        className="bg-white border-gray-200 text-gray-900 font-mono tracking-widest"
                        placeholder={isHebrew ? 'למשל 12-345-67' : 'e.g. 12-345-67'}
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg font-mono">{profile.carPlate || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      🚙 {isHebrew ? 'לוחית רישוי שנייה' : 'Car Plate 2'}
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.carPlate2 || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, carPlate2: e.target.value.toUpperCase() })}
                        className="bg-white border-gray-200 text-gray-900 font-mono tracking-widest"
                        placeholder={isHebrew ? 'רכב נוסף (אם יש)' : 'Second vehicle (optional)'}
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg font-mono">{profile.carPlate2 || '-'}</p>
                    )}
                  </div>

                  {/* ── Emergency Contact ── */}
                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      🆘 {isHebrew ? 'איש קשר לחירום — שם' : 'Emergency Contact — Name'}
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.emergencyContactName || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, emergencyContactName: e.target.value })}
                        className="bg-white border-gray-200 text-gray-900"
                        placeholder={isHebrew ? 'שם...' : 'Full name...'}
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">{profile.emergencyContactName || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-500 flex items-center gap-2">
                      📞 {isHebrew ? 'טלפון איש קשר לחירום' : 'Emergency Contact — Phone'}
                    </Label>
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={editedProfile.emergencyContactPhone || ''}
                        onChange={e => setEditedProfile({ ...editedProfile, emergencyContactPhone: e.target.value })}
                        className="bg-white border-gray-200 text-gray-900"
                        placeholder="050-000-0000"
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <p className="text-gray-900 text-lg">
                        {profile.emergencyContactPhone
                          ? <a href={`tel:${profile.emergencyContactPhone}`} className="text-blue-600 hover:underline">{profile.emergencyContactPhone}</a>
                          : '-'}
                      </p>
                    )}
                  </div>

                  {/* ── Marketing Consent ── */}
                  {isEditing && (
                    <div className="md:col-span-2 flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                      <input
                        type="checkbox"
                        id="marketingConsent"
                        checked={editedProfile.marketingConsent ?? false}
                        onChange={e => setEditedProfile({ ...editedProfile, marketingConsent: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
                      />
                      <label htmlFor="marketingConsent" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                        {isHebrew
                          ? 'אני מסכים לקבל הצעות שיווקיות, מבצעים וחדשות מ-PetWash™ בדוא"ל ו-SMS. ניתן לבטל בכל עת.'
                          : 'I agree to receive marketing offers, promotions and news from PetWash™ by email & SMS. You can unsubscribe anytime.'}
                      </label>
                    </div>
                  )}
                  {!isEditing && (
                    <div className="md:col-span-2 flex items-center gap-2 text-sm text-gray-500">
                      {profile.marketingConsent
                        ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> {isHebrew ? 'הסכמה שיווקית: כן' : 'Marketing consent: Yes'}</>
                        : <><X className="w-4 h-4 text-gray-300" /> {isHebrew ? 'הסכמה שיווקית: לא' : 'Marketing consent: No'}</>}
                    </div>
                  )}

                  {/* ── Seasonal Promo Card ── */}
                  {seasonalPromo?.active && seasonalPromo.code && (
                    <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-700">
                          {isHebrew ? seasonalPromo.label?.he : seasonalPromo.label?.en}
                          {' '}— {seasonalPromo.discountPercent}%{' '}
                          {isHebrew ? 'הנחה' : 'off'}
                        </span>
                      </div>
                      {seasonalPromo.claimed ? (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          {isHebrew ? 'הקוד נוצל' : 'Code already used'}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-900 tracking-widest">
                              {seasonalPromo.code}
                            </code>
                            <Button
                              size="sm" variant="outline"
                              className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 shrink-0"
                              onClick={() => { navigator.clipboard.writeText(seasonalPromo.code!); toast({ title: isHebrew ? 'הקוד הועתק!' : 'Code copied!' }); }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-400">
                            {isHebrew ? `תקף עד ${seasonalPromo.expiresAt} · חד-פעמי · אישי ולא ניתן להעברה` : `Valid until ${seasonalPromo.expiresAt} · Single use · Personal, non-transferable`}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Birthday Promo Code Card ── */}
                  {birthdayPromo && !('error' in birthdayPromo) && (
                    <div className="md:col-span-2 rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-500" />
                        <span className="text-sm font-semibold text-pink-700">
                          {isHebrew ? `🎂 קוד הנחה ליום הולדת ${birthdayPromo.year}` : `🎂 ${birthdayPromo.year} Birthday Discount`}
                        </span>
                        <Badge className="ml-auto bg-pink-100 text-pink-700 border-0 text-xs">
                          {birthdayPromo.discountPercent}% {isHebrew ? 'הנחה' : 'off'}
                        </Badge>
                      </div>

                      {birthdayPromo.claimed ? (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          {isHebrew ? 'הקוד נוצל' : 'Code already used'}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white border border-pink-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-900 tracking-widest">
                              {birthdayPromo.code}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-pink-200 text-pink-600 hover:bg-pink-50 shrink-0"
                              onClick={() => handleCopyPromo(birthdayPromo.code)}
                            >
                              {promoCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-gray-400">
                            {isHebrew ? `תקף עד ${birthdayPromo.expiresAt} · שימוש אחד בלבד · אישי ואינו ניתן להעברה` : `Valid until ${birthdayPromo.expiresAt} · Single use · Personal, non-transferable`}
                          </p>
                          <a
                            href={birthdayPromo.calendarLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-500 hover:underline"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {isHebrew ? 'הוסף תזכורת ליומן Google' : 'Add reminder to Google Calendar'}
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Structured Address Form ── */}
                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-gray-500 flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="w-4 h-4 text-amber-500" />
                      {isHebrew ? 'כתובת' : 'Address'}
                    </Label>

                    {isEditing ? (
                      <div className="space-y-3 p-4 rounded-2xl border border-amber-100 bg-amber-50/30">
                        {/* Row 1: Google search bar */}
                        <div className="relative">
                          <GooglePlacesAutocomplete
                            value={editedProfile.address || ''}
                            onChange={(value, details) => {
                              if (details) {
                                setEditedProfile({
                                  ...editedProfile,
                                  address: details.formattedAddress,
                                  street: details.street || editedProfile.street,
                                  city: details.city || editedProfile.city,
                                  postalCode: details.postalCode || editedProfile.postalCode,
                                  country: details.country || editedProfile.country,
                                  latitude: details.lat ?? editedProfile.latitude,
                                  longitude: details.lng ?? editedProfile.longitude,
                                });
                              } else {
                                // User typing free text without selecting a suggestion —
                                // clear stale coordinates to prevent mismatched location data
                                setEditedProfile({ ...editedProfile, address: value, latitude: null, longitude: null });
                              }
                            }}
                            onPlaceSelected={(place) => {
                              setEditedProfile({
                                ...editedProfile,
                                address: place.formattedAddress,
                                street: place.street || editedProfile.street,
                                city: place.city || editedProfile.city,
                                postalCode: place.postalCode || editedProfile.postalCode,
                                country: place.country || editedProfile.country,
                                latitude: place.lat ?? editedProfile.latitude,
                                longitude: place.lng ?? editedProfile.longitude,
                              });
                            }}
                            placeholder={isHebrew ? '🔍  חפש כתובת ב-Google...' : '🔍  Search address with Google...'}
                            country={['il']}
                            showExtraFields={false}
                          />
                          <p className="text-[10px] text-amber-600/70 mt-1 flex items-center gap-1">
                            <span>⚡</span>
                            {isHebrew
                              ? 'בחר כתובת מהרשימה כדי למלא את השדות אוטומטית — או מלא ידנית למטה'
                              : 'Pick from the list to auto-fill — or fill manually below'}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-amber-200/60" />
                          <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">
                            {isHebrew ? 'פרטי כתובת' : 'Address Details'}
                          </span>
                          <div className="flex-1 h-px bg-amber-200/60" />
                        </div>

                        {/* Row 2: Street name + Building number */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'שם רחוב' : 'Street Name'}
                            </label>
                            <Input
                              value={editedProfile.street || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, street: e.target.value })}
                              placeholder={isHebrew ? 'לדוגמה: הרצל' : 'e.g. Herzl St'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white"
                              style={{ fontSize: '16px' }}
                              dir="rtl"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'מספר' : 'No.'}
                            </label>
                            <Input
                              value={editedProfile.streetNumber || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, streetNumber: e.target.value } as any)}
                              placeholder={isHebrew ? 'לדוג׳ 18' : 'e.g. 18'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white"
                              style={{ fontSize: '16px' }}
                              dir="ltr"
                            />
                          </div>
                        </div>

                        {/* Row 3: Apartment + City */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'דירה / קומה / כניסה' : 'Apt / Floor / Entrance'}
                            </label>
                            <Input
                              value={editedProfile.apartment || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, apartment: e.target.value } as any)}
                              placeholder={isHebrew ? 'דירה 4, קומה 2' : 'Apt 4, Floor 2'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white"
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'עיר / ישוב' : 'City / Town'}
                            </label>
                            <Input
                              value={editedProfile.city || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                              placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white"
                              style={{ fontSize: '16px' }}
                              dir="rtl"
                            />
                          </div>
                        </div>

                        {/* Row 4: Postal code + Country */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'מיקוד' : 'Postal Code'}
                            </label>
                            <Input
                              value={editedProfile.postalCode || ''}
                              onChange={(e) => setEditedProfile({ ...editedProfile, postalCode: e.target.value })}
                              placeholder={isHebrew ? 'לדוגמה: 6291302' : 'e.g. 6291302'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white font-mono"
                              style={{ fontSize: '16px' }}
                              inputMode="numeric"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                              {isHebrew ? 'מדינה' : 'Country'}
                            </label>
                            <Input
                              value={editedProfile.country || 'ישראל'}
                              onChange={(e) => setEditedProfile({ ...editedProfile, country: e.target.value })}
                              placeholder={isHebrew ? 'ישראל' : 'Israel'}
                              className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 focus:ring-amber-400/20 bg-white"
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Display mode — show structured address */
                      <div className="space-y-0.5">
                        {(profile.street || profile.city) ? (
                          <>
                            <p className="text-gray-900 font-medium">
                              {[profile.street, (profile as any).streetNumber].filter(Boolean).join(' ')}
                              {(profile as any).apartment && `, ${(profile as any).apartment}`}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {[profile.city, profile.postalCode, profile.country].filter(Boolean).join(' · ')}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-400 text-sm italic">
                            {isHebrew ? 'לא הוזנה כתובת' : 'No address saved yet'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Inbox Preview Card ── */}
              {inboxData?.messages && inboxData.messages.length > 0 && (
                <div className="pw-section-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-gray-500" />
                      {isHebrew ? 'הודעות אחרונות' : 'Recent Messages'}
                      {inboxData.messages.filter((m: any) => !m.readAt).length > 0 && (
                        <span className="bg-black text-white text-xs rounded-full px-2 py-0.5">
                          {inboxData.messages.filter((m: any) => !m.readAt).length}
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={() => setActiveTab('inbox')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {isHebrew ? 'כל ההודעות' : 'View all'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {inboxData.messages.slice(0, 5).map((msg: any) => {
                      const typeLabels: Record<string, string> = {
                        receipt: isHebrew ? 'קבלה' : 'Receipt',
                        promo: isHebrew ? 'מבצע' : 'Promo',
                        system: isHebrew ? 'מערכת' : 'System',
                        voucher: isHebrew ? 'שובר' : 'Voucher',
                      };
                      const typeColors: Record<string, string> = {
                        receipt: 'bg-green-100 text-green-700',
                        promo:   'bg-pink-100 text-pink-700',
                        system:  'bg-gray-100 text-gray-600',
                        voucher: 'bg-blue-100 text-blue-700',
                      };
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${msg.readAt ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <span className={`shrink-0 text-xs font-medium rounded-full px-2 py-0.5 mt-0.5 ${typeColors[msg.type] || 'bg-gray-100 text-gray-600'}`}>
                            {typeLabels[msg.type] || msg.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${msg.readAt ? 'text-gray-600 font-normal' : 'text-gray-900 font-medium'}`}>
                              {msg.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('he-IL') : ''}
                            </p>
                          </div>
                          {!msg.readAt && <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-1.5" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </TabsContent>

            <TabsContent value="preferences" className="mt-6 space-y-6">
              {/* Language Settings */}
              <div className="pw-section-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  {isHebrew ? 'שפה ואזור' : 'Language & Region'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-600 mb-2 block">
                      {isHebrew ? 'שפת ממשק' : 'Interface Language'}
                    </Label>
                    <Select 
                      value={editedProfile?.preferredLanguage || profile?.preferredLanguage || 'he'} 
                      onValueChange={(value) => {
                        setEditedProfile((prev: any) => ({ ...prev, preferredLanguage: value }));
                        updateProfileMutation.mutate({ preferredLanguage: value });
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900 w-full md:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="he">עברית (Hebrew)</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                        <SelectItem value="ru">Русский (Russian)</SelectItem>
                        <SelectItem value="fr">Français (French)</SelectItem>
                        <SelectItem value="es">Español (Spanish)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Email Change Section */}
              <div className="pw-section-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  {isHebrew ? 'כתובת אימייל' : 'Email Address'}
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100">
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">{profile?.email || firebaseUser?.email}</p>
                      <p className="text-gray-500 text-sm">
                        {profile?.emailVerified 
                          ? (isHebrew ? 'מאומת ✓' : 'Verified ✓')
                          : (isHebrew ? 'לא מאומת' : 'Not verified')
                        }
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-gray-200 text-gray-600 hover:bg-gray-100"
                      onClick={() => setShowEmailChangeDialog(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      {isHebrew ? 'שנה' : 'Change'}
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-stone-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-stone-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-stone-700 text-sm font-medium">
                          {isHebrew ? 'אבטחת זהות' : 'Identity Security'}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                          {isHebrew 
                            ? 'שינוי כתובת אימייל דורש אימות קוד חד-פעמי לאימייל החדש. זה מגן על חשבונך מפני גישה לא מורשית.'
                            : 'Changing your email requires verification via a one-time code sent to the new email. This protects your account from unauthorized access.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone Verification Section */}
              <div className="pw-section-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  {isHebrew ? 'מספר טלפון' : 'Phone Number'}
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100">
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">
                        {phoneStatus?.phone || profile?.phone || (isHebrew ? 'לא הוגדר' : 'Not set')}
                      </p>
                      <p className={cn("text-sm", phoneStatus?.verified ? "text-green-600" : "text-gray-500")}>
                        {phoneStatus?.verified 
                          ? (isHebrew ? 'מאומת ✓' : 'Verified ✓')
                          : (isHebrew ? 'לא מאומת' : 'Not verified')
                        }
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-gray-200 text-gray-600 hover:bg-gray-100"
                      onClick={() => setShowPhoneVerifyDialog(true)}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      {phoneStatus?.verified 
                        ? (isHebrew ? 'שנה' : 'Change')
                        : (isHebrew ? 'אמת' : 'Verify')
                      }
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-stone-200">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-stone-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-stone-700 text-sm font-medium">
                          {isHebrew ? 'אימות טלפון עם Google' : 'Google Phone Verification'}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                          {isHebrew 
                            ? 'קוד אימות יישלח ב-SMS למספר הטלפון שלך. אימות זה מוגן על ידי Firebase Authentication של Google.'
                            : 'A verification code will be sent via SMS to your phone. This is powered by Google Firebase Authentication.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Settings */}
              <div className="pw-section-card">
                <div className="pw-section-header">
                  <div className="pw-section-icon-box">
                    <MapPin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="pw-section-title">{isHebrew ? 'כתובת מגורים' : 'Home Address'}</p>
                    <p className="pw-section-desc">{isHebrew ? 'כתובת לשירותי איסוף ומשלוח' : 'Used for pickup & delivery services'}</p>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-2xl border border-amber-100 bg-amber-50/30">
                  {/* Google autocomplete search */}
                  <GooglePlacesAutocomplete
                    value={editedProfile?.address || ''}
                    onChange={(value, details) => {
                      if (details) {
                        setEditedProfile((prev: any) => ({
                          ...prev,
                          address: details.formattedAddress,
                          street: details.street || prev?.street,
                          city: details.city || prev?.city,
                          postalCode: details.postalCode || prev?.postalCode,
                          country: details.country || prev?.country,
                          latitude: details.lat ?? prev?.latitude,
                          longitude: details.lng ?? prev?.longitude,
                        }));
                      } else {
                        setEditedProfile((prev: any) => ({ ...prev, address: value }));
                      }
                    }}
                    onPlaceSelected={(place) => {
                      setEditedProfile((prev: any) => ({
                        ...prev,
                        address: place.formattedAddress,
                        street: place.street || prev?.street,
                        city: place.city || prev?.city,
                        postalCode: place.postalCode || prev?.postalCode,
                        country: place.country || prev?.country,
                        latitude: place.lat ?? prev?.latitude,
                        longitude: place.lng ?? prev?.longitude,
                      }));
                    }}
                    placeholder={isHebrew ? '🔍  חפש כתובת ב-Google...' : '🔍  Search address with Google...'}
                    country={['il']}
                    showExtraFields={false}
                  />
                  <p className="text-[10px] text-amber-600/70 flex items-center gap-1">
                    <span>⚡</span>
                    {isHebrew
                      ? 'בחר מהרשימה למילוי אוטומטי — או מלא ידנית'
                      : 'Select from list to auto-fill — or type manually'}
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-amber-200/60" />
                    <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">
                      {isHebrew ? 'פרטי כתובת' : 'Address Fields'}
                    </span>
                    <div className="flex-1 h-px bg-amber-200/60" />
                  </div>

                  {/* Street + Number */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'שם רחוב' : 'Street Name'}</label>
                      <Input
                        value={editedProfile?.street || ''}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, street: e.target.value }))}
                        placeholder={isHebrew ? 'הרצל' : 'e.g. Herzl St'}
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white"
                        style={{ fontSize: '16px' }} dir="rtl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'מספר' : 'No.'}</label>
                      <Input
                        value={(editedProfile as any)?.streetNumber || ''}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, streetNumber: e.target.value }))}
                        placeholder="18"
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white"
                        style={{ fontSize: '16px' }} dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Apartment + City */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'דירה / קומה' : 'Apt / Floor'}</label>
                      <Input
                        value={(editedProfile as any)?.apartment || ''}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, apartment: e.target.value }))}
                        placeholder={isHebrew ? 'דירה 4, קומה 2' : 'Apt 4, Floor 2'}
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'עיר' : 'City'}</label>
                      <Input
                        value={editedProfile?.city || ''}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, city: e.target.value }))}
                        placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'}
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white"
                        style={{ fontSize: '16px' }} dir="rtl"
                      />
                    </div>
                  </div>

                  {/* Postal + Country */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'מיקוד' : 'Postal Code'}</label>
                      <Input
                        value={editedProfile?.postalCode || ''}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, postalCode: e.target.value }))}
                        placeholder="6291302"
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white font-mono"
                        style={{ fontSize: '16px' }} inputMode="numeric" dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">{isHebrew ? 'מדינה' : 'Country'}</label>
                      <Input
                        value={editedProfile?.country || 'ישראל'}
                        onChange={(e) => setEditedProfile((prev: any) => ({ ...prev, country: e.target.value }))}
                        placeholder={isHebrew ? 'ישראל' : 'Israel'}
                        className="h-10 text-sm rounded-xl border-gray-200 focus:border-amber-400 bg-white"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="mt-4 bg-gray-900 text-white hover:bg-gray-800"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {isHebrew ? 'שמור כתובת' : 'Save Address'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <div className="pw-section-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                  {isHebrew ? 'העדפות התראות' : 'Notification Preferences'}
                </h3>
                
                <div className="space-y-6">
                  {[
                    { key: 'pushEnabled', label: isHebrew ? 'התראות Push' : 'Push Notifications', desc: isHebrew ? 'קבל התראות מיידיות למכשיר' : 'Receive instant notifications', icon: Bell },
                    { key: 'emailEnabled', label: isHebrew ? 'עדכוני אימייל' : 'Email Updates', desc: isHebrew ? 'קבלות, אישורים ועדכונים' : 'Receipts, confirmations & updates', icon: Mail },
                    { key: 'smsEnabled', label: isHebrew ? 'הודעות SMS' : 'SMS Messages', desc: isHebrew ? 'תזכורות ואישורים ב-SMS' : 'Reminders & confirmations via SMS', icon: Phone },
                    { key: 'marketingEnabled', label: isHebrew ? 'מבצעים והטבות' : 'Promotions & Offers', desc: isHebrew ? 'קבל הצעות בלעדיות' : 'Receive exclusive offers', icon: Gift },
                    { key: 'reminderEnabled', label: isHebrew ? 'תזכורות שטיפה' : 'Wash Reminders', desc: isHebrew ? 'תזכורות לשטיפה הבאה' : 'Reminders for next wash', icon: Dog },
                    { key: 'birthdayOffersEnabled', label: isHebrew ? 'הטבות יום הולדת' : 'Birthday Offers', desc: isHebrew ? 'קופון מיוחד ליום ההולדת של החיה' : 'Special coupon for pet birthdays', icon: Sparkles },
                    { key: 'loyaltyUpdatesEnabled', label: isHebrew ? 'עדכוני נאמנות' : 'Loyalty Updates', desc: isHebrew ? 'עדכונים על נקודות ודרגות' : 'Points & tier notifications', icon: Crown },
                    { key: 'petBirthdayPushEnabled', label: isHebrew ? 'יום הולדת לחיית המחמד 🐾' : 'Pet Birthday Push 🐾', desc: isHebrew ? 'הודעת Push ביום ההולדת של החיה שלך' : 'Push notification on your pet\'s birthday', icon: Bell },
                    { key: 'worldDogDayEnabled', label: isHebrew ? 'יום הכלב העולמי (26 יולי) 🐶' : 'World Dog Day (Jul 26) 🐶', desc: isHebrew ? 'הצעות ייחודיות ביום הכלב העולמי' : 'Exclusive offers on World Dog Day', icon: Gift },
                    { key: 'blackFridayEnabled', label: isHebrew ? 'Black Friday 🖤' : 'Black Friday 🖤', desc: isHebrew ? 'עסקאות בלעדיות בבלאק פריידי' : 'Exclusive Black Friday deals on all services', icon: Snowflake },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <item.icon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-gray-900 font-medium">{item.label}</p>
                          <p className="text-gray-500 text-sm">{item.desc}</p>
                        </div>
                      </div>
                      <Switch 
                        checked={profile.notificationPreferences?.[item.key as keyof typeof profile.notificationPreferences] ?? true}
                        onCheckedChange={(checked) => {
                          updateProfileMutation.mutate({
                            notificationPreferences: {
                              ...profile.notificationPreferences,
                              [item.key]: checked,
                            }
                          });
                        }}
                        className="data-[state=checked]:bg-gray-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6 space-y-5">

              {/* ── Face ID / Passkeys ── */}
              <div className="pw-section-card">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center">
                    <span className="text-lg">🔑</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{isHebrew ? 'Face ID / Passkeys' : 'Face ID / Passkeys'}</h3>
                    <p className="text-xs text-gray-400">{isHebrew ? 'כניסה מהירה עם טביעת אצבע או זיהוי פנים — ללא סיסמה' : 'Sign in instantly with fingerprint or face — no password needed'}</p>
                  </div>
                </div>

                {passkeysLoading ? (
                  <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : passkeys.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-100 p-6 text-center mb-4">
                    <div className="text-4xl mb-2">🔐</div>
                    <p className="text-sm font-medium text-gray-500">{isHebrew ? 'עדיין לא רשומה שיטת כניסה ביומטרית' : 'No biometric login registered yet'}</p>
                    <p className="text-xs text-gray-400 mt-1">{isHebrew ? 'לחץ על הכפתור למטה כדי לרשום את המכשיר שלך' : 'Tap the button below to register this device'}</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {passkeys.map((pk: any) => (
                      <div key={pk.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{pk.deviceIcon || '📱'}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{pk.deviceName || (isHebrew ? 'מכשיר' : 'Device')}</p>
                            <p className="text-xs text-gray-400">
                              {pk.lastUsedAt ? `${isHebrew ? 'נוצל לאחרונה' : 'Last used'}: ${new Date(pk.lastUsedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}` : (isHebrew ? 'טרם נוצל' : 'Never used')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pk.trustScore !== undefined && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pk.trustScore >= 75 ? 'bg-green-100 text-green-700' : pk.trustScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {pk.trustScore}%
                            </span>
                          )}
                          <button
                            onClick={() => revokePasskeyMutation.mutate(pk.id)}
                            disabled={revokePasskeyMutation.isPending}
                            className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title={isHebrew ? 'הסר מכשיר' : 'Remove device'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => registerPasskeyMutation.mutate()}
                  onKeyDown={e => e.key === 'Enter' && registerPasskeyMutation.mutate()}
                  style={{ background: registerPasskeyMutation.isPending ? '#6b7280' : '#000000', cursor: 'pointer' }}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-white font-semibold text-sm transition-all"
                >
                  {registerPasskeyMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {isHebrew ? 'ממתין לאישור...' : 'Waiting for approval...'}</>
                    : <><span className="text-base">🔐</span> {isHebrew ? 'רשום Face ID / טביעת אצבע למכשיר זה' : 'Register Face ID / Fingerprint for this device'}</>}
                </div>
                {passkeys.length > 0 && (
                  <p className="text-center text-xs text-green-600 font-medium mt-2.5 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isHebrew ? `${passkeys.length} מכשיר${passkeys.length > 1 ? 'ים' : ''} רשומ${passkeys.length > 1 ? 'ים' : ''} — הכניסה הביומטרית פעילה` : `${passkeys.length} device${passkeys.length > 1 ? 's' : ''} registered — biometric login active`}
                  </p>
                )}
              </div>

              {/* ── Two-Factor Authentication ── */}
              <div className="pw-section-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{isHebrew ? 'אימות דו-שלבי (2FA)' : 'Two-Step Verification (2FA)'}</h3>
                    <p className="text-xs text-gray-400">{isHebrew ? 'דרוש קוד SMS נוסף לכל הזמנה ותשלום' : 'Require an extra SMS code for every booking & payment'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {isHebrew ? 'הפעל אימות דו-שלבי' : 'Enable Two-Step Verification'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {profile.twoFactorEnabled
                        ? (isHebrew ? '✅ פעיל — נדרש קוד SMS לפני כל תשלום' : '✅ Active — SMS code required before every payment')
                        : (isHebrew ? 'מכובה — הפעל להגנה נוספת' : 'Off — enable for extra protection')}
                    </p>
                  </div>
                  <Switch
                    checked={profile.twoFactorEnabled ?? false}
                    onCheckedChange={(checked) => {
                      updateProfileMutation.mutate({ twoFactorEnabled: checked });
                    }}
                    className="data-[state=checked]:bg-gray-900"
                  />
                </div>

                {profile.twoFactorEnabled && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-xl px-4 py-3">
                    <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {isHebrew
                        ? `קוד יישלח אל ${phoneStatus?.phone || profile?.phone || 'הטלפון שלך'} לפני כל הזמנה ותשלום.`
                        : `A code will be sent to ${phoneStatus?.phone || profile?.phone || 'your phone'} before every booking and payment.`}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Account Actions ── */}
              <div className="pw-section-card">
                <h3 className="text-base font-bold text-gray-900 mb-4">{isHebrew ? 'פרטיות ומכשירים' : 'Privacy & Devices'}</h3>
                <div className="space-y-2">
                  <a
                    href="/my-devices"
                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 cursor-pointer group hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{isHebrew ? 'המכשירים שלי' : 'My Devices'}</p>
                        <p className="text-xs text-gray-500">{isHebrew ? 'ניהול מכשירים מחוברים לחשבון' : 'Manage devices connected to your account'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                  </a>

                  <Button
                    onClick={() => exportDataMutation.mutate()}
                    disabled={exportDataMutation.isPending}
                    variant="ghost"
                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 cursor-pointer group w-full h-auto hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-4">
                      <Download className="w-5 h-5 text-gray-400" />
                      <div className="text-start">
                        <p className="text-sm font-semibold text-gray-800">{isHebrew ? 'הורד את הנתונים שלי' : 'Download My Data'}</p>
                        <p className="text-xs text-gray-500">{isHebrew ? 'ייצוא כל המידע (GDPR)' : 'Export all your data (GDPR)'}</p>
                      </div>
                    </div>
                    {exportDataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />}
                  </Button>
                </div>
              </div>

              {/* E-Gift Policy Notice */}
              <div className="bg-white rounded-3xl border border-amber-100 p-6">
                <div className="flex items-start gap-4">
                  <Ban className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-800 font-semibold mb-1">
                      {isHebrew ? 'מדיניות כרטיסי מתנה' : 'E-Gift Card Policy'}
                    </h4>
                    <p className="text-amber-700 text-sm">
                      {isHebrew 
                        ? 'כרטיסי המתנה שלך קשורים לחשבון שלך באופן קבוע ולא ניתנים להעברה לאחרים. במקרה של מחיקת חשבון, יתרת כרטיסי המתנה תפקע.'
                        : 'Your e-gift cards are permanently tied to your account and cannot be transferred to others. In case of account deletion, e-gift balances will be forfeited.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Management - Freeze & Delete */}
              <div className="pw-section-card">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                  {isHebrew ? 'ניהול חשבון' : 'Account Management'}
                </h3>

                {/* Account Status Banner */}
                {accountStatus?.status === 'frozen' && (
                  <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Snowflake className="w-6 h-6 text-blue-500" />
                      <span className="text-blue-700 font-semibold">
                        {isHebrew ? 'החשבון מוקפא' : 'Account Frozen'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-4">
                      {isHebrew 
                        ? 'החשבון שלך מוקפא זמנית. כל הזכויות והנקודות שלך נשמרות.'
                        : 'Your account is temporarily frozen. All your credits and points are preserved.'}
                    </p>
                    <Button
                      onClick={() => unfreezeAccountMutation.mutate()}
                      disabled={unfreezeAccountMutation.isPending}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {unfreezeAccountMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {isHebrew ? 'הפעל מחדש את החשבון' : 'Reactivate Account'}
                    </Button>
                  </div>
                )}

                {accountStatus?.status === 'pending_deletion' && (
                  <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                      <span className="text-red-700 font-semibold">
                        {isHebrew ? 'החשבון ממתין למחיקה' : 'Account Pending Deletion'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-2">
                      {isHebrew 
                        ? `החשבון שלך מתוזמן למחיקה. תוכל לבטל את הבקשה עד תום תקופת החסד.`
                        : `Your account is scheduled for deletion. You can cancel within the grace period.`}
                    </p>
                    <Button
                      onClick={() => cancelDeletionMutation.mutate()}
                      disabled={cancelDeletionMutation.isPending}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      {cancelDeletionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {isHebrew ? 'בטל מחיקה ושחזר חשבון' : 'Cancel Deletion & Restore'}
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Freeze Account */}
                  <Button
                    onClick={() => setShowFreezeDialog(true)}
                    disabled={accountStatus?.status === 'frozen' || accountStatus?.status === 'pending_deletion'}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 transition-colors cursor-pointer group w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-4">
                      <Snowflake className="w-5 h-5 text-blue-500" />
                      <div className="text-start">
                        <p className="text-gray-900 font-medium">{isHebrew ? 'הקפא את החשבון' : 'Freeze Account'}</p>
                        <p className="text-gray-500 text-sm">
                          {isHebrew 
                            ? 'השהה את החשבון באופן זמני - כל הזכויות נשמרות'
                            : 'Temporarily suspend your account - all credits preserved'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 transition-colors" />
                  </Button>

                  {/* Delete Account */}
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={accountStatus?.status === 'pending_deletion'}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 transition-colors cursor-pointer group w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-4">
                      <Trash2 className="w-5 h-5 text-red-500" />
                      <div className="text-start">
                        <p className="text-red-600 font-medium">{isHebrew ? 'מחק את החשבון' : 'Delete Account'}</p>
                        <p className="text-gray-500 text-sm">
                          {isHebrew 
                            ? 'מחיקה לצמיתות עם תקופת חסד של 30 יום'
                            : 'Permanent deletion with 30-day grace period'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Freeze Account Dialog */}
            <Dialog open={showFreezeDialog} onOpenChange={setShowFreezeDialog}>
              <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl">
                    <Snowflake className="w-6 h-6 text-blue-500" />
                    {isHebrew ? 'הקפא את החשבון' : 'Freeze Account'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-500">
                    {isHebrew 
                      ? 'השהיית החשבון שומרת על כל הנתונים, הזכויות והנקודות שלך. לא תוכל לבצע הזמנות חדשות עד להפשרה.'
                      : 'Freezing preserves all your data, credits and points. You won\'t be able to make new bookings until unfrozen.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-gray-600 mb-2 block">
                      {isHebrew ? 'סיבה להקפאה' : 'Reason for freezing'}
                    </Label>
                    <Select value={freezeReason} onValueChange={setFreezeReason}>
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                        <SelectValue placeholder={isHebrew ? 'בחר סיבה' : 'Select reason'} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="vacation">{isHebrew ? 'חופשה' : 'Vacation'}</SelectItem>
                        <SelectItem value="financial">{isHebrew ? 'סיבות כלכליות' : 'Financial reasons'}</SelectItem>
                        <SelectItem value="temporary_break">{isHebrew ? 'הפסקה זמנית' : 'Temporary break'}</SelectItem>
                        <SelectItem value="other">{isHebrew ? 'אחר' : 'Other'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-600 mb-2 block">
                      {isHebrew ? 'משך ההקפאה (אופציונלי)' : 'Freeze duration (optional)'}
                    </Label>
                    <Select 
                      value={freezeDuration?.toString() || ''} 
                      onValueChange={(v) => setFreezeDuration(v ? parseInt(v) : undefined)}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                        <SelectValue placeholder={isHebrew ? 'ללא הגבלה' : 'Indefinite'} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="">{isHebrew ? 'ללא הגבלה' : 'Indefinite'}</SelectItem>
                        <SelectItem value="7">{isHebrew ? 'שבוע אחד' : '1 week'}</SelectItem>
                        <SelectItem value="30">{isHebrew ? 'חודש אחד' : '1 month'}</SelectItem>
                        <SelectItem value="90">{isHebrew ? '3 חודשים' : '3 months'}</SelectItem>
                        <SelectItem value="180">{isHebrew ? '6 חודשים' : '6 months'}</SelectItem>
                        <SelectItem value="365">{isHebrew ? 'שנה' : '1 year'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-blue-700 text-sm font-medium mb-2">
                      {isHebrew ? 'מה נשמר:' : 'What\'s preserved:'}
                    </p>
                    <ul className="text-gray-500 text-sm space-y-1">
                      <li>• {isHebrew ? 'כל יתרות כרטיסי המתנה' : 'All e-gift card balances'}</li>
                      <li>• {isHebrew ? 'נקודות נאמנות ודרגה' : 'Loyalty points & tier'}</li>
                      <li>• {isHebrew ? 'חבילות שטיפה' : 'Wash packages'}</li>
                      <li>• {isHebrew ? 'היסטוריית הזמנות' : 'Booking history'}</li>
                      <li>• {isHebrew ? 'פרופילי חיות מחמד' : 'Pet profiles'}</li>
                    </ul>
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowFreezeDialog(false)}
                    className="border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {isHebrew ? 'ביטול' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => freezeAccountMutation.mutate({ 
                      reason: freezeReason || 'other',
                      freezeDurationDays: freezeDuration,
                    })}
                    disabled={!freezeReason || freezeAccountMutation.isPending}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {freezeAccountMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {isHebrew ? 'הקפא חשבון' : 'Freeze Account'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Account Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                    {isHebrew ? 'מחיקת חשבון' : 'Delete Account'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-500">
                    {isHebrew 
                      ? 'פעולה זו תמחק את החשבון שלך לצמיתות לאחר תקופת חסד של 30 יום. תוכל לבטל בכל עת במהלך תקופה זו.'
                      : 'This will permanently delete your account after a 30-day grace period. You can cancel anytime during this period.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-red-700 text-sm font-medium mb-2">
                      {isHebrew ? 'מה יימחק לצמיתות:' : 'What will be permanently deleted:'}
                    </p>
                    <ul className="text-gray-500 text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        {isHebrew ? 'כל יתרות כרטיסי המתנה (לא ניתנים להעברה!)' : 'All e-gift balances (non-transferable!)'}
                      </li>
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        {isHebrew ? 'נקודות נאמנות ודרגה' : 'Loyalty points & tier'}
                      </li>
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        {isHebrew ? 'חבילות שטיפה שלא נוצלו' : 'Unused wash packages'}
                      </li>
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        {isHebrew ? 'קופונים והנחות' : 'Coupons & discounts'}
                      </li>
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-500" />
                        {isHebrew ? 'כל המידע האישי' : 'All personal information'}
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <p className="text-gray-700 text-sm font-medium">
                      {isHebrew ? 'אשר שאתה מבין:' : 'Confirm you understand:'}
                    </p>
                    
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox 
                        checked={deleteAcknowledgements.credits}
                        onCheckedChange={(checked) => setDeleteAcknowledgements(prev => ({ ...prev, credits: !!checked }))}
                        className="mt-0.5 border-gray-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                      />
                      <span className="text-gray-500 text-sm">
                        {isHebrew 
                          ? 'אני מבין/ה שכל הזכויות, הנקודות וחבילות השטיפה יאבדו לצמיתות.'
                          : 'I understand all credits, points and wash packages will be permanently lost.'}
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox 
                        checked={deleteAcknowledgements.egift}
                        onCheckedChange={(checked) => setDeleteAcknowledgements(prev => ({ ...prev, egift: !!checked }))}
                        className="mt-0.5 border-gray-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                      />
                      <span className="text-gray-500 text-sm">
                        {isHebrew 
                          ? 'אני מבין/ה שכרטיסי מתנה אינם ניתנים להעברה ויפקעו עם מחיקת החשבון.'
                          : 'I understand e-gift cards are non-transferable and will be forfeited upon deletion.'}
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox 
                        checked={deleteAcknowledgements.data}
                        onCheckedChange={(checked) => setDeleteAcknowledgements(prev => ({ ...prev, data: !!checked }))}
                        className="mt-0.5 border-gray-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                      />
                      <span className="text-gray-500 text-sm">
                        {isHebrew 
                          ? 'אני מבין/ה שכל המידע שלי יימחק לצמיתות ולא ניתן יהיה לשחזר אותו.'
                          : 'I understand all my data will be permanently deleted and cannot be recovered.'}
                      </span>
                    </label>
                  </div>

                  <div>
                    <Label className="text-gray-600 mb-2 block">
                      {isHebrew ? 'הקלד "DELETE MY ACCOUNT" לאישור:' : 'Type "DELETE MY ACCOUNT" to confirm:'}
                    </Label>
                    <Input
                      value={deleteConfirmPhrase}
                      onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                      placeholder="DELETE MY ACCOUNT"
                      className="bg-white border-gray-200 text-gray-900 font-mono"
                    />
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setDeleteConfirmPhrase('');
                      setDeleteAcknowledgements({ credits: false, data: false, egift: false });
                    }}
                    className="border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {isHebrew ? 'ביטול' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => deleteAccountMutation.mutate({
                      confirmPhrase: deleteConfirmPhrase,
                      acknowledgeCreditsLoss: deleteAcknowledgements.credits,
                      acknowledgeDataLoss: deleteAcknowledgements.data,
                      acknowledgeEgiftForfeiture: deleteAcknowledgements.egift,
                    })}
                    disabled={
                      deleteConfirmPhrase !== 'DELETE MY ACCOUNT' ||
                      !deleteAcknowledgements.credits ||
                      !deleteAcknowledgements.data ||
                      !deleteAcknowledgements.egift ||
                      deleteAccountMutation.isPending
                    }
                    className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteAccountMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {isHebrew ? 'מחק את החשבון שלי' : 'Delete My Account'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Email Change Dialog */}
            <Dialog open={showEmailChangeDialog} onOpenChange={(open) => {
              setShowEmailChangeDialog(open);
              if (!open) {
                setNewEmail('');
                setEmailVerificationCode('');
                setEmailChangeStep('request');
              }
            }}>
              <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-xl">
                    <Mail className="w-6 h-6 text-gray-400" />
                    {isHebrew ? 'שינוי כתובת אימייל' : 'Change Email Address'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-500">
                    {emailChangeStep === 'request'
                      ? (isHebrew 
                          ? 'הזן את כתובת האימייל החדשה. נשלח קוד אימות לאימייל החדש.'
                          : 'Enter your new email address. We\'ll send a verification code to the new email.')
                      : (isHebrew
                          ? 'הזן את קוד האימות שנשלח לאימייל החדש שלך.'
                          : 'Enter the verification code sent to your new email.')}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {emailChangeStep === 'request' ? (
                    <>
                      <div>
                        <Label className="text-gray-600 mb-2 block">
                          {isHebrew ? 'אימייל נוכחי' : 'Current Email'}
                        </Label>
                        <Input
                          value={profile?.email || firebaseUser?.email || ''}
                          disabled
                          className="bg-white border-gray-200 text-gray-400"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-600 mb-2 block">
                          {isHebrew ? 'אימייל חדש' : 'New Email'}
                        </Label>
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder={isHebrew ? 'הזן אימייל חדש' : 'Enter new email'}
                          className="bg-white border-gray-200 text-gray-900"
                        />
                      </div>

                      <div className="p-4 rounded-xl bg-white border border-amber-200">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                          <p className="text-gray-500 text-sm">
                            {isHebrew 
                              ? 'לאחר שינוי האימייל, תצטרך להתחבר מחדש עם הכתובת החדשה.'
                              : 'After changing your email, you\'ll need to sign in again with the new address.'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                          <KeyRound className="w-8 h-8 text-stone-700" />
                        </div>
                        <p className="text-gray-500">
                          {isHebrew ? 'קוד אימות נשלח אל:' : 'Verification code sent to:'}
                        </p>
                        <p className="text-gray-900 font-medium">{newEmail}</p>
                      </div>

                      <div>
                        <Label className="text-gray-600 mb-2 block">
                          {isHebrew ? 'קוד אימות (6 ספרות)' : 'Verification Code (6 digits)'}
                        </Label>
                        <Input
                          type="text"
                          maxLength={6}
                          value={emailVerificationCode}
                          onChange={(e) => setEmailVerificationCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="bg-white border-gray-200 text-gray-900 text-center text-2xl font-mono tracking-widest"
                        />
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowEmailChangeDialog(false);
                      setNewEmail('');
                      setEmailVerificationCode('');
                      setEmailChangeStep('request');
                    }}
                    className="border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {isHebrew ? 'ביטול' : 'Cancel'}
                  </Button>
                  
                  {emailChangeStep === 'request' ? (
                    <Button
                      onClick={() => requestEmailChangeMutation.mutate({ newEmail })}
                      disabled={!newEmail || !newEmail.includes('@') || requestEmailChangeMutation.isPending}
                      className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {requestEmailChangeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isHebrew ? 'שלח קוד אימות' : 'Send Verification Code'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => confirmEmailChangeMutation.mutate({ verificationCode: emailVerificationCode })}
                      disabled={emailVerificationCode.length !== 6 || confirmEmailChangeMutation.isPending}
                      className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {confirmEmailChangeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isHebrew ? 'אשר שינוי' : 'Confirm Change'}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Phone Verification Dialog */}
            <Dialog open={showPhoneVerifyDialog} onOpenChange={(open) => {
              setShowPhoneVerifyDialog(open);
              if (!open) {
                setPhoneNumber('');
                setPhoneVerificationCode('');
                phoneVerification.reset();
              }
            }}>
              <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    {isHebrew ? 'אימות מספר טלפון' : 'Verify Phone Number'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-500">
                    {isHebrew 
                      ? 'קוד אימות יישלח אליך ב-SMS דרך Firebase של Google.'
                      : 'A verification code will be sent via SMS through Google Firebase.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {phoneVerification.step === 'idle' || phoneVerification.step === 'sending' || phoneVerification.step === 'error' ? (
                    <>
                      <div>
                        <Label className="text-gray-600 mb-2 block">
                          {isHebrew ? 'מספר טלפון' : 'Phone Number'}
                        </Label>
                        <PhoneInput
                          value={phoneNumber}
                          onChange={setPhoneNumber}
                          language={isHebrew ? 'he' : 'en'}
                          defaultCountry="IL"
                        />
                      </div>

                      {phoneVerification.error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                          <p className="text-red-600 text-sm">{phoneVerification.error}</p>
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-white border border-stone-200">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-stone-700 flex-shrink-0 mt-0.5" />
                          <p className="text-gray-500 text-sm">
                            {isHebrew 
                              ? 'אימות טלפון מאובטח על ידי Google Firebase Authentication עם הגנת reCAPTCHA.'
                              : 'Phone verification is secured by Google Firebase Authentication with reCAPTCHA protection.'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                          <KeyRound className="w-8 h-8 text-stone-700" />
                        </div>
                        <p className="text-gray-500">
                          {isHebrew ? 'קוד אימות נשלח ב-SMS אל:' : 'Verification code sent via SMS to:'}
                        </p>
                        <p className="text-gray-900 font-medium">{phoneNumber}</p>
                      </div>

                      <div>
                        <Label className="text-gray-600 mb-2 block">
                          {isHebrew ? 'קוד אימות (6 ספרות)' : 'Verification Code (6 digits)'}
                        </Label>
                        <Input
                          type="text"
                          maxLength={6}
                          value={phoneVerificationCode}
                          onChange={(e) => setPhoneVerificationCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="bg-white border-gray-200 text-gray-900 text-center text-2xl font-mono tracking-widest"
                          dir="ltr"
                        />
                      </div>

                      {phoneVerification.error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                          <p className="text-red-600 text-sm">{phoneVerification.error}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPhoneVerifyDialog(false);
                      setPhoneNumber('');
                      setPhoneVerificationCode('');
                      phoneVerification.reset();
                    }}
                    className="border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {isHebrew ? 'ביטול' : 'Cancel'}
                  </Button>
                  
                  {phoneVerification.step === 'idle' || phoneVerification.step === 'sending' || phoneVerification.step === 'error' ? (
                    <Button
                      onClick={handleSendPhoneCode}
                      disabled={!phoneNumber || phoneNumber.length < 9 || phoneVerification.isSending}
                      className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {phoneVerification.isSending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isHebrew ? 'שלח קוד SMS' : 'Send SMS Code'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneVerificationCode.length !== 6 || confirmPhoneVerificationMutation.isPending}
                      className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                      {confirmPhoneVerificationMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isHebrew ? 'אמת טלפון' : 'Verify Phone'}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* reCAPTCHA container for Firebase phone auth */}
            <div id="recaptcha-container-phone" />

            {/* ── PETS TAB ── */}
            <TabsContent value="pets" className="mt-6 space-y-4">

              {/* ── Birthday Countdown Hub ── */}
              {(() => {
                const birthdayEntries: { id: string; name: string; birthday: string; emoji: string; isOwner?: boolean }[] = [];
                if (profile?.birthdate) birthdayEntries.push({ id: 'owner', name: isHebrew ? 'יום ההולדת שלי' : 'My Birthday', birthday: profile.birthdate, emoji: '🎂', isOwner: true });
                (petsData?.pets || []).forEach((p: any) => { if (p.birthday) birthdayEntries.push({ id: p.id, name: p.name, birthday: p.birthday, emoji: p.species === 'cat' ? '🐱' : p.species === 'bird' ? '🐦' : p.species === 'fish' ? '🐠' : p.species === 'rabbit' ? '🐰' : '🐶' }); });
                const sorted = birthdayEntries.sort((a, b) => daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday));

                if (sorted.length === 0) return null;
                return (
                  <div className="pw-section-card">
                    <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Cake className="w-5 h-5 text-pink-500" />
                      {isHebrew ? 'ימי הולדת קרובים' : 'Upcoming Birthdays'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sorted.map(entry => {
                        const days = daysUntilBirthday(entry.birthday);
                        const dateStr = nextBirthdayDate(entry.birthday);
                        const isToday = days === 0 || days === 365;
                        const isSoon = days <= 14;
                        const calUrl = (() => {
                          const [, m, d] = entry.birthday.split('-');
                          const today = new Date();
                          const yr = today.getFullYear() + (daysUntilBirthday(entry.birthday) > 300 ? 1 : 0);
                          const dateStr = `${yr}${m.padStart(2,'0')}${d.padStart(2,'0')}`;
                          const title = encodeURIComponent(`יום הולדת של ${entry.name} 🎂`);
                          return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}`;
                        })();
                        return (
                          <div key={entry.id} className={`rounded-xl border p-4 flex flex-col gap-2 ${isToday ? 'border-pink-300 bg-pink-50' : isSoon ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{entry.emoji}</span>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                                  <p className="text-xs text-gray-500">{dateStr}</p>
                                </div>
                              </div>
                              {isToday ? (
                                <span className="flex items-center gap-1 text-xs font-semibold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5">
                                  <PartyPopper className="w-3 h-3" />
                                  {isHebrew ? 'היום!' : 'Today!'}
                                </span>
                              ) : (
                                <span className={`flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${isSoon ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-200'}`}>
                                  <Timer className="w-3 h-3" />
                                  {isHebrew ? `עוד ${days} ימים` : `${days}d`}
                                </span>
                              )}
                            </div>
                            <a
                              href={calUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <CalendarCheck className="w-3 h-3" />
                              {isHebrew ? 'הוסף ליומן Google' : 'Add to Google Calendar'}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── My Pets — Luxury Cards ── */}
              <div className="pw-section-card">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">{isHebrew ? 'חיות המחמד שלי 🐾' : 'My Pets 🐾'}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{isHebrew ? 'פרופיל · חיסונים · יומן הולדת' : 'Profile · Vaccines · Birthday Calendar'}</p>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenPetForm()}
                    onKeyDown={e => e.key === 'Enter' && handleOpenPetForm()}
                    style={{ background: '#000000', cursor: 'pointer' }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {isHebrew ? 'הוסף חיה' : 'Add Pet'}
                  </div>
                </div>

                {petsLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
                  </div>
                ) : (!petsData?.pets || petsData.pets.length === 0) ? (
                  <div className="py-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Dog className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">{isHebrew ? 'טרם נוספו חיות מחמד' : 'No pets added yet'}</p>
                    <p className="text-xs text-gray-300 mt-1">{isHebrew ? 'לחץ "הוסף חיה" כדי להתחיל' : 'Tap "Add Pet" to get started'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {petsData.pets.map((pet: any) => {
                      const emoji = getPetEmoji(pet.species);
                      const bDays = pet.birthday ? daysUntilBirthday(pet.birthday) : -1;
                      const bDate = pet.birthday ? nextBirthdayDate(pet.birthday) : '';
                      const birthdayUrgent = bDays >= 0 && bDays <= 7;
                      const birthdaySoon = bDays >= 0 && bDays <= 30;
                      const hasVaccines = pet.vaccineDates && Object.keys(pet.vaccineDates).some(k => pet.vaccineDates[k]?.lastGiven || pet.vaccineDates[k]?.dueDate);
                      return (
                        <div key={pet.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                          {/* Card header */}
                          <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50/70">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-2xl select-none">
                                {emoji}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm leading-tight">{pet.name}</p>
                                <p className="text-xs text-gray-400 capitalize">
                                  {PET_SPECIES.find(s => s.value === pet.species)?.[isHebrew ? 'labelHe' : 'labelEn'] ?? pet.species}
                                  {pet.breed ? ` · ${pet.breed}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenPetForm(pet)}
                                className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
                                title={isHebrew ? 'ערוך' : 'Edit'}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deletePetMutation.mutate(pet.id)}
                                disabled={deletePetMutation.isPending}
                                className="w-8 h-8 rounded-full bg-white border border-red-100 flex items-center justify-center text-red-300 hover:text-red-500 hover:border-red-300 transition-colors shadow-sm"
                                title={isHebrew ? 'הסר' : 'Remove'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Birthday row */}
                          {pet.birthday && (
                            <div className={`flex items-center justify-between px-4 py-3 border-t ${birthdayUrgent ? 'bg-amber-50 border-amber-100' : birthdaySoon ? 'bg-orange-50/40 border-orange-100/60' : 'bg-white border-gray-100'}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-base">{birthdayUrgent ? '🎉' : '🎂'}</span>
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">
                                    {isHebrew ? 'יום הולדת' : 'Birthday'} · {bDate}
                                  </p>
                                  <p className={`text-[11px] font-medium ${birthdayUrgent ? 'text-amber-600' : birthdaySoon ? 'text-orange-500' : 'text-gray-400'}`}>
                                    {bDays === 0 ? (isHebrew ? '🎊 היום!' : '🎊 Today!') : `${bDays} ${isHebrew ? 'ימים' : 'days'}`}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={buildPetBirthdayCalendarUrl(pet.name, pet.birthday, emoji)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-colors"
                                title={isHebrew ? 'הוסף ליומן Google (חוזר שנתי)' : 'Add to Google Calendar (yearly)'}
                              >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                {isHebrew ? 'יומן' : 'Calendar'}
                              </a>
                            </div>
                          )}

                          {/* Vaccines */}
                          {hasVaccines && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">{isHebrew ? 'חיסונים' : 'Vaccines'}</p>
                              <div className="space-y-2">
                                {Object.entries(pet.vaccineDates).filter(([, vVal]: [string, any]) => vVal?.lastGiven || vVal?.dueDate).map(([vKey, vVal]: [string, any]) => {
                                  const label = VACCINE_LABELS[vKey] ?? { en: vKey, he: vKey };
                                  const isDueSoon = vVal?.dueDate && daysUntilBirthday(vVal.dueDate) <= 30;
                                  return (
                                    <div key={vKey} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs border ${isDueSoon ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                                      <span className="font-semibold text-gray-700">💉 {isHebrew ? label.he : label.en}</span>
                                      <div className="flex items-center gap-2">
                                        {vVal?.lastGiven && <span className="text-gray-400">{isHebrew ? 'ניתן' : 'Given'}: {vVal.lastGiven}</span>}
                                        {vVal?.dueDate && (
                                          <>
                                            <span className={`font-medium ${isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>{isHebrew ? 'מועד' : 'Due'}: {vVal.dueDate}</span>
                                            <a
                                              href={buildGoogleCalendarUrl(pet.name, isHebrew ? label.he : label.en, vVal.dueDate)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-500 hover:text-blue-700"
                                              title={isHebrew ? 'הוסף ליומן Google' : 'Add to Google Calendar'}
                                            >
                                              <CalendarCheck className="w-3.5 h-3.5" />
                                            </a>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Allergies — always prominent if filled */}
                          {pet.allergies && (
                            <div className="px-4 py-3 border-t border-red-100 bg-red-50">
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1.5">⚠️ {isHebrew ? 'אלרגיות' : 'Allergies'}</p>
                              <p className="text-xs text-red-700 leading-relaxed">{pet.allergies}</p>
                            </div>
                          )}

                          {/* Food preferences */}
                          {(pet.favoriteFoods || pet.dislikedFoods) && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🍽️ {isHebrew ? 'העדפות אוכל' : 'Food Preferences'}</p>
                              <div className="space-y-1.5">
                                {pet.favoriteFoods && (
                                  <div className="flex gap-2 text-xs">
                                    <span className="text-green-600 font-semibold whitespace-nowrap">❤️ {isHebrew ? 'אוהב:' : 'Loves:'}</span>
                                    <span className="text-gray-600">{pet.favoriteFoods}</span>
                                  </div>
                                )}
                                {pet.dislikedFoods && (
                                  <div className="flex gap-2 text-xs">
                                    <span className="text-gray-400 font-semibold whitespace-nowrap">🚫 {isHebrew ? 'לא אוהב:' : 'Avoids:'}</span>
                                    <span className="text-gray-500">{pet.dislikedFoods}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Habits & Routine */}
                          {(pet.habits || pet.routine) && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🐾 {isHebrew ? 'אישיות ושגרה' : 'Personality & Routine'}</p>
                              <div className="space-y-2">
                                {pet.habits && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 mb-0.5">{isHebrew ? 'הרגלים' : 'Habits'}</p>
                                    <p className="text-xs text-gray-600 leading-relaxed">{pet.habits}</p>
                                  </div>
                                )}
                                {pet.routine && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 mb-0.5">{isHebrew ? 'שגרת יום' : 'Daily Routine'}</p>
                                    <p className="text-xs text-gray-600 leading-relaxed">{pet.routine}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Physical details row */}
                          {(pet.weight || pet.color || pet.microchip) && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                              <div className="flex flex-wrap gap-3 text-xs">
                                {pet.weight && <span className="text-gray-500">⚖️ {pet.weight} kg</span>}
                                {pet.color && <span className="text-gray-500">🎨 {pet.color}</span>}
                                {pet.microchip && <span className="text-gray-500">🔖 {pet.microchip}</span>}
                              </div>
                            </div>
                          )}

                          {/* Vet info */}
                          {(pet.vetName || pet.vetPhone) && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">🏥 {isHebrew ? 'וטרינר' : 'Vet'}</p>
                              <div className="flex items-center gap-4 text-xs">
                                {pet.vetName && <span className="text-gray-700 font-medium">{pet.vetName}</span>}
                                {pet.vetPhone && (
                                  <a href={`tel:${pet.vetPhone}`} className="text-blue-600 hover:underline font-medium">
                                    📞 {pet.vetPhone}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {pet.notes && (
                            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">📝 {isHebrew ? 'הערות' : 'Notes'}</p>
                              <p className="text-xs text-gray-500 leading-relaxed">{pet.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Pet Form Modal ── */}
              {showPetForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
                    {/* Modal header */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">
                          {editingPet ? (isHebrew ? '✏️ עריכת חיית מחמד' : '✏️ Edit Pet') : (isHebrew ? '🐾 הוספת חיית מחמד' : '🐾 Add a Pet')}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">{isHebrew ? 'מלא את פרטי החיה' : 'Fill in your pet\'s details'}</p>
                      </div>
                      <button onClick={() => setShowPetForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="px-6 py-5 space-y-5">
                      {/* Name */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{isHebrew ? 'שם החיה *' : 'Pet Name *'}</label>
                        <input
                          type="text"
                          value={petFormData.name}
                          onChange={e => setPetFormData((p: any) => ({ ...p, name: e.target.value }))}
                          className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-black transition-colors"
                          placeholder={isHebrew ? 'לדוגמה: מקס, בלה, קוקי...' : 'e.g. Max, Luna, Charlie...'}
                          style={{ fontSize: '16px' }}
                          dir="rtl"
                          autoFocus
                        />
                      </div>

                      {/* Species selector — icon grid */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{isHebrew ? 'סוג החיה' : 'Species'}</label>
                        <div className="grid grid-cols-4 gap-2">
                          {PET_SPECIES.map(sp => (
                            <button
                              key={sp.value}
                              type="button"
                              onClick={() => setPetFormData((p: any) => ({ ...p, species: sp.value }))}
                              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-center ${petFormData.species === sp.value ? 'border-black bg-black/5' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}
                            >
                              <span className="text-xl">{sp.emoji}</span>
                              <span className="text-[10px] font-semibold text-gray-600">{isHebrew ? sp.labelHe : sp.labelEn}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Breed */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{isHebrew ? 'גזע (אופציונלי)' : 'Breed (optional)'}</label>
                        <input
                          type="text"
                          value={petFormData.breed}
                          onChange={e => setPetFormData((p: any) => ({ ...p, breed: e.target.value }))}
                          className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                          placeholder={isHebrew ? 'לדוגמה: גולדן רטריבר' : 'e.g. Golden Retriever'}
                          style={{ fontSize: '16px' }}
                        />
                      </div>

                      {/* Birthday */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          🎂 {isHebrew ? 'יום הולדת' : 'Birthday'}
                        </label>
                        <input
                          type="date"
                          value={petFormData.birthday}
                          onChange={e => setPetFormData((p: any) => ({ ...p, birthday: e.target.value }))}
                          className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                          style={{ fontSize: '16px' }}
                        />
                        {petFormData.birthday && (
                          <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {isHebrew ? `יום הולדת הבא: ${nextBirthdayDate(petFormData.birthday)} (${daysUntilBirthday(petFormData.birthday)} ימים)` : `Next birthday: ${nextBirthdayDate(petFormData.birthday)} (${daysUntilBirthday(petFormData.birthday)} days)`}
                          </p>
                        )}
                      </div>

                      {/* Vaccines */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                          💉 {isHebrew ? 'חיסונים ותזכורות' : 'Vaccines & Reminders'}
                        </label>
                        <div className="space-y-2.5">
                          {Object.entries(VACCINE_LABELS).map(([vKey, labels]) => (
                            <div key={vKey} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <p className="text-xs font-bold text-gray-700 mb-3">{isHebrew ? labels.he : labels.en}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'תאריך אחרון' : 'Last Given'}</label>
                                  <input
                                    type="date"
                                    value={petFormData.vaccineDates?.[vKey]?.lastGiven || ''}
                                    onChange={e => setPetFormData((p: any) => ({
                                      ...p,
                                      vaccineDates: { ...p.vaccineDates, [vKey]: { ...(p.vaccineDates?.[vKey] || {}), lastGiven: e.target.value } }
                                    }))}
                                    className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-white"
                                    style={{ fontSize: '14px' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'מועד הבא' : 'Due Date'}</label>
                                  <input
                                    type="date"
                                    value={petFormData.vaccineDates?.[vKey]?.dueDate || ''}
                                    onChange={e => setPetFormData((p: any) => ({
                                      ...p,
                                      vaccineDates: { ...p.vaccineDates, [vKey]: { ...(p.vaccineDates?.[vKey] || {}), dueDate: e.target.value } }
                                    }))}
                                    className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-white"
                                    style={{ fontSize: '14px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Physical Details ── */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                          📋 {isHebrew ? 'פרטים פיזיים' : 'Physical Details'}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'משקל (ק"ג)' : 'Weight (kg)'}</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={petFormData.weight}
                              onChange={e => setPetFormData((p: any) => ({ ...p, weight: e.target.value }))}
                              className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors"
                              placeholder="e.g. 4.5"
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'צבע / סימנים' : 'Color / Markings'}</label>
                            <input
                              type="text"
                              value={petFormData.color}
                              onChange={e => setPetFormData((p: any) => ({ ...p, color: e.target.value }))}
                              className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors"
                              placeholder={isHebrew ? 'לבן עם כתמים' : 'White with spots'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'מספר שבב / מיקרוצ\'יפ' : 'Microchip Number'}</label>
                          <input
                            type="text"
                            value={petFormData.microchip}
                            onChange={e => setPetFormData((p: any) => ({ ...p, microchip: e.target.value }))}
                            className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                            placeholder={isHebrew ? '15 ספרות...' : '15-digit chip number...'}
                            style={{ fontSize: '16px' }}
                          />
                        </div>
                      </div>

                      {/* ── Allergies & Food ── */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                          🍽️ {isHebrew ? 'אלרגיות ואוכל' : 'Allergies & Food'}
                        </label>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-semibold text-red-400 uppercase tracking-wide block mb-1">⚠️ {isHebrew ? 'אלרגיות (חשוב!)' : 'Allergies (important!)'}</label>
                            <textarea
                              value={petFormData.allergies}
                              onChange={e => setPetFormData((p: any) => ({ ...p, allergies: e.target.value }))}
                              rows={2}
                              className="w-full border-2 border-red-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 transition-colors resize-none"
                              placeholder={isHebrew ? 'לדוגמה: עוף, חיטה, חמאת בוטנים...' : 'e.g. Chicken, wheat, peanut butter...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-green-600 uppercase tracking-wide block mb-1">❤️ {isHebrew ? 'אוכל אהוב' : 'Favorite Foods'}</label>
                            <textarea
                              value={petFormData.favoriteFoods}
                              onChange={e => setPetFormData((p: any) => ({ ...p, favoriteFoods: e.target.value }))}
                              rows={2}
                              className="w-full border-2 border-green-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 transition-colors resize-none"
                              placeholder={isHebrew ? 'לדוגמה: טונה, גבינה, ירקות...' : 'e.g. Tuna, cheese, carrots...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">🚫 {isHebrew ? 'לא אוהב לאכול' : 'Dislikes / Avoids'}</label>
                            <textarea
                              value={petFormData.dislikedFoods}
                              onChange={e => setPetFormData((p: any) => ({ ...p, dislikedFoods: e.target.value }))}
                              rows={2}
                              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                              placeholder={isHebrew ? 'לדוגמה: לא אוהב ירקות ירוקים...' : 'e.g. Hates broccoli, dry food...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── Personality & Routine ── */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                          🐾 {isHebrew ? 'אישיות ושגרה' : 'Personality & Routine'}
                        </label>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'הרגלים ואופי' : 'Habits & Personality'}</label>
                            <textarea
                              value={petFormData.habits}
                              onChange={e => setPetFormData((p: any) => ({ ...p, habits: e.target.value }))}
                              rows={3}
                              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                              placeholder={isHebrew ? 'לדוגמה: אוהב לישון ביום, פחדן מרעשים חזקים, חייב לשחק כדור כל יום...' : 'e.g. Loves afternoon naps, scared of thunder, needs ball play every day...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'שגרת יום' : 'Daily Routine'}</label>
                            <textarea
                              value={petFormData.routine}
                              onChange={e => setPetFormData((p: any) => ({ ...p, routine: e.target.value }))}
                              rows={3}
                              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                              placeholder={isHebrew ? 'לדוגמה: 7:00 ארוחת בוקר, 8:00 טיול, 13:00 ארוחת צהריים, 19:00 ערב...' : 'e.g. 7am breakfast, 8am walk, 1pm nap, 6pm dinner, 9pm sleep...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── Vet Info ── */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                          🏥 {isHebrew ? 'פרטי וטרינר' : 'Vet Details'}
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'שם הוטרינר' : 'Vet Name'}</label>
                            <input
                              type="text"
                              value={petFormData.vetName}
                              onChange={e => setPetFormData((p: any) => ({ ...p, vetName: e.target.value }))}
                              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                              placeholder={isHebrew ? 'ד"ר...' : 'Dr. Smith...'}
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">{isHebrew ? 'טלפון וטרינר' : 'Vet Phone'}</label>
                            <input
                              type="tel"
                              value={petFormData.vetPhone}
                              onChange={e => setPetFormData((p: any) => ({ ...p, vetPhone: e.target.value }))}
                              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                              placeholder="03-123-4567"
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── General Notes ── */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          📝 {isHebrew ? 'הערות כלליות' : 'General Notes'}
                        </label>
                        <textarea
                          value={petFormData.notes}
                          onChange={e => setPetFormData((p: any) => ({ ...p, notes: e.target.value }))}
                          rows={3}
                          className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                          placeholder={isHebrew ? 'כל מידע נוסף שחשוב לדעת...' : 'Any other important info...'}
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                    </div>

                    {/* Sticky footer */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
                      <button
                        onClick={() => setShowPetForm(false)}
                        className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {isHebrew ? 'ביטול' : 'Cancel'}
                      </button>
                      <button
                        onClick={handleSubmitPet}
                        disabled={addPetMutation.isPending || updatePetMutation.isPending || !petFormData.name.trim()}
                        style={{ background: '#000000' }}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                      >
                        {(addPetMutation.isPending || updatePetMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                        {editingPet ? (isHebrew ? '✅ שמור שינויים' : '✅ Save Changes') : (isHebrew ? '🐾 הוסף חיה' : '🐾 Add Pet')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── DOCUMENTS TAB ── */}
            <TabsContent value="documents" className="mt-6 space-y-5">

              {/* ── Tax Invoices (חשבוניות מס) ── */}
              <div className="pw-section-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <span className="text-lg">🧾</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{isHebrew ? 'חשבוניות מס קבלה' : 'Tax Invoices'}</h3>
                      <p className="text-xs text-gray-400">{isHebrew ? 'כל החשבוניות שלך בפורמט ישראלי רשמי' : 'All invoices in official Israeli format'}</p>
                    </div>
                  </div>
                </div>

                {transactionsLoading ? (
                  <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : !myTransactions || myTransactions.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-100 p-8 text-center">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-sm text-gray-500">{isHebrew ? 'אין חשבוניות עדיין' : 'No invoices yet'}</p>
                    <p className="text-xs text-gray-400 mt-1">{isHebrew ? 'לאחר ביצוע הזמנה, חשבוניות יופיעו כאן' : 'After completing a booking, invoices will appear here'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-base">🧾</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {tx.serviceNameHe || tx.serviceName || (isHebrew ? 'שירות PetWash™' : 'PetWash™ Service')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US') : ''} · ₪{parseFloat(tx.totalAmount || tx.amount || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedInvoice(tx)}
                          style={{ background: '#000' }}
                          className="text-white text-xs font-semibold px-3 py-1.5 rounded-xl"
                        >
                          {isHebrew ? 'הצג' : 'View'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded invoice viewer */}
                {selectedInvoice && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-700">{isHebrew ? 'חשבונית מס מלאה' : 'Full Tax Invoice'}</h4>
                      <button onClick={() => setSelectedInvoice(null)} className="text-xs text-gray-400 hover:text-gray-600">
                        {isHebrew ? 'סגור' : 'Close'} ✕
                      </button>
                    </div>
                    <IsraeliTaxInvoice
                      language={isHebrew ? 'he' : 'en'}
                      data={buildInvoiceFromTransaction(
                        selectedInvoice,
                        profile?.displayName || user?.displayName || (isHebrew ? 'לקוח' : 'Customer'),
                        profile?.phone,
                        profile?.email || user?.email || undefined,
                      )}
                    />
                  </div>
                )}
              </div>

              {/* ── Signed Agreements ── */}
              <div className="pw-section-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center">
                    <span className="text-lg">✍️</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{isHebrew ? 'הסכמים חתומים' : 'Signed Agreements'}</h3>
                    <p className="text-xs text-gray-400">{isHebrew ? 'מסמכים שחתמת בפלטפורמה' : 'Documents you signed on the platform'}</p>
                  </div>
                </div>
                {!mySignedDocs || mySignedDocs.documents.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-100 p-6 text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-sm text-gray-500">{isHebrew ? 'אין הסכמים חתומים' : 'No signed agreements'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mySignedDocs.documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📄</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{doc.documentTitle}</p>
                            <p className="text-xs text-gray-400">{doc.signedDate ? new Date(doc.signedDate).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US') : ''}</p>
                          </div>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {isHebrew ? 'חתום' : 'Signed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Pet Intake Forms (Health Declarations) ── */}
              <div className="pw-section-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                      <span className="text-lg">🐾</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{isHebrew ? 'טפסי קבלה — הצהרות בריאות' : 'Intake Forms — Health Declarations'}</h3>
                      <p className="text-xs text-gray-400">{isHebrew ? 'נדרש לפני כל שירות' : 'Required before every service'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIntakeFormOpen(true)}
                    style={{ background: '#000' }}
                    className="text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5"
                  >
                    <span>+</span> {isHebrew ? 'טופס חדש' : 'New Form'}
                  </button>
                </div>

                {intakeFormsLoading ? (
                  <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : !intakeFormsData?.forms || intakeFormsData.forms.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-100 p-6 text-center">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm text-gray-500">{isHebrew ? 'טרם הוגשו טפסי קבלה' : 'No intake forms submitted yet'}</p>
                    <p className="text-xs text-gray-400 mt-1">{isHebrew ? 'לחץ על "טופס חדש" להגשת הצהרת בריאות לפני השירות הבא' : 'Click "New Form" to submit a health declaration before your next service'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {intakeFormsData.forms.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🐾</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{f.petName}</p>
                            <p className="text-xs text-gray-400">
                              {f.submittedAt ? new Date(f.submittedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US') : ''} · {isHebrew ? 'חתם:' : 'Signed:'} {f.signatureName}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {f.status === 'submitted' ? (isHebrew ? 'הוגש' : 'Submitted') : f.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Intake form modal */}
              {intakeFormOpen && (
                <PetIntakeForm
                  open={intakeFormOpen}
                  onClose={() => setIntakeFormOpen(false)}
                  onComplete={() => {
                    setIntakeFormOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['/api/pets/intake-forms'] });
                    toast({ title: isHebrew ? '✅ הצהרת הבריאות הוגשה!' : '✅ Health declaration submitted!' });
                  }}
                  petName={(pets?.[0] as any)?.name || (isHebrew ? 'חיית המחמד שלי' : 'My Pet')}
                  petSpecies={(pets?.[0] as any)?.species}
                  language={isHebrew ? 'he' : 'en'}
                />
              )}
            </TabsContent>

            {/* ── INBOX TAB ── */}
            <TabsContent value="inbox" className="mt-6 space-y-4">
              <div className="pw-section-card">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-gray-500" />
                    {isHebrew ? 'תיבת ההודעות שלי' : 'My Inbox'}
                    {(inboxData?.messages?.filter((m: any) => !m.readAt).length ?? 0) > 0 && (
                      <span className="bg-black text-white text-xs font-bold rounded-full px-2 py-0.5">
                        {inboxData!.messages.filter((m: any) => !m.readAt).length} {isHebrew ? 'חדש' : 'new'}
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    {(['all', 'receipt', 'promo', 'voucher', 'system'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setInboxFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${inboxFilter === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {f === 'all' ? (isHebrew ? 'הכל' : 'All')
                          : f === 'receipt' ? (isHebrew ? 'קבלות' : 'Receipts')
                          : f === 'promo' ? (isHebrew ? 'מבצעים' : 'Promos')
                          : f === 'voucher' ? (isHebrew ? 'שוברים' : 'Vouchers')
                          : (isHebrew ? 'מערכת' : 'System')}
                      </button>
                    ))}
                  </div>
                </div>

                {!inboxData ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                ) : (inboxData.messages?.length === 0) ? (
                  <div className="py-14 text-center text-gray-400">
                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">{isHebrew ? 'אין הודעות עדיין' : 'No messages yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {(inboxData.messages || [])
                      .filter((m: any) => inboxFilter === 'all' || m.type === inboxFilter)
                      .map((msg: any) => {
                        const typeLabels: Record<string, string> = {
                          receipt: isHebrew ? 'קבלה' : 'Receipt',
                          promo:   isHebrew ? 'מבצע' : 'Promo',
                          system:  isHebrew ? 'מערכת' : 'System',
                          voucher: isHebrew ? 'שובר' : 'Voucher',
                        };
                        const typeColors: Record<string, string> = {
                          receipt: 'bg-green-100 text-green-700 border-green-200',
                          promo:   'bg-pink-100 text-pink-700 border-pink-200',
                          system:  'bg-gray-100 text-gray-600 border-gray-200',
                          voucher: 'bg-blue-100 text-blue-700 border-blue-200',
                        };

                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl border p-4 transition-all cursor-pointer ${msg.readAt ? 'border-gray-100 hover:border-gray-200' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}
                            onClick={async () => {
                              setInboxExpanded(prev => ({ ...prev, [msg.id]: !prev[msg.id] }));
                              if (!msg.readAt) {
                                try {
                                  await apiRequest('PATCH', `/api/inbox/user/${msg.id}/read`);
                                  queryClient.invalidateQueries({ queryKey: ['/api/inbox/user'] });
                                } catch {}
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border mt-0.5 ${typeColors[msg.type] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {typeLabels[msg.type] || msg.type}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${msg.readAt ? 'text-gray-700 font-normal' : 'text-gray-900 font-semibold'}`}>
                                  {msg.title}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {!msg.readAt && <span className="w-2 h-2 rounded-full bg-black" />}
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${inboxExpanded[msg.id] ? 'rotate-90' : ''}`} />
                              </div>
                            </div>
                            {inboxExpanded[msg.id] && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: msg.bodyHtml || '' }}
                                />
                                {msg.meta?.voucherCode && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm font-mono font-bold tracking-widest text-gray-900 text-center">
                                      {msg.meta.voucherCode}
                                    </code>
                                    <Button
                                      size="sm" variant="outline"
                                      className="rounded-lg shrink-0"
                                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(msg.meta.voucherCode!); toast({ title: isHebrew ? 'הקוד הועתק!' : 'Code copied!' }); }}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                                {msg.ctaUrl && msg.ctaText && (
                                  <a
                                    href={msg.ctaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-block bg-black text-white text-xs font-medium rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {msg.ctaText}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>

          {/* ── Activity History ───────────────────────────────────── */}
          <ActivityHistorySection isHebrew={isHebrew} firebaseUser={firebaseUser} />

          {/* ── Document Vault ───────────────────────────────────── */}
          <DocumentVaultSection isHebrew={isHebrew} firebaseUser={firebaseUser} />

        </div>
      </div>
    </Layout>
  );
}

// ── Activity History component ───────────────────────────────────────────────
function ActivityHistorySection({ isHebrew, firebaseUser }: { isHebrew: boolean; firebaseUser: any }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/user/activity/bookings'],
    enabled: !!firebaseUser,
  });

  const bookings: any[] = data?.bookings ?? [];

  if (!isLoading && bookings.length === 0) return null;

  const statusColor = (s: string) => {
    if (s === 'completed') return 'bg-green-100 text-green-800';
    if (s === 'confirmed') return 'bg-blue-100 text-blue-800';
    if (s === 'cancelled') return 'bg-red-100 text-red-800';
    if (s === 'disputed') return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">
          {isHebrew ? 'היסטוריית פעילות' : 'Activity History'}
        </h3>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-4 text-sm text-gray-400">{isHebrew ? 'טוען...' : 'Loading…'}</div>
        ) : (
          bookings.slice(0, 10).map((b: any, idx: number) => (
            <div
              key={b.id}
              className="px-5 py-3.5 flex items-center gap-3"
              style={{ borderBottom: idx < bookings.length - 1 ? '1px solid #f3f4f6' : 'none' }}
            >
              <CalendarCheck className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">{b.platform}</p>
                <p className="text-[10px] text-gray-400">
                  {b.startDate
                    ? new Date(b.startDate).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>
                {b.status}
              </span>
              {b.amountCents > 0 && (
                <p className="text-xs text-gray-600">₪{(b.amountCents / 100).toFixed(0)}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Document Vault component ─────────────────────────────────────────────────
function DocumentVaultSection({ isHebrew, firebaseUser }: { isHebrew: boolean; firebaseUser: any }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/legal-stamps/me'],
    enabled: !!firebaseUser,
  });

  const stamps: any[] = data?.stamps ?? [];

  if (!isLoading && stamps.length === 0) return null;

  const eventLabel = (eventType: string) => {
    const map: Record<string, string> = {
      booking_completed: isHebrew ? 'הזמנה הושלמה' : 'Booking Completed',
      payment_received: isHebrew ? 'תשלום התקבל' : 'Payment Received',
      payout_sent: isHebrew ? 'תשלום נשלח' : 'Payout Sent',
      contract_signed: isHebrew ? 'חוזה נחתם' : 'Contract Signed',
      egift_sold: isHebrew ? 'כרטיס מתנה נמכר' : 'e-Gift Sold',
      wallet_topped_up: isHebrew ? 'ארנק טוען' : 'Wallet Topped Up',
      escrow_held: isHebrew ? 'כספים בנאמנות' : 'Escrow Held',
      escrow_released: isHebrew ? 'כספים שוחררו' : 'Escrow Released',
    };
    return map[eventType] ?? eventType.replace(/_/g, ' ');
  };

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FileCheck className="w-4 h-4 text-gray-500" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-800">
            {isHebrew ? 'כספת מסמכים משפטיים' : 'Legal Document Vault'}
          </h3>
          <p className="text-[10px] text-gray-400">
            {isHebrew
              ? 'חתימות קריפטוגרפיות בלתי ניתנות למחיקה · שמירה 7 שנים'
              : 'Immutable cryptographic stamps · 7-year retention (IL VAT §17)'}
          </p>
        </div>
        <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-full bg-green-100 text-green-800">
          {stamps.length}
        </span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-4 text-sm text-gray-400">{isHebrew ? 'טוען...' : 'Loading…'}</div>
        ) : (
          stamps.slice(0, 8).map((s: any, idx: number) => (
            <div
              key={s.stampId}
              className="px-5 py-3.5 flex items-start gap-3"
              style={{ borderBottom: idx < stamps.length - 1 ? '1px solid #f3f4f6' : 'none' }}
            >
              <Shield className="w-4 h-4 flex-shrink-0 text-green-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium">{eventLabel(s.eventType)}</p>
                <p className="text-[10px] text-gray-400 font-mono truncate">
                  {s.stampId.slice(0, 16)}… · {new Date(s.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL')}
                </p>
                <p className="text-[9px] text-gray-300 font-mono truncate mt-0.5">
                  SHA-256: {s.contentHash.slice(0, 20)}…
                </p>
              </div>
              {s.gcsPath && (
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-50 text-blue-600 font-medium flex-shrink-0">GCS</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
