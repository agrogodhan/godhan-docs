#pragma once
// ============================================================
//  sensors.h  —  All Sensor Drivers
//
//  Sensors:
//    U2 · MPU-6050   → Activity: steps, posture, activity score
//    U3 · MAX30102   → Health:   heart rate, SpO₂
//    U4 · DS18B20    → Health:   body temperature
//    U5 · INMP441    → Feeding:  rumination (jaw chew cycles)
//    U6 · LMT70      → Repro:    vaginal temp, estrus, calving
//
//  Bus assignments (matches PCB schematic):
//    I²C  SDA → GPIO4      I²C  SCL → GPIO5
//    1-Wire   → GPIO18
//    I²S  WS  → GPIO6      SCK → GPIO7    SD → GPIO8
//    ADC      → GPIO9   (LMT70 VOUT)
//
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <Wire.h>
#include <MPU6050.h>
#include <MAX30105.h>
#include <spo2_algorithm.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <driver/i2s.h>
#include <math.h>

// ── GPIO Map ─────────────────────────────────────────────────
#define PIN_I2C_SDA        4
#define PIN_I2C_SCL        5
#define PIN_ONE_WIRE       18
#define PIN_I2S_WS         6
#define PIN_I2S_SCK        7
#define PIN_I2S_SD         8
#define PIN_ADC_LMT70      9

// ── Health Threshold Constants (cattle ranges) ────────────────
#define TEMP_NORMAL_MIN_C     38.0f   // Normal cattle: 38.0–39.5°C
#define TEMP_NORMAL_MAX_C     39.5f
#define TEMP_FEVER_C          39.5f   // Fever threshold
#define HR_NORMAL_MIN         48      // Normal cattle HR: 48–84 bpm
#define HR_NORMAL_MAX         84
#define HR_HIGH_ALERT         100
#define SPO2_NORMAL_MIN       95      // Normal cattle SpO₂ > 95%
#define SPO2_ALERT_MIN        92
#define RUM_NORMAL_MIN        350     // Healthy: 350–600 jaw cycles/hr
#define RUM_LOW_ALERT         300     // Below 300 = illness flag

// ── Estrus / Calving detection ────────────────────────────────
#define ESTRUS_TEMP_RISE_C    0.5f    // Vaginal temp rise ≥ 0.5°C = estrus
#define CALVING_TEMP_DROP_C   0.3f    // Temp drop ≥ 0.3°C pre-calving
#define BASELINE_ALPHA        0.005f  // Baseline adaptation rate

// ── I²S config for INMP441 ────────────────────────────────────
#define I2S_PORT           I2S_NUM_0
#define I2S_SAMPLE_RATE    16000
#define I2S_DMA_BUF_COUNT  4
#define I2S_DMA_BUF_LEN    512
#define RUM_WINDOW_MS      5000      // Sample jaw sound for 5 seconds
#define RUM_PEAK_THRESHOLD 0.018f    // Mic signal amplitude threshold

// ── Activity step detection ────────────────────────────────────
#define STEP_UPPER_THRESH  1.20f    // acceleration magnitude (g)
#define STEP_LOWER_THRESH  1.05f
#define GRAZING_TILT_DEG  -25.0f    // head-down angle = grazing

// ── LMT70 conversion ──────────────────────────────────────────
// Vout = 1.8639 - 0.01158 × T  →  T = (1.8639 - Vout) / 0.01158
#define LMT70_V0           1.8639f
#define LMT70_TC           0.01158f
#define ADC_VREF           3.3f
#define ADC_MAX            4095.0f

// ── MAX30102 buffer size ──────────────────────────────────────
#define HR_BUFFER_LEN      100

// ============================================================
//  SensorData — all readings packed into one struct
// ============================================================
struct SensorData {
    // ── Activity (MPU-6050) ────────────────────────────────
    int32_t  steps;               // cumulative step count
    String   posture;             // "grazing"|"standing"|"lying"|"walking"
    int8_t   activityScore;       // 0–100

    // ── Health (MAX30102 + DS18B20) ────────────────────────
    float    bodyTempC;           // body temperature °C
    int32_t  heartRate;           // BPM  (0 = invalid)
    int32_t  spO2;                // %    (0 = invalid)
    int32_t  ruminationCyclesHr;  // jaw cycles per hour

    // ── Reproduction (LMT70) ──────────────────────────────
    float    vaginalTempC;        // vaginal temp °C
    bool     estrusFlag;          // heat detected
    bool     calvingAlert;        // pre-calving detected

    // ── Flags ─────────────────────────────────────────────
    bool     tempFever;
    bool     hrAlert;
    bool     spO2Alert;
    bool     ruminationAlert;
};

// ── Sensor object instances ───────────────────────────────────
static MPU6050          _mpu;
static MAX30105         _max30102;
static OneWire          _ow(PIN_ONE_WIRE);
static DallasTemperature _ds(&_ow);
static float            _vagBaseline = 38.5f;   // updated adaptively

// Step detection state
static int32_t  _stepCount  = 0;
static bool     _stepAbove  = false;

// ============================================================
//  initI2S()   private — sets up INMP441
// ============================================================
static bool _initI2S() {
    i2s_config_t cfg = {
        .mode            = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate     = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format  = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count   = I2S_DMA_BUF_COUNT,
        .dma_buf_len     = I2S_DMA_BUF_LEN,
        .use_apll        = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk      = 0
    };
    i2s_pin_config_t pins = {
        .bck_io_num    = PIN_I2S_SCK,
        .ws_io_num     = PIN_I2S_WS,
        .data_out_num  = I2S_PIN_NO_CHANGE,
        .data_in_num   = PIN_I2S_SD
    };
    esp_err_t r1 = i2s_driver_install(I2S_PORT, &cfg, 0, nullptr);
    esp_err_t r2 = i2s_set_pin(I2S_PORT, &pins);
    return (r1 == ESP_OK && r2 == ESP_OK);
}

// ============================================================
//  initSensors()
//  Call once in setup().  Returns true if all sensors OK.
// ============================================================
bool initSensors() {
    bool ok = true;

    // ── I²C bus ──────────────────────────────────────────
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);   // 400 kHz fast mode

    // ── MPU-6050 ─────────────────────────────────────────
    _mpu.initialize();
    if (_mpu.testConnection()) {
        _mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_4);   // ±4 g
        _mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);   // ±500 °/s
        _mpu.setDLPFMode(MPU6050_DLPF_BW_20);              // 20 Hz LPF
        _mpu.setSleepEnabled(false);
        Serial.println("[SENSOR] MPU-6050   OK  (I2C 0x68)");
    } else {
        Serial.println("[SENSOR] MPU-6050   FAIL");
        ok = false;
    }

    // ── MAX30102 ──────────────────────────────────────────
    if (_max30102.begin(Wire, I2C_SPEED_FAST)) {
        // ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange
        _max30102.setup(60, 4, 2, 400, 411, 4096);
        _max30102.setPulseAmplitudeRed(0x1F);
        _max30102.setPulseAmplitudeIR(0x1F);
        Serial.println("[SENSOR] MAX30102   OK  (I2C 0x57)");
    } else {
        Serial.println("[SENSOR] MAX30102   FAIL");
        ok = false;
    }

    // ── DS18B20 ───────────────────────────────────────────
    _ds.begin();
    _ds.setResolution(12);        // 12-bit = 0.0625°C resolution
    int found = _ds.getDeviceCount();
    if (found > 0) {
        Serial.printf("[SENSOR] DS18B20    OK  (%d probe(s) on 1-Wire)\n", found);
    } else {
        Serial.println("[SENSOR] DS18B20    FAIL  (no device on 1-Wire)");
        ok = false;
    }

    // ── INMP441 (I²S) ─────────────────────────────────────
    if (_initI2S()) {
        Serial.println("[SENSOR] INMP441    OK  (I2S port 0)");
    } else {
        Serial.println("[SENSOR] INMP441    FAIL");
        ok = false;
    }

    // ── LMT70 (ADC) ───────────────────────────────────────
    analogSetAttenuation(ADC_11db);   // 0–3.3 V range
    analogSetWidth(12);               // 12-bit
    Serial.printf("[SENSOR] LMT70      OK  (ADC GPIO%d)\n", PIN_ADC_LMT70);

    return ok;
}

// ============================================================
//  ── INDIVIDUAL SENSOR READ FUNCTIONS ──────────────────────
// ============================================================

// ── MPU-6050: Steps, posture, activity score ──────────────────
static void _readIMU(SensorData& d) {
    int16_t ax, ay, az, gx, gy, gz;
    _mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Convert raw to g  (±4g range → scale = 8192 LSB/g)
    float accX = ax / 8192.0f;
    float accY = ay / 8192.0f;
    float accZ = az / 8192.0f;

    float magnitude = sqrtf(accX*accX + accY*accY + accZ*accZ);

    // ── Step counting (peak detection) ───────────────────
    if (magnitude > STEP_UPPER_THRESH && !_stepAbove) {
        _stepCount++;
        _stepAbove = true;
    }
    if (magnitude < STEP_LOWER_THRESH) {
        _stepAbove = false;
    }
    d.steps = _stepCount;

    // ── Posture classification ────────────────────────────
    // Head-down tilt (arctan of X vs Z) indicates grazing
    float tiltDeg = atan2f(accX, accZ) * (180.0f / M_PI);

    if      (magnitude > 1.35f)              d.posture = "walking";
    else if (tiltDeg   < GRAZING_TILT_DEG)   d.posture = "grazing";
    else if (fabsf(accZ) < 0.25f)            d.posture = "lying";
    else                                     d.posture = "standing";

    // ── Activity score 0-100 ──────────────────────────────
    float excess = magnitude - 1.0f;
    d.activityScore = (int8_t)constrain((int)(excess * 200.0f), 0, 100);
}

// ── MAX30102: Heart rate and SpO₂ ────────────────────────────
static void _readHeartRate(SensorData& d) {
    uint32_t irBuf[HR_BUFFER_LEN];
    uint32_t redBuf[HR_BUFFER_LEN];

    // Collect HR_BUFFER_LEN samples
    for (int i = 0; i < HR_BUFFER_LEN; i++) {
        // Wait for new sample (with timeout)
        unsigned long t0 = millis();
        while (!_max30102.available()) {
            _max30102.check();
            if (millis() - t0 > 500) break;
        }
        redBuf[i] = _max30102.getRed();
        irBuf[i]  = _max30102.getIR();
        _max30102.nextSample();
    }

    // Finger/sensor contact detection: IR value < 50000 = no contact
    if (irBuf[HR_BUFFER_LEN - 1] < 50000) {
        d.heartRate = 0;
        d.spO2      = 0;
        return;
    }

    int32_t hr = 0, spo2 = 0;
    int8_t  hrValid = 0, spo2Valid = 0;

    maxim_heart_rate_and_oxygen_saturation(
        irBuf, HR_BUFFER_LEN, redBuf,
        &spo2, &spo2Valid, &hr, &hrValid);

    d.heartRate = (hrValid   && hr   > 0 && hr   < 300) ? hr   : 0;
    d.spO2      = (spo2Valid && spo2 > 0 && spo2 <= 100) ? spo2 : 0;
}

// ── DS18B20: Body temperature ─────────────────────────────────
static void _readBodyTemp(SensorData& d) {
    _ds.requestTemperatures();
    float t = _ds.getTempCByIndex(0);
    if (t == DEVICE_DISCONNECTED_C || t < 30.0f || t > 45.0f) {
        d.bodyTempC = 0.0f;         // invalid reading
        Serial.println("[SENSOR] DS18B20 read error.");
    } else {
        d.bodyTempC = t;
    }
}

// ── INMP441: Rumination — jaw chew cycle counting ─────────────
static void _readRumination(SensorData& d) {
    const int BUF_SAMPLES = I2S_DMA_BUF_LEN;
    int32_t   rawBuf[BUF_SAMPLES];
    size_t    bytesRead   = 0;
    int       peakCount   = 0;
    bool      inPeak      = false;

    unsigned long t0 = millis();

    while (millis() - t0 < (unsigned long)RUM_WINDOW_MS) {
        esp_err_t err = i2s_read(I2S_PORT,
                                 rawBuf,
                                 BUF_SAMPLES * sizeof(int32_t),
                                 &bytesRead,
                                 portMAX_DELAY);
        if (err != ESP_OK) continue;

        int n = (int)(bytesRead / sizeof(int32_t));
        for (int i = 0; i < n; i++) {
            // Normalise to -1.0 … +1.0
            float v = fabsf((float)rawBuf[i] / (float)0x7FFFFFFF);

            if (v > RUM_PEAK_THRESHOLD && !inPeak) {
                peakCount++;
                inPeak = true;
            }
            if (v < (RUM_PEAK_THRESHOLD * 0.5f)) {
                inPeak = false;
            }
        }
    }

    // Scale 5-second count → cycles per hour
    float windowSec = RUM_WINDOW_MS / 1000.0f;
    d.ruminationCyclesHr = (int32_t)((float)peakCount * (3600.0f / windowSec));
}

// ── LMT70: Vaginal temperature, estrus, calving ──────────────
static void _readVaginalTemp(SensorData& d) {
    // Average 16 ADC readings to reduce noise
    long sum = 0;
    for (int i = 0; i < 16; i++) {
        sum += analogRead(PIN_ADC_LMT70);
        delay(2);
    }
    float raw  = (float)(sum / 16);
    float vout = raw * (ADC_VREF / ADC_MAX);
    float temp = (LMT70_V0 - vout) / LMT70_TC;

    // Sanity check (normal cattle range 37–41°C)
    if (temp < 35.0f || temp > 43.0f) {
        d.vaginalTempC = 0.0f;
        return;
    }
    d.vaginalTempC = temp;

    float delta = temp - _vagBaseline;

    // Estrus detection: temp rises ≥ ESTRUS_TEMP_RISE_C
    d.estrusFlag   = (delta >=  ESTRUS_TEMP_RISE_C);

    // Pre-calving: temp drops ≥ CALVING_TEMP_DROP_C
    d.calvingAlert = (delta <= -CALVING_TEMP_DROP_C);

    // Slowly adapt baseline to individual cow's normal
    // (α = 0.005 → very slow drift, ~200 samples to move 1°C)
    _vagBaseline = _vagBaseline * (1.0f - BASELINE_ALPHA)
                 + temp         *         BASELINE_ALPHA;
}

// ── Health alert flags ────────────────────────────────────────
static void _computeAlerts(SensorData& d) {
    d.tempFever        = (d.bodyTempC > 0.0f && d.bodyTempC > TEMP_FEVER_C);
    d.hrAlert          = (d.heartRate > 0    && d.heartRate > HR_HIGH_ALERT);
    d.spO2Alert        = (d.spO2      > 0    && d.spO2 < SPO2_ALERT_MIN);
    d.ruminationAlert  = (d.ruminationCyclesHr > 0 &&
                          d.ruminationCyclesHr < RUM_LOW_ALERT);
}

// ============================================================
//  readAllSensors()
//  Public API — reads every sensor, fills d, sets alert flags
// ============================================================
void readAllSensors(SensorData& d) {
    _readIMU(d);
    _readBodyTemp(d);
    _readHeartRate(d);
    _readRumination(d);
    _readVaginalTemp(d);
    _computeAlerts(d);
}

// ============================================================
//  anyAlertActive()   convenience helper for main loop
// ============================================================
bool anyAlertActive(const SensorData& d) {
    return d.tempFever
        || d.hrAlert
        || d.spO2Alert
        || d.ruminationAlert
        || d.estrusFlag
        || d.calvingAlert;
}

// ============================================================
//  printSensorData()   serial debug
// ============================================================
void printSensorData(const SensorData& d) {
    Serial.println("──── Sensor Readings ────────────────────────");
    Serial.printf("  Steps         : %d   Posture: %s   Score: %d\n",
                  d.steps, d.posture.c_str(), d.activityScore);
    Serial.printf("  Body Temp     : %.2f°C  %s\n",
                  d.bodyTempC, d.tempFever ? "[FEVER!]" : "");
    Serial.printf("  Heart Rate    : %d bpm  SpO2: %d%%  %s\n",
                  d.heartRate, d.spO2,
                  (d.hrAlert || d.spO2Alert) ? "[ALERT!]" : "");
    Serial.printf("  Rumination    : %d cycles/hr  %s\n",
                  d.ruminationCyclesHr, d.ruminationAlert ? "[LOW!]" : "");
    Serial.printf("  Vaginal Temp  : %.2f°C  Baseline: %.2f°C\n",
                  d.vaginalTempC, _vagBaseline);
    Serial.printf("  Estrus        : %s    Calving: %s\n",
                  d.estrusFlag    ? "YES" : "no",
                  d.calvingAlert  ? "YES" : "no");
    Serial.println("─────────────────────────────────────────────");
}
