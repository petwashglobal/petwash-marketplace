# Firebase Social Auth Audit - 2026-06-05

Ticket: `TICKET-02-Firebase-Social-Auth-Audit`

## Code Findings

- Production Firebase Auth domain is pinned to `petwash.co.il`, not the Firebase-hosted domain. This protects iOS/Safari redirect state from third-party storage blocking.
- Google, Apple, and Facebook provider helpers exist in `client/src/lib/iosAuthHandler.ts` and use Firebase Auth SDK providers.
- Apple signup remains default-off in `client/src/lib/authSignupFlags.ts` until Apple console config and Apple token revocation are verified.
- External Instagram signup/login is server-mediated from the signup screen and should be verified separately from Firebase social providers.
- Account deletion surfaces exist, including `/api/account/delete-request` and `/api/user/delete`, but this audit did not find Apple authorization-token revocation. That remains a store-readiness blocker before enabling Apple sign-in.
- Firebase Performance Monitoring now requires explicit enablement with `VITE_FIREBASE_PERFORMANCE_ENABLED=true` while `VITE_FEATURE_SOCIAL_AUTH_FIXES` is active. This prevents the observed `fireperf:fetch` 400 request from starting on every production page load before Firebase Performance/API configuration is verified.

## Console-Side Verification Required

- Firebase Authentication: verify authorized domains include `petwash.co.il` and the required preview/local domains only.
- Firebase Authentication providers: verify Google, Apple, and Facebook providers are enabled with correct client IDs, service IDs, redirect URIs, secrets, and support email/domain ownership.
- Google Cloud/Firebase APIs: verify Firebase Performance Monitoring and related collection endpoints are enabled only after the project accepts production traffic without 400s.
- App Check: verify `VITE_RECAPTCHA_SITE_KEY` is configured for production domains and the enforcement rollout is deliberate.
- Meta/Instagram: verify Facebook app mode, valid OAuth redirect URIs, data-use review status, and Instagram-specific external auth routing.
- Apple Developer: verify Sign in with Apple service ID, associated domains, return URL, email relay settings, and account-deletion token revocation before store submission.

## Rollback And Enablement

- Roll back this code behavior with `VITE_FEATURE_SOCIAL_AUTH_FIXES=false`; this restores the previous production Firebase Performance auto-start path.
- Enable Firebase Performance after console verification with `VITE_FIREBASE_PERFORMANCE_ENABLED=true`.
- Enable Apple signup only after console verification and Apple token revocation exist by setting `VITE_AUTH_SIGNUP_APPLE_SIGNIN_ENABLED=true`.
