# Seed Data Limitations

## Overview
The seed script (`server/scripts/seedProviders.ts`) creates sample providers for testing the browse and booking UI flows. However, these seeded providers have **limited functionality** compared to real providers who sign up through the proper onboarding flow.

## What Works with Seeded Providers ✅

1. **Browse Pages**: All provider browse pages (Sitter Suite, Walk My Pet, PetTrek) display seeded providers correctly
2. **Provider Listings**: API endpoints return full provider data with ratings, photos, bios, etc.
3. **Booking Metadata**: Bookings created with seeded providers capture correct provider name and photo
4. **Booking Creation**: The booking API successfully creates booking records with VAT calculation and escrow
5. **Customer-Facing Features**: All customer-side booking flows, dashboards, and receipts work correctly

## What Doesn't Work with Seeded Providers ❌

1. **Provider Notifications**: Seeded providers don't have:
   - Firebase Authentication accounts
   - FCM tokens for push notifications
   - Notification channel preferences
   - **Impact**: Booking confirmations and messages won't reach seeded providers

2. **Provider-Side Chat**: Seeded providers lack:
   - Chat roster entries
   - Real-time messaging subscriptions
   - WebSocket connections
   - **Impact**: Chat conversations can be created but providers won't receive messages

3. **Provider Dashboards**: Seeded providers can't log in to view their dashboards because they don't have authentication credentials

## Purpose of Seed Data

The seed script is designed for:
- **UI Development**: Testing browse pages and booking flows
- **Demo/Preview**: Showing potential customers the platform UX
- **E2E Testing (Customer Side)**: Validating customer booking experiences
- **Load Testing**: Generating sample data for performance testing

## Production Usage

For **production-ready testing** of the complete provider experience:

1. **Use Real Provider Onboarding**: Create provider accounts through the proper sign-up flow
2. **Manual Testing**: Have real users create provider profiles with Firebase Authentication
3. **Integration Testing**: Use test accounts with full authentication credentials

## Future Improvements

To enable full end-to-end testing with seed data:
- [ ] Extend seed script to create Firebase Auth user accounts
- [ ] Generate FCM tokens for seeded providers
- [ ] Initialize notification preferences for seeded users
- [ ] Set up chat roster entries
- [ ] Create test credentials for provider dashboard login

## Current Status (November 2025)

**Recommendation**: Use seeded providers for customer-side testing only. For provider-side features (notifications, chat, dashboards), create real test accounts through the application's onboarding flow.
