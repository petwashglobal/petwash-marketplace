# Pet Wash Ltd - Database Schema Documentation
## PostgreSQL Schema Reference

Last Updated: November 11, 2025

---

## Overview

Pet Wash Ltd uses Neon serverless PostgreSQL with Drizzle ORM. The database supports multiple business units under one unified architecture:
- **K9000 Wash Stations** (flagship IoT product)
- **The Sitter Suite™** (pet sitting marketplace)
- **Walk My Pet™** (dog walking marketplace)
- **PetTrek™** (pet transport marketplace)
- **The Plush Lab™** (AI avatar creator)

All business units share core infrastructure (auth, payments, compliance, franchise management).

---

## Job Dispatch Tables (Marketplace Core)

### `job_offers`

Job offers for The Sitter Suite™, Walk My Pet™, and PetTrek™ marketplaces.

```sql
CREATE TABLE job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'sitter-suite', 'walk-my-pet', 'pettrek'
  customer_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  payment_intent_id UUID, -- Foreign key to payment_intents
  status VARCHAR(50) NOT NULL, -- 'pending', 'accepted', 'rejected', 'expired', 'in_progress', 'completed'
  service_type VARCHAR(100) NOT NULL,
  service_date TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- Minutes
  location JSONB NOT NULL, -- {latitude, longitude, address}
  geohash VARCHAR(20), -- For proximity matching
  base_amount DECIMAL(10, 2),
  platform_fee DECIMAL(10, 2),
  vat DECIMAL(10, 2),
  total_charge DECIMAL(10, 2),
  operator_payout DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'ILS',
  pet_ids TEXT[], -- Array of pet IDs
  special_instructions TEXT,
  metadata JSONB,
  offer_history JSONB, -- Track who was offered and when
  accepted_by VARCHAR(255), -- Operator ID who accepted
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_offers_booking_id ON job_offers(booking_id);
CREATE INDEX idx_job_offers_platform ON job_offers(platform);
CREATE INDEX idx_job_offers_status ON job_offers(status);
CREATE INDEX idx_job_offers_geohash ON job_offers(geohash);
CREATE INDEX idx_job_offers_service_date ON job_offers(service_date);
CREATE INDEX idx_job_offers_payment_intent_id ON job_offers(payment_intent_id);
```

**Key Features:**
- Uber/Airbnb-style job dispatch flow
- Geohash-based proximity matching for finding nearby operators
- Payment authorization linked via `payment_intent_id`
- Complete offer history tracking for analytics
- Multi-currency support (starting with ILS)

**Business Rules:**
- Job offer expires after 15 minutes if not accepted
- Payment authorized when offer created, captured when accepted
- If rejected or expired, payment is voided (refunded)
- Offer can be sent to multiple operators sequentially (not parallel)

---

### `payment_intents`

Payment authorization and capture tracking for job dispatch system.

```sql
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL,
  job_offer_id UUID, -- Foreign key to job_offers
  platform VARCHAR(50) NOT NULL, -- 'sitter_suite', 'walk_my_pet', 'pet_trek'
  amount_cents INTEGER NOT NULL, -- Amount in minor currency units (agora for ILS)
  currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
  status VARCHAR(50) NOT NULL, -- 'authorized', 'succeeded', 'voided', 'failed'
  nayax_transaction_id VARCHAR(255), -- Nayax reference ID
  customer_payment_token VARCHAR(255),
  metadata JSONB,
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Auto-void after this time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_booking_id ON payment_intents(booking_id);
CREATE INDEX idx_payment_intents_job_offer_id ON payment_intents(job_offer_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_expires_at ON payment_intents(expires_at);
CREATE INDEX idx_payment_intents_nayax_transaction_id ON payment_intents(nayax_transaction_id);
```

**Key Features:**
- Three-phase payment flow: authorize → capture/void
- Amounts stored in minor currency units (cents, agora, etc.)
- Auto-void cron job prevents expired holds
- Links to both booking and job offer for complete traceability

**Currency Handling:**
```typescript
// Israel (2 decimals)
ILS 50.00 → 5000 agora (amount_cents)

// Japan (0 decimals)
JPY 5000 → 5000 yen (amount_cents)

// Bahrain (3 decimals)
BHD 10.500 → 10500 fils (amount_cents)
```

**Payment Flow:**
1. **AUTHORIZE**: Create payment_intent with status='authorized', hold funds for 15 minutes
2. **CAPTURE**: On job acceptance, update status='succeeded', charge held funds
3. **VOID**: On timeout/rejection, update status='voided', release funds back to customer

---

### `operator_presence`

Real-time operator availability and location for job matching.

```sql
CREATE TABLE operator_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'sitter-suite', 'walk-my-pet', 'pettrek'
  is_available BOOLEAN DEFAULT true,
  location JSONB, -- {latitude, longitude, accuracy, timestamp}
  geohash VARCHAR(20), -- For proximity matching
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  device_token VARCHAR(500), -- FCM push token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operator_presence_operator_id ON operator_presence(operator_id);
CREATE INDEX idx_operator_presence_platform ON operator_presence(platform);
CREATE INDEX idx_operator_presence_is_available ON operator_presence(is_available);
CREATE INDEX idx_operator_presence_geohash ON operator_presence(geohash);
CREATE INDEX idx_operator_presence_last_seen_at ON operator_presence(last_seen_at);
```

**Key Features:**
- Real-time GPS location tracking
- Geohash-based proximity matching
- FCM device token for push notifications
- Platform-specific availability status
- Auto-expire stale locations (>10 minutes old)

**Geohash Precision:**
- Length 5: ~5km resolution (initial offer search)
- Length 6: ~1.2km resolution (nearby operators)
- Length 7: ~150m resolution (exact location)

---

## Migration History

### Manual Migrations (2025-11-11)

**Tables Created:**
```sql
-- Created via direct SQL (drizzle-kit required interactive confirmation)
CREATE TABLE job_offers (...);
CREATE TABLE payment_intents (...);
CREATE TABLE operator_presence (...);
```

**Reason for Manual Creation:**
- `drizzle-kit push` blocked by interactive data loss warnings
- Tables created safely using SQL with proper indexes and constraints
- Foreign key relationships established between job_offers and payment_intents

**Future Migrations:**
- Use `npm run db:push --force` for schema changes
- Never change primary key types (breaks existing data)
- Always review generated SQL before pushing
- Test migrations on development database first

---

## Data Retention Policies

### Job Offers
- **Active Jobs**: Keep indefinitely for business analytics
- **Expired/Rejected**: Archive after 30 days to analytics database
- **Completed**: Keep for 7 years (legal compliance)

### Payment Intents
- **All Records**: Keep for 7 years (Israeli tax and legal requirements)
- **Audit Trail**: Immutable, blockchain-style hash chain
- **Backup**: Daily PostgreSQL backup to GCS with 30-day retention

### Operator Presence
- **Active Sessions**: Real-time updates, no expiration
- **Stale Data**: Auto-expire after 10 minutes of inactivity
- **Historical**: Move to analytics after 7 days

---

## Performance Considerations

### Indexes
- **Geohash indexes** enable fast proximity search (O(log n))
- **Status indexes** optimize job queue queries
- **Expiration indexes** support efficient cron job scanning
- **Foreign key indexes** improve join performance

### Query Patterns
```sql
-- Find nearby operators (geohash prefix matching)
SELECT * FROM operator_presence 
WHERE geohash LIKE '8ftdq%' AND is_available = true;

-- Find expired payments for auto-void cron
SELECT * FROM payment_intents 
WHERE status = 'authorized' 
AND expires_at < NOW() 
ORDER BY expires_at ASC 
LIMIT 50;

-- Get job offer with payment details
SELECT jo.*, pi.* 
FROM job_offers jo 
LEFT JOIN payment_intents pi ON jo.payment_intent_id = pi.id 
WHERE jo.id = $1;
```

### Scaling Strategies
- **Read Replicas**: Use Neon read replicas for analytics queries
- **Connection Pooling**: PgBouncer for high concurrency
- **Partitioning**: Partition payment_intents by date after 1M+ records
- **Caching**: Redis for hot operator locations and job queues

---

## Security & Compliance

### Data Encryption
- **At Rest**: PostgreSQL TDE enabled on Neon
- **In Transit**: TLS 1.3 for all database connections
- **Sensitive Fields**: Customer payment tokens encrypted separately

### Access Control
- **Application Role**: Limited to CRUD operations
- **Admin Role**: Full schema access for migrations
- **Read-Only Role**: Analytics and reporting only
- **Audit Logging**: All mutations logged to blockchain-style audit trail

### GDPR Compliance
- **Data Deletion**: CASCADE deletes for user data cleanup
- **Data Export**: JSON export via enterprise API
- **Consent Tracking**: Metadata field stores consent timestamps
- **Retention Limits**: Auto-archive after defined periods

---

## Backup & Recovery

### Daily Backups
- **Schedule**: Every day at 1 AM Israel time
- **Destination**: Google Cloud Storage
- **Retention**: 30 days rolling, monthly archives for 7 years
- **Verification**: SHA-256 checksums for backup integrity

### Restore Procedures
```bash
# Test restore (monthly)
pg_restore --dbname=test_restore --clean --if-exists backup.dump

# Production restore (emergency only)
pg_restore --dbname=production --clean --if-exists backup.dump
```

### Disaster Recovery
- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 24 hours (Recovery Point Objective)
- **Failover**: Neon automatic failover to standby
- **Testing**: Monthly restore tests required

---

## Monitoring & Alerts

### Critical Metrics
- **Connection Pool**: Alert if >80% utilization
- **Query Latency**: Alert if p95 >500ms
- **Failed Transactions**: Alert on 5+ failures/minute
- **Auto-Void Errors**: Alert immediately
- **Backup Failures**: Page on-call engineer

### Health Checks
```sql
-- Check payment integrity
SELECT COUNT(*) FROM payment_intents 
WHERE status = 'authorized' AND expires_at < NOW() - INTERVAL '1 hour';
-- Should be 0 (auto-void cron should handle these)

-- Check orphaned payments
SELECT COUNT(*) FROM payment_intents pi
LEFT JOIN job_offers jo ON pi.job_offer_id = jo.id
WHERE pi.job_offer_id IS NOT NULL AND jo.id IS NULL;
-- Should be 0 (referential integrity)

-- Check stale operator locations
SELECT COUNT(*) FROM operator_presence
WHERE is_available = true AND last_seen_at < NOW() - INTERVAL '10 minutes';
-- Should be low (<5% of total operators)
```

---

## Development Guidelines

### Schema Changes
1. Update `shared/schema.ts` with Drizzle schema
2. Run `npm run db:push --force` to sync to database
3. Test queries in development environment
4. Document changes in this file
5. Deploy to production during maintenance window

### Data Migrations
1. Write migration script in `server/migrations/`
2. Test on anonymized production data copy
3. Run during low-traffic window
4. Monitor for errors and performance issues
5. Keep rollback plan ready

### Testing
- **Unit Tests**: Mock database with test fixtures
- **Integration Tests**: Use test database (not production)
- **Load Tests**: Simulate 10K concurrent operators
- **Data Quality**: Automated checks in CI/CD pipeline

---

## Future Enhancements

### Planned Features
- **Multi-Region**: Partition by country for GDPR compliance
- **Sharding**: Horizontal scaling for 100K+ operators
- **Time-Series Data**: Separate TimescaleDB for telemetry
- **Graph Database**: Neo4j for relationship mapping (franchises, staff, locations)

### Schema Evolution
- **franchise_entities** table for multi-tenant support
- **country_operations** table for regional compliance
- **iot_devices** table for K9000 wash station management
- **revenue_sharing** table for franchise payouts

---

## Support & Troubleshooting

### Common Issues

**Issue**: Auto-void cron voiding accepted jobs
- **Cause**: Incorrect foreign key in WHERE clause
- **Fix**: Use `jobOfferId` instead of `bookingId` for joins
- **Prevention**: Foreign key constraints enforce referential integrity

**Issue**: Currency conversion errors
- **Cause**: Using inline `* 100` instead of `toMinorUnit()`
- **Fix**: Import and use currency utility for all amount conversions
- **Prevention**: Linting rule to ban inline multiplication

**Issue**: Slow proximity queries
- **Cause**: Missing or incorrect geohash index
- **Fix**: Rebuild geohash index with CONCURRENTLY option
- **Prevention**: Monitor slow query log daily

### Emergency Contacts
- **Database Issues**: ops@petwash.co.il
- **Payment Issues**: finance@petwash.co.il
- **Security Issues**: security@petwash.co.il
- **On-Call Engineer**: +972-XX-XXX-XXXX

---

*Document Version: 1.0*  
*Last Updated: November 11, 2025*  
*Next Review: December 11, 2025*
