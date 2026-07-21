// =======================================================
// ESP32 Firmware Skeleton for Cow Wearable (Extended)
// - Collects data from sensors (IMU + Temp + Rumination Mic with FFT)
// - Stores aggregates locally in SPIFFS if Wi-Fi/MQTT fails
// - Uploads via Wi-Fi + MQTT every 5 minutes
// - Supports OTA firmware update
// - Sends low-battery alert
// - Uses deep sleep between uploads
// - BLE-provisions WiFi + cattle assignment on first boot (or after a factory
//   reset), matching godhan-app's real, already-shipped BLE contract exactly
//   (see docs/IOT_DEVICE_DESIGN.md §3.6.1) — not yet hardware-verified, see
//   that section's own gap note for why.
// =======================================================

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <FS.h>
#include <SPIFFS.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include "Adafruit_MPU6050.h"
#include "Adafruit_Sensor.h"
#include "OneWire.h"
#include "DallasTemperature.h"
#include <arduinoFFT.h>

// ---------- Wi-Fi & MQTT config ----------
// ssid/password are no longer compile-time constants — see the BLE provisioning
// section below. mqtt_server stays hardcoded (a farm-local broker address is a
// deployment concern, not something the mobile app's BLE contract sends —
// see docs/IOT_DEVICE_DESIGN.md §3.6.1).
String ssid;
String password;
const char* mqtt_server = "192.168.1.100";  // local broker IP or cloud broker
const int   mqtt_port = 1883;

// One constant edited per physical device at flash time (or read from NVS/a provisioning
// step, for a fleet) — everything below derives from it, rather than "cow01" hardcoded in
// three separate places. Topics follow godhan-cattle-iot's existing cattle/<purpose>/<deviceId>
// convention (already used for cattle/cmd/<deviceId> and cattle/ota/status/<deviceId>), so the
// backend's MQTT bridge (src/services/mqtt.service.js) can route by topic without a payload
// device_id lookup coming first. This device has no RTC/NTP, so readings carry no timestamp —
// the backend defaults to receipt time, meaning offline-buffered readings replayed on
// reconnect (see uploadOffline() below) land with the replay time, not when they happened.
const char* DEVICE_ID = "cow01";
const String TOPIC_DATA   = "cattle/data/"   + String(DEVICE_ID);
const String TOPIC_ALERTS = "cattle/alerts/" + String(DEVICE_ID);
const char* FW_VERSION = "1.0.0";

WiFiClient espClient;
PubSubClient client(espClient);

// ---------- OTA config ----------
const char* ota_url = "http://yourserver.com/firmware.bin"; // update server path

// ---------- godhan-cattle-iot registration ----------
// Base URL of godhan-cattle-iot (NOT cattle-service — this device talks only to the IoT
// service; cattle-service's own Cattle.deviceId link is completed server-side by that service
// itself, see docs/DEVELOPMENT_PLAN.md §3.40). Configure per deployment, same as mqtt_server/
// ota_url above.
const char* CATTLE_IOT_BASE_URL = "http://192.168.1.100:3008";
// Only needed if godhan-cattle-iot's API_KEY env var is actually set — its verifyApiKey
// middleware is a no-op otherwise (same dev-mode-fallback convention used throughout this
// platform's backend). Leave blank for local/dev use.
const char* DEVICE_API_KEY = "";

// ---------- Battery monitoring ----------
#define BATTERY_PIN 34   // ADC pin connected to battery divider
#define BATTERY_RATIO 2.0  // adjust for resistor divider ratio
#define LOW_BATTERY_THRESHOLD 3.5  // volts

// ---------- Sensor config ----------
Adafruit_MPU6050 mpu;
OneWire oneWire(4);            // GPIO4 for DS18B20
DallasTemperature sensors(&oneWire);

// Rumination mic input
#define MIC_PIN 35   // ADC pin connected to MEMS mic output

// ---------- FFT config ----------
#define SAMPLES 128             // must be power of 2
#define SAMPLING_FREQUENCY 2000 // Hz (depends on ADC speed)

arduinoFFT FFT = arduinoFFT();
double vReal[SAMPLES];
double vImag[SAMPLES];

// ---------- Timers ----------
#define UPLOAD_INTERVAL_MINUTES 5
#define uS_TO_S_FACTOR 1000000ULL

// ---------- BLE provisioning ----------
// Same UUIDs/characteristic shape as GodhanBleConstants.kt (godhan-app's real, shipped
// implementation) — this firmware is written to match the mobile app, not the other way
// around, since the mobile side already works and reversing it would be more disruptive.
#define BLE_SERVICE_UUID      "00001234-0000-1000-8000-00805f9b34fb"
#define CHAR_WIFI_SSID_UUID   "00001235-0000-1000-8000-00805f9b34fb"
#define CHAR_WIFI_PASS_UUID   "00001236-0000-1000-8000-00805f9b34fb"
#define CHAR_CATTLE_ID_UUID   "00001237-0000-1000-8000-00805f9b34fb"
#define CHAR_STATUS_UUID      "00001238-0000-1000-8000-00805f9b34fb"
#define BLE_DEVICE_NAME_PREFIX "GODHAN_"

// Bounded, not indefinite — an un-paired collar sitting in a box shouldn't advertise BLE and
// drain its battery forever. If nobody pairs it within this window, it goes back to deep sleep
// and simply retries provisioning mode on its next scheduled wake.
#define BLE_PROVISION_TIMEOUT_MS (5UL * 60UL * 1000UL)

// GPIO0 is the standard ESP32 "BOOT" button on every dev-board revision referenced in this
// repo's hardware docs (see docs/IOT_DEVICE_DESIGN.md §2.3's own GPIO0/BOOT row) and doesn't
// collide with any pin this file already uses (34, 35, 4, or the MPU6050's default I2C pins) —
// reused here rather than adding a dedicated reset button, matching the original design intent
// of "BLE only re-activates on factory reset (hardware button hold)" (§3.6 point 5).
#define FACTORY_RESET_PIN 0

Preferences prefs;
BLEServer* bleServer = nullptr;
BLECharacteristic* statusChar = nullptr;
String pendingSsid, pendingPassword, pendingCattleId;
bool gotSsid = false, gotPassword = false, gotCattleId = false;
volatile bool provisioningDone = false;   // set true once all 3 creds have arrived and been acted on

// ---------- Data buffers ----------
float accX_sum = 0, accY_sum = 0, accZ_sum = 0;
float temp_sum = 0;
int sample_count = 0;
int rumination_events = 0;

// ---------- Functions ----------
float readBatteryVoltage() {
  int raw = analogRead(BATTERY_PIN);
  float voltage = (raw / 4095.0) * 3.3 * BATTERY_RATIO;
  return voltage;
}

// FFT-based rumination detection
void detectRuminationFFT() {
  // Collect audio samples
  for (int i = 0; i < SAMPLES; i++) {
    vReal[i] = analogRead(MIC_PIN);
    vImag[i] = 0;
    delayMicroseconds(1000000 / SAMPLING_FREQUENCY);
  }

  // Apply FFT
  FFT.Windowing(vReal, SAMPLES, FFT_WIN_TYP_HAMMING, FFT_FORWARD);
  FFT.Compute(vReal, vImag, SAMPLES, FFT_FORWARD);
  FFT.ComplexToMagnitude(vReal, vImag, SAMPLES);

  // Look for chewing frequency range ~1–2 Hz bursts with harmonics up to ~50 Hz
  int chewDetected = 0;
  for (int i = 2; i < SAMPLES / 2; i++) {
    double freq = (i * 1.0 * SAMPLING_FREQUENCY) / SAMPLES;
    if (freq >= 1 && freq <= 50) {
      if (vReal[i] > 200) { // amplitude threshold (tune experimentally)
        chewDetected++;
      }
    }
  }

  if (chewDetected > 3) { // crude detection threshold
    rumination_events++;
  }
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting to WiFi");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("WiFi connect failed");
  }
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(DEVICE_ID)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void storeOffline(const String &payload) {
  File file = SPIFFS.open("/offline.log", FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open log file for writing");
    return;
  }
  file.println(payload);
  file.close();
  Serial.println("Stored offline: " + payload);
}

void uploadOffline() {
  if (!SPIFFS.exists("/offline.log")) return;
  File file = SPIFFS.open("/offline.log", FILE_READ);
  if (!file) return;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      client.publish(TOPIC_DATA.c_str(), line.c_str());
      delay(200);
    }
  }
  file.close();
  SPIFFS.remove("/offline.log");
  Serial.println("Offline data uploaded and cleared");
}

void publishData(float accX, float accY, float accZ, float temp, float batteryV, int rumination) {
  char payload[300];
  snprintf(payload, sizeof(payload),
           "{\"device_id\":\"%s\",\"accX\":%.2f,\"accY\":%.2f,\"accZ\":%.2f,\"temp\":%.2f,\"battery\":%.2f,\"rumination_events\":%d}",
           DEVICE_ID, accX, accY, accZ, temp, batteryV, rumination);

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnectMQTT();
    client.loop();
    client.publish(TOPIC_DATA.c_str(), payload);
    Serial.println("Published: ");
    Serial.println(payload);

    if (batteryV < LOW_BATTERY_THRESHOLD) {
      client.publish(TOPIC_ALERTS.c_str(), "{\"alert\":\"LOW_BATTERY\"}");
      Serial.println("Low battery alert sent!");
    }

    // Upload any offline data
    uploadOffline();
  } else {
    storeOffline(payload);
  }
}

void checkForOTA() {
  if (WiFi.status() == WL_CONNECTED) {
    t_httpUpdate_return ret = httpUpdate.update(espClient, ota_url);
    switch (ret) {
      case HTTP_UPDATE_FAILED:
        Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
        break;
      case HTTP_UPDATE_NO_UPDATES:
        Serial.println("No update available");
        break;
      case HTTP_UPDATE_OK:
        Serial.println("Update successful, rebooting...");
        break;
    }
  }
}

// The one HTTP call this firmware never made before — this is what actually links a paired
// collar to a farmer's animal server-side (godhan-cattle-iot's registerDevice(), which itself
// now calls cattle-service to complete the link — see docs/DEVELOPMENT_PLAN.md §3.40). Called
// once right after a successful provisioning, and again on every normal wake, so status/
// fwVersion/battery stay fresh and a re-provisioned cattleId picks up immediately — cheap, since
// the backend endpoint is an idempotent upsert.
bool registerWithBackend(const String &cattleId, float batteryV) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(CATTLE_IOT_BASE_URL) + "/api/devices/register";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_API_KEY) > 0) http.addHeader("X-API-Key", DEVICE_API_KEY);

  char payload[300];
  snprintf(payload, sizeof(payload),
           "{\"deviceId\":\"%s\",\"cattleId\":\"%s\",\"fwVersion\":\"%s\",\"battery\":%.2f,\"status\":\"online\"}",
           DEVICE_ID, cattleId.c_str(), FW_VERSION, batteryV);

  int httpCode = http.POST(payload);
  Serial.printf("registerWithBackend: HTTP %d\n", httpCode);
  http.end();
  return httpCode >= 200 && httpCode < 300;
}

// ---------- BLE provisioning ----------
// Same 3-write-then-poll shape as AndroidBluetoothScanner.kt's provisionDevice(): the phone
// writes SSID, then password, then cattleId as three separate characteristic writes; this
// device waits for all three before attempting anything, then reports success/failure back by
// setting the STATUS characteristic's value for the phone to read (the phone reads it, not
// subscribes to a notification — a plain PROPERTY_READ is enough, no CCCD/2902 descriptor
// needed).
//
// Deliberately does *no* WiFi work inside onWrite() itself — BLE GATT callbacks run on the
// ESP32 BLE stack's own task, and WiFi.begin()'s blocking connect-retry loop (up to ~10s) run
// there risks stalling the BLE stack (missed GATT timeouts, possible watchdog reset). The
// callback only records the value; runBleProvisioning()'s own poll loop (running on the main
// task, like the rest of setup()) is what actually calls attemptProvisioning() once all three
// have arrived.
class CredentialWriteCallback : public BLECharacteristicCallbacks {
  public:
    CredentialWriteCallback(int field) : field_(field) {}
    void onWrite(BLECharacteristic* c) override {
      std::string v = c->getValue();
      String value = String(v.c_str());
      switch (field_) {
        case 0: pendingSsid = value;     gotSsid = true;     break;
        case 1: pendingPassword = value; gotPassword = true; break;
        case 2: pendingCattleId = value; gotCattleId = true; break;
      }
    }
  private:
    int field_;
};

void attemptProvisioning() {
  Serial.println("BLE credentials received, attempting WiFi connect...");
  ssid = pendingSsid;
  password = pendingPassword;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    prefs.putString("ssid", ssid);
    prefs.putString("pass", password);
    prefs.putString("cattleId", pendingCattleId);
    prefs.putBool("provisioned", true);

    registerWithBackend(pendingCattleId, readBatteryVoltage());

    if (statusChar != nullptr) statusChar->setValue("OK");
    Serial.println("Provisioning succeeded");
    provisioningDone = true;
  } else {
    // Left un-set (provisioned stays false) so this boot's provisioning window — or the next
    // wake's — simply tries again. The phone-side times out after ~20s either way and shows an
    // error, matching AndroidBluetoothScanner.kt's own failure message.
    if (statusChar != nullptr) statusChar->setValue("FAIL");
    Serial.println("Provisioning failed — could not join WiFi with given credentials");
    gotSsid = gotPassword = gotCattleId = false; // allow a retry within the same window
  }
}

// Blocks (bounded by BLE_PROVISION_TIMEOUT_MS) until either provisioning succeeds or the
// window expires. On success, reboots into normal operation via ESP.restart() rather than
// trying to fall through into the rest of setup() within the same call — simpler and safer
// than merging two code paths in one function, and matches how most BLE-provisioning firmware
// (e.g. ESP32 WiFiProvisioning examples) structures this same transition.
void runBleProvisioning() {
  String bleName = String(BLE_DEVICE_NAME_PREFIX) + String(DEVICE_ID);
  Serial.println("Entering BLE provisioning mode as " + bleName);

  BLEDevice::init(bleName.c_str());
  bleServer = BLEDevice::createServer();
  BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

  BLECharacteristic* ssidChar = service->createCharacteristic(
      CHAR_WIFI_SSID_UUID, BLECharacteristic::PROPERTY_WRITE);
  ssidChar->setCallbacks(new CredentialWriteCallback(0));

  BLECharacteristic* passChar = service->createCharacteristic(
      CHAR_WIFI_PASS_UUID, BLECharacteristic::PROPERTY_WRITE);
  passChar->setCallbacks(new CredentialWriteCallback(1));

  BLECharacteristic* cattleIdChar = service->createCharacteristic(
      CHAR_CATTLE_ID_UUID, BLECharacteristic::PROPERTY_WRITE);
  cattleIdChar->setCallbacks(new CredentialWriteCallback(2));

  statusChar = service->createCharacteristic(
      CHAR_STATUS_UUID, BLECharacteristic::PROPERTY_READ);
  statusChar->setValue("WAITING");

  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->start();

  unsigned long start = millis();
  while (!provisioningDone && (millis() - start) < BLE_PROVISION_TIMEOUT_MS) {
    // Runs on the main task, not the BLE callback — see CredentialWriteCallback's own comment
    // for why the WiFi-connect attempt can't safely happen inside onWrite() itself.
    if (gotSsid && gotPassword && gotCattleId) {
      attemptProvisioning();
    }
    delay(200);
  }

  advertising->stop();
  BLEDevice::deinit(true); // fully release BLE before WiFi takes over — ESP32 shares radio
                            // hardware between the two, don't run both at once

  if (provisioningDone) {
    Serial.println("Rebooting into normal operation...");
    delay(500);
    ESP.restart();
  }

  // Timed out with nobody pairing it — go back to sleep and retry next scheduled wake, same
  // interval as normal operation so this doesn't behave differently/unexpectedly on the shelf.
  Serial.println("Provisioning window expired, going back to sleep");
  esp_sleep_enable_timer_wakeup(UPLOAD_INTERVAL_MINUTES * 60 * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  delay(100);

  prefs.begin("godhan", false);

  // Hold the BOOT button during power-on to force re-provisioning (new WiFi network, or
  // reassigning this collar to a different animal) — matches the original design's "BLE only
  // re-activates on factory reset (hardware button hold)".
  pinMode(FACTORY_RESET_PIN, INPUT_PULLUP);
  if (digitalRead(FACTORY_RESET_PIN) == LOW) {
    Serial.println("Factory reset button held — clearing stored provisioning");
    prefs.putBool("provisioned", false);
  }

  bool provisioned = prefs.getBool("provisioned", false);
  if (!provisioned) {
    runBleProvisioning(); // does not return on success (reboots); on timeout, sleeps and retries
    return;
  }

  ssid     = prefs.getString("ssid", "");
  password = prefs.getString("pass", "");
  String cattleId = prefs.getString("cattleId", "");

  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
  }

  // Init sensors
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setFilterBandwidth(MPU6050_BAND_5_HZ);

  sensors.begin();

  // Take a few samples for averaging
  for (int i = 0; i < 10; i++) {
    sensors.requestTemperatures();
    float tempC = sensors.getTempCByIndex(0);

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    accX_sum += a.acceleration.x;
    accY_sum += a.acceleration.y;
    accZ_sum += a.acceleration.z;
    temp_sum += tempC;
    sample_count++;

    delay(200);
  }

  float accX_avg = accX_sum / sample_count;
  float accY_avg = accY_sum / sample_count;
  float accZ_avg = accZ_sum / sample_count;
  float temp_avg = temp_sum / sample_count;
  float batteryV = readBatteryVoltage();

  // Detect rumination events with FFT
  detectRuminationFFT();
  int rumination = rumination_events;

  // Connect Wi-Fi + MQTT
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);

  // Keep the backend's Device record (and, transitively, cattle-service's Cattle.deviceId
  // link) fresh on every wake, not just the first — cheap idempotent upsert, see
  // registerWithBackend()'s own comment.
  registerWithBackend(cattleId, batteryV);

  // Publish data (or store offline)
  publishData(accX_avg, accY_avg, accZ_avg, temp_avg, batteryV, rumination);

  // OTA update check
  checkForOTA();

  // Go to deep sleep until next upload
  Serial.println("Going to deep sleep...");
  esp_sleep_enable_timer_wakeup(UPLOAD_INTERVAL_MINUTES * 60 * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void loop() {
  // Should never get here due to deep sleep
}
