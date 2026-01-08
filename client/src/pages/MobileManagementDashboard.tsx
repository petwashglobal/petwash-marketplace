/**
 * Pet Wash™ Mobile Management Dashboard - Executive Suite 2026
 * 
 * Mobile-first management interface for:
 * - Applications & HR
 * - Finance & Accounting
 * - Sales & CRM
 * - Marketing & Advertising
 * - Social Media
 * - Leads & Lead Generation
 * - Promotions
 * - Influencers
 * - Analytics & Information
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Users, DollarSign, TrendingUp, Megaphone, Share2, 
  UserPlus, Gift, Star, BarChart3, FileText, 
  Building, Briefcase, CreditCard, Target, Mail,
  Instagram, Facebook, Calendar, Clock, CheckCircle2,
  AlertCircle, ArrowRight, Search, Filter, RefreshCw,
  Home, Menu, X, ChevronRight, Sparkles, Crown
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DashboardSection {
  id: string;
  icon: typeof Users;
  label: { en: string; he: string };
  description: { en: string; he: string };
  color: string;
  bgGradient: string;
  stats?: { label: string; value: string | number };
  route?: string;
}

const dashboardSections: DashboardSection[] = [
  {
    id: 'applications',
    icon: FileText,
    label: { en: 'Applications', he: 'בקשות הצטרפות' },
    description: { en: 'Review provider applications', he: 'סקירת בקשות ספקים' },
    color: 'text-purple-600',
    bgGradient: 'from-purple-500 to-pink-600',
    route: '/admin/provider-intake'
  },
  {
    id: 'hr',
    icon: Users,
    label: { en: 'HR Management', he: 'ניהול משאבי אנוש' },
    description: { en: 'Employee management & onboarding', he: 'ניהול עובדים והכשרות' },
    color: 'text-blue-600',
    bgGradient: 'from-blue-500 to-indigo-600',
    route: '/hr-admin'
  },
  {
    id: 'finance',
    icon: DollarSign,
    label: { en: 'Finance', he: 'פיננסים' },
    description: { en: 'Revenue, payments & accounting', he: 'הכנסות, תשלומים וחשבונאות' },
    color: 'text-emerald-600',
    bgGradient: 'from-emerald-500 to-teal-600',
    route: '/accounting'
  },
  {
    id: 'sales',
    icon: TrendingUp,
    label: { en: 'Sales & CRM', he: 'מכירות ו-CRM' },
    description: { en: 'Sales pipeline & customer relations', he: 'צינור מכירות ויחסי לקוחות' },
    color: 'text-amber-600',
    bgGradient: 'from-amber-500 to-orange-600',
    route: '/admin/sales'
  },
  {
    id: 'marketing',
    icon: Megaphone,
    label: { en: 'Marketing & Ads', he: 'שיווק ופרסום' },
    description: { en: 'Campaigns & advertising', he: 'קמפיינים ופרסום' },
    color: 'text-rose-600',
    bgGradient: 'from-rose-500 to-red-600',
    route: '/admin/marketing'
  },
  {
    id: 'social',
    icon: Share2,
    label: { en: 'Social Media', he: 'רשתות חברתיות' },
    description: { en: 'Social channels & engagement', he: 'ערוצים חברתיים ומעורבות' },
    color: 'text-sky-600',
    bgGradient: 'from-sky-500 to-cyan-600',
    route: '/admin/social'
  },
  {
    id: 'leads',
    icon: UserPlus,
    label: { en: 'Lead Generation', he: 'יצירת לידים' },
    description: { en: 'Leads & conversion tracking', he: 'לידים ומעקב המרות' },
    color: 'text-violet-600',
    bgGradient: 'from-violet-500 to-purple-600',
    route: '/admin/leads'
  },
  {
    id: 'promotions',
    icon: Gift,
    label: { en: 'Promotions', he: 'מבצעים' },
    description: { en: 'Coupons, discounts & offers', he: 'קופונים, הנחות והצעות' },
    color: 'text-fuchsia-600',
    bgGradient: 'from-fuchsia-500 to-pink-600',
    route: '/admin/promotions'
  },
  {
    id: 'influencers',
    icon: Star,
    label: { en: 'Influencers', he: 'משפיענים' },
    description: { en: 'Influencer partnerships', he: 'שותפויות משפיענים' },
    color: 'text-yellow-600',
    bgGradient: 'from-yellow-500 to-amber-600',
    route: '/admin/influencers'
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: { en: 'Analytics', he: 'אנליטיקס' },
    description: { en: 'Metrics, reports & insights', he: 'מדדים, דוחות ותובנות' },
    color: 'text-indigo-600',
    bgGradient: 'from-indigo-500 to-blue-600',
    route: '/company-reports'
  },
];

export default function MobileManagementDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch quick stats
  const { data: applicationStats } = useQuery({
    queryKey: ['/api/provider-intake/stats'],
    enabled: true,
  });

  const t = {
    title: isHebrew ? 'מרכז הניהול' : 'Management Hub',
    subtitle: isHebrew ? 'גישה מהירה לכל מערכות הניהול' : 'Quick access to all management systems',
    search: isHebrew ? 'חיפוש...' : 'Search...',
    newApplications: isHebrew ? 'בקשות חדשות' : 'New Applications',
    pendingReview: isHebrew ? 'ממתינות לסקירה' : 'Pending Review',
    todayRevenue: isHebrew ? 'הכנסות היום' : 'Today\'s Revenue',
    activeLeads: isHebrew ? 'לידים פעילים' : 'Active Leads',
    quickActions: isHebrew ? 'פעולות מהירות' : 'Quick Actions',
    viewAll: isHebrew ? 'צפה בהכל' : 'View All',
    lastUpdated: isHebrew ? 'עודכן לאחרונה' : 'Last Updated',
  };

  const filteredSections = dashboardSections.filter(section => {
    if (!searchQuery) return true;
    const label = isHebrew ? section.label.he : section.label.en;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-black dark:to-gray-900 ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-black to-gray-800 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="h-5 w-5 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t.title}</h1>
              <p className="text-xs text-gray-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="pl-10 h-11 bg-gray-50 dark:bg-gray-800/50 border-0 rounded-xl"
              data-testid="input-search"
            />
          </div>
        </div>
      </header>

      {/* Quick Stats Row */}
      <div className="px-4 py-4 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-4 min-w-[140px] text-white shadow-lg">
            <FileText className="h-5 w-5 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{(applicationStats as any)?.newCount || 0}</p>
            <p className="text-xs opacity-80">{t.newApplications}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 min-w-[140px] text-white shadow-lg">
            <Clock className="h-5 w-5 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{(applicationStats as any)?.pendingCount || 0}</p>
            <p className="text-xs opacity-80">{t.pendingReview}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 min-w-[140px] text-white shadow-lg">
            <DollarSign className="h-5 w-5 mb-2 opacity-80" />
            <p className="text-2xl font-bold">₪0</p>
            <p className="text-xs opacity-80">{t.todayRevenue}</p>
          </div>
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 min-w-[140px] text-white shadow-lg">
            <UserPlus className="h-5 w-5 mb-2 opacity-80" />
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs opacity-80">{t.activeLeads}</p>
          </div>
        </div>
      </div>

      {/* Dashboard Sections Grid */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.id} href={section.route || '#'}>
                <div 
                  className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border border-gray-100 dark:border-gray-700/50 cursor-pointer group"
                  data-testid={`card-${section.id}`}
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${section.bgGradient} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                    {isHebrew ? section.label.he : section.label.en}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {isHebrew ? section.description.he : section.description.en}
                  </p>
                  <div className="flex items-center justify-end mt-2">
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Actions FAB */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <Link href="/apply-provider">
          <button 
            className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
            data-testid="fab-new-application"
          >
            <FileText className="h-6 w-6 text-white" />
          </button>
        </Link>
        <Link href="/">
          <button 
            className="w-14 h-14 bg-gradient-to-br from-black to-gray-800 dark:from-white dark:to-gray-200 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
            data-testid="fab-home"
          >
            <Home className="h-6 w-6 text-white dark:text-black" />
          </button>
        </Link>
      </div>

      {/* Mobile Side Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className={`absolute top-0 ${isHebrew ? 'left-0' : 'right-0'} w-80 h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-800 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white dark:text-black" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Pet Wash™</h2>
                    <p className="text-xs text-gray-500">{isHebrew ? 'מרכז ניהול' : 'Management'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  data-testid="button-close-menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-2">
                {dashboardSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Link key={section.id} href={section.route || '#'}>
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`menu-${section.id}`}
                      >
                        <div className={`w-10 h-10 bg-gradient-to-br ${section.bgGradient} rounded-lg flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {isHebrew ? section.label.he : section.label.en}
                          </p>
                          <p className="text-xs text-gray-500">
                            {isHebrew ? section.description.he : section.description.en}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
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
