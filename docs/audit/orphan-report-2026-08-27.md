# Orphan detector report — 2026-08-27 (v4, SERVICE + PAGE fully triaged)

Generated: 2026-08-27T23:58:37.417Z
Total findings: 47

v4: SERVICE_EXPORT + ROUTE_UNMOUNTED + PAGE_UNROUTED all at zero. Remaining findings are in the COMPONENT_UNUSED bucket — 47 items that need a triage sweep. Many are likely feature-branch prototypes; some may be false positives from dynamic imports or nested renders.

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
