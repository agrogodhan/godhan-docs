// =======================================================
// ESP32 Firmware Skeleton for Cow Wearable (Extended)
// - Collects data from sensors (IMU + Temp + Rumination Mic with FFT)
// - Stores aggregates locally in SPIFFS if Wi-Fi/MQTT fails
// - Uploads via Wi-Fi + MQTT every 5 minutes
// - Supports OTA firmware update
// - Sends low-battery alert
// - Uses deep sleep between uploads
// =======================================================

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <FS.h>
#include <SPIFFS.h>
#include "Adafruit_MPU6050.h"
#include "Adafruit_Sensor.h"
#include "OneWire.h"
#include "DallasTemperature.h"
#include <arduinoFFT.h>

// ---------- Wi-Fi & MQTT config ----------
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.100";  // local broker IP or cloud broker
const int   mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// ---------- OTA config ----------
const char* ota_url = "http://yourserver.com/firmware.bin"; // update server path

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
  WiFi.begin(ssid, password);
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
    if (client.connect("CowDevice01")) {
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
      client.publish("farm/cow01/data", line.c_str());
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
           "{\"device_id\":\"cow01\",\"accX\":%.2f,\"accY\":%.2f,\"accZ\":%.2f,\"temp\":%.2f,\"battery\":%.2f,\"rumination_events\":%d}",
           accX, accY, accZ, temp, batteryV, rumination);

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnectMQTT();
    client.loop();
    client.publish("farm/cow01/data", payload);
    Serial.println("Published: ");
    Serial.println(payload);

    if (batteryV < LOW_BATTERY_THRESHOLD) {
      client.publish("farm/cow01/alerts", "{\"alert\":\"LOW_BATTERY\"}");
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

void setup() {
  Serial.begin(115200);
  delay(100);

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
