# Pet Wash Ltd - Backend Microservice Architecture

## Overview
Enterprise-grade backend architecture designed for global scalability. Built with a stateless edge server (current) that can evolve into a microservices ecosystem as the platform scales from 100-200 to 1M+ concurrent users.

---

## Phase 1: Monolith (Current State - 100-200 Users)

### Architecture Pattern: Stateless Monolith with Edge Server

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  React SPA (Vite) - All business logic in frontend          │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS/WSS
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   EDGE SERVER (server.cjs)                   │
│  • Static file serving (dist/public/)                       │
│  • Health checks (/health, /status)                         │
│  • SPA routing (catch-all → index.html)                     │
│  • MINIMAL logic - just routing and serving                 │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Future API calls will go here
             ▼
┌─────────────────────────────────────────────────────────────┐
│              SHARED SERVICES (Future Phase 2)                │
│  • Auth Service                                              │
│  • Payment Service                                           │
│  • Notification Service                                      │
│  • Location Service                                          │
│  • File Storage Service                                      │
│  • Analytics Service                                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│  • PostgreSQL (Neon) - Multi-tenant schema                  │
│  • Redis (optional caching)                                  │
│  • Firebase (Authentication)                                 │
│  • Cloud Storage (Google Cloud Storage)                     │
└──────────────────────────────────────────────────────────────┘
```

### Current Stack
- **Edge Server:** Node.js (server.cjs) - Pure JavaScript, stateless
- **Frontend:** React 18 + Vite + TypeScript
- **Database:** Neon PostgreSQL (serverless)
- **Auth:** Firebase Authentication
- **Storage:** Google Cloud Storage
- **Deployment:** Replit (with autoscaling capability)

### Why This Works for Phase 1
✅ **Fast to build** - No microservice complexity
✅ **Easy to deploy** - Single server, single process
✅ **Cost-effective** - Minimal infrastructure
✅ **Scales to 200 users** - Stateless design allows horizontal scaling
✅ **Future-proof** - Clean architecture makes microservice split easy

---

## Phase 2: Hybrid Architecture (200-5,000 Users)

### Pattern: Edge + Shared Services

When to migrate: **When single server hits 70% CPU consistently**

```
┌─────────────────────────────────────────────────────────────┐
│                   EDGE SERVER (API Gateway)                  │
│  • Route requests to services                                │
│  • Load balancing                                            │
│  • Rate limiting                                             │
│  • Authentication middleware                                 │
└────┬────────┬────────┬────────┬────────┬────────┬───────────┘
     │        │        │        │        │        │
     ▼        ▼        ▼        ▼        ▼        ▼
┌─────────┐┌─────────┐┌────────┐┌────────┐┌──────┐┌──────────┐
│  Auth   ││ Booking ││Payment ││ Notify ││ Loc  ││ Storage  │
│ Service ││ Service ││Service ││Service ││ Svc  ││ Service  │
└─────────┘└─────────┘└────────┘└────────┘└──────┘└──────────┘
     │           │          │         │         │        │
     └───────────┴──────────┴─────────┴─────────┴────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  PostgreSQL (Multi-tenant)    │
              │  Redis (Session/Cache)        │
              └──────────────────────────────┘
```

---

## Phase 3: Full Microservices (5,000+ to 1M+ Users)

### Pattern: Domain-Driven Microservices

```
                      ┌──────────────────┐
                      │   API Gateway    │
                      │  (Kong/AWS ALB)  │
                      └────────┬─────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Platform        │  │  Platform        │  │  Platform        │
│  Services        │  │  Services        │  │  Services        │
│                  │  │                  │  │                  │
│  • Walk My Pet   │  │  • Sitter Suite  │  │  • PetTrek       │
│  • Booking       │  │  • Booking       │  │  • Booking       │
│  • Matching      │  │  • Matching      │  │  • Routing       │
│  • Tracking      │  │  • Messaging     │  │  • Tracking      │
│  • Reviews       │  │  • Reviews       │  │  • Reviews       │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │   SHARED SERVICES        │  │   INFRASTRUCTURE         │
  │                          │  │                          │
  │  • Auth Service          │  │  • Message Queue (RabbitMQ)│
  │  • Payment Service       │  │  • Event Bus (Kafka)     │
  │  • Notification Service  │  │  • Service Mesh (Istio)  │
  │  • Location Service      │  │  • Monitoring (Datadog)  │
  │  • File Storage Service  │  │  • Logging (ELK Stack)   │
  │  • Analytics Service     │  │  • Tracing (Jaeger)      │
  │  • Search Service        │  │                          │
  │  • AI/ML Service         │  │                          │
  └──────────────────────────┘  └──────────────────────────┘
                │
                ▼
  ┌──────────────────────────────────────────┐
  │         DATA LAYER                        │
  │                                           │
  │  • PostgreSQL (sharded by tenant)         │
  │  • Redis Cluster (caching + sessions)     │
  │  • Elasticsearch (search)                 │
  │  • S3/GCS (file storage)                  │
  │  • MongoDB (logs, events)                 │
  └──────────────────────────────────────────┘
```

---

## Service Breakdown

### 1. Auth Service

**Responsibilities:**
- User authentication (Firebase integration)
- Session management
- Role-based access control (RBAC)
- JWT token generation/validation
- Passkey/WebAuthn support
- OAuth integrations (Google, Apple, etc.)

**API Endpoints:**
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh-token
GET    /auth/me
POST   /auth/passkey/register
POST   /auth/passkey/authenticate
POST   /auth/oauth/google
POST   /auth/oauth/apple
```

**Database Tables:**
- users
- sessions
- passkeys
- oauth_connections
- user_roles

**Scaling Strategy:**
- Stateless (JWT-based)
- Redis for session storage
- Read replicas for user lookups
- Rate limiting per IP

---

### 2. Booking Service

**Responsibilities:**
- Manage bookings across all platforms
- Real-time availability checks
- Reservation logic
- Cancellation handling
- Recurring bookings
- Calendar management

**Platform-Specific Logic:**
- **K9000:** Wash station reservations, queue management
- **Walk My Pet:** Walker scheduling, recurring walks
- **Sitter Suite:** Multi-night stays, instant vs request-to-book
- **PetTrek:** Real-time ride dispatching
- **Grooming:** Appointment scheduling
- **Vet On Demand:** Consultation scheduling

**API Endpoints:**
```
POST   /bookings
GET    /bookings/:id
PATCH  /bookings/:id
DELETE /bookings/:id (cancel)
GET    /bookings/user/:userId
GET    /bookings/provider/:providerId
GET    /availability/check
POST   /bookings/:id/reschedule
```

**Database Tables:**
- bookings
- availability_slots
- recurring_schedules
- booking_history
- cancellation_policies

**Scaling Strategy:**
- Write-heavy (lots of bookings)
- Use PostgreSQL with connection pooling
- Cache availability with Redis (TTL: 1 min)
- Event-driven: Emit booking events to message queue

---

### 3. Payment Service

**Responsibilities:**
- Payment processing (Stripe/Nayax)
- Subscription management
- Wallet system
- Refunds & disputes
- Invoice generation
- Tax calculation
- Fraud detection

**API Endpoints:**
```
POST   /payments/charge
POST   /payments/refund
GET    /payments/methods
POST   /payments/methods/add
DELETE /payments/methods/:id
GET    /payments/history
POST   /payments/subscriptions
GET    /invoices/:id
```

**Database Tables:**
- payments
- payment_methods
- subscriptions
- refunds
- invoices
- wallet_transactions

**Scaling Strategy:**
- Idempotency keys (prevent duplicate charges)
- Async webhook processing
- Separate read/write databases
- PCI compliance (tokenization)

---

### 4. Notification Service

**Responsibilities:**
- Push notifications (Firebase Cloud Messaging)
- SMS (Twilio)
- Email (SendGrid)
- In-app notifications
- Notification preferences
- Delivery tracking

**API Endpoints:**
```
POST   /notifications/send
GET    /notifications/user/:userId
PATCH  /notifications/:id/read
POST   /notifications/preferences
GET    /notifications/templates
```

**Database Tables:**
- notifications
- notification_preferences
- notification_templates
- delivery_logs

**Scaling Strategy:**
- Message queue (RabbitMQ/SQS) for async delivery
- Batch notifications for efficiency
- Retry logic with exponential backoff
- Rate limiting (prevent spam)

---

### 5. Location Service

**Responsibilities:**
- GPS tracking (walkers, drivers)
- Geofencing
- Proximity search (find nearest station, walker, host)
- Route calculation
- Distance/duration estimation
- Map data caching

**API Endpoints:**
```
POST   /locations/update (GPS position)
GET    /locations/nearby (proximity search)
GET    /locations/route (A to B routing)
GET    /locations/track/:bookingId (live tracking)
POST   /locations/geofence (create geofence)
```

**Database Tables:**
- location_updates (time-series)
- geofences
- routes

**Scaling Strategy:**
- TimescaleDB or PostgreSQL with PostGIS extension
- Redis for real-time GPS caching
- WebSocket for live tracking
- Separate database for location data (high write volume)

---

### 6. File Storage Service

**Responsibilities:**
- Image uploads (pet photos, profiles, reviews)
- Document uploads (vet records, insurance)
- Video uploads (virtual tours, walk videos)
- CDN integration
- Image processing (resize, compress, watermark)
- Virus scanning

**API Endpoints:**
```
POST   /files/upload
GET    /files/:id
DELETE /files/:id
POST   /files/batch-upload
GET    /files/signed-url (for direct upload to GCS)
```

**Database Tables:**
- files
- file_metadata

**Scaling Strategy:**
- Direct uploads to Google Cloud Storage (signed URLs)
- CDN (Cloudflare) for serving files
- Background image processing (queue-based)
- Separate storage buckets per tenant (white-label support)

---

### 7. Analytics Service

**Responsibilities:**
- Event tracking
- User behavior analytics
- Business metrics (revenue, bookings, retention)
- Dashboards for admins/franchises
- A/B test data collection
- Real-time reporting

**API Endpoints:**
```
POST   /analytics/event
GET    /analytics/dashboard/:type
GET    /analytics/reports/:reportId
GET    /analytics/export (CSV/Excel)
```

**Database Tables:**
- events (time-series)
- metrics
- reports

**Scaling Strategy:**
- Event stream to Kafka/Kinesis
- Store in data warehouse (BigQuery, Snowflake)
- Aggregate metrics in real-time (Apache Flink)
- Cache dashboard data (Redis)

---

### 8. Messaging Service

**Responsibilities:**
- In-app chat (customer ↔ provider)
- Message history
- File attachments
- Read receipts
- Typing indicators
- Message moderation (AI-powered)

**API Endpoints:**
```
POST   /messages/send
GET    /messages/conversation/:conversationId
PATCH  /messages/:id/read
WebSocket /messages/live (real-time chat)
```

**Database Tables:**
- conversations
- messages
- message_attachments
- blocked_users

**Scaling Strategy:**
- WebSocket for real-time
- Redis pub/sub for message broadcast
- PostgreSQL for message history
- Message retention policy (delete after 1 year)

---

### 9. Search Service

**Responsibilities:**
- Full-text search (walkers, sitters, hosts, groomers, vets)
- Filtering & sorting
- Autocomplete
- Geospatial search
- Search ranking (relevance + proximity + rating)

**API Endpoints:**
```
GET    /search/walkers
GET    /search/sitters
GET    /search/groomers
GET    /search/vets
GET    /search/autocomplete
```

**Database Tables:**
- search_index (sync from main DB)

**Scaling Strategy:**
- Elasticsearch cluster
- Sync data from PostgreSQL via Change Data Capture (CDC)
- Cache popular searches (Redis)
- Search suggestions pre-computed

---

### 10. Review & Rating Service

**Responsibilities:**
- Reviews (customers ↔ providers)
- Ratings (1-5 stars)
- Photo reviews
- Review moderation
- Provider reputation score
- Fraud detection (fake reviews)

**API Endpoints:**
```
POST   /reviews/submit
GET    /reviews/provider/:providerId
GET    /reviews/booking/:bookingId
PATCH  /reviews/:id/report
DELETE /reviews/:id (admin only)
```

**Database Tables:**
- reviews
- review_photos
- review_reports
- provider_ratings (aggregated)

**Scaling Strategy:**
- Async review processing (moderation queue)
- Cache provider ratings (Redis)
- Pre-compute average ratings (batch job nightly)

---

### 11. AI/ML Service

**Responsibilities:**
- Gemini AI integration (chat assistant, recommendations)
- Content moderation (reviews, messages, photos)
- Fraud detection
- Dynamic pricing recommendations
- Demand forecasting
- Personalized recommendations

**API Endpoints:**
```
POST   /ai/chat
POST   /ai/moderate (text/image)
POST   /ai/recommend (personalized suggestions)
GET    /ai/pricing-suggestion
POST   /ai/fraud-check
```

**Scaling Strategy:**
- Separate GPU instances for ML models
- Queue-based inference (SQS + Lambda)
- Cache common AI responses (Redis)
- Rate limiting (expensive operations)

---

## Cross-Cutting Concerns

### Authentication & Authorization

**Strategy:**
1. **Edge Server** validates JWT token
2. Extracts user ID, role, tenant ID
3. Passes to downstream services via headers:
   ```
   X-User-ID: 12345
   X-User-Role: customer
   X-Tenant-ID: franchise-001
   ```
4. Services trust edge server (no re-validation)

**Service-to-Service Auth:**
- API keys or mTLS (mutual TLS)
- Service mesh (Istio) handles automatically in Phase 3

---

### Rate Limiting

**Per User:**
- 100 requests/minute for authenticated users
- 10 requests/minute for anonymous users

**Per Service:**
- Booking Service: 10 bookings/hour per user (prevent spam)
- Payment Service: 5 payment attempts/hour per user (fraud prevention)
- Notification Service: 50 notifications/day per user (anti-spam)

**Implementation:**
- Redis-based rate limiter (sliding window)
- Return HTTP 429 Too Many Requests

---

### Caching Strategy

**What to Cache:**
- User profiles (Redis, TTL: 5 min)
- Provider profiles (Redis, TTL: 10 min)
- Availability slots (Redis, TTL: 1 min)
- Popular search results (Redis, TTL: 15 min)
- Static data (platform settings, pricing) (Redis, TTL: 1 hour)

**Cache Invalidation:**
- On data update, clear relevant cache keys
- Use cache tags for bulk invalidation

---

### Error Handling

**Standardized Error Response:**
```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "This time slot is no longer available",
    "details": {
      "conflictingBookingId": "abc123",
      "suggestedAlternatives": [...]
    },
    "timestamp": "2025-11-12T20:00:00Z",
    "requestId": "req-xyz789"
  }
}
```

**Error Codes:**
- 400: Bad Request (validation errors)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized for this resource)
- 404: Not Found
- 409: Conflict (e.g., double booking)
- 429: Too Many Requests (rate limit)
- 500: Internal Server Error
- 503: Service Unavailable (maintenance)

**Retry Logic:**
- Idempotent requests (GET, PUT, DELETE): Automatic retry (3 times, exponential backoff)
- Non-idempotent (POST): No automatic retry (client decides)

---

### Logging & Monitoring

**Structured Logging:**
```json
{
  "timestamp": "2025-11-12T20:00:00Z",
  "level": "INFO",
  "service": "booking-service",
  "requestId": "req-xyz789",
  "userId": "user-123",
  "event": "booking.created",
  "data": {
    "bookingId": "booking-456",
    "platform": "walk-my-pet",
    "amount": 25.00
  }
}
```

**Log Aggregation:**
- Phase 1: Console logs (Replit)
- Phase 2: Centralized logging (Logtail, Papertrail)
- Phase 3: ELK Stack (Elasticsearch, Logstash, Kibana)

**Metrics to Track:**
- Request rate (requests/sec per service)
- Error rate (errors/total requests)
- Latency (p50, p95, p99)
- Database connections (active/max)
- Cache hit rate
- Queue depth

**Alerting:**
- Error rate > 5%: Alert Slack
- Response time > 3s: Alert PagerDuty
- Database connections > 80%: Auto-scale
- Disk usage > 90%: Alert immediately

---

### Database Design Principles

**Multi-Tenancy:**
- Single database with `tenant_id` column (shared schema)
- Row-Level Security (RLS) policies in PostgreSQL
- Each query filtered by `tenant_id` automatically

**Sharding (Phase 3):**
- Shard by `tenant_id` (each franchise = separate shard)
- Consistent hashing for shard assignment
- Global lookup table for tenant → shard mapping

**Connection Pooling:**
- Use PgBouncer (or Neon's built-in pooling)
- Max connections: 100 per service
- Connection timeout: 30 seconds

---

### API Versioning

**Strategy: URL-based versioning**
```
/api/v1/bookings
/api/v2/bookings
```

**Backward Compatibility:**
- Maintain v1 for 12 months after v2 release
- Deprecation warnings in response headers:
  ```
  X-API-Version: 1
  X-API-Deprecated: true
  X-API-Sunset: 2026-12-31
  ```

---

### Security

**HTTPS Only:**
- All endpoints require HTTPS
- HSTS header enforced

**CORS:**
- Whitelist: `petwash.co.il`, `petwash.app`
- Allow credentials: Yes

**Input Validation:**
- Validate all inputs server-side (Zod schemas)
- Sanitize HTML (prevent XSS)
- SQL injection prevention (use parameterized queries)

**Secrets Management:**
- Use Replit Secrets (Phase 1)
- Migrate to AWS Secrets Manager / Google Secret Manager (Phase 2+)
- Rotate secrets quarterly

**DDoS Protection:**
- Cloudflare (Phase 1)
- AWS Shield (Phase 3)

---

## Migration Strategy: Monolith → Microservices

### Step 1: Identify Bottleneck
Monitor metrics. If **Booking Service** is slow:
→ Extract Booking Service first

### Step 2: Create New Service
1. Copy booking logic to new `booking-service` repo
2. Connect to same PostgreSQL database (shared for now)
3. Deploy independently

### Step 3: Route Traffic
Edge server routes `/api/bookings` to new service:
```javascript
// Edge server routing
if (req.path.startsWith('/api/bookings')) {
  proxy(req, 'http://booking-service:3000');
} else {
  // Handle locally
}
```

### Step 4: Gradual Rollout
- 10% traffic to new service (canary)
- Monitor errors, latency
- If OK, ramp to 100%
- Remove booking logic from monolith

### Step 5: Repeat
Extract next bottleneck service (usually Payment or Notification)

---

## Deployment Architecture

### Phase 1 (Current)
```
Replit → Single Node.js server
       → Neon PostgreSQL (serverless)
       → Google Cloud Storage
```

### Phase 2 (200+ users)
```
Replit → 3 instances (auto-scaling)
       → Neon PostgreSQL (paid plan, more connections)
       → Redis (Upstash or Render)
       → Google Cloud Storage
```

### Phase 3 (5,000+ users)
```
AWS / GCP
├── ALB (Load Balancer)
├── ECS/Kubernetes (container orchestration)
│   ├── Edge Server (3+ instances)
│   ├── Auth Service (2 instances)
│   ├── Booking Service (5 instances)
│   ├── Payment Service (3 instances)
│   └── ... (other services)
├── RDS PostgreSQL (read replicas)
├── ElastiCache Redis (cluster mode)
├── S3 / Google Cloud Storage
└── CloudWatch / Datadog (monitoring)
```

---

## Cost Estimates

### Phase 1 (0-200 users)
- Replit: $0-20/month (free tier or hobby plan)
- Neon PostgreSQL: $0-19/month (free tier or starter)
- Google Cloud Storage: $0-5/month (free tier covers most)
- **Total: ~$0-45/month**

### Phase 2 (200-5,000 users)
- Replit: $100-300/month (autoscaling, 3-5 instances)
- Neon PostgreSQL: $69-199/month (Pro plan)
- Redis (Upstash): $20-50/month
- Google Cloud Storage: $10-30/month
- SendGrid: $20/month (email)
- Twilio: $50/month (SMS)
- **Total: ~$270-650/month**

### Phase 3 (5,000-100,000 users)
- AWS ECS/Kubernetes: $500-1,500/month
- RDS PostgreSQL: $200-800/month
- ElastiCache Redis: $100-300/month
- S3 Storage: $50-150/month
- CloudWatch/Datadog: $100-300/month
- **Total: ~$1,000-3,000/month**

### Phase 4 (100,000-1M+ users)
- Cloud infrastructure: $5,000-15,000/month
- Database (sharded): $2,000-5,000/month
- CDN (Cloudflare): $200-500/month
- Monitoring & logging: $500-1,000/month
- **Total: ~$8,000-22,000/month**

---

## Performance Targets

### API Response Times
- **p50 (median):** < 100ms
- **p95:** < 300ms
- **p99:** < 1s

### Database Queries
- **Read queries:** < 10ms
- **Write queries:** < 50ms
- **Complex queries (joins):** < 100ms

### Real-Time Features
- **GPS tracking update latency:** < 1s
- **Chat message delivery:** < 500ms
- **Notification delivery:** < 2s

### Uptime
- **Target:** 99.9% (< 43 minutes downtime/month)
- **Stretch goal:** 99.99% (< 4.3 minutes downtime/month)

---

## Technology Decisions

### Language & Runtime
- **Current:** Node.js (JavaScript)
- **Future services:** TypeScript for type safety
- **Alternative:** Go for high-performance services (Payment, Location)

### Database
- **Primary:** PostgreSQL (Neon) - ACID compliance, strong consistency
- **Cache:** Redis - Fast reads, session storage
- **Search:** Elasticsearch - Full-text search
- **Time-series:** TimescaleDB - GPS tracking, analytics

### Message Queue
- **Phase 1:** Not needed
- **Phase 2:** Redis pub/sub (simple)
- **Phase 3:** RabbitMQ or AWS SQS (reliable)

### API Protocol
- **REST:** Primary (HTTPS/JSON)
- **WebSocket:** Real-time features (chat, GPS tracking)
- **GraphQL:** Optional (if client requests it)

---

## Disaster Recovery

### Backup Strategy
- **Database:** Daily automated backups (Neon built-in)
- **Files:** Replicated across regions (Google Cloud Storage)
- **Retention:** 30 days

### Recovery Objectives
- **RTO (Recovery Time Objective):** < 1 hour
- **RPO (Recovery Point Objective):** < 15 minutes

### Failover Plan
1. Monitor health checks
2. If primary database fails → Auto-failover to read replica
3. If entire region fails → Traffic routed to secondary region (Phase 3)

---

**Status:** Backend Architecture Complete ✅  
**Phase 1 Implementation:** Ready (stateless edge server deployed)  
**Phase 2 Roadmap:** Defined (extract services as needed)  
**Phase 3 Strategy:** Documented (microservices blueprint)  
**Scalability:** 100 → 200 → 5,000 → 1M+ users
