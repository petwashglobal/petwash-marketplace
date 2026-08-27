# Orphan detector report — 2026-08-27

Generated: 2026-08-27T23:21:22.757Z
Total findings: 106

Ran with the improved detector (server/index dynamic-import aware, page detection widened beyond App.tsx).

CEO 2026-08-27 §36: each finding is triaged into one of three buckets — wire it, delete it, or add to ALLOW_INTENTIONAL[] with a comment.

## SERVICE_EXPORT (48)

- `server/services/BiometricSecurityMonitor.ts`
- `server/services/CurrentUVIndexService.ts`
- `server/services/EmergencyWalkService.ts`
- `server/services/GeminiSecurityAdvisor.ts`
- `server/services/GoogleCalendarIntegrationService.ts`
- `server/services/JobExpiryNotificationService.ts`
- `server/services/K9000ReconciliationService.ts`
- `server/services/KYC2026/index.ts`
- `server/services/LoyaltyActivityMonitor.ts`
- `server/services/LynxRefundService.ts`
- `server/services/MayaOpsTasksService.ts`
- `server/services/MultiSourceWeatherService.ts`
- `server/services/NayaxCortinaClient.ts`
- `server/services/NayaxWalkMarketplaceService.ts`
- `server/services/NotificationConsentManager.ts`
- `server/services/OAuthCertificateMonitor.ts`
- `server/services/OpenMeteoAirQualityService.ts`
- `server/services/PersonalizedGreetingService.ts`
- `server/services/PetIdentificationService.ts`
- `server/services/PiiMinimizer.ts`
- `server/services/RefundService.ts`
- `server/services/SitterProximitySearch.ts`
- `server/services/SumitBookingPayment.ts`
- `server/services/SumitFinancialsService.ts`
- `server/services/SumitReceiptService.ts`
- `server/services/SumitReconciliationService.ts`
- `server/services/SumitSyncService.ts`
- `server/services/booking-response/BookingResponseDispatcher.ts`
- `server/services/booking-response/acceptSitterBookingCore.ts`
- `server/services/booking-response/acceptWalkBookingCore.ts`
- `server/services/booking-response/declineSitterBookingCore.ts`
- `server/services/booking-response/declineWalkBookingCore.ts`
- `server/services/campaignTemplates.ts`
- `server/services/chatThreadService.ts`
- `server/services/coworker/providerCoworker.ts`
- `server/services/egiftEmailService.ts`
- `server/services/events/NotificationEventHandlers.ts`
- `server/services/events/index.ts`
- `server/services/homeAccessService.ts`
- `server/services/jobPassport/providerVerification.ts`
- `server/services/legacyBookingBridge.ts`
- `server/services/mapkit.ts`
- `server/services/payment-providers/MockPaymentProvider.ts`
- `server/services/serviceVerificationService.ts`
- `server/services/unified-booking/index.ts`
- `server/services/voice/index.ts`
- `server/services/voucherSecurityService.ts`
- `server/services/weatherNotifications.ts`

## PAGE_UNROUTED (11)

- `client/src/pages/DocumentSigning.tsx`
- `client/src/pages/PlatformShowcase.tsx`
- `client/src/pages/Privacy.tsx`
- `client/src/pages/ProviderTimeline.tsx`
- `client/src/pages/StandaloneDivisions.tsx`
- `client/src/pages/forms/ProviderRegistrationForm.tsx`
- `client/src/pages/pettrek/CustomerDashboard.tsx`
- `client/src/pages/pettrek/DriverDashboard.tsx`
- `client/src/pages/pettrek/DriverDetail.tsx`
- `client/src/pages/walk-my-pet/WalkerDashboard.tsx`
- `client/src/pages/walks/TrackWalk.tsx`

## COMPONENT_UNUSED (47)

- `client/src/components/AccessibilityAnnouncer.tsx`
- `client/src/components/AccessibilityButton.tsx`
- `client/src/components/AdminRouteGuard.tsx`
- `client/src/components/AppErrorBoundary.tsx`
- `client/src/components/AppleWalletButton.tsx`
- `client/src/components/AvatarCustomizer.tsx`
- `client/src/components/BackButton.tsx`
- `client/src/components/BiometricCertificateUpload.tsx`
- `client/src/components/BiometricConsentDialog.tsx`
- `client/src/components/DashboardQuickActions.tsx`
- `client/src/components/DataProcessingConsent.tsx`
- `client/src/components/EmergencyWalkBooking.tsx`
- `client/src/components/ExecutiveSuiteGuard.tsx`
- `client/src/components/FaceIDLoadingState.tsx`
- `client/src/components/GlobalContactForm.tsx`
- `client/src/components/GoogleReviewsWidget.tsx`
- `client/src/components/KYCUpload.tsx`
- `client/src/components/KenzoTalkingAvatar.tsx`
- `client/src/components/LandingLiveBayStrip.tsx`
- `client/src/components/LiveChatWidget.tsx`
- `client/src/components/LuxuryAwardBadge2025.tsx`
- `client/src/components/LuxuryConsentCard.tsx`
- `client/src/components/NewHumanAvatar.tsx`
- `client/src/components/OnboardingChecklist.tsx`
- `client/src/components/OnboardingVerification.tsx`
- `client/src/components/PaymentPreviewCard.tsx`
- `client/src/components/ReCaptcha.tsx`
- `client/src/components/ReviewDisplay.tsx`
- `client/src/components/SpotifyPartyPlaylist.tsx`
- `client/src/components/TrackMyPet.tsx`
- `client/src/components/TransactionOTPModal.tsx`
- `client/src/components/TransactionPinModal.tsx`
- `client/src/components/VerificationStatus.tsx`
- `client/src/components/WhatsAppChat.tsx`
- `client/src/components/WorldClock.tsx`
- `client/src/components/admin/LoyaltyDashboard.tsx`
- `client/src/components/booking/HostStayJourney.tsx`
- `client/src/components/franchise-finance/index.tsx`
- `client/src/components/iOSPermissionsGuide.tsx`
- `client/src/components/luxury/LuxuryEmoji.tsx`
- `client/src/components/luxury/LuxuryFullScreenDialog.tsx`
- `client/src/components/marketplace/BookingRequestModal.tsx`
- `client/src/components/marketplace/HowItWorks.tsx`
- `client/src/components/marketplace/ServiceShowcase.tsx`
- `client/src/components/marketplace/TrustSafetySection.tsx`
- `client/src/components/marketplace/UnifiedSearchWidget.tsx`
- `client/src/components/weather/BookingWeatherAlert.tsx`
