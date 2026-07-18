// ============================================================
//  main.cpp  —  Cattle Smart Collar  —  Main Firmware
//
//  Device    : ESP32-S3 (WROOM-1)
//  Framework : Arduino / PlatformIO
//  Version   : 1.0.0
//
//  Flow:
//    FIRST BOOT
//      └─ BLE advertise → Phone sends WiFi creds + Cow ID
//         └─ Save to NVS flash
//            └─ Stop BLE permanently
//               └─ Connect WiFi → MQTT Cloud
//                  └─ Read sensors every 30 sec → Publish
//
//    SUBSEQUENT BOOTS
//      └─ Load creds from NVS (skip BLE)
//         └─ Connect WiFi → MQTT Cloud
//            └─ Read sensors every 30 sec → Publish
//
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <Preferences.h>
#include <esp_task_wdt.h>

#include "power.h"
#include "ble_provision.h"
#include "wifi_manager.h"
#include "sensors.h"
#include "cloud.h"

// ── Firmware identity ─────────────────────────────────────────
#define FW_VERSION            "1.0.0"
#define DEVICE_NAME_PREFIX    "CattleCollar-"

// ── Timing (milliseconds) ─────────────────────────────────────
#define NORMAL_SEND_INTERVAL_MS    30000UL    // 30 seconds
#define ALERT_SEND_INTERVAL_MS      5000UL    //  5 seconds on alert
#define HEARTBEAT_INTERVAL_MS      60000UL    // 60 seconds
#define POWER_CHECK_INTERVAL_MS    10000UL    // 10 seconds
#define WATCHDOG_TIMEOUT_S         120        //  2 minute watchdog

// ── NVS namespace ─────────────────────────────────────────────
#define NVS_NAMESPACE          "collar"

// ── Globals ───────────────────────────────────────────────────
static Preferences  prefs;
static SensorData   data;
static String       deviceId;
static String       cowId;

static unsigned long lastSendMs       = 0;
static unsigned long lastHeartbeatMs  = 0;
static unsigned long lastPowerCheckMs = 0;
static bool          firstSendDone    = false;

// ── Forward declarations ──────────────────────────────────────
static String buildDeviceId();
static void   handleProvisioning();
static void   mainSendCycle();
static void   sendHeartbeat();
static void   handlePowerCheck();
static void   printBootBanner();

// ============================================================
//  setup()
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(200);
    printBootBanner();

    // ── 1. Watchdog timer ─────────────────────────────────
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);

    // ── 2. Power management init ──────────────────────────
    initPower();
    checkBatteryCritical();          // abort early if flat battery

    // ── 3. NVS flash (persistent storage) ────────────────
    prefs.begin(NVS_NAMESPACE, false);

    // ── 4. Build unique device ID from MAC ───────────────
    deviceId = buildDeviceId();
    Serial.printf("[BOOT]  Device ID : %s\n", deviceId.c_str());

    // ── 5. BLE provisioning (first boot only) ────────────
    handleProvisioning();

    // ── 6. Load Cow ID from NVS ───────────────────────────
    cowId = prefs.getString("cow_id", "UNASSIGNED");
    Serial.printf("[BOOT]  Cow ID    : %s\n", cowId.c_str());

    // ── 7. Connect WiFi ───────────────────────────────────
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");

    if (ssid.isEmpty()) {
        Serial.println("[BOOT]  ERROR: No WiFi credentials in NVS!");
        Serial.println("[BOOT]  Factory reset and re-provision.");
        // Blink indicator then restart
        delay(3000);
        ESP.restart();
    }

    bool wOk = wifiConnect(ssid, pass);
    if (!wOk) {
        Serial.println("[BOOT]  WiFi failed. Restarting in 10s...");
        delay(10000);
        ESP.restart();
    }

    // ── 8. Connect MQTT cloud ─────────────────────────────
    cloudConnect(deviceId, cowId);

    // ── 9. Init sensors ───────────────────────────────────
    bool sensorsOk = initSensors();
    if (!sensorsOk) {
        Serial.println("[BOOT]  WARNING: One or more sensors failed init!");
        // Continue anyway — partial data is still useful
    }

    // ── 10. Register device with cloud ───────────────────
    if (cloudIsReady()) {
        cloudRegisterDevice(deviceId, cowId, FW_VERSION);
    }

    printPowerStatus();
    Serial.println("[BOOT]  ══ Setup complete. Entering main loop. ══\n");
}

// ============================================================
//  loop()
// ============================================================
void loop() {
    unsigned long now = millis();

    // ── Feed watchdog ─────────────────────────────────────
    esp_task_wdt_reset();

    // ── WiFi maintenance (auto-reconnect) ────────────────
    wifiMaintain();

    // ── MQTT maintenance ──────────────────────────────────
    cloudLoop();

    // ── Power check ───────────────────────────────────────
    if (now - lastPowerCheckMs >= POWER_CHECK_INTERVAL_MS) {
        lastPowerCheckMs = now;
        handlePowerCheck();
    }

    // ── Determine send interval based on alert state ─────
    // Read sensors first to know if alert is active
    // (for interval decision; full read happens inside mainSendCycle)
    unsigned long interval = anyAlertActive(data)
                             ? ALERT_SEND_INTERVAL_MS
                             : NORMAL_SEND_INTERVAL_MS;

    // ── Main sensor → cloud cycle ─────────────────────────
    if (!firstSendDone || (now - lastSendMs >= interval)) {
        lastSendMs    = now;
        firstSendDone = true;
        mainSendCycle();
    }

    // ── Heartbeat ─────────────────────────────────────────
    if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatMs = now;
        sendHeartbeat();
    }

    // ── Light sleep to save power between cycles ──────────
    // Only sleep if no alert active (alerts need fast response)
    if (!anyAlertActive(data) && cloudIsReady()) {
        unsigned long elapsed = millis() - lastSendMs;
        if (elapsed < NORMAL_SEND_INTERVAL_MS) {
            uint32_t sleepMs = (uint32_t)(NORMAL_SEND_INTERVAL_MS - elapsed);
            // Cap sleep to avoid missing MQTT keepalive
            sleepMs = min(sleepMs, (uint32_t)20000UL);
            if (sleepMs > 1000) {
                lightSleepMs(sleepMs);
            }
        }
    }
}

// ============================================================
//  mainSendCycle()
//  Read all sensors → publish data → publish alert if needed
// ============================================================
static void mainSendCycle() {
    // ── Read all sensors ──────────────────────────────────
    readAllSensors(data);
    printSensorData(data);

    // ── Sync cow_id if it was updated via MQTT command ────
    // (cloud.h sets an updated cowId via _cowId; re-read isn't
    // exposed here, but you can add a getter if needed)

    // ── Battery and signal strength ───────────────────────
    int battPct = getBatteryPercent();
    int rssi    = getWiFiRSSI();

    if (!cloudIsReady()) {
        Serial.println("[LOOP]  Cloud not ready. Skipping publish.");
        return;
    }

    // ── Publish main data ─────────────────────────────────
    bool dataSent = cloudPublishData(data, battPct, rssi);

    // ── Publish separate alert if any flag active ─────────
    if (anyAlertActive(data)) {
        cloudPublishAlert(data, battPct);
        Serial.println("[LOOP]  ⚠ Alert condition active!");
    }

    if (dataSent) {
        Serial.printf("[LOOP]  Cycle done.  Batt=%d%%  RSSI=%d  Zone=%s\n",
                      battPct, rssi, detectZone().c_str());
    }
}

// ============================================================
//  sendHeartbeat()
//  Lightweight online status ping — lets cloud detect dropped collars
// ============================================================
static void sendHeartbeat() {
    if (!cloudIsReady()) return;
    // Heartbeat is handled by MQTT retain in cloudRegisterDevice.
    // Here we just log it.
    Serial.printf("[HB]    Alive  Batt=%d%%  Uptime=%lus\n",
                  getBatteryPercent(), millis() / 1000);
}

// ============================================================
//  handlePowerCheck()
// ============================================================
static void handlePowerCheck() {
    PowerState ps = getPowerState();
    if (ps == PowerState::CRITICAL) {
        Serial.println("[PWR]  Battery CRITICAL. Shutting down.");
        cloudPublishAlert(data, getBatteryPercent());
        delay(500);
        deepSleepSeconds(3600);   // sleep 1 hour and hope solar charges it
    }
    if (ps == PowerState::LOW_BATTERY) {
        Serial.printf("[PWR]  Battery LOW (%d%%)\n", getBatteryPercent());
    }
}

// ============================================================
//  handleProvisioning()
//  First boot: BLE provision. Subsequent boots: skip BLE.
// ============================================================
static void handleProvisioning() {
    if (isProvisioned(&prefs)) {
        Serial.println("[PROV]  Already provisioned. Skipping BLE.");
        return;
    }

    Serial.println("[PROV]  First boot — starting BLE provisioning mode.");
    Serial.printf ("[PROV]  Device name: %s\n", deviceId.c_str());
    Serial.println("[PROV]  Open farmer app and scan for this device...");

    bool ok = startBLEProvisioning(deviceId, &prefs);

    if (!ok) {
        Serial.println("[PROV]  Provisioning failed/timeout. Restarting.");
        delay(2000);
        ESP.restart();
    }

    stopBLE();   // BLE permanently off after provisioning
}

// ============================================================
//  buildDeviceId()
//  Creates unique ID like "CattleCollar-A1B2C3" from MAC
// ============================================================
static String buildDeviceId() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char id[24];
    snprintf(id, sizeof(id), "%s%02X%02X%02X",
             DEVICE_NAME_PREFIX, mac[3], mac[4], mac[5]);
    return String(id);
}

// ============================================================
//  printBootBanner()
// ============================================================
static void printBootBanner() {
    Serial.println();
    Serial.println("╔══════════════════════════════════════════╗");
    Serial.println("║   CATTLE SMART COLLAR — ESP32-S3         ║");
    Serial.printf ("║   Firmware v%-30s║\n", FW_VERSION);
    Serial.println("║   BLE Provision + WiFi Direct Cloud       ║");
    Serial.println("╚══════════════════════════════════════════╝");
    Serial.println();
}
