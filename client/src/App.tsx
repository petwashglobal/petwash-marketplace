import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingStack } from "@/components/FloatingStack";
import { AIChatAssistant } from "@/components/AIChatAssistant";
import { ConsentManager } from "@/components/ConsentManager";
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
const FastSignIn = lazy(() => import("@/pages/FastSignIn"));
const SimpleSignIn = lazy(() => import("@/pages/SimpleSignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const LoyaltyDashboard = lazy(() => import("@/pages/LoyaltyDashboard"));
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
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminLoginV2 = lazy(() => import("@/pages/admin/AdminLoginV2"));
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
const TestPurchase = lazy(() => import("@/pages/TestPurchase"));
const FounderMember = lazy(() => import("@/pages/FounderMember"));
const ClaimVoucher = lazy(() => import("@/pages/ClaimVoucher"));
const BuyGiftCard = lazy(() => import("@/pages/BuyGiftCard"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Pets = lazy(() => import("@/pages/Pets"));
const PetCarePlanner = lazy(() => import("@/pages/PetCarePlanner"));
const PetWashCircle = lazy(() => import("@/pages/PetWashCircle"));
// DISABLED: PlushLab - Pet Avatar Creator (frozen for now, keep for future use)
// const PlushLab = lazy(() => import("@/pages/PlushLab"));
const StandaloneDivisions = lazy(() => import("@/pages/StandaloneDivisions"));
const Settings = lazy(() => import("@/pages/Settings"));
const SecuritySettings = lazy(() => import("@/pages/SecuritySettings"));
const SecurityStatus = lazy(() => import("@/pages/SecurityStatus"));
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
const AdminStations = lazy(() => import("@/pages/AdminStations"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminTeamInvitations = lazy(() => import("@/pages/AdminTeamInvitations"));
const TeamInbox = lazy(() => import("@/pages/TeamInbox"));
const MobileStationHub = lazy(() => import("@/pages/MobileStationHub"));
const MobileStationSheet = lazy(() => import("@/pages/MobileStationSheet"));
const MobileOpsHub = lazy(() => import("@/pages/MobileOpsHub"));
const OpsTodayPage = lazy(() => import("@/pages/OpsTodayPage"));
const FirebaseDebug = lazy(() => import("@/pages/FirebaseDebug"));
const AuthTest = lazy(() => import("@/pages/AuthTest"));
const WeatherTest = lazy(() => import("@/pages/WeatherTest"));
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
const PushNotificationTest = lazy(() => import("@/pages/PushNotificationTest"));
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
const GmailDemo = lazy(() => import("@/pages/GmailDemo"));
const GoogleServicesConsent = lazy(() => import("@/pages/GoogleServicesConsent"));
const PetWashDayPlanner = lazy(() => import("@/pages/PetWashDayPlanner"));
const RoleAwareWeatherPlanner = lazy(() => import("@/pages/RoleAwareWeatherPlanner"));

// The Sitter Suite™ - Pet Sitting Marketplace
const SitterSuite = lazy(() => import("@/pages/sitter-suite/BrowseSitters"));
const SitterDetail = lazy(() => import("@/pages/sitter-suite/SitterDetail"));
const SitterBookingFlow = lazy(() => import("@/pages/sitter-suite/BookingFlow"));
const SitterOwnerDashboard = lazy(() => import("@/pages/sitter-suite/OwnerDashboard"));
const SitterDashboard = lazy(() => import("@/pages/sitter-suite/SitterDashboard"));
const OwnerDashboardPage = SitterOwnerDashboard; // Alias
const SitterDashboardPage = SitterDashboard; // Alias

// Pet Wash Academy™ - Professional Trainer Marketplace
const Academy = lazy(() => import("@/pages/Academy"));
const TrainerProfile = lazy(() => import("@/pages/academy/TrainerProfile"));
const AcademyBookingFlow = lazy(() => import("@/pages/academy/BookingFlow"));

// Contractor Dashboard - 2026 Lifecycle Management
const ContractorDashboard = lazy(() => import("@/pages/contractor/Dashboard"));

// Walk My Pet™ - Premium Dog Walking
const WalkMyPet = lazy(() => import("@/pages/walk-my-pet/BrowseWalkers"));
const WalkBookingFlow = lazy(() => import("@/pages/walk-my-pet/BookingFlow"));
const WalkOwnerDashboardPage = lazy(() => import("@/pages/walk-my-pet/OwnerDashboard"));
const WalkerDashboardPage = lazy(() => import("@/pages/walk-my-pet/WalkerDashboard"));

// PetTrek™ - Advanced Pet Transport
const PetTrek = lazy(() => import("@/pages/pettrek/BrowseDrivers"));
const PetTrekBookingFlow = lazy(() => import("@/pages/pettrek/BookingFlow"));
const PetTrekCustomerDashboard = lazy(() => import("@/pages/pettrek/CustomerDashboard"));
const PetTrekDriverDashboard = lazy(() => import("@/pages/pettrek/DriverDashboard"));
const FirebaseTest = lazy(() => import("@/pages/FirebaseTest"));
const ConsentDemo = lazy(() => import("@/pages/ConsentDemo"));
const AuditTrail = lazy(() => import("@/pages/AuditTrail"));
const FraudDashboard = lazy(() => import("@/pages/admin/FraudDashboard"));
const Meetings = lazy(() => import("@/pages/Meetings"));
const PlatformLegalFramework = lazy(() => import("@/pages/PlatformLegalFramework"));
const ProviderOnboarding = lazy(() => import("@/pages/ProviderOnboarding"));
const ProviderListings = lazy(() => import("@/pages/ProviderListings"));
const PlatformShowcase = lazy(() => import("@/pages/PlatformShowcase"));
const PawFinder = lazy(() => import("@/pages/PawFinder"));
const ServiceStatus = lazy(() => import("@/pages/ServiceStatus"));

// Walk My Pet™ Pages
const TrackWalk = lazy(() => import("@/pages/walks/TrackWalk"));

// PetTrek™ Pages
const BookTrip = lazy(() => import("@/pages/pettrek/BookTrip"));
const TrackTrip = lazy(() => import("@/pages/pettrek/TrackTrip"));
const ProviderDashboard = lazy(() => import("@/pages/pettrek/ProviderDashboard"));

// The Sitter Suite™ - Legal Documents (Airbnb-style compliance)
const SitterPrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const SitterTermsConditions = lazy(() => import("@/pages/legal/TermsConditions"));
const SitterDisclaimer = lazy(() => import("@/pages/legal/Disclaimer"));

// Walk My Pet™ - Legacy/Alias Pages
const WalkTracking = lazy(() => import("@/pages/walks/TrackWalk")); // Alias
const TrackMyPetLive = lazy(() => import("@/pages/walks/TrackWalk")); // Alias

// PetTrek™ - Legacy/Alias Pages
const PetTrekBooking = lazy(() => import("@/pages/pettrek/BookTrip")); // Alias
const PetTrekTracking = lazy(() => import("@/pages/pettrek/TrackTrip")); // Alias
const PetTrekProviderDashboard = lazy(() => import("@/pages/pettrek/ProviderDashboard")); // Alias

// E-Signature System
const DocumentSigning = lazy(() => import("@/pages/DocumentSigning"));

// Personal Secure Inbox
const PersonalInbox = lazy(() => import("@/pages/PersonalInbox"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
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
          {() => <FastSignIn language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/login">
          {() => <SimpleSignIn language={language} onLanguageChange={handleLanguageChange} />}
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
        <Route path="/auth-test">{() => <AuthTest />}</Route>
        <Route path="/weather-test">{() => <WeatherTest />}</Route>
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
        
        {/* Protected route - Loyalty Program */}
        <Route path="/loyalty">
          {() => (
            <RequireAuth>
              <Loyalty />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Premium Loyalty Dashboard */}
        <Route path="/loyalty/dashboard">
          {() => (
            <RequireAuth>
              <LoyaltyDashboard />
            </RequireAuth>
          )}
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

        {/* The Sitter Suite™ - Pet Sitting Marketplace (Public browsing, auth required for booking) */}
        <Route path="/sitter-suite">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuite />
            </Suspense>
          )}
        </Route>
        
        {/* The Sitter Suite™ - Sitter Detail/Profile Page */}
        <Route path="/sitter-suite/sitters/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterDetail />
            </Suspense>
          )}
        </Route>
        
        {/* Pet Wash Academy™ - Professional Trainer Marketplace (Public browsing, auth required for booking) */}
        <Route path="/academy">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <Academy />
            </Suspense>
          )}
        </Route>
        
        {/* Pet Wash Academy™ - Trainer Profile */}
        <Route path="/academy/trainer/:trainerId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <TrainerProfile />
            </Suspense>
          )}
        </Route>
        
        {/* Pet Wash Academy™ - Booking Flow (6-step unified payment integration) */}
        <Route path="/academy/book/:trainerId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <AcademyBookingFlow />
            </Suspense>
          )}
        </Route>
        
        {/* Walk My Pet™ - Premium Dog Walking Marketplace */}
        <Route path="/walk-my-pet">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <WalkMyPet />
            </Suspense>
          )}
        </Route>
        
        {/* Walk My Pet™ - Walker Booking Page */}
        <Route path="/walk-my-pet/book/:walkerId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkerBooking />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Walk My Pet™ - Walker Dashboard (Uber-style for dog walkers) */}
        <Route path="/walk-my-pet/walker/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Walk My Pet™ - Owner Dashboard (Track walks, view history, manage bookings) */}
        <Route path="/walk-my-pet/owner/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkOwnerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Walk My Pet™ - Booking Flow */}
        <Route path="/walk-my-pet/book/:walkerId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* Walk My Pet™ - Live GPS Walk Tracking */}
        <Route path="/walk-tracking/:walkId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <WalkTracking />
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
        
        {/* PetTrek™ - Premium Pet Transport Booking */}
        <Route path="/pettrek/book">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrekBooking />
            </Suspense>
          )}
        </Route>
        
        {/* PetTrek™ - Real-Time Trip Tracking */}
        <Route path="/pettrek/track/:tripId">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetTrekTracking />
            </Suspense>
          )}
        </Route>
        
        {/* PetTrek™ - Provider/Driver Dashboard */}
        <Route path="/pettrek/provider/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <PetTrekProviderDashboard />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* PetTrek™ - Driver Dashboard (Uber-style for pet transport drivers) */}
        <Route path="/pettrek/driver/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <DriverDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* PetTrek™ - Customer Dashboard (Book trips, track rides, receipts) */}
        <Route path="/pettrek/customer/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <CustomerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* PetTrek™ - Booking Flow (5-step process: route, schedule, pets, payment, confirm) */}
        <Route path="/pettrek/book">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <PetTrekBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* The Sitter Suite™ - Comprehensive Booking Flow (6-step process with Israeli VAT) */}
        <Route path="/sitter-suite/book/:sitterId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* The Sitter Suite™ - Legal Documents (Public Access) */}
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
        
        {/* The Sitter Suite™ - Luxury Owner Dashboard (7-Star Hotel Aesthetic) */}
        <Route path="/sitter-suite/owner/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <OwnerDashboardPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* The Sitter Suite™ - Luxury Sitter Dashboard (7-Star Hotel Aesthetic) */}
        <Route path="/sitter-suite/sitter/dashboard">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterDashboardPage />
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
        {/* Gmail OAuth Demo Page */}
        <Route path="/gmail-demo">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GmailDemo language={language} onLanguageChange={handleLanguageChange} />
            </Suspense>
          )}
        </Route>

        {/* Consent Demo - Premium OAuth and iOS permissions showcase */}
        <Route path="/consent-demo">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ConsentDemo language={language} />
            </Suspense>
          )}
        </Route>

        {/* Google Services Consent - All 13 Google Cloud APIs with pre-checked boxes */}
        <Route path="/google-services-consent">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GoogleServicesConsent language={language} onLanguageChange={handleLanguageChange} />
            </Suspense>
          )}
        </Route>

        {/* Pet Wash Day Planner - Luxury Weather Intelligence */}
        <Route path="/pet-wash-day-planner">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PetWashDayPlanner />
            </Suspense>
          )}
        </Route>

        {/* Firebase Test Page - Comprehensive feature testing */}
        <Route path="/firebase-test">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <FirebaseTest />
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
        
        {/* Protected route - Blockchain Audit Trail */}
        <Route path="/audit-trail">
          {() => (
            <RequireAuth>
              <AuditTrail />
            </RequireAuth>
          )}
        </Route>
        
        {/* Admin route - Fraud Monitoring Dashboard */}
        <Route path="/admin/fraud-dashboard">
          {() => (
            <AdminRouteGuard>
              <FraudDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/compliance-control-tower">
          {() => (
            <AdminRouteGuard>
              <ComplianceControlTower />
            </AdminRouteGuard>
          )}
        </Route>
        
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
        <Route path="/backend-team">{() => <BackendTeam />}</Route>
        <Route path="/locations">{() => <Locations />}</Route>
        <Route path="/wallet">{() => <WalletDownload />}</Route>
        <Route path="/my-wallet">{() => <MyWallet />}</Route>
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
        <Route path="/provider-onboarding">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderOnboarding />
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
        <Route path="/accessibility" component={Accessibility} />
        <Route path="/accessibility-statement" component={AccessibilityStatement} />
        
        {/* Admin routes - /admin redirects to /admin/login */}
        <Route path="/admin">{() => <Redirect to="/admin/login-v2" />}</Route>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/login-v2" component={AdminLoginV2} />
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
        <Route path="/ceo/dashboard" component={CEODashboard} />
        <Route path="/admin/kyc">
          {() => (
            <AdminRouteGuard>
              <AdminKYC />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/financial">
          {() => (
            <AdminRouteGuard>
              <AdminFinancial language={language} />
            </AdminRouteGuard>
          )}
        </Route>
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
        <Route path="/enterprise/hq">
          {() => (
            <AdminRouteGuard>
              <EnterpriseHQ />
            </AdminRouteGuard>
          )}
        </Route>
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
        <Route path="/test-purchase" component={TestPurchase} />
        <Route path="/founder-member" component={FounderMember} />
        <Route path="/buy-gift-card">
          {() => <BuyGiftCard language={language} onLanguageChange={setLanguage} />}
        </Route>
        <Route path="/claim">
          {() => <ClaimVoucher />}
        </Route>
        {/* 🔒 SECURITY: Debug route only in development */}
        {IS_DEV && (
          <Route path="/firebase-debug">{() => <FirebaseDebug language={language} onLanguageChange={handleLanguageChange} />}</Route>
        )}
        <Route path="/ops-dashboard">{() => <OpsDashboard language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [isLanguageInitialized, setIsLanguageInitialized] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  
  useKeyboardNavigation();

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
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'he')) {
      setCurrentLanguage(savedLanguage);
      setIsLanguageInitialized(true);
    } else {
      setCurrentLanguage('en');
      setIsLanguageInitialized(true);
    }

    async function detectLanguageInBackground() {
      try {
        const defaultLanguage = await getDefaultLanguageByLocation();
        
        if (defaultLanguage !== savedLanguage) {
          setCurrentLanguage(defaultLanguage);
          localStorage.setItem('language', defaultLanguage);
          
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'automatic_language_detection', {
              'detected_language': defaultLanguage,
              'is_israeli_ip': defaultLanguage === 'he',
              'event_category': 'localization'
            });
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
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
          <AIChatAssistant 
            language={currentLanguage}
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
          <ConsentManager language={currentLanguage} />
          <LuxuryPlatformShowcase language={currentLanguage} />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
