# Prediction Pipeline — End to End (Current State)

**Compiled:** 2026-07-19
**Scope:** How `godhan-iot-prediction` actually works today, from device to farmer — including
the gaps. Written as a refinement-input document, not a finished-state report.

---

## The pipeline as it actually stands today

### 1. Device → ingestion — fixed (2026-07-19)

The ESP32 collar firmware (per `docs/godhan iot docs/esp_32_firmware_skeleton.cpp`) talks
**MQTT**, not HTTP, and `godhan-cattle-iot`'s sensor-data endpoint (`POST /api/data`) is a plain
REST route — nothing bridged the two before. `godhan-cattle-iot` already ran an MQTT client for
OTA push/status (`src/services/mqtt.service.js`); it now also subscribes to
`cattle/data/<deviceId>` (sensor readings) and `cattle/alerts/<deviceId>` (device-side alerts,
e.g. low battery), resolves `deviceId → cattleId` via the paired `Device` record, and writes
through the same `addSensorData`/`createAlert` paths `POST /api/data`/`POST /api/alerts` use — a
reading from an unregistered or not-yet-paired device is dropped, not queued or errored. The
firmware skeleton was updated to match: topics now follow the `cattle/<purpose>/<deviceId>`
convention already used for `cattle/cmd/<deviceId>`/`cattle/ota/status/<deviceId>`, and the
hardcoded `"cow01"` scattered across the file is now a single `DEVICE_ID` constant. Verified
end-to-end against a live `godhan-cattle-iot` instance and an in-process test MQTT broker: a
paired device's reading and low-battery alert land correctly (with the resolved `cattleId`,
tolerant `device_id`/`rumination_events` field mapping, and a `Device.battery` update), and
readings from an unpaired or never-registered device are dropped without crashing the
subscriber. Known limitation, not fixed here: the reference firmware has no RTC/NTP, so readings
carry no timestamp — the bridge defaults to receipt time, meaning offline-buffered readings
replayed on reconnect land with the replay time, not when they actually happened.

### 2. `godhan-iot-prediction` runs — fixed (2026-07-19)

Previously: `deployment/godhan-iot-prediction.service` + `.timer` (systemd, every 6h) and a
docker-compose entry existed, but nothing had actually installed or enabled either — it only ran
if someone manually typed `python src/cattle_prediction.py`. `cattle_prediction.py`'s body is now
a plain `run()` function, and a new `src/scheduler.py` calls it immediately, then every
`SCHEDULE_INTERVAL_HOURS` (`.env`, default 6h) via the `schedule` package (already a dependency —
used by the pre-existing, opt-in `schedule_retraining`). This needs no systemd/root/Linux host:
`python -m src.scheduler` just works anywhere. `deployment/docker-compose.yml`'s `prediction`
service now runs this (`restart: always`) instead of the one-shot script with `restart: "no"`;
the systemd `.service` was collapsed from a oneshot-service + separate `.timer` pair into one
always-running `Type=simple` unit wrapping the same command (the `.timer` file is gone — no
longer needed once the process schedules itself). Verified live: ran the scheduler against real
seeded sensor/cattle data with a short test interval and confirmed it fires `run()` immediately,
then automatically fires again on schedule, saving real heat/calving predictions each time
without manual intervention.

When it runs:

- **Heat detection**: loads 30 days of sensor data → engineers features → trains/loads the
  RandomForest model. **Fixed (2026-07-19).** `predict_heat_events()` now runs unconditionally
  every job execution — no more opt-in `real_time_prediction_loop` gate — scoring the last 24h of
  readings and upserting the results into `heat_predictions` (keyed on `cattleId`+`timestamp`, so
  overlapping 6h-cron windows update rather than duplicate). Every run of the pipeline now writes
  real heat predictions.
- **Calving prediction**: for each cattle with sensor data + an active pregnancy, computes an
  "imminent" flag and saves it alongside the expected calving date to `calving_predictions`.
  **Fixed (2026-07-19).** It now reads `expectedCalvingDate` from `cattle-service`'s real,
  authoritative `cattles` collection via the same device-id join (`get_cattle_by_device`) that
  milk prediction already used — no longer re-derived from `godhan-cattle-iot`'s stale duplicate
  `cattle` collection. Heat, calving, and milk prediction now all agree on where cattle data comes
  from.
- **Milk prediction**: reconciles yesterday's hidden prediction against whatever the farmer has
  since logged in `cattle-service`, retrains on the growing matched history, predicts tomorrow,
  saves it hidden. Fully wired as designed.
- **Alerts**: **Fixed (2026-07-19).** `create_alert` is now called from two places in `run()`:
  once per cattle flagged `heatPrediction=1` in the current run's batch (`type: "HEAT_DETECTED"`,
  `severity: "warning"`) and once per cattle with `imminentCalving=True`
  (`type: "CALVING_IMMINENT"`, `severity: "critical"`) — one alert per cattle per event, not one
  per flagged reading (a single episode can span dozens of individually-flagged readings). A new
  `has_recent_alert` check (24h lookback, matching the heat model's own window) also collapses a
  multi-run *episode* into a single alert instead of re-alerting every 6h it's re-scored, while
  still allowing a genuinely new episode later to alert again. Verified: real
  `predict_calving_signals`/`predict_heat_events` output (not mocked) run through the exact
  wiring — confirms one alert per cattle regardless of how many readings/cattle are flagged, and
  that a second run within the window doesn't duplicate it. This writes to the same `alerts`
  collection `godhan-cattle-iot`'s own device-alert bridge (§1) and `GET /api/alerts/:cattleId`
  use, which is what makes §4's farmer-facing alerts feed a unified one (device-side *and*
  prediction-triggered) rather than two separate things.

### 3. Storage

**Consolidated to one database (2026-07-19, later widened platform-wide — see
`docs/DEVELOPMENT_PLAN.md` §3.35).** `godhan-cattle-iot`, `cattle-service`, and
`godhan-iot-prediction` now all share a single physical MongoDB database — previously
`godhan-cattle-iot`/`godhan-iot-prediction` used a separate `godhan_cattle_iot` database,
requiring a cross-database read for anything to join the two. One DB, many collections was
simpler for a project this size. Originally named `godhan_cattle`; renamed to plain `godhan` when
every other backend service was folded into the same database too — see §3.35, this doc isn't
re-litigating that, just noting the name changed. `cattle-service` owns `cattles`/`bulls`;
`godhan-cattle-iot` owns `sensor_data`/`alerts`/`devices`/`firmware`/`ota_logs`/`iot_cattle`
(renamed from a bare `cattle` model — it would otherwise have collided with cattle-service's own
`cattles` collection once merged into the same database); `godhan-iot-prediction` owns
`heat_predictions`/`calving_predictions`/`milk_predictions`. Everything predicted lands
correctly — this part works.

### 4. Surfacing to the farmer — fixed (2026-07-19)

`cattle-service` now exposes `GET /cattle/:id/predictions` (farmer JWT-authed, ownership-checked
the same way every other cattle route is — `Cattle.findOne({_id, farmerId})`), which resolves the
cattle's `deviceId` → the IoT pipeline's own `sensor_data.cattleId` → the latest
`heatPrediction`/`calvingPrediction`/reconciled `milkPrediction` (the hidden, not-yet-reconciled
forecast is deliberately excluded — see `milk.py`). A cattle with no paired device gets clean
nulls, not an error. `godhan-app`'s cattle detail screen now calls it and renders three cards
(Heat Detection, Milk Yield Forecast, and an imminent-calving warning folded into the existing
Calving Prediction card) — verified end-to-end against a live `cattle-service` instance with
seeded prediction data.

A second route, `GET /cattle/:id/alerts?limit=` (same auth/ownership pattern, added
2026-07-19), reads the same `alerts` collection §1/§2 write to — the deviceId→IoT-cattleId
resolution was factored out of `prediction.service.js` into a shared `iotLink.service.js` so
both routes stay consistent rather than duplicating the join. `godhan-app` now shows these in a
new **Alerts** card at the top of the cattle detail screen's Overview tab (above the prediction
cards — alerts are time-sensitive, those are passive), color-coded by severity, and only rendered
when there's something to show. Verified live: seeded a mix of severities/types, confirmed
newest-first ordering, `limit` clamping, a clean empty array for a no-device cattle, and rejection
for a non-owning farmer's token. The mobile UI itself still couldn't be compiled/run in this
environment (no Gradle wrapper/cache available) — reviewed by hand instead, should be
sanity-checked on a device/emulator.

---

### 5. Alerts → farmer notification — fixed (2026-07-19)

Both alert producers — `godhan-cattle-iot`'s device-side `createAlert` (§1's `LOW_BATTERY`, etc.)
and `godhan-iot-prediction`'s prediction-triggered `create_alert` (§2's `HEAT_DETECTED`/
`CALVING_IMMINENT`) — now resolve a `farmerId` (`cattleId → deviceId → cattle-service's
Cattle.deviceId`, a plain cross-collection read now that everything shares one database) and push
a real notification through `notification-service`, the same endpoint `cattle-service`'s own
heat/reminder events already use. Wired into `createAlert` itself on both sides, not the
individual call sites, so every current and future alert type gets this automatically. Full
writeup: `docs/DEVELOPMENT_PLAN.md` §3.34 (the FCM dispatch mechanism itself) and §3.36 (wiring
these two producers into it). Verified live in both languages: a real `POST /api/alerts` call and
a real `create_alert(...)` call each produced a real, correctly-addressed `Notification` document.

---

## Summary of what's real vs. missing

| Stage | Status |
|---|---|
| Device → ingestion | Fixed (2026-07-19) — `godhan-cattle-iot` bridges MQTT sensor data/alerts to the same write paths `POST /api/data`/`POST /api/alerts` use |
| Scheduled execution | Fixed (2026-07-19) — `src/scheduler.py` self-schedules every `SCHEDULE_INTERVAL_HOURS` (default 6h), no systemd/cron required |
| Heat detection | Fixed (2026-07-19) — predicts on last 24h and saves to `heat_predictions` every run |
| Calving prediction | Fixed (2026-07-19) — reads `expectedCalvingDate` from cattle-service's authoritative record |
| Milk prediction | Fully wired, forward + hidden + reconciled |
| Alerts | Fixed (2026-07-19) — `create_alert` wired to heat/calving predictions (deduped per episode) and surfaced via `GET /cattle/:id/alerts` + an Alerts card on the cattle detail screen |
| Mobile app / API surface | Fixed (2026-07-19) — `GET /cattle/:id/predictions` + `/alerts`, both rendered on the cattle detail screen |
| Alerts → farmer notification | Fixed (2026-07-19) — both alert producers push through `notification-service` (§5), with real Firebase Admin credentials now wired (`docs/DEVELOPMENT_PLAN.md` §3.34) |

---

## Open question for refinement

Every gap tracked in this doc is resolved, including real push credentials (2026-07-19 — the
user generated the service-account key themselves and provided it; credential chain verified
live via a real Firebase Admin SDK call, see `docs/DEVELOPMENT_PLAN.md` §3.34). What's left is
smaller and downstream of all of it:
- **Actual delivery to a real phone is still unconfirmed** — the credential chain (private key →
  signed JWT → Google OAuth2 → authorized FCM API call) is verified working, but no real
  device/FCM token exists in this environment to confirm a notification actually lands on a
  phone. Needs the app installed on a real device/emulator with a registered token.
- **No read/dismiss state** — alerts just accumulate; the Python-created ones have an unused
  `delivered` field and godhan-cattle-iot's own `Alert` model doesn't even have one.
- **The mobile UI has never actually been compiled** in this environment (no Gradle
  wrapper/cache) — every mobile change across this whole effort was verified by careful hand
  review of the diff, not a real build. Worth an actual `./gradlew build`/on-device check before
  trusting it fully.

Worth a real device/emulator build next to close both of the last two gaps at once — it would
confirm the mobile UI actually compiles *and* let a real FCM token be registered to test genuine
push delivery, rather than treating them as two separate follow-ups.
