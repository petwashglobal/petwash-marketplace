# Apple Account Deletion Readiness - 2026-06-05

Ticket: `TICKET-03-Provider-App-AppStore-GooglePlay`

## What This Lane Adds

- Existing account deletion routes now attempt Sign in with Apple token revocation before recording the deletion request response.
- The revocation call is server-side only and uses Apple's `https://appleid.apple.com/auth/revoke` endpoint.
- Safe status metadata is returned/audited as `appleSignInRevocation`; access tokens, refresh tokens, authorization codes, client secrets, and private keys are never returned.
- Stored Apple token fields are deleted after Apple returns a successful revoke response.
- If the user has Apple linked but no stored access/refresh token exists, deletion still proceeds and the status marks `manualRevocationRequired: true`.

## Required Secrets

Set these in the server secret store before enabling Apple signup:

- `APPLE_SIGN_IN_CLIENT_ID`
- `APPLE_SIGN_IN_TEAM_ID`
- `APPLE_SIGN_IN_KEY_ID`
- `APPLE_SIGN_IN_PRIVATE_KEY`

The code also accepts the compact aliases `APPLE_SIGNIN_CLIENT_ID`, `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, and `APPLE_SIGNIN_PRIVATE_KEY`.

## Store-Policy Notes

- Apple says apps supporting account creation must let users initiate deletion in-app, and apps using Sign in with Apple should revoke user tokens through the Sign in with Apple REST API.
- Google Play requires an in-app deletion path and a web deletion resource for apps where users can create accounts.
- Apple signup remains disabled by default until provider-console configuration, token storage on Apple account creation, and real-device auth testing are complete.

## Remaining Blockers

- Apple signup must store the validated Apple refresh token or access token server-side at account creation/link time.
- Apple Developer Console service ID, key ID, private key, associated domains, and return URLs need human setup.
- A public web deletion resource must be confirmed for Google Play's Data safety form.
- Capacitor wrapping and store submission remain blocked until Tickets 01 and 02 are accepted and auth is verified end-to-end.
