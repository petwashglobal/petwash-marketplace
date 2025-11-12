# Enterprise Data Seeding

This directory contains scripts for seeding the Pet Wash™ Enterprise platform with realistic demo data.

## Quick Start

**Step 1: Push Enterprise Schema to Database**
```bash
# This creates all the enterprise tables in your database
# When prompted about tables, select "+ create table" option
npm run db:push
```

**Step 2: Run the Seeding Script**
```bash
# Install tsx if you haven't already
npm i -D tsx

# Run the seeding script
npx tsx scripts/seed-enterprise.ts
```

You should see output like this:
```
🚀 Starting Pet Wash™ Enterprise Data Seeding...
📍 Seeding countries...
✅ Created 3 countries
...
🎉 ENTERPRISE SEEDING COMPLETE!
```

## What Gets Seeded

The script populates the following data:

### Geographic Coverage
- **5 Countries**: Israel, USA, UK, France, Germany
- **12 Territories**: Tel Aviv, Jerusalem, Haifa, California, New York, Texas, London, Manchester, Paris, Provence, Berlin, Bavaria
- **3 Franchisees**: Active franchisees in Israel, USA, and UK

### Operational Data
- **8 Stations**: Distributed across Israel (3), USA (3), UK (2)
  - Mix of health statuses: healthy, warning, critical
  - Various operational statuses: active, maintenance
  - Realistic locations and coordinates
- **4 Bills**: Water, electricity, rent with various payment statuses
- **5 Spare Parts**: Pumps, heaters, valves, nozzles, filters with realistic pricing
- **6 Inventory Records**: Station-level spare parts tracking
- **3 Work Orders**: Corrective, preventive, and completed maintenance tasks

### Customer & Subscriptions
- **3 Subscription Plans**: Basic ($39.99), Premium ($69.99), Unlimited ($99.99)
- **3 Active Subscribers**: With remaining wash credits

### IoT & Monitoring
- **3 Telemetry Readings**: Real-time sensor data (temperature, pressure, flow, power)
- **3 Alerts**: Critical pump failure, temperature warning, low inventory info
- **3 Performance Metrics**: Daily station performance with revenue, uptime, satisfaction scores

## Access the Dashboards

After seeding, you can access:

1. **HQ Admin Dashboard**: `/enterprise/hq`
   - Global map view with 8 stations
   - Network KPIs and analytics
   - Territory and franchisee management

2. **Franchisee Dashboard**: `/enterprise/franchisee/1` (replace with actual ID)
   - Station portfolio
   - Revenue tracking
   - Maintenance and inventory management

3. **Technician Mobile View**: `/enterprise/technician/tech-001`
   - Work order management
   - Quick actions for field technicians

## Sample Login Credentials

- **Admin**: nirhadad1@gmail.com / PetWash2025!
- **Franchisee Firebase UID**: `franchisee-il-001`, `franchisee-us-001`, `franchisee-uk-001`
- **Technician IDs**: `tech-001`, `tech-002`, `tech-003`

## Clearing Data

If you need to reset and re-seed:

```bash
# Option 1: Manually truncate tables via database tool
# Option 2: Drop and recreate schema (destructive)
npm run db:push --force
npx tsx scripts/seed-enterprise.ts
```

## Customization

Edit `scripts/seed-enterprise.ts` to:
- Add more countries/territories
- Adjust station locations
- Modify pricing or currencies
- Change subscription plans
- Customize IoT sensor ranges

## Troubleshooting

**Error: Cannot find module**
```bash
npm i -D tsx
```

**Error: Database connection failed**
- Ensure DATABASE_URL is set in environment
- Check PostgreSQL is running

**Error: Duplicate key**
- Tables may already have data
- Clear existing data or modify script to use different values
