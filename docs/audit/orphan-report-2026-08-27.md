# Orphan detector report — 2026-08-27 (v3, full SERVICE triage)

Generated: 2026-08-27T23:57:08.656Z
Total findings: 58

v3: SERVICE_EXPORT bucket fully triaged. Every server service is now either wired, marked intentional infrastructure with a named reason, or flagged as a cleanup-candidate in ALLOW_INTENTIONAL with a comment. Remaining findings are in the client/pages/components buckets.

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
