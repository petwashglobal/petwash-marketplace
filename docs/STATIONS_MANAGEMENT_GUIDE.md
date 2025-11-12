# Stations Management Platform - Complete Guide

## Overview

The Stations Management Platform is a comprehensive system for tracking and managing physical Pet Wash™ stations across Israel. It provides real-time inventory monitoring, automated alerts, utility management, and health analytics.

## Table of Contents

1. [Architecture](#architecture)
2. [Data Models](#data-models)
3. [API Endpoints](#api-endpoints)
4. [Automated Alerts](#automated-alerts)
5. [Admin UI](#admin-ui)
6. [Cron Jobs](#cron-jobs)
7. [Manual Testing](#manual-testing)
8. [Sample Data](#sample-data)

---

## Architecture

### Technology Stack

- **Backend**: Express.js with TypeScript
- **Database**: Firestore (Firebase)
- **Scheduling**: node-cron
- **Notifications**: SendGrid (email) + Slack webhooks
- **UI**: React with shadcn/ui components

### Firestore Collections

1. **stations** - Main station registry
2. **station_inventory** - Real-time inventory tracking
3. **station_events** - Audit trail of all station events
4. **station_usage_daily** - Daily usage analytics (for future expansion)

---

## Data Models

### Station Schema

```typescript
interface Station {
  serialNumber: string;              // Unique ID (e.g., "PW-TLV-001")
  status: 'active' | 'installing' | 'maintenance' | 'offline' | 'decommissioned';
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    coordinates?: { lat: number; lng: number };
  };
  installation: {
    date: Date;
    technician: string;
    notes?: string;
  };
  equipment: {
    model: string;
    manufacturer: string;
    warranty?: { expiresAt: Date };
    lastMaintenance?: Date;
    nextMaintenance?: Date;
  };
  utilities: {
    electricity?: { provider: string; accountNumber: string; renewalDate?: Date };
    water?: { provider: string; accountNumber: string; renewalDate?: Date };
    internet?: { provider: string; accountNumber: string; renewalDate?: Date };
  };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  thresholds: {
    minStock: {
      shampoo: number;      // Liters
      conditioner: number;
      disinfectant: number;
      fragrance: number;
    };
    maintenanceHours: number;
  };
  metadata: {
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
  };
}
```

### Inventory Schema

```typescript
interface StationInventory {
  stationId: string;
  items: {
    shampoo: { onHand: number; unit: 'L'; lastRestocked?: Date };
    conditioner: { onHand: number; unit: 'L'; lastRestocked?: Date };
    disinfectant: { onHand: number; unit: 'L'; lastRestocked?: Date };
    fragrance: { onHand: number; unit: 'L'; lastRestocked?: Date };
  };
  usage?: {
    dailyAverage: {
      shampoo: number;
      conditioner: number;
      disinfectant: number;
      fragrance: number;
    };
  };
  updatedAt: Date;
}
```

### Event Schema

```typescript
interface StationEvent {
  stationId: string;
  type: 'maintenance' | 'restock' | 'incident' | 'status_change' | 
        'low_stock' | 'policy_expiring' | 'inspection';
  at: Date;
  by: string;  // User ID or 'system'
  data?: Record<string, any>;
}
```

---

## API Endpoints

### Station CRUD

#### GET /api/admin/stations
List all stations with optional filters.

**Query Params:**
- `status` - Filter by status (active, installing, etc.)
- `city` - Filter by city
- `search` - Search by serial number or name

**Response:**
```json
{
  "stations": [
    {
      "id": "abc123",
      "serialNumber": "PW-TLV-001",
      "status": "active",
      "address": { ... },
      ...
    }
  ]
}
```

#### GET /api/admin/stations/:id
Get detailed station info with inventory and recent events.

**Response:**
```json
{
  "station": { ... },
  "inventory": { ... },
  "recentEvents": [ ... ]
}
```

#### POST /api/admin/stations
Create a new station.

**Request Body:** Insert station schema (metadata auto-generated)

#### PUT /api/admin/stations/:id
Update station details.

**Request Body:** Partial station schema

#### DELETE /api/admin/stations/:id
Soft delete a station (sets status to 'decommissioned').

### Inventory Management

#### GET /api/admin/inventory/:stationId
Get inventory for a specific station.

#### PUT /api/admin/inventory/:stationId
Update inventory levels (auto-creates event).

**Request Body:**
```json
{
  "items": {
    "shampoo": { "onHand": 45, "unit": "L" },
    "conditioner": { "onHand": 30, "unit": "L" },
    "disinfectant": { "onHand": 25, "unit": "L" },
    "fragrance": { "onHand": 12, "unit": "L" }
  }
}
```

### Events

#### GET /api/admin/events
Get all events with optional filters.

**Query Params:**
- `stationId` - Filter by station
- `type` - Filter by event type
- `limit` - Max results (default: 100)

#### POST /api/admin/events
Create a new event (manual log entry).

**Request Body:**
```json
{
  "stationId": "abc123",
  "type": "maintenance",
  "by": "admin-uid",
  "data": {
    "description": "Regular maintenance check",
    "duration": 120
  }
}
```

### Alerts

#### GET /api/admin/alerts
Get all active alerts (low stock + expiring utilities).

**Response:**
```json
{
  "lowStock": [
    {
      "stationId": "abc123",
      "serialNumber": "PW-JLM-002",
      "city": "Jerusalem",
      "item": "shampoo",
      "onHand": 18,
      "threshold": 20
    }
  ],
  "expiringUtilities": [
    {
      "stationId": "abc123",
      "serialNumber": "PW-TLV-001",
      "utilityType": "electricity",
      "provider": "IEC",
      "daysUntilRenewal": 12
    }
  ]
}
```

### Health & Stats

#### GET /api/admin/health/stations
Get system-wide health summary.

**Response:**
```json
{
  "totalStations": 3,
  "byStatus": {
    "active": 2,
    "installing": 1
  },
  "lowStockCount": 1,
  "healthy": 2
}
```

### Google Sheets Sync

#### POST /api/admin/sheets/sync
Manually trigger Google Sheets sync (placeholder).

---

## Automated Alerts

### Low Stock Detection

**Schedule:** Daily at 07:10 Israel time

**Logic:**
1. Query all active/installing stations
2. For each station, compare inventory levels to thresholds
3. Generate alerts for items below threshold
4. Group by station and send email + Slack notification

**Alert Severity:**
- **Critical**: onHand = 0 (out of stock)
- **High**: onHand < threshold / 2
- **Medium**: onHand < threshold

### Utility Renewal Alerts

**Schedule:** Daily at 07:20 Israel time

**Logic:**
1. Query all active/installing stations
2. Check all utility renewal dates (electricity, water, internet)
3. Alert for renewals within 30, 14, or 7 days

**Alert Severity:**
- **Critical**: ≤ 7 days
- **High**: ≤ 14 days
- **Medium**: ≤ 30 days

### Notification Channels

1. **Email**: sent to `Support@PetWash.co.il`
2. **Slack**: posted to configured webhook channel

---

## Admin UI

### Access

Navigate to `/admin/stations` (requires admin authentication).

### Tabs

#### 1. Stations List
- View all stations
- Filter by status, city
- Search by serial number
- Quick actions: Edit, View Inventory, Delete

#### 2. Alerts & Warnings
- Real-time low stock alerts
- Expiring utility renewals
- Color-coded severity (red, amber, yellow)
- Direct links to affected stations

#### 3. System Health
- Total stations count
- Status breakdown (pie chart style)
- Low stock count
- Health indicators

---

## Cron Jobs

### Registered Jobs

```javascript
// Low stock alerts
cron.schedule('10 7 * * *', checkLowStockAlerts, { timezone: 'Asia/Jerusalem' });

// Utility renewal alerts
cron.schedule('20 7 * * *', checkUtilityRenewalAlerts, { timezone: 'Asia/Jerusalem' });

// Google Sheets sync (placeholder)
cron.schedule('30 7 * * *', syncStationsToGoogleSheets, { timezone: 'Asia/Jerusalem' });
```

### Logs

All cron jobs log to server logs with `[Stations]` prefix:
```
[Stations] Checking low stock alerts...
[Stations] Found 2 low stock alerts
[Stations] Low stock notifications sent
```

---

## Manual Testing

### Test Endpoints

All test endpoints require admin authentication.

#### 1. Test Low Stock Alerts

```bash
POST /api/admin/stations/test/low-stock

Response:
{
  "success": true,
  "message": "Low stock check completed. Check email and Slack for alerts.",
  "timestamp": "2025-10-19T10:00:00.000Z"
}
```

#### 2. Test Utility Renewals

```bash
POST /api/admin/stations/test/utility-renewals

Response:
{
  "success": true,
  "message": "Utility renewal check completed. Check email and Slack for alerts.",
  "timestamp": "2025-10-19T10:00:00.000Z"
}
```

#### 3. Test Google Sheets Sync

```bash
POST /api/admin/stations/test/google-sheets-sync

Response:
{
  "success": true,
  "message": "Google Sheets sync completed (placeholder - not yet implemented).",
  "timestamp": "2025-10-19T10:00:00.000Z"
}
```

---

## Sample Data

### Seeding Sample Stations

Run the seed script to create 3 sample stations:

```bash
tsx scripts/seed-sample-stations.ts
```

**Creates:**
- **PW-TLV-001**: Tel Aviv (Active, good stock levels)
- **PW-JLM-002**: Jerusalem (Active, LOW STOCK - triggers alerts)
- **PW-HFA-003**: Haifa (Installing, empty inventory)

**Sample Events:**
- Maintenance event (30 days ago)
- Restock event (15 days ago)
- Incident event (7 days ago)

---

## Future Enhancements

### Planned Features

1. **Google Sheets Integration**
   - Bi-directional sync with Google Sheets
   - 3 tabs: Stations, Inventory, Alerts
   - Real-time updates via Google Sheets API

2. **Advanced Analytics**
   - Usage trends and forecasting
   - Predictive restocking recommendations
   - Cost analysis per station

3. **Mobile App**
   - Field technician app for inventory updates
   - QR code scanning for quick station access
   - Offline mode with sync

4. **Geofencing Alerts**
   - Alert field teams when near stations with issues
   - Route optimization for restocking

5. **Integration with K9000 Monitoring**
   - Cross-reference with smart monitoring alerts
   - Unified dashboard for station health

---

## API Testing with cURL

### Create a Station

```bash
curl -X POST https://petwash.co.il/api/admin/stations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "PW-BRS-004",
    "status": "installing",
    "address": {
      "street": "Rothschild 1",
      "city": "Beer Sheva",
      "postalCode": "8414101",
      "country": "Israel"
    },
    "installation": {
      "date": "2025-11-01T00:00:00.000Z",
      "technician": "TBD"
    },
    "equipment": {
      "model": "K9000 Standard",
      "manufacturer": "Pet Wash Industries"
    },
    "contact": {
      "name": "Contact Name",
      "phone": "+972-50-0000000",
      "email": "brs004@petwash.co.il"
    },
    "thresholds": {
      "minStock": {
        "shampoo": 20,
        "conditioner": 15,
        "disinfectant": 10,
        "fragrance": 5
      },
      "maintenanceHours": 500
    }
  }'
```

### Update Inventory

```bash
curl -X PUT https://petwash.co.il/api/admin/inventory/STATION_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": {
      "shampoo": { "onHand": 50, "unit": "L" },
      "conditioner": { "onHand": 40, "unit": "L" },
      "disinfectant": { "onHand": 30, "unit": "L" },
      "fragrance": { "onHand": 20, "unit": "L" }
    }
  }'
```

### Trigger Test Alert

```bash
curl -X POST https://petwash.co.il/api/admin/stations/test/low-stock \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Troubleshooting

### No Alerts Received

1. Check server logs for `[Stations]` prefix
2. Verify email service is configured (SendGrid API key)
3. Verify Slack webhook URL is set in environment
4. Manually trigger test endpoint to debug

### Inventory Not Updating

1. Check Firestore permissions
2. Verify station ID exists
3. Check server logs for errors
4. Ensure request body matches schema

### Cron Jobs Not Running

1. Check background job processor started: `Background job processor started`
2. Verify timezone configuration: `Asia/Jerusalem`
3. Check for cron syntax errors in logs
4. Test with manual trigger endpoints

---

## Support

For questions or issues with the Stations Management Platform:

- **Email**: Support@PetWash.co.il
- **Slack**: #pet-wash-tech channel
- **Documentation**: `/docs/STATIONS_MANAGEMENT_GUIDE.md`

---

**Last Updated**: October 19, 2025  
**Version**: 1.0.0  
**Author**: Pet Wash™ Development Team
