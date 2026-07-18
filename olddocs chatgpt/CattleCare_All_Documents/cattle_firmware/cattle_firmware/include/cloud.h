#pragma once
// ============================================================
//  cloud.h  —  MQTT over TLS Cloud Communication
//
//  Broker  : AWS IoT Core (or any TLS MQTT broker)
//  Port    : 8883
//  Protocol: MQTT 3.1.1 with mutual TLS (client cert)
//
//  Topics  :
//    PUBLISH   cattle/{device_id}/data    → sensor readings
//    PUBLISH   cattle/{device_id}/alert   → urgent alerts
//    PUBLISH   cattle/register            → boot registration
//    SUBSCRIBE cattle/{device_id}/cmd     → OTA commands
//
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "sensors.h"
#include "wifi_manager.h"

// ── Broker ────────────────────────────────────────────────────
#define MQTT_BROKER       "your-endpoint.iot.ap-south-1.amazonaws.com"
#define MQTT_PORT         8883
#define MQTT_KEEPALIVE_S  60
#define MQTT_QOS          1
#define MQTT_PACKET_SIZE  1024
#define MQTT_CONNECT_RETRIES 5

// ── Topic templates  ({id} replaced at runtime) ───────────────
#define TOPIC_DATA        "cattle/{id}/data"
#define TOPIC_ALERT       "cattle/{id}/alert"
#define TOPIC_CMD         "cattle/{id}/cmd"
#define TOPIC_REGISTER    "cattle/register"
#define TOPIC_HEARTBEAT   "cattle/{id}/heartbeat"

// ============================================================
//  TLS Certificates
//  Replace the placeholder strings with your actual certs
//  from AWS IoT Console → Manage → Things → Certificates
// ============================================================
static const char AWS_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
<REPLACE WITH YOUR AWS ROOT CA — DOWNLOAD FROM AWS IOT CONSOLE>
-----END CERTIFICATE-----
)EOF";

static const char DEVICE_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
<REPLACE WITH YOUR DEVICE CERTIFICATE>
-----END CERTIFICATE-----
)EOF";

static const char PRIVATE_KEY[] PROGMEM = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
<REPLACE WITH YOUR DEVICE PRIVATE KEY>
-----END RSA PRIVATE KEY-----
)EOF";

// ── Internal ─────────────────────────────────────────────────
static WiFiClientSecure _tlsClient;
static PubSubClient     _mqtt(_tlsClient);
static String           _devId;
static String           _cowId;
static bool             _cloudReady = false;

// ============================================================
//  _topicFor()   replace {id} placeholder
// ============================================================
static String _topicFor(const char* tmpl) {
    String t = String(tmpl);
    t.replace("{id}", _devId);
    return t;
}

// ============================================================
//  _onMQTTMessage()
//  Handle commands received FROM the cloud (e.g. update cow_id,
//  trigger OTA, change send interval)
// ============================================================
static void _onMQTTMessage(char* topic, byte* payload, unsigned int len) {
    String msg = "";
    for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];

    Serial.printf("[MQTT]  CMD on %s : %s\n", topic, msg.c_str());

    StaticJsonDocument<256> cmd;
    if (deserializeJson(cmd, msg) != DeserializationError::Ok) return;

    const char* action = cmd["action"] | "";

    if (strcmp(action, "ping") == 0) {
        Serial.println("[MQTT]  Ping from cloud.");
    }
    else if (strcmp(action, "set_cow_id") == 0) {
        const char* newId = cmd["cow_id"] | "";
        if (strlen(newId) > 0) {
            _cowId = newId;
            // Persist update (caller's prefs not accessible here —
            // set a flag; main loop saves it)
            Serial.printf("[MQTT]  cow_id updated → %s\n", _cowId.c_str());
        }
    }
    else if (strcmp(action, "reboot") == 0) {
        Serial.println("[MQTT]  Reboot command received.");
        delay(500);
        ESP.restart();
    }
}

// ============================================================
//  _mqttConnect()
//  Internal: attempt one MQTT connect cycle
// ============================================================
static bool _mqttConnect() {
    Serial.printf("[MQTT]  Connecting to %s:%d ...\n", MQTT_BROKER, MQTT_PORT);

    // Last-will message — cloud knows collar went offline
    String lwTopic  = _topicFor(TOPIC_HEARTBEAT);
    String lwPayload = "{\"status\":\"offline\",\"device_id\":\"" + _devId + "\"}";

    bool ok = _mqtt.connect(
        _devId.c_str(),         // client ID
        nullptr, nullptr,       // no user/pass (cert auth)
        lwTopic.c_str(),        // Last-will topic
        MQTT_QOS,               // Last-will QoS
        true,                   // Last-will retain
        lwPayload.c_str()       // Last-will payload
    );

    if (ok) {
        // Subscribe to command topic
        _mqtt.subscribe(_topicFor(TOPIC_CMD).c_str(), MQTT_QOS);
        Serial.println("[MQTT]  Connected!");
        _cloudReady = true;

        // Publish online heartbeat
        String online = "{\"status\":\"online\",\"device_id\":\"" + _devId + "\"}";
        _mqtt.publish(lwTopic.c_str(), online.c_str(), true);
    } else {
        Serial.printf("[MQTT]  Failed. rc=%d\n", _mqtt.state());
        _cloudReady = false;
    }
    return ok;
}

// ============================================================
//  cloudConnect()
//  Call once in setup() after WiFi is up
// ============================================================
void cloudConnect(const String& deviceId, const String& cowId) {
    _devId = deviceId;
    _cowId = cowId;

    // Configure TLS client
    _tlsClient.setCACert(AWS_ROOT_CA);
    _tlsClient.setCertificate(DEVICE_CERT);
    _tlsClient.setPrivateKey(PRIVATE_KEY);

    _mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    _mqtt.setCallback(_onMQTTMessage);
    _mqtt.setBufferSize(MQTT_PACKET_SIZE);
    _mqtt.setKeepAlive(MQTT_KEEPALIVE_S);

    // Retry connect
    for (int i = 0; i < MQTT_CONNECT_RETRIES; i++) {
        if (_mqttConnect()) return;
        delay(3000);
    }
    Serial.println("[MQTT]  Could not connect. Will retry in loop.");
}

// ============================================================
//  cloudLoop()
//  Call every loop() iteration — maintains MQTT and reconnects
// ============================================================
void cloudLoop() {
    if (!_mqtt.connected()) {
        if (wifiConnected()) {
            Serial.println("[MQTT]  Disconnected. Reconnecting...");
            _mqttConnect();
        }
        return;
    }
    _mqtt.loop();
}

// ============================================================
//  cloudRegisterDevice()
//  Publish boot registration packet (retained = true so cloud
//  always knows the device exists even between readings)
// ============================================================
void cloudRegisterDevice(const String& devId,
                         const String& cowId,
                         const char*   fwVersion) {
    StaticJsonDocument<256> doc;
    doc["device_id"]        = devId;
    doc["cow_id"]           = cowId;
    doc["firmware_version"] = fwVersion;
    doc["event"]            = "boot";
    doc["timestamp"]        = getISOTimestamp();

    String payload;
    serializeJson(doc, payload);

    _mqtt.publish(TOPIC_REGISTER, payload.c_str(), true /*retain*/);
    Serial.println("[MQTT]  Device registered on cloud.");
}

// ============================================================
//  cloudPublishData()
//  Main sensor data publication — every 30 seconds
// ============================================================
bool cloudPublishData(const SensorData& d,
                      int battPct,
                      int rssi) {
    if (!_mqtt.connected()) return false;

    StaticJsonDocument<512> doc;

    // Identity & time
    doc["device_id"]  = _devId;
    doc["cow_id"]     = _cowId;
    doc["timestamp"]  = getISOTimestamp();

    // Activity
    doc["steps"]           = d.steps;
    doc["posture"]         = d.posture;
    doc["activity_score"]  = d.activityScore;

    // Health
    doc["body_temp_c"]          = serialized(String(d.bodyTempC, 2));
    doc["heart_rate_bpm"]       = d.heartRate;
    doc["spo2_pct"]             = d.spO2;
    doc["rumination_cycles_hr"] = d.ruminationCyclesHr;

    // Reproduction
    doc["vaginal_temp_c"] = serialized(String(d.vaginalTempC, 2));
    doc["estrus_flag"]    = d.estrusFlag;
    doc["calving_alert"]  = d.calvingAlert;

    // Alerts
    doc["temp_fever"]       = d.tempFever;
    doc["hr_alert"]         = d.hrAlert;
    doc["spo2_alert"]       = d.spO2Alert;
    doc["rumination_alert"] = d.ruminationAlert;

    // Device status
    doc["battery_pct"] = battPct;
    doc["wifi_rssi"]   = rssi;
    doc["zone"]        = detectZone();

    String payload;
    serializeJson(doc, payload);

    bool ok = _mqtt.publish(
        _topicFor(TOPIC_DATA).c_str(),
        payload.c_str(),
        false    // not retained — time-series data
    );

    if (ok) Serial.printf("[MQTT]  Data sent  (%d bytes)\n", payload.length());
    else    Serial.println("[MQTT]  Publish FAILED");

    return ok;
}

// ============================================================
//  cloudPublishAlert()
//  High-priority alert — published to separate /alert topic
//  Retained = true so cloud dashboard shows latest alert
// ============================================================
bool cloudPublishAlert(const SensorData& d, int battPct) {
    if (!_mqtt.connected()) return false;

    StaticJsonDocument<256> doc;
    doc["device_id"]  = _devId;
    doc["cow_id"]     = _cowId;
    doc["timestamp"]  = getISOTimestamp();
    doc["battery_pct"] = battPct;

    // Build alert reason array
    JsonArray reasons = doc.createNestedArray("reasons");
    if (d.tempFever)       reasons.add("fever");
    if (d.hrAlert)         reasons.add("high_heart_rate");
    if (d.spO2Alert)       reasons.add("low_spo2");
    if (d.ruminationAlert) reasons.add("low_rumination");
    if (d.estrusFlag)      reasons.add("estrus_detected");
    if (d.calvingAlert)    reasons.add("calving_imminent");

    // Key vitals
    doc["body_temp_c"]    = serialized(String(d.bodyTempC, 2));
    doc["heart_rate_bpm"] = d.heartRate;
    doc["spo2_pct"]       = d.spO2;
    doc["estrus_flag"]    = d.estrusFlag;
    doc["calving_alert"]  = d.calvingAlert;

    String payload;
    serializeJson(doc, payload);

    bool ok = _mqtt.publish(
        _topicFor(TOPIC_ALERT).c_str(),
        payload.c_str(),
        true   // retained — cloud always sees latest alert state
    );

    if (ok) Serial.println("[MQTT]  ALERT published!");
    return ok;
}

// ============================================================
//  cloudIsReady()
// ============================================================
bool cloudIsReady() {
    return _cloudReady && _mqtt.connected();
}
