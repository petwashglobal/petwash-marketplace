import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
  Phone,
  Mail,
  MapPin,
  Calendar,
  Dog,
  Settings,
  CreditCard,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/luxury-dark-2025.css';

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
  city: string;
  birthdate: string;
  photoURL: string;
  preferredLanguage: string;
  notificationPreferences: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    marketingEnabled: boolean;
    reminderEnabled: boolean;
    birthdayOffersEnabled: boolean;
    loyaltyUpdatesEnabled: boolean;
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
    discount: 0
  },
  silver: { 
    gradient: 'from-slate-400 via-slate-300 to-slate-500',
    bgGradient: 'from-slate-800/20 to-slate-700/10',
    label: 'Silver Member',
    labelHe: 'חבר כסף',
    icon: Star,
    pointsRequired: 500,
    nextTier: 'gold',
    discount: 5
  },
  gold: { 
    gradient: 'from-yellow-500 via-yellow-400 to-amber-500',
    bgGradient: 'from-yellow-900/20 to-amber-800/10',
    label: 'Gold Member',
    labelHe: 'חבר זהב',
    icon: Crown,
    pointsRequired: 1500,
    nextTier: 'platinum',
    discount: 10
  },
  platinum: { 
    gradient: 'from-slate-300 via-white to-slate-400',
    bgGradient: 'from-slate-700/20 to-slate-600/10',
    label: 'Platinum Elite',
    labelHe: 'אליטה פלטינום',
    icon: Crown,
    pointsRequired: 3000,
    nextTier: 'diamond',
    discount: 15
  },
  diamond: { 
    gradient: 'from-cyan-300 via-sky-200 to-blue-400',
    bgGradient: 'from-cyan-900/20 to-blue-800/10',
    label: 'Diamond VIP',
    labelHe: 'יהלום VIP',
    icon: Gem,
    pointsRequired: 6000,
    nextTier: 'black',
    discount: 18
  },
  black: { 
    gradient: 'from-zinc-900 via-zinc-800 to-black',
    bgGradient: 'from-zinc-900/40 to-black/20',
    label: 'Black Card',
    labelHe: 'כרטיס שחור',
    icon: Crown,
    pointsRequired: 12000,
    nextTier: 'royal',
    discount: 20
  },
  royal: { 
    gradient: 'from-purple-600 via-violet-500 to-fuchsia-600',
    bgGradient: 'from-purple-900/30 to-violet-800/20',
    label: 'Royal Elite',
    labelHe: 'אליטה מלכותית',
    icon: Crown,
    pointsRequired: 25000,
    discount: 25
  },
};

function formatCurrency(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

export default function MyAccount() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isHebrew = language === 'he';
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});

  const { data: walletData, isLoading: walletLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
    enabled: !!user,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user/profile'],
    enabled: !!user,
  });

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
    },
  };

  useEffect(() => {
    if (profileData) {
      setEditedProfile(profileData);
    }
  }, [profileData]);

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editedProfile);
  };

  return (
    <Layout>
      <div className="min-h-screen luxury-dark-bg py-8 px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="text-center mb-8">
            <h1 className="luxury-heading-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200">
              {isHebrew ? 'החשבון שלי' : 'My Account'}
            </h1>
            <p className="luxury-text-body text-slate-400 mt-2">
              {isHebrew ? 'ניהול הפרופיל, הנקודות והזכויות שלך' : 'Manage your profile, points & privileges'}
            </p>
          </div>

          <div className={cn(
            "relative overflow-hidden rounded-3xl border border-white/10 p-8",
            "bg-gradient-to-br", tierInfo.bgGradient,
            "backdrop-blur-xl shadow-2xl"
          )}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-500/20 to-transparent rounded-full blur-2xl" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                <Avatar className="w-32 h-32 border-4 border-white/20 shadow-2xl">
                  <AvatarImage src={profile.photoURL} alt={profile.displayName} />
                  <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-amber-600 to-amber-800 text-white">
                    {profile.displayName?.charAt(0) || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute -bottom-2 -right-2 p-3 rounded-full shadow-xl",
                  "bg-gradient-to-br", tierInfo.gradient
                )}>
                  <TierIcon className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-start">
                <h2 className="text-3xl font-bold text-white mb-2">{profile.displayName || 'Pet Parent'}</h2>
                <Badge className={cn(
                  "text-lg px-4 py-2 font-semibold bg-gradient-to-r shadow-lg",
                  tierInfo.gradient,
                  "text-white border-0"
                )}>
                  <TierIcon className="w-5 h-5 mr-2" />
                  {isHebrew ? tierInfo.labelHe : tierInfo.label}
                </Badge>
                
                {tierInfo.discount > 0 && (
                  <p className="text-amber-400 mt-3 text-sm font-medium">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    {isHebrew 
                      ? `${tierInfo.discount}% הנחה קבועה על כל השירותים`
                      : `${tierInfo.discount}% permanent discount on all services`}
                  </p>
                )}
              </div>

              {walletLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              ) : (
                <div className="text-center md:text-end">
                  <p className="text-slate-400 text-sm mb-1">{isHebrew ? 'סך הזכויות שלך' : 'Total Credits'}</p>
                  <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-100">
                    {formatCurrency(wallet?.totalCreditsValueCents || 0)}
                  </p>
                </div>
              )}
            </div>

            {nextTierInfo && (
              <div className="relative z-10 mt-8 pt-6 border-t border-white/10">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">
                    {isHebrew ? 'התקדמות לדרגה הבאה' : 'Progress to next tier'}
                  </span>
                  <span className="text-amber-400 font-medium">
                    {wallet?.tierPointsThisYear || 0} / {nextTierInfo.pointsRequired} {isHebrew ? 'נקודות' : 'points'}
                  </span>
                </div>
                <Progress value={progressToNext} className="h-3 bg-white/10" />
                <p className="text-xs text-slate-500 mt-2 text-center">
                  {isHebrew 
                    ? `עוד ${pointsToNext} נקודות ל${isHebrew ? tierConfig[tierInfo.nextTier!].labelHe : tierConfig[tierInfo.nextTier!].label}`
                    : `${pointsToNext} more points to ${tierConfig[tierInfo.nextTier!].label}`}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: isHebrew ? 'כרטיסי מתנה' : 'E-Gift Cards', value: formatCurrency(wallet?.egiftBalanceCents || 0), icon: Gift, color: 'from-pink-500 to-rose-600' },
              { label: isHebrew ? 'חבילות שטיפה' : 'Wash Packages', value: wallet?.washPackageCredits || 0, icon: Sparkles, color: 'from-cyan-500 to-blue-600' },
              { label: isHebrew ? 'נקודות נאמנות' : 'Loyalty Points', value: wallet?.loyaltyPointsBalance || 0, icon: Star, color: 'from-amber-500 to-orange-600' },
              { label: isHebrew ? 'קרדיט מבצעים' : 'Promo Credits', value: formatCurrency(wallet?.promoBalanceCents || 0), icon: Gift, color: 'from-purple-500 to-violet-600' },
              { label: isHebrew ? 'קרדיט הפניות' : 'Referral Credits', value: formatCurrency(wallet?.referralBalanceCents || 0), icon: User, color: 'from-emerald-500 to-green-600' },
            ].map((item, idx) => (
              <div 
                key={idx}
                className="luxury-glass-card p-4 rounded-2xl border border-white/10 text-center hover:scale-105 transition-transform duration-300"
              >
                <div className={cn(
                  "w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center",
                  "bg-gradient-to-br", item.color
                )}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full bg-black/40 border border-white/10 rounded-2xl p-1 grid grid-cols-3">
              <TabsTrigger 
                value="profile" 
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white"
              >
                <User className="w-4 h-4 mr-2" />
                {isHebrew ? 'פרופיל' : 'Profile'}
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white"
              >
                <Bell className="w-4 h-4 mr-2" />
                {isHebrew ? 'התראות' : 'Notifications'}
              </TabsTrigger>
              <TabsTrigger 
                value="security"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                {isHebrew ? 'אבטחה' : 'Security'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <div className="luxury-glass-card rounded-3xl border border-white/10 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">
                    {isHebrew ? 'פרטים אישיים' : 'Personal Details'}
                  </h3>
                  {!isEditing ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      {isHebrew ? 'עריכה' : 'Edit'}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {isHebrew ? 'שמור' : 'Save'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedProfile(profile);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-400 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {isHebrew ? 'שם מלא' : 'Full Name'}
                    </Label>
                    {isEditing ? (
                      <Input 
                        value={editedProfile.displayName || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, displayName: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    ) : (
                      <p className="text-white text-lg">{profile.displayName || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {isHebrew ? 'אימייל' : 'Email'}
                    </Label>
                    <p className="text-white text-lg">{profile.email || '-'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-400 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {isHebrew ? 'טלפון' : 'Phone'}
                    </Label>
                    {isEditing ? (
                      <Input 
                        value={editedProfile.phone || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="+972-50-000-0000"
                      />
                    ) : (
                      <p className="text-white text-lg">{profile.phone || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {isHebrew ? 'תאריך לידה' : 'Birthday'}
                    </Label>
                    {isEditing ? (
                      <Input 
                        type="date"
                        value={editedProfile.birthdate || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, birthdate: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    ) : (
                      <p className="text-white text-lg">{profile.birthdate || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-400 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {isHebrew ? 'כתובת' : 'Address'}
                    </Label>
                    {isEditing ? (
                      <Input 
                        value={editedProfile.address || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder={isHebrew ? 'רחוב, מספר, עיר' : 'Street, Number, City'}
                      />
                    ) : (
                      <p className="text-white text-lg">{profile.address || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <div className="luxury-glass-card rounded-3xl border border-white/10 p-8">
                <h3 className="text-xl font-semibold text-white mb-6">
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
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
                          <item.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.label}</p>
                          <p className="text-slate-400 text-sm">{item.desc}</p>
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
                        className="data-[state=checked]:bg-amber-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <div className="luxury-glass-card rounded-3xl border border-white/10 p-8">
                <h3 className="text-xl font-semibold text-white mb-6">
                  {isHebrew ? 'אבטחה והתחברות' : 'Security & Login'}
                </h3>

                <div className="space-y-4">
                  <a 
                    href="/settings/security"
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{isHebrew ? 'Face ID / Passkeys' : 'Face ID / Passkeys'}</p>
                        <p className="text-slate-400 text-sm">{isHebrew ? 'ניהול אימות ביומטרי' : 'Manage biometric authentication'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </a>

                  <a 
                    href="/settings"
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{isHebrew ? 'הגדרות מתקדמות' : 'Advanced Settings'}</p>
                        <p className="text-slate-400 text-sm">{isHebrew ? 'PIN, מכשירים מהימנים ועוד' : 'PIN, trusted devices & more'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </a>

                  <a 
                    href="/my-devices"
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{isHebrew ? 'המכשירים שלי' : 'My Devices'}</p>
                        <p className="text-slate-400 text-sm">{isHebrew ? 'נהל מכשירים מחוברים' : 'Manage connected devices'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </a>
                </div>
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </Layout>
  );
}
