# Pet Wash Ltd - Super-App Database Schema

## Overview
Enterprise-grade multi-tenant PostgreSQL schema for 6+ platform super-app ecosystem.

**Design for:** 100 → 1M+ users with white-label franchise support

---

## Multi-Tenant Architecture

Every table includes `tenant_id` for franchise isolation:
```sql
tenant_id VARCHAR NOT NULL DEFAULT 'global'
```

**RLS Policies** enforce automatic tenant filtering.

---

## Core Tables (30+ tables documented in detail in BACKEND_ARCHITECTURE.md)

### Users
- ID: `VARCHAR` (UUID)
- Multi-role support: `["customer", "walker", "sitter", "driver"]`
- Loyalty tier tracking
- Firebase Auth integration

### Pets
- Owner linkage
- Medical records
- Behavioral notes
- Multiple pets per user

### Service Providers
- Background checks
- Certifications
- Ratings & reviews
- Availability management

### Bookings
- Cross-platform support (6+ platforms)
- Real-time status tracking
- Payment integration
- Recurring schedules

### Payments
- Idempotency keys
- Multi-currency
- Refund handling
- Provider payouts

###Reviews
- Bi-directional (customer ↔ provider)
- Photo reviews
- Moderation workflow

### Messaging
- In-app chat
- File attachments
- Read receipts

### Notifications
- Multi-channel (push, email, SMS)
- User preferences
- Delivery tracking

### Location Updates (GPS)
- Time-series data (PostGIS)
- Real-time tracking
- Route history

### Wallet & Loyalty
- Point tracking
- Tier benefits
- E-gift cards
- Subscriptions

---

## Platform-Specific Tables

### K9000: Wash Stations
- Station locations
- Equipment status
- Queue management

### Walk My Pet™: Walker Availability
- Time-slot management
- Recurring schedules

### Sitter Suite™: Host Homes
- Property details
- Amenities
- Instant book settings

### PetTrek™: Driver Vehicles
- Vehicle info
- Safety features
- Insurance verification

---

## Scalability Strategy

**Phase 1 (0-200 users):** Single database
**Phase 2 (200-5K):** Read replicas
**Phase 3 (5K-100K):** Partitioning
**Phase 4 (100K-1M+):** Sharding by tenant_id

---

See `BACKEND_ARCHITECTURE.md` for complete schema definitions.

**Status:** Architecture Defined ✅
