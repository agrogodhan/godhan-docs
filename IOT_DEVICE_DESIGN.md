# Godhan — IoT Cattle Collar: Device Design Document
**Version:** 1.0  
**Date:** 2026-05-07  
**Sources synthesized:** hardware-architecture.html, ble-wifi-cloud.html, cattle-firmware.html, cattle-pcb-schematic.html, cattle-wifi-architecture.html, Cattle IoT Technical Doc.pdf, Cow IoT Master Doc.pdf, Cow Wearable Hardware & BOM.pdf, Cow Health Dashboard Design.pdf, cattle_prediction_python.py, esp_32_firmware_skeleton.cpp, cattle_api/API_DOCS.md

---

## 1. Product Overview

The Godhan Smart Cattle Collar is a wearable IoT device for dairy cattle. It continuously monitors health vitals, activity, and reproductive signals, transmits data to the cloud every 30 seconds over WiFi, and feeds the Godhan farmer app with real-time alerts and analytics.

**Design philosophy:**
- WiFi-first (farm compound is assumed to have WiFi coverage)
- BLE used only once for initial provisioning — then permanently off
- No LoRa, no GPS, no cellular — WiFi handles everything; zone detection via WiFi RSSI
- Deep/light sleep between sensor reads to maximise battery life
- SPIFFS offline buffer for connectivity loss resilience
- OTA firmware updates remotely triggered over MQTT

---

## 2. Hardware

### 2.1 Form Factor

| Attribute | Spec |
|---|---|
| Form factor | Neck collar |
| Enclosure | IP66/67 rated, resin case, padded collar mount |
| Venting | Hydrophobic membrane on microphone port |
| Antenna | Keep clear of metal buckles; external flexible antenna recommended |
| Size (PCB) | 60mm × 40mm (4-layer) |
| Weight target | <150g including battery |

### 2.2 Final Bill of Materials (WiFi Build)

> **Note:** Two hardware revisions exist in the docs. The v1 design included LoRa (SX1276), GPS (NEO-6M), and NB-IoT (SIM7000G). These were **removed** in the current v2 design — WiFi replaces LoRa for data uplink; WiFi RSSI replaces GPS for zone detection.

| # | Component | Model | Interface | Purpose | Est. Cost (USD) |
|---|---|---|---|---|---|
| U1 | Microcontroller | ESP32-S3 WROOM-1 | — | CPU + WiFi + BLE 5.0 (dual-core 240MHz, 512KB SRAM, 8MB Flash) | $4–8 |
| U2 | IMU / Accelerometer | MPU-6050 | I²C (0x68) | Steps, posture, grazing detection, restlessness | $2–5 |
| U3 | Heart Rate + SpO₂ | MAX30102 | I²C (0x57) | PPG optical sensor — pulse rate and blood oxygen | $3–6 |
| U4 | Body Temperature | DS18B20 waterproof probe | 1-Wire (GPIO18) | Ear canal or rectal probe, ±0.5°C accuracy | $1–3 |
| U5 | Rumination Mic | INMP441 MEMS | I²S (GPIO6/7/8) | Jaw movement / chewing cycle detection (digital I²S) | $1–3 |
| U6 | Estrus Temp Probe | LMT70 analog | ADC (GPIO9) | Vaginal temperature (0.1°C resolution) for estrus and calving prediction | $2–5 |
| IC1 | LiPo Charger | TP4056 + protection | — | Solar-to-battery charging with overcurrent/overvoltage protection | $0.5–1 |
| IC2 | Voltage Regulator | LM1117 LDO | — | Stable 3.3V from battery | $0.3–0.8 |
| — | Battery | LiPo 3.7V / 1500mAh | — | Primary power, 7–10 day backup without solar | $3–6 |
| — | Solar Panel | Flex panel 5V / 100mA | — | Continuous charging in outdoor conditions | $2–5 |
| — | PCB | 2–4 layer custom | — | All components mounted | $5–15 |
| — | Collar + enclosure | IP66 resin + adjustable strap | — | Weatherproof, quick-release, padded | $6–15 |
| **Total** | | | | | **~$30–73 / unit** |

### 2.3 GPIO Pin Map (ESP32-S3)

| GPIO | Signal | Connected To | Protocol |
|---|---|---|---|
| GPIO4 | SDA | MPU-6050, MAX30102 (shared bus) | I²C |
| GPIO5 | SCL | MPU-6050, MAX30102 (shared bus) | I²C |
| GPIO6 | I²S WS | INMP441 mic word select | I²S |
| GPIO7 | I²S SCK | INMP441 mic bit clock | I²S |
| GPIO8 | I²S SD | INMP441 mic data | I²S |
| GPIO9 | ADC1 | LMT70 VOUT (0.3V–1.7V range) | ADC |
| GPIO18 | 1-Wire | DS18B20 DQ | 1-Wire |
| GPIO43 | UART TX | Debug header J3 | UART |
| GPIO44 | UART RX | Debug header J3 | UART |
| EN | RESET | SW1 reset button | — |
| GPIO0 | BOOT | SW2 boot button | — |

**I²C pull-ups:** 4.7kΩ on SDA and SCL to 3.3V rail  
**DS18B20 pull-up:** 4.7kΩ to 3.3V on DQ line  
**LMT70 filter cap:** 100nF to GND on VOUT

### 2.4 Power Chain

```
Solar Panel (5V / 100mA flex)
        │
        ▼
   TP4056 charger (VBAT out)
        │
        ▼
   LiPo battery (3.7V / 1500mAh)
        │
        ▼
   LM1117 LDO regulator
        │
        ▼
   3.3V rail → ESP32-S3, MPU-6050, MAX30102, DS18B20, INMP441, LMT70
```

**Battery life estimate:**

| Mode | Current |
|---|---|
| ESP32 deep/light sleep | 20–150 µA |
| Active wake (sensors + TX, 3s per 60s) | ~80–200 mA peak |
| Average (5-min interval strategy) | ~3–5 mA |
| 1500mAh / 5mA | ~12–14 days without sun |
| With solar (outdoor daytime) | Indefinite |

### 2.5 Sensor Roles by Feature

| Feature | Sensor Used | Signal |
|---|---|---|
| Step count | MPU-6050 accel | Raw acceleration magnitude |
| Posture (lying/standing/grazing/walking) | MPU-6050 gyro + accel | Tilt angle, motion pattern |
| Activity score | MPU-6050 | Composite: steps + posture + acceleration magnitude |
| Body temperature / fever | DS18B20 | °C, sampled every 5 min |
| Heart rate | MAX30102 PPG | BPM |
| Blood oxygen (SpO₂) | MAX30102 PPG | % |
| Rumination cycles/hr | INMP441 I²S mic | Jaw chewing frequency via FFT (1–50Hz range) |
| Estrus detection | LMT70 + MPU-6050 | Vaginal temp rise + restlessness spike |
| Calving prediction | LMT70 + MPU-6050 | Vaginal temp drop + activity + rumination drop |
| Zone detection (shed/open) | WiFi RSSI from APs | AP signal strength differentiates zones |

---

## 3. Firmware

### 3.1 Architecture

**Platform:** ESP32-S3 · Arduino Framework · PlatformIO · v1.0.0

**File structure:**
```
src/
├── main.cpp          — Boot, main loop, orchestration
├── ble_provision.h   — BLE WiFi credential setup (one-time)
├── wifi_manager.h    — WiFi connect / auto-reconnect
├── sensors.h         — All 5 sensor drivers
├── cloud.h           — MQTT publish to cloud
└── power.h           — Light sleep, battery, solar management
```

### 3.2 Boot Flow

```
Power ON
    │
    ▼
Read NVS (Preferences) — are WiFi credentials stored?
    │
    ├─── NO (first boot) ──────────────────────────────────────────────┐
    │                                                                  │
    │   Start BLE advertising as "COLLAR-{MAC_SUFFIX}"                │
    │   Wait for farmer app to connect via BLE GATT                   │
    │   App writes: { wifi_ssid, wifi_pass, cow_id }                  │
    │   Save to NVS flash                                              │
    │   Stop BLE (turns off permanently — saves battery)              │
    │                                                                  │
    └─── YES (normal boot) ◄───────────────────────────────────────────┘
         │
         ▼
    WiFi connect using saved SSID/password (auto-retry)
         │
         ▼
    MQTT connect to cloud broker (TLS)
         │
         ▼
    Init all sensors (MPU-6050, MAX30102, DS18B20, INMP441, LMT70)
         │
         ▼
    cloudRegisterDevice(deviceId, firmwareVersion)
         │
         ▼
    Enter main loop
```

### 3.3 Main Loop Logic

```
Every iteration:
    │
    ├── cloudLoop()          — keep MQTT connection alive (PubSubClient loop)
    │
    ├── wifiConnected()?
    │     NO → wifiReconnect()
    │
    ├── Determine send interval:
    │     alertConditionMet() ? 5 seconds : 30 seconds
    │
    ├── Time elapsed since last send?
    │     YES → readAllSensors() → buildAndSendPayload() → cloudPublish()
    │
    └── lightSleepUntilNextRead(interval, lastSendTime)
```

**Alert condition:** fever (temp > 39.5°C) OR low battery (<20%) OR estrus/calving signals → interval drops to 5 seconds for faster cloud updates.

### 3.4 MQTT Topics

| Direction | Topic | Content |
|---|---|---|
| Collar → Cloud (data) | `cattle/{device_id}/data` | Full sensor JSON payload (every 30s) |
| Collar → Cloud (alert) | `cattle/{device_id}/alert` | Alert-specific payload (on threshold breach) |
| Cloud → Collar (command) | `cattle/cmd/{device_id}` | Commands: OTA trigger, config update, reboot |

### 3.5 Published JSON Payload

```json
{
  "device_id":   "COLLAR-045",
  "cow_id":      "COW-112",
  "timestamp":   "2026-04-12T08:32:10Z",

  "steps":              142,
  "posture":            "grazing",
  "activity_score":     74,

  "body_temp_c":        38.6,
  "heart_rate_bpm":     68,
  "spo2_pct":           97,
  "rumination_cycles_hr": 420,

  "vaginal_temp_c":     38.9,
  "estrus_flag":        false,
  "calving_alert":      false,

  "battery_pct":        82,
  "wifi_rssi":          -58,
  "zone":               "shed"
}
```

**Zone derivation:** `zone` is computed on-device from the RSSI of each farm access point. If RSSI from Shed-AP > threshold → zone = "shed"; else "open".

### 3.6 BLE Provisioning Detail

**BLE service UUID:** `0000abcd-0000-1000-8000-00805f9b34fb`  
**Characteristic UUID:** `0000dcba-0000-1000-8000-00805f9b34fb` (WRITE | READ)

**Provisioning flow:**
1. Collar powers on, no NVS credentials → BLE advertising starts as `"CattleCollar-{MAC}"`
2. Farmer app scans → sees collar → assigns cow (cow_id, cow name)
3. App writes JSON via BLE GATT characteristic:
   ```json
   { "wifi_ssid": "FarmNet", "wifi_password": "xxx", "device_id": "COLLAR-045", "cattle_id": "COW-112", "mqtt_broker": "broker.godhan.io", "mqtt_port": 8883, "interval": 30 }
   ```
4. Collar saves to NVS, stops BLE, connects WiFi → permanent operation
5. BLE only re-activates on factory reset (hardware button hold)

### 3.6.1 As-built: mobile app's real BLE provisioning (2026-07-20)

The Kotlin mobile app (`godhan-app`) actually implements BLE provisioning today —
`IotPairingScreen`/`IotPairingViewModel` (an 8-step flow) + `AndroidBluetoothScanner` — but it
was built against a **different, more granular BLE contract** than §3.6 above specifies, and
**no ESP32 firmware in this repo implements either version yet** (see the gap note at the end of
this section).

**Real flow, step by step:**
1. **Identify** — farmer scans a QR code on the collar or types its ID by hand. Every real
   collar's BLE advertised name must start with `GODHAN_` (e.g. `GODHAN_A3F2`) — different from
   this doc's `CattleCollar-{MAC}` convention above.
2. **Scan** — phone does a BLE scan filtered to that exact device name.
3. **Connect** — phone opens a GATT connection and discovers services.
4. **WiFi entry** — farmer types SSID/password into the phone UI (nothing sent yet).
5. **Cattle select** — farmer picks which animal in their herd this collar is for, from their
   real herd list (fetched from `cattle-service`).
6. **Configure / provision** — the actual credential hand-off: three separate BLE **characteristic
   writes**, 300ms apart (not one JSON blob like §3.6's `{wifi_ssid, wifi_password, device_id,
   cattle_id, mqtt_broker, mqtt_port, interval}`):
   - SSID → characteristic `00001235-0000-1000-8000-00805f9b34fb`
   - password → characteristic `00001236-0000-1000-8000-00805f9b34fb`
   - cattleId (cattle-service's own real `Cattle._id`, not a `COW-nnn`-style device-side id) →
     characteristic `00001237-0000-1000-8000-00805f9b34fb`

   All three live under service UUID `00001234-0000-1000-8000-00805f9b34fb`. The phone then polls
   a fourth characteristic, `00001238-...` ("STATUS"), once a second for up to 20s, waiting for
   the collar to write back the literal string `"OK"` — the collar's own signal that it took the
   credentials and successfully joined that WiFi network. No `mqtt_broker`/`mqtt_port`/`interval`
   are negotiated over BLE in this real implementation — those would need to be firmware-side
   defaults/config, not something the phone sends.
7. **Done** — mobile side's job ends the moment STATUS reads `"OK"`. Everything after that (the
   collar actually joining WiFi, then calling home) is firmware, not app code.

**What happens after BLE, and the loop that used to be broken**: once on WiFi, the collar calls
`godhan-cattle-iot`'s `POST /api/devices/register` with its own deviceId + the cattleId it was
just told over BLE. Until 2026-07-20 that only ever updated `godhan-cattle-iot`'s own `Device`
record — nothing propagated to `cattle-service`'s `Cattle.deviceId`, the field every farmer-facing
IoT UI actually reads, so a "successful" pairing never showed up anywhere in the app. Fixed in
`docs/DEVELOPMENT_PLAN.md` §3.40: that same registration call now also links `cattle-service`'s
side for real.

**Update (2026-07-20): firmware written, not yet hardware-tested.** The gap above (this repo's
`esp_32_firmware_skeleton.cpp` had zero BLE code) is now closed in code: the skeleton has a full
BLE GATT server matching this section's contract exactly (same 4 characteristics, same
`GODHAN_`-prefixed advertising name), `Preferences`-backed persistence so a pairing survives deep
sleep/power cycles, a factory-reset trigger (hold the `GPIO0` boot button, present on every board
revision referenced in §2.3), and the previously-missing `POST /api/devices/register` call to
`godhan-cattle-iot`. Restructured around the device's existing deep-sleep-every-5-minutes
architecture: `setup()` now checks NVS first and only enters BLE provisioning mode if not already
provisioned, bounded to a 5-minute advertising window so an unpaired collar sitting in a box
doesn't drain its battery waiting forever.

**Still genuinely unverified**: there is no toolchain available to compile or test embedded C++
against real ESP32 hardware in the environment this was written in. It was hand-reviewed (a full
logical read-through caught one real concurrency risk — the original draft attempted the blocking
WiFi-connect step directly inside a BLE GATT write callback, which runs on the ESP32 BLE stack's
own task and could stall it; moved to the main polling loop instead) but **not compiled, not
flashed, not paired against a real phone**. Before relying on it: compile against the project's
actual ESP32 Arduino core version (the exact `BLEDevice`/`BLECharacteristic` API — e.g.
`BLEDevice::deinit()`'s exact signature — has shifted across core versions), then run a real
on-device pairing test against the mobile app.

### 3.7 Offline Storage (SPIFFS)

- If WiFi/MQTT unavailable at send time → payload written to `/offline.log` on SPIFFS
- On next successful connection → `uploadOffline()` reads file line by line, publishes each record, deletes file
- Prevents data loss during WiFi outages

### 3.8 OTA Firmware Update

- Firmware binary hosted at configurable URL
- Cloud sends `OTA:<url>` via MQTT command topic
- Collar downloads binary via HTTPS, validates, flashes, reboots
- Firmware versions tracked in `firmware` collection; cloud can compare `fw_version` field in device registration payload and trigger OTA automatically

### 3.9 Rumination Detection (FFT Method — from skeleton firmware)

```
1. Collect 128 audio samples from INMP441 at 2kHz via I²S
2. Apply Hamming window
3. Compute FFT
4. Count amplitude peaks in 1–50Hz range (chewing frequency)
5. If peak count > threshold (3) → rumination_event++
6. Aggregate rumination_events per hour → rumination_cycles_hr
```

### 3.10 Security

| Layer | Mechanism |
|---|---|
| Device → Cloud | MQTT over TLS (port 8883) |
| Payload integrity | HMAC signing (device secret provisioned at factory) |
| OTA | Firmware signature validated before flashing |
| BLE provisioning | GATT pairing with passkey; credentials encrypted in transit |
| Data at rest | MongoDB Atlas encryption at rest |

---

## 4. Farm WiFi Architecture

### 4.1 Compound Coverage

The farm compound (assumed ~1 acre) has two zones:

| Zone | Access Points | Coverage purpose |
|---|---|---|
| **Shed** | AP-01, AP-02 (indoor, waterproof ceiling mount) | Cattle in barn |
| **Open field** | AP-03, AP-04 (outdoor, pole mount, weatherproof) | Grazing cattle |

All APs are on the same SSID; collars connect once and roam transparently.

### 4.2 Zone Detection via RSSI

Each AP has a known physical location. The collar reads RSSI of each AP at upload time and includes it in `wifi_rssi` (strongest AP). The cloud backend derives `zone` from which AP has the strongest signal.

**Alternative:** RSSI threshold stored in device config → zone computed on-device (current implementation).

### 4.3 Connectivity Flow

```
Cattle Collar (ESP32-S3)
    │  MQTT over TLS (port 8883)
    │  Every 30s (or 5s on alert)
    ▼
Farm WiFi AP  →  Router  →  Internet
    │
    ▼
MQTT Broker (AWS IoT / EMQX / Mosquitto)
    │  Subscribe: cattle/#
    ▼
Node.js MQTT Ingester (backend)
    │
    ├─► sensor_data collection (MongoDB)
    ├─► devices collection (lastSeen, battery, zone)
    ├─► cows collection (lastReading snapshot)
    └─► alerts collection (threshold-triggered)
```

---

## 5. Backend — MQTT Ingester (Node.js)

> This service **does not exist yet** — it is the highest-priority missing backend component.

**Subscribe to:** `cattle/+/data`, `cattle/+/alert`

**On each message:**

```
Parse JSON payload
    │
    ├── SensorReading.create({ ...payload })        // raw telemetry
    │
    ├── Device.findOneAndUpdate(
    │     { deviceId },
    │     { lastSeen, lastBatteryPct, lastZone },
    │     { upsert: true }
    │   )
    │
    ├── Cow.findOneAndUpdate(
    │     { cowId },
    │     { lastReading: { snapshot of current vitals } }
    │   )
    │
    └── Check thresholds:
          bodyTempC > 39.5  → Alert("fever", "critical")
          heartRate > 100   → Alert("hrAlert", "warning")
          spO2 < 92         → Alert("spO2Alert", "critical")
          batteryPct < 20   → Alert("LOW_BATTERY", "info")
          estrusFlag        → Alert("HEAT_DETECTED", "critical")
          calvingAlert      → Alert("CALVING", "critical")
```

---

## 6. Database Schemas (IoT Collections — MongoDB/Mongoose)

### 6.1 `sensor_readings` (time-series, TTL 90 days)

```javascript
{
  deviceId:   String,
  cowId:      String,
  timestamp:  Date (indexed),

  activity: {
    steps:         Number,
    posture:       String,  // "grazing" | "standing" | "lying" | "walking"
    activityScore: Number   // 0–100
  },
  health: {
    bodyTempC:         Number,
    heartRate:         Number,
    spO2:              Number,
    ruminationCyclesHr: Number
  },
  reproduction: {
    vaginalTempC: Number,
    estrusFlag:   Boolean,
    calvingAlert: Boolean
  },
  device: {
    batteryPct: Number,
    wifiRSSI:   Number,
    zone:       String   // "shed" | "open"
  },

  expireAt: Date   // auto TTL — set to timestamp + 90 days
}

// Indexes:
{ cowId: 1, timestamp: -1 }
{ deviceId: 1, timestamp: -1 }
{ farm: 1, timestamp: -1 }
{ expireAt: 1 }  // TTL index
```

### 6.2 `devices`

```javascript
{
  deviceId:        String (unique),
  farm:            ObjectId → farms,
  cow:             ObjectId → cows,
  firmwareVersion: String,
  status:          String,  // "active" | "offline" | "needs_update"
  lastSeen:        Date,
  lastBatteryPct:  Number,
  lastZone:        String
}

// Indexes:
{ deviceId: 1 }  (unique)
{ farm: 1 }
{ lastSeen: -1 }
```

### 6.3 `cows` (IoT model — distinct from farmer CRUD model)

```javascript
{
  cowId:   String (unique per farm),
  farm:    ObjectId → farms,
  device:  ObjectId → devices,
  name:    String,
  breed:   String,
  dob:     Date,
  baseline: {
    bodyTempC:  Number,
    heartRate:  Number
  },
  lastReading: {
    timestamp:    Date,
    bodyTempC:    Number,
    heartRate:    Number,
    spO2:         Number,
    estrusFlag:   Boolean,
    calvingAlert: Boolean
  },
  healthScore:  Number,   // 0–100, recalculated every 24h
  activeAlerts: Number,
  reproHistory: Array
}
```

### 6.4 `alerts`

```javascript
{
  farm:        ObjectId,
  cow:         ObjectId,
  cowId:       String,
  deviceId:    String,
  type:        String,  // "fever" | "hrAlert" | "spO2Alert" | "LOW_BATTERY" | "HEAT_DETECTED" | "CALVING" | "DEVICE_OFFLINE"
  severity:    String,  // "info" | "warning" | "critical"
  message:     String,
  triggeredAt: Date,
  vitals:      { bodyTempC, heartRate, spO2 },
  resolved:    Boolean,
  resolvedAt:  Date,
  resolution:  String
}
```

### 6.5 `firmware`

```javascript
{
  fw_version:   String (unique),
  release_date: Date,
  url:          String,   // HTTPS URL to binary
  notes:        String,
  status:       String    // "latest" | "deprecated"
}
```

### 6.6 `farms`

```javascript
{
  name:         String,
  location:     { city: String, state: String },
  compoundArea: Number,   // acres
  zones:        [{ name: String }],
  createdAt:    Date
}
```

---

## 7. REST API Endpoints (IoT)

All endpoints require JWT authentication (`Authorization: Bearer <token>`).

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create farmer account + farm |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Get current user + farm |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | Herd summary, device status, active alerts, zone distribution, avg vitals |

### Cows (IoT)
| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/api/cows` | status, sort, page, limit | List all farm cows |
| POST | `/api/cows` | — | Onboard new cow |
| GET | `/api/cows/:cowId` | — | Full cow profile + device + health score |
| GET | `/api/cows/:cowId/readings` | from, to, limit | Historical sensor readings |
| GET | `/api/cows/:cowId/readings/latest` | — | Most recent reading document |
| GET | `/api/cows/:cowId/trends` | from, to, interval=hour\|day | Bucketed averages for charts |
| GET | `/api/cows/:cowId/alerts` | resolved=false, limit | Cow alert history |
| POST | `/api/cows/:cowId/repro` | — | Log repro event `{ event, date, notes }` |

### Devices
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/devices` | All collars with battery, zone, assigned cow |
| POST | `/api/devices/register` | Register new collar `{ deviceId }` |
| PUT | `/api/devices/assign` | Assign collar to cow `{ deviceId, cowId }` |
| PUT | `/api/devices/unassign/:deviceId` | Detach collar from cow |

### Firmware
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/devices/:id/update` | Trigger OTA on device (sends MQTT command) |
| GET | `/api/firmware/latest` | Get latest firmware version + URL |

### Alerts
| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/api/alerts` | type, severity, resolved, page, limit | Farm-wide alert list |
| GET | `/api/alerts/active` | — | All unresolved alerts |
| PUT | `/api/alerts/:id/resolve` | — | Mark resolved with `{ resolution }` |

---

## 8. ML / Prediction Service (Python)

**Runtime:** Python 3.9+ as a standalone service (systemd or Docker)  
**Libraries:** pandas, numpy, scikit-learn, pymongo, schedule, joblib, twilio, requests

### 8.1 Heat Detection (Estrus)

**Feature engineering** (per cow, 24h rolling windows at 5-min intervals = 288 samples):

| Feature | Derivation |
|---|---|
| `temp_delta` | current temp − 24h rolling mean |
| `rumination_delta` | current rumination − 24h rolling mean |
| `activity_delta` | current activity magnitude − 24h rolling mean |

**Rule-based MVP:**
> `activity_delta > 2σ` AND `rumination < 80% of baseline` → heat alert

**ML model (RandomForest):**
- Input: `[temp_delta, rumination_delta, activity_delta]`
- Output: `1 = in heat, 0 = not` + estrus probability (0–1)
- Retrained weekly from 90 days of labeled data
- Model persisted as `heat_detection_model.pkl` (joblib)
- **Best insemination window:** 6–24 hours after heat onset

### 8.2 Calving Prediction

**Step 1 — Date-based:** `expected_calving_date = insemination_date + 283 days`

**Step 2 — Signal detection (last 24h):**

| Signal | Condition |
|---|---|
| Temp drop | `vaginal_temp_delta.mean() < -0.4°C` |
| Rumination drop | `rumination_delta.mean() < -30% of baseline` |
| Activity spike | `activity_delta.mean() > +50% of baseline` |

If all 3 signals present → `imminent_calving = True`

**Alert schedule:**
- T-14 days: start monitoring
- T-7 days: "Calving approaching" alert
- T-3 days: "Prepare pen" alert
- Imminent: "Calving within 12–24h" critical alert

### 8.3 Real-Time Loop

```
Every 5 minutes:
    Query MongoDB: sensor_data where timestamp > (now - 5min)
    Apply feature engineering
    Load model (heat_detection_model.pkl)
    Run predictions
    Save results to heat_predictions collection
    Check calving signals per pregnant cow
    If alert triggered → handle_detection_and_alert()
```

### 8.4 Alert Delivery

| Channel | How | Config Required |
|---|---|---|
| FCM Push notification | POST to `https://fcm.googleapis.com/fcm/send` | `FCM_KEY`, device token from user profile |
| SMS via Twilio | `TwilioClient.messages.create()` | `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` |
| WhatsApp via Twilio | Same as SMS with `whatsapp:` prefix | `TWILIO_WHATSAPP_FROM` |
| Webhook to backend | POST to Godhan API `/alerts` | `WEBHOOK_URL`, `API_KEY` |

**Best practice:** Use webhook channel for centralized retry, audit, and templating. SMS/WhatsApp for critical alerts directly to farmer.

### 8.5 Deployment

**Docker:**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "cattle_prediction.py"]
```

**Environment variables required:**
```
MONGO_URI=mongodb+srv://...
DB_NAME=cattle_iot
TWILIO_SID=ACxxxx
TWILIO_TOKEN=xxxx
TWILIO_FROM=+12345
TWILIO_WHATSAPP_FROM=+12345
FCM_KEY=AAAA...
WEBHOOK_URL=https://api.godhan.io/internal/alerts
API_KEY=xxx
```

---

## 9. Dashboard Design (Farmer App + Grafana)

**Stack:** React app + Grafana for charts + Node.js backend  
**Source:** Cow Health Dashboard Design.pdf

### 9.1 Screen: Farm Overview (Home)

| Widget | Data Source |
|---|---|
| Herd status card: total, active, in heat, calving | `GET /api/dashboard` |
| Device status: online / offline count | `GET /api/dashboard` |
| Zone map: cattle in shed vs open | `GET /api/dashboard` (zone distribution) |
| Average vitals: temp, HR, SpO₂, health score | `GET /api/dashboard` |
| Recent alerts list | `GET /api/alerts/active` |

### 9.2 Screen: Herd List

- All cattle with current vitals inline (temp, HR, SpO₂, rumination)
- Filter tabs: All / Alerts / Estrus / Calving / Shed / Open
- Search by name, cowId, tag

### 9.3 Screen: Cow Detail

| Section | Data |
|---|---|
| Header | cowId, breed, age, tag, device status, health score |
| Alert banner | Active alerts with severity |
| Temperature 24h chart | `GET /api/cows/:id/trends?interval=hour` |
| Rumination bar chart | Same endpoint, rumination field |
| Activity line chart | Same endpoint, activityScore field |
| SpO₂ + HR trend | Same endpoint |
| Reproductive timeline | Current cycle stage, days since calving, estrus status |
| Today's activity | Steps, posture, grazing hours |

### 9.4 Screen: Alerts

- Filterable by type / severity / resolved
- One-tap resolve with notes
- Quick actions: "View Cow" / "Log Event" / "Schedule Vet"

### 9.5 Screen: Device Setup (BLE Provisioning)

1. Tap "Add Collar"
2. App scans BLE → shows nearby unprovisioned collars
3. Farmer selects collar → assigns to a cow
4. App sends WiFi credentials via BLE GATT write
5. Collar disappears from BLE scan → now connected to WiFi
6. Device appears in `/api/devices` as active

### 9.6 Alert Trigger Rules

| Alert | Condition | Severity |
|---|---|---|
| Fever | `bodyTempC > 39.5°C` sustained | critical |
| High heart rate | `heartRate > 100 bpm` | warning |
| Low SpO₂ | `spO2 < 92%` | critical |
| Estrus | `estrusFlag == true` (from ML) | info |
| Calving imminent | `calvingAlert == true` (from ML) | critical |
| Low rumination | `ruminationCyclesHr < 300` | warning |
| Low battery | `batteryPct < 20%` | info |
| Device offline | No heartbeat for > 10 min | warning |

---

## 10. Marketplace — Cattle Grading (IoT-Powered)

The cattle grading system is driven by IoT data and is the core trust mechanism for the marketplace.

### 10.1 Grade Tiers

| Grade | Label | Health Score | Price Premium |
|---|---|---|---|
| S | Premium Gold | 90–100 | +35–45% |
| A | Verified Healthy | 75–89 | +18–25% |
| B | Standard | 55–74 | +5–10% |
| C | Below Average | 35–54 | Market price |
| D | Needs Attention | < 35 | Below market |

### 10.2 Grade Score Computation (per cow, 90-day window)

| Weight | Factor | Metric |
|---|---|---|
| 30% | Health Vitals | 90-day avg body temp, HR, SpO₂ vs normal ranges |
| 25% | Alert History | Frequency, severity, resolution rate of alerts |
| 20% | Feeding | Rumination cycles/hr consistency |
| 15% | Activity | Daily step count, posture distribution, grazing hours |
| 10% | Reproduction | Cycle regularity, no complications, calving history |

**Rules:**
- Grade computed server-side from raw sensor data only — seller cannot alter it
- Recalculated every 24 hours for live listings
- Minimum 90 days of IoT data required for marketplace listing
- Grade S criteria: health score 90–100, zero alerts in 90 days, perfect vitals, rumination 400+/hr
- Grade A criteria: health score 75–89, max 2 minor alerts (resolved), vitals normal 85%+ of time

### 10.3 Health Passport

Each listed cow receives a cryptographically signed digital health passport:
- SHA-256 signed by device MAC-bound sensor data
- QR code for instant buyer verification
- Includes: 90-day avg vitals, alert count, repro history, grade
- Transferable to new owner on purchase
- Cannot be forged or manually edited

---

## 11. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Farm Compound (1 acre)                                     │
│                                                             │
│  [Cattle Collar A] ──WiFi──┐                               │
│  [Cattle Collar B] ──WiFi──┤──► [WiFi AP shed-01]─┐        │
│  [Cattle Collar C] ──WiFi──┘                       │        │
│  [Cattle Collar D] ──WiFi──┐                       │        │
│  [Cattle Collar E] ──WiFi──┤──► [WiFi AP open-01]─┤        │
│                             └──► [WiFi AP open-02]─┤        │
│                                                    │        │
│                             Router ◄───────────────┘        │
└─────────────────────────────────────────────────────────────┘
                                │
                           Internet
                                │
         ┌──────────────────────┴──────────────────────┐
         │           Cloud (AWS / Docker)               │
         │                                             │
         │  [MQTT Broker (EMQX/Mosquitto)]             │
         │        │                                    │
         │  [Node.js MQTT Ingester]                    │
         │        │                                    │
         │  [MongoDB Atlas]  [MongoDB sensor_readings] │
         │        │                                    │
         │  [Node.js REST API]                         │
         │  [Python ML Service]                        │
         │  [Notification Service (FCM/Twilio)]        │
         │                                             │
         └──────────────────────────────────────────────┘
                                │
                         [Farmer App]
                       iOS / Android / Web
```

---

## 12. Open Items / Design Decisions Needed

| Item | Options | Recommended |
|---|---|---|
| MQTT broker | Mosquitto (self-hosted) vs EMQX (cloud) vs AWS IoT Core | AWS IoT Core for managed TLS + scale |
| Time-series storage | MongoDB TTL vs InfluxDB vs TimescaleDB | MongoDB TTL for MVP; InfluxDB for scale |
| ML service host | Docker on same server vs separate ML pod | Same server for MVP |
| GPS / location | Not included (RSSI zone only) | Add NEO-6M GPS in v2 if geo-fencing needed |
| Firmware update channel | MQTT command vs HTTP periodic check | MQTT command for speed; HTTP poll as fallback |
| Cellular fallback | Not included in current design | Add SIM7000G NB-IoT in v2 for remote farms |
| Edge vs cloud analytics | Cloud only for MVP | Edge compute in v2 for faster local alerts |
| Farmer feedback loop | Farmer confirms/dismisses alerts → ML labels | Must implement for model improvement |
