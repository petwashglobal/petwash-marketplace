# Pet Wash Ltd - DevOps & Scalability Roadmap

## Overview
Complete infrastructure roadmap for scaling from 100 users to 1M+ users globally. Production deployment strategy, monitoring, logging, CI/CD, and disaster recovery.

---

## Phase 1: MVP Launch (0-200 Users)

### Current State
**Deployment:** Replit (petwash.co.il)
**Database:** Neon PostgreSQL (serverless, free tier)
**CDN:** Cloudflare (free tier)
**Auth:** Firebase Authentication
**Storage:** Google Cloud Storage

### Infrastructure
```
┌─────────────────────────────┐
│   Cloudflare CDN (Global)   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Replit Edge Server        │
│   (single Node.js instance) │
└──────────┬──────────────────┘
           │
           ├─► Neon PostgreSQL (serverless)
           ├─► Firebase Auth
           └─► Google Cloud Storage
```

### Deployment Process
1. **Git Push** → GitHub main branch
2. **Replit Auto-Deploy** → Triggered on push
3. **Health Check** → `/health` endpoint verified
4. **DNS Update** → Cloudflare routes to new instance

**Rollback:** Replit provides instant rollback to previous deployment

### Monitoring
```javascript
// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Status endpoint with database check
app.get('/status', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.json({
      status: 'operational',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'degraded',
      database: 'disconnected',
      error: error.message
    });
  }
});
```

### Logging
- **Console logs** → Replit built-in logs
- **Error tracking** → Manual alerts (check daily)

### Metrics Tracked
- **Uptime:** Target 99%
- **Response time:** < 500ms (p95)
- **Error rate:** < 1%

**Cost:** ~$0-20/month (free tier)

---

## Phase 2: Growth (200-5,000 Users)

### Infrastructure Changes

```
┌─────────────────────────────┐
│   Cloudflare CDN (Global)   │
│   + Rate Limiting            │
│   + DDoS Protection          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Replit Auto-Scaling       │
│   (3-5 instances)           │
└──────────┬──────────────────┘
           │
           ├─► Neon PostgreSQL (Pro Plan)
           │   • 100 GB storage
           │   • Read replicas
           │
           ├─► Redis (Upstash or Render)
           │   • Session storage
           │   • Cache layer
           │
           ├─► Firebase Auth
           │
           └─► Google Cloud Storage
               • CDN enabled
```

### Deployment Improvements
**CI/CD Pipeline** (GitHub Actions)
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Replit
        run: |
          curl -X POST ${{ secrets.REPLIT_DEPLOY_WEBHOOK }}
      
      - name: Health Check
        run: |
          sleep 30
          curl https://petwash.co.il/health
```

### Monitoring & Alerting
**Tools:** UptimeRobot (free) + Replit monitoring

**Alerts:**
```
• Site down → SMS to on-call engineer
• Error rate > 5% → Slack alert
• Response time > 2s → Email alert
• Database connections > 80% → Auto-scale trigger
```

**Metrics Dashboard:**
```javascript
// Prometheus-compatible metrics endpoint
app.get('/metrics', (req, res) => {
  res.send(`
    # HELP http_requests_total Total HTTP requests
    # TYPE http_requests_total counter
    http_requests_total{method="GET",route="/"} ${metrics.homePageViews}
    http_requests_total{method="POST",route="/api/bookings"} ${metrics.bookings}
    
    # HELP http_request_duration_seconds HTTP request latency
    # TYPE http_request_duration_seconds histogram
    http_request_duration_seconds{quantile="0.5"} ${metrics.p50}
    http_request_duration_seconds{quantile="0.95"} ${metrics.p95}
    http_request_duration_seconds{quantile="0.99"} ${metrics.p99}
  `);
});
```

### Logging
**Structured Logging** (Logtail or Papertrail)
```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

logger.info({ userId: 123, action: 'booking.created' }, 'User created booking');
logger.error({ err, userId: 123 }, 'Payment failed');
```

**Log Aggregation:**
- All instances send logs to central service
- Searchable by user ID, request ID, platform
- Retention: 30 days

### Performance Optimization
```javascript
// Response compression
import compression from 'compression';
app.use(compression());

// Rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Caching layer (Redis)
async function getCachedData(key, fetchFn, ttl = 300) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

**Cost:** ~$100-300/month

---

## Phase 3: Scale-Up (5,000-100,000 Users)

### Infrastructure Migration

```
┌──────────────────────────────────────────┐
│   Cloudflare CDN (Global)                │
│   + WAF (Web Application Firewall)       │
│   + Bot Protection                        │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│   AWS ALB (Application Load Balancer)    │
│   + SSL Termination                      │
│   + Health Checks                        │
└────────────┬─────────────────────────────┘
             │
             ├──► Edge Server (3+ instances, auto-scaling)
             │
             ├──► Booking Service (5 instances)
             │
             ├──► Payment Service (3 instances)
             │
             └──► Notification Service (2 instances)
                  
┌──────────────────────────────────────────┐
│   Data Layer                             │
├──────────────────────────────────────────┤
│   • PostgreSQL (RDS Multi-AZ)            │
│     - Primary + 2 read replicas          │
│   • Redis Cluster (ElastiCache)          │
│     - 3 nodes, failover enabled          │
│   • Elasticsearch (search)               │
│   • S3 (file storage + CDN)              │
└──────────────────────────────────────────┘
```

### Microservices Architecture
**Separate services deployed:**
- Edge Server (API Gateway)
- Auth Service
- Booking Service
- Payment Service
- Notification Service
- Location Service (GPS tracking)
- Analytics Service

**Communication:** REST APIs + Message Queue (RabbitMQ)

### Deployment Strategy
**Blue-Green Deployment:**
```
Blue Environment (current production)
↓
Deploy Green Environment (new version)
↓
Run health checks on Green
↓
Route 10% traffic to Green (canary)
↓
Monitor for 30 minutes
↓
If OK: Route 100% to Green
If ERROR: Rollback to Blue
```

**Rollback Time:** < 5 minutes

### Monitoring Stack
**Tools:** Datadog or New Relic

**Dashboards:**
1. **Application Performance Monitoring (APM)**
   - Request rate, error rate, latency
   - Per-service metrics
   - Database query performance
   - Cache hit rate

2. **Infrastructure Monitoring**
   - CPU, memory, disk usage
   - Network I/O
   - Auto-scaling events

3. **Business Metrics**
   - Bookings per minute
   - Revenue per hour
   - Active users
   - Conversion funnel

**Alerts:**
```yaml
Alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5 minutes
    notify: pagerduty, slack
    severity: critical
  
  - name: Slow Response Time
    condition: p95_latency > 2s
    duration: 10 minutes
    notify: slack
    severity: warning
  
  - name: Database Connection Pool
    condition: active_connections > 80%
    duration: 5 minutes
    notify: slack, auto_scale
    severity: warning
```

### Logging & Tracing
**ELK Stack** (Elasticsearch, Logstash, Kibana)
- All services send logs to Logstash
- Elasticsearch indexes and stores
- Kibana for visualization and search

**Distributed Tracing** (Jaeger)
```javascript
import { trace } from '@opentelemetry/api';

const span = trace.getTracer('booking-service').startSpan('create_booking');
try {
  // Business logic
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

**Benefits:**
- Trace requests across multiple services
- Identify bottlenecks
- Debug production issues faster

### Database Optimization
**Read Replicas:**
```javascript
// Write operations → Primary
const result = await primaryDB.insert(bookings).values(newBooking);

// Read operations → Replica (load-balanced)
const booking = await replicaDB.select().from(bookings).where(eq(bookings.id, id));
```

**Connection Pooling:**
```javascript
import { Pool } from 'pg';
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  max: 20, // Max 20 connections per service
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Partitioning** (for time-series data):
```sql
-- Partition location_updates by month
CREATE TABLE location_updates_2025_11 PARTITION OF location_updates
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE location_updates_2025_12 PARTITION OF location_updates
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

### Caching Strategy
**Multi-Layer Cache:**
```
┌─────────────────────────────┐
│   CDN Cache (Cloudflare)    │  ← Static assets, images
│   TTL: 1 week               │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Redis Cache (ElastiCache) │  ← API responses, user profiles
│   TTL: 5-60 minutes         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Database Query Cache      │  ← Database layer
│   (PostgreSQL built-in)     │
└─────────────────────────────┘
```

**Cost:** ~$1,000-3,000/month

---

## Phase 4: Global Scale (100,000-1M+ Users)

### Multi-Region Architecture

```
┌─────────────────────────────────────────────────────┐
│   Global Load Balancer (Cloudflare / AWS Route 53) │
│   + Geo-routing (Israel, USA, Europe, Asia)        │
└────────────────┬────────────────────────────────────┘
                 │
     ┌───────────┼───────────┬───────────────┐
     │           │           │               │
     ▼           ▼           ▼               ▼
┌─────────┐ ┌─────────┐ ┌─────────┐  ┌─────────────┐
│  Israel │ │   USA   │ │ Europe  │  │    Asia     │
│ Region  │ │ Region  │ │ Region  │  │   Region    │
└─────────┘ └─────────┘ └─────────┘  └─────────────┘
     │           │           │               │
     └───────────┴───────────┴───────────────┘
                      │
                      ▼
          ┌──────────────────────────┐
          │  Global Database Layer   │
          │  • Sharded by tenant_id  │
          │  • Multi-region replicas │
          │  • Eventually consistent │
          └──────────────────────────┘
```

### Database Sharding
**Shard by Tenant ID:**
```javascript
function getShardForTenant(tenantId) {
  const shardCount = 10;
  const shardId = hashCode(tenantId) % shardCount;
  return shardConfig[shardId];
}

// Routing layer
async function query(tenantId, sql) {
  const shard = getShardForTenant(tenantId);
  const db = connectToShard(shard.host);
  return db.execute(sql);
}
```

**Shard Configuration:**
```javascript
const shardConfig = [
  { id: 0, host: 'db-shard-0.petwash.co.il', region: 'il-central' },
  { id: 1, host: 'db-shard-1.petwash.co.il', region: 'il-central' },
  { id: 2, host: 'db-shard-2.petwash.co.il', region: 'us-east' },
  { id: 3, host: 'db-shard-3.petwash.co.il', region: 'us-west' },
  // ... up to 10 shards
];
```

### Service Mesh (Istio)
**Benefits:**
- Service-to-service authentication (mTLS)
- Load balancing
- Circuit breaking
- Distributed tracing
- Traffic management (A/B testing, canary deployments)

### Kubernetes (K8s) Orchestration
```yaml
# Deployment config for Booking Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: booking-service
spec:
  replicas: 10
  template:
    spec:
      containers:
      - name: booking-service
        image: petwash/booking-service:v2.1.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: booking-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: booking-service
  minReplicas: 10
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Message Queue (Kafka)
**Event-Driven Architecture:**
```javascript
// Publish booking event
await kafka.publish('booking.created', {
  tenantId: 'franchise-001',
  bookingId: 'booking-123',
  customerId: 'user-456',
  platform: 'walk-my-pet',
  amount: 25.00
});

// Consumers:
// 1. Notification Service → Send confirmation email
// 2. Analytics Service → Track conversion
// 3. Loyalty Service → Award points
// 4. Payment Service → Capture authorized amount
```

### Cost Estimation (1M Users)
```
Infrastructure:
- Kubernetes Cluster (10+ nodes)       $3,000/month
- Database (sharded, replicas)         $2,000/month
- Redis Cluster                        $500/month
- Elasticsearch                        $800/month
- Message Queue (Kafka)                $400/month
- Load Balancers                       $300/month
- CDN (Cloudflare Enterprise)          $200/month
- Monitoring (Datadog)                 $500/month
- Log Storage                          $300/month

Total: ~$8,000-10,000/month

Additional:
- Firebase Auth                        $500/month
- Google Cloud Storage                 $200/month
- SMS (Twilio)                         $1,000/month
- Email (SendGrid)                     $500/month

Grand Total: ~$10,000-12,000/month
```

---

## CI/CD Pipeline (Production-Ready)

### GitHub Actions Workflow
```yaml
name: Production Deploy Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Production
        run: |
          curl -X POST ${{ secrets.DEPLOY_WEBHOOK }}
      
      - name: Wait for deployment
        run: sleep 60
      
      - name: Health check
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://petwash.co.il/health)
          if [ $response -ne 200 ]; then
            echo "Health check failed!"
            exit 1
          fi
      
      - name: Smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: https://petwash.co.il
      
      - name: Notify Slack
        if: always()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"Deploy ${{ job.status }}: ${{ github.sha }}"}'
```

---

## Disaster Recovery Plan

### Backup Strategy
**Database:**
- **Automated:** Daily full backups at 2 AM UTC
- **Retention:** 30 days
- **Point-in-Time Recovery:** 7 days
- **Storage:** S3 (multiple regions)

**Files:**
- **Google Cloud Storage:** Multi-region replication
- **Retention:** Indefinite

**Configuration:**
- **Git:** All infrastructure as code in GitHub
- **Secrets:** AWS Secrets Manager (encrypted, replicated)

### Recovery Procedures
**Scenario 1: Database Corruption**
1. Stop all write operations
2. Restore from latest backup (< 1 hour old)
3. Replay WAL logs to get to desired point
4. Verify data integrity
5. Resume operations
**RTO:** 1 hour | **RPO:** 15 minutes

**Scenario 2: Region Failure (AWS us-east-1)**
1. Automatic traffic failover to us-west-2
2. Promote read replica to primary
3. Update DNS (via Route 53 health checks)
**RTO:** 5 minutes | **RPO:** 0 (real-time replication)

**Scenario 3: Complete Platform Failure**
1. Spin up new infrastructure from IaC (Terraform)
2. Restore database from backup
3. Deploy latest version from Git
4. Update DNS
**RTO:** 4 hours | **RPO:** 1 hour

### Runbooks
**Incident Response:**
1. **Detect:** Automated alerting (PagerDuty)
2. **Assess:** Severity (P1=critical, P2=high, P3=medium, P4=low)
3. **Communicate:** Update status page, notify stakeholders
4. **Mitigate:** Follow runbook for specific incident type
5. **Resolve:** Fix root cause
6. **Post-Mortem:** Document lessons learned

---

## Security & Compliance

### Security Measures
- **DDoS Protection:** Cloudflare
- **WAF:** Web Application Firewall (block SQL injection, XSS)
- **Rate Limiting:** Per-IP, per-user
- **HTTPS Only:** Enforce TLS 1.3
- **Secrets Management:** AWS Secrets Manager / Google Secret Manager
- **Database Encryption:** At rest (AES-256), in transit (TLS)
- **API Authentication:** JWT tokens, short-lived (15 min)
- **RBAC:** Role-Based Access Control (admin, franchise-owner, operator, customer)

### Compliance
- **GDPR:** User data export, right to deletion
- **PCI-DSS:** Payment card data (use Stripe/Nayax tokenization)
- **Israeli Privacy Law:** Data residency (Israel-based DB for Israeli users)
- **Data Retention:** 7 years for financial records (Israel tax law)

---

## Performance Optimization

### Frontend
- **Code Splitting:** Lazy load routes
- **Image Optimization:** WebP format, lazy loading
- **CDN:** Serve assets from nearest edge location
- **Minification:** JS, CSS compression
- **Caching:** Aggressive cache headers for static assets

### Backend
- **Database Indexing:** Optimize queries
- **Connection Pooling:** Reuse DB connections
- **Caching:** Redis for hot data
- **Async Operations:** Non-blocking I/O
- **Load Balancing:** Distribute traffic evenly

### Targets
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **API Response Time (p95):** < 300ms
- **Database Query (p95):** < 50ms

---

## Scalability Milestones

### 100 Users → 1,000 Users
**Bottleneck:** None (Phase 1 handles easily)
**Action:** Monitor, no changes needed

### 1,000 → 10,000 Users
**Bottleneck:** Database connections
**Action:** Enable connection pooling, add read replica

### 10,000 → 100,000 Users
**Bottleneck:** Single server CPU
**Action:** Migrate to microservices, horizontal scaling

### 100,000 → 1M Users
**Bottleneck:** Database write throughput
**Action:** Shard database by tenant, multi-region deployment

---

**Status:** DevOps Roadmap Complete ✅  
**Coverage:** Phase 1 (MVP) → Phase 4 (Global Scale)  
**Deployment:** Replit → AWS/GCP  
**Monitoring:** Basic → Enterprise (Datadog, ELK)  
**Cost:** $20/month → $12,000/month  
**Scalability:** 100 → 1M+ users documented
