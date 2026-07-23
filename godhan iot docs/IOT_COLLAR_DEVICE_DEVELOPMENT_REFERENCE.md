# Godhan Smart Cattle Collar — Device Development Reference

**Audience:** IoT device engineering (hardware + firmware).
**Purpose:** The single reference for building, flashing, and bringing up the cattle collar so it matches what the backend (`godhan-cattle-iot`) and mobile app (`godhan-app`) already expect. Every claim below is either sourced from a specific file in this repo or explicitly marked as unverified — treat the "Open Items" section as the punch list, not optional reading.
**Status as of 2026-07-24.** Firmware referenced throughout is `esp_32_firmware_skeleton.cpp` (same folder as this doc) — the real, currently-maintained firmware, confirmed by matching its MQTT topic, payload field names, and BLE contract exactly against the backend and mobile app source, not a name-based guess. **No hardware-in-the-loop test has been run against any of this** — there is no ESP32 toolchain available in the environment this was developed in. Everything here needs real board bring-up before being trusted in the field.

---

## 1. Product Context

The collar exists to feed a continuous per-animal sensor stream that a planned vision layer (see `Godhan_Vision_Layer_Spec.docx` / `Godhan_Vision_Layer_Spec_Analysis.md`) uses to decide *when* to prompt a farmer for a photo, rather than relying on the farmer noticing something is wrong. That downstream use case is the reason sensor accuracy and honest signal naming matter here more than they might for a generic activity tracker — a fabricated or overclaimed signal doesn't just look bad, it would silently corrupt a farmer-facing health alert.

Two backend rollups already consume this device's data today and are live in production code (not planned): a 7-day rolling **lying-time baseline** and a 7-day rolling **rumination-rate baseline**, both in `godhan-cattle-iot`, feeding an hourly anomaly scan that alerts farmers to possible lameness or mastitis. The collar's job is to keep those signals real.

---

## 2. Hardware Requirements

### 2.1 Bill of Materials

Source: `IOT_DEVICE_DESIGN.md` §2.2. Reproduced here with a column marking whether the *current firmware* actually uses each part — some BOM components have no firmware code driving them yet, which is a deliberate scope decision (documented in `Godhan_Vision_Layer_Spec_Analysis.md`'s Tier 0), not something engineering needs to chase down.

| # | Component | Model | Interface | Purpose | Firmware status |
|---|---|---|---|---|---|
| U1 | Microcontroller | ESP32-S3 WROOM-1 | — | CPU + WiFi + BLE 5.0 | **In use** |
| U2 | IMU / Accelerometer | MPU-6050 | I²C (0x68) | Posture, activity sampling | **In use** (see §4.3) |
| U3 | Heart Rate + SpO₂ | MAX30102 | I²C (0x57) | Pulse rate, blood oxygen | **Not implemented** — out of scope for the current firmware pass |
| U4 | Body Temperature | DS18B20 waterproof probe | 1-Wire | Ear/rectal probe temp | **In use** — ⚠️ see Open Item #1, pin conflict |
| U5 | Rumination Mic | INMP441 MEMS | I²S (GPIO6/7/8) | Chewing-cycle detection | **In use** — must be the digital I²S part, see §2.4 |
| U6 | Estrus Temp Probe | LMT70 analog | ADC (GPIO9) | Vaginal temp, estrus/calving | **Not implemented** — out of scope for the current firmware pass |
| IC1 | LiPo Charger | TP4056 + protection | — | Solar-to-battery charging | Hardware-only, no firmware dependency |
| IC2 | Voltage Regulator | LM1117 LDO | — | Stable 3.3V from battery | Hardware-only — see §2.3, firmware behavior depends on this being a single always-on rail |
| — | Battery | LiPo 3.7V / 1500mAh | — | Primary power | — |
| — | Solar Panel | Flex panel 5V / 100mA | — | Continuous charging | — |

**If U3/U6 are populated on production boards**, that's fine — the firmware simply doesn't read them yet. Do not remove them from the BOM on the assumption they're dead; they're deferred, not cut.

### 2.2 GPIO Pin Map

Source: `IOT_DEVICE_DESIGN.md` §2.3, cross-checked against what the firmware actually wires up.

| GPIO | Signal | Connected To | Protocol | Firmware agrees with design doc? |
|---|---|---|---|---|
| GPIO4 | SDA | MPU-6050 (MAX30102 if populated) | I²C | ⚠️ **Conflict — see Open Item #1** |
| GPIO5 | SCL | MPU-6050 (MAX30102 if populated) | I²C | Not explicitly set in firmware (relies on `Wire` defaults) — needs verification |
| GPIO6 | I²S WS | INMP441 mic word select | I²S | ✅ Matches (`I2S_MIC_WS_PIN`) |
| GPIO7 | I²S SCK | INMP441 mic bit clock | I²S | ✅ Matches (`I2S_MIC_SCK_PIN`) |
| GPIO8 | I²S SD | INMP441 mic data | I²S | ✅ Matches (`I2S_MIC_SD_PIN`) |
| GPIO9 | ADC1 | LMT70 VOUT | ADC | Not read (LMT70 not implemented) |
| GPIO18 | 1-Wire | DS18B20 DQ | 1-Wire | ⚠️ **Firmware uses GPIO4 instead — see Open Item #1** |
| GPIO34 | ADC | Battery divider | ADC | ✅ Matches (`BATTERY_PIN`) |
| GPIO0 | BOOT | Factory-reset trigger (hold on boot) | — | ✅ Matches (`FACTORY_RESET_PIN`), reused deliberately rather than adding a dedicated button |

**I²C pull-ups:** 4.7kΩ on SDA/SCL to 3.3V. **DS18B20 pull-up:** 4.7kΩ to 3.3V on DQ.

### 2.3 Power Architecture — a firmware-relevant hardware constraint

```
Solar Panel → TP4056 charger → LiPo battery → LM1117 LDO → 3.3V rail
                                                              │
                                              ESP32-S3, MPU-6050, MAX30102, DS18B20, INMP441, LMT70
```

**This single always-on-rail design is a load-bearing assumption for the firmware**, not just a power detail. The activity-sampling subsystem (§4.3.3) depends on the MPU6050 staying powered continuously across the ESP32's deep sleep cycles, so its onboard low-power Cycle Mode keeps sampling autonomously while the ESP32's CPU/radio are off. **If any future hardware revision adds a switched/gated sensor rail** (e.g. a MOSFET load switch to cut sensor power during deep sleep for extra battery savings), Cycle Mode will stop working silently — the chip will lose its configuration every time it loses power, and the firmware has no way to detect this from software alone. Flag any such power-architecture change to firmware before it ships.

### 2.4 Rumination Mic — must be digital I²S, not analog

**This matters enough to call out on its own.** An earlier firmware draft assumed an analog MEMS mic on an ADC pin — that part doesn't exist anywhere in the BOM, so that draft could never have worked against real hardware. The current firmware correctly targets the INMP441 (digital I²S, GPIO6/7/8), matching the BOM. **Before flashing production units, physically confirm the INMP441 is actually populated on the PCB** — nothing in software can detect a missing/wrong mic part except a failed `i2s_driver_install()` call at boot (logged, not fatal — see §4.3.2), which will silently degrade rumination detection to always-zero rather than crash.

---

## 3. Firmware Behavior Specification

Firmware file: `esp_32_firmware_skeleton.cpp` (this folder). Framework: Arduino/ESP32. Read the file's own header comment and inline comments alongside this section — this document summarizes and cross-references, it doesn't replace reading the actual code.

### 3.1 Power / Wake Architecture

The device operates on two wake types, both using `esp_deep_sleep_start()` (a full reboot except RTC memory — regular globals reset every wake, `RTC_DATA_ATTR` variables survive):

- **Short drain-only wake** (every 75 seconds, `FIFO_DRAIN_INTERVAL_S`): reads whatever the MPU6050's Cycle Mode has buffered since last time (§4.3.3), then goes straight back to sleep. No WiFi, no MQTT, no full sensor init — this is intentionally as cheap as possible.
- **Full publish wake** (every 4th short-wake interval = 300s = 5 minutes exactly, `UPLOAD_INTERVAL_MINUTES`): does everything the short wake does, plus reads all sensors, connects WiFi, publishes to MQTT, checks for OTA, and re-arms Cycle Mode for the next round of short wakes.

The 75s/4-wake split was deliberately chosen so `300s / 75s = 4` exactly — the full publish cadence stays a clean 5 minutes rather than drifting. **If this interval is ever changed, keep it an exact divisor of `UPLOAD_INTERVAL_MINUTES * 60`**, or the publish cadence will silently drift and the backend's gap-tolerance assumptions (documented in `Godhan_Vision_Layer_Spec_Analysis.md`'s Tier 1, `MAX_ATTRIBUTABLE_GAP_MINUTES = 15`) will need re-checking.

State persisted across wakes via `RTC_DATA_ATTR` (survives deep sleep and `ESP.restart()`, cleared only by a true power-on-reset or brownout):
- `secondsSinceLastPublish` — counts up to the next full wake.
- `activitySampleCount`, `activeSampleCount` — accumulated activity data, reset after each full publish.

### 3.2 BLE Provisioning

**Must match `godhan-app`'s real, shipped BLE contract exactly** — the mobile side already works, so the firmware is written to match it, not the reverse. Reference: `GodhanBleConstants.kt` / `AndroidBluetoothScanner.kt` in `godhan-app`, and `IOT_DEVICE_DESIGN.md` §3.6.1.

- Advertised device name: `GODHAN_<deviceId>` — must start with this exact prefix, the app filters its BLE scan on it.
- Service UUID `00001234-...`, three **separate** write characteristics (SSID `00001235-...`, password `00001236-...`, cattleId `00001237-...`) — **not** one combined JSON blob. The phone writes all three, 300ms apart.
- A fourth, read-only STATUS characteristic (`00001238-...`) the firmware sets to `"OK"` on successful WiFi join + backend registration, or `"FAIL"` otherwise. The phone polls this (plain read, no notification/CCCD needed) for up to ~20s.
- The WiFi-connect attempt must **not** run inside the BLE `onWrite()` callback — that runs on the BLE stack's own task and a blocking multi-second WiFi connect there risks stalling it. It runs from the main polling loop instead (see `attemptProvisioning()`'s call site).
- Provisioning mode is bounded (`BLE_PROVISION_TIMEOUT_MS`, 5 minutes) — an unpaired collar shouldn't advertise and drain its battery indefinitely. On timeout it deep-sleeps and retries on its next scheduled wake.
- Factory reset: hold the GPIO0 boot button at power-on to clear stored provisioning and re-enter this flow (for reassigning a collar to a different animal or a new WiFi network).

**This entire flow has never been tested against a real phone** — see Open Item #3.

### 3.3 Sensor Subsystems

#### 3.3.1 Posture Classification (`classifyPosture()`)

Runs once per full wake, from 10 averaged accelerometer samples (~2 seconds of sampling). Classifies into `standing | lying | walking | grazing` using magnitude and tilt-angle thresholds (`POSTURE_WALK_MAG_THRESH_G`, `POSTURE_GRAZING_TILT_DEG`, `POSTURE_LYING_ACCZ_THRESH_G`).

**These thresholds are unvalidated placeholders**, ported from an unused prototype project, not derived from real animal data. No published research gives a portable threshold for a neck-collar mounting (leg-mounted tilt sensors, the only well-published approach, use different geometry entirely). A calibration tool and field protocol already exist:
- `calibrate_posture_thresholds.mjs` (this folder) — fits the three thresholds against real labeled accelerometer data via grid search.
- `POSTURE_CALIBRATION_PROTOCOL.md` (this folder) — the field procedure for collecting that labeled data.

**Do not hand-tune these constants by eyeballing logs** — run the calibration tool against real field data collected per the protocol.

#### 3.3.2 Rumination Detection (`detectRuminationFFT()`)

Reads 128 samples from the INMP441 over I²S at 2kHz, applies a Hamming-windowed FFT, and counts energy in the 1-50Hz chewing-frequency band against `RUM_CHEW_AMPLITUDE_THRESHOLD`. This matches `IOT_DEVICE_DESIGN.md` §3.9's spec exactly.

Each reading's `rumination_events` field is **effectively a 0-or-1 flag**, not a rate or count — the FFT check runs exactly once per wake, and the counter is a plain global that resets every reboot (deep sleep = reboot). The backend already accounts for this (see `ruminationDaily.model.js`'s comment on scan-sampling), so this is expected behavior, not a bug to fix — just something to know before "improving" it into a cumulative counter, which would break the backend's aggregation assumption.

`RUM_CHEW_AMPLITUDE_THRESHOLD` is an **unvalidated placeholder** — carried over from an earlier draft that used a completely different (nonexistent) analog mic, only scale-adjusted for the real I²S sample range. Needs recalibration against real recorded chewing audio.

#### 3.3.3 Activity Sampling (`configureAccelCycleMode()` / `drainActivityFifo()`)

This is the mechanism that makes any signal possible during the 5-minute gap between full wakes, when the ESP32's own CPU is asleep. The MPU6050 has a documented low-power "Cycle Mode" (Accelerometer-Only Low Power Mode) that samples autonomously into its onboard 1024-byte FIFO on its own ~tens-of-µA budget, independent of ESP32 sleep state — this only works because of the single always-on power rail (§2.3).

Configured via **raw I²C register writes** (`Wire.beginTransmission`/`write`/`endTransmission`) because `Adafruit_MPU6050` (the library used for normal sensor reads) doesn't expose Cycle Mode or FIFO controls. Register addresses and single-bit positions were cross-checked against two independent open-source references and agreed exactly; **the exact wake frequency for `LP_WAKE_CTRL` register values did not** — two credible sources give different frequency tables for the same register value. The firmware uses `LP_WAKE_CTRL = 0`, the one value both sources agree on (1.25 Hz) — not the fastest available option, deliberately, since the faster settings rest on a guess this session couldn't resolve (the primary InvenSense/TDK datasheet PDF returned no extractable text in the environment this was built in).

**Open Item #4** (below) covers resolving this properly. Until then, do not change `ACCEL_CYCLE_LP_WAKE_CTRL` to a faster value without independently confirming the real frequency (oscilloscope on the I²S/interrupt line, or timed FIFO-fill measurement against real hardware).

The resulting `activity_rate` field (§5) is **not a step count** — at 1.25 Hz, each sample is a coarse "was the animal moving" snapshot, not a footfall measurement. `ACTIVITY_MAG_THRESHOLD_G` is an unvalidated placeholder, same status as the posture thresholds.

#### 3.3.4 Temperature (DS18B20)

Read via `DallasTemperature`/`OneWire`, averaged over the same 10-sample loop as the accelerometer. Straightforward — the only issue is the GPIO conflict in Open Item #1.

### 3.4 Network & Backend Contract

- **MQTT broker**: plain (unauthenticated by default) MQTT on port 1883, address hardcoded per-deployment (`mqtt_server`). Not TLS, not AWS IoT Core — a different (unused) firmware draft in this repo assumes AWS IoT + client certs; **do not use that one**, it doesn't match what the backend (`godhan-cattle-iot`) is actually configured for (`MQTT_URI` env var, plain `mqtt` npm client).
- **Data topic**: `cattle/data/<deviceId>` — see §5 for the exact payload schema. `deviceId` comes from the topic path on the backend side, not the payload body.
- **Alerts topic**: `cattle/alerts/<deviceId>` — currently only used for `{"alert":"LOW_BATTERY"}` when battery voltage drops below `LOW_BATTERY_THRESHOLD` (3.5V).
- **Registration**: `POST <CATTLE_IOT_BASE_URL>/api/devices/register` (HTTP, not MQTT) with `{deviceId, cattleId, fwVersion, battery, status}`. Called once right after provisioning succeeds, and again on every full wake (cheap idempotent upsert) — this is what links the collar to a specific animal server-side, and keeps status/battery fresh for the farmer-facing dashboard.
- **OTA — a real gap, not yet reconciled**: the backend (`godhan-cattle-iot/src/services/mqtt.service.js`) already has a working MQTT-push OTA mechanism (`publishOtaCommand()`, publishing `OTA:<url>` to `cattle/cmd/<deviceId>`) and an OTA status-log endpoint (`cattle/ota/status/<deviceId>`). **The firmware doesn't use either.** It instead does its own independent HTTP-poll OTA check (`checkForOTA()`, `httpUpdate.update(ota_url)`) against a hardcoded placeholder URL, on every single full wake. See Open Item #5 — this needs a decision (wire up the MQTT push path, or intentionally keep HTTP polling and remove/repurpose the backend's push mechanism) before OTA is production-usable.
- **No RTC/NTP**: readings carry no real timestamp. The backend defaults to receipt time, meaning any offline-buffered reading replayed on reconnect (see §3.5) lands with the replay time, not when it actually happened. Low priority but worth fixing eventually — see Open Item #6.

### 3.5 Offline Buffering

If WiFi/MQTT is unavailable at publish time, the payload is appended to `/offline.log` on SPIFFS (`storeOffline()`) instead of being dropped. On the next successful connection, buffered lines are replayed in order and the log cleared (`uploadOffline()`). No cap on log size is currently enforced — worth a bound if extended outages are expected in the field.

---

## 4. Output / Data Model

### 4.1 MQTT Data Payload — `cattle/data/<deviceId>`

Published on every **full** wake (every 5 minutes). All fields are required in every publish except where noted.

| Field | Type | Units / Range | Reliability | Notes |
|---|---|---|---|---|
| `device_id` | string | — | Real | Matches the topic's own `<deviceId>` — sent for convenience, backend keys off the topic |
| `accX`, `accY`, `accZ` | float | m/s² | Real | Averaged over 10 samples (~2s), real MPU6050 reads |
| `temp` | float | °C | Real | Averaged over 10 samples, real DS18B20 reads |
| `battery` | float | volts | Real | From ADC divider, `readBatteryVoltage()` |
| `rumination_events` | int | 0 or 1 | Real, but see §3.3.2 | Effectively a per-wake flag, not a rate — backend already accounts for this |
| `posture` | string | `standing\|lying\|walking\|grazing` | **Unvalidated classification** | Real accelerometer-derived, but threshold constants need field calibration (§3.3.1) |
| `activity_rate` | float | 0.0–1.0 | **Unvalidated classification, NOT a step count** | Fraction of Cycle-Mode-buffered samples above `ACTIVITY_MAG_THRESHOLD_G` since the last full wake |
| `activity_samples` | uint32 | count | Real (diagnostic) | How many samples fed `activity_rate` — use this to judge confidence; near-zero means Cycle Mode likely isn't running (see §3.3.3) |

### 4.2 MQTT Alert Payload — `cattle/alerts/<deviceId>`

| Field | Type | Notes |
|---|---|---|
| `alert` | string | Currently only `"LOW_BATTERY"` |

### 4.3 HTTP Registration Payload — `POST /api/devices/register`

| Field | Type | Notes |
|---|---|---|
| `deviceId` | string | This device's own ID |
| `cattleId` | string | From BLE provisioning (godhan-app sends `cattle-service`'s real `Cattle._id`) |
| `fwVersion` | string | `FW_VERSION` constant — **bump this on every firmware release** so the backend/dashboard can see what's deployed |
| `battery` | float | volts |
| `status` | string | `"online"` |

---

## 5. Open Items — Action Checklist for Engineering

Ordered roughly by how much they block real deployment.

1. **[CRITICAL] DS18B20/I²C GPIO conflict.** Design doc (`IOT_DEVICE_DESIGN.md` §2.3) puts DS18B20 on GPIO18 (1-Wire) and I²C SDA on GPIO4 (shared with MPU6050). The firmware currently wires DS18B20 to GPIO4 (`OneWire oneWire(4)`) — the same pin as I²C SDA. Resolve by checking the actual PCB schematic/trace: either the firmware needs to move to GPIO18, or the design doc is stale and the real board uses a different I²C pin than documented. Either way, someone needs to look at the physical board, not just the docs, since they currently disagree.
2. **[CRITICAL] Confirm INMP441 is populated.** See §2.4 — nothing in software can reliably detect a wrong/missing mic part.
3. **[HIGH] Hardware-in-the-loop test of BLE provisioning.** Never tested against a real phone or real ESP32. Pair a real collar against a real `godhan-app` install and confirm the full 3-write-then-poll flow actually completes (§3.2).
4. **[HIGH] Resolve the `LP_WAKE_CTRL` frequency table ambiguity** (§3.3.3) against the primary MPU6050 datasheet or a real timing measurement, before trusting a faster activity-sampling rate than the current conservative 1.25 Hz.
5. **[MEDIUM] Decide the OTA path.** Wire up the backend's existing MQTT push (`cattle/cmd`/`cattle/ota/status`) or consciously keep the current HTTP-poll approach and set a real `ota_url` — right now it's neither (placeholder URL, backend's push mechanism unused). See §3.4.
6. **[MEDIUM] Calibrate the three placeholder thresholds** against real field data: `POSTURE_WALK_MAG_THRESH_G`/`POSTURE_GRAZING_TILT_DEG`/`POSTURE_LYING_ACCZ_THRESH_G` (tool + protocol already exist, this folder), `RUM_CHEW_AMPLITUDE_THRESHOLD`, `ACTIVITY_MAG_THRESHOLD_G` (no tooling built yet for these last two — same grid-search approach as the posture tool would generalize).
7. **[LOW] Add NTP/RTC time sync** so readings carry a real timestamp instead of relying on backend receipt time (§3.4) — matters most for offline-buffered readings replayed after a reconnect.
8. **[INFO] MAX30102 (heart rate/SpO₂) and LMT70 (vaginal temp) are unimplemented by choice**, not oversight (§2.1). Flag if Phase 1 scope needs them — that's a product decision, not a firmware bug to silently fix.

---

## 6. References

- `esp_32_firmware_skeleton.cpp` (this folder) — the firmware this document describes.
- `IOT_DEVICE_DESIGN.md` (parent `docs/` folder) — hardware design source, §2 (hardware) and §3.6.1 (BLE, as-built).
- `calibrate_posture_thresholds.mjs`, `POSTURE_CALIBRATION_PROTOCOL.md` (this folder) — calibration tooling for §3.3.1.
- `Godhan_Vision_Layer_Spec_Analysis.md` (parent `docs/` folder) — the fuller investigation history behind most of the decisions in this document (Tier 0-4), including what was tried, what was ruled out, and why.
- `godhan-services/godhan-cattle-iot` — the backend this device talks to (MQTT bridge, registration endpoint, alert/baseline aggregation).
- `godhan-app`'s `GodhanBleConstants.kt` / `AndroidBluetoothScanner.kt` — the mobile-side BLE implementation this firmware's provisioning flow must match.
