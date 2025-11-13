import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Database, Package, Wrench, MapPin, Building2, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { FaInstagram, FaFacebookF, FaTiktok } from 'react-icons/fa';
import { LanguageToggle } from './LanguageToggle';
import { GlobalNavigation } from './GlobalNavigation';
import { 
  getPlatformByPath, 
  getAccessibleNavItems,
  globalNavigation,
  type PlatformId,
  type NavItem
} from '@/shared/petwashGlobal';
import type { Language } from '@/lib/i18n';
import type { UserRole } from '@/shared/petwashGlobal';
import { t } from '@/lib/i18n';

interface HeaderProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export function Header({ language, onLanguageChange }: HeaderProps) {
  // For components that only support Hebrew/English, convert other languages
  const headerLanguage: 'en' | 'he' = language === 'he' ? 'he' : 'en';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  // Fetch user role for enterprise features
  const { data: userRole } = useQuery<any>({
    queryKey: ['/api/admin/role'],
    enabled: !!user,
  });
  
  // Detect if we're on a platform page
  const currentPlatform = getPlatformByPath(location);
  const platformId = currentPlatform?.id as PlatformId | undefined;
  
  // Get accessible navigation items from GlobalNavigation data structure
  // Uses globalNavigation from petwashGlobal.ts for non-platform pages
  const desktopNavItems = platformId
    ? getAccessibleNavItems(
        platformId,
        userRole?.role?.name 
          ? (userRole.role.name.toUpperCase() as UserRole)
          : userRole?.isSuperAdmin 
          ? "ADMIN" 
          : undefined
      )
    : globalNavigation.map(item => ({
        ...item,
        label: t(item.label, language) // Resolve translation keys
      }));
  
  // Static cache-busting version for social icons - stable across renders
  const iconVersion = "v20251023";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: t('header.loggedOutSuccessfully', language),
        description: t('header.seeYouSoon', language),
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: t('common.error', language),
        description: t('header.failedToLogout', language),
        variant: 'destructive',
      });
    }
  };

  // iOS/Android 100vh fix + reflow on orientation change
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header
      id="site-header"
      className="fixed top-0 left-0 right-0 z-50 bg-white md:bg-transparent shadow-[0_1px_6px_rgba(0,0,0,0.06)] md:shadow-none md:sticky"
    >
      {/* Mobile-optimized CSS (scoped) */}
      <style>{`
        /* ===== CSS VARIABLES - RESPONSIVE LOGO SIZING ===== */
        :root {
          --logo-max-w-p: min(55vw, 180px);
          --logo-max-w-l: min(50vw, 160px);
          --header-height-mobile: 148px;
          --header-height-desktop: 92px;
        }

        /* ===== MOBILE HEADER (≤480px ONLY) ===== */
        @media (max-width: 480px) {
          .pw-mobile-header {
            /* FIXED: Remove padding-top completely - no white space at top */
            padding-top: 0;
            padding-left: max(12px, env(safe-area-inset-left));
            padding-right: max(12px, env(safe-area-inset-right));
            padding-bottom: 4px;
            /* CSS Grid for locked positioning */
            display: grid;
            grid-template-rows: auto auto auto;
            grid-template-areas:
              "logo"
              "utility"
              "language";
            gap: 4px;
            align-items: center;
          }

          .brand-row {
            grid-area: logo;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding-top: 8px;
          }

          .pw-logo {
            width: 100%;
            max-width: var(--logo-max-w-p);
            height: auto;
            display: block;
            margin: 0 auto;
          }

          .nav-utility-row {
            grid-area: utility;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 12px;
          }

          .socials-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .social-icon {
            width: 32px;
            height: 32px;
            opacity: 1;
            transition: all 0.2s ease;
            display: block;
            object-fit: contain;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }

          .social-icon:hover,
          .social-icon:active {
            transform: scale(1.15);
            opacity: 0.85;
          }

          .hamburger-right {
            margin-left: auto;
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 6px;
            background: transparent;
            cursor: pointer;
            transition: transform 0.2s;
          }

          .hamburger-right:active {
            transform: scale(0.95);
          }

          .hamburger-line {
            width: 18px;
            height: 2px;
            background: #000;
            display: block;
          }

          .lang-row {
            grid-area: language;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            font-size: clamp(11px, 1.6vw, 14px);
            line-height: 1;
          }

          .lang-btn {
            background: none;
            border: none;
            padding: 4px 8px;
            cursor: pointer;
            text-decoration: underline;
            transition: all 0.2s;
          }

          .lang-btn:hover,
          .lang-btn:active {
            text-decoration: none;
            transform: scale(0.95);
          }

          .lang-separator {
            margin: 0 8px;
            opacity: 0.4;
          }
        }

        /* ===== LANDSCAPE MODE (≤480px) ===== */
        @media (max-width: 480px) and (orientation: landscape) {
          .pw-mobile-header {
            padding-top: 0;
            padding-bottom: 4px;
            gap: 2px;
          }

          .brand-row {
            justify-content: center;
          }

          .pw-logo {
            width: 100%;
            max-width: var(--logo-max-w-l);
            margin: 0 auto;
          }

          .social-icon {
            width: 30px;
            height: 30px;
            display: block;
            object-fit: contain;
            filter: none !important;
            -webkit-filter: none !important;
            mix-blend-mode: normal;
          }

          .hamburger-right {
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
          }

          .lang-row {
            font-size: clamp(11px, 1.6vw, 14px);
          }
        }

        /* ===== LARGER PHONES & TABLETS (481px - 767px) ===== */
        @media (min-width: 481px) and (max-width: 767px) {
          .pw-mobile-header {
            padding-top: 0;
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
            padding-bottom: 6px;
            display: grid;
            grid-template-rows: auto auto auto;
            grid-template-areas:
              "logo"
              "utility"
              "language";
            gap: 8px;
            align-items: center;
          }

          .brand-row {
            grid-area: logo;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding-top: 8px;
          }

          .pw-logo {
            width: 100%;
            max-width: min(60vw, 220px);
            height: auto;
            margin: 0 auto;
          }

          .nav-utility-row {
            grid-area: utility;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .socials-left {
            display: flex;
            gap: 16px;
          }

          .social-icon {
            width: 30px;
            height: 30px;
            display: block;
            object-fit: contain;
            filter: none !important;
            -webkit-filter: none !important;
          }

          .hamburger-right {
            margin-left: auto;
            width: 48px;
            height: 48px;
          }

          .lang-row {
            text-align: center;
            font-size: 14px;
          }
        }

        /* ===== LARGE TABLETS & iPAD PRO (768px - 1279px) ===== */
        @media (min-width: 768px) and (max-width: 1279px) {
          .pw-mobile-header {
            padding-top: 0;
            padding-left: max(20px, env(safe-area-inset-left));
            padding-right: max(20px, env(safe-area-inset-right));
            padding-bottom: 8px;
            display: grid;
            grid-template-rows: auto auto auto;
            grid-template-areas:
              "logo"
              "utility"
              "language";
            gap: 10px;
            align-items: center;
          }

          .brand-row {
            grid-area: logo;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding-top: 10px;
          }

          .pw-logo {
            width: 100%;
            max-width: min(50vw, 280px);
            height: auto;
            margin: 0 auto;
          }

          .nav-utility-row {
            grid-area: utility;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
          }

          .socials-left {
            display: flex;
            gap: 20px;
            align-items: center;
          }

          .social-icon {
            width: 36px;
            height: 36px;
            display: block;
            object-fit: contain;
            filter: none !important;
            -webkit-filter: none !important;
          }

          .hamburger-right {
            margin-left: auto;
            width: 52px;
            height: 52px;
            min-width: 52px;
            min-height: 52px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border: 1px solid rgba(0, 0, 0, 0.15);
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s;
          }

          .hamburger-right:hover {
            background: rgba(0, 0, 0, 0.05);
            transform: scale(1.05);
          }

          .hamburger-right:active {
            transform: scale(0.95);
          }

          .hamburger-line {
            width: 22px;
            height: 2.5px;
            background: #000;
            display: block;
            border-radius: 2px;
          }

          .lang-row {
            grid-area: language;
            text-align: center;
            font-size: 15px;
            padding: 0 10px;
          }
        }

        /* ===== DESKTOP (≥1280px) ===== */
        .pw-desktop-header {
          /* Styles handled by Tailwind classes below */
        }
      `}</style>

      {/* ===== MOBILE & TABLET (<xl) - Mobile Layout with Hamburger ===== */}
      <div className="block xl:hidden pw-mobile-header">
        {/* Row 1: Logo centered and dominant */}
        <div className="brand-row">
          <Link href="/" aria-label="PetWash Home" style={{ lineHeight: 0 }}>
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="PetWash™" 
              className="pw-logo" 
              loading="eager"
            />
          </Link>
        </div>

        {/* Row 2: Social Media Icons (left) + Hamburger (right) */}
        <div className="nav-utility-row">
          <nav aria-label="Social Media" className="socials-left">
            <a 
              href="https://www.instagram.com/petwashltd" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Instagram @petwashltd"
              className="hover:opacity-80 transition-opacity"
            >
              <FaInstagram 
                className="social-icon"
                style={{ 
                  background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
                  color: 'white',
                  padding: '6px',
                  borderRadius: '8px'
                }}
              />
            </a>
            <a 
              href="https://www.facebook.com/petwashltd" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Facebook PetWashLtd"
              className="hover:opacity-80 transition-opacity"
            >
              <FaFacebookF 
                className="social-icon"
                style={{ 
                  backgroundColor: '#1877F2',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px'
                }}
              />
            </a>
            <a 
              href="https://www.tiktok.com/@petwashltd" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="TikTok @petwashltd"
              className="hover:opacity-80 transition-opacity"
            >
              <FaTiktok 
                className="social-icon"
                style={{ 
                  backgroundColor: '#000000',
                  color: 'white',
                  padding: '6px',
                  borderRadius: '8px'
                }}
              />
            </a>
          </nav>

          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
            className="hamburger-right"
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>

        {/* Row 3: Language toggle centered */}
        <div className="lang-row">
          {onLanguageChange && (
            <LanguageToggle 
              language={language} 
              onLanguageChange={onLanguageChange}
            />
          )}
        </div>
      </div>

      {/* ===== DESKTOP (xl+ 1280px+) - Full navigation ===== */}
      <div className="hidden xl:block pw-desktop-header">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="PetWash Home" className="flex items-center gap-3">
              <img src="/brand/petwash-logo-official.png" alt="PetWash™" className="h-14 lg:h-16" />
            </Link>
            
            {/* Desktop Navigation Links - Full GlobalNavigation mega-menu */}
            <nav className="flex items-center gap-4 flex-wrap">
              {/* Render ALL navigation items with dropdown support for children */}
              {desktopNavItems.map((item) => (
                <div key={item.id} className="relative group">
                  <Link 
                    href={item.path || '#'} 
                    className="text-sm font-medium hover:text-purple-600 transition-colors whitespace-nowrap flex items-center gap-1"
                    data-testid={`desktop-nav-${item.id}`}
                  >
                    {item.label}
                    {item.children && item.children.length > 0 && (
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    )}
                  </Link>
                  
                  {/* Dropdown for child items */}
                  {item.children && item.children.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-white dark:bg-gray-900 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 py-2 min-w-[200px] z-50">
                      {item.children.map((child) => (
                        <Link
                          key={child.id}
                          href={child.path || '#'}
                          className="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          data-testid={`desktop-nav-${item.id}-${child.id}`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            
            {/* User Section */}
            <nav className="flex items-center gap-6 flex-wrap">
              {user ? (
                <>
                  <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
                    {t('header.hello', language)}, {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <Link href="/dashboard" className="text-sm font-medium hover:text-purple-600 transition-colors whitespace-nowrap">
                    {t('nav.dashboard', language)}
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-sm font-medium hover:text-red-600 transition-colors whitespace-nowrap"
                    data-testid="button-logout-desktop"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('header.logout', language)}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/signin" className="text-sm font-medium hover:text-purple-600 transition-colors whitespace-nowrap">Login</Link>
                  <Link href="/signup" className="text-sm font-medium hover:text-purple-600 transition-colors whitespace-nowrap">Sign Up</Link>
                </>
              )}
              {onLanguageChange && (
                <div className="flex-shrink-0">
                  <LanguageToggle language={language} onLanguageChange={onLanguageChange} />
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet drawer - slides from right - FULL SCREEN OVERLAY */}
      {mobileMenuOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="xl:hidden"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            visibility: 'visible',
            opacity: 1
          }}
        >
          {/* Dark overlay that covers entire screen */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
          
          {/* White menu panel sliding from right - MAX 75% width */}
          <div 
            className="absolute top-0 right-0 h-full bg-white shadow-xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              paddingTop: "max(16px, env(safe-area-inset-top))",
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingBottom: '180px',
              position: 'absolute',
              zIndex: 10000,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              overflowY: 'auto',
              width: 'min(75vw, 400px)',
              maxWidth: '75vw'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <span className="font-medium text-sm">Menu</span>
              <button 
                aria-label="Close menu" 
                onClick={() => setMobileMenuOpen(false)} 
                className="h-9 w-9 grid place-items-center rounded-md border border-black/10 active:scale-95 transition-transform"
              >
                ✕
              </button>
            </div>

            {/* PROMINENT USER INFO & LOGOUT - At top for easy family access */}
            {user && (
              <div className="mt-4 mb-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      {t('header.loggedInAs', language)}
                    </div>
                    <div className="font-bold text-base text-gray-900 truncate">
                      {user.displayName || user.email?.split('@')[0]}
                    </div>
                    {user.email && (
                      <div className="text-xs text-gray-600 truncate">{user.email}</div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all"
                  data-testid="button-logout-prominent"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-base">{t('header.logout', language)}</span>
                </button>
              </div>
            )}
            
            {/* GlobalNavigation Component - Platform-aware navigation */}
            <div className="pt-3">
              {/* Show platform name only when on a platform page */}
              {currentPlatform && (
                <div className="text-xs font-semibold text-gray-500 uppercase mb-3 px-2">
                  {currentPlatform.displayName}
                </div>
              )}
              
              {/* Render GlobalNavigation sidebar variant - ALWAYS render to show fallback on non-platform pages */}
              <GlobalNavigation 
                userRole={
                  userRole?.role?.name 
                    ? (userRole.role.name.toUpperCase() as UserRole)
                    : userRole?.isSuperAdmin 
                    ? "ADMIN" 
                    : undefined
                }
                variant="sidebar"
                testId="header-nav"
              />
              
              {/* Additional community features not in platform navigation */}
              <div className="border-t pt-2 mt-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t('Community', language)}
                </div>
                
                <Link href="/pet-wash-circle" className="block py-2 px-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors font-medium text-amber-700">
                  {t('header.petWashCircle', language)}
                </Link>
                
                <Link href="/paw-finder" className="block py-2 px-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors font-medium text-blue-700">
                  {t('header.pawFinder', language)}
                </Link>
              </div>
            </div>
            
            <nav className="pt-3 space-y-2">
              
              {/* DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use) */}
              {/* {user && (
                <Link href="/plush-lab" className="block py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors font-medium text-pink-700">
                  ✨ The Plush Lab™
                </Link>
              )} */}
              
              {/* Enterprise Management Section - Only for Admin/Operations users */}
              {user && (userRole?.isSuperAdmin || userRole?.role?.department === 'operations' || userRole?.role?.department === 'k9000_supplier') && (
                <div className="border-t pt-2 mt-2">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('header.enterpriseManagement', language)}
                  </div>
                  
                  {/* Station Management */}
                  <Link href="/admin/stations" className="flex items-center gap-2 py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    <MapPin className="w-4 h-4" />
                    {t('header.stationManagement', language)}
                  </Link>
                  
                  {/* Stock & Inventory */}
                  <Link href="/admin/inventory" className="flex items-center gap-2 py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    <Package className="w-4 h-4" />
                    {t('header.stockInventory', language)}
                  </Link>
                  
                  {/* Spare Parts */}
                  <Link href="/admin/spare-parts" className="flex items-center gap-2 py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    <Wrench className="w-4 h-4" />
                    {t('header.spareParts', language)}
                  </Link>
                  
                  {/* K9000 Documents - Super Admin & K9000 Supplier Only */}
                  {(userRole?.isSuperAdmin || userRole?.role?.department === 'k9000_supplier') && (
                    <Link href="/admin/k9000-documents" className="flex items-center gap-2 py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                      <FileText className="w-4 h-4" />
                      {t('header.k9000Documents', language)}
                    </Link>
                  )}
                  
                  {/* Global Sites - Super Admin Only */}
                  {userRole?.isSuperAdmin && (
                    <Link href="/enterprise/hq" className="flex items-center gap-2 py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                      <Building2 className="w-4 h-4" />
                      {t('header.globalSites', language)}
                    </Link>
                  )}
                </div>
              )}
              
              {/* Quick Links Section - User already has logout at top */}
              {user ? (
                <div className="border-t pt-2 mt-2">
                  <Link href="/dashboard" className="block py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    {t('nav.dashboard', language)}
                  </Link>
                  <Link href="/mobile-ops" className="block py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    {t('header.mobileStations', language)}
                  </Link>
                </div>
              ) : (
                <div className="border-t pt-2 mt-2">
                  <Link href="/signin" className="block py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    {t('header.login', language)}
                  </Link>
                  <Link href="/signup" className="block py-2 text-sm hover:bg-gray-50 px-2 rounded transition-colors">
                    {t('header.signUp', language)}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
