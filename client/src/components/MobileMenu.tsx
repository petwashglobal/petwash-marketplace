import { X, User, ChevronDown, Wallet, Settings, Inbox, Heart, MapPin, Star, Shield, Dog, Home, Sparkles, Truck, Building2, Users, LifeBuoy, Medal, Gift, Search, Cog, Globe, DollarSign, BarChart, Wrench, GraduationCap } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { t, type Language } from '@/lib/i18n';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Link } from 'wouter';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export function MobileMenu({ isOpen, onClose, language }: MobileMenuProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await signOut(auth);
    onClose();
    setLocation('/');
  };

  const MenuLink = ({ href, children, className = "", testId }: { href: string; children: React.ReactNode; className?: string; testId?: string }) => (
    <Link href={href}>
      <button
        onClick={onClose}
        className={`block w-full text-left py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
        data-testid={testId}
      >
        {children}
      </button>
    </Link>
  );

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`mobile-hamburger-menu-container fixed top-0 h-full bg-white shadow-2xl transform transition-transform overflow-y-auto ${
          language === 'he' ? 'left-0' : 'right-0'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'clamp(300px, 80vw, 420px)',
        }}
      >
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Pet Wash™</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <nav className="p-4 space-y-2" role="navigation">
          {/* CORE SERVICES - Premium Platforms */}
          <Accordion type="multiple" className="space-y-2">
            {/* Pet Wash Hub */}
            <AccordionItem value="petwash-hub" className="border-2 border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-petwash-hub-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Dog className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    Pet Wash Hub™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/our-service" testId="menu-our-service">
                  <span className="flex items-center gap-2">
                    💧 Our Service
                  </span>
                </MenuLink>
                <MenuLink href="/packages" testId="menu-packages" className="bg-blue-50 border border-blue-200">
                  <span className="flex items-center gap-2 font-semibold">
                    🎁 Wash Packages
                  </span>
                </MenuLink>
                <MenuLink href="/loyalty" testId="menu-loyalty">
                  <span className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                    <span className="font-semibold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">VIP Loyalty Program</span>
                  </span>
                </MenuLink>
                <MenuLink href="/locations" testId="menu-locations">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-500 fill-red-400" />
                    <span className="font-medium">Find Stations</span>
                  </span>
                </MenuLink>
                <MenuLink href="/gallery" testId="menu-gallery">Gallery & Reviews</MenuLink>
              </AccordionContent>
            </AccordionItem>

            {/* Walk My Pet™ */}
            <AccordionItem value="walk-my-pet" className="border-2 border-green-200 rounded-xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-walk-my-pet-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    🐕 Walk My Pet™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/walk-my-pet" testId="menu-walk-my-pet-book">
                  <span className="flex items-center gap-2">
                    📍 Book a Walker
                  </span>
                </MenuLink>
                {user && (
                  <>
                    <MenuLink href="/track-my-pet" testId="menu-track-my-pet-live" className="bg-purple-100 border border-purple-200">
                      <span className="flex items-center gap-2">
                        🐾 Track My Pet LIVE
                        <Badge variant="secondary" className="text-xs">Real-Time</Badge>
                      </span>
                    </MenuLink>
                    <MenuLink href="/walk-tracking/:walkId" testId="menu-walk-history">Walk History</MenuLink>
                  </>
                )}
                <MenuLink href="/walk-my-pet/walker/dashboard" testId="menu-walker-dashboard">Become a Walker</MenuLink>
                <MenuLink href="/provider-onboarding" testId="menu-walker-onboarding" className="text-sm text-gray-600">Walker Sign Up</MenuLink>
              </AccordionContent>
            </AccordionItem>

            {/* The Sitter Suite™ */}
            <AccordionItem value="sitter-suite" className="border-2 border-pink-200 rounded-xl bg-gradient-to-br from-pink-50 via-rose-50 to-red-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-sitter-suite-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 flex items-center justify-center shadow-lg">
                    <Home className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                    The Sitter Suite™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/sitter-suite" testId="menu-sitter-suite-book">Book a Sitter</MenuLink>
                {user && (
                  <>
                    <MenuLink href="/sitter-suite/owner/dashboard" testId="menu-owner-dashboard">Owner Dashboard</MenuLink>
                    <MenuLink href="/sitter-suite/sitter/dashboard" testId="menu-sitter-dashboard">Sitter Dashboard</MenuLink>
                  </>
                )}
                <Separator className="my-2" />
                <MenuLink href="/sitter-suite/privacy-policy" className="text-sm text-gray-600">Privacy Policy</MenuLink>
                <MenuLink href="/sitter-suite/terms-conditions" className="text-sm text-gray-600">Terms & Conditions</MenuLink>
              </AccordionContent>
            </AccordionItem>

            {/* Pet Wash Academy™ - Professional Trainers */}
            <AccordionItem value="academy" className="border-2 border-orange-200 rounded-xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-academy-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    🎓 Pet Wash Academy™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/academy" testId="menu-academy-book">Book a Trainer</MenuLink>
                {user && (
                  <>
                    <MenuLink href="/academy/owner/dashboard" testId="menu-academy-owner-dashboard">My Training Sessions</MenuLink>
                    <MenuLink href="/academy/trainer/dashboard" testId="menu-trainer-dashboard">Trainer Dashboard</MenuLink>
                  </>
                )}
                <MenuLink href="/provider-onboarding" testId="menu-trainer-onboarding" className="text-sm text-gray-600">Become a Trainer</MenuLink>
              </AccordionContent>
            </AccordionItem>

            {/* PetTrek™ - Pet Transport */}
            <AccordionItem value="pettrek" className="border-2 border-purple-200 rounded-xl bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-pettrek-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                    <Truck className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    PetTrek™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/pettrek/book" testId="menu-pettrek-book">Book Transport</MenuLink>
                {user && (
                  <>
                    <MenuLink href="/pettrek/track/:tripId" testId="menu-pettrek-track">Track Trip</MenuLink>
                    <MenuLink href="/pettrek/provider/dashboard" testId="menu-pettrek-provider">Provider Dashboard</MenuLink>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* K9000 IoT Stations */}
            <AccordionItem value="k9000" className="border-2 border-slate-300 rounded-xl bg-gradient-to-br from-slate-100 via-gray-100 to-zinc-200 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-k9000-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 via-gray-700 to-zinc-800 flex items-center justify-center shadow-lg">
                    <Shield className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-slate-700 to-gray-800 bg-clip-text text-transparent">
                    K9000 Technology
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/our-service" testId="menu-k9000-tech">K9000 Tech Specs</MenuLink>
                {user && (
                  <MenuLink href="/admin/stations" testId="menu-k9000-admin">Station Management</MenuLink>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use) */}
            {/* <AccordionItem value="plush-lab" className="border-2 border-fuchsia-200 rounded-xl bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-plush-lab-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    The Plush Lab™
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/plush-lab" testId="menu-avatar-creator" className="bg-pink-100 border border-pink-200">
                  <span className="flex items-center gap-2 font-semibold">
                    ✨ Avatar Creator
                    <Badge variant="secondary" className="text-xs">AI-Powered</Badge>
                  </span>
                </MenuLink>
                {user && (
                  <MenuLink href="/plush-lab?tab=my-avatars" testId="menu-my-avatars">My Avatars</MenuLink>
                )}
                <MenuLink href="/plush-lab?tab=gallery" testId="menu-avatar-gallery">Avatar Gallery</MenuLink>
              </AccordionContent>
            </AccordionItem> */}
          </Accordion>

          <Separator className="my-4" />

          {/* COMMUNITY & FREE SERVICES */}
          <div className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Community & Social</h3>
            
            {/* Paw Finder with Submenus */}
            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="paw-finder" className="border-2 border-red-200 rounded-xl bg-gradient-to-br from-red-50 via-orange-50 to-amber-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-paw-finder-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                      <Heart className="w-6 h-6 text-white fill-white drop-shadow-md" strokeWidth={2} />
                    </div>
                    <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                      🆓 Paw Finder™
                    </span>
                    <Badge variant="destructive" className="ml-2 text-xs shadow-md">FREE</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/paw-finder" testId="menu-find-lost-pet">Find Lost Pet</MenuLink>
                  <MenuLink href="/paw-finder/report" testId="menu-report-lost-pet" className="bg-red-50 border border-red-200">
                    🆘 Report Lost Pet
                  </MenuLink>
                  <MenuLink href="/paw-finder/found" testId="menu-report-found-pet">Report Found Pet</MenuLink>
                  <MenuLink href="/paw-finder/reunited" testId="menu-reunited-stories">Success Stories</MenuLink>
                  <MenuLink href="/paw-finder/alerts" testId="menu-pet-alerts">Pet Alerts Near Me</MenuLink>
                </AccordionContent>
              </AccordionItem>

              {/* Pet Wash Circle™ - Social Platform */}
              <AccordionItem value="petwash-circle" className="border-2 border-cyan-200 rounded-xl bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-petwash-circle-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                      Pet Wash Circle™
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/petwash-circle" testId="menu-social-feed" className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                    <span className="flex items-center gap-2 font-semibold">
                      ✨ Social Feed
                      <Badge variant="secondary" className="text-xs">Live</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/petwash-circle/members" testId="menu-members">
                    <span className="flex items-center gap-2">
                      👥 Member Directory
                    </span>
                  </MenuLink>
                  <MenuLink href="/petwash-circle/forum" testId="menu-forum">
                    <span className="flex items-center gap-2">
                      💬 Community Forum
                    </span>
                  </MenuLink>
                  <MenuLink href="/petwash-circle/events" testId="menu-events" className="bg-purple-50 border border-purple-200">
                    <span className="flex items-center gap-2 font-semibold">
                      🎉 Pet Events
                    </span>
                  </MenuLink>
                  <MenuLink href="/petwash-circle/photos" testId="menu-photo-sharing">
                    <span className="flex items-center gap-2">
                      📸 Photo Gallery
                    </span>
                  </MenuLink>
                  {user && (
                    <MenuLink href="/petwash-circle/my-profile" testId="menu-my-profile">
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        My Profile
                      </span>
                    </MenuLink>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <MenuLink href="/service-status" testId="menu-service-status" className="border border-gray-200 rounded-lg mt-2">
              <span className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-gray-600" />
                Service Status
              </span>
            </MenuLink>
          </div>

          <Separator className="my-4" />

          {/* BUSINESS SOLUTIONS */}
          <div className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Business</h3>
            
            {/* Enterprise - Full Platform */}
            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="enterprise" className="border-2 border-orange-200 rounded-xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 shadow-lg hover:shadow-2xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-enterprise-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
                      <Medal className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      Enterprise Solutions
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  {/* Franchise Management */}
                  <MenuLink href="/franchise" testId="menu-franchise" className="bg-orange-50 border border-orange-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      🌍 Franchise Opportunities
                    </span>
                  </MenuLink>
                  <MenuLink href="/enterprise/franchise/dashboard" testId="menu-franchise-dashboard">Franchise Dashboard</MenuLink>
                  <MenuLink href="/enterprise/franchise/locations" testId="menu-franchise-locations">Manage Locations</MenuLink>
                  <MenuLink href="/enterprise/franchise/revenue" testId="menu-franchise-revenue">Revenue Reports</MenuLink>
                  
                  <Separator className="my-2" />
                  
                  {/* White-Label Solutions */}
                  <MenuLink href="/enterprise/white-label" testId="menu-white-label" className="bg-blue-50 border border-blue-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <Wrench className="w-4 h-4 text-blue-600" />
                      White-Label Platform
                    </span>
                  </MenuLink>
                  <MenuLink href="/enterprise/white-label/branding" testId="menu-custom-branding">Custom Branding</MenuLink>
                  <MenuLink href="/enterprise/white-label/domains" testId="menu-custom-domains">Custom Domains</MenuLink>
                  
                  <Separator className="my-2" />
                  
                  {/* Multi-Currency & Global */}
                  <MenuLink href="/enterprise/multi-currency" testId="menu-multi-currency" className="bg-green-50 border border-green-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <Globe className="w-4 h-4 text-green-600" />
                      Multi-Currency Operations
                    </span>
                  </MenuLink>
                  <MenuLink href="/enterprise/global/countries" testId="menu-country-settings">Country Settings</MenuLink>
                  <MenuLink href="/enterprise/global/tax-compliance" testId="menu-tax-compliance">Tax Compliance</MenuLink>
                  
                  <Separator className="my-2" />
                  
                  {/* Analytics & BI */}
                  <MenuLink href="/enterprise/analytics" testId="menu-enterprise-analytics" className="bg-purple-50 border border-purple-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <BarChart className="w-4 h-4 text-purple-600" />
                      Analytics Dashboard
                    </span>
                  </MenuLink>
                  <MenuLink href="/enterprise/hq" testId="menu-enterprise-hq">Enterprise HQ</MenuLink>
                  {user && userRole?.role === 'admin' && (
                    <MenuLink href="/admin/enterprise" testId="menu-admin-enterprise">Admin: Enterprise</MenuLink>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator className="my-2" />

            <MenuLink href="/about" testId="menu-about" className="border border-gray-200 rounded-lg">
              {t('nav.about', language)}
            </MenuLink>

            <MenuLink href="/contact" testId="menu-contact" className="border border-gray-200 rounded-lg">
              {t('nav.contact', language)}
            </MenuLink>
          </div>

          <Separator className="my-4" />

          {/* USER ACCOUNT SECTION */}
          <div className="space-y-2">
            {user ? (
              <>
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">My Account</h3>
                
                <MenuLink href="/dashboard" testId="menu-dashboard" className="bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 font-semibold rounded-lg">
                  <span className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t('nav.dashboard', language)}
                  </span>
                </MenuLink>

                <MenuLink href="/my-wallet" testId="menu-wallet" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    My Wallet & Vouchers
                  </span>
                </MenuLink>

                <MenuLink href="/buy-gift-card" testId="menu-buy-gift" className="bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-pink-300 font-semibold rounded-lg">
                  <span className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-pink-600" />
                    🎁 Buy E-Gift Card
                  </span>
                </MenuLink>

                <MenuLink href="/pets" testId="menu-pets" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Dog className="w-4 h-4" />
                    My Pets
                  </span>
                </MenuLink>

                <MenuLink href="/inbox" testId="menu-inbox" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Inbox className="w-4 h-4" />
                    Inbox
                  </span>
                </MenuLink>

                <MenuLink href="/my-subscriptions" testId="menu-subscriptions" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Subscriptions
                  </span>
                </MenuLink>

                <MenuLink href="/settings" testId="menu-settings" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </span>
                </MenuLink>

                <Separator className="my-2" />

                <button
                  onClick={handleLogout}
                  className="block w-full text-left py-2.5 px-4 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-gray-700"
                  data-testid="menu-logout"
                >
                  {t('nav.logout', language)}
                </button>
              </>
            ) : (
              <MenuLink href="/signin" testId="menu-signin" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:from-blue-700 hover:to-purple-700">
                <span className="flex items-center gap-2 justify-center">
                  <User className="w-5 h-5" />
                  {t('nav.login', language)}
                </span>
              </MenuLink>
            )}
          </div>

          <Separator className="my-4" />

          {/* LEGAL */}
          <div className="space-y-1 pb-6">
            <MenuLink href="/privacy" className="text-sm text-gray-600">
              {t('nav.privacy', language)}
            </MenuLink>
            <MenuLink href="/terms" className="text-sm text-gray-600">
              Terms of Service
            </MenuLink>
            <MenuLink href="/accessibility" className="text-sm text-gray-600">
              Accessibility
            </MenuLink>
          </div>
        </nav>
      </div>
    </div>
  );
}
