// ============================================================
//  models/index.js  —  All MongoDB Schemas & Models
//
//  Collections:
//    farms          — dairy farm info
//    users          — farmer accounts
//    devices        — collar hardware registry
//    cows           — individual animal profiles
//    sensor_readings — time-series sensor data (TTL indexed)
//    alerts         — triggered health / reproduction alerts
// ============================================================

const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// ─────────────────────────────────────────────────────────────
//  FARM
//  One farm = one dairy compound
// ─────────────────────────────────────────────────────────────
const farmSchema = new Schema({
  name:        { type: String, required: true, trim: true },
  location:    {
    address:   String,
    city:      String,
    state:     String,
    pincode:   String,
    lat:       Number,
    lng:       Number,
  },
  compoundArea: { type: Number, default: 1 },   // acres
  timezone:    { type: String, default: 'Asia/Kolkata' },
  wifiSSID:    { type: String },                // farm network name (no password stored)
  zones:       [{ name: String, description: String }],  // e.g. shed, open
  createdAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// ─────────────────────────────────────────────────────────────
//  USER  (Farmer account)
// ─────────────────────────────────────────────────────────────
const userSchema = new Schema({
  name:        { type: String, required: true, trim: true },
  phone:       { type: String, required: true, unique: true },
  email:       { type: String, lowercase: true, sparse: true },
  passwordHash:{ type: String, required: true, select: false },
  role:        { type: String, enum: ['owner', 'worker', 'vet'], default: 'owner' },
  farm:        { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  pushToken:   { type: String },     // FCM token for mobile push alerts
  alertPrefs:  {
    fever:          { type: Boolean, default: true },
    estrus:         { type: Boolean, default: true },
    calving:        { type: Boolean, default: true },
    lowActivity:    { type: Boolean, default: true },
    lowBattery:     { type: Boolean, default: true },
  },
  lastLogin:   Date,
}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ farm: 1 });

// ─────────────────────────────────────────────────────────────
//  DEVICE  (Collar hardware)
// ─────────────────────────────────────────────────────────────
const deviceSchema = new Schema({
  deviceId:        { type: String, required: true, unique: true },
                   // e.g. "CattleCollar-A1B2C3" (from ESP32 MAC)
  farm:            { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  cow:             { type: Schema.Types.ObjectId, ref: 'Cow', default: null },
  firmwareVersion: { type: String, default: '1.0.0' },
  status:          { type: String, enum: ['active', 'inactive', 'faulty', 'charging'], default: 'inactive' },

  // Last known telemetry
  lastSeen:        { type: Date },
  lastBatteryPct:  { type: Number, min: 0, max: 100 },
  lastWifiRSSI:    { type: Number },
  lastZone:        { type: String, enum: ['shed', 'open', 'unknown'], default: 'unknown' },

  // Registration info
  registeredAt:    { type: Date, default: Date.now },
  provisionedAt:   { type: Date },  // when BLE provisioning completed

  // Hardware notes
  notes:           { type: String },
}, { timestamps: true });

deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ farm: 1 });
deviceSchema.index({ cow: 1 });
deviceSchema.index({ lastSeen: -1 });

// ─────────────────────────────────────────────────────────────
//  COW  (Individual animal profile)
// ─────────────────────────────────────────────────────────────
const cowSchema = new Schema({
  cowId:       { type: String, required: true },     // e.g. "COW-112"
  farm:        { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  device:      { type: Schema.Types.ObjectId, ref: 'Device', default: null },

  // Identity
  name:        { type: String, trim: true },         // optional pet name
  tagNumber:   { type: String },                     // physical ear tag
  breed:       { type: String },
  color:       { type: String },
  dob:         { type: Date },
  gender:      { type: String, enum: ['female', 'male'], default: 'female' },
  status:      { type: String, enum: ['active', 'sold', 'deceased'], default: 'active' },

  // Health baseline (personalised per cow)
  baseline: {
    bodyTempC:        { type: Number, default: 38.8 },
    heartRate:        { type: Number, default: 66   },
    spO2:             { type: Number, default: 97   },
    ruminationCycHr:  { type: Number, default: 420  },
    vaginalTempC:     { type: Number, default: 38.5 },
  },

  // Reproductive history
  reproHistory: [{
    event:      { type: String, enum: ['estrus', 'insemination', 'pregnancy_confirmed', 'calving', 'abortion'] },
    date:       { type: Date },
    notes:      { type: String },
    detectedBy: { type: String, enum: ['collar', 'manual'], default: 'collar' },
  }],

  // Latest snapshot (denormalised for fast dashboard queries)
  lastReading: {
    timestamp:         Date,
    bodyTempC:         Number,
    heartRate:         Number,
    spO2:              Number,
    ruminationCycHr:   Number,
    posture:           String,
    activityScore:     Number,
    zone:              String,
    estrusFlag:        Boolean,
    calvingAlert:      Boolean,
  },

  // Health score (computed by API, 0-100)
  healthScore:   { type: Number, min: 0, max: 100, default: 100 },
  activeAlerts:  { type: Number, default: 0 },

  notes:         { type: String },
  photo:         { type: String },    // URL
}, { timestamps: true });

cowSchema.index({ farm: 1 });
cowSchema.index({ cowId: 1, farm: 1 }, { unique: true });
cowSchema.index({ status: 1 });
cowSchema.index({ 'lastReading.estrusFlag': 1 });
cowSchema.index({ 'lastReading.calvingAlert': 1 });

// ─────────────────────────────────────────────────────────────
//  SENSOR_READING  (Time-series — main data collection)
//  TTL: auto-delete after 90 days to control storage
// ─────────────────────────────────────────────────────────────
const sensorReadingSchema = new Schema({
  // References
  deviceId:    { type: String, required: true, index: true },
  cowId:       { type: String, required: true, index: true },
  cow:         { type: Schema.Types.ObjectId, ref: 'Cow' },
  farm:        { type: Schema.Types.ObjectId, ref: 'Farm' },
  timestamp:   { type: Date,   required: true, index: true },

  // Activity (MPU-6050)
  activity: {
    steps:          { type: Number, default: 0 },
    posture:        { type: String, enum: ['grazing', 'standing', 'lying', 'walking', 'unknown'], default: 'unknown' },
    activityScore:  { type: Number, min: 0, max: 100 },
  },

  // Health (DS18B20 + MAX30102 + INMP441)
  health: {
    bodyTempC:          { type: Number },
    heartRate:          { type: Number },
    spO2:               { type: Number },
    ruminationCyclesHr: { type: Number },
  },

  // Reproduction (LMT70)
  reproduction: {
    vaginalTempC:  { type: Number },
    estrusFlag:    { type: Boolean, default: false },
    calvingAlert:  { type: Boolean, default: false },
  },

  // Alert flags (pre-computed by collar firmware)
  alerts: {
    tempFever:       { type: Boolean, default: false },
    hrAlert:         { type: Boolean, default: false },
    spO2Alert:       { type: Boolean, default: false },
    ruminationAlert: { type: Boolean, default: false },
  },

  // Device telemetry
  device: {
    batteryPct:  { type: Number, min: 0, max: 100 },
    wifiRSSI:    { type: Number },
    zone:        { type: String, enum: ['shed', 'open', 'unknown'], default: 'unknown' },
  },

  // TTL field — document auto-deleted 90 days after timestamp
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
}, {
  timestamps: false,       // we use our own timestamp field
  collection: 'sensor_readings',
});

// Compound indexes for common queries
sensorReadingSchema.index({ cowId: 1,    timestamp: -1 });
sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
sensorReadingSchema.index({ farm: 1,     timestamp: -1 });
sensorReadingSchema.index({ 'reproduction.estrusFlag': 1, timestamp: -1 });
sensorReadingSchema.index({ 'reproduction.calvingAlert': 1, timestamp: -1 });

// ─────────────────────────────────────────────────────────────
//  ALERT  (Triggered events — stored separately for history)
// ─────────────────────────────────────────────────────────────
const alertSchema = new Schema({
  farm:          { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
  cow:           { type: Schema.Types.ObjectId, ref: 'Cow' },
  cowId:         { type: String, required: true },
  deviceId:      { type: String, required: true },

  type: {
    type: String,
    required: true,
    enum: [
      'fever',
      'high_heart_rate',
      'low_spo2',
      'low_rumination',
      'estrus_detected',
      'calving_imminent',
      'low_battery',
      'device_offline',
      'sensor_error',
    ],
  },
  severity:      { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },

  // Snapshot of vitals at time of alert
  vitals: {
    bodyTempC:        Number,
    heartRate:        Number,
    spO2:             Number,
    ruminationCycHr:  Number,
    vaginalTempC:     Number,
    batteryPct:       Number,
    zone:             String,
  },

  message:       { type: String },   // human-readable description
  triggeredAt:   { type: Date, default: Date.now, index: true },

  // Resolution
  resolved:      { type: Boolean, default: false },
  resolvedAt:    { type: Date },
  resolvedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
  resolution:    { type: String },   // farmer's note on resolution

  // Push notification tracking
  notified:      { type: Boolean, default: false },
  notifiedAt:    { type: Date },
}, { timestamps: true });

alertSchema.index({ farm: 1,  triggeredAt: -1 });
alertSchema.index({ cowId: 1, triggeredAt: -1 });
alertSchema.index({ type: 1,  resolved: 1 });
alertSchema.index({ resolved: 1, triggeredAt: -1 });

// ─────────────────────────────────────────────────────────────
//  Export all models
// ─────────────────────────────────────────────────────────────
module.exports = {
  Farm:          model('Farm',          farmSchema),
  User:          model('User',          userSchema),
  Device:        model('Device',        deviceSchema),
  Cow:           model('Cow',           cowSchema),
  SensorReading: model('SensorReading', sensorReadingSchema),
  Alert:         model('Alert',         alertSchema),
};
