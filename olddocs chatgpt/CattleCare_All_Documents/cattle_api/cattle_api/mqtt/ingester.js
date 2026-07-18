// ============================================================
//  mqtt/ingester.js  —  MQTT → MongoDB Data Pipeline
//
//  Subscribes to all cattle topics:
//    cattle/+/data    → sensor readings → SensorReading
//    cattle/+/alert   → alerts         → Alert
//    cattle/register  → new device     → Device
//
//  Runs as a standalone process alongside the API server:
//    node mqtt/ingester.js
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mqtt     = require('mqtt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { Device, Cow, SensorReading, Alert } = require('../models');

// ── MQTT topic patterns ───────────────────────────────────────
const TOPIC_DATA     = 'cattle/+/data';
const TOPIC_ALERT    = 'cattle/+/alert';
const TOPIC_REGISTER = 'cattle/register';

// ── Alert threshold config ────────────────────────────────────
const THRESH = {
  TEMP_FEVER:   parseFloat(process.env.ALERT_TEMP_FEVER)   || 39.5,
  HR_HIGH:      parseInt  (process.env.ALERT_HR_HIGH)       || 100,
  SPO2_LOW:     parseInt  (process.env.ALERT_SPO2_LOW)      || 92,
  RUM_LOW:      parseInt  (process.env.ALERT_RUMINATION_LOW) || 300,
  BATT_LOW:     15,
};

// ── Connect DB then start MQTT ────────────────────────────────
(async () => {
  await connectDB();
  console.log('[INGESTER]  DB connected. Starting MQTT ingester...');

  // ── MQTT client options ──────────────────────────────────────
  const mqttOpts = {
    clientId:  process.env.MQTT_CLIENT_ID || 'cattle-ingester',
    clean:     true,
    reconnectPeriod: 5000,
  };

  // TLS for production (AWS IoT)
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    mqttOpts.ca   = fs.readFileSync(process.env.MQTT_CA_CERT_PATH);
    mqttOpts.cert = fs.readFileSync(process.env.MQTT_CLIENT_CERT_PATH);
    mqttOpts.key  = fs.readFileSync(process.env.MQTT_CLIENT_KEY_PATH);
  }

  const client = mqtt.connect(process.env.MQTT_BROKER_URL, mqttOpts);

  // ── MQTT connect ──────────────────────────────────────────────
  client.on('connect', () => {
    console.log('[INGESTER]  MQTT connected.');
    client.subscribe([TOPIC_DATA, TOPIC_ALERT, TOPIC_REGISTER], { qos: 1 }, (err) => {
      if (err) console.error('[INGESTER]  Subscribe error:', err.message);
      else     console.log('[INGESTER]  Subscribed to cattle/#');
    });
  });

  client.on('error',        (err) => console.error('[INGESTER]  MQTT error:', err.message));
  client.on('reconnect',    ()    => console.log('[INGESTER]  MQTT reconnecting...'));
  client.on('offline',      ()    => console.warn('[INGESTER]  MQTT offline.'));

  // ── Message handler ───────────────────────────────────────────
  client.on('message', async (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      console.warn(`[INGESTER]  Bad JSON on ${topic}`);
      return;
    }

    try {
      if (topic === TOPIC_REGISTER)           await handleRegister(data);
      else if (topic.endsWith('/data'))        await handleSensorData(data);
      else if (topic.endsWith('/alert'))       await handleAlert(data);
    } catch (err) {
      console.error(`[INGESTER]  Handler error on ${topic}:`, err.message);
    }
  });

})();

// ============================================================
//  handleRegister()
//  Collar boots → registers itself → upsert Device document
// ============================================================
async function handleRegister(data) {
  const { device_id, cow_id, firmware_version } = data;
  if (!device_id) return;

  const device = await Device.findOneAndUpdate(
    { deviceId: device_id },
    {
      $set: {
        deviceId:        device_id,
        firmwareVersion: firmware_version || '1.0.0',
        status:          'active',
        lastSeen:        new Date(),
        provisionedAt:   new Date(),
      },
      $setOnInsert: { registeredAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // If cow_id provided → try to link to Cow document
  if (cow_id) {
    const cow = await Cow.findOne({ cowId: cow_id });
    if (cow) {
      device.cow  = cow._id;
      device.farm = cow.farm;
      cow.device  = device._id;
      await Promise.all([device.save(), cow.save()]);
      console.log(`[REGISTER]  ${device_id} → COW ${cow_id}`);
    }
  }

  console.log(`[REGISTER]  Device ${device_id} registered (fw=${firmware_version})`);
}

// ============================================================
//  handleSensorData()
//  Main data ingestion — every 30s from each collar
// ============================================================
async function handleSensorData(data) {
  const {
    device_id, cow_id, timestamp,
    steps, posture, activity_score,
    body_temp_c, heart_rate_bpm, spo2_pct, rumination_cycles_hr,
    vaginal_temp_c, estrus_flag, calving_alert,
    temp_fever, hr_alert, spo2_alert, rumination_alert,
    battery_pct, wifi_rssi, zone,
  } = data;

  if (!device_id || !cow_id) {
    console.warn('[DATA]  Missing device_id or cow_id. Skipping.');
    return;
  }

  const ts = timestamp ? new Date(timestamp) : new Date();

  // ── 1. Save SensorReading ─────────────────────────────────
  const reading = await SensorReading.create({
    deviceId: device_id,
    cowId:    cow_id,
    timestamp: ts,

    activity: {
      steps:         steps         || 0,
      posture:       posture       || 'unknown',
      activityScore: activity_score || 0,
    },
    health: {
      bodyTempC:          body_temp_c           || null,
      heartRate:          heart_rate_bpm         || null,
      spO2:               spo2_pct              || null,
      ruminationCyclesHr: rumination_cycles_hr  || null,
    },
    reproduction: {
      vaginalTempC:  vaginal_temp_c || null,
      estrusFlag:    estrus_flag    || false,
      calvingAlert:  calving_alert  || false,
    },
    alerts: {
      tempFever:       temp_fever        || false,
      hrAlert:         hr_alert          || false,
      spO2Alert:       spo2_alert        || false,
      ruminationAlert: rumination_alert  || false,
    },
    device: {
      batteryPct: battery_pct || null,
      wifiRSSI:   wifi_rssi   || null,
      zone:       zone        || 'unknown',
    },
  });

  // ── 2. Update Device last-seen ────────────────────────────
  await Device.findOneAndUpdate(
    { deviceId: device_id },
    {
      lastSeen:       ts,
      lastBatteryPct: battery_pct,
      lastWifiRSSI:   wifi_rssi,
      lastZone:       zone || 'unknown',
      status:         'active',
    }
  );

  // ── 3. Update Cow lastReading snapshot + health score ─────
  const healthScore = computeHealthScore(data);

  await Cow.findOneAndUpdate(
    { cowId: cow_id },
    {
      $set: {
        'lastReading.timestamp':        ts,
        'lastReading.bodyTempC':        body_temp_c,
        'lastReading.heartRate':        heart_rate_bpm,
        'lastReading.spO2':             spo2_pct,
        'lastReading.ruminationCycHr':  rumination_cycles_hr,
        'lastReading.posture':          posture,
        'lastReading.activityScore':    activity_score,
        'lastReading.zone':             zone,
        'lastReading.estrusFlag':       estrus_flag || false,
        'lastReading.calvingAlert':     calving_alert || false,
        healthScore,
      },
    }
  );

  // ── 4. Generate alerts from thresholds ────────────────────
  await checkAndCreateAlerts(data, ts);

  console.log(`[DATA]  ${device_id}/${cow_id}  T=${body_temp_c}°C HR=${heart_rate_bpm} SpO2=${spo2_pct}%`);
}

// ============================================================
//  handleAlert()
//  Collar published to /alert topic (high-priority)
//  Ensures alert is recorded even if ingester was busy
// ============================================================
async function handleAlert(data) {
  const { device_id, cow_id, reasons = [], timestamp } = data;
  if (!device_id || !cow_id) return;

  // Find cow's farm
  const cow = await Cow.findOne({ cowId: cow_id }).select('farm');
  if (!cow) return;

  const ts = timestamp ? new Date(timestamp) : new Date();

  for (const reason of reasons) {
    // Don't duplicate alert within last 30 min
    const recent = await Alert.findOne({
      cowId:       cow_id,
      type:        reason,
      resolved:    false,
      triggeredAt: { $gte: new Date(ts.getTime() - 30 * 60 * 1000) },
    });
    if (recent) continue;

    await Alert.create({
      farm:        cow.farm,
      cow:         cow._id,
      cowId:       cow_id,
      deviceId:    device_id,
      type:        reason,
      severity:    getSeverity(reason),
      message:     buildAlertMessage(reason, data),
      triggeredAt: ts,
      vitals: {
        bodyTempC:   data.body_temp_c,
        heartRate:   data.heart_rate_bpm,
        spO2:        data.spo2_pct,
        batteryPct:  data.battery_pct,
        zone:        data.zone,
      },
    });

    console.log(`[ALERT]  ${reason.toUpperCase()} — cow ${cow_id}`);
  }
}

// ============================================================
//  checkAndCreateAlerts()
//  Server-side alert logic (backup to collar firmware flags)
// ============================================================
async function checkAndCreateAlerts(data, ts) {
  const { device_id, cow_id, body_temp_c, heart_rate_bpm,
          spo2_pct, rumination_cycles_hr, estrus_flag,
          calving_alert, battery_pct } = data;

  const cow = await Cow.findOne({ cowId: cow_id }).select('farm _id');
  if (!cow) return;

  const checks = [
    { cond: body_temp_c           > THRESH.TEMP_FEVER, type: 'fever',            severity: 'critical' },
    { cond: heart_rate_bpm        > THRESH.HR_HIGH,    type: 'high_heart_rate',  severity: 'warning'  },
    { cond: spo2_pct > 0 && spo2_pct < THRESH.SPO2_LOW, type: 'low_spo2',       severity: 'critical' },
    { cond: rumination_cycles_hr > 0 && rumination_cycles_hr < THRESH.RUM_LOW,
                                       type: 'low_rumination',   severity: 'warning'  },
    { cond: estrus_flag,               type: 'estrus_detected',  severity: 'info'     },
    { cond: calving_alert,             type: 'calving_imminent', severity: 'critical' },
    { cond: battery_pct < THRESH.BATT_LOW && battery_pct > 0,
                                       type: 'low_battery',      severity: 'warning'  },
  ];

  for (const { cond, type, severity } of checks) {
    if (!cond) continue;
    // Deduplicate: skip if same unresolved alert exists in last 30 min
    const exists = await Alert.findOne({
      cowId: cow_id, type, resolved: false,
      triggeredAt: { $gte: new Date(ts.getTime() - 30 * 60 * 1000) },
    });
    if (exists) continue;

    await Alert.create({
      farm:        cow.farm,
      cow:         cow._id,
      cowId:       cow_id,
      deviceId:    device_id,
      type, severity,
      message:     buildAlertMessage(type, data),
      triggeredAt: ts,
      vitals: {
        bodyTempC:        data.body_temp_c,
        heartRate:        data.heart_rate_bpm,
        spO2:             data.spo2_pct,
        ruminationCycHr:  data.rumination_cycles_hr,
        vaginalTempC:     data.vaginal_temp_c,
        batteryPct:       data.battery_pct,
        zone:             data.zone,
      },
    });

    // Update activeAlerts count on Cow
    await Cow.findOneAndUpdate({ cowId: cow_id }, { $inc: { activeAlerts: 1 } });
    console.log(`[ALERT-CREATED]  ${type} — ${cow_id}`);
  }
}

// ============================================================
//  computeHealthScore()
//  Returns 0-100. Deducts points for each out-of-range vital.
// ============================================================
function computeHealthScore(data) {
  let score = 100;
  const { body_temp_c, heart_rate_bpm, spo2_pct, rumination_cycles_hr } = data;

  if (body_temp_c    > 39.5)  score -= 25;
  else if (body_temp_c > 39.0) score -= 10;

  if (heart_rate_bpm > 100)   score -= 15;
  else if (heart_rate_bpm > 90) score -= 5;

  if (spo2_pct > 0 && spo2_pct < 92)  score -= 20;
  else if (spo2_pct < 95)              score -= 5;

  if (rumination_cycles_hr > 0 && rumination_cycles_hr < 300) score -= 15;
  else if (rumination_cycles_hr < 350)                         score -= 5;

  return Math.max(0, Math.min(100, score));
}

// ── Alert severity mapping ────────────────────────────────────
function getSeverity(type) {
  const critical = ['fever', 'low_spo2', 'calving_imminent', 'device_offline'];
  const info     = ['estrus_detected', 'low_battery'];
  if (critical.includes(type)) return 'critical';
  if (info.includes(type))     return 'info';
  return 'warning';
}

// ── Human-readable alert messages ────────────────────────────
function buildAlertMessage(type, data) {
  const cowId = data.cow_id || '?';
  switch (type) {
    case 'fever':
      return `Cow ${cowId}: High body temperature ${data.body_temp_c?.toFixed(1)}°C (normal <39.5°C). Possible illness.`;
    case 'high_heart_rate':
      return `Cow ${cowId}: Elevated heart rate ${data.heart_rate_bpm} bpm (normal <84 bpm).`;
    case 'low_spo2':
      return `Cow ${cowId}: Low blood oxygen ${data.spo2_pct}% (normal >95%). Check breathing.`;
    case 'low_rumination':
      return `Cow ${cowId}: Low rumination ${data.rumination_cycles_hr} cycles/hr. Possible illness or stress.`;
    case 'estrus_detected':
      return `Cow ${cowId}: Estrus (heat) detected. Optimal breeding window now.`;
    case 'calving_imminent':
      return `Cow ${cowId}: Pre-calving signs detected. Calving expected soon. Attend to cow.`;
    case 'low_battery':
      return `Collar ${data.device_id}: Battery low (${data.battery_pct}%). Please charge.`;
    case 'device_offline':
      return `Collar ${data.device_id} for cow ${cowId} has gone offline.`;
    default:
      return `Alert: ${type} on cow ${cowId}.`;
  }
}
