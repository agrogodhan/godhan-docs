#pragma once
// ============================================================
//  wifi_manager.h  —  WiFi Connection & Zone Detection
//
//  Features:
//    • Connect using NVS-stored credentials
//    • Auto-reconnect on drop (non-blocking with backoff)
//    • NTP time sync (IST UTC+5:30)
//    • Zone detection (shed / open) via RSSI thresholds
//    • ISO-8601 timestamp generation
//
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <time.h>

// ── Config ───────────────────────────────────────────────────
#define WIFI_CONNECT_TIMEOUT_MS   15000UL   // 15 s initial connect
#define WIFI_RETRY_INTERVAL_MS    5000UL    // retry every 5 s if dropped
#define WIFI_MAX_RETRIES          12        // give up after 12 retries (~1 min)

#define NTP_SERVER_1      "pool.ntp.org"
#define NTP_SERVER_2      "time.google.com"
#define TZ_OFFSET_SEC     19800            // IST = UTC + 5:30
#define NTP_SYNC_TIMEOUT  20               // max NTP wait iterations

// ── Zone detection RSSI thresholds ───────────────────────────
// Indoor shed APs → stronger signal → RSSI closer to 0
// Outdoor open-area APs → weaker
#define RSSI_SHED_MIN    -65    // dBm  — stronger than this = shed
#define RSSI_OPEN_MAX    -66    // dBm  — weaker than this  = open

// ── Internal ─────────────────────────────────────────────────
static String _wifiSSID;
static String _wifiPass;
static bool   _ntpSynced        = false;
static int    _reconnectRetries = 0;
static unsigned long _lastRetryMs = 0;

// ============================================================
//  wifiConnect()
//  Blocking connect on first call.
//  Stores credentials for later reconnection.
// ============================================================
bool wifiConnect(const String& ssid, const String& pass) {
    _wifiSSID = ssid;
    _wifiPass = pass;

    Serial.printf("[WiFi] Connecting to SSID: %s\n", ssid.c_str());

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false);   // We handle reconnect manually
    WiFi.begin(ssid.c_str(), pass.c_str());

    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - t0 > WIFI_CONNECT_TIMEOUT_MS) {
            Serial.println("[WiFi] Connection TIMEOUT.");
            return false;
        }
        delay(250);
        Serial.print(".");
    }

    Serial.printf("\n[WiFi] Connected!  IP=%s  RSSI=%d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());

    _reconnectRetries = 0;

    // Sync NTP time
    configTime(TZ_OFFSET_SEC, 0, NTP_SERVER_1, NTP_SERVER_2);
    struct tm ti;
    Serial.print("[NTP]  Syncing");
    for (int i = 0; i < NTP_SYNC_TIMEOUT; i++) {
        if (getLocalTime(&ti)) {
            _ntpSynced = true;
            char buf[32];
            strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &ti);
            Serial.printf(" OK → %s IST\n", buf);
            break;
        }
        delay(500);
        Serial.print(".");
    }
    if (!_ntpSynced) Serial.println(" FAILED (will retry)");

    return true;
}

// ============================================================
//  wifiConnected()
//  Returns true when WiFi is associated and IP is valid
// ============================================================
bool wifiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

// ============================================================
//  wifiMaintain()
//  Call every loop() iteration.
//  Non-blocking reconnect with exponential-like backoff.
// ============================================================
void wifiMaintain() {
    if (wifiConnected()) {
        _reconnectRetries = 0;
        // Re-sync NTP once per day if not yet synced
        if (!_ntpSynced) {
            struct tm ti;
            if (getLocalTime(&ti)) _ntpSynced = true;
        }
        return;
    }

    // Not connected — attempt reconnect at intervals
    unsigned long now = millis();
    if (now - _lastRetryMs < WIFI_RETRY_INTERVAL_MS) return;
    _lastRetryMs = now;

    if (_reconnectRetries >= WIFI_MAX_RETRIES) {
        Serial.println("[WiFi] Max retries exceeded. Restarting ESP32...");
        delay(500);
        ESP.restart();
    }

    _reconnectRetries++;
    Serial.printf("[WiFi] Reconnect attempt %d/%d ...\n",
                  _reconnectRetries, WIFI_MAX_RETRIES);
    WiFi.disconnect(false);
    WiFi.begin(_wifiSSID.c_str(), _wifiPass.c_str());
}

// ============================================================
//  getWiFiRSSI()
// ============================================================
int getWiFiRSSI() {
    return WiFi.RSSI();
}

// ============================================================
//  detectZone()
//  Uses RSSI of currently associated AP to infer physical zone.
//  Shed APs are indoor → signal is stronger (RSSI closer to 0).
//  Returns: "shed" or "open"
// ============================================================
String detectZone() {
    int rssi = getWiFiRSSI();
    return (rssi >= RSSI_SHED_MIN) ? "shed" : "open";
}

// ============================================================
//  getISOTimestamp()
//  Returns ISO-8601 timestamp string  e.g. "2026-04-13T08:32:10Z"
//  Falls back to epoch zero if NTP not synced.
// ============================================================
String getISOTimestamp() {
    struct tm ti;
    if (!getLocalTime(&ti, 1000)) {
        return "1970-01-01T00:00:00Z";
    }
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
    return String(buf);
}

// ============================================================
//  printWiFiStatus()
//  Debug helper
// ============================================================
void printWiFiStatus() {
    Serial.printf("[WiFi] Status=%s  RSSI=%d dBm  Zone=%s  IP=%s\n",
        wifiConnected() ? "CONNECTED" : "DISCONNECTED",
        wifiConnected() ? getWiFiRSSI() : 0,
        wifiConnected() ? detectZone().c_str() : "?",
        WiFi.localIP().toString().c_str());
}
