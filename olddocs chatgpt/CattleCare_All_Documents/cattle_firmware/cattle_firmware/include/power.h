#pragma once
// ============================================================
//  power.h  —  Power Management
//  Handles : Battery ADC, light sleep, deep sleep, solar
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <esp_sleep.h>
#include <esp_wifi.h>
#include <driver/adc.h>

// ── Pin Definitions ──────────────────────────────────────────
#define PIN_BATT_ADC        10        // GPIO10  → voltage divider midpoint
#define BATT_DIVIDER_RATIO  2.0f      // R1=R2=100kΩ  →  Vout = Vbatt / 2
#define BATT_FULL_V         4.20f     // LiPo 100%
#define BATT_EMPTY_V        3.00f     // LiPo 0% cutoff
#define BATT_LOW_PCT        15        // Warn below 15%
#define BATT_CRITICAL_PCT   5         // Deep-sleep below 5%
#define ADC_VREF            3.3f
#define ADC_RESOLUTION      4095.0f

// ── Timing ───────────────────────────────────────────────────
#define DEEP_SLEEP_RECOVERY_S  3600ULL   // 1 hour deep sleep if critical

// ── Power state enum ─────────────────────────────────────────
enum class PowerState { NORMAL, LOW_BATTERY, CRITICAL };

// ── Internal: running average to smooth ADC noise ────────────
static float  _battSmooth   = -1.0f;   // -1 = uninitialised
static int    _battReadCount = 0;

// ============================================================
//  initPower()
//  Call once in setup() to configure ADC
// ============================================================
void initPower() {
    analogSetAttenuation(ADC_11db);        // 0 – 3.3 V range
    analogSetWidth(12);                    // 12-bit  (0-4095)
    // Prime the smoothing buffer with first reading
    int raw       = analogRead(PIN_BATT_ADC);
    float vADC    = raw * (ADC_VREF / ADC_RESOLUTION);
    _battSmooth   = vADC * BATT_DIVIDER_RATIO;
    Serial.printf("[PWR]  initPower() OK  Vbatt=%.2fV\n", _battSmooth);
}

// ============================================================
//  getBatteryVoltage()
//  Returns filtered LiPo voltage (V)
// ============================================================
float getBatteryVoltage() {
    int   raw    = analogRead(PIN_BATT_ADC);
    float vADC   = raw * (ADC_VREF / ADC_RESOLUTION);
    float vBatt  = vADC * BATT_DIVIDER_RATIO;

    // Exponential moving average  (α = 0.1)
    if (_battSmooth < 0.0f) _battSmooth = vBatt;
    else                    _battSmooth  = 0.9f * _battSmooth + 0.1f * vBatt;

    return _battSmooth;
}

// ============================================================
//  getBatteryPercent()
//  Returns 0-100 (int)
// ============================================================
int getBatteryPercent() {
    float v   = getBatteryVoltage();
    float pct = ((v - BATT_EMPTY_V) / (BATT_FULL_V - BATT_EMPTY_V)) * 100.0f;
    return (int)constrain(pct, 0.0f, 100.0f);
}

// ============================================================
//  getPowerState()
// ============================================================
PowerState getPowerState() {
    int pct = getBatteryPercent();
    if (pct <= BATT_CRITICAL_PCT) return PowerState::CRITICAL;
    if (pct <= BATT_LOW_PCT)      return PowerState::LOW_BATTERY;
    return PowerState::NORMAL;
}

// ============================================================
//  lightSleepMs(ms)
//  CPU halts; WiFi modem stays associated (keeps TCP alive).
//  Current drops from ~90 mA active → ~15 mA sleep.
// ============================================================
void lightSleepMs(uint32_t ms) {
    if (ms < 10) return;                              // too short, skip

    esp_wifi_set_ps(WIFI_PS_MIN_MODEM);               // modem power-save ON
    esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000ULL);
    esp_light_sleep_start();                          // enter light sleep
    esp_wifi_set_ps(WIFI_PS_NONE);                    // restore full WiFi
}

// ============================================================
//  deepSleepSeconds(s)
//  Full chip shutdown — WiFi disconnects, RAM lost (except RTC).
//  Only called on critical battery.
// ============================================================
void deepSleepSeconds(uint64_t s) {
    Serial.printf("[PWR]  Deep sleep for %llu s\n", s);
    Serial.flush();
    esp_sleep_enable_timer_wakeup(s * 1000000ULL);
    esp_deep_sleep_start();
}

// ============================================================
//  checkBatteryCritical()
//  Call in main loop — handles shutdown if battery too low
// ============================================================
void checkBatteryCritical() {
    if (getPowerState() == PowerState::CRITICAL) {
        Serial.printf("[PWR]  CRITICAL battery (%d%%). Entering deep sleep.\n",
                      getBatteryPercent());
        deepSleepSeconds(DEEP_SLEEP_RECOVERY_S);
    }
}

// ============================================================
//  printPowerStatus()
//  Debug helper
// ============================================================
void printPowerStatus() {
    Serial.printf("[PWR]  Vbatt=%.2fV  (%d%%)  State=%s\n",
        getBatteryVoltage(),
        getBatteryPercent(),
        getPowerState() == PowerState::NORMAL       ? "NORMAL"   :
        getPowerState() == PowerState::LOW_BATTERY  ? "LOW"      : "CRITICAL");
}
