import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, DollarSign, TrendingUp, Megaphone, Share2, 
  UserPlus, Gift, Star, BarChart3, FileText, 
  Home, Menu, X, ChevronRight, Sparkles, Crown,
  Droplets, Car, Scissors, GraduationCap, Footprints,
  MapPin, Wifi, WifiOff, Activity, Clock,
  Search, Mail, Send, Shield, Lock,
  Loader2, MessageSquare, Phone, ArrowLeft, 
  CheckCircle2, AlertCircle, ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DashboardSection {
  id: string;
  icon: typeof Users;
  label: { en: string; he: string };
  description: { en: string; he: string };
  bgGradient: string;
  route?: string;
}

const dashboardSections: DashboardSection[] = [
  { id: 'applications', icon: FileText, label: { en: 'Applications', he: 'בקשות הצטרפות' }, description: { en: 'Review provider applications', he: 'סקירת בקשות ספקים' }, bgGradient: 'from-purple-500/30 to-pink-600/20', route: '/admin/provider-intake' },
  { id: 'hr', icon: Users, label: { en: 'HR Management', he: 'ניהול משאבי אנוש' }, description: { en: 'Employee management', he: 'ניהול עובדים' }, bgGradient: 'from-blue-500/30 to-indigo-600/20', route: '/hr-admin' },
  { id: 'finance', icon: DollarSign, label: { en: 'Finance', he: 'פיננסים' }, description: { en: 'Revenue & payments', he: 'הכנסות ותשלומים' }, bgGradient: 'from-emerald-500/30 to-teal-600/20', route: '/accounting' },
  { id: 'sales', icon: TrendingUp, label: { en: 'Sales & CRM', he: 'מכירות ו-CRM' }, description: { en: 'Sales pipeline', he: 'צינור מכירות' }, bgGradient: 'from-amber-500/30 to-orange-600/20', route: '/admin/sales' },
  { id: 'marketing', icon: Megaphone, label: { en: 'Marketing', he: 'שיווק' }, description: { en: 'Campaigns & ads', he: 'קמפיינים ופרסום' }, bgGradient: 'from-rose-500/30 to-red-600/20', route: '/admin/marketing' },
  { id: 'social', icon: Share2, label: { en: 'Social Media', he: 'רשתות חברתיות' }, description: { en: 'Social channels', he: 'ערוצים חברתיים' }, bgGradient: 'from-sky-500/30 to-cyan-600/20', route: '/admin/social' },
  { id: 'leads', icon: UserPlus, label: { en: 'Leads', he: 'לידים' }, description: { en: 'Lead tracking', he: 'מעקב לידים' }, bgGradient: 'from-violet-500/30 to-purple-600/20', route: '/admin/leads' },
  { id: 'promotions', icon: Gift, label: { en: 'Promotions', he: 'מבצעים' }, description: { en: 'Coupons & offers', he: 'קופונים והצעות' }, bgGradient: 'from-fuchsia-500/30 to-pink-600/20', route: '/admin/promotions' },
  { id: 'influencers', icon: Star, label: { en: 'Influencers', he: 'משפיענים' }, description: { en: 'Partnerships', he: 'שותפויות' }, bgGradient: 'from-yellow-500/30 to-amber-600/20', route: '/admin/influencers' },
  { id: 'analytics', icon: BarChart3, label: { en: 'Analytics', he: 'אנליטיקס' }, description: { en: 'Reports & insights', he: 'דוחות ותובנות' }, bgGradient: 'from-indigo-500/30 to-blue-600/20', route: '/company-reports' },
];

interface Provider {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  platform: string;
  status: string;
  rating?: number;
  location?: string;
}

const platformColors: Record<string, { bg: string; text: string; icon: typeof Users }> = {
  'walker': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: Footprints },
  'sitter': { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: Home },
  'driver': { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: Car },
  'groomer': { bg: 'bg-rose-500/15', text: 'text-rose-400', icon: Scissors },
  'trainer': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', icon: GraduationCap },
  'k9000': { bg: 'bg-slate-500/15', text: 'text-slate-400', icon: Droplets },
};

export default function MobileManagementDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user: firebaseUser } = useFirebaseAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'providers'>('dashboard');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messagePriority, setMessagePriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  const { data: applicationStats } = useQuery({
    queryKey: ['/api/provider-intake/stats'],
    enabled: true,
  });

  const { data: providersData, isLoading: loadingProviders } = useQuery<{ providers: Provider[] }>({
    queryKey: ['/api/admin/providers'],
    enabled: activeView === 'providers',
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/inbox'] });
      toast({
        title: isHebrew ? 'ההודעה נשלחה בהצלחה' : 'Message Sent',
        description: isHebrew ? 'ההודעה נמסרה לספק בהצלחה' : 'Message delivered to provider successfully.',
      });
      setShowMessageDialog(false);
      setMessageSubject('');
      setMessageBody('');
      setMessagePriority('normal');
      setSelectedProvider(null);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'השליחה נכשלה' : 'Send Failed',
        description: error.message,
      });
    },
  });

  const handleSendToProvider = async () => {
    if (!firebaseUser || !selectedProvider) return;

    try {
      const recipientData = await apiRequest(`/api/messages/lookup-user?email=${encodeURIComponent(selectedProvider.email)}`, { method: 'GET' });

      sendMessageMutation.mutate({
        senderId: firebaseUser.uid,
        senderName: '⁦Pet Wash™⁩ Management',
        senderEmail: firebaseUser.email || 'admin@petwash.co.il',
        recipientId: recipientData.uid,
        recipientName: `${selectedProvider.firstName} ${selectedProvider.lastName}`,
        recipientEmail: selectedProvider.email,
        subject: messageSubject,
        body: messageBody,
        messageType: 'admin_notification',
        priority: messagePriority,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'הספק לא נמצא' : 'Provider Not Found',
        description: isHebrew ? 'לא ניתן למצוא את חשבון הספק' : 'Could not find the provider account.',
      });
    }
  };

  const filteredSections = dashboardSections.filter(section => {
    if (!searchQuery) return true;
    const label = isHebrew ? section.label.he : section.label.en;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const providers: Provider[] = (providersData?.providers || []).filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.platform?.toLowerCase().includes(q);
  });

  return (
    <div className={`min-h-screen bg-[#0A0A0F] ${isHebrew ? 'rtl' : 'ltr'}`}>

      <header className="sticky top-0 z-50 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-[rgba(232,230,240,0.06)]">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#C9A96E] to-[#d4af37] rounded-xl flex items-center justify-center shadow-lg shadow-[#C9A96E]/20">
              <Crown className="h-5 w-5 text-[#0A0A0F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{isHebrew ? 'מרכז הניהול' : 'Management Hub'}</h1>
                <span className="px-1.5 py-0.5 text-[7px] tracking-[0.1em] uppercase font-semibold bg-[#C9A96E]/20 text-[#C9A96E] border border-[#C9A96E]/30 rounded-sm">
                  Staff
                </span>
              </div>
              <p className="text-xs text-[rgba(149,144,168,0.6)]">{isHebrew ? 'ניהול מאייפון' : 'iPhone Management'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setActiveView(activeView === 'dashboard' ? 'providers' : 'dashboard')}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                activeView === 'providers'
                  ? 'bg-[#C9A96E]/20 text-[#C9A96E]'
                  : 'bg-[rgba(232,230,240,0.05)] text-[rgba(149,144,168,0.6)]'
              )}
              data-testid="toggle-providers-view"
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-[rgba(232,230,240,0.05)] text-[rgba(149,144,168,0.6)] hover:text-white transition-colors"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(149,144,168,0.4)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === 'providers' ? (isHebrew ? 'חפש ספקים...' : 'Search providers...') : (isHebrew ? 'חיפוש...' : 'Search...')}
              className="pl-10 h-11 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.08)] text-white placeholder:text-[rgba(149,144,168,0.4)] rounded-xl"
              data-testid="input-search"
            />
          </div>
        </div>

        {activeView === 'providers' && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <Button
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-1 text-xs text-[#C9A96E] hover:text-[#d4af37] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isHebrew ? 'חזרה' : 'Back'}
            </Button>
            <span className="text-xs text-[rgba(149,144,168,0.3)]">|</span>
            <span className="text-xs text-[rgba(149,144,168,0.5)]">
              {isHebrew ? `${providers.length} ספקים` : `${providers.length} Providers`}
            </span>
          </div>
        )}
      </header>

      {activeView === 'dashboard' ? (
        <>
          <div className="px-4 py-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {[
                { icon: FileText, value: (applicationStats as any)?.newCount || 0, label: isHebrew ? 'בקשות חדשות' : 'New Apps', gradient: 'from-purple-500/25 to-pink-600/15', color: 'text-purple-400' },
                { icon: Clock, value: (applicationStats as any)?.pendingCount || 0, label: isHebrew ? 'ממתינות' : 'Pending', gradient: 'from-amber-500/25 to-orange-600/15', color: 'text-amber-400' },
                { icon: DollarSign, value: '₪0', label: isHebrew ? 'הכנסות' : 'Revenue', gradient: 'from-emerald-500/25 to-teal-600/15', color: 'text-emerald-400' },
                { icon: UserPlus, value: 0, label: isHebrew ? 'לידים' : 'Leads', gradient: 'from-violet-500/25 to-purple-600/15', color: 'text-violet-400' },
              ].map((stat, i) => (
                <div key={i} className={`luxury-dark-card rounded-2xl p-4 min-w-[130px] bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className={`h-5 w-5 mb-2 ${stat.color}`} />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-[rgba(149,144,168,0.6)]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[rgba(149,144,168,0.5)] uppercase tracking-wider">
                {isHebrew ? 'ספקים לפי פלטפורמה' : 'Providers by Platform'}
              </h3>
              <Button
                onClick={() => setActiveView('providers')}
                className="text-xs text-[#C9A96E] hover:text-[#d4af37] flex items-center gap-1 transition-colors"
              >
                {isHebrew ? 'צפה בכולם' : 'View All'} <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: isHebrew ? 'טיולים' : 'Walkers', icon: Footprints, color: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-600/5', count: 3, route: '/walk-my-pet' },
                { label: isHebrew ? 'שמרטפים' : 'Sitters', icon: Home, color: 'text-purple-400', bg: 'from-purple-500/15 to-purple-600/5', count: 3, route: '/sitter-suite' },
                { label: isHebrew ? 'נהגים' : 'Drivers', icon: Car, color: 'text-blue-400', bg: 'from-blue-500/15 to-blue-600/5', count: 6, route: '/pettrek' },
                { label: isHebrew ? 'טיפוח' : 'Groomers', icon: Scissors, color: 'text-rose-400', bg: 'from-rose-500/15 to-rose-600/5', count: 0, route: '/groomers' },
                { label: isHebrew ? 'מאלפים' : 'Trainers', icon: GraduationCap, color: 'text-cyan-400', bg: 'from-cyan-500/15 to-cyan-600/5', count: 3, route: '/academy' },
                { label: '⁦K9000™⁩', icon: Droplets, color: 'text-[#C9A96E]', bg: 'from-[#C9A96E]/15 to-[#C9A96E]/5', count: 6, route: '/k9000' },
              ].map((p, i) => (
                <Link key={i} href={p.route}>
                  <div className={`luxury-dark-card rounded-xl p-3 text-center hover:border-[rgba(201,169,110,0.2)] transition-all cursor-pointer bg-gradient-to-br ${p.bg}`} data-testid={`platform-${p.label.toLowerCase()}`}>
                    <div className="w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center">
                      <p.icon className={`h-5 w-5 ${p.color}`} />
                    </div>
                    <p className="text-xs font-medium text-[rgba(232,230,240,0.7)]">{p.label}</p>
                    <p className={`text-lg font-bold ${p.color}`}>{p.count}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[rgba(149,144,168,0.5)] uppercase tracking-wider">
                {isHebrew ? 'תחנות K9000' : 'K9000 Stations'}
              </h3>
              <Link href="/admin/stations">
                <span className="text-xs text-[#C9A96E] hover:text-[#d4af37] cursor-pointer flex items-center gap-1">
                  {isHebrew ? 'צפה בהכל' : 'View All'} <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
            <div className="luxury-dark-card rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-[rgba(232,230,240,0.06)]">
                {[
                  { icon: Wifi, color: 'text-emerald-400', value: 4, label: isHebrew ? 'מקוון' : 'Online' },
                  { icon: Activity, color: 'text-amber-400', value: 1, label: isHebrew ? 'בשימוש' : 'In Use' },
                  { icon: WifiOff, color: 'text-red-400', value: 1, label: isHebrew ? 'לא מקוון' : 'Offline' },
                ].map((s, i) => (
                  <div key={i} className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                      <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                    </div>
                    <p className="text-xs text-[rgba(149,144,168,0.5)]">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[rgba(232,230,240,0.06)] p-3 bg-[rgba(232,230,240,0.02)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[rgba(149,144,168,0.5)]">{isHebrew ? 'תחנה פופולרית:' : 'Top Station:'}</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[#C9A96E]" /> Tel Aviv Central
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-8">
            <h3 className="text-xs font-semibold text-[rgba(149,144,168,0.5)] uppercase tracking-wider mb-3">
              {isHebrew ? 'מודולי ניהול' : 'Management Modules'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <Link key={section.id} href={section.route || '#'}>
                    <div
                      className={`luxury-dark-card rounded-2xl p-4 hover:border-[rgba(201,169,110,0.2)] transition-all cursor-pointer group bg-gradient-to-br ${section.bgGradient}`}
                      data-testid={`card-${section.id}`}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Icon className="h-6 w-6 text-[#C9A96E]" />
                      </div>
                      <h3 className="font-bold text-sm text-white mb-1">
                        {isHebrew ? section.label.he : section.label.en}
                      </h3>
                      <p className="text-xs text-[rgba(149,144,168,0.5)] line-clamp-2">
                        {isHebrew ? section.description.he : section.description.en}
                      </p>
                      <div className="flex items-center justify-end mt-2">
                        <ChevronRight className="h-4 w-4 text-[rgba(149,144,168,0.3)] group-hover:text-[#C9A96E] transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="px-4 py-4">
          {loadingProviders ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#C9A96E]" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.2)] to-[rgba(201,169,110,0.05)] flex items-center justify-center">
                <Users className="h-8 w-8 text-[rgba(149,144,168,0.4)]" />
              </div>
              <h3 className="luxury-dark-heading-sm text-white mb-2">
                {isHebrew ? 'אין ספקים להצגה' : 'No Providers Found'}
              </h3>
              <p className="luxury-dark-text-body text-sm">
                {isHebrew ? 'נסה לחפש שם או פלטפורמה אחרת' : 'Try a different search term'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => {
                const pc = platformColors[provider.platform?.toLowerCase()] || platformColors.walker;
                const PlatformIcon = pc.icon;
                return (
                  <div
                    key={provider.id}
                    className="luxury-dark-card rounded-2xl p-4 hover:border-[rgba(201,169,110,0.2)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', pc.bg)}>
                        <PlatformIcon className={cn('h-6 w-6', pc.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-semibold text-sm truncate">
                            {provider.firstName} {provider.lastName}
                          </h4>
                          <Badge className={cn('text-[10px] border-0', pc.bg, pc.text)}>
                            {provider.platform}
                          </Badge>
                        </div>
                        <p className="text-xs text-[rgba(149,144,168,0.5)] truncate">{provider.email}</p>
                        {provider.location && (
                          <p className="text-xs text-[rgba(149,144,168,0.4)] flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {provider.location}
                          </p>
                        )}
                        {provider.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 fill-[#C9A96E] text-[#C9A96E]" />
                            <span className="text-xs text-[#C9A96E]">{provider.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {provider.email ? (
                          <Button
                            onClick={() => {
                              setSelectedProvider(provider);
                              setShowMessageDialog(true);
                            }}
                            className="w-10 h-10 rounded-xl bg-[#C9A96E]/15 flex items-center justify-center hover:bg-[#C9A96E]/25 transition-colors"
                            data-testid={`message-provider-${provider.id}`}
                          >
                            <MessageSquare className="h-4 w-4 text-[#C9A96E]" />
                          </Button>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[rgba(232,230,240,0.03)] flex items-center justify-center" title={isHebrew ? 'אין אימייל זמין' : 'No email available'}>
                            <MessageSquare className="h-4 w-4 text-[rgba(149,144,168,0.2)]" />
                          </div>
                        )}
                        {provider.phone && (
                          <a href={`tel:${provider.phone}`} className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center hover:bg-emerald-500/25 transition-colors">
                            <Phone className="h-4 w-4 text-emerald-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <Button
          onClick={() => setActiveView('providers')}
          className="w-14 h-14 bg-gradient-to-br from-[#C9A96E] to-[#d4af37] rounded-full shadow-2xl shadow-[#C9A96E]/30 flex items-center justify-center hover:scale-110 transition-transform"
          data-testid="fab-providers"
        >
          <Users className="h-6 w-6 text-[#0A0A0F]" />
        </Button>
        <Link href="/">
          <Button
            className="w-14 h-14 bg-[rgba(232,230,240,0.1)] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform border border-[rgba(232,230,240,0.1)]"
            data-testid="fab-home"
          >
            <Home className="h-6 w-6 text-white" />
          </Button>
        </Link>
      </div>

      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-lg !bg-[#12121a] !border-[rgba(232,230,240,0.1)] rounded-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="luxury-dark-heading-lg text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-[#C9A96E]" />
              {isHebrew ? 'שלח הודעה לספק' : 'Message Provider'}
            </DialogTitle>
            <DialogDescription className="luxury-dark-text-body">
              {selectedProvider && (
                <span className="flex items-center gap-2 mt-1">
                  <span className="text-white font-medium">{selectedProvider.firstName} {selectedProvider.lastName}</span>
                  <span className="text-[rgba(149,144,168,0.4)]">({selectedProvider.email})</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                {isHebrew ? 'נושא' : 'Subject'}
              </label>
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder={isHebrew ? 'נושא ההודעה...' : 'Message subject...'}
                className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]"
                required
              />
            </div>
            <div>
              <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                {isHebrew ? 'עדיפות' : 'Priority'}
              </label>
              <Select value={messagePriority} onValueChange={(val: any) => setMessagePriority(val)}>
                <SelectTrigger className="h-12 bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-[rgba(232,230,240,0.1)]">
                  <SelectItem value="normal">{isHebrew ? 'רגיל' : 'Normal'}</SelectItem>
                  <SelectItem value="high">{isHebrew ? 'גבוה' : 'High'}</SelectItem>
                  <SelectItem value="urgent">{isHebrew ? 'דחוף' : 'Urgent'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="luxury-dark-text-small text-xs uppercase tracking-wider mb-2 block">
                {isHebrew ? 'הודעה' : 'Message'}
              </label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={isHebrew ? 'כתוב את ההודעה שלך...' : 'Write your message...'}
                className="min-h-[140px] bg-[rgba(232,230,240,0.05)] border-[rgba(232,230,240,0.1)] text-white placeholder:text-[rgba(149,144,168,0.5)]"
                required
              />
            </div>
            <div className="flex items-center gap-2 luxury-dark-text-small text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isHebrew ? 'מאובטח בהצפנת SHA-256 | נשלח לתיבת הדואר הפרטית של הספק' : 'SHA-256 encrypted | Delivered to provider\'s private inbox'}</span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                className="luxury-dark-btn-ghost px-5 py-3 border border-[rgba(232,230,240,0.1)]"
                onClick={() => setShowMessageDialog(false)}
              >
                {isHebrew ? 'ביטול' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSendToProvider}
                disabled={sendMessageMutation.isPending || !messageSubject || !messageBody}
                className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2 disabled:opacity-50"
              >
                {sendMessageMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {isHebrew ? 'שולח...' : 'Sending...'}</>
                ) : (
                  <><Send className="w-4 h-4" /> {isHebrew ? 'שלח' : 'Send'}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-0 right-0 w-80 h-full bg-[#0A0A0F] border-l border-[rgba(232,230,240,0.06)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#C9A96E] to-[#d4af37] rounded-xl flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-[#0A0A0F]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white">⁦Pet Wash™⁩</h2>
                    <p className="text-xs text-[rgba(149,144,168,0.5)]">{isHebrew ? 'מרכז ניהול' : 'Management'}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-[rgba(232,230,240,0.05)] text-[rgba(149,144,168,0.6)]"
                  data-testid="button-close-menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="space-y-2">
                <Button
                  onClick={() => { setActiveView('providers'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#C9A96E]/10 hover:bg-[#C9A96E]/15 transition-colors text-left"
                  data-testid="menu-providers"
                >
                  <div className="w-10 h-10 bg-[#C9A96E]/20 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#C9A96E]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-[#C9A96E]">{isHebrew ? 'ספקים והודעות' : 'Providers & Messages'}</p>
                    <p className="text-xs text-[rgba(149,144,168,0.5)]">{isHebrew ? 'צפה בספקים ושלח הודעות' : 'View & message providers'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#C9A96E]" />
                </Button>

                {dashboardSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Link key={section.id} href={section.route || '#'}>
                      <div
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(232,230,240,0.03)] transition-colors cursor-pointer"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`menu-${section.id}`}
                      >
                        <div className={`w-10 h-10 bg-gradient-to-br ${section.bgGradient} rounded-lg flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-[#C9A96E]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-[rgba(232,230,240,0.8)]">
                            {isHebrew ? section.label.he : section.label.en}
                          </p>
                          <p className="text-xs text-[rgba(149,144,168,0.5)]">
                            {isHebrew ? section.description.he : section.description.en}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[rgba(149,144,168,0.3)]" />
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}