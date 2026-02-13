import "./lib/i18next-init"; // Initialize react-i18next before any component imports
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingStack } from "@/components/FloatingStack";
import { AiChatWidget } from "@/components/AiChatWidget";
import { CookieConsent } from "@/components/CookieConsent";
import { ConsentManager } from "@/components/ConsentManager";
import { getConsentPreferences, applyConsentPreferences } from "@/lib/consent";
import { LuxuryPlatformShowcase } from "@/components/LuxuryPlatformShowcase";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { AuthProvider, useFirebaseAuth } from "@/auth/AuthProvider";
import { SimpleAuthProvider } from "@/hooks/useSimpleAuth";
import RequireAuth from "@/auth/RequireAuth";
import { initClientSentry } from "@/lib/sentry";

initClientSentry();
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { initViewportFix } from "@/lib/viewportFix";
import { useState, useEffect, lazy, Suspense } from "react";
import type { Language } from "@/lib/i18n";
import { getDefaultLanguageByLocation } from "@/lib/geolocation";
import { LanguageProvider, useLanguage } from "@/lib/languageStore";
import { initializeInteractionTracking } from "@/lib/interactionTracker";
import { useFCMNotifications } from "@/hooks/useFCMNotifications";
import { usePersonalizedGreeting } from "@/hooks/usePersonalizedGreeting";
import { GoogleOneTap } from "@/components/GoogleOneTap";

// CRITICAL: Only import home route components (for instant load)
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import EmployeeExpenses from "@/pages/EmployeeExpenses";
import NewExpense from "@/pages/NewExpense";
import MyExpenses from "@/pages/MyExpenses";
import ApproveExpenses from "@/pages/ApproveExpenses";
import StaffApplication from "@/pages/StaffApplication";
import StaffOnboarding from "@/pages/admin/StaffOnboarding";

// LAZY LOAD: All other routes (code split for performance)
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const TalentMarketplace = lazy(() => import("@/pages/PetWashTalentMarketplacePage"));
const ProviderDetail = lazy(() => import("@/pages/ProviderDetail"));
const ProviderCompliance = lazy(() => import("@/pages/ProviderCompliance"));
const BecomeProvider = lazy(() => import("@/pages/BecomeProvider"));
const ProviderBookingsDashboard = lazy(() => import("@/pages/ProviderBookingsDashboard"));
const AccountingDashboard = lazy(() => import("@/pages/AccountingDashboard"));
const UnifiedControlPanel = lazy(() => import("@/pages/UnifiedControlPanel"));
const MarketplaceBookingFlow = lazy(() => import("@/pages/MarketplaceBookingFlow"));
const BookingSearchPage = lazy(() => import("@/pages/BookingSearchPage"));
const PrivilegeSignup = lazy(() => import("@/pages/PrivilegeSignup"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const LoyaltyDashboard = lazy(() => import("@/pages/LoyaltyDashboard"));
const LoyaltyTiers = lazy(() => import("@/pages/LoyaltyTiers"));
const LoyaltyBenefits = lazy(() => import("@/pages/LoyaltyBenefits"));
const LoyaltyBirthday = lazy(() => import("@/pages/LoyaltyBirthday"));
const LoyaltyRefer = lazy(() => import("@/pages/LoyaltyRefer"));
const ReferralPage = lazy(() => import("@/pages/ReferralPage"));
const EGift = lazy(() => import("@/pages/EGift"));
const Vouchers = lazy(() => import("@/pages/Vouchers"));
const Verify = lazy(() => import("@/pages/Verify"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Accessibility = lazy(() => import("@/pages/Accessibility"));
const AccessibilityStatement = lazy(() => import("@/pages/AccessibilityStatement"));
const About = lazy(() => import("@/pages/About"));
const Franchise = lazy(() => import("@/pages/Franchise"));
const Contact = lazy(() => import("@/pages/Contact"));
const OurService = lazy(() => import("@/pages/OurService"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminBackendPanel = lazy(() => import("@/pages/AdminBackendPanel"));
const AdminGoogleForms = lazy(() => import("@/pages/AdminGoogleForms"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminLoginV2 = lazy(() => import("@/pages/admin/AdminLoginV2"));
const AdminAccessDenied = lazy(() => import("@/pages/AdminAccessDenied"));
const GroupStatusMonitor = lazy(() => import("@/pages/admin/GroupStatusMonitor"));
const CEODashboard = lazy(() => import("@/pages/CEODashboard"));
const AdminKYC = lazy(() => import("@/pages/AdminKYC"));
const AdminSystemLogs = lazy(() => import("@/pages/AdminSystemLogs"));
const AdminVouchers = lazy(() => import("@/pages/AdminVouchers"));
const AdminFinancial = lazy(() => import("@/pages/AdminFinancial"));
const CrmDashboard = lazy(() => import("@/pages/CrmDashboard"));
const CustomerManagement = lazy(() => import("@/pages/CustomerManagement"));
const LeadManagement = lazy(() => import("@/pages/LeadManagement"));
const CommunicationCenter = lazy(() => import("@/pages/CommunicationCenter"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const FounderMember = lazy(() => import("@/pages/FounderMember"));
const ClaimVoucher = lazy(() => import("@/pages/ClaimVoucher"));
const BuyGiftCard = lazy(() => import("@/pages/BuyGiftCard"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Pets = lazy(() => import("@/pages/Pets"));
const PetCarePlanner = lazy(() => import("@/pages/PetCarePlanner"));
const EnterpriseFeaturesShowcase = lazy(() => import("@/pages/EnterpriseFeaturesShowcase"));
const PetWashCircle = lazy(() => import("@/pages/PetWashCircle"));
// DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use)
// const PlushLab = lazy(() => import("@/pages/PlushLab"));
const StandaloneDivisions = lazy(() => import("@/pages/StandaloneDivisions"));
const Settings = lazy(() => import("@/pages/Settings"));
const SecuritySettings = lazy(() => import("@/pages/SecuritySettings"));
const SecurityStatus = lazy(() => import("@/pages/SecurityStatus"));
const KenzoAI = lazy(() => import("@/pages/KenzoAI"));
const LiveChat = lazy(() => import("@/pages/LiveChat"));
const MyDevices = lazy(() => import("@/pages/MyDevices"));
const DeviceManagement = lazy(() => import("@/pages/DeviceManagement"));
const ConnectedDevices = lazy(() => import("@/pages/ConnectedDevices"));
const AdminGuide = lazy(() => import("@/pages/AdminGuide"));
const AdminHelpGuide = lazy(() => import("@/pages/AdminHelpGuide"));
const FranchiseDashboard = lazy(() => import("@/pages/franchise/FranchiseDashboard"));
const FranchiseInbox = lazy(() => import("@/pages/franchise/FranchiseInbox"));
const FranchiseReports = lazy(() => import("@/pages/franchise/FranchiseReports"));
const FranchiseSupport = lazy(() => import("@/pages/franchise/FranchiseSupport"));
const FranchiseMarketing = lazy(() => import("@/pages/franchise/FranchiseMarketing"));
const AdminInbox = lazy(() => import("@/pages/AdminInbox"));
const WalletDownload = lazy(() => import("@/pages/WalletDownload"));
const MyWallet = lazy(() => import("@/pages/MyWallet"));
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const AdminStations = lazy(() => import("@/pages/AdminStations"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminTeamInvitations = lazy(() => import("@/pages/AdminTeamInvitations"));
const TeamInbox = lazy(() => import("@/pages/TeamInbox"));
const MobileStationHub = lazy(() => import("@/pages/MobileStationHub"));
const MobileStationSheet = lazy(() => import("@/pages/MobileStationSheet"));
const MobileOpsHub = lazy(() => import("@/pages/MobileOpsHub"));
const OpsTodayPage = lazy(() => import("@/pages/OpsTodayPage"));
const WelcomeConsent = lazy(() => import("@/pages/WelcomeConsent"));
const OpsDashboard = lazy(() => import("@/pages/OpsDashboard"));
const EnterpriseHQ = lazy(() => import("@/pages/EnterpriseHQ"));
const FranchiseeDashboard = lazy(() => import("@/pages/FranchiseeDashboard"));
const TechnicianView = lazy(() => import("@/pages/TechnicianView"));
const StatusDashboard = lazy(() => import("@/pages/StatusDashboard"));
const DocumentManagement = lazy(() => import("@/pages/DocumentManagement"));
const K9000Documents = lazy(() => import("@/pages/K9000Documents"));
const InventoryManagement = lazy(() => import("@/pages/InventoryManagement"));
const SparePartsManagement = lazy(() => import("@/pages/SparePartsManagement"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const MySubscriptions = lazy(() => import("@/pages/MySubscriptions"));
const BackendTeam = lazy(() => import("@/pages/BackendTeam"));
const Locations = lazy(() => import("@/pages/Locations"));
const Packages = lazy(() => import("@/pages/Packages"));
const CompanyReports = lazy(() => import("@/pages/CompanyReports"));
const InvestorPresentation = lazy(() => import("@/pages/InvestorPresentation"));
const AuthAction = lazy(() => import("@/pages/AuthAction"));
const NotFound = lazy(() => import("@/pages/not-found"));
const JvPartnersDashboard = lazy(() => import("@/pages/JvPartnersDashboard"));
const SuppliersDashboard = lazy(() => import("@/pages/SuppliersDashboard"));
const StationRegistryDashboard = lazy(() => import("@/pages/StationRegistryDashboard"));
const HRDashboard = lazy(() => import("@/pages/HRDashboard"));
const PerformanceReviewsDashboard = lazy(() => import("@/pages/PerformanceReviewsDashboard"));
const RecruitmentDashboard = lazy(() => import("@/pages/RecruitmentDashboard"));
const SalesDashboard = lazy(() => import("@/pages/SalesDashboard"));
const OperationsDashboard = lazy(() => import("@/pages/OperationsDashboard"));
const LogisticsDashboard = lazy(() => import("@/pages/LogisticsDashboard"));
const FinanceDashboard = lazy(() => import("@/pages/FinanceDashboard"));
const UnifiedEntityManagement = lazy(() => import("@/pages/UnifiedEntityManagement"));
const PolicyManagementDashboard = lazy(() => import("@/pages/PolicyManagementDashboard"));
const FranchiseManagementDashboard = lazy(() => import("@/pages/FranchiseManagementDashboard"));
const AdminRouteGuard = lazy(() => import("@/components/AdminRouteGuard").then(m => ({ default: m.AdminRouteGuard })));
const AdminSecurityMonitoring = lazy(() => import("@/pages/AdminSecurityMonitoring"));
const ComplianceControlTower = lazy(() => import("@/pages/ComplianceControlTower"));
const GeminiWatchdogDashboard = lazy(() => import("@/pages/GeminiWatchdogDashboard"));
const PerformanceMonitoring = lazy(() => import("@/pages/PerformanceMonitoring"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const PetWashDayPlanner = lazy(() => import("@/pages/PetWashDayPlanner"));
const RoleAwareWeatherPlanner = lazy(() => import("@/pages/RoleAwareWeatherPlanner"));

// ⁦The Sitter Suite™⁩ - Pet Sitting Marketplace
const SitterSuiteOverview = lazy(() => import("@/pages/sitter-suite/Overview"));
const SitterSuite = lazy(() => import("@/pages/sitter-suite/BrowseSitters"));
const SitterDetail = lazy(() => import("@/pages/sitter-suite/SitterDetail"));
const SitterBookingFlow = lazy(() => import("@/pages/sitter-suite/BookingFlow"));
const SitterOwnerDashboard = lazy(() => import("@/pages/sitter-suite/OwnerDashboard"));
const SitterDashboard = lazy(() => import("@/pages/sitter-suite/SitterDashboard"));
const SitterEditProfile = lazy(() => import("@/pages/sitter-suite/SitterEditProfile"));
const OwnerDashboardPage = SitterOwnerDashboard; // Alias
const SitterDashboardPage = SitterDashboard; // Alias

// ⁦Pet Wash Academy™⁩ - Professional Trainer Marketplace
const Academy = lazy(() => import("@/pages/Academy"));
const TrainerProfile = lazy(() => import("@/pages/academy/TrainerProfile"));
const TrainerDetail = lazy(() => import("@/pages/academy/TrainerDetail"));
const AcademyBookingFlow = lazy(() => import("@/pages/academy/BookingFlow"));

// Contractor Dashboard - 2026 Lifecycle Management
const ContractorDashboard = lazy(() => import("@/pages/contractor/Dashboard"));

// ⁦Walk My Pet™⁩ - Premium Dog Walking
const WalkMyPetOverview = lazy(() => import("@/pages/walk-my-pet/Overview"));
const WalkMyPet = lazy(() => import("@/pages/walk-my-pet/BrowseWalkers"));
const WalkerDetail = lazy(() => import("@/pages/walk-my-pet/WalkerDetail"));
const WalkBookingFlow = lazy(() => import("@/pages/walk-my-pet/BookingFlow"));
const WalkOwnerDashboardPage = lazy(() => import("@/pages/walk-my-pet/OwnerDashboard"));
const WalkerDashboardPage = lazy(() => import("@/pages/walk-my-pet/WalkerDashboard"));
const WalkerBooking = lazy(() => import("@/pages/WalkerBooking"));

// ⁦PetTrek™⁩ - Advanced Pet Transport
const PetTrekOverview = lazy(() => import("@/pages/pettrek/Overview"));
const PetTrek = lazy(() => import("@/pages/pettrek/BrowseDrivers"));
const DriverDetail = lazy(() => import("@/pages/pettrek/DriverDetail"));
const PetTrekBookingFlow = lazy(() => import("@/pages/pettrek/BookingFlow"));
const PetTrekCustomerDashboard = lazy(() => import("@/pages/pettrek/CustomerDashboard"));
const PetTrekDriverDashboard = lazy(() => import("@/pages/pettrek/DriverDashboard"));

// Grooming Marketplace - Professional Pet Grooming Services
const GroomersOverview = lazy(() => import("@/pages/groomers/Overview"));
const Groomers = lazy(() => import("@/pages/Groomers"));
const GroomerDetail = lazy(() => import("@/pages/groomers/GroomerDetail"));
const GroomersBook = lazy(() => import("@/pages/GroomersBook"));
const GroomersCustomerDashboard = lazy(() => import("@/pages/GroomersCustomerDashboard"));
const GroomersProviderDashboard = lazy(() => import("@/pages/GroomersProviderDashboard"));

// Shared Pet Services Foundation - Cross-Platform Community Services
const SharedServicesPrograms = lazy(() => import("@/pages/SharedServicesPrograms"));
const SharedServicesImpact = lazy(() => import("@/pages/SharedServicesImpact"));
const GlobalCommunityHub = lazy(() => import("@/pages/GlobalCommunityHub"));

// Pet Wash Platform Hub - Unified Service Discovery
const PlatformHub = lazy(() => import("@/pages/PlatformHub"));

// PetWash HQ - Octopus Control Panel (Luxury 2025 Admin)
const OctopusControlPanel = lazy(() => import("@/modules/octopus/PetWashOctopusControlPanel"));

// Mobile Management Dashboard - Executive Suite 2026
const MobileManagementDashboard = lazy(() => import("@/pages/MobileManagementDashboard"));

// K9000 Wash Stations - Self-Service Organic Pet Washing
const K9000Overview = lazy(() => import("@/pages/k9000/Overview"));
const K9000BookingFlow = lazy(() => import("@/pages/k9000/BookingFlow"));

const AuditTrail = lazy(() => import("@/pages/AuditTrail"));
const FraudDashboard = lazy(() => import("@/pages/admin/FraudDashboard"));
const ProviderReview = lazy(() => import("@/pages/admin/ProviderReview"));

// Pet Wash Ltd Executive Suite - Centralized C-Suite Management
const ExecutiveSuiteHome = lazy(() => import("@/pages/ExecutiveSuiteHome"));
const ExecutiveSuiteGuard = lazy(() => import("@/components/ExecutiveSuiteGuard").then(m => ({ default: m.ExecutiveSuiteGuard })));
const Meetings = lazy(() => import("@/pages/Meetings"));
const PlatformLegalFramework = lazy(() => import("@/pages/PlatformLegalFramework"));
const ProviderOnboarding = lazy(() => import("@/pages/ProviderOnboarding"));
const ProviderApplicationForm = lazy(() => import("@/pages/ProviderApplicationForm"));
const ProviderListings = lazy(() => import("@/pages/ProviderListings"));
const PlatformShowcase = lazy(() => import("@/pages/PlatformShowcase"));
const PawFinder = lazy(() => import("@/pages/PawFinder"));
const ServiceStatus = lazy(() => import("@/pages/ServiceStatus"));

// ⁦Pet Wash™⁩ 2025 Global Architecture - Octopus Model Routes
const Hub = lazy(() => import("@/pages/Hub"));
const Stations = lazy(() => import("@/pages/Stations"));
const Shop = lazy(() => import("@/pages/Shop"));
const BookingUnified = lazy(() => import("@/pages/BookingUnified"));
const StationMap = lazy(() => import("@/pages/StationMap"));
const Story = lazy(() => import("@/pages/Story"));
const Media = lazy(() => import("@/pages/Media"));
const Careers = lazy(() => import("@/pages/Careers"));
const MyApplications = lazy(() => import("@/pages/MyApplications"));
const HRAdminDashboard = lazy(() => import("@/pages/HRAdminDashboard"));
const JobManagement = lazy(() => import("@/pages/JobManagement"));
const Support = lazy(() => import("@/pages/Support"));
const SystemStatus = lazy(() => import("@/pages/SystemStatus"));

// Partner Routes
const FranchisePartners = lazy(() => import("@/pages/partners/Franchise"));
const LocationPartners = lazy(() => import("@/pages/partners/Locations"));
const SuppliersPartners = lazy(() => import("@/pages/partners/Suppliers"));
const MunicipalPartners = lazy(() => import("@/pages/partners/Municipal"));

// Legal Routes
const LegalTerms = lazy(() => import("@/pages/legal/Terms"));
const LegalPrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const EGiftPolicy = lazy(() => import("@/pages/legal/EGiftPolicy"));
const LoyaltyTermsPage = lazy(() => import("@/pages/legal/LoyaltyTerms"));
const CookiesPolicy = lazy(() => import("@/pages/legal/Cookies"));
const AccessibilityStatementPage = lazy(() => import("@/pages/legal/AccessibilityStatement"));
const MarketplaceTerms = lazy(() => import("@/pages/legal/MarketplaceTerms"));

// ⁦Walk My Pet™⁩ Pages
const TrackWalk = lazy(() => import("@/pages/walks/TrackWalk"));

// ⁦PetTrek™⁩ Pages
const BookTrip = lazy(() => import("@/pages/pettrek/BookTrip"));
const TrackTrip = lazy(() => import("@/pages/pettrek/TrackTrip"));
const ProviderDashboard = lazy(() => import("@/pages/pettrek/ProviderDashboard"));

// ⁦The Sitter Suite™⁩ - Legal Documents (Airbnb-style compliance)
const SitterPrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const SitterTermsConditions = lazy(() => import("@/pages/legal/TermsConditions"));
const SitterDisclaimer = lazy(() => import("@/pages/legal/Disclaimer"));

// ⁦Walk My Pet™⁩ - Legacy/Alias Pages
const WalkTracking = lazy(() => import("@/pages/walks/TrackWalk")); // Alias
const TrackMyPetLive = lazy(() => import("@/pages/walks/TrackWalk")); // Alias

// ⁦PetTrek™⁩ - Legacy/Alias Pages
const PetTrekBooking = lazy(() => import("@/pages/pettrek/BookTrip")); // Alias
const PetTrekTracking = lazy(() => import("@/pages/pettrek/TrackTrip")); // Alias
const PetTrekProviderDashboard = lazy(() => import("@/pages/pettrek/ProviderDashboard")); // Alias

// Unified Provider Dashboard (Uber/MadPaws style)
const UnifiedProviderDashboard = lazy(() => import("@/pages/ProviderDashboard"));

// E-Signature System
const DocumentSigning = lazy(() => import("@/pages/DocumentSigning"));

// Personal Secure Inbox
const PersonalInbox = lazy(() => import("@/pages/PersonalInbox"));

// Loading fallback component
const PageLoader = () => (
  <div data-build-version="BUILD_2026_01_25_1769349430610" className="min-h-screen bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

function Router({ language, onLanguageChange }: { language: Language; onLanguageChange: (lang: Language) => void }) {
  const { user, loading } = useFirebaseAuth();
  const { trackLanguageChange } = useAnalytics();
  const IS_DEV = import.meta.env.DEV === true;
  
  // Initialize FCM push notifications (auto-registers after login)
  useFCMNotifications(true);
  
  // Get personalized AI greeting on app launch 🎉
  usePersonalizedGreeting();
  
  useScrollToTop();

  // Show Google One Tap only when user is not logged in
  const showOneTap = !user && !loading;

  const handleLanguageChange = (newLanguage: Language) => {
    if (newLanguage !== language) {
      trackLanguageChange(language, newLanguage);
      onLanguageChange(newLanguage);
      localStorage.setItem('language', newLanguage);
    }
  };

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Google One Tap - Disabled to improve page load speed */}
      {/* {showOneTap && <GoogleOneTap enabled={true} autoPrompt={true} />} */}
      
      <Switch>
        {/* Public routes */}
        <Route path="/">
          {() => user ? (
            <Home language={language} onLanguageChange={handleLanguageChange} />
          ) : (
            <Landing language={language} onLanguageChange={handleLanguageChange} />
          )}
        </Route>
        <Route path="/signin">
          {() => <SignIn language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/sign-in">
          {() => <SignIn language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/login">
          {() => <SignIn language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/signin-advanced">
          {() => <SignIn language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/signup">
          {() => <SignUp language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/sign-up">
          {() => <SignUp language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/register">
          {() => <SignUp language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        
        {/* Internal onboarding - STRICTLY for invited staff/contractors/franchisees ONLY */}
        {/* NOT accessible via public sign-up - requires valid invitation token */}
        <Route path="/internal/onboard">
          {() => {
            const InternalOnboard = lazy(() => import("./pages/internal/InternalOnboard"));
            return (
              <Suspense fallback={<PageLoader />}>
                <InternalOnboard />
              </Suspense>
            );
          }}
        </Route>
        <Route path="/enterprise-features">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <EnterpriseFeaturesShowcase />
            </Suspense>
          )}
        </Route>
        <Route path="/weather-planner">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <RoleAwareWeatherPlanner />
            </Suspense>
          )}
        </Route>
        <Route path="/welcome-consent">{() => <WelcomeConsent language={language} onLanguageChange={handleLanguageChange} />}</Route>
        
        {/* Firebase Auth Action Handler (password reset, email verification) */}
        <Route path="/auth/action">{() => <AuthAction />}</Route>
        <Route path="/__/auth/action">{() => <AuthAction />}</Route>
        
        {/* Protected route - Dashboard */}
        <Route path="/dashboard">
          {() => (
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          )}
        </Route>
        
        {/* PetWash Privilege - Public registration */}
        <Route path="/privilege">
          {() => <PrivilegeSignup language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/loyalty/join">
          {() => <PrivilegeSignup language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        {/* Backward compatibility - old /vito URL redirects */}
        <Route path="/vito">
          {() => <PrivilegeSignup language={language} onLanguageChange={handleLanguageChange} />}
        </Route>

        {/* Loyalty Program - Public landing + member dashboard */}
        <Route path="/loyalty">
          {() => <Loyalty />}
        </Route>
        
        {/* Protected route - Premium Loyalty Dashboard */}
        <Route path="/loyalty/dashboard">
          {() => (
            <RequireAuth>
              <LoyaltyDashboard />
            </RequireAuth>
          )}
        </Route>
        
        {/* Loyalty Program - Additional Pages */}
        <Route path="/loyalty/tiers">
          {() => <LoyaltyTiers />}
        </Route>
        <Route path="/loyalty/benefits">
          {() => <LoyaltyBenefits />}
        </Route>
        <Route path="/loyalty/birthday">
          {() => <LoyaltyBirthday />}
        </Route>
        <Route path="/loyalty/refer">
          {() => <LoyaltyRefer />}
        </Route>
        
        {/* Referral Program - חבר מביא חבר */}
        <Route path="/referral">
          {() => (
            <RequireAuth>
              <ReferralPage />
            </RequireAuth>
          )}
        </Route>
        <Route path="/refer">
          {() => (
            <RequireAuth>
              <ReferralPage />
            </RequireAuth>
          )}
        </Route>
        
        {/* eGift Cards & Vouchers 2025 */}
        <Route path="/egift">
          {() => <EGift />}
        </Route>
        <Route path="/e-gift">
          {() => <EGift />}
        </Route>
        <Route path="/gift-cards">
          {() => <EGift />}
        </Route>
        <Route path="/e-gifts">
          {() => <EGift />}
        </Route>
        
        <Route path="/vouchers">
          {() => <Vouchers />}
        </Route>
        
        {/* ⁦Pet Wash™⁩ 2025 Global Architecture - Octopus Model Routes */}
        <Route path="/hub">
          {() => <Hub />}
        </Route>
        <Route path="/stations">
          {() => <Stations />}
        </Route>
        <Route path="/shop">
          {() => <Shop />}
        </Route>
        <Route path="/booking">
          {() => <BookingUnified />}
        </Route>
        <Route path="/map">
          {() => <StationMap />}
        </Route>
        
        {/* Company Pages */}
        <Route path="/story">
          {() => <Story />}
        </Route>
        <Route path="/media">
          {() => <Media />}
        </Route>
        <Route path="/careers">
          {() => <Careers />}
        </Route>
        <Route path="/careers/my-applications">
          {() => <MyApplications />}
        </Route>
        <Route path="/admin/hr">
          {() => <HRAdminDashboard />}
        </Route>
        <Route path="/admin/jobs">
          {() => <JobManagement />}
        </Route>
        
        {/* Support & Status */}
        <Route path="/support">
          {() => <Support />}
        </Route>
        <Route path="/status">
          {() => <SystemStatus />}
        </Route>
        
        {/* Partner Routes */}
        <Route path="/partners/franchise">
          {() => <FranchisePartners />}
        </Route>
        <Route path="/partners/locations">
          {() => <LocationPartners />}
        </Route>
        <Route path="/partners/suppliers">
          {() => <SuppliersPartners />}
        </Route>
        <Route path="/partners/municipal">
          {() => <MunicipalPartners />}
        </Route>
        
        {/* Legal Routes */}
        <Route path="/legal/terms">
          {() => <LegalTerms />}
        </Route>
        <Route path="/legal/privacy">
          {() => <LegalPrivacyPolicy />}
        </Route>
        <Route path="/legal/egift-policy">
          {() => <EGiftPolicy />}
        </Route>
        <Route path="/legal/loyalty-terms">
          {() => <LoyaltyTermsPage />}
        </Route>
        <Route path="/legal/cookies">
          {() => <CookiesPolicy />}
        </Route>
        <Route path="/legal/accessibility">
          {() => <AccessibilityStatementPage />}
        </Route>
        <Route path="/legal/marketplace-terms">
          {() => <MarketplaceTerms />}
        </Route>
        
        {/* Protected route - ID Verification */}
        <Route path="/verify">
          {() => (
            <RequireAuth>
              <Verify />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Inbox */}
        <Route path="/inbox">
          {() => (
            <RequireAuth>
              <Inbox />
            </RequireAuth>
          )}
        </Route>

        {/* Protected route - Personal Inbox (Secure Messaging) */}
        <Route path="/personal-inbox">
          {() => (
            <RequireAuth>
              <PersonalInbox />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Pet Profiles */}
        <Route path="/pets">
          {() => (
            <RequireAuth>
              <Pets />
            </RequireAuth>
          )}
        </Route>
        
        {/* UNIFIED MARKETPLACE - Search & Book All Services */}
        <Route path="/marketplace">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <Marketplace />
            </Suspense>
          )}
        </Route>
        
        {/* MADPAWS-STYLE BOOKING SEARCH - Pet filters, location, dates */}
        <Route path="/search">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <BookingSearchPage />
            </Suspense>
          )}
        </Route>
        
        {/* MARKETPLACE SEARCH - Alias for booking search */}
        <Route path="/marketplace/search">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <BookingSearchPage />
            </Suspense>
          )}
        </Route>
        
        {/* TALENT MARKETPLACE - 7-Platform ⁦Pet Wash™⁩ Directory */}
        <Route path="/talent">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <TalentMarketplace />
            </Suspense>
          )}
        </Route>
        
        {/* PLATFORM HUB - Unified Service Discovery */}
        <Route path="/services">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PlatformHub />
            </Suspense>
          )}
        </Route>
        
        {/* PETWASH HQ - Octopus Control Panel (Admin Dashboard) */}
        <Route path="/hq">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <OctopusControlPanel />
            </Suspense>
          )}
        </Route>
        
        {/* UNIFIED MARKETPLACE - Provider Detail Pages (All Platforms) */}
        <Route path="/marketplace/:platform/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderDetail />
            </Suspense>
          )}
        </Route>
        
        {/* UNIFIED MARKETPLACE - Booking Flow (All Platforms) */}
        <Route path="/marketplace/book/:platform/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <MarketplaceBookingFlow />
            </Suspense>
          )}
        </Route>
        
        {/* DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use) */}
        {/* <Route path="/plush-lab">
          <Suspense fallback={<PageLoader />}>
            <PlushLab />
          </Suspense>
        </Route> */}
        
        {/* Premium Meeting Scheduler - 7-Star Experience */}
        <Route path="/meetings">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <Meetings language={language} onLanguageChange={handleLanguageChange} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>

        {/* ⁦The Sitter Suite™⁩ - Specific routes BEFORE general routes */}
        {/* ⁦The Sitter Suite™⁩ - Sitter Detail/Profile Page */}
        <Route path="/sitter-suite/sitters/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterDetail />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Provider Profile (alias for sitters) */}
        <Route path="/sitter-suite/provider/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterDetail />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Pet Wash Academy™⁩ - Professional Trainer Marketplace (Public browsing, auth required for booking) */}
        <Route path="/academy">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <Academy />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Pet Wash Academy™⁩ - Trainer Profile (Legacy) */}
        <Route path="/academy/trainer/:trainerId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <TrainerProfile />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Pet Wash Academy™⁩ - Trainer Detail (Luxury Shared Component) */}
        <Route path="/academy/trainers/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <TrainerDetail />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Pet Wash Academy™⁩ - Booking Flow (6-step unified payment integration) */}
        <Route path="/academy/book/:trainerId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <AcademyBookingFlow />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Specific routes BEFORE general routes to avoid catch-all */}
        {/* ⁦Walk My Pet™⁩ - Walker Booking Page */}
        <Route path="/walk-my-pet/book/:walkerId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkerBooking />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Walker Dashboard (Uber-style for dog walkers) */}
        <Route path="/walk-my-pet/walker/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Owner Dashboard (Track walks, view history, manage bookings) */}
        <Route path="/walk-my-pet/owner/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkOwnerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Booking Flow */}
        <Route path="/walk-my-pet/book/:walkerId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Live GPS Walk Tracking */}
        <Route path="/walk-tracking/:walkId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkTracking />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Platform Overview (Marketing/Gateway) */}
        <Route path="/walk-my-pet">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkMyPetOverview />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Browse/Explore Walkers */}
        <Route path="/walk-my-pet/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkMyPet />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Browse Alias (MadPaws-style) */}
        <Route path="/walk-my-pet/browse">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkMyPet />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Browse Walkers List (alias for browse) */}
        <Route path="/walk-my-pet/walkers">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkMyPet />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Walker Detail Profile */}
        <Route path="/walk-my-pet/walkers/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkerDetail />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦Walk My Pet™⁩ - Unified Hub (placeholder - routes to owner dashboard for now) */}
        <Route path="/walk-my-pet/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkOwnerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Track My Pet LIVE - Real-time Pet Location Tracking */}
        <Route path="/track-my-pet">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <TrackMyPetLive language={language} onLanguageChange={handleLanguageChange} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Premium Pet Transport Booking */}
        <Route path="/pettrek/book">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrekBooking />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Real-Time Trip Tracking */}
        <Route path="/pettrek/track/:tripId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrekTracking />
            </Suspense>
          )}
        </Route>
        
        {/* Unified Provider Dashboard (Uber/MadPaws style) */}
        <Route path="/provider/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <UnifiedProviderDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>

        {/* ⁦PetTrek™⁩ - Provider/Driver Dashboard */}
        <Route path="/pettrek/provider/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <PetTrekProviderDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Driver Dashboard (Uber-style for pet transport drivers) */}
        <Route path="/pettrek/driver/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <DriverDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Customer Dashboard (Book trips, track rides, receipts) */}
        <Route path="/pettrek/customer/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <CustomerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Booking Flow (5-step process: route, schedule, pets, payment, confirm) */}
        <Route path="/pettrek/book">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <PetTrekBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Platform Overview (Marketing/Gateway) */}
        <Route path="/pettrek">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrekOverview />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Browse/Explore Drivers */}
        <Route path="/pettrek/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrek />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Driver Detail Profile */}
        <Route path="/pettrek/drivers/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <DriverDetail />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦PetTrek™⁩ - Unified Hub (placeholder - routes to customer dashboard for now) */}
        <Route path="/pettrek/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <PetTrekCustomerDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Comprehensive Booking Flow (6-step process with Israeli VAT) */}
        <Route path="/sitter-suite/book/:sitterId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Legal Documents (Public Access) */}
        <Route path="/sitter-suite/privacy-policy">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterPrivacyPolicy />
            </Suspense>
          )}
        </Route>
        
        <Route path="/sitter-suite/terms-conditions">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterTermsConditions />
            </Suspense>
          )}
        </Route>
        
        <Route path="/sitter-suite/disclaimer">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterDisclaimer />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Luxury Owner Dashboard (7-Star Hotel Aesthetic) */}
        <Route path="/sitter-suite/owner/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <OwnerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Luxury Sitter Dashboard (7-Star Hotel Aesthetic) */}
        <Route path="/sitter-suite/sitter/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Sitter Edit Profile (MadPaws-style with Photo Upload) */}
        <Route path="/sitter-suite/sitter/edit-profile">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterEditProfile />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Platform Overview (Marketing/Gateway) */}
        <Route path="/sitter-suite">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuiteOverview />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Browse/Explore Sitters */}
        <Route path="/sitter-suite/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuite />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Browse Alias (MadPaws-style) */}
        <Route path="/sitter-suite/browse">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuite />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Unified Hub (placeholder - routes to owner dashboard for now) */}
        <Route path="/sitter-suite/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterOwnerDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Contractor Dashboard - Trust Scores, Earnings, Reviews, Badges (2026 Lifecycle) */}
        <Route path="/contractor/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <ContractorDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Grooming Marketplace - Specific routes BEFORE general routes */}
        {/* Grooming Marketplace - Book Grooming Session */}
        <Route path="/groomers/book">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <GroomersBook language={language} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Grooming Marketplace - Customer Dashboard */}
        <Route path="/groomers/customer/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <GroomersCustomerDashboard language={language} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Grooming Marketplace - Provider Dashboard */}
        <Route path="/groomers/provider/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <GroomersProviderDashboard language={language} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Grooming Marketplace - Platform Overview (Marketing/Gateway) */}
        <Route path="/groomers">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GroomersOverview />
            </Suspense>
          )}
        </Route>
        
        {/* Grooming Marketplace - Browse/Explore Groomers */}
        <Route path="/groomers/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <Groomers language={language} />
            </Suspense>
          )}
        </Route>
        
        {/* Grooming Marketplace - Groomer Detail Profile */}
        <Route path="/groomers/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GroomerDetail />
            </Suspense>
          )}
        </Route>
        
        {/* Grooming Marketplace - Unified Hub (placeholder - routes to customer dashboard for now) */}
        <Route path="/groomers/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <GroomersCustomerDashboard language={language} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* K9000 Wash Stations - Specific routes BEFORE general routes */}
        {/* K9000 Wash Stations - Booking Flow (3-step wizard: station, datetime, review) */}
        <Route path="/k9000/booking/:stationId?">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <K9000BookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* K9000 Wash Stations - Platform Overview (Marketing/Gateway) */}
        <Route path="/k9000">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <K9000Overview />
            </Suspense>
          )}
        </Route>
        
        {/* K9000 Wash Stations - Browse/Explore Stations (future - for now redirect to booking) */}
        <Route path="/k9000/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <K9000Overview />
            </Suspense>
          )}
        </Route>
        
        {/* K9000 Wash Stations - Unified Hub (placeholder - routes to booking for now) */}
        <Route path="/k9000/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <K9000BookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Shared Pet Services - Community Programs */}
        <Route path="/shared-services/programs">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SharedServicesPrograms language={language} />
            </Suspense>
          )}
        </Route>
        
        {/* Shared Pet Services - Impact Dashboard */}
        <Route path="/shared-services/impact">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SharedServicesImpact language={language} />
            </Suspense>
          )}
        </Route>
        
        {/* Global Community Hub - Social Good Programs & Impact */}
        <Route path="/community-hub">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GlobalCommunityHub />
            </Suspense>
          )}
        </Route>
        
        {/* Protected route - Pet Care Planner with Weather */}
        <Route path="/pet-care-planner">
          {() => (
            <RequireAuth>
              <PetCarePlanner language={language} />
            </RequireAuth>
          )}
        </Route>
        
        {/* The PetWash Circle - Social Network with AI Moderation */}
        <Route path="/petwash-circle">
          {() => (
            <RequireAuth>
              <PetWashCircle />
            </RequireAuth>
          )}
        </Route>
        <Route path="/pet-wash-circle">
          {() => (
            <RequireAuth>
              <PetWashCircle />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Subscription Boxes */}
        <Route path="/subscriptions">
          {() => (
            <RequireAuth>
              <Subscriptions />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - My Subscriptions */}
        <Route path="/my-subscriptions">
          {() => (
            <RequireAuth>
              <MySubscriptions />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Settings */}
        {/* Pet Wash Day Planner - Luxury Weather Intelligence */}
        <Route path="/pet-wash-day-planner">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetWashDayPlanner />
            </Suspense>
          )}
        </Route>

        <Route path="/settings">
          {() => (
            <RequireAuth>
              <Settings />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Security Settings */}
        <Route path="/settings/security">
          {() => (
            <RequireAuth>
              <SecuritySettings />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - PetWash Shield™ Security Status Dashboard */}
        <Route path="/security/status">
          {() => (
            <RequireAuth>
              <SecurityStatus />
            </RequireAuth>
          )}
        </Route>
        
        {/* Premium Features - Kenzo AI Mascot (3D Avatar) */}
        <Route path="/kenzo-ai">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <KenzoAI />
            </Suspense>
          )}
        </Route>
        
        {/* Premium Features - Live Chat Support */}
        <Route path="/live-chat">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <LiveChat />
            </Suspense>
          )}
        </Route>
        
        {/* Protected route - Notification Preferences */}
        <Route path="/settings/notifications">
          {() => (
            <RequireAuth>
              <NotificationPreferences />
            </RequireAuth>
          )}
        </Route>
        <Route path="/push-test">
          {() => (
            <RequireAuth>
              <PushNotificationTest />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - My Devices (Passkey Management) */}
        <Route path="/my-devices">
          {() => (
            <RequireAuth>
              <MyDevices language={language} onLanguageChange={handleLanguageChange} />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Device Management (Enhanced Passkey Management) */}
        <Route path="/devices">
          {() => (
            <RequireAuth>
              <DeviceManagement />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Connected Devices (Security Monitoring) */}
        <Route path="/connected-devices">
          {() => (
            <RequireAuth>
              <ConnectedDevices />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Blockchain Audit Trail [LEGACY: redirects to Executive Suite] */}
        <Route path="/audit-trail">{() => <Redirect to="/pet-wash-ltd/executive/audit" />}</Route>
        
        {/* Admin route - Fraud Monitoring Dashboard */}
        <Route path="/admin/fraud-dashboard">
          {() => (
            <AdminRouteGuard>
              <FraudDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        
        {/* Admin route - Provider Applications Review Dashboard */}
        <Route path="/admin/provider-review">
          {() => (
            <AdminRouteGuard>
              <ProviderReview />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/compliance-control-tower">{() => <Redirect to="/pet-wash-ltd/executive/compliance" />}</Route>
        
        {/* Gemini AI Watchdog Dashboard */}
        <Route path="/admin/gemini-watchdog">
          {() => (
            <AdminRouteGuard>
              <GeminiWatchdogDashboard />
            </AdminRouteGuard>
          )}
        </Route>

        <Route path="/admin/performance-monitoring">
          {() => (
            <AdminRouteGuard>
              <PerformanceMonitoring />
            </AdminRouteGuard>
          )}
        </Route>
        
        {/* Franchise routes - Protected */}
        <Route path="/franchise/dashboard">
          {() => (
            <RequireAuth>
              <FranchiseDashboard />
            </RequireAuth>
          )}
        </Route>
        <Route path="/franchise/inbox">
          {() => (
            <RequireAuth>
              <FranchiseInbox />
            </RequireAuth>
          )}
        </Route>
        <Route path="/franchise/reports">
          {() => (
            <RequireAuth>
              <FranchiseReports />
            </RequireAuth>
          )}
        </Route>
        <Route path="/franchise/support">
          {() => (
            <RequireAuth>
              <FranchiseSupport />
            </RequireAuth>
          )}
        </Route>
        <Route path="/franchise/marketing">
          {() => (
            <RequireAuth>
              <FranchiseMarketing />
            </RequireAuth>
          )}
        </Route>
        
        <Route path="/employee/expenses">
          {() => (
            <RequireAuth>
              <EmployeeExpenses />
            </RequireAuth>
          )}
        </Route>
        
        <Route path="/new-expense">
          {() => (
            <RequireAuth>
              <NewExpense />
            </RequireAuth>
          )}
        </Route>
        
        <Route path="/my-expenses">
          {() => (
            <RequireAuth>
              <MyExpenses />
            </RequireAuth>
          )}
        </Route>
        
        <Route path="/approve-expenses">
          {() => (
            <RequireAuth>
              <ApproveExpenses />
            </RequireAuth>
          )}
        </Route>
        
        {/* Staff Onboarding & Fraud Prevention */}
        <Route path="/careers/apply">
          {() => <StaffApplication />}
        </Route>
        
        <Route path="/admin/staff-onboarding">
          {() => (
            <RequireAuth>
              <StaffOnboarding />
            </RequireAuth>
          )}
        </Route>
        
        {/* Common routes available to all users */}
        <Route path="/about">{() => <About language={language} />}</Route>
        <Route path="/divisions">
          <Suspense fallback={<PageLoader />}>
            <StandaloneDivisions />
          </Suspense>
        </Route>
        <Route path="/platform">{() => <PlatformShowcase />}</Route>
        <Route path="/showcase">{() => <PlatformShowcase />}</Route>
        <Route path="/service-status">{() => <ServiceStatus language={language} />}</Route>
        <Route path="/status">{() => <ServiceStatus language={language} />}</Route>
        <Route path="/paw-finder">{() => <PawFinder language={language} />}</Route>
        <Route path="/find-pet">{() => <PawFinder language={language} />}</Route>
        <Route path="/lost-pet">{() => <PawFinder language={language} />}</Route>
        <Route path="/franchise">{() => <Franchise language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/franchise-opportunities">{() => <Redirect to="/franchise" />}</Route>
        <Route path="/backend-team">{() => <BackendTeam />}</Route>
        <Route path="/locations">{() => <Locations />}</Route>
        <Route path="/wallet">{() => <WalletDownload />}</Route>
        <Route path="/my-wallet">{() => <MyWallet />}</Route>
        <Route path="/my-account">{() => <MyAccount />}</Route>
        <Route path="/packages">{() => <Packages />}</Route>
        
        {/* Hebrew routes - חבילות */}
        <Route path="/he/חבילות">{() => <Packages />}</Route>
        <Route path="/he/packages">{() => <Packages />}</Route>
        <Route path="/company-reports">{() => <CompanyReports />}</Route>
        <Route path="/reports">{() => <CompanyReports />}</Route>
        <Route path="/investor-presentation">{() => <InvestorPresentation />}</Route>
        <Route path="/pitch">{() => <InvestorPresentation />}</Route>
        <Route path="/investors">{() => <InvestorPresentation />}</Route>
        <Route path="/our-service">{() => <OurService language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/contact">{() => <Contact language={language} />}</Route>
        <Route path="/gallery">{() => <Gallery language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/privacy" component={Privacy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={Terms} />
        <Route path="/platform-legal">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PlatformLegalFramework />
            </Suspense>
          )}
        </Route>
        <Route path="/become-provider">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderApplicationForm />
            </Suspense>
          )}
        </Route>
        <Route path="/provider-onboarding">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderOnboarding />
            </Suspense>
          )}
        </Route>
        <Route path="/apply-provider">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderApplicationForm />
            </Suspense>
          )}
        </Route>
        <Route path="/join-team">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderApplicationForm />
            </Suspense>
          )}
        </Route>
        <Route path="/providers">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderListings />
            </Suspense>
          )}
        </Route>
        <Route path="/providers/:serviceType">
          {(params) => (
            <Suspense fallback={<PageLoader />}>
              <ProviderListings />
            </Suspense>
          )}
        </Route>
        <Route path="/provider-compliance">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderCompliance />
            </Suspense>
          )}
        </Route>
        <Route path="/provider/bookings">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderBookingsDashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/accounting">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <AccountingDashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/control-panel">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['enterprise']}>
              <Suspense fallback={<PageLoader />}>
                <UnifiedControlPanel />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        <Route path="/management">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <MobileManagementDashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/dashboard">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <MobileManagementDashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/octopus-brain">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <MobileManagementDashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/accessibility" component={Accessibility} />
        <Route path="/accessibility-statement" component={AccessibilityStatement} />
        
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* PET WASH LTD EXECUTIVE SUITE - Centralized C-Suite Management          */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        
        {/* Executive Suite - Landing Page (role-based dashboard links) */}
        <Route path="/pet-wash-ltd/executive">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <ExecutiveSuiteHome />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - CEO Dashboard (strategic metrics, 2FA vouchers) */}
        <Route path="/pet-wash-ltd/executive/ceo">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['ceo']}>
              <Suspense fallback={<PageLoader />}>
                <CEODashboard />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - Finance Dashboard (Israeli tax, accounts, revenue) */}
        <Route path="/pet-wash-ltd/executive/finance">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['finance']}>
              <Suspense fallback={<PageLoader />}>
                <FinanceDashboard />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - KYC & Verification (passport, provider onboarding) */}
        <Route path="/pet-wash-ltd/executive/kyc">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['kyc']}>
              <Suspense fallback={<PageLoader />}>
                <AdminKYC />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - Compliance Control Tower (AI legal compliance) */}
        <Route path="/pet-wash-ltd/executive/compliance">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['compliance']}>
              <Suspense fallback={<PageLoader />}>
                <ComplianceControlTower />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - Audit Trail (blockchain-style immutable logs) */}
        <Route path="/pet-wash-ltd/executive/audit">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['audit']}>
              <Suspense fallback={<PageLoader />}>
                <AuditTrail />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Executive Suite - Enterprise HQ (multi-franchise operations) */}
        <Route path="/pet-wash-ltd/executive/enterprise">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['enterprise']}>
              <Suspense fallback={<PageLoader />}>
                <EnterpriseHQ language={language} onLanguageChange={handleLanguageChange} />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Admin routes - /admin redirects to /admin/login */}
        <Route path="/admin">{() => <Redirect to="/admin/login-v2" />}</Route>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/backend">
          {() => (
            <AdminRouteGuard>
              <AdminBackendPanel />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/google-forms">
          {() => (
            <AdminRouteGuard>
              <AdminGoogleForms />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/login-v2" component={AdminLoginV2} />
        <Route path="/admin/access-denied" component={AdminAccessDenied} />
        <Route path="/admin/dashboard">
          {() => (
            <AdminRouteGuard>
              <AdminDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/status-monitor">
          {() => (
            <AdminRouteGuard>
              <GroupStatusMonitor />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/ceo/dashboard">{() => <Redirect to="/pet-wash-ltd/executive/ceo" />}</Route>
        <Route path="/admin/kyc">
          {() => (
            <AdminRouteGuard>
              <AdminKYC />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/financial">{() => <Redirect to="/pet-wash-ltd/executive/finance" />}</Route>
        <Route path="/admin/system-logs">
          {() => (
            <AdminRouteGuard>
              <AdminSystemLogs />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/security-monitoring">
          {() => (
            <AdminRouteGuard>
              <AdminSecurityMonitoring />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/vouchers">
          {() => (
            <AdminRouteGuard>
              <AdminVouchers />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/inbox">
          {() => (
            <AdminRouteGuard>
              <AdminInbox />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/stations">
          {() => (
            <AdminRouteGuard>
              <AdminStations />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/users">
          {() => (
            <AdminRouteGuard>
              <AdminUsers />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/team">
          {() => (
            <AdminRouteGuard>
              <AdminTeamInvitations language={language} onLanguageChange={handleLanguageChange} />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/team/inbox">
          {() => (
            <AdminRouteGuard>
              <TeamInbox />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/guide">
          {() => (
            <AdminRouteGuard>
              <AdminGuide language={language} onLanguageChange={handleLanguageChange} />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/help">
          {() => (
            <AdminRouteGuard>
              <AdminHelpGuide language={language} onLanguageChange={handleLanguageChange} />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/jv-partners">
          {() => (
            <AdminRouteGuard>
              <JvPartnersDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/suppliers">
          {() => (
            <AdminRouteGuard>
              <SuppliersDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/station-registry">
          {() => (
            <AdminRouteGuard>
              <StationRegistryDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/hr">
          {() => (
            <AdminRouteGuard>
              <HRDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/performance-reviews">
          {() => (
            <AdminRouteGuard>
              <PerformanceReviewsDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/recruitment">
          {() => (
            <AdminRouteGuard>
              <RecruitmentDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/sales">
          {() => (
            <AdminRouteGuard>
              <SalesDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/m">
          {() => (
            <AdminRouteGuard>
              <MobileStationHub />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/mobile/ops">
          {() => (
            <AdminRouteGuard>
              <MobileOpsHub />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/mobile-ops">
          {() => (
            <AdminRouteGuard>
              <MobileOpsHub />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/mobile/stations">
          {() => (
            <AdminRouteGuard>
              <MobileStationHub />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/ops">
          {() => (
            <AdminRouteGuard>
              <MobileStationHub />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/s/:id">
          {() => (
            <AdminRouteGuard>
              <MobileStationSheet />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/ops/today">
          {() => (
            <AdminRouteGuard>
              <OpsTodayPage />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/crm">
          {() => (
            <AdminRouteGuard>
              <CrmDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/operations">
          {() => (
            <AdminRouteGuard>
              <OperationsDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/logistics">
          {() => (
            <AdminRouteGuard>
              <LogisticsDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/finance">
          {() => (
            <AdminRouteGuard>
              <FinanceDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/entity-management">
          {() => (
            <AdminRouteGuard>
              <UnifiedEntityManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/policy">
          {() => (
            <AdminRouteGuard>
              <PolicyManagementDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/franchise">
          {() => (
            <AdminRouteGuard>
              <FranchiseManagementDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/customers">
          {() => (
            <AdminRouteGuard>
              <CustomerManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/crm/leads">
          {() => (
            <AdminRouteGuard>
              <LeadManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/crm/communications">
          {() => (
            <AdminRouteGuard>
              <CommunicationCenter />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/enterprise/hq">{() => <Redirect to="/pet-wash-ltd/executive/enterprise" />}</Route>
        <Route path="/documents">
          {() => (
            <AdminRouteGuard>
              <DocumentManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/k9000-documents">
          {() => (
            <AdminRouteGuard>
              <K9000Documents />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/inventory">
          {() => (
            <AdminRouteGuard>
              <InventoryManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/spare-parts">
          {() => (
            <AdminRouteGuard>
              <SparePartsManagement />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/enterprise/franchisee/:id">
          {(params) => (
            <AdminRouteGuard>
              <FranchiseeDashboard franchiseeId={Number(params.id)} />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/enterprise/technician/:id">
          {(params) => (
            <AdminRouteGuard>
              <TechnicianView technicianId={params.id} />
            </AdminRouteGuard>
          )}
        </Route>
        
        {/* Public status monitoring page */}
        <Route path="/status/uptime" component={StatusDashboard} />
        
        <Route path="/receipt/:transactionId" component={ReceiptPage} />
        <Route path="/founder-member" component={FounderMember} />
        <Route path="/buy-gift-card">
          {() => <BuyGiftCard language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/claim">
          {() => <ClaimVoucher />}
        </Route>
        <Route path="/ops-dashboard">{() => <OpsDashboard language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  // Default to Hebrew ('he') for Israeli market - PRIMARY language
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('petwash_lang') as Language;
    return saved && ['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(saved) ? saved : 'he';
  });
  const [isLanguageInitialized, setIsLanguageInitialized] = useState(false);
  const [isConsentManagerOpen, setIsConsentManagerOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  
  useKeyboardNavigation();

  useEffect(() => {
    // CRITICAL: Apply saved consent preferences to gtag on app load
    // This ensures returning users have consent enforced before analytics run
    const savedPreferences = getConsentPreferences();
    if (savedPreferences) {
      applyConsentPreferences(savedPreferences);
    }
  }, []);

  useEffect(() => {
    // Initialize viewport height fix for mobile devices
    const cleanupViewport = initViewportFix();
    
    const duplicateSelectors = [
      '.whatsapp_float',
      '.whatsapp-chat-widget',
      'iframe[src*="wa.me"]',
      'iframe[src*="web.whatsapp"]',
      '.floating-button-whatsapp',
      '.floating-button-accessibility',
      '#fab-stack',
      '#petwash-ai',
      '.petwash-ai-bubble',
      '[data-ai-widget="petwash"]'
    ];
    
    duplicateSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    const floatingStacks = document.querySelectorAll('.pw-float-stack');
    floatingStacks.forEach((el, i) => {
      if (i > 0) el.remove();
    });
    
    return cleanupViewport;
  }, []);

  useEffect(() => {
    // Use consistent key 'petwash_lang' - default to Hebrew for Israeli market
    const savedLanguage = localStorage.getItem('petwash_lang') as Language;
    if (savedLanguage && ['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(savedLanguage)) {
      setCurrentLanguage(savedLanguage);
      setIsLanguageInitialized(true);
    } else {
      // Default to Hebrew for Israeli market
      setCurrentLanguage('he');
      localStorage.setItem('petwash_lang', 'he');
      setIsLanguageInitialized(true);
    }

    async function detectLanguageInBackground() {
      try {
        const defaultLanguage = await getDefaultLanguageByLocation();
        const currentSaved = localStorage.getItem('petwash_lang') as Language;
        
        // Only update if no saved preference exists
        if (!currentSaved) {
          setCurrentLanguage(defaultLanguage);
          localStorage.setItem('petwash_lang', defaultLanguage);
          
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'automatic_language_detection', {
              'detected_language': defaultLanguage,
              'is_israeli_ip': defaultLanguage === 'he',
              'event_category': 'localization'
            });
          }
        }
      } catch (error) {
        // On error, keep Hebrew default for Israeli market
        if (import.meta.env.DEV) {

// BUILD_FORCE_REBUILD: 1769350182889
console.log("Build: 1769350182889");
          console.error('Background language detection error:', error);
        }
      }
    }

    detectLanguageInBackground();
  }, []);

  useEffect(() => {
    // Initialize comprehensive interaction tracking system
    initializeInteractionTracking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id="protanopia-filter">
                <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0
                                                     0.558, 0.442, 0, 0, 0
                                                     0, 0.242, 0.758, 0, 0
                                                     0, 0, 0, 1, 0"/>
              </filter>
              
              <filter id="deuteranopia-filter">
                <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0
                                                     0.7, 0.3, 0, 0, 0
                                                     0, 0.3, 0.7, 0, 0
                                                     0, 0, 0, 1, 0"/>
              </filter>
              
              <filter id="tritanopia-filter">
                <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0
                                                     0, 0.433, 0.567, 0, 0
                                                     0, 0.475, 0.525, 0, 0
                                                     0, 0, 0, 1, 0"/>
              </filter>
            </defs>
          </svg>
          
          <Toaster />
          <FloatingStack 
            language={currentLanguage}
            onAIClick={() => setIsAIChatOpen(true)}
          />
          
          {/* Google Dialogflow CX AI Chat Widget - Gemini-powered Kenzo 🤖 */}
          <AiChatWidget 
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
          />
          
          <AuthProvider>
            <SimpleAuthProvider>
              <Router language={currentLanguage} onLanguageChange={(newLang) => {
                setCurrentLanguage(newLang);
                localStorage.setItem('language', newLang);
              }} />
              <NotificationPermissionPrompt />
            </SimpleAuthProvider>
          </AuthProvider>
          
          {/* GDPR-compliant cookie consent system */}
          <CookieConsent 
            language={currentLanguage}
            onOpenManager={() => setIsConsentManagerOpen(true)}
          />
          <ConsentManager 
            language={currentLanguage}
            isOpen={isConsentManagerOpen}
            onClose={() => setIsConsentManagerOpen(false)}
          />
          
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
