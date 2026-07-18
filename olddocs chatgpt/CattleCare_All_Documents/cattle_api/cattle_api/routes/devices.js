// ============================================================
//  routes/devices.js  —  Device Registry Routes
//  GET  /api/devices            → list all collars
//  GET  /api/devices/:deviceId  → single device status
//  PUT  /api/devices/assign     → assign collar to cow
//  PUT  /api/devices/unassign   → remove collar from cow
// ============================================================
const router  = require('express').Router();
const { Device, Cow } = require('../models');
const { protect, farmScope, validate, schemas } = require('../middleware');

router.use(protect, farmScope);

router.get('/', async (req, res, next) => {
  try {
    const devices = await Device.find({ farm: req.farmId })
                                .populate('cow', 'cowId name tagNumber')
                                .sort({ lastSeen: -1 })
                                .lean();
    res.json({ success: true, count: devices.length, devices });
  } catch (err) { next(err); }
});

router.get('/:deviceId', async (req, res, next) => {
  try {
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      farm:     req.farmId,
    }).populate('cow', 'cowId name breed healthScore activeAlerts');
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });
    res.json({ success: true, device });
  } catch (err) { next(err); }
});

router.put('/assign', validate(schemas.assignDevice), async (req, res, next) => {
  try {
    const { deviceId, cowId } = req.body;

    const [device, cow] = await Promise.all([
      Device.findOne({ deviceId, farm: req.farmId }),
      Cow.findOne({ cowId, farm: req.farmId }),
    ]);

    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });
    if (!cow)    return res.status(404).json({ success: false, message: 'Cow not found.' });

    // Unlink previous cow if device was assigned
    if (device.cow) {
      await Cow.findByIdAndUpdate(device.cow, { device: null });
    }

    device.cow    = cow._id;
    device.status = 'active';
    cow.device    = device._id;

    await Promise.all([device.save(), cow.save()]);

    res.json({ success: true, message: `Device ${deviceId} assigned to cow ${cowId}.`, device });
  } catch (err) { next(err); }
});

router.put('/unassign/:deviceId', async (req, res, next) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId, farm: req.farmId });
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });

    if (device.cow) {
      await Cow.findByIdAndUpdate(device.cow, { device: null });
    }
    device.cow    = null;
    device.status = 'inactive';
    await device.save();

    res.json({ success: true, message: 'Device unassigned.' });
  } catch (err) { next(err); }
});

module.exports = router;


// ============================================================
//  routes/alerts.js  —  Alert Management Routes
//  GET  /api/alerts             → all farm alerts
//  GET  /api/alerts/active      → unresolved alerts
//  PUT  /api/alerts/:id/resolve → mark resolved
//  DELETE /api/alerts/:id       → delete
// ============================================================
const alertRouter = require('express').Router();
const { Alert }   = require('../models');

alertRouter.use(protect, farmScope);

alertRouter.get('/', async (req, res, next) => {
  try {
    const { type, resolved, severity, page = 1, limit = 50 } = req.query;
    const filter = { farm: req.farmId };
    if (type)     filter.type     = type;
    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
           .sort({ triggeredAt: -1 })
           .skip(skip)
           .limit(parseInt(limit))
           .lean(),
      Alert.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: parseInt(page), alerts });
  } catch (err) { next(err); }
});

alertRouter.get('/active', async (req, res, next) => {
  try {
    const alerts = await Alert.find({ farm: req.farmId, resolved: false })
                              .sort({ triggeredAt: -1 })
                              .lean();
    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) { next(err); }
});

alertRouter.put('/:id/resolve', validate(schemas.resolveAlert), async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, farm: req.farmId },
      {
        resolved:   true,
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
        resolution: req.body.resolution,
      },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    res.json({ success: true, alert });
  } catch (err) { next(err); }
});

alertRouter.delete('/:id', async (req, res, next) => {
  try {
    await Alert.findOneAndDelete({ _id: req.params.id, farm: req.farmId });
    res.json({ success: true, message: 'Alert deleted.' });
  } catch (err) { next(err); }
});

module.exports.alertRouter = alertRouter;


// ============================================================
//  routes/dashboard.js  —  Farm Dashboard Summary
//  GET /api/dashboard        → full farm overview
//  GET /api/dashboard/herd   → herd health snapshot
//  GET /api/dashboard/zones  → cattle zone distribution
// ============================================================
const dashRouter  = require('express').Router();
const { SensorReading, Cow: CowModel, Device: DevModel, Alert: AlertModel } = require('../models');
const dj = require('dayjs');

dashRouter.use(protect, farmScope);

dashRouter.get('/', async (req, res, next) => {
  try {
    const farmId = req.farmId;
    const now    = new Date();
    const ago24h = dj().subtract(24, 'hour').toDate();
    const ago1h  = dj().subtract(1, 'hour').toDate();

    const [
      totalCows,
      activeCows,
      activeDevices,
      offlineDevices,
      activeAlerts,
      criticalAlerts,
      alertsToday,
      estrusCows,
      calvingCows,
      avgVitals,
    ] = await Promise.all([
      CowModel.countDocuments({ farm: farmId }),
      CowModel.countDocuments({ farm: farmId, status: 'active' }),
      DevModel.countDocuments({ farm: farmId, status: 'active', lastSeen: { $gte: ago1h } }),
      DevModel.countDocuments({ farm: farmId, status: 'active', lastSeen: { $lt: ago1h } }),
      AlertModel.countDocuments({ farm: farmId, resolved: false }),
      AlertModel.countDocuments({ farm: farmId, resolved: false, severity: 'critical' }),
      AlertModel.countDocuments({ farm: farmId, triggeredAt: { $gte: ago24h } }),
      CowModel.countDocuments({ farm: farmId, 'lastReading.estrusFlag': true }),
      CowModel.countDocuments({ farm: farmId, 'lastReading.calvingAlert': true }),

      // Average vitals across all active cows (last reading)
      CowModel.aggregate([
        { $match: { farm: require('mongoose').Types.ObjectId.createFromHexString(farmId), status: 'active' } },
        {
          $group: {
            _id:            null,
            avgHealthScore: { $avg: '$healthScore' },
            avgBodyTemp:    { $avg: '$lastReading.bodyTempC' },
            avgHeartRate:   { $avg: '$lastReading.heartRate' },
            avgSpO2:        { $avg: '$lastReading.spO2' },
            avgActivity:    { $avg: '$lastReading.activityScore' },
          },
        },
      ]),
    ]);

    const vitals = avgVitals[0] || {};

    // Zone counts
    const zoneCounts = await CowModel.aggregate([
      { $match: { farm: require('mongoose').Types.ObjectId.createFromHexString(farmId), status: 'active' } },
      { $group: { _id: '$lastReading.zone', count: { $sum: 1 } } },
    ]);
    const zones = { shed: 0, open: 0, unknown: 0 };
    zoneCounts.forEach((z) => { if (z._id) zones[z._id] = z.count; });

    // Posture breakdown
    const postureCounts = await CowModel.aggregate([
      { $match: { farm: require('mongoose').Types.ObjectId.createFromHexString(farmId), status: 'active' } },
      { $group: { _id: '$lastReading.posture', count: { $sum: 1 } } },
    ]);
    const postures = {};
    postureCounts.forEach((p) => { if (p._id) postures[p._id] = p.count; });

    // Recent unresolved alerts (top 5)
    const recentAlerts = await AlertModel.find({ farm: farmId, resolved: false })
                                         .sort({ triggeredAt: -1 })
                                         .limit(5)
                                         .lean();

    res.json({
      success: true,
      timestamp: now,
      herd: {
        total:        totalCows,
        active:       activeCows,
        estrus:       estrusCows,
        calving:      calvingCows,
      },
      devices: {
        online:  activeDevices,
        offline: offlineDevices,
      },
      alerts: {
        active:   activeAlerts,
        critical: criticalAlerts,
        today:    alertsToday,
        recent:   recentAlerts,
      },
      zones,
      postures,
      avgVitals: {
        healthScore: Math.round(vitals.avgHealthScore || 0),
        bodyTempC:   +(vitals.avgBodyTemp  || 0).toFixed(2),
        heartRate:   Math.round(vitals.avgHeartRate || 0),
        spO2:        Math.round(vitals.avgSpO2 || 0),
        activityScore: Math.round(vitals.avgActivity || 0),
      },
    });
  } catch (err) { next(err); }
});

module.exports.dashRouter = dashRouter;
