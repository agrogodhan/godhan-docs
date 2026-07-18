# ================================================================
#  CATTLE SMART COLLAR — API & DATABASE DOCUMENTATION
#  Version : 1.0.0
#  Stack   : Node.js + Express + MongoDB (Mongoose) + MQTT
# ================================================================

## PROJECT STRUCTURE
```
cattle_api/
├── server.js                  # API entry point
├── package.json
├── .env.example
├── config/
│   └── db.js                  # MongoDB connection
├── models/
│   └── index.js               # All 6 Mongoose schemas
├── routes/
│   ├── auth.js                # Authentication
│   ├── cows.js                # Cow management + readings
│   └── devices.js             # Devices + Alerts + Dashboard
├── middleware/
│   └── index.js               # JWT auth, validation, error handler
└── mqtt/
    └── ingester.js            # MQTT → MongoDB data pipeline
```

---

## MONGODB COLLECTIONS

### 1. farms
```json
{
  "_id": "ObjectId",
  "name": "Verma Dairy Farm",
  "location": { "city": "Pune", "state": "Maharashtra" },
  "compoundArea": 1,
  "zones": [{ "name": "shed" }, { "name": "open" }],
  "createdAt": "ISODate"
}
```

### 2. users
```json
{
  "_id": "ObjectId",
  "name": "Rajesh Verma",
  "phone": "9876543210",
  "email": "rajesh@farm.com",
  "role": "owner",
  "farm": "ObjectId → farms",
  "pushToken": "FCM_TOKEN",
  "alertPrefs": { "fever": true, "estrus": true, "calving": true }
}
```

### 3. devices
```json
{
  "_id": "ObjectId",
  "deviceId": "CattleCollar-A1B2C3",
  "farm": "ObjectId → farms",
  "cow": "ObjectId → cows",
  "firmwareVersion": "1.0.0",
  "status": "active",
  "lastSeen": "ISODate",
  "lastBatteryPct": 82,
  "lastZone": "shed"
}
```

### 4. cows
```json
{
  "_id": "ObjectId",
  "cowId": "COW-112",
  "farm": "ObjectId → farms",
  "device": "ObjectId → devices",
  "name": "Laxmi",
  "breed": "HF Cross",
  "dob": "ISODate",
  "baseline": { "bodyTempC": 38.8, "heartRate": 66 },
  "lastReading": {
    "timestamp": "ISODate",
    "bodyTempC": 38.6,
    "heartRate": 68,
    "spO2": 97,
    "estrusFlag": false,
    "calvingAlert": false
  },
  "healthScore": 92,
  "activeAlerts": 0,
  "reproHistory": []
}
```

### 5. sensor_readings  (time-series — TTL 90 days)
```json
{
  "_id": "ObjectId",
  "deviceId": "CattleCollar-A1B2C3",
  "cowId": "COW-112",
  "timestamp": "ISODate",
  "activity":      { "steps": 142, "posture": "grazing", "activityScore": 74 },
  "health":        { "bodyTempC": 38.6, "heartRate": 68, "spO2": 97, "ruminationCyclesHr": 420 },
  "reproduction":  { "vaginalTempC": 38.9, "estrusFlag": false, "calvingAlert": false },
  "alerts":        { "tempFever": false, "hrAlert": false, "spO2Alert": false },
  "device":        { "batteryPct": 82, "wifiRSSI": -58, "zone": "shed" },
  "expireAt": "ISODate (auto TTL)"
}
```

### 6. alerts
```json
{
  "_id": "ObjectId",
  "farm": "ObjectId",
  "cow": "ObjectId",
  "cowId": "COW-112",
  "deviceId": "CattleCollar-A1B2C3",
  "type": "fever",
  "severity": "critical",
  "message": "Cow COW-112: High body temperature 40.1°C",
  "triggeredAt": "ISODate",
  "vitals": { "bodyTempC": 40.1, "heartRate": 95, "spO2": 94 },
  "resolved": false,
  "resolvedAt": null,
  "resolution": null
}
```

---

## MONGODB INDEXES

```javascript
// sensor_readings — most critical for performance
{ cowId: 1,    timestamp: -1 }      // per-cow history queries
{ deviceId: 1, timestamp: -1 }      // per-device queries
{ farm: 1,     timestamp: -1 }      // farm-wide queries
{ expireAt: 1 }                     // TTL auto-delete (90 days)

// cows
{ farm: 1 }
{ cowId: 1, farm: 1 }  (unique)
{ "lastReading.estrusFlag": 1 }
{ "lastReading.calvingAlert": 1 }

// alerts
{ farm: 1, triggeredAt: -1 }
{ cowId: 1, triggeredAt: -1 }
{ type: 1, resolved: 1 }

// devices
{ deviceId: 1 }  (unique)
{ farm: 1 }
{ lastSeen: -1 }
```

---

## REST API ENDPOINTS

### Authentication

#### POST /api/auth/register
```json
// Request
{
  "name": "Rajesh Verma",
  "phone": "9876543210",
  "password": "secret123",
  "farmName": "Verma Dairy Farm",
  "location": { "city": "Pune", "state": "Maharashtra" }
}
// Response 201
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { "id": "...", "name": "Rajesh Verma", "role": "owner",
            "farm": { "id": "...", "name": "Verma Dairy Farm" } }
}
```

#### POST /api/auth/login
```json
// Request
{ "phone": "9876543210", "password": "secret123" }
// Response 200
{ "success": true, "token": "eyJhbGciOi...", "user": { ... } }
```

#### GET /api/auth/me  (🔒 JWT required)
```json
// Response
{ "success": true, "user": { "name": "...", "farm": { ... }, "alertPrefs": { ... } } }
```

---

### Dashboard

#### GET /api/dashboard  (🔒)
```json
// Response
{
  "success": true,
  "herd":    { "total": 120, "active": 118, "estrus": 3, "calving": 1 },
  "devices": { "online": 115, "offline": 3 },
  "alerts":  { "active": 7, "critical": 2, "today": 12, "recent": [...] },
  "zones":   { "shed": 60, "open": 58, "unknown": 2 },
  "postures":{ "grazing": 45, "standing": 40, "lying": 30, "walking": 3 },
  "avgVitals": {
    "healthScore": 88,
    "bodyTempC": 38.7,
    "heartRate": 66,
    "spO2": 96,
    "activityScore": 62
  }
}
```

---

### Cows

#### GET /api/cows  (🔒)
```
Query params: status, sort, page, limit
```

#### POST /api/cows  (🔒)
```json
{ "cowId": "COW-113", "name": "Ganga", "breed": "Gir", "tagNumber": "E014" }
```

#### GET /api/cows/:cowId  (🔒)
Full profile with device, health score, repro history.

#### GET /api/cows/:cowId/readings  (🔒)
```
Query: from=2026-04-01T00:00:00Z  to=2026-04-02T00:00:00Z  limit=200
```

#### GET /api/cows/:cowId/readings/latest  (🔒)
Single most-recent reading document.

#### GET /api/cows/:cowId/trends  (🔒)
```
Query: from=...  to=...  interval=hour|day
Response: Bucketed averages for charting
```

#### GET /api/cows/:cowId/alerts  (🔒)
```
Query: resolved=false  limit=50
```

#### POST /api/cows/:cowId/repro  (🔒)
```json
{ "event": "insemination", "date": "2026-04-13", "notes": "Artificial insemination done." }
```

---

### Devices

#### GET /api/devices  (🔒)
All collars with battery, zone, assigned cow.

#### PUT /api/devices/assign  (🔒)
```json
{ "deviceId": "CattleCollar-A1B2C3", "cowId": "COW-112" }
```

#### PUT /api/devices/unassign/:deviceId  (🔒)
Detaches collar from cow.

---

### Alerts

#### GET /api/alerts  (🔒)
```
Query: type=fever  severity=critical  resolved=false  page=1  limit=50
```

#### GET /api/alerts/active  (🔒)
All unresolved alerts for the farm.

#### PUT /api/alerts/:id/resolve  (🔒)
```json
{ "resolution": "Vet visited, prescribed antibiotics." }
```

---

## DATA FLOW DIAGRAM

```
ESP32 Collar
    │
    │  MQTT PUBLISH  cattle/{id}/data  (every 30s)
    │  MQTT PUBLISH  cattle/{id}/alert (on alert)
    ▼
MQTT Broker (AWS IoT / Mosquitto)
    │
    │  Subscribe
    ▼
mqtt/ingester.js (Node.js process)
    │
    ├─► SensorReading.create()         ← raw data stored
    ├─► Device.findOneAndUpdate()      ← lastSeen, battery
    ├─► Cow.findOneAndUpdate()         ← lastReading snapshot
    └─► Alert.create()                 ← if threshold breached
              │
              ▼
         MongoDB Atlas
              │
              ▼
     REST API (Express)
              │
              ▼
     Farmer Mobile App
```

---

## HOW TO RUN

```bash
# 1. Install dependencies
npm install

# 2. Copy and edit environment file
cp .env.example .env

# 3. Start API server
npm run dev

# 4. Start MQTT ingester (separate terminal)
npm run mqtt

# 5. API available at:
#    http://localhost:3000/api
#    http://localhost:3000/health
```

## PRODUCTION DEPLOYMENT (Recommended)

```bash
# Use PM2 to run both processes
pm2 start server.js      --name "cattle-api"
pm2 start mqtt/ingester.js --name "cattle-mqtt"
pm2 save
```
