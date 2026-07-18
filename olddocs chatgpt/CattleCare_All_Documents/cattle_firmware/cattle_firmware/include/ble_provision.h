#pragma once
// ============================================================
//  ble_provision.h  —  BLE WiFi Provisioning
//
//  Purpose : Accept WiFi SSID, Password, and Cow-ID from the
//            farmer's mobile app via BLE GATT (one-time).
//            Credentials saved to NVS flash.
//            BLE is then permanently disabled to save power.
//
//  Protocol: BLE GATT server with 4 characteristics
//            1. SSID        (Write)
//            2. Password    (Write)
//            3. Cow ID      (Write)
//            4. Status      (Notify + Read)
//
//  Author  : Cattle Collar Firmware v1.0.0
// ============================================================

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

// ── Service & Characteristic UUIDs ──────────────────────────
#define BLE_SVC_UUID      "12345678-0000-1000-8000-00805F9B3400"
#define BLE_SSID_UUID     "12345678-0000-1000-8000-00805F9B3401"
#define BLE_PASS_UUID     "12345678-0000-1000-8000-00805F9B3402"
#define BLE_COWID_UUID    "12345678-0000-1000-8000-00805F9B3403"
#define BLE_STATUS_UUID   "12345678-0000-1000-8000-00805F9B3404"

// ── Status codes sent back to phone ─────────────────────────
#define STATUS_WAITING    "WAIT"
#define STATUS_OK         "OK:PROVISIONED"
#define STATUS_PARTIAL    "PARTIAL"
#define STATUS_TIMEOUT    "TIMEOUT"

// ── Timeout ──────────────────────────────────────────────────
#define BLE_TIMEOUT_MS    300000UL    // 5 minutes

// ── Internal state ───────────────────────────────────────────
static volatile bool   _bleDone  = false;
static String          _rcvSSID, _rcvPass, _rcvCowId;
static BLEServer*          _pServer   = nullptr;
static BLECharacteristic*  _pStatus   = nullptr;

// ============================================================
//  BLE Server connection events
// ============================================================
class CollarBLEServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) override {
        Serial.println("[BLE]  Phone connected.");
        if (_pStatus) {
            _pStatus->setValue(STATUS_WAITING);
            _pStatus->notify();
        }
    }
    void onDisconnect(BLEServer* pServer) override {
        Serial.println("[BLE]  Phone disconnected.");
        if (!_bleDone) {
            // Re-advertise so farmer can reconnect if disconnected early
            BLEDevice::startAdvertising();
        }
    }
};

// ============================================================
//  Characteristic write callbacks
//  Phone writes SSID, Password, CowID one by one.
//  When all three are received → save to NVS → notify OK.
// ============================================================
class ProvisionCallback : public BLECharacteristicCallbacks {
    Preferences* _prefs;
public:
    explicit ProvisionCallback(Preferences* p) : _prefs(p) {}

    void onWrite(BLECharacteristic* pChar) override {
        std::string raw = pChar->getValue();
        String val      = String(raw.c_str());
        String uuid     = pChar->getUUID().toString().c_str();

        if      (uuid.equalsIgnoreCase(BLE_SSID_UUID))  {
            _rcvSSID  = val;
            Serial.println("[BLE]  SSID received: " + _rcvSSID);
        }
        else if (uuid.equalsIgnoreCase(BLE_PASS_UUID))  {
            _rcvPass  = val;
            Serial.println("[BLE]  Password received (hidden)");
        }
        else if (uuid.equalsIgnoreCase(BLE_COWID_UUID)) {
            _rcvCowId = val;
            Serial.println("[BLE]  Cow ID received: " + _rcvCowId);
        }

        // Notify partial progress
        if (_pStatus) {
            int filled = (_rcvSSID.length()  > 0 ? 1 : 0)
                       + (_rcvPass.length()  > 0 ? 1 : 0)
                       + (_rcvCowId.length() > 0 ? 1 : 0);
            String prog = "RECV:" + String(filled) + "/3";
            _pStatus->setValue(prog.c_str());
            _pStatus->notify();
        }

        // All three received → save and signal completion
        if (_rcvSSID.length()  > 0 &&
            _rcvPass.length()  > 0 &&
            _rcvCowId.length() > 0)
        {
            _prefs->putString("ssid",        _rcvSSID);
            _prefs->putString("pass",        _rcvPass);
            _prefs->putString("cow_id",      _rcvCowId);
            _prefs->putBool  ("provisioned", true);

            if (_pStatus) {
                _pStatus->setValue(STATUS_OK);
                _pStatus->notify();
            }

            Serial.println("[BLE]  Provisioning complete!");
            Serial.println("[BLE]  SSID   = " + _rcvSSID);
            Serial.println("[BLE]  Cow ID = " + _rcvCowId);

            _bleDone = true;
        }
    }
};

// ============================================================
//  startBLEProvisioning()
//  Blocks until credentials received or timeout.
//  Returns true if successful, false if timed out.
// ============================================================
bool startBLEProvisioning(const String& deviceId, Preferences* prefs) {
    _bleDone  = false;
    _rcvSSID  = "";
    _rcvPass  = "";
    _rcvCowId = "";

    // Init BLE stack
    BLEDevice::init(deviceId.c_str());
    BLEDevice::setMTU(256);

    _pServer = BLEDevice::createServer();
    _pServer->setCallbacks(new CollarBLEServerCallbacks());

    // Create service
    BLEService* svc = _pServer->createService(BLE_SVC_UUID);

    // Helper lambda: create writable + readable characteristic
    auto makeWriteChar = [&](const char* uuid) -> BLECharacteristic* {
        auto* c = svc->createCharacteristic(uuid,
                      BLECharacteristic::PROPERTY_WRITE |
                      BLECharacteristic::PROPERTY_READ);
        c->setCallbacks(new ProvisionCallback(prefs));
        return c;
    };

    makeWriteChar(BLE_SSID_UUID);
    makeWriteChar(BLE_PASS_UUID);
    makeWriteChar(BLE_COWID_UUID);

    // Status characteristic — notify phone of progress
    _pStatus = svc->createCharacteristic(BLE_STATUS_UUID,
                   BLECharacteristic::PROPERTY_NOTIFY |
                   BLECharacteristic::PROPERTY_READ);
    _pStatus->addDescriptor(new BLE2902());
    _pStatus->setValue(STATUS_WAITING);

    svc->start();

    // Advertise with device name so phone can find it
    BLEAdvertising* pAdv = BLEDevice::getAdvertising();
    pAdv->addServiceUUID(BLE_SVC_UUID);
    pAdv->setScanResponse(true);
    pAdv->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("[BLE]  Advertising as: " + deviceId);
    Serial.println("[BLE]  Waiting for farmer app (timeout 5 min)...");

    // Block until provisioned or timeout
    unsigned long t0 = millis();
    while (!_bleDone) {
        if (millis() - t0 > BLE_TIMEOUT_MS) {
            Serial.println("[BLE]  Timeout! No credentials received.");
            if (_pStatus) { _pStatus->setValue(STATUS_TIMEOUT); _pStatus->notify(); }
            return false;
        }
        delay(100);
    }
    return true;
}

// ============================================================
//  stopBLE()
//  Permanently disable BLE to free RAM and save power.
//  Called after provisioning completes. Never called again.
// ============================================================
void stopBLE() {
    BLEDevice::stopAdvertising();
    delay(200);
    BLEDevice::deinit(true);    // true = release memory
    Serial.println("[BLE]  BLE stack de-initialised. Radio OFF permanently.");
}

// ============================================================
//  isProvisioned()
//  Quick NVS check — true if collar already has credentials
// ============================================================
bool isProvisioned(Preferences* prefs) {
    return prefs->getBool("provisioned", false);
}
