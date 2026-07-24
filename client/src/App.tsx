import "./lib/i18next-init"; // Initialize react-i18next before any component imports
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingStack } from "@/components/FloatingStack";
import { AiChatWidget } from "@/components/AiChatWidget";
import { CookieConsent } from "@/components/CookieConsent";
import { ConsentManager } from "@/components/ConsentManager";
import { getConsentPreferences, applyConsentPreferences } from "@/lib/consent";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { AuthProvider, useFirebaseAuth } from "@/auth/AuthProvider";
import { useWhoami } from "@/auth/useWhoami";
import RequireAuth from "@/auth/RequireAuth";
import StationMembershipGuard from "@/components/StationMembershipGuard";
import RoleProtectedRoute from "@/auth/RoleProtectedRoute";
import AppTermsGate from "@/components/AppTermsGate";
import { PlatformComingSoon } from "@/components/PlatformComingSoon";
import { Car } from "lucide-react";
import { initClientSentry } from "@/lib/sentry";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { initViewportFix } from "@/lib/viewportFix";
import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from "react";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { isRTL } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { getDefaultLanguageByLocation } from "@/lib/geolocation";
import { LanguageProvider, useLanguage } from "@/lib/languageStore";
import { initializeInteractionTracking } from "@/lib/interactionTracker";
import { useFCMNotifications } from "@/hooks/useFCMNotifications";
import { usePersonalizedGreeting } from "@/hooks/usePersonalizedGreeting";
import { GoogleOneTap } from "@/components/GoogleOneTap";
import { ActivationBanner } from "@/components/ActivationBanner";
import { PromoAdPopup } from "@/components/PromoAdPopup";
import { useAppFlavor } from "@/lib/appFlavor";
import { Capacitor } from "@capacitor/core";
import { Layout } from "@/components/Layout";
import { isStickyAccountPath } from "@/lib/sticky-account-paths";
import { isImmersiveRoute } from "@/lib/immersive-routes";

// CRITICAL: Only the two entry-point pages stay eager (everything else lazy)
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";

// Initialize Sentry once — after all static imports are resolved
initClientSentry();

// Lazy-load all non-home routes (staff, expenses, admin tools)
const EmployeeExpenses = lazy(() => import("@/pages/EmployeeExpenses"));
const NewExpense = lazy(() => import("@/pages/NewExpense"));
const MyExpenses = lazy(() => import("@/pages/MyExpenses"));
const ApproveExpenses = lazy(() => import("@/pages/ApproveExpenses"));
const AdminSupplierInvoices = lazy(() => import("@/pages/AdminSupplierInvoices"));
const AdminNoLostMoney = lazy(() => import("@/pages/AdminNoLostMoney"));
const AdminReminderPreview = lazy(() => import("@/pages/AdminReminderPreview"));
const AdminSupplierInvoiceDetail = lazy(() => import("@/pages/AdminSupplierInvoiceDetail"));
const AdminSuppliers = lazy(() => import("@/pages/AdminSuppliers"));
const AdminIdentityMerge = lazy(() => import("@/pages/AdminIdentityMerge"));
const AdminSupplierDetail = lazy(() => import("@/pages/AdminSupplierDetail"));
const AdminSumitControl = lazy(() => import("@/pages/AdminSumitControl"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const ProviderMyInvoices = lazy(() => import("@/pages/ProviderMyInvoices"));
const AccountantQueue = lazy(() => import("@/pages/AccountantQueue"));
const StaffApplication = lazy(() => import("@/pages/StaffApplication"));
const StaffOnboarding = lazy(() => import("@/pages/admin/StaffOnboarding"));

// LAZY LOAD: All other routes (code split for performance)
const CompleteProfile = lazy(() => import("@/pages/CompleteProfile"));
const ProviderPending = lazy(() => import("@/pages/ProviderPending"));
const ProviderRejected = lazy(() => import("@/pages/ProviderRejected"));
const StaffPending = lazy(() => import("@/pages/StaffPending"));
const StaffRejected = lazy(() => import("@/pages/StaffRejected"));
const AccessPending = lazy(() => import("@/pages/AccessPending"));
const BlockedPage = lazy(() => import("@/pages/BlockedPage"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const AccountActivation = lazy(() => import("@/pages/AccountActivation"));
// SignIn (the old white "WELCOME BACK" modal) KILLED 2026-06-28 — every login
// route now renders the premium SignUpLuxury screen. Do NOT reintroduce it.
const SignUpLuxury = lazy(() => import("@/pages/SignUpLuxury"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardV2 = lazy(() => import("@/pages/DashboardV2"));
const CustomerBookings = lazy(() => import("@/pages/CustomerBookings"));
const CustomerFavourites = lazy(() => import("@/pages/CustomerFavourites"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const TalentMarketplace = lazy(() => import("@/pages/PetWashTalentMarketplacePage"));
const ServiceLandingPage = lazy(() => import("@/pages/ServiceLandingPage"));
const ProviderDetail = lazy(() => import("@/pages/ProviderDetail"));
const BookingContact = lazy(() => import("@/pages/BookingContact"));
const ProviderCompliance = lazy(() => import("@/pages/ProviderCompliance"));
const ProviderBookingsDashboard = lazy(() => import("@/pages/ProviderBookingsDashboard"));
const ProviderTaskInbox = lazy(() => import("@/pages/ProviderTaskInbox"));
const ProviderEarningsPage = lazy(() => import("@/pages/ProviderEarningsPage"));
const ProviderJobDetail = lazy(() => import("@/pages/ProviderJobDetail"));
const HostStayJourney = lazy(() => import("@/components/booking/HostStayJourney"));
const AccountingDashboard = lazy(() => import("@/pages/AccountingDashboard"));
const UnifiedControlPanel = lazy(() => import("@/pages/UnifiedControlPanel"));
const MarketplaceBookingFlow = lazy(() => import("@/pages/MarketplaceBookingFlow"));
const BookingSearchPage = lazy(() => import("@/pages/BookingSearchPage"));
const ProviderSearchPage = lazy(() => import("@/pages/ProviderSearchPage"));
const PrivilegeSignup = lazy(() => import("@/pages/PrivilegeSignup"));
const PrestigeClub = lazy(() => import("@/pages/PrestigeClub"));
const PrestigeInterestWaitlist = lazy(() => import("@/pages/PrestigeInterestWaitlist"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const LoyaltyDashboard = lazy(() => import("@/pages/LoyaltyDashboard"));
const LoyaltyTiers = lazy(() => import("@/pages/LoyaltyTiers"));
const LoyaltyBenefits = lazy(() => import("@/pages/LoyaltyBenefits"));
const LoyaltyBirthday = lazy(() => import("@/pages/LoyaltyBirthday"));
const LoyaltyRefer = lazy(() => import("@/pages/LoyaltyRefer"));
const LoyaltyCreditsHistory = lazy(() => import("@/pages/LoyaltyCreditsHistory"));
const ReferralPage = lazy(() => import("@/pages/ReferralPage"));
const EGift = lazy(() => import("@/pages/EGift"));
const CheckoutCanon = lazy(() => import("@/pages/CheckoutCanon"));
const GiftActivate = lazy(() => import("@/pages/GiftActivate"));
const Vouchers = lazy(() => import("@/pages/Vouchers"));
const Verify = lazy(() => import("@/pages/Verify"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const AccountDeletionResource = lazy(() => import("@/pages/AccountDeletionResource"));
const Terms = lazy(() => import("@/pages/Terms"));
const Accessibility = lazy(() => import("@/pages/Accessibility"));
const AccessibilityStatement = lazy(() => import("@/pages/AccessibilityStatement"));
const About = lazy(() => import("@/pages/About"));
const TrustCompliance = lazy(() => import("@/pages/TrustCompliance"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const StationPage = lazy(() => import("@/pages/StationPage"));
const Franchise = lazy(() => import("@/pages/Franchise"));
const Contact = lazy(() => import("@/pages/Contact"));
const OurService = lazy(() => import("@/pages/OurService"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const AdminBackendPanel = lazy(() => import("@/pages/AdminBackendPanel"));
const AdminSocialGrowth = lazy(() => import("@/pages/AdminSocialGrowth"));
const AdminGoogleForms = lazy(() => import("@/pages/AdminGoogleForms"));
const FormsHub = lazy(() => import("@/pages/forms/FormsHub"));
const ReviewForm = lazy(() => import("@/pages/forms/ReviewForm"));
const HRApplicationForm = lazy(() => import("@/pages/forms/HRApplicationForm"));
const SalesLeadForm = lazy(() => import("@/pages/forms/SalesLeadForm"));
const CustomerOnboardingForm = lazy(() => import("@/pages/forms/CustomerOnboardingForm"));
const RefundForm = lazy(() => import("@/pages/forms/RefundForm"));
// ProviderRegistrationForm retired 2026-06-14 — /forms/provider now redirects to
// the canonical /provider-onboarding (it was a dead-end form with no KYC/approval).
const QuickBookingForm = lazy(() => import("@/pages/forms/QuickBookingForm"));
const LegalAgreementForm = lazy(() => import("@/pages/forms/LegalAgreementForm"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminLoginV2 = lazy(() => import("@/pages/admin/AdminLoginV2"));
const AdminAccessDenied = lazy(() => import("@/pages/AdminAccessDenied"));
const GroupStatusMonitor = lazy(() => import("@/pages/admin/GroupStatusMonitor"));
const BrainDashboard = lazy(() => import("@/pages/admin/BrainDashboard"));
const PetWashBridge = lazy(() => import("@/pages/admin/PetWashBridge"));
const AdminLiveOps = lazy(() => import("@/pages/admin/AdminLiveOps"));
const AdminNayaxEvents = lazy(() => import("@/pages/admin/AdminNayaxEvents"));
const AdminOctopus = lazy(() => import("@/pages/AdminOctopus"));
const AdminShopProducts = lazy(() => import("@/pages/AdminShopProducts"));
const AdminBookkeeping = lazy(() => import("@/pages/AdminBookkeeping"));
const AdminStaff = lazy(() => import("@/pages/AdminStaff"));
const CEODashboard = lazy(() => import("@/pages/CEODashboard"));
const AdminKYC = lazy(() => import("@/pages/AdminKYC"));
const AdminSystemLogs = lazy(() => import("@/pages/AdminSystemLogs"));
const AdminVouchers = lazy(() => import("@/pages/AdminVouchers"));
const AdminCoupons = lazy(() => import("@/pages/AdminCoupons"));
const UserCoupons = lazy(() => import("@/pages/UserCoupons"));
const AdminWalletDashboard = lazy(() => import("@/pages/AdminWalletDashboard"));
const MoneyFlow = lazy(() => import("@/pages/MoneyFlow"));
const CrmDashboard = lazy(() => import("@/pages/CrmDashboard"));
const CustomerManagement = lazy(() => import("@/pages/CustomerManagement"));
const LeadManagement = lazy(() => import("@/pages/LeadManagement"));
const CommunicationCenter = lazy(() => import("@/pages/CommunicationCenter"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const FounderMember = lazy(() => import("@/pages/FounderMember"));
const QrActivatePage = lazy(() => import("@/pages/QrActivatePage"));
const ClaimVoucher = lazy(() => import("@/pages/ClaimVoucher"));
const BuyGiftCard = lazy(() => import("@/pages/BuyGiftCard"));
const PetWashInbox = lazy(() => import("@/pages/PetWashInbox")); // unified luxury inbox (Messages + Concierge + Alerts) — replaced the old Inbox.tsx
const Pets = lazy(() => import("@/pages/Pets"));
const PetPassport = lazy(() => import("@/pages/PetPassport"));
// Pet Owner / Passport / Consent Phase 1 (2026-06-20)
const PetCareProfile = lazy(() => import("@/pages/PetCareProfile"));
const PetDocuments = lazy(() => import("@/pages/PetDocuments"));
const ConsentCenter = lazy(() => import("@/pages/ConsentCenter"));
const NotificationPreferencesScreen = lazy(() => import("@/pages/NotificationPreferencesScreen"));
// PR-PET-4: pet onboarding luxury shell. Mounted only when
// VITE_PET_ONBOARDING_SHELL_ENABLED='true'. Local-state only, no
// backend persistence, no schema writes. See
// client/src/pages/onboarding/PetOnboardingShell.tsx.
const PetOnboardingShell = lazy(() => import("@/pages/onboarding/PetOnboardingShell"));
const PetCarePlanner = lazy(() => import("@/pages/PetCarePlanner"));
const EnterpriseFeaturesShowcase = lazy(() => import("@/pages/EnterpriseFeaturesShowcase"));
const PetWashCircle = lazy(() => import("@/pages/PetWashCircle"));
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
const FranchiseInbox = lazy(() => import("@/pages/franchise/FranchiseInbox"));
const FranchiseReports = lazy(() => import("@/pages/franchise/FranchiseReports"));
const FranchiseSupport = lazy(() => import("@/pages/franchise/FranchiseSupport"));
const FranchiseMarketing = lazy(() => import("@/pages/franchise/FranchiseMarketing"));
const FranchiseOwnerDashboard = lazy(() => import("@/pages/franchise/FranchiseOwnerDashboard"));
const CompanyHQDashboard = lazy(() => import("@/pages/CompanyHQDashboard"));
const FranchiseStationSettlements = lazy(() => import("@/pages/franchise/FranchiseStationSettlements"));
const CompanyStationSettlements = lazy(() => import("@/pages/CompanyStationSettlements"));
const BookingTrace = lazy(() => import("@/pages/BookingTrace"));
const CaseQueue = lazy(() => import("@/pages/CaseQueue"));
const ManagerDashboard = lazy(() => import("@/pages/ManagerDashboard"));
const GovernancePolicies = lazy(() => import("@/pages/GovernancePolicies"));
const AdminInbox = lazy(() => import("@/pages/AdminInbox"));
const AdminChatRisk = lazy(() => import("@/pages/AdminChatRisk"));
const WalletDownload = lazy(() => import("@/pages/WalletDownload"));
const MyWallet = lazy(() => import("@/pages/MyWallet"));
const PrestigePassWallet = lazy(() => import("@/pages/PrestigePassWallet"));
const PrestigeHome = lazy(() => import("@/pages/PrestigeHome"));
const PetPassportHome = lazy(() => import("@/pages/PetPassportHome"));
const AddPetPassport = lazy(() => import("@/pages/AddPetPassport"));
const StaffScan = lazy(() => import("@/pages/staff/StaffScan"));
const K9000Redeem = lazy(() => import("@/pages/K9000Redeem"));
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const ProfileV2 = lazy(() => import("@/pages/ProfileV2"));
const AdminStations = lazy(() => import("@/pages/AdminStations"));
const AdminFaultIntel = lazy(() => import("@/pages/AdminFaultIntel"));
const AdminReconfirmation = lazy(() => import("@/pages/AdminReconfirmation"));
const AdminStaffAcademy = lazy(() => import("@/pages/AdminStaffAcademy"));
const AdminExpansionMarketing = lazy(() => import("@/pages/AdminExpansionMarketing"));
const AdminStockReports = lazy(() => import("@/pages/AdminStockReports"));
const AdminSupportIncident = lazy(() => import("@/pages/AdminSupportIncident"));
const AdminBuildingsPartners = lazy(() => import("@/pages/AdminBuildingsPartners"));
const StationTimeline = lazy(() => import("@/pages/StationTimeline"));
const BayTimeline = lazy(() => import("@/pages/BayTimeline"));
const AdminBayMap = lazy(() => import("@/pages/AdminBayMap"));
const AdminCommandLog = lazy(() => import("@/pages/AdminCommandLog"));
const AdminCompensation = lazy(() => import("@/pages/AdminCompensation"));
const CustomerTimeline = lazy(() => import("@/pages/CustomerTimeline"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminTeamInvitations = lazy(() => import("@/pages/AdminTeamInvitations"));
const TeamInbox = lazy(() => import("@/pages/TeamInbox"));
const MobileStationHub = lazy(() => import("@/pages/MobileStationHub"));
const MobileStationSheet = lazy(() => import("@/pages/MobileStationSheet"));
const MobileOpsHub = lazy(() => import("@/pages/MobileOpsHub"));
const OpsTodayPage = lazy(() => import("@/pages/OpsTodayPage"));
const WelcomeConsent = lazy(() => import("@/pages/WelcomeConsent"));
const ConsentOnboarding = lazy(() => import("@/pages/ConsentOnboarding"));
const NotificationConsent = lazy(() => import("@/pages/NotificationConsent"));
const OpsDashboard = lazy(() => import("@/pages/OpsDashboard"));
const EnterpriseHQ = lazy(() => import("@/pages/EnterpriseHQ"));

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
const Follow = lazy(() => import("@/pages/Follow"));
const Packages = lazy(() => import("@/pages/Packages"));
const DiscountApplication = lazy(() => import("@/pages/DiscountApplication"));
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
const AdminDeadlines = lazy(() => import("@/pages/AdminDeadlines"));
const FranchiseManagementDashboard = lazy(() => import("@/pages/FranchiseManagementDashboard"));
const AdminRouteGuard = lazy(() => import("@/components/AdminRouteGuard").then(m => ({ default: m.AdminRouteGuard })));
// Maya Stage 2 — admin UI lazy imports
const AdminMaya = lazy(() => import("@/pages/admin/maya/AdminMaya"));
const AdminMayaInbox = lazy(() => import("@/pages/admin/maya/AdminMayaInbox"));
const AdminMayaConversationDetail = lazy(() => import("@/pages/admin/maya/AdminMayaConversationDetail"));
const AdminMayaLeads = lazy(() => import("@/pages/admin/maya/AdminMayaLeads"));
const AdminMayaProviderDrafts = lazy(() => import("@/pages/admin/maya/AdminMayaProviderDrafts"));
const AdminMayaBookingDrafts = lazy(() => import("@/pages/admin/maya/AdminMayaBookingDrafts"));
const AdminMayaTasks = lazy(() => import("@/pages/admin/maya/AdminMayaTasks"));
const AdminMayaEscalations = lazy(() => import("@/pages/admin/maya/AdminMayaEscalations"));
const AdminMayaAudit = lazy(() => import("@/pages/admin/maya/AdminMayaAudit"));

const AdminSecurityMonitoring = lazy(() => import("@/pages/AdminSecurityMonitoring"));
const AdminCeoReport = lazy(() => import("@/pages/AdminCeoReport"));
const AdminRetention = lazy(() => import("@/pages/AdminRetention"));
const ComplianceControlTower = lazy(() => import("@/pages/ComplianceControlTower"));
const GeminiWatchdogDashboard = lazy(() => import("@/pages/GeminiWatchdogDashboard"));
const PerformanceMonitoring = lazy(() => import("@/pages/PerformanceMonitoring"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const PetWashDayPlanner = lazy(() => import("@/pages/PetWashDayPlanner"));
const RoleAwareWeatherPlanner = lazy(() => import("@/pages/RoleAwareWeatherPlanner"));

// ⁦The Sitter Suite™⁩ - Pet Sitting Marketplace
const SitterSuiteOverview = lazy(() => import("@/pages/sitter-suite/Overview"));
const SitterSuite = lazy(() => import("@/pages/sitter-suite/BrowseSitters"));
const SitterDetail = lazy(() => import("@/pages/sitter-suite/SitterDetail"));
const SitterBookingFlow = lazy(() => import("@/pages/sitter-suite/BookingFlow"));
const SitterOwnerDashboard = lazy(() => import("@/pages/sitter-suite/OwnerDashboard"));
const SitterEditProfile = lazy(() => import("@/pages/sitter-suite/SitterEditProfile"));
const OwnerDashboardPage = SitterOwnerDashboard; // Alias

// ⁦Pet Wash Academy™⁩ - Professional Trainer Marketplace
const Academy = lazy(() => import("@/pages/Academy"));
const TrainerProfile = lazy(() => import("@/pages/academy/TrainerProfile"));
const TrainerDetail = lazy(() => import("@/pages/academy/TrainerDetail"));
const AcademyBookingFlow = lazy(() => import("@/pages/academy/BookingFlow"));
const TrainerBookings = lazy(() => import("@/pages/academy/TrainerBookings"));

// Provider Join Flows — platform-specific application forms
// /join/{walker,sitter,trainer} components deleted 2026-05-17 — they were
// non-functional dead-end forms (missing OTP verification, self-declaration
// checkbox, document uploads — all required by the canonical submit
// endpoint /api/provider-onboarding/apply). Users hit a generic 400 error
// on submit with no recovery path. Routes 302-redirect to the canonical
// /provider-onboarding?role=X surface. Same pattern Phase A applied to
// /apply-provider and /join-team.

// Contractor Dashboard - 2026 Lifecycle Management

// Provider Matching Flow
const ProviderMatchScreen = lazy(() => import("@/pages/ProviderMatchScreen"));

// Flash Deals + Daycare Calculator
const FlashDeals = lazy(() => import("@/pages/FlashDeals"));
const DaycareCalculator = lazy(() => import("@/pages/DaycareCalculator"));

// ⁦Walk My Pet™⁩ - Premium Dog Walking
const WalkMyPetOverview = lazy(() => import("@/pages/walk-my-pet/Overview"));
const WalkMyPet = lazy(() => import("@/pages/walk-my-pet/BrowseWalkers"));
const WalkerDetail = lazy(() => import("@/pages/walk-my-pet/WalkerDetail"));
const WalkBookingFlow = lazy(() => import("@/pages/walk-my-pet/BookingFlow"));
const WalkOwnerDashboardPage = lazy(() => import("@/pages/walk-my-pet/OwnerDashboard"));

// ⁦PetTrek™⁩ - Advanced Pet Transport
const PetTrek = lazy(() => import("@/pages/pettrek/BrowseDrivers"));

// Grooming Marketplace - Professional Pet Grooming Services
const GroomersOverview = lazy(() => import("@/pages/groomers/Overview"));
const Groomers = lazy(() => import("@/pages/Groomers"));
const GroomerDetail = lazy(() => import("@/pages/groomers/GroomerDetail"));
const GroomersBook = lazy(() => import("@/pages/GroomersBook"));
const GroomersCustomerDashboard = lazy(() => import("@/pages/GroomersCustomerDashboard"));

// Shared Pet Services Foundation - Cross-Platform Community Services
const SharedServicesPrograms = lazy(() => import("@/pages/SharedServicesPrograms"));
const SharedServicesImpact = lazy(() => import("@/pages/SharedServicesImpact"));
const GlobalCommunityHub = lazy(() => import("@/pages/GlobalCommunityHub"));

// Pet Wash Platform Hub - Unified Service Discovery
const PlatformHub = lazy(() => import("@/pages/PlatformHub"));

// PetWash HQ - Octopus Control Panel (Luxury 2025 Admin)
const OctopusControlPanel = lazy(() => import("@/modules/octopus/PetWashOctopusControlPanel"));

// PetWash HQ - Management Control System 2026
const HQManagementPortal = lazy(() => import("@/pages/HQManagementPortal"));

// Mobile Management Dashboard - Executive Suite 2026
const MobileManagementDashboard = lazy(() => import("@/pages/MobileManagementDashboard"));

// K9000 Wash Stations - Self-Service Natural Pet Washing
const K9000Overview = lazy(() => import("@/pages/k9000/Overview"));
const K9000BayStatus = lazy(() => import("@/pages/k9000/BayStatus"));

const GroomingFeedback = lazy(() => import("@/pages/GroomingFeedback"));
const GroomingReviews = lazy(() => import("@/pages/GroomingReviews"));

const AuditTrail = lazy(() => import("@/pages/AuditTrail"));
const FraudDashboard = lazy(() => import("@/pages/admin/FraudDashboard"));
// Control Tower panels (2026-06-20)
const AdminPaymentsControl = lazy(() => import("@/pages/admin/AdminPaymentsControl"));
const AdminProviderControl = lazy(() => import("@/pages/admin/AdminProviderControl"));
const AdminApplicationsDashboard = lazy(() => import("@/pages/admin/AdminApplicationsDashboard"));
const AdminMemberDiscounts = lazy(() => import("@/pages/admin/AdminMemberDiscounts"));
const AdminCustomerDetail = lazy(() => import("@/pages/admin/AdminCustomerDetail"));
const AdminBayControl = lazy(() => import("@/pages/admin/AdminBayControl"));
const AdminAlertsCenter = lazy(() => import("@/pages/admin/AdminAlertsCenter"));
const AdminProviderVerification = lazy(() => import("@/pages/admin/AdminProviderVerification"));
const ProviderKycReview = lazy(() => import("@/pages/admin/ProviderKycReview"));
const ManagementKycDashboard = lazy(() => import("@/pages/admin/ManagementKycDashboard"));
const ProviderApplicationStatus = lazy(() => import("@/pages/ProviderApplicationStatus"));
const ProviderDeclarations = lazy(() => import("@/pages/ProviderDeclarations"));
const AdminLoyaltyRules = lazy(() => import("@/pages/admin/AdminLoyaltyRules"));
const AdminWashPackages = lazy(() => import("@/pages/AdminWashPackages"));
const AdminOpsMonitor = lazy(() => import("@/pages/admin/AdminOpsMonitor"));
const AdminTreasurySettings = lazy(() => import("@/pages/admin/AdminTreasurySettings"));
const AdminSystemConfig = lazy(() => import("@/pages/admin/AdminSystemConfig"));
// NOTE: AdminOperatingControl import temporarily removed (hotfix). The lazy
// import referenced @/pages/admin/AdminOperatingControl but that file is NOT
// committed to main — only the import + usage landed in a previous PR. Vite
// build fails with ENOENT, blocking every Cloud Run deploy + Firebase
// Hosting build. When the actual AdminOperatingControl.tsx file ships in
// a separate PR alongside its import, restore this line.
const AdminLiveEvents = lazy(() => import("@/pages/admin/AdminLiveEvents"));
const GeminiFinancialMonitor = lazy(() => import("@/pages/admin/GeminiFinancialMonitor"));
const PawFinderAdmin = lazy(() => import("@/pages/admin/PawFinderAdmin"));

// Pet Wash Ltd Executive Suite - Centralized C-Suite Management
const ExecutiveSuiteHome = lazy(() => import("@/pages/ExecutiveSuiteHome"));
const ExecutiveSuiteGuard = lazy(() => import("@/components/ExecutiveSuiteGuard").then(m => ({ default: m.ExecutiveSuiteGuard })));
// Phase 12.15 — Executive Oversight & Network Health
const NetworkOversight = lazy(() => import("@/pages/NetworkOversight"));
// Phase 12.16 — Financial Governance & Approval Controls
const FinancialApprovals = lazy(() => import("@/pages/FinancialApprovals"));
// Phase 12.17 — Cash Reconciliation & Treasury Discipline
const Treasury = lazy(() => import("@/pages/Treasury"));
// Phase 12.18 — Forecasting, Liquidity & Reserve Planning
const TreasuryForecast = lazy(() => import("@/pages/TreasuryForecast"));
// Phase 12.19 — Profitability, Unit Economics & Capital Allocation
const FinanceProfitability = lazy(() => import("@/pages/FinanceProfitability"));
// Phase 12.20 — Expansion Decision & Board Pack
const BoardPack = lazy(() => import("@/pages/BoardPack"));
// Phase 12.21 — Intervention & Decision Tracking
const Interventions = lazy(() => import("@/pages/Interventions"));
// Phase 12.22 — Outcome Measurement & Intervention Effectiveness
const Outcomes = lazy(() => import("@/pages/Outcomes"));
// Phase 12.23 — Learning, Policy Refinement & Capital Feedback
const PolicyFeedback = lazy(() => import("@/pages/PolicyFeedback"));
// Phase 12.24 — Policy Execution Discipline & Controlled Rollout
const PolicyRollout = lazy(() => import("@/pages/PolicyRollout"));
// Phase 12.25 — Autonomous Optimization (Controlled)
const Optimizer = lazy(() => import("@/pages/Optimizer"));
const Meetings = lazy(() => import("@/pages/Meetings"));
const PlatformLegalFramework = lazy(() => import("@/pages/PlatformLegalFramework"));
const ProviderOnboarding = lazy(() => import("@/pages/ProviderOnboarding"));
const ProviderListings = lazy(() => import("@/pages/ProviderListings"));
const PawFinder = lazy(() => import("@/pages/PawFinder"));
const AdoptionMaison = lazy(() => import("@/pages/AdoptionMaison"));
const ServiceStatus = lazy(() => import("@/pages/ServiceStatus"));

// ⁦PetWash™⁩ 2025 Global Architecture - Octopus Model Routes
const Hub = lazy(() => import("@/pages/Hub"));
const Shop = lazy(() => import("@/pages/Shop"));
const ShopStore = lazy(() => import("@/pages/ShopStore"));
const ShopOrders = lazy(() => import("@/pages/ShopOrders"));
const BookingUnified = lazy(() => import("@/pages/BookingUnified"));
const BookingConfirmation = lazy(() => import("@/pages/BookingConfirmation"));
const MultiPetBookingWizard = lazy(() => import("@/pages/booking/MultiPetBookingWizard"));
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
const LegalPrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const EGiftPolicy = lazy(() => import("@/pages/legal/EGiftPolicy"));
const LoyaltyTermsPage = lazy(() => import("@/pages/legal/LoyaltyTerms"));
const CookiesPolicy = lazy(() => import("@/pages/legal/Cookies"));
const Trademarks = lazy(() => import("@/pages/legal/Trademarks"));
const MarketplaceTerms = lazy(() => import("@/pages/legal/MarketplaceTerms"));
const LegalDisclaimer = lazy(() => import("@/pages/legal/Disclaimer"));
// Legal Routes — Israel 2026 set (draft, pending counsel)
const LegalCustomerTerms = lazy(() => import("@/pages/legal/CustomerTerms"));
const LegalProviderAgreement = lazy(() => import("@/pages/legal/ProviderAgreement"));
const LegalCancellationRefund = lazy(() => import("@/pages/legal/CancellationRefundPolicy"));
const LegalWalletEGiftTerms = lazy(() => import("@/pages/legal/WalletEGiftTerms"));
const LegalStationUseTerms = lazy(() => import("@/pages/legal/StationUseTerms"));
const LegalHomeAccess = lazy(() => import("@/pages/legal/HomeAccessPropertyAuthority"));
const LegalNoInsuranceNotice = lazy(() => import("@/pages/legal/ProtectionNoInsuranceNotice"));
// Legal full series — Israel 2026 (draft, pending counsel)
const LegalIndex = lazy(() => import("@/pages/legal/LegalIndex"));
const LegalPetOwnerResponsibility = lazy(() => import("@/pages/legal/PetOwnerResponsibility"));
const LegalPetProfileHealthDataNotice = lazy(() => import("@/pages/legal/PetProfileHealthDataNotice"));
const LegalBookingRules = lazy(() => import("@/pages/legal/BookingRules"));
const LegalEmergencyVetAuthorisation = lazy(() => import("@/pages/legal/EmergencyVetAuthorisation"));
const LegalReviewsContentPolicy = lazy(() => import("@/pages/legal/ReviewsContentPolicy"));
const LegalCommunityGuidelines = lazy(() => import("@/pages/legal/CommunityGuidelines"));
const LegalSupportIncidentReporting = lazy(() => import("@/pages/legal/SupportIncidentReporting"));
const LegalProviderIndependentStatus = lazy(() => import("@/pages/legal/ProviderIndependentStatus"));
const LegalProviderTruthDeclaration = lazy(() => import("@/pages/legal/ProviderTruthDeclaration"));
const LegalProviderTaxBusinessDeclaration = lazy(() => import("@/pages/legal/ProviderTaxBusinessDeclaration"));
const LegalProviderPayoutRules = lazy(() => import("@/pages/legal/ProviderPayoutRules"));
const LegalNoCircumvention = lazy(() => import("@/pages/legal/NoCircumvention"));
const LegalProviderConfidentiality = lazy(() => import("@/pages/legal/ProviderConfidentiality"));
const LegalProviderIncidentReporting = lazy(() => import("@/pages/legal/ProviderIncidentReporting"));
const LegalProviderCancellation = lazy(() => import("@/pages/legal/ProviderCancellation"));
const LegalProviderDocumentUpload = lazy(() => import("@/pages/legal/ProviderDocumentUpload"));
const LegalProviderReconfirmation = lazy(() => import("@/pages/legal/ProviderReconfirmation"));
const LegalProviderInsuranceLicence = lazy(() => import("@/pages/legal/ProviderInsuranceLicence"));
const LegalProviderBrandUse = lazy(() => import("@/pages/legal/ProviderBrandUse"));
const LegalSupportProtectionPolicy = lazy(() => import("@/pages/legal/SupportProtectionPolicy"));
const LegalClaimProcedure = lazy(() => import("@/pages/legal/ClaimProcedure"));
// Manuals — Israel 2026 (draft, pending counsel)
const ManualDogWalking = lazy(() => import("@/pages/manuals/DogWalkingManual"));
const ManualPetSitting = lazy(() => import("@/pages/manuals/PetSittingManual"));
const ManualHomeVisit = lazy(() => import("@/pages/manuals/HomeVisitManual"));
const ManualOvernightSitting = lazy(() => import("@/pages/manuals/OvernightSittingManual"));
const ManualGrooming = lazy(() => import("@/pages/manuals/GroomingManual"));
const ManualTraining = lazy(() => import("@/pages/manuals/TrainingManual"));
const ManualIncidentReporting = lazy(() => import("@/pages/manuals/IncidentReportingManual"));
const ManualProviderSupport = lazy(() => import("@/pages/manuals/ProviderSupportManual"));

// ⁦Walk My Pet™⁩ Pages
const BookingChat = lazy(() => import("@/pages/BookingChat"));
const AdminBookingChat = lazy(() => import("@/pages/admin/AdminBookingChat"));

// ⁦PetTrek™⁩ Pages
const BookTrip = lazy(() => import("@/pages/pettrek/BookTrip"));
const TrackTrip = lazy(() => import("@/pages/pettrek/TrackTrip"));
const ProviderDashboard = lazy(() => import("@/pages/pettrek/ProviderDashboard"));

// ⁦The Sitter Suite™⁩ - Legal Documents (marketplace platform compliance)
const SitterPrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const SitterTermsConditions = lazy(() => import("@/pages/legal/TermsConditions"));
const SitterDisclaimer = lazy(() => import("@/pages/legal/Disclaimer"));

// ⁦Walk My Pet™⁩ - Live Tracking Pages
const WalkTracking = lazy(() => import("@/pages/WalkTracking"));
const TrackMyPetLive = lazy(() => import("@/pages/WalkTracking"));

// ⁦PetTrek™⁩ - Legacy/Alias Pages

// Unified Provider Dashboard (PetWash™ style)

// Provider Operations Console 2026

// Provider OS — Full Operating System
const ProviderOS = lazy(() => import("@/pages/provider-os/ProviderOS"));
const ProviderHome = lazy(() => import("@/pages/ProviderHome"));

// E-Signature System

// Personal Secure Inbox
const PersonalInbox = lazy(() => import("@/pages/PersonalInbox"));

// Phase 8 — Trust & Quality
const MarketplaceReviewPage = lazy(() => import("@/pages/MarketplaceReviewPage"));
const ReportProblemPage = lazy(() => import("@/pages/ReportProblemPage"));
const ProviderFeedbackDashboard = lazy(() => import("@/pages/ProviderFeedbackDashboard"));

// Phase 9 — Marketplace Intelligence
const MarketplaceIntelligenceDashboard = lazy(() => import("@/pages/MarketplaceIntelligenceDashboard"));
const ProviderRankingPanel = lazy(() => import("@/pages/ProviderRankingPanel"));

// Phase 10 — Franchise & Station Scaling
const StationDashboard = lazy(() => import("@/pages/StationDashboard"));
const DisputeDetail = lazy(() => import("@/pages/DisputeDetail"));

// Loading fallback component.
// Reads pw_lang directly from localStorage (same canonical key as
// languageStore.tsx) so the spinner copy is correctly localized even
// when this renders before any React context provider is mounted —
// e.g. on the first lazy-chunk download during cold start. Defaults to
// Hebrew because the site is Hebrew-first.
const PAGE_LOADER_COPY: Record<string, string> = {
  he: 'טוען...',
  en: 'Loading...',
  ar: 'جاري التحميل...',
  ru: 'Загрузка...',
  fr: 'Chargement...',
  es: 'Cargando...',
};
const getPageLoaderLabel = (): string => {
  try {
    const lang = typeof window !== 'undefined' ? localStorage.getItem('pw_lang') : null;
    return (lang && PAGE_LOADER_COPY[lang]) || PAGE_LOADER_COPY.he;
  } catch {
    return PAGE_LOADER_COPY.he;
  }
};

const PageLoader = () => (
  <div data-build-version="BUILD_2026_01_25_1769349430610" className="min-h-[100dvh] bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-[#B8932F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">{getPageLoaderLabel()}</p>
    </div>
  </div>
);

/**
 * Route-scoped error boundary used by /my-account so a render or
 * lazy-chunk failure on the account page does NOT replace the entire
 * shell via the global AppErrorBoundary. Renders a small "this section
 * had an issue" card with a Go-Home CTA. Telemetry is intentionally a
 * single best-effort POST — the global boundary remains the catch-all
 * for cross-app crashes. See P0 audit (PR #86) Bug 2.
 */
class RouteErrorBoundary extends Component<{ children: ReactNode; routeName: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: `RouteErrorBoundary:${this.props.routeName}`,
          message: error?.message,
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => { /* swallow — never throw from a boundary */ });
    } catch {
      // noop
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">This section had an issue</h2>
          <p className="text-gray-600">
            We couldn't load this page right now. Please try again, or head back home.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/home'; }}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Issue #153 PR-BPV-1 — Become Provider straight-through redirect helper.
 *
 * Replaces the inline closure that unconditionally redirected to
 * /sign-in?redirect=/provider-onboarding regardless of auth state.
 * That pattern caused a visible flash to the SignIn chrome and fed
 * into the post-login decider race (diagnostic 4404078588 V3).
 *
 * Behaviour:
 *   • loading      → render nothing for ~50ms while auth resolves
 *                    (better than flashing /sign-in to a signed-in user)
 *   • user signed-in → Redirect directly to /provider-onboarding
 *   • anonymous    → Redirect to /sign-in?redirect=… (canonical anon flow)
 *
 * Routing-only. No auth contract change, no whoami change, no schema,
 * no money, no BookingEngine, no K9000/Nayax/Tranzila.
 */
function BecomeProviderRedirect() {
  const { user, loading } = useFirebaseAuth();
  const allowedTypes = new Set([
    "walker", "sitter", "driver", "trainer", "station_operator", "pet_trek",
  ]);
  const rawType =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("type")
      : null;
  const safeType = rawType && allowedTypes.has(rawType) ? rawType : null;
  const redirectTarget = safeType
    ? `/provider-onboarding?type=${encodeURIComponent(safeType)}`
    : "/provider-onboarding";

  if (loading) return null;
  if (user) return <Redirect to={redirectTarget} />;
  return <Redirect to={`/sign-in?redirect=${encodeURIComponent(redirectTarget)}`} />;
}

/**
 * PR Phase A (2026-05-16): /apply-provider and /join-team are duplicate
 * legacy entry points for becoming a provider.
 * Both redirect to the canonical /provider-onboarding. Routes remain
 * mounted for 90 days so inbound links (Google index, business cards,
 * social posts) keep working; canonical surface is the single source
 * of truth. Per docs/PROVIDER_ONBOARDING_AND_OAUTH_REBUILD_AUDIT.md §2.
 */
function LegacyProviderRouteRedirect() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  return <Redirect to={`/provider-onboarding${search}`} />;
}

function Router({ language, onLanguageChange }: { language: Language; onLanguageChange: (lang: Language) => void }) {
  const { user, loading } = useFirebaseAuth();
  const { role, isLoading: roleLoading } = useWhoami();
  const { trackLanguageChange } = useAnalytics();
  const [appPath, setLocation] = useLocation();
  // Seed from the BUILD-TIME flavor (VITE_APP_FLAVOR) so the app knows which of
  // the two it is at frame 0 — no async bundle-id lookup needed. The effect
  // below still runs as a runtime fallback for web/dev where the var is unset.
  // Exact `import.meta.env` token — Vite's env injection/define only recognise
  // this precise form; the old optional-chained version was invisible to both,
  // so the build-time flavor seed silently never fired (see appFlavor.ts note).
  const BUILD_FLAVOR = (import.meta.env.VITE_APP_FLAVOR ?? '') as string;
  const [isProviderApp, setIsProviderApp] = useState(BUILD_FLAVOR === 'provider');
  const [isCustomerApp, setIsCustomerApp] = useState(BUILD_FLAVOR === 'customer');
  const IS_DEV = import.meta.env.DEV === true;
  // SYNCHRONOUS "is this a native app?" — available at frame 0 (unlike the async
  // bundle-id flavor below). This is the fix for "the app looks like a browser":
  // a native app must NEVER render the web marketing Landing/Home, not even for
  // the millisecond it takes the async flavor to resolve. Web = false → untouched.
  const isNativeApp = Capacitor.isNativePlatform();
  
  // Initialize FCM push notifications (auto-registers after login)
  useFCMNotifications(true);

  // WALLET/PROFILE FRESHNESS (2026-06-13): refetch live money/identity data when
  // the tab regains focus (web) or the app RESUMES from background (Capacitor),
  // so a user never sees a stale balance/profile after a purchase, a redeem, or
  // backgrounding the app. Targeted to freshness-sensitive keys only.
  useEffect(() => {
    const LIVE_KEYS = [
      '/api/credit-wallet/summary',
      '/api/credit-wallet/activity',
      '/api/auth/user',
      '/api/user/profile',
      '/api/loyalty/profile',
      '/api/prestige-pass/me',
    ];
    const refreshLive = () => LIVE_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    window.addEventListener('focus', refreshLive);
    let removeCap: (() => void) | undefined;
    import('@capacitor/app')
      .then(({ App: CapApp }) =>
        CapApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => { if (isActive) refreshLive(); })
          .then((h: { remove: () => void }) => { removeCap = () => h.remove(); }),
      )
      .catch(() => { /* web (no Capacitor) — the focus listener covers it */ });
    return () => { window.removeEventListener('focus', refreshLive); removeCap?.(); };
  }, []);

  // APP-FLAVOR ROUTING (2026-06-17): the customer (com.petwash.il) and
  // provider (il.co.petwash.provider) apps ship the SAME web bundle. On a cold
  // Detect the native app flavor once (provider vs customer bundle id). Web stays false.
  useEffect(() => {
    if (!isNativeApp) return; // web: leave both flavors false, Landing/Home as-is.
    let cancelled = false;
    // Safety net: if bundle-id detection is slow or unavailable in the native
    // build, we still must NOT strand the user on a blank/loader screen. Default
    // a native app to the CUSTOMER (member) experience after a short beat; a
    // real provider-id result below overrides it. Net effect: a native app is
    // ALWAYS one of the two app experiences, NEVER the web site.
    const fallback = setTimeout(() => {
      if (!cancelled) setIsCustomerApp((prev) => prev || !isProviderApp);
    }, 1200);
    import('@capacitor/app')
      .then(async ({ App: CapApp }) => {
        try {
          const info = await CapApp.getInfo();
          const id = typeof info?.id === 'string' ? info.id : '';
          if (!cancelled) {
            const provider = id.includes('.provider');
            setIsProviderApp(provider);
            // CUSTOMER flavor = the native app that is NOT the provider build
            // (com.petwash.il / il.co.petwash.customer).
            setIsCustomerApp(!provider);
          }
        } catch { if (!cancelled) setIsCustomerApp(true); }
      })
      .catch(() => { if (!cancelled) setIsCustomerApp(true); });
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [isNativeApp]);

  // Smart app-purpose routing — each app opens to the experience its user needs.
  // The PROVIDER (driver-style) app serves providers: from the root, a provider
  // lands on ProviderHome (/provider/home — the CEO 2026-06-24 design: green ID
  // card, stats, jobs, earnings, compliance); a signed-in non-provider is sent
  // to provider onboarding ("become a provider"); a signed-out user goes to signup.
  // The CUSTOMER (member) app opens a SIGNED-IN member onto PrestigeHome
  // (/prestige/home — the same design, gold/luxury: membership card + live QR,
  // stats, quick actions, pets, rewards), not the marketing Landing or the older
  // /dashboard; a signed-out customer stays on Landing to sign up.
  // Only fires at "/" so it never hijacks deliberate navigation. Native only —
  // web (both flavors false) is untouched and keeps Landing/Home at "/".
  useEffect(() => {
    if (loading || roleLoading) return;
    if (window.location.pathname !== '/') return;
    if (isProviderApp) {
      if (!user) { setLocation('/signup'); return; }
      setLocation(role === 'provider' ? '/provider/home' : '/provider-onboarding');
      return;
    }
    if (isCustomerApp) {
      // CEO 2026-07-02 (TestFlight walkthrough): a signed-out CUSTOMER app must
      // NEVER show the web marketing Landing / welcome-intent screen — that is
      // the "website wrapper" behavior the two-app spec bans. Straight to the
      // luxury sign-in/sign-up screen (Google/Apple/phone/email — returning
      // users sign in on the same screen); signed-in members → PrestigeHome.
      setLocation(user ? '/prestige/home' : '/signup');
    }
  }, [isProviderApp, isCustomerApp, user, loading, role, roleLoading, setLocation]);

  // ── FLAVOR SANDBOX (CEO 2026-07-21: "each with his own operation and needs,
  //    provider is not loyalty") ────────────────────────────────────────────────
  // The two native apps ship one bundle, so EVERY route technically exists in
  // both. Root routing alone isn't separation: a deep link, push tap or stray
  // <Link> could drop the PROVIDER app into the member world (loyalty, shop,
  // eGift, Prestige wallet) or the CUSTOMER app into provider ops. Per the
  // canonical two-app spec (Prestige = Home/Book/Shop/Wallet/Account · Provider
  // = Jobs/Calendar/Earnings/Compliance/Account), each app now stays inside its
  // own product: an out-of-flavor path bounces to that app's home. Web browsers
  // are completely untouched (both flavors false).
  const PROVIDER_APP_BLOCKED = [
    '/loyalty', '/prestige', '/shop', '/egift', '/my-wallet', '/rewards',
    '/pet-passport', '/pets', '/bookings', '/my-bookings', '/locations',
    '/story', '/media', '/careers', '/follow',
  ];
  const CUSTOMER_APP_BLOCKED = [
    '/provider', '/provider-os', '/provider-compliance', '/provider-onboarding',
    '/provider-signup',
  ];
  useEffect(() => {
    if (loading) return;
    const hits = (prefixes: string[]) =>
      prefixes.some((p) => appPath === p || appPath.startsWith(p + '/'));
    if (isProviderApp && hits(PROVIDER_APP_BLOCKED)) {
      setLocation('/provider/home');
    } else if (isCustomerApp && hits(CUSTOMER_APP_BLOCKED)) {
      setLocation('/prestige/home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appPath, isProviderApp, isCustomerApp, loading, setLocation]);

  // Get personalized AI greeting on app launch 🎉
  usePersonalizedGreeting();
  
  useScrollToTop();

  // Show Google One Tap only when user is not logged in
  const showOneTap = !user && !loading;

  const handleLanguageChange = (newLanguage: Language) => {
    if (newLanguage !== language) {
      trackLanguageChange(language, newLanguage);
      onLanguageChange(newLanguage);
      localStorage.setItem('pw_lang', newLanguage);
    }
  };

  // Root "/" (and "/home") render. A native/flavored app (the Prestige or Provider
  // build) must NEVER show the web marketing Landing — it redirects DURING RENDER to
  // its own experience, so it does not depend on a delayed useEffect that could miss
  // (the bug: auth `loading` stays true ~8s on native, then the effect-based redirect
  // didn't fire, leaving the app on the website — 2026-07-11). BUILD_FLAVOR makes
  // isProviderApp/isCustomerApp reliable from frame 0. Web (no flavor) is unchanged.
  const renderRootForApp = () => {
    const flavored = isNativeApp || isProviderApp || isCustomerApp;
    if (flavored) {
      if (loading) return <PageLoader />; // brief; the AuthProvider watchdog caps at 8s
      if (isProviderApp) return <Redirect to={user ? '/provider/home' : '/signup'} />;
      // customer flavor (or a generic native build) → the member experience
      return <Redirect to={user ? '/prestige/home' : '/signup'} />;
    }
    // Web browser — marketing Landing for signed-out, Home for signed-in (unchanged).
    if (loading) return <PageLoader />;
    return user ? (
      <Home language={language} onLanguageChange={handleLanguageChange} />
    ) : (
      <Landing language={language} onLanguageChange={handleLanguageChange} />
    );
  };

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Google One Tap - shows floating "Continue as …?" card for signed-in Google users */}
      {showOneTap && <GoogleOneTap enabled={true} autoPrompt={true} />}
      
      <Switch>
        {/* Public routes */}
        <Route path="/">
          {() => renderRootForApp()}
        </Route>
        <Route path="/home">
          {() => renderRootForApp()}
        </Route>
        <Route path="/signin">
          {() => <SignUpLuxury language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/sign-in">
          {() => <SignUpLuxury language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/login">
          {() => <SignUpLuxury language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/booking-chat/inbox">
          {() => (
            <RequireAuth>
              <PetWashInbox />
            </RequireAuth>
          )}
        </Route>
        <Route path="/booking-chat/:bookingId">
          {() => (
            <RequireAuth>
              <BookingChat />
            </RequireAuth>
          )}
        </Route>
        <Route path="/admin/booking-chat/:bookingId">
          {() => (
            <RoleProtectedRoute minRole="staff">
              <AdminBookingChat />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/signin-advanced">
          {() => <SignUpLuxury language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/signup">
          {() => <SignUpLuxury language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        {/* /signup is the single canonical door — every alias hard-redirects to it,
            preserving the query string (?flow=provider|prestige|guest|booking). */}
        <Route path="/signup-lux">{() => <Redirect to={`/signup${window.location.search}`} />}</Route>
        <Route path="/sign-up">{() => <Redirect to={`/signup${window.location.search}`} />}</Route>
        <Route path="/register">{() => <Redirect to={`/signup${window.location.search}`} />}</Route>

        {/* Canonical "ideal" account/flow paths referenced across the signup +
            gold-account-button specs. Each is a redirect-alias to the REAL page
            that exists today (query string preserved for returnTo). This makes
            the ideal paths real targets so later PRs (whoami remap, Octopus) can
            link to them without 404s. No new pages are introduced here. */}
        <Route path="/account">{() => <Redirect to={`/my-account${window.location.search}`} />}</Route>
        {/* PRINTED station-board QR (CEO 2026-07-02): the physical Kfar Saba board
            encodes https://petwash.co.il/qr — this route did not exist and 404'd.
            The URL is on PRINTED signage, so it must resolve forever: a customer
            standing at the K9000 lands on the stations/wash experience. Add a
            utm so scans are measurable in analytics. */}
        <Route path="/qr">{() => <Redirect to="/locations?utm_source=station_qr&utm_medium=board" />}</Route>
        <Route path="/octopus">{() => <Redirect to={`/admin/dashboard${window.location.search}`} />}</Route>
        <Route path="/profile/complete">{() => <Redirect to={`/complete-profile${window.location.search}`} />}</Route>
        <Route path="/provider/onboarding">{() => <Redirect to={`/provider-onboarding${window.location.search}`} />}</Route>
        <Route path="/prestige/dashboard">{() => <Redirect to={`/loyalty/dashboard${window.location.search}`} />}</Route>
        <Route path="/booking/intake">{() => <Redirect to={`/booking${window.location.search}`} />}</Route>
        <Route path="/guest/checkout">{() => <Redirect to={`/egift${window.location.search}`} />}</Route>

        {/* The role-gate interstitial is DEAD (CEO order 2026-07-04). SignUpLuxury
            is the single door; providers enter via /become-provider. Old links and
            cached post-login responses land on signup instead of a removed page. */}
        <Route path="/choose-role">{() => <Redirect to={`/signup${window.location.search}`} />}</Route>
        {/* Other post-login role routing pages still require auth */}
        <Route path="/complete-profile">
          {() => (
            <RequireAuth>
              <CompleteProfile />
            </RequireAuth>
          )}
        </Route>
        <Route path="/provider/pending">
          {() => (
            <RequireAuth>
              <ProviderPending />
            </RequireAuth>
          )}
        </Route>
        <Route path="/provider/rejected">
          {() => (
            <RequireAuth>
              <ProviderRejected />
            </RequireAuth>
          )}
        </Route>
        <Route path="/staff/pending">
          {() => (
            <RequireAuth>
              <StaffPending />
            </RequireAuth>
          )}
        </Route>
        <Route path="/staff/rejected">
          {() => (
            <RequireAuth>
              <StaffRejected />
            </RequireAuth>
          )}
        </Route>
        <Route path="/staff/scan">
          {() => (
            <RequireAuth>
              <RoleProtectedRoute minRole="staff">
                <StaffScan />
              </RoleProtectedRoute>
            </RequireAuth>
          )}
        </Route>
        <Route path="/access-pending">
          {() => (
            <RequireAuth>
              <AccessPending />
            </RequireAuth>
          )}
        </Route>
        <Route path="/blocked">{() => <BlockedPage />}</Route>
        <Route path="/verify-email">{() => <VerifyEmail />}</Route>
        <Route path="/activate-account">{() => <AccountActivation />}</Route>

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
        <Route path="/consent-onboarding">{() => <ConsentOnboarding language={language} />}</Route>
        <Route path="/notification-consent">{() => <NotificationConsent language={language} />}</Route>
        <Route path="/notifications">{() => <RequireAuth><NotificationsPage /></RequireAuth>}</Route>
        
        {/* Firebase Auth Action Handler (password reset, email verification) */}
        <Route path="/auth/action">{() => <AuthAction />}</Route>
        <Route path="/__/auth/action">{() => <AuthAction />}</Route>
        
        {/* Protected route - Dashboard */}
        <Route path="/dashboard">
          {() => (
            <RequireAuth>
              {/* CUSTOMER-app terms gate (fail-open, native customer flavor only; web/provider pass-through). */}
              <AppTermsGate flavor="customer" language={language}>
                {/* DashboardV2 (luxury) behind a flag; legacy Dashboard is the default. */}
                {import.meta.env.VITE_DASHBOARD_V2_ENABLED === 'true' ? <DashboardV2 /> : <Dashboard />}
              </AppTermsGate>
            </RequireAuth>
          )}
        </Route>

        <Route path="/bookings">
          {() => (
            <RequireAuth>
              <CustomerBookings />
            </RequireAuth>
          )}
        </Route>

        <Route path="/my/timeline">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <CustomerTimeline />
              </Suspense>
            </RequireAuth>
          )}
        </Route>

        <Route path="/favourites">
          {() => (
            <RequireAuth>
              <CustomerFavourites />
            </RequireAuth>
          )}
        </Route>
        
        {/* PetWash Prestige Club - Luxury Loyalty Landing */}
        <Route path="/prestige-club">
          {() => <PrestigeClub />}
        </Route>
        <Route path="/prestige/waitlist">
          {() => <PrestigeInterestWaitlist />}
        </Route>
        <Route path="/prestige/apply">
          {() => <PrestigeInterestWaitlist />}
        </Route>

        {/* PetWash Prestige Pass Wallet — luxury digital pass with live QR (auth required) */}
        <Route path="/prestige-pass">
          {() => (
            <RequireAuth>
              <PrestigePassWallet />
            </RequireAuth>
          )}
        </Route>

        {/* Luxury customer (Prestige) home — dark rollout, reachable for preview */}
        <Route path="/prestige/home">
          {() => (
            <RequireAuth>
              <PrestigeHome />
            </RequireAuth>
          )}
        </Route>

        {/* Pet Passport home — the CEO's 2026-07-07 canonical multi-pet screen */}
        <Route path="/pet-passport">
          {() => (
            <RequireAuth>
              <PetPassportHome />
            </RequireAuth>
          )}
        </Route>
        <Route path="/pet-passport/add">
          {() => (
            <RequireAuth>
              <AddPetPassport />
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
        <Route path="/loyalty/credits">
          {() => (
            <RequireAuth>
              <LoyaltyCreditsHistory />
            </RequireAuth>
          )}
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
        <Route path="/gift/activate/:voucherId">
          {() => <GiftActivate />}
        </Route>
        <Route path="/checkout">
          {() => <CheckoutCanon />}
        </Route>
        <Route path="/egift">
          {() => <EGift />}
        </Route>
        <Route path="/e-gift">
          {() => <EGift />}
        </Route>
        <Route path="/gift-cards">
          {() => <EGift />}
        </Route>
        {/* SUMIT redirects the customer to /payment-success or /payment-failed after
            the hosted-payment page. These were NOT routed → customers hit a 404 after
            paying. Route them so the journey completes. (Failed page is honest: no
            false "success"; deeper ref→voucher detail wiring is a follow-up.) */}
        <Route path="/payment-success">
          {() => <PaymentSuccess language={language} />}
        </Route>
        <Route path="/payment-failed">
          {() => (
            <div dir={isRTL(language) ? 'rtl' : 'ltr'} className="min-h-[100dvh] flex flex-col items-center justify-center bg-white text-black px-6 text-center gap-4">
              <h1 className="text-2xl font-semibold">{language === 'he' ? 'התשלום לא הושלם' : 'Payment not completed'}</h1>
              <p className="text-black/60 max-w-md">{language === 'he' ? 'התשלום לא הושלם. אם חויבת, פנה לתמיכה. אפשר לנסות שוב.' : 'Your payment was not completed. If you were charged, please contact support. You can try again.'}</p>
              <a href="/" className="rounded-lg bg-[#047857] text-white px-5 py-2.5 text-sm font-medium">{language === 'he' ? 'חזרה לדף הבית' : 'Back to home'}</a>
            </div>
          )}
        </Route>
        <Route path="/e-gifts">
          {() => <EGift />}
        </Route>
        
        <Route path="/vouchers">
          {() => <Vouchers />}
        </Route>
        
        {/* ⁦PetWash™⁩ 2025 Global Architecture - Octopus Model Routes */}
        <Route path="/hub">
          {() => <Hub />}
        </Route>
        {/* /stations previously rendered a dead mock (empty hardcoded list — the
            "all stations" button showed nothing). Redirect to /locations, the
            real page that fetches GET /api/public/stations + shows Kfar Saba. */}
        <Route path="/stations">{() => <Redirect to={`/locations${window.location.search}`} />}</Route>
        <Route path="/shop">
          {() => import.meta.env.VITE_SHOP_LIVE_ENABLED === 'true'
            ? <ShopStore language={language} onLanguageChange={handleLanguageChange} />
            : <Shop />}
        </Route>
        <Route path="/shop/orders">
          {() => import.meta.env.VITE_SHOP_LIVE_ENABLED === 'true'
            ? <ShopOrders language={language} onLanguageChange={handleLanguageChange} />
            : <Shop />}
        </Route>
        <Route path="/booking">
          {() => (
            <RequireAuth>
              <BookingUnified />
            </RequireAuth>
          )}
        </Route>
        <Route path="/booking/confirmation/:requestId">
          {() => (
            <RequireAuth>
              <BookingConfirmation />
            </RequireAuth>
          )}
        </Route>
        <Route path="/booking/new/pet_taxi/:providerId">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/booking/new/:serviceType/:providerId">
          {() => (
            <RequireAuth>
              <MultiPetBookingWizard />
            </RequireAuth>
          )}
        </Route>
        <Route path="/map">
          {() => <Layout><StationMap /></Layout>}
        </Route>
        
        {/* Company Pages */}
        <Route path="/story">
          {() => <Layout><Story /></Layout>}
        </Route>
        <Route path="/media">
          {() => <Layout><Media /></Layout>}
        </Route>
        <Route path="/careers">
          {() => <Layout><Careers /></Layout>}
        </Route>
        <Route path="/careers/my-applications">
          {() => (
            <RequireAuth>
              <MyApplications />
            </RequireAuth>
          )}
        </Route>
        <Route path="/admin/hr">
          {() => (
            <RoleProtectedRoute minRole="management">
              <HRAdminDashboard />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/admin/jobs">
          {() => (
            <RoleProtectedRoute minRole="management">
              <JobManagement />
            </RoleProtectedRoute>
          )}
        </Route>
        
        {/* Support & Status */}
        <Route path="/support">
          {() => <Support />}
        </Route>
        {/* PR-NAV-2: canonical /status (deduped — see removal below near /service-status) */}
        <Route path="/status">
          {() => <SystemStatus />}
        </Route>
        {/* PR-NAV-2: /system-status alias so menu links resolve to the same page */}
        <Route path="/system-status">
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
        {/* /legal/terms previously rendered an OLD generation Terms page (ipapi
            language fetch, no accept gate) while the canonical CustomerTerms
            (sidebar + I-Accept, CEO mockup #4) sat at /legal/customer-terms —
            found live 2026-07-23. ONE terms page now. */}
        <Route path="/legal/terms">
          {() => <LegalCustomerTerms />}
        </Route>
        <Route path="/legal/privacy">
          {() => <Layout><LegalPrivacyPolicy /></Layout>}
        </Route>
        <Route path="/legal/egift-policy">
          {() => <Layout><EGiftPolicy /></Layout>}
        </Route>
        <Route path="/legal/loyalty-terms">
          {() => <Layout><LoyaltyTermsPage /></Layout>}
        </Route>
        <Route path="/legal/cookies">
          {() => <Layout><CookiesPolicy /></Layout>}
        </Route>
        <Route path="/legal/trademarks">
          {() => <Trademarks />}
        </Route>
        {/* PR-NAV-2: redirect to canonical /accessibility (was 1 of 3 split paths) */}
        <Route path="/legal/accessibility">{() => <Redirect to="/accessibility" />}</Route>
        <Route path="/legal/marketplace-terms">
          {() => <MarketplaceTerms />}
        </Route>
        <Route path="/legal/disclaimer">
          {() => <LegalDisclaimer />}
        </Route>
        {/* Legal Routes — Israel 2026 set (draft, pending counsel) */}
        <Route path="/legal/customer-terms">
          {() => <LegalCustomerTerms />}
        </Route>
        <Route path="/legal/provider-agreement">
          {() => <LegalProviderAgreement />}
        </Route>
        <Route path="/legal/cancellation-refund-policy">
          {() => <LegalCancellationRefund />}
        </Route>
        <Route path="/legal/wallet-egift-terms">
          {() => <LegalWalletEGiftTerms />}
        </Route>
        <Route path="/legal/station-use-terms">
          {() => <LegalStationUseTerms />}
        </Route>
        <Route path="/legal/home-access-property-authority">
          {() => <LegalHomeAccess />}
        </Route>
        <Route path="/legal/protection-no-insurance-notice">
          {() => <LegalNoInsuranceNotice />}
        </Route>
        {/* Legal full series — Israel 2026 (draft, pending counsel) */}
        <Route path="/legal">{() => <LegalIndex />}</Route>
        <Route path="/legal/pet-owner-responsibility">{() => <LegalPetOwnerResponsibility />}</Route>
        <Route path="/legal/pet-profile-health-data-notice">{() => <LegalPetProfileHealthDataNotice />}</Route>
        <Route path="/legal/booking-rules">{() => <LegalBookingRules />}</Route>
        <Route path="/legal/emergency-vet-authorisation">{() => <LegalEmergencyVetAuthorisation />}</Route>
        <Route path="/legal/reviews-content-policy">{() => <LegalReviewsContentPolicy />}</Route>
        <Route path="/legal/community-guidelines">{() => <LegalCommunityGuidelines />}</Route>
        <Route path="/legal/support-incident-reporting">{() => <LegalSupportIncidentReporting />}</Route>
        <Route path="/legal/provider-independent-status">{() => <LegalProviderIndependentStatus />}</Route>
        <Route path="/legal/provider-truth-declaration">{() => <LegalProviderTruthDeclaration />}</Route>
        <Route path="/legal/provider-tax-business-declaration">{() => <LegalProviderTaxBusinessDeclaration />}</Route>
        <Route path="/legal/provider-payout-rules">{() => <LegalProviderPayoutRules />}</Route>
        <Route path="/legal/no-circumvention">{() => <LegalNoCircumvention />}</Route>
        <Route path="/legal/provider-confidentiality">{() => <LegalProviderConfidentiality />}</Route>
        <Route path="/legal/provider-incident-reporting">{() => <LegalProviderIncidentReporting />}</Route>
        <Route path="/legal/provider-cancellation">{() => <LegalProviderCancellation />}</Route>
        <Route path="/legal/provider-document-upload">{() => <LegalProviderDocumentUpload />}</Route>
        <Route path="/legal/provider-reconfirmation">{() => <LegalProviderReconfirmation />}</Route>
        <Route path="/legal/provider-insurance-licence">{() => <LegalProviderInsuranceLicence />}</Route>
        <Route path="/legal/provider-brand-use">{() => <LegalProviderBrandUse />}</Route>
        <Route path="/legal/support-protection-policy">{() => <LegalSupportProtectionPolicy />}</Route>
        <Route path="/legal/claim-procedure">{() => <LegalClaimProcedure />}</Route>
        {/* Manuals — Israel 2026 (draft, pending counsel) */}
        <Route path="/manuals/dog-walking">{() => <ManualDogWalking />}</Route>
        <Route path="/manuals/pet-sitting">{() => <ManualPetSitting />}</Route>
        <Route path="/manuals/home-visit">{() => <ManualHomeVisit />}</Route>
        <Route path="/manuals/overnight-sitting">{() => <ManualOvernightSitting />}</Route>
        <Route path="/manuals/grooming">{() => <ManualGrooming />}</Route>
        <Route path="/manuals/training">{() => <ManualTraining />}</Route>
        <Route path="/manuals/incident-reporting">{() => <ManualIncidentReporting />}</Route>
        <Route path="/manuals/provider-support">{() => <ManualProviderSupport />}</Route>

        {/* Protected route - ID Verification */}
        <Route path="/verify">
          {() => (
            <RequireAuth>
              <Verify />
            </RequireAuth>
          )}
        </Route>
        
        {/* Protected route - Inbox (unified luxury inbox: Messages + Concierge + Alerts) */}
        <Route path="/inbox">
          {() => (
            <RequireAuth>
              <PetWashInbox />
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
        <Route path="/pets/:petId/passport">
          {() => (
            <RequireAuth>
              <PetPassport />
            </RequireAuth>
          )}
        </Route>
        {/* Pet Owner / Passport / Consent — Phase 1 (2026-06-20) */}
        <Route path="/pets/:petId/care">
          {() => (
            <RequireAuth>
              <PetCareProfile />
            </RequireAuth>
          )}
        </Route>
        <Route path="/pets/:petId/documents">
          {() => (
            <RequireAuth>
              <PetDocuments />
            </RequireAuth>
          )}
        </Route>
        <Route path="/consent-center">
          {() => (
            <RequireAuth>
              <ConsentCenter />
            </RequireAuth>
          )}
        </Route>
        <Route path="/notification-preferences">
          {() => (
            <RequireAuth>
              <NotificationPreferencesScreen />
            </RequireAuth>
          )}
        </Route>
        <Route path="/pets">
          {() => (
            <RequireAuth>
              <Pets />
            </RequireAuth>
          )}
        </Route>

        {/* PR-PET-4 — pet onboarding luxury shell (immersive). */}
        {/* Feature flag: VITE_PET_ONBOARDING_SHELL_ENABLED='true' required. */}
        {/* Default off → production users see no change. */}
        {/* Local-state only, no backend persistence, no schema writes. */}
        {import.meta.env.VITE_PET_ONBOARDING_SHELL_ENABLED === 'true' && (
          <Route path="/onboarding/pet/:step?">
            {() => (
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <PetOnboardingShell />
                </Suspense>
              </RequireAuth>
            )}
          </Route>
        )}


        {/* SEO SERVICE LANDING PAGES — /services/dog-walking, /services/pet-sitting/tel-aviv, etc. */}
        <Route path="/services/:service/:city">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ServiceLandingPage />
            </Suspense>
          )}
        </Route>
        <Route path="/services/:service">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ServiceLandingPage />
            </Suspense>
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
        
        {/* BOOKING SEARCH - Pet filters, location, dates */}
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
        
        {/* TALENT MARKETPLACE - 7-Platform ⁦PetWash™⁩ Directory */}
        {/* /talent renders hardcoded DEMO sitters (fake names/ratings/prices). Gated OFF
            in production → real marketplace; flag on for demos only. No fake providers to users. */}
        <Route path="/talent">
          {() =>
            import.meta.env.VITE_TALENT_DEMO === 'true' ? (
              <Suspense fallback={<PageLoader />}>
                <TalentMarketplace />
              </Suspense>
            ) : (
              <Redirect to="/marketplace" />
            )
          }
        </Route>

        {/* PLATFORM HUB - Unified Service Discovery */}
        <Route path="/services">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PlatformHub />
            </Suspense>
          )}
        </Route>
        
        {/* PETWASH HQ - Management Control System 2026 */}
        <Route path="/hq">
          {() => (
            <RoleProtectedRoute minRole="management">
              <Suspense fallback={<PageLoader />}>
                <HQManagementPortal />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>

        {/* PETWASH HQ - Classic Octopus Panel (legacy) */}
        {/* RETIRED generation: the classic HQ module's KPI widgets called
            /api/admin/metrics|bookings|talent|invoices — none exist. The live
            overview is the canon Octopus panel. */}
        <Route path="/hq/classic">{() => <Redirect to="/admin/octopus" />}</Route>
        
        {/* UNIFIED MARKETPLACE - Contact-first booking request (must precede :platform/:id) */}
        <Route path="/marketplace/contact/:platform/:id">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <BookingContact />
              </Suspense>
            </RequireAuth>
          )}
        </Route>

        {/* UNIFIED MARKETPLACE - Provider Detail Pages (All Platforms) */}
        {/* MUST be before /marketplace/:platform/:id — that pattern was capturing
            platform="review" and rendering ProviderDetail (shadow-route sweep 2026-07-24). */}
        <Route path="/marketplace/review/:bookingId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <MarketplaceReviewPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        <Route path="/marketplace/:platform/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderDetail />
            </Suspense>
          )}
        </Route>
        
        <Route path="/marketplace/book/pet_trek/:id">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>

        {/* UNIFIED MARKETPLACE - Booking Flow (All legally active platforms) — requires auth to book */}
        <Route path="/marketplace/book/:platform/:id">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <MarketplaceBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        
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
        {/* Specific route MUST precede the :trainerId param route, else wouter
            matches "bookings" as a trainerId and renders the wrong page. */}
        <Route path="/academy/trainer/bookings">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <TrainerBookings />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
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
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <AcademyBookingFlow />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦Pet Wash Academy™⁩ - Trainer Booking Management */}

        {/* Provider join flows: 302-redirect to canonical /provider-onboarding.
            The dedicated forms were non-functional (missing OTP, self-declaration,
            document upload) — they hit /api/provider-onboarding/apply and got
            generic 400 errors. Inbound links (social, banner CTAs, business
            cards) keep working; canonical surface handles all roles via
            multi-select provider type. */}
        <Route path="/join/walker">
          {() => <Redirect to="/provider-onboarding?role=walker" />}
        </Route>
        <Route path="/join/sitter">
          {() => <Redirect to="/provider-onboarding?role=sitter" />}
        </Route>
        <Route path="/join/trainer">
          {() => <Redirect to="/provider-onboarding?role=trainer" />}
        </Route>

        {/* Provider Matching Flow — luxury real-time matching experience.
            DEFAULT OFF: the live matching backend (/ws/match) is not built yet, so the
            screen can only reveal fabricated DEMO_MATCHES providers with "Verified by
            PetWash" pills — fake data must never reach real customers. Until live
            matching ships, /find-provider redirects to the real marketplace (real
            providers). Set VITE_PROVIDER_MATCHING_DEMO='true' to show the demo screen
            for investor walkthroughs only. Nothing links here today (orphan route). */}
        <Route path="/find-provider">
          {() =>
            import.meta.env.VITE_PROVIDER_MATCHING_DEMO === 'true' ? (
              <Suspense fallback={<PageLoader />}>
                <ProviderMatchScreen />
              </Suspense>
            ) : (
              <Redirect to="/marketplace" />
            )
          }
        </Route>

        {/* Flash Deals — provider limited-time discount marketplace */}
        {/* Feature flag: VITE_FLASH_DEALS_ENABLED=true required */}
        {import.meta.env.VITE_FLASH_DEALS_ENABLED === 'true' && (
          <Route path="/flash-deals">
            {() => (
              <Suspense fallback={<PageLoader />}>
                <FlashDeals />
              </Suspense>
            )}
          </Route>
        )}

        {/* Daycare Calculator — Gemini AI smart price calculator */}
        <Route path="/daycare-calculator">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <DaycareCalculator />
            </Suspense>
          )}
        </Route>

        {/* Walk My Pet — provider (walker) surface consolidated into ProviderOS */}
        <Route path="/walk-my-pet/walker/dashboard">{() => <Redirect to="/provider-os" />}</Route>
        
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
        
        {/* ⁦Walk My Pet™⁩ - Browse Alias */}
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
        
        {/* ⁦PetTrek™⁩ - FROZEN: Coming Soon */}
        <Route path="/pettrek/book">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/track/:tripId">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        
        {/* Legacy provider routes — all redirect to /provider-os (canonical provider surface) */}
        <Route path="/provider/dashboard">{() => <Redirect to="/provider-os" />}</Route>
        <Route path="/provider/timeline">{() => <Redirect to="/provider-os" />}</Route>
        <Route path="/provider/console">{() => <Redirect to="/provider-os" />}</Route>

        {/* Provider OS — Full Operating System */}
        <Route path="/provider-os">
          {() => (
            <RoleProtectedRoute minRole="provider">
              {/* PROVIDER-app agreement gate (fail-open, native provider flavor only; web/customer pass-through). */}
              <AppTermsGate flavor="provider" language={language}>
                <Suspense fallback={<PageLoader />}>
                  <ProviderOS />
                </Suspense>
              </AppTermsGate>
            </RoleProtectedRoute>
          )}
        </Route>

        {/* Luxury provider home — dark rollout, reachable for preview */}
        <Route path="/provider/home">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderHome />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>

        {/* Job detail — accept/decline → start → complete → care notes (spec §8 screens 15–18) */}
        <Route path="/provider/jobs/:requestId">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderJobDetail />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>

        {/* Host Stay care journey — owner care pack + provider readiness + handover.
            Party-aware inside the component; any authenticated party to the booking. */}
        <Route path="/booking/:requestId/care">
          {(params) => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <HostStayJourney requestId={params.requestId} />
              </Suspense>
            </RequireAuth>
          )}
        </Route>

        {/* Spec §15 route aliases — every spec path resolves to its real surface */}
        <Route path="/provider/account">{() => <Redirect to="/provider-os?m=profile" />}</Route>
        <Route path="/provider/payouts">{() => <Redirect to="/provider/earnings" />}</Route>
        <Route path="/provider/incident">{() => <Redirect to="/provider-os?m=safety" />}</Route>

        {/* ⁦PetTrek™⁩ - ALL FROZEN: Coming Soon */}
        <Route path="/pettrek/provider/dashboard">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/driver/dashboard">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/customer/dashboard">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/explore">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/drivers/:id">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/hub">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/browse">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/booking/:driverId">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
        </Route>
        <Route path="/pettrek/:rest*">
          {() => <PlatformComingSoon platformName="PetTrek™" platformNameHe="PetTrek™" icon={<Car className="h-10 w-10" />} platformKey="PETTREK" descriptionEn="A smarter way to help pets move safely, calmly and with care. We're building PetTrek for future pet travel, transport and care journeys across selected locations — tell us what your pet needs." descriptionHe="דרך חכמה ובטוחה יותר לעזור לחיות מחמד להגיע ממקום למקום. אנחנו בונים את PetTrek כדי לתמוך בנסיעות, הובלה וליווי של חיות מחמד באזורים נבחרים — ספרו לנו מה חיית המחמד שלכם צריכה." interestOptions={[{ value: 'pet_transport', en: 'Pet transport', he: 'הסעת חיות מחמד' }, { value: 'vet_transport', en: 'Vet visit transport', he: 'הסעה לווטרינר' }, { value: 'relocation', en: 'Airport / relocation', he: 'שדה תעופה / מעבר דירה' }, { value: 'travel', en: 'Pet-friendly travel', he: 'נסיעה ידידותית לחיות' }, { value: 'emergency', en: 'Emergency pickup', he: 'איסוף חירום' }, { value: 'not_sure', en: 'Not sure — keep me updated', he: 'לא בטוח/ה — עדכנו אותי' }]} />}
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
        
        {/* The Sitter Suite — sitter (provider) surface consolidated into ProviderOS */}
        <Route path="/sitter-suite/sitter/dashboard">{() => <Redirect to="/provider-os" />}</Route>
        
        {/* ⁦The Sitter Suite™⁩ - Sitter Edit Profile (with Photo Upload) */}
        <Route path="/sitter-suite/sitter/edit-profile">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <SitterEditProfile />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Platform Overview (Marketing/Gateway).
            The /overview alias is mounted FIRST so a direct /sitter-suite/overview
            URL (referenced historically from menus, marketing emails, and the
            original bug report) resolves to the SitterSuiteOverview page instead
            of falling through to a 404. /sitter-suite remains the canonical path. */}
        <Route path="/sitter-suite/overview">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuiteOverview />
            </Suspense>
          )}
        </Route>
        <Route path="/sitter-suite">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuiteOverview />
            </Suspense>
          )}
        </Route>
        {/* A5 audit follow-up: /sitters was a dead 404 (linked externally & typed
            by hand). Vanity alias → the Sitter Suite overview. */}
        <Route path="/sitters">{() => <Redirect to="/sitter-suite" />}</Route>

        {/* ⁦The Sitter Suite™⁩ - Browse/Explore Sitters */}
        <Route path="/sitter-suite/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SitterSuite />
            </Suspense>
          )}
        </Route>
        
        {/* ⁦The Sitter Suite™⁩ - Browse Alias */}
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
        
        {/* Contractor Dashboard — consolidated into ProviderOS */}
        <Route path="/contractor/dashboard">{() => <Redirect to="/provider-os" />}</Route>
        
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
        
        {/* Grooming Marketplace - Provider Dashboard — consolidated into ProviderOS */}
        <Route path="/groomers/provider/dashboard">{() => <Redirect to="/provider-os" />}</Route>
        
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
        {/* MUST be before /groomers/:id — the parametric route was capturing
            "hub" and rendering GroomerDetail (shadow-route sweep 2026-07-24). */}
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

        <Route path="/groomers/:id">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GroomerDetail />
            </Suspense>
          )}
        </Route>
        
        
        {/* K9000 Wash Stations - Specific routes BEFORE general routes */}
        {/* K9000 Wash Stations - Self-Service Bay Status + Wash Start (real-time, no booking) */}
        <Route path="/k9000/booking/:stationId?">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <K9000BayStatus />
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
        
        {/* K9000 Wash Stations - Browse/Explore Stations (future - for now redirect to overview) */}
        <Route path="/k9000/explore">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <K9000Overview />
            </Suspense>
          )}
        </Route>
        
        {/* K9000 Wash Stations - Bay Status hub (same view as /k9000/booking) */}
        <Route path="/k9000/hub">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <K9000BayStatus />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        
        <Route path="/grooming-feedback">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <GroomingFeedback />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        <Route path="/grooming-reviews">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <GroomingReviews />
            </Suspense>
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
        {/* Stale reference: PushNotificationTest component does not exist in repo. Route removed to fix TS2304. */}

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
        
        {/* Admin route - CEO Daily Report + eGift Intelligence (read-only) */}
        <Route path="/admin/ceo-report">
          {() => (
            <AdminRouteGuard>
              <AdminCeoReport />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Admin route - Loyalty Rules & Analytics */}
        <Route path="/admin/loyalty">
          {() => (
            <AdminRouteGuard>
              <AdminLoyaltyRules />
            </AdminRouteGuard>
          )}
        </Route>

        {/* CEO sets the homepage wash packages + prices himself (no code deploy) */}
        <Route path="/admin/wash-packages">
          {() => (
            <AdminRouteGuard>
              <AdminWashPackages />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Control Tower - Payments ledger view (SUMIT/uPay/Nayax/wallet) */}
        <Route path="/admin/payments">
          {() => (
            <AdminRouteGuard>
              <AdminPaymentsControl />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Smart Admin Panel - unified Applications Dashboard (risk-scored queue) */}
        <Route path="/admin/applications">
          {() => (
            <AdminRouteGuard>
              <AdminApplicationsDashboard />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Smart Admin Panel - Senior/Disability discount review */}
        <Route path="/admin/member-discounts">
          {() => (
            <AdminRouteGuard>
              <AdminMemberDiscounts />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Control Tower - Provider per-service approval ladder */}
        <Route path="/admin/providers">
          {() => (
            <AdminRouteGuard>
              <AdminProviderControl />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Control Tower - Customer detail (overview/consents/notifications/payments) */}
        <Route path="/admin/customers/:id">
          {() => (
            <AdminRouteGuard>
              <AdminCustomerDetail />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Control Tower - K9000 bay control (status / fault / Nayax link) */}
        <Route path="/admin/bays">
          {() => (
            <AdminRouteGuard>
              <AdminBayControl />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Control Tower - Alerts Center ("what needs attention") */}
        <Route path="/admin/alerts">
          {() => (
            <AdminRouteGuard>
              <AdminAlertsCenter />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Provider full identity verification — manual matching checklist (by applicationId) */}
        <Route path="/admin/provider-verification/:id">
          {() => (
            <AdminRouteGuard>
              <AdminProviderVerification />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Admin route - Retention & Reviews (Winback §27 + Review Engine §26, read-only) */}
        <Route path="/admin/retention">
          {() => (
            <AdminRouteGuard>
              <AdminRetention />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Live Ops review screen — all-platform bookings + KPIs + alerts. */}
        {/* NOT feature-flagged: the CEO's "one place to review everything". */}
        <Route path="/admin/live-ops">
          {() => (
            <AdminRouteGuard>
              <AdminLiveOps />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Octopus Control Panel — the ONE admin overview (real SQL, curated links). */}
        <Route path="/admin/octopus">
          {() => (
            <AdminRouteGuard>
              <AdminOctopus />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/shop-products">
          {() => (
            <AdminRouteGuard>
              <AdminShopProducts />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/bookkeeping">
          {() => (
            <AdminRouteGuard>
              <AdminBookkeeping />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/staff">
          {() => (
            <AdminRouteGuard>
              <AdminStaff />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Nayax / K9000 events — Tower Control reconciliation + manual report import. */}
        <Route path="/admin/nayax-events">
          {() => (
            <AdminRouteGuard>
              <AdminNayaxEvents />
            </AdminRouteGuard>
          )}
        </Route>

        {/* PetWash Bridge MVP — read-only operator cockpit. */}
        {/* Feature flag: VITE_BRIDGE_MVP_ENABLED='true' required. */}
        {import.meta.env.VITE_BRIDGE_MVP_ENABLED === 'true' && (
          <Route path="/admin/bridge">
            {() => (
              <AdminRouteGuard>
                <PetWashBridge />
              </AdminRouteGuard>
            )}
          </Route>
        )}

        {/* Admin route - Fraud Monitoring Dashboard */}
        <Route path="/admin/fraud-dashboard">
          {() => (
            <AdminRouteGuard>
              <FraudDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        
        {/* Admin route - Provider Applications Review Dashboard */}
        {/* Legacy provider-review screen read the OLD provider_applicants table
            (empty of new applications — which is why apps "disappeared" from admin)
            and its approve actions hit that table. New applications live in the
            canonical provider_applications table, surfaced by the /admin/applications
            triage queue → /admin/providers approve flow. Redirect staff there so
            they always land on the queue that actually shows real applications.
            (Provider onboarding two-table consolidation, slice 2, 2026-07-12.) */}
        <Route path="/admin/provider-review">
          {() => <Redirect to="/admin/applications" />}
        </Route>

        {/* Admin KYC review — single application deep-dive */}
        <Route path="/admin/providers/review/:applicationId">
          {(params) => (
            <AdminRouteGuard>
              <ProviderKycReview />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Management KYC analytics dashboard — read-only aggregate metrics */}
        <Route path="/admin/providers/analytics">
          {() => (
            <AdminRouteGuard>
              <ManagementKycDashboard />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Applicant: check own application status */}
        <Route path="/provider-application/status">
          {() => <RequireAuth><ProviderApplicationStatus /></RequireAuth>}
        </Route>

        {/* Provider Protection Book — sign required declarations (epic #49) */}
        <Route path="/provider-declarations">
          {() => <RequireAuth><ProviderDeclarations /></RequireAuth>}
        </Route>
        <Route path="/admin/compliance-control-tower">{() => <Redirect to="/pet-wash-ltd/executive/compliance" />}</Route>

        <Route path="/admin/ops-monitor">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<div />}>
                <AdminOpsMonitor />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>

        <Route path="/admin/treasury">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<div />}>
                <AdminTreasurySettings />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>

        <Route path="/admin/system-config">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<div />}>
                <AdminSystemConfig />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>

        {/* Route /admin/operating-control temporarily removed (hotfix).
            Pairs with the commented-out AdminOperatingControl lazy import
            above. Restore both together once AdminOperatingControl.tsx
            actually ships in a committed file. Until then, visitors to
            /admin/operating-control fall through to the catch-all 404
            handler — better than a build failure that blocks every
            deploy in the pipeline. */}

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
        
        {/* Phase 10 — Station operator daily dashboard */}
        <Route path="/station/:stationId/dashboard">
          {() => (
            <RequireAuth>
              <StationMembershipGuard>
                <StationDashboard />
              </StationMembershipGuard>
            </RequireAuth>
          )}
        </Route>

        {/* Phase 10 — Dispute detail (linked from station dashboard) */}
        <Route path="/disputes/:disputeId">
          {() => (
            <RequireAuth>
              <DisputeDetail />
            </RequireAuth>
          )}
        </Route>

        {/* Franchise routes - Protected (franchise_owner+ only) */}
        <Route path="/franchise/dashboard">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseManagementDashboard />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/:franchiseId/dashboard">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseOwnerDashboard />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/:franchiseId/stations/:stationId/settlements">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseStationSettlements />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/company/dashboard">
          {() => (
            <RoleProtectedRoute minRole="management">
              <CompanyHQDashboard />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/company/stations/:stationId/settlements">
          {() => (
            <RoleProtectedRoute minRole="management">
              <CompanyStationSettlements />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/booking-trace/:bookingId">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <BookingTrace />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/case-queue">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <CaseQueue />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/manager">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <Suspense fallback={<PageLoader />}>
                <ManagerDashboard />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/governance">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <Suspense fallback={<PageLoader />}>
                <Layout><GovernancePolicies /></Layout>
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/inbox">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseInbox />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/reports">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseReports />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/support">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseSupport />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/franchise/marketing">
          {() => (
            <RoleProtectedRoute minRole="franchise_owner">
              <FranchiseMarketing />
            </RoleProtectedRoute>
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
            <RoleProtectedRoute minRole="management">
              <ApproveExpenses />
            </RoleProtectedRoute>
          )}
        </Route>

        {/* Supplier-invoice screening (PR #370 + #375) admin pages */}
        <Route path="/admin/no-lost-money">
          {() => (
            <AdminRouteGuard>
              <AdminNoLostMoney />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/reminder-preview">
          {() => (
            <AdminRouteGuard>
              <AdminReminderPreview />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/supplier-invoices">
          {() => (
            <AdminRouteGuard>
              <AdminSupplierInvoices />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/supplier-invoices/:id">
          {() => (
            <AdminRouteGuard>
              <AdminSupplierInvoiceDetail />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/suppliers">
          {() => (
            <AdminRouteGuard>
              <AdminSuppliers />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/identity-merge">
          {() => (
            <AdminRouteGuard>
              <AdminIdentityMerge />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/suppliers/:id">
          {() => (
            <AdminRouteGuard>
              <AdminSupplierDetail />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/sumit">
          {() => (
            <AdminRouteGuard>
              <AdminSumitControl />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/accountant">
          {() => (
            <AdminRouteGuard>
              <AccountantQueue />
            </AdminRouteGuard>
          )}
        </Route>

        {/* Provider self-service — Mission-7 */}
        <Route path="/provider/my-invoices">
          {() => <ProviderMyInvoices />}
        </Route>

        {/* Staff Onboarding & Fraud Prevention */}
        <Route path="/careers/apply">
          {() => <StaffApplication />}
        </Route>
        
        <Route path="/admin/staff-onboarding">
          {() => (
            <RoleProtectedRoute minRole="management">
              <StaffOnboarding />
            </RoleProtectedRoute>
          )}
        </Route>
        
        {/* Common routes available to all users */}
        <Route path="/about">{() => <About language={language} />}</Route>
        <Route path="/trust">{() => <TrustCompliance language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/trust-safety">{() => <TrustSafety language={language} onLanguageChange={handleLanguageChange} />}</Route>
        {/* Public business-model / comparison pages — withdrawn from public navigation.
            Old bookmarks land on the homepage instead. The page components remain in the
            codebase for internal pitch/investor use only. */}
        <Route path="/divisions">{() => <Redirect to="/" />}</Route>
        <Route path="/platform">{() => <Redirect to="/" />}</Route>
        <Route path="/showcase">{() => <Redirect to="/" />}</Route>
        <Route path="/service-status">{() => <ServiceStatus language={language} />}</Route>
        {/* PR-NAV-2: removed duplicate /status registration (was unreachable — wouter takes first match at the SystemStatus route above) */}
        <Route path="/paw-finder">{() => <Layout language={language} onLanguageChange={handleLanguageChange}><PawFinder language={language} /></Layout>}</Route>
        <Route path="/adoption">{() => <Layout language={language} onLanguageChange={handleLanguageChange}><AdoptionMaison /></Layout>}</Route>
        <Route path="/find-pet">{() => <Layout language={language} onLanguageChange={handleLanguageChange}><PawFinder language={language} /></Layout>}</Route>
        <Route path="/lost-pet">{() => <Layout language={language} onLanguageChange={handleLanguageChange}><PawFinder language={language} /></Layout>}</Route>
        <Route path="/franchise">{() => <Franchise language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/franchise-opportunities">{() => <Redirect to="/franchise" />}</Route>
        <Route path="/backend-team">
          {() => (
            <RoleProtectedRoute minRole="management">
              <BackendTeam />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/locations">{() => <Layout><Locations /></Layout>}</Route>
        <Route path="/follow">{() => <Follow />}</Route>
        <Route path="/stations/:slug">{(params) => <StationPage slug={params.slug} />}</Route>
        <Route path="/wallet/redeem">
          {() => (
            <RequireAuth>
              <K9000Redeem />
            </RequireAuth>
          )}
        </Route>
        <Route path="/wallet">{() => <WalletDownload />}</Route>
        <Route path="/my-wallet">
          {() => (
            <RequireAuth>
              <MyWallet />
            </RequireAuth>
          )}
        </Route>
        <Route path="/my-coupons">
          {() => (
            <RequireAuth>
              <UserCoupons />
            </RequireAuth>
          )}
        </Route>
        <Route path="/my-account">
          {() => (
            <RequireAuth>
              <RouteErrorBoundary routeName="/my-account">
                <Suspense fallback={<PageLoader />}>
                  {/* ProfileV2 (luxury account hub) behind a flag; legacy MyAccount is the default + deep-edit target. */}
                  {import.meta.env.VITE_PROFILE_V2_ENABLED === 'true' ? <ProfileV2 /> : <MyAccount />}
                </Suspense>
              </RouteErrorBoundary>
            </RequireAuth>
          )}
        </Route>
        <Route path="/packages">{() => <Packages />}</Route>
        <Route path="/discount-application">{() => <DiscountApplication />}</Route>

        {/* Hebrew routes - חבילות */}
        <Route path="/he/חבילות">{() => <Packages />}</Route>
        <Route path="/he/packages">{() => <Packages />}</Route>
        <Route path="/company-reports">
          {() => (
            <RoleProtectedRoute minRole="management">
              <CompanyReports />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/reports">
          {() => (
            <RoleProtectedRoute minRole="management">
              <CompanyReports />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/investor-presentation">
          {() => (
            <RoleProtectedRoute minRole="management">
              <InvestorPresentation />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/pitch">
          {() => (
            <RoleProtectedRoute minRole="management">
              <InvestorPresentation />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/investors">
          {() => (
            <RoleProtectedRoute minRole="management">
              <InvestorPresentation />
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/our-service">{() => <OurService language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/contact">{() => <Contact language={language} />}</Route>
        <Route path="/forms" component={FormsHub} />
        <Route path="/forms/review" component={ReviewForm} />
        <Route path="/forms/hr-application" component={HRApplicationForm} />
        <Route path="/forms/sales-lead" component={SalesLeadForm} />
        <Route path="/forms/onboarding" component={CustomerOnboardingForm} />
        <Route path="/forms/refund" component={RefundForm} />
        {/* Consolidated 2026-06-18: the separate club-registration form was a THIRD
            loyalty signup (its own endpoint). Redirect to the canonical loyalty join. */}
        <Route path="/forms/club">{() => <Redirect to="/loyalty/join" />}</Route>
        {/* /forms/provider was a dead-end form (posted to a no-approval endpoint, no KYC).
            Redirect to the canonical KYC onboarding so nobody submits into a black hole. */}
        <Route path="/forms/provider" component={LegacyProviderRouteRedirect} />
        <Route path="/forms/booking" component={QuickBookingForm} />
        <Route path="/forms/legal" component={LegalAgreementForm} />
        <Route path="/gallery">{() => <Gallery language={language} onLanguageChange={handleLanguageChange} />}</Route>
        <Route path="/privacy">{() => <Redirect to="/privacy-policy" />}</Route>
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/account-deletion" component={AccountDeletionResource} />
        <Route path="/terms" component={Terms} />
        <Route path="/platform-legal">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <PlatformLegalFramework />
            </Suspense>
          )}
        </Route>
        <Route path="/become-provider">
          {() => {
            // Issue #153 PR-BPV-1 — Become Provider straight-through.
            // BEFORE: this handler unconditionally returned a Redirect to
            // /sign-in?redirect=/provider-onboarding for EVERY visitor,
            // including signed-in users. The /sign-in chrome flashed,
            // then SignIn forwarded back to /provider-onboarding, then
            // the post-login decider race (V3 in diagnostic 4404078588)
            // overwrote that to /home. The result on iPhone Safari was
            // "Become Provider appears for ~1s then disappears."
            // AFTER: branch on auth state — signed-in users redirect
            // directly to /provider-onboarding (no /sign-in detour),
            // anonymous users still get the SignIn flow with the
            // canonical ?redirect= param. Routing-only fix; no auth
            // contract change, no whoami change, no schema, no money.
            return <BecomeProviderRedirect />;
          }}
        </Route>
        <Route path="/provider-onboarding">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <ProviderOnboarding />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        <Route path="/apply-provider">
          {() => <LegacyProviderRouteRedirect />}
        </Route>
        <Route path="/join-team">
          {() => <LegacyProviderRouteRedirect />}
        </Route>
        <Route path="/providers">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderListings />
            </Suspense>
          )}
        </Route>
        <Route path="/providers/search">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <ProviderSearchPage />
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
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderCompliance />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/provider/bookings">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderBookingsDashboard />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/provider/tasks">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderTaskInbox />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/provider/feedback">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderFeedbackDashboard />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/admin/marketplace-intelligence">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <MarketplaceIntelligenceDashboard />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/live-events">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminLiveEvents />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/provider/ranking">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderRankingPanel />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>

        <Route path="/report-problem/:bookingId">
          {() => (
            <RequireAuth>
              <Suspense fallback={<PageLoader />}>
                <ReportProblemPage />
              </Suspense>
            </RequireAuth>
          )}
        </Route>
        <Route path="/provider/earnings">
          {() => (
            <RoleProtectedRoute minRole="provider">
              <Suspense fallback={<PageLoader />}>
                <ProviderEarningsPage />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/accounting">
          {() => (
            <RoleProtectedRoute minRole="staff">
              <Suspense fallback={<PageLoader />}>
                <AccountingDashboard />
              </Suspense>
            </RoleProtectedRoute>
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
            <RoleProtectedRoute minRole="management">
              <Suspense fallback={<PageLoader />}>
                <MobileManagementDashboard />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        <Route path="/octopus-brain">
          {() => (
            <RoleProtectedRoute minRole="management">
              <Suspense fallback={<PageLoader />}>
                <MobileManagementDashboard />
              </Suspense>
            </RoleProtectedRoute>
          )}
        </Route>
        {/* PR-NAV-2: /accessibility is the canonical accessibility page (footer + navigationStructure already use this path) */}
        <Route path="/accessibility" component={Accessibility} />
        {/* PR-NAV-2: redirect to canonical /accessibility (was 1 of 3 split paths) */}
        <Route path="/accessibility-statement">{() => <Redirect to="/accessibility" />}</Route>
        
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

        {/* Phase 12.15 — Executive Oversight & Network Health */}
        <Route path="/pet-wash-ltd/executive/oversight">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <NetworkOversight />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        {/* Phase 12.16 — Financial Governance & Approval Controls */}
        <Route path="/financial-approvals">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <FinancialApprovals />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        {/* Phase 12.17 — Cash Reconciliation & Treasury Discipline */}
        <Route path="/treasury">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['super_admin', 'finance', 'ceo']}>
              <Suspense fallback={<PageLoader />}>
                <Treasury />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        {/* Phase 12.18 — Forecasting, Liquidity & Reserve Planning */}
        <Route path="/treasury/forecast">
          {() => (
            <ExecutiveSuiteGuard requiredRoles={['super_admin', 'finance', 'ceo']}>
              <Suspense fallback={<PageLoader />}>
                <TreasuryForecast />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        <Route path="/finance/profitability">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <FinanceProfitability />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        <Route path="/finance/board-pack">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <BoardPack />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>

        <Route path="/finance/interventions">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <Interventions />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        <Route path="/finance/outcomes">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <Outcomes />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        <Route path="/finance/policy">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <PolicyFeedback />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        <Route path="/finance/policy-rollout">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <PolicyRollout />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        <Route path="/finance/optimizer">
          {() => (
            <ExecutiveSuiteGuard>
              <Suspense fallback={<PageLoader />}>
                <Optimizer />
              </Suspense>
            </ExecutiveSuiteGuard>
          )}
        </Route>
        
        {/* Admin routes - /admin redirects to /admin/login-v2 for unauthenticated users */}
        {/* Admin front door = the clean canon Octopus panel (real-SQL overview).
            The AdminRouteGuard bounces signed-out users to the login. */}
        <Route path="/admin">{() => <Redirect to="/admin/octopus" />}</Route>
        <Route path="/admin/login" component={AdminLoginV2} />
        <Route path="/admin/backend">
          {() => (
            <AdminRouteGuard>
              <AdminBackendPanel />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/social">
          {() => (
            <AdminRouteGuard>
              <AdminSocialGrowth />
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
        <Route path="/admin/financial-monitor">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <GeminiFinancialMonitor />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/paw-finder">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <PawFinderAdmin />
              </Suspense>
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
        <Route path="/admin/coupons">
          {() => (
            <AdminRouteGuard>
              <AdminCoupons />
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
        <Route path="/admin/chat-risk">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminChatRisk />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/brain">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <BrainDashboard />
              </Suspense>
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
        <Route path="/admin/fault-intel">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminFaultIntel />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/reconfirmation">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminReconfirmation />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/staff-academy">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminStaffAcademy />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/expansion-marketing">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminExpansionMarketing />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/stock-reports">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminStockReports />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/support-incident">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminSupportIncident />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/buildings-partners">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminBuildingsPartners />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/stations/:stationId/timeline">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <StationTimeline />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/bays/:bayId/timeline">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <BayTimeline />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/stations/:stationId/bays">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminBayMap />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/stations/:stationId/commands">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminCommandLog />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/compensation">
          {() => (
            <AdminRouteGuard>
              <Suspense fallback={<PageLoader />}>
                <AdminCompensation />
              </Suspense>
            </AdminRouteGuard>
          )}
        </Route>
        {/* RETIRED generation: AdminUsers called /api/admin/users list/update/
            delete — endpoints that never existed (its buttons could never
            work). The live user-management surface is /admin/customers. */}
        <Route path="/admin/users">{() => <Redirect to="/admin/customers" />}</Route>
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
        {/* Was a DUPLICATE of /admin/suppliers (unreachable — wouter matches the
            first registration). The enterprise ERP suppliers view now has its
            own path. */}
        <Route path="/admin/suppliers-erp">
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
        {/* Was a DUPLICATE of /admin/hr (unreachable — first registration wins,
            and the reachable one is the management-gated HRAdminDashboard). The
            enterprise ERP HR view lives on its own path now. */}
        <Route path="/admin/hr-erp">
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
        <Route path="/admin/wallet-finance">
          {() => (
            <AdminRouteGuard>
              <AdminWalletDashboard />
            </AdminRouteGuard>
          )}
        </Route>
        <Route path="/admin/money-flow">
          {() => (
            <AdminRouteGuard>
              <MoneyFlow language={language} />
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
        <Route path="/admin/deadlines">
          {() => (
            <AdminRouteGuard>
              <AdminDeadlines />
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
          {() => (
            <AdminRouteGuard>
              <FranchiseManagementDashboard />
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
        <Route path="/wash/qr" component={QrActivatePage} />
        <Route path="/buy-gift-card">
          {() => <BuyGiftCard language={language} onLanguageChange={handleLanguageChange} />}
        </Route>
        <Route path="/claim">
          {() => <ClaimVoucher />}
        </Route>
        <Route path="/ops-dashboard">
          {() => (
            <RoleProtectedRoute minRole="management">
              <OpsDashboard language={language} onLanguageChange={handleLanguageChange} />
            </RoleProtectedRoute>
          )}
        </Route>
        {/* Maya Stage 2 — admin UI (all behind RoleProtectedRoute + ff.maya.* server-side) */}
        <Route path="/admin/maya">
          <RoleProtectedRoute minRole="staff">
            <AdminMaya />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/inbox">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaInbox />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/conversations/:id">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaConversationDetail />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/leads">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaLeads />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/provider-drafts">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaProviderDrafts />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/booking-drafts">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaBookingDrafts />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/tasks">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaTasks />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/escalations">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaEscalations />
          </RoleProtectedRoute>
        </Route>
        <Route path="/admin/maya/audit">
          <RoleProtectedRoute minRole="staff">
            <AdminMayaAudit />
          </RoleProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [location] = useLocation();
  // Default to Hebrew ('he') for Israeli market - PRIMARY language
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('petwash_lang') as Language;
    return saved && ['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(saved) ? saved : 'he';
  });
  const [isLanguageInitialized, setIsLanguageInitialized] = useState(false);
  const [isConsentManagerOpen, setIsConsentManagerOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Let any screen open the AI Concierge (e.g. the unified inbox's Concierge tab).
  useEffect(() => {
    const open = () => setIsAIChatOpen(true);
    window.addEventListener('petwash:open-concierge', open);
    return () => window.removeEventListener('petwash:open-concierge', open);
  }, []);

  // Route-aware suppression: promo popup and floating FABs must not show on
  // functional/operational pages — only on public marketing pages.
  const [currentPath] = useLocation();

  // Regex pattern covering all non-marketing route prefixes.
  // The promo popup must never auto-open on functional, auth, or operational pages.
  //
  // Issue #148 P3: this hand-maintained regex matches `/provider/*` (with
  // slash) but missed `/provider-onboarding`, `/become-provider`, `/join*`,
  // and `/verify-email` (no slash separator after the prefix). On those
  // sticky onboarding routes the z-9999 popup mounted on top of the form
  // and blocked the bottom-edge "Complete" CTAs on iPhone Safari. We now
  // additionally consult the canonical sticky-account-paths list so any
  // route added there is automatically suppressed here too — no more drift.
  // PR-SHELL-IMMERSIVE: shell-chrome suppression collapsed to ONE canonical
  // boundary. isImmersiveRoute() is the authoritative answer to "should the
  // global shell chrome be hidden on this route?" — replacing the four
  // four drifting lists (the legacy MobileBottomNav prefix list, two App.tsx
  // regex exclude patterns, and the sticky-account-paths fallback) that the
  // CEO's screenshot showed leaking the bottom nav into KYC/onboarding.
  //
  // Non-immersive admin / dashboard / booking pages still need the marketing
  // popup suppressed — they're not auth flows but they're also not where
  // we want a "Welcome to Pet Wash!" splash. PROMO_OPERATIONAL_PATTERN
  // captures that broader operational-page suppression. floating widgets
  // (WhatsApp / AI / accessibility) stay visible on operational pages.
  const PROMO_OPERATIONAL_PATTERN =
    /^\/(paw-finder|admin|provider|dashboard|booking|my-account|my-wallet|my-bookings|marketplace\/booking|marketplace\/review|report-problem|payment|control-panel|management|accounting|receipt|ops|ceo|franchise|station|legal-agreement)(\/|$)/;

  const isImmersive = isImmersiveRoute(currentPath);
  // NATIVE APPS ARE NOT THE WEBSITE (CEO 2026-07-02 TestFlight walkthrough): the
  // web marketing promo popup letterboxed itself over the Prestige app on first
  // open — a "website wrapper" leak. Native flavors never see web marketing
  // chrome; the App Store product IS the ad.
  const appFlavor = useAppFlavor();
  const isNativeApp = appFlavor !== 'web';
  const showPromoPopup = !isNativeApp && !isImmersive && !PROMO_OPERATIONAL_PATTERN.test(currentPath);
  // Floating WhatsApp/AI/accessibility FABs are WEBSITE chrome — inside the
  // native apps they float over the CEO's canonical screens (seen live on the
  // simulator 2026-07-23). Web only, same rule as header/footer/promo.
  const showFloatingStack = !isImmersive && !isNativeApp;
  const showMobileNav = !isImmersive;

  // PR-IMMERSIVE-CSS: drive the [data-immersive] attribute on <html> so
  // the keyboard-safe shell CSS in client/src/index.css applies
  // automatically. Single source: isImmersiveRoute() — no per-page
  // hacks. Cleanup runs on every path change AND on unmount so we
  // never leave the attribute set after navigating to a non-immersive
  // page.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (isImmersive) {
      html.setAttribute('data-immersive', 'true');
    } else {
      html.removeAttribute('data-immersive');
    }
    return () => {
      // Be conservative — only clear if WE set it for this route.
      if (isImmersive) html.removeAttribute('data-immersive');
    };
  }, [isImmersive]);

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

    // NOTE (2026-06-28): the old `.pw-float-stack` dedup loop was REMOVED here.
    // `.pw-float-stack` is created ONLY by React's <FloatingStack> (rendered
    // exactly once in this tree), so manually .remove()-ing a "duplicate" could
    // only ever rip a React-owned node out from under the reconciler — the exact
    // react#11538 insertBefore/removeChild "not a child" crash that white-screened
    // the site. The real duplicate (a second <AccessibilityButton>) was deleted in
    // #1117 and the shared DOM ids were made per-instance in #1120, so no second
    // stack is ever rendered. Do NOT reintroduce manual DOM removal of React nodes.

    return cleanupViewport;
  }, []);

  useEffect(() => {
    // Read canonical key (pw_lang) with one-time migration from legacy keys
    let savedLanguage = localStorage.getItem('pw_lang') as Language;
    if (!savedLanguage || !['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(savedLanguage)) {
      const legacy = (localStorage.getItem('petwash_lang') || localStorage.getItem('language')) as Language;
      if (legacy && ['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(legacy)) {
        localStorage.setItem('pw_lang', legacy);
        savedLanguage = legacy;
      }
    }
    if (savedLanguage && ['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(savedLanguage)) {
      setCurrentLanguage(savedLanguage);
      document.documentElement.dir = isRTL(savedLanguage) ? 'rtl' : 'ltr';
      document.documentElement.lang = savedLanguage;
      setIsLanguageInitialized(true);
    } else {
      // No saved preference — show Hebrew temporarily while geo detects
      setCurrentLanguage('he');
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
      setIsLanguageInitialized(true);
    }

    async function detectLanguageInBackground() {
      try {
        const defaultLanguage = await getDefaultLanguageByLocation();
        // getDefaultLanguageByLocation already returns the saved preference when one
        // exists, so this guard is purely a race-condition safety net.
        const currentSaved = localStorage.getItem('pw_lang') as Language;
        
        // Only update if no saved preference exists
        if (!currentSaved || !['he', 'en', 'ar', 'ru', 'fr', 'es'].includes(currentSaved)) {
          setCurrentLanguage(defaultLanguage);
          localStorage.setItem('pw_lang', defaultLanguage);
          document.documentElement.dir = isRTL(defaultLanguage) ? 'rtl' : 'ltr';
          document.documentElement.lang = defaultLanguage;
          
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
          {/* OnboardingChecklist REMOVED 2026-06-26 (CEO): the generic
              "add address / complete first booking / leave review / join loyalty"
              popup is not correct PetWash logic. Post-signup we surface 3 explicit
              cards (Add Pet / Apply Discount / Become Provider), not a checklist. */}
          {showFloatingStack && (
          <FloatingStack 
            language={currentLanguage}
            onAIClick={() => setIsAIChatOpen(true)}
          />
          )}
          
          {/* Google Dialogflow CX AI Chat Widget - Gemini-powered Kenzo 🤖 */}
          {showFloatingStack && (
          <AiChatWidget 
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
          />
          )}
          
          <AuthProvider>
              <ActivationBanner />
              <Router language={currentLanguage} onLanguageChange={(newLang) => {
                setCurrentLanguage(newLang);
                localStorage.setItem('pw_lang', newLang);
                document.documentElement.dir = isRTL(newLang) ? 'rtl' : 'ltr';
                document.documentElement.lang = newLang;
              }} />
              {/* PR Phase A: same gating as OnboardingChecklist above —
                  fixed-position prompt was covering form CTAs on immersive flows. */}
              {!isImmersive && <NotificationPermissionPrompt />}
              {/* PR-SHELL-IMMERSIVE: centralized boundary. Bottom nav must
                  NOT render on auth / onboarding / KYC / verification /
                  loyalty-join routes — the CEO's screenshot showed it
                  bleeding behind the iOS keyboard, capturing taps meant
                  for form fields. */}
              {showMobileNav && <MobileBottomNav />}
          </AuthProvider>
          
          {/* PWA "add to home screen" prompt REMOVED (CEO 2026-06-27): PetWash is a real
              native app installed from the App Store / Google Play, not a Safari home-screen
              shortcut. Customers are routed to the official app via the native iOS Smart App
              Banner (apple-itunes-app meta) + store buttons — never a PWA install card.
              Component file kept as a technical fallback only; intentionally NOT mounted. */}

          {/* <AccessibilityButton> UNMOUNTED (P0, 2026-06-27): wiring it in #1105
              crashed React reconciliation on EVERY page (NotFoundError: insertBefore/
              removeChild "not a child"), white-screening the whole site for all users.
              Verified in a clean prod build: site renders with it removed, crashes with
              it present. Do NOT re-mount until the AccessibilityButton/AccessibilityMenu
              subtree is rebuilt and proven not to corrupt the React tree. The a11y
              <html> class/style logic (high-contrast, large-text, etc.) is fine; the
              crash is in the rendered widget subtree. */}

          {/* GDPR-compliant cookie consent system — WEB ONLY. A browser cookie
              banner inside the native apps is website furniture leaking into a
              different product (CEO two-app spec); the apps collect their own
              consents at signup/onboarding. Same gating as the promo popup. */}
          {!isNativeApp && (
            <CookieConsent
              language={currentLanguage}
              onOpenManager={() => setIsConsentManagerOpen(true)}
            />
          )}
          <ConsentManager 
            language={currentLanguage}
            isOpen={isConsentManagerOpen}
            onClose={() => setIsConsentManagerOpen(false)}
          />

          {/* Marketing promo popup — only on public landing pages, never on functional/operational routes */}
          {showPromoPopup && <PromoAdPopup />}
          
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
