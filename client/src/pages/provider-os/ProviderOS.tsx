import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Home, Briefcase, CalendarDays, Wallet, User,
  Bell, Settings, FileText, Shield, Bot,
  Menu, X, ChevronRight, Power, LogOut,
  Dog, MapPin, Scissors, GraduationCap, Star,
} from 'lucide-react';
import POSDashboard from './POSDashboard';
import POSJobs from './POSJobs';
import POSCalendar from './POSCalendar';
import POSWallet from './POSWallet';
import POSProfile from './POSProfile';
import POSSettings from './POSSettings';
import POSDocuments from './POSDocuments';
import POSNotifications from './POSNotifications';
import POSSafety from './POSSafety';
import POSAssistant from './POSAssistant';
import POSServices from './POSServices';

type Module = 'dashboard' | 'jobs' | 'calendar' | 'wallet' | 'profile' | 'services' | 'settings' | 'documents' | 'notifications' | 'safety' | 'assistant';
type Platform = 'all' | 'petsitter' | 'walkpet' | 'petwash' | 'academy';

const PLATFORMS: { id: Platform; label: string; labelHe: string; icon: React.ComponentType<any> }[] = [
  { id: 'all', label: 'All Services', labelHe: 'כל השירותים', icon: Dog },
  { id: 'petsitter', label: 'PetSitter', labelHe: 'PetSitter', icon: Dog },
  { id: 'walkpet', label: 'Walk My Pet', labelHe: 'Walk My Pet', icon: MapPin },
  { id: 'petwash', label: 'PetWash', labelHe: 'PetWash', icon: Scissors },
  { id: 'academy', label: 'Academy', labelHe: 'Academy', icon: GraduationCap },
];

const BOTTOM_NAV = [
  { id: 'dashboard' as Module, label: 'Home', labelHe: 'בית', icon: Home },
  { id: 'jobs' as Module, label: 'Jobs', labelHe: 'עבודות', icon: Briefcase },
  { id: 'calendar' as Module, label: 'Calendar', labelHe: 'יומן', icon: CalendarDays },
  { id: 'wallet' as Module, label: 'Wallet', labelHe: 'ארנק', icon: Wallet },
];

const SIDEBAR_ITEMS = [
  { id: 'dashboard' as Module, label: 'Dashboard', labelHe: 'דשבורד', icon: Home },
  { id: 'jobs' as Module, label: 'Jobs & Bookings', labelHe: 'עבודות והזמנות', icon: Briefcase },
  { id: 'calendar' as Module, label: 'Calendar & Availability', labelHe: 'יומן וזמינות', icon: CalendarDays },
  { id: 'wallet' as Module, label: 'Wallet & Payouts', labelHe: 'ארנק ותשלומים', icon: Wallet },
  { id: 'profile' as Module, label: 'Provider Profile', labelHe: 'פרופיל ספק', icon: User },
  { id: 'services' as Module, label: 'Services & Add-ons', labelHe: 'שירותים ותוספות', icon: Star },
  { id: 'settings' as Module, label: 'Settings', labelHe: 'הגדרות', icon: Settings },
  { id: 'documents' as Module, label: 'Documents', labelHe: 'מסמכים', icon: FileText },
  { id: 'notifications' as Module, label: 'Notifications', labelHe: 'התראות', icon: Bell },
  { id: 'safety' as Module, label: 'Safety & Reporting', labelHe: 'בטיחות ודיווח', icon: Shield },
  { id: 'assistant' as Module, label: 'AI Assistant', labelHe: 'עוזר AI', icon: Bot },
];

const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard', jobs: 'Jobs & Bookings', calendar: 'Calendar & Availability',
  wallet: 'Wallet & Payouts', profile: 'Provider Profile', services: 'Services & Add-ons',
  settings: 'Settings', documents: 'Documents & Signatures', notifications: 'Notifications',
  safety: 'Safety & Reporting', assistant: 'AI Assistant',
};

export default function ProviderOS() {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [activePlatform, setActivePlatform] = useState<Platform>('all');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [unreadCount] = useState(3);
  const { user } = useFirebaseAuth();

  const navigate = (mod: Module) => {
    setActiveModule(mod);
    setMoreMenuOpen(false);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Provider';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-14 flex items-center px-4 gap-3">
        <button
          className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
            <Dog className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm hidden sm:block">Provider OS</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {PLATFORMS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                    activePlatform === p.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAvailable(!isAvailable)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Power className="w-3 h-3" />
            <span className="hidden sm:block">{isAvailable ? 'Available' : 'Offline'}</span>
          </button>

          <button
            onClick={() => navigate('notifications')}
            className="relative p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          </div>
          <nav className="flex-1 py-3 px-2 overflow-y-auto">
            {SIDEBAR_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-600' : ''}`} />
                  <span className="truncate">{item.label}</span>
                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="ms-auto bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-gray-100">
            <Link href="/">
              <a className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Back to site
              </a>
            </Link>
          </div>
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute start-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Provider OS</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <nav className="flex-1 py-3 px-2 overflow-y-auto">
                {SIDEBAR_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                        isActive ? 'bg-amber-50 text-amber-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-600' : ''}`} />
                      {item.label}
                      {item.id === 'notifications' && unreadCount > 0 && (
                        <span className="ms-auto bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="px-4 py-3 border-t border-gray-100">
                <Link href="/">
                  <a className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                    <LogOut className="w-4 h-4" /> Back to site
                  </a>
                </Link>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <div className="px-4 py-4 lg:px-6 max-w-5xl mx-auto">
            <div className="mb-4 lg:hidden">
              <h1 className="text-lg font-semibold text-gray-900">{MODULE_LABELS[activeModule]}</h1>
            </div>
            {activeModule === 'dashboard' && <POSDashboard activePlatform={activePlatform} isAvailable={isAvailable} onToggleAvailable={setIsAvailable} onNavigate={navigate} />}
            {activeModule === 'jobs' && <POSJobs activePlatform={activePlatform} />}
            {activeModule === 'calendar' && <POSCalendar />}
            {activeModule === 'wallet' && <POSWallet activePlatform={activePlatform} />}
            {activeModule === 'profile' && <POSProfile />}
            {activeModule === 'services' && <POSServices />}
            {activeModule === 'settings' && <POSSettings />}
            {activeModule === 'documents' && <POSDocuments />}
            {activeModule === 'notifications' && <POSNotifications />}
            {activeModule === 'safety' && <POSSafety />}
            {activeModule === 'assistant' && <POSAssistant />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation"
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-gray-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 touch-manipulation"
          >
            <Menu className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" menu */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMoreMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-16 inset-x-0 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-2 pt-3">
              <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
              <div className="grid grid-cols-3 gap-1">
                {SIDEBAR_ITEMS.filter(i => !BOTTOM_NAV.find(b => b.id === i.id)).map(item => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors touch-manipulation ${
                        isActive ? 'bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-amber-600' : 'text-gray-600'}`} />
                      <span className={`text-[10px] font-medium text-center leading-tight ${isActive ? 'text-amber-700' : 'text-gray-600'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
