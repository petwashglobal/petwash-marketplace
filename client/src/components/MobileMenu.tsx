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
        className={`block w-full text-left py-2.5 px-4 rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 ${className}`}
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
        className={`mobile-hamburger-menu-container fixed top-0 h-full bg-white shadow-2xl transform transition-all duration-300 overflow-y-auto scroll-smooth ${
          language === 'he' ? 'left-0' : 'right-0'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'clamp(300px, 80vw, 420px)',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-lg z-10 border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Pet Wash™</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 active:scale-95 transition-all duration-200"
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
                <MenuLink href="/k9000/booking" testId="menu-k9000-booking" className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300">
                  <span className="flex items-center gap-2 font-bold">
                    🚿 Book K9000 Wash
                    <Badge variant="secondary" className="text-xs bg-blue-500 text-white">Book Now</Badge>
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
                {user && (
                  <MenuLink href="/loyalty/dashboard" testId="menu-loyalty-dashboard" className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
                    <span className="flex items-center gap-2 font-bold">
                      <Medal className="w-5 h-5 text-yellow-600 fill-yellow-500" />
                      <span className="bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">My Loyalty Dashboard</span>
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-yellow-500 to-amber-500 text-white">7-Star</Badge>
                    </span>
                  </MenuLink>
                )}
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
                <MenuLink href="/walk-my-pet" testId="menu-walk-my-pet-book" className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
                  <span className="flex items-center gap-2 font-bold">
                    🐕 Book a Walker
                    <Badge variant="secondary" className="text-xs bg-green-500 text-white">Book Now</Badge>
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
                    <MenuLink href="/walk-my-pet/owner/dashboard" testId="menu-walk-owner-dashboard" className="bg-green-50 border border-green-200">
                      <span className="flex items-center gap-2 font-semibold">
                        📊 My Walks Dashboard
                      </span>
                    </MenuLink>
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
                <MenuLink href="/sitter-suite" testId="menu-sitter-suite-book" className="bg-gradient-to-r from-pink-50 to-rose-50 border-2 border-pink-300">
                  <span className="flex items-center gap-2 font-bold">
                    🏡 Book a Sitter
                    <Badge variant="secondary" className="text-xs bg-pink-500 text-white">Book Now</Badge>
                  </span>
                </MenuLink>
                {user && (
                  <>
                    <MenuLink href="/sitter-suite/owner/dashboard" testId="menu-owner-dashboard" className="bg-pink-50 border border-pink-200">
                      <span className="flex items-center gap-2 font-semibold">
                        📊 Owner Dashboard
                      </span>
                    </MenuLink>
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
                <MenuLink href="/academy" testId="menu-academy-book" className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300">
                  <span className="flex items-center gap-2 font-bold">
                    🎓 Book a Trainer
                    <Badge variant="secondary" className="text-xs bg-orange-500 text-white">Book Now</Badge>
                  </span>
                </MenuLink>
                {user && (
                  <>
                    <MenuLink href="/academy/owner/dashboard" testId="menu-academy-owner-dashboard" className="bg-orange-50 border border-orange-200">
                      <span className="flex items-center gap-2 font-semibold">
                        📊 My Training Sessions
                      </span>
                    </MenuLink>
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
                <MenuLink href="/pettrek/book" testId="menu-pettrek-book" className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300">
                  <span className="flex items-center gap-2 font-bold">
                    🚗 Book Transport
                    <Badge variant="secondary" className="text-xs bg-purple-500 text-white">Book Now</Badge>
                  </span>
                </MenuLink>
                {user && (
                  <>
                    <MenuLink href="/pettrek/track/:tripId" testId="menu-pettrek-track" className="bg-purple-100 border border-purple-200">
                      <span className="flex items-center gap-2">
                        📍 Track Trip LIVE
                        <Badge variant="secondary" className="text-xs">Real-Time</Badge>
                      </span>
                    </MenuLink>
                    <MenuLink href="/pettrek/customer/dashboard" testId="menu-pettrek-customer-dashboard" className="bg-purple-50 border border-purple-200">
                      <span className="flex items-center gap-2 font-semibold">
                        📊 My Trips Dashboard
                      </span>
                    </MenuLink>
                    <MenuLink href="/pettrek/provider/dashboard" testId="menu-pettrek-provider">Provider Dashboard</MenuLink>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Groomers Marketplace */}
            <AccordionItem value="groomers" className="border-2 border-rose-200 rounded-xl bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-100 shadow-md hover:shadow-xl transition-all">
              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-groomers-trigger">
                <span className="flex items-center gap-3 font-bold text-gray-900">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
                    <Scissors className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                  </div>
                  <span className="bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                    Grooming Marketplace
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3 space-y-1">
                <MenuLink href="/groomers/book" testId="menu-groomers-book" className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300">
                  <span className="flex items-center gap-2 font-bold">
                    ✂️ Book Grooming
                    <Badge variant="secondary" className="text-xs bg-rose-500 text-white">Book Now</Badge>
                  </span>
                </MenuLink>
                <MenuLink href="/groomers" testId="menu-groomers-explore">Explore Groomers</MenuLink>
                {user && (
                  <>
                    <MenuLink href="/groomers/customer/dashboard" testId="menu-groomers-customer-dashboard" className="bg-rose-50 border border-rose-200">
                      <span className="flex items-center gap-2 font-semibold">
                        📊 My Grooming Dashboard
                      </span>
                    </MenuLink>
                    <MenuLink href="/groomers/provider/dashboard" testId="menu-groomers-provider">Groomer Dashboard</MenuLink>
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

          {/* LIVE TRACKING & MAPS */}
          <div className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Tracking & Maps</h3>
            
            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="tracking" className="border-2 border-emerald-200 rounded-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-tracking-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 flex items-center justify-center shadow-lg">
                      <Navigation className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                      📍 Live GPS Tracking
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/track-my-pet" testId="menu-track-my-pet" className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300">
                    <span className="flex items-center gap-2 font-bold">
                      🐾 Track My Pet LIVE
                      <Badge variant="secondary" className="text-xs bg-emerald-500 text-white">Real-Time</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/walk-tracking/:walkId" testId="menu-walk-tracking">Track Walk Live</MenuLink>
                  <MenuLink href="/pettrek/track/:tripId" testId="menu-pettrek-tracking">Track Transport Live</MenuLink>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <MenuLink href="/locations" testId="menu-locations" className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg">
              <span className="flex items-center gap-2 font-bold">
                <MapPin className="w-4 h-4 text-blue-600" />
                🗺️ Find K9000 Stations
                <Badge variant="secondary" className="text-xs bg-blue-500 text-white">Maps</Badge>
              </span>
            </MenuLink>
          </div>

          <Separator className="my-4" />

          {/* HR & TEAM MANAGEMENT */}
          <div className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">HR & Team</h3>
            
            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="hr-team" className="border-2 border-amber-200 rounded-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-hr-team-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600 flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      Team Management
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/admin/recruitment" testId="menu-recruitment">Recruitment Dashboard</MenuLink>
                  <MenuLink href="/admin/staff-onboarding" testId="menu-staff-onboarding">Staff Onboarding</MenuLink>
                  <MenuLink href="/provider-onboarding" testId="menu-provider-onboarding">Provider Onboarding</MenuLink>
                  <MenuLink href="/team-inbox" testId="menu-team-inbox">Team Inbox</MenuLink>
                  <MenuLink href="/employee/expenses" testId="menu-employee-expenses">Employee Expenses</MenuLink>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <MenuLink href="/documents" testId="menu-documents" className="bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-slate-300 rounded-lg">
              <span className="flex items-center gap-2 font-bold">
                <FileText className="w-4 h-4 text-slate-600" />
                📄 Document Management
                <Badge variant="secondary" className="text-xs bg-slate-500 text-white">Secure</Badge>
              </span>
            </MenuLink>
          </div>

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

            {/* PREMIUM TOOLS */}
            <Accordion type="multiple" className="space-y-2 mt-2">
              <AccordionItem value="premium-tools" className="border-2 border-indigo-200 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-premium-tools-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Premium Tools
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/pet-care-planner" testId="menu-pet-care-planner" className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300">
                    <span className="flex items-center gap-2 font-bold">
                      🌡️ Pet Care & Weather
                      <Badge variant="secondary" className="text-xs bg-indigo-500 text-white">AI-Powered</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/weather-planner" testId="menu-weather-planner">Smart Weather Planner</MenuLink>
                  <MenuLink href="/pet-wash-day-planner" testId="menu-day-planner">Day Planner</MenuLink>
                </AccordionContent>
              </AccordionItem>

              {/* Social Impact Programs */}
              <AccordionItem value="social-impact" className="border-2 border-lime-200 rounded-xl bg-gradient-to-br from-lime-50 via-green-50 to-emerald-100 shadow-md hover:shadow-xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-social-impact-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-500 via-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                      <Award className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-lime-600 to-green-600 bg-clip-text text-transparent">
                      🌱 Social Impact
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/shared-services/programs" testId="menu-community-programs" className="bg-gradient-to-r from-lime-50 to-green-50 border-2 border-lime-300">
                    <span className="flex items-center gap-2 font-bold">
                      💚 Community Programs
                      <Badge variant="secondary" className="text-xs bg-lime-600 text-white">Impact</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/shared-services/impact" testId="menu-impact-metrics">Impact Dashboard</MenuLink>
                  <MenuLink href="/claim" testId="menu-claim-voucher">Claim Voucher</MenuLink>
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
                </AccordionContent>
              </AccordionItem>

              {/* Executive Suite - C-Level Dashboards */}
              <AccordionItem value="executive-suite" className="border-2 border-violet-300 rounded-xl bg-gradient-to-br from-violet-100 via-purple-100 to-fuchsia-200 shadow-lg hover:shadow-2xl transition-all">
                <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-executive-suite-trigger">
                  <span className="flex items-center gap-3 font-bold text-gray-900">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 flex items-center justify-center shadow-lg">
                      <Crown className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                    </div>
                    <span className="bg-gradient-to-r from-violet-700 to-purple-700 bg-clip-text text-transparent">
                      👑 Executive Suite
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 space-y-1">
                  <MenuLink href="/pet-wash-ltd/executive" testId="menu-executive-home" className="bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-300">
                    <span className="flex items-center gap-2 font-bold">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      Executive Home
                      <Badge variant="secondary" className="text-xs bg-violet-600 text-white">C-Suite</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/pet-wash-ltd/executive/ceo" testId="menu-ceo-dashboard" className="bg-violet-50 border border-violet-200">
                    <span className="flex items-center gap-2 font-semibold">
                      <Crown className="w-4 h-4 text-violet-600" />
                      CEO Dashboard
                    </span>
                  </MenuLink>
                  <MenuLink href="/pet-wash-ltd/executive/finance" testId="menu-finance-dashboard">Finance Dashboard</MenuLink>
                  <MenuLink href="/admin/hr" testId="menu-hr-dashboard">HR Dashboard</MenuLink>
                  <MenuLink href="/admin/sales" testId="menu-sales-dashboard">Sales Dashboard</MenuLink>
                  <MenuLink href="/admin/crm" testId="menu-crm-dashboard">CRM Dashboard</MenuLink>
                  <MenuLink href="/admin/logistics" testId="menu-logistics-dashboard">Logistics Dashboard</MenuLink>
                  
                  <Separator className="my-2" />
                  
                  <MenuLink href="/pet-wash-ltd/executive/kyc" testId="menu-kyc-verification">KYC & Verification</MenuLink>
                  <MenuLink href="/pet-wash-ltd/executive/compliance" testId="menu-compliance-tower">Compliance Control Tower</MenuLink>
                  <MenuLink href="/pet-wash-ltd/executive/audit" testId="menu-audit-trail">Audit Trail</MenuLink>
                  
                  <Separator className="my-2" />
                  
                  <MenuLink href="/investor-presentation" testId="menu-investor-presentation" className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
                    <span className="flex items-center gap-2 font-bold">
                      💼 Investor Presentation
                      <Badge variant="secondary" className="text-xs bg-yellow-600 text-white">Pitch Deck</Badge>
                    </span>
                  </MenuLink>
                  <MenuLink href="/showcase" testId="menu-platform-showcase">Platform Showcase</MenuLink>
                  <MenuLink href="/company-reports" testId="menu-company-reports">Company Reports</MenuLink>
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

                <MenuLink href="/settings/security" testId="menu-security-settings" className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Security & 2FA</span>
                  </span>
                </MenuLink>

                <MenuLink href="/connected-devices" testId="menu-connected-devices" className="border border-gray-200 rounded-lg">
                  <span className="flex items-center gap-2">
                    <Cog className="w-4 h-4" />
                    Connected Devices
                  </span>
                </MenuLink>

                <Separator className="my-2" />

                {/* ADMIN PANEL - Show for all logged-in users (self-service admin features) */}
                <Accordion type="multiple" className="space-y-2">
                  <AccordionItem value="admin-tools" className="border-2 border-red-200 rounded-xl bg-gradient-to-br from-red-50 via-orange-50 to-amber-100 shadow-md hover:shadow-xl transition-all">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="menu-admin-trigger">
                      <span className="flex items-center gap-3 font-bold text-gray-900">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                          <Shield className="w-6 h-6 text-white drop-shadow-md" strokeWidth={2.5} />
                        </div>
                        <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                          Admin Tools
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3 space-y-1">
                      <MenuLink href="/admin/dashboard" testId="menu-admin-dashboard" className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
                        <span className="flex items-center gap-2 font-semibold">
                          <BarChart className="w-4 h-4 text-red-600" />
                          Admin Dashboard
                        </span>
                      </MenuLink>
                      <MenuLink href="/admin/stations" testId="menu-admin-stations">Station Management</MenuLink>
                      <MenuLink href="/admin/fraud-dashboard" testId="menu-admin-fraud">Fraud Detection</MenuLink>
                      <MenuLink href="/admin/security-monitoring" testId="menu-admin-security">Security Monitor</MenuLink>
                      <MenuLink href="/admin/gemini-watchdog" testId="menu-admin-gemini">AI Watchdog</MenuLink>
                      
                      <Separator className="my-2" />
                      
                      <MenuLink href="/admin/vouchers" testId="menu-admin-vouchers">Voucher Management</MenuLink>
                      <MenuLink href="/admin/performance-monitoring" testId="menu-admin-performance">Performance Monitoring</MenuLink>
                      <MenuLink href="/admin/performance-reviews" testId="menu-admin-performance-reviews">Performance Reviews</MenuLink>
                      
                      <Separator className="my-2" />
                      
                      <MenuLink href="/mobile/ops" testId="menu-mobile-ops" className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-300">
                        <span className="flex items-center gap-2 font-bold">
                          📱 Mobile Ops Hub
                          <Badge variant="secondary" className="text-xs bg-sky-600 text-white">Mobile</Badge>
                        </span>
                      </MenuLink>
                      <MenuLink href="/admin/station-registry" testId="menu-station-registry">Station Registry</MenuLink>
                      <MenuLink href="/ops/dashboard" testId="menu-ops-dashboard">Operations Dashboard</MenuLink>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Separator className="my-2" />

                <button
                  onClick={handleLogout}
                  className="block w-full text-left py-2.5 px-4 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 active:scale-[0.98] text-gray-700"
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
