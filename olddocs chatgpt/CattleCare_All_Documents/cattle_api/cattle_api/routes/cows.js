// ============================================================
//  routes/cows.js  —  Cow Management Routes
//
//  GET    /api/cows               → list all cows in farm
//  POST   /api/cows               → add new cow
//  GET    /api/cows/:cowId        → single cow profile
//  PUT    /api/cows/:cowId        → update cow details
//  DELETE /api/cows/:cowId        → remove cow
//  GET    /api/cows/:cowId/readings        → time-series readings
//  GET    /api/cows/:cowId/readings/latest → most recent reading
//  GET    /api/cows/:cowId/alerts          → cow's alert history
//  GET    /api/cows/:cowId/trends          → aggregated health trends
//  POST   /api/cows/:cowId/repro           → log reproduction event
// ============================================================

const router = require('express').Router();
const dayjs  = require('dayjs');
const { Cow, SensorReading, Alert, Device } = require('../models');
const { protect, farmScope, validate, schemas } = require('../middleware');

router.use(protect, farmScope);

// ─────────────────────────────────────────────────────────────
//  GET /api/cows
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status = 'active', sort = '-lastReading.timestamp', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { farm: req.farmId };
    if (status) filter.status = status;

    const [cows, total] = await Promise.all([
      Cow.find(filter)
         .populate('device', 'deviceId status lastBatteryPct lastZone')
         .sort(sort)
         .skip(skip)
         .limit(parseInt(limit))
         .lean(),
      Cow.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page:  parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      cows,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/cows
// ─────────────────────────────────────────────────────────────
router.post('/', validate(schemas.addCow), async (req, res, next) => {
  try {
    const { cowId, name, tagNumber, breed, dob, notes } = req.body;

    const exists = await Cow.findOne({ cowId, farm: req.farmId });
    if (exists) {
      return res.status(409).json({ success: false, message: `Cow ID '${cowId}' already exists.` });
    }

    const cow = await Cow.create({
      cowId, name, tagNumber, breed, dob, notes,
      farm: req.farmId,
    });

    res.status(201).json({ success: true, cow });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/cows/:cowId
// ─────────────────────────────────────────────────────────────
router.get('/:cowId', async (req, res, next) => {
  try {
    const cow = await Cow.findOne({ cowId: req.params.cowId, farm: req.farmId })
                         .populate('device', 'deviceId status firmwareVersion lastBatteryPct lastZone lastSeen');
    if (!cow) return res.status(404).json({ success: false, message: 'Cow not found.' });
    res.json({ success: true, cow });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  PUT /api/cows/:cowId
// ─────────────────────────────────────────────────────────────
router.put('/:cowId', async (req, res, next) => {
  try {
    const allowed = ['name', 'tagNumber', 'breed', 'color', 'dob', 'notes', 'photo', 'status', 'baseline'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const cow = await Cow.findOneAndUpdate(
      { cowId: req.params.cowId, farm: req.farmId },
      updates,
      { new: true, runValidators: true }
    );
    if (!cow) return res.status(404).json({ success: false, message: 'Cow not found.' });
    res.json({ success: true, cow });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  DELETE /api/cows/:cowId
// ─────────────────────────────────────────────────────────────
router.delete('/:cowId', async (req, res, next) => {
  try {
    const cow = await Cow.findOneAndUpdate(
      { cowId: req.params.cowId, farm: req.farmId },
      { status: 'sold' },
      { new: true }
    );
    if (!cow) return res.status(404).json({ success: false, message: 'Cow not found.' });
    // Detach device
    if (cow.device) {
      await Device.findByIdAndUpdate(cow.device, { cow: null, status: 'inactive' });
    }
    res.json({ success: true, message: 'Cow marked as sold/removed.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/cows/:cowId/readings/latest
// ─────────────────────────────────────────────────────────────
router.get('/:cowId/readings/latest', async (req, res, next) => {
  try {
    const reading = await SensorReading
      .findOne({ cowId: req.params.cowId })
      .sort({ timestamp: -1 })
      .lean();

    if (!reading) return res.status(404).json({ success: false, message: 'No readings yet.' });
    res.json({ success: true, reading });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/cows/:cowId/readings
//  Query: from, to, limit (default 200), fields
// ─────────────────────────────────────────────────────────────
router.get('/:cowId/readings', async (req, res, next) => {
  try {
    const {
      from  = dayjs().subtract(24, 'hour').toISOString(),
      to    = new Date().toISOString(),
      limit = 200,
    } = req.query;

    const readings = await SensorReading
      .find({
        cowId:     req.params.cowId,
        timestamp: { $gte: new Date(from), $lte: new Date(to) },
      })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .select('-__v -expireAt')
      .lean();

    res.json({ success: true, count: readings.length, readings });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/cows/:cowId/trends
//  Aggregated hourly averages for charts
//  Query: from, to, interval (hour|day)
// ─────────────────────────────────────────────────────────────
router.get('/:cowId/trends', async (req, res, next) => {
  try {
    const {
      from     = dayjs().subtract(7, 'day').toISOString(),
      to       = new Date().toISOString(),
      interval = 'hour',
    } = req.query;

    const bucketMs = interval === 'day' ? 86400000 : 3600000;

    const pipeline = [
      {
        $match: {
          cowId:     req.params.cowId,
          timestamp: { $gte: new Date(from), $lte: new Date(to) },
        },
      },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: '$timestamp' },
              { $mod: [{ $toLong: '$timestamp' }, bucketMs] },
            ],
          },
          avgBodyTemp:    { $avg: '$health.bodyTempC' },
          avgHeartRate:   { $avg: '$health.heartRate' },
          avgSpO2:        { $avg: '$health.spO2' },
          avgRumination:  { $avg: '$health.ruminationCyclesHr' },
          avgActivity:    { $avg: '$activity.activityScore' },
          totalSteps:     { $sum: '$activity.steps' },
          estrusSeen:     { $max: { $cond: ['$reproduction.estrusFlag', 1, 0] } },
          calvingSeen:    { $max: { $cond: ['$reproduction.calvingAlert', 1, 0] } },
          count:          { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id:           0,
          timestamp:     { $toDate: '$_id' },
          avgBodyTemp:   { $round: ['$avgBodyTemp', 2] },
          avgHeartRate:  { $round: ['$avgHeartRate', 0] },
          avgSpO2:       { $round: ['$avgSpO2', 0] },
          avgRumination: { $round: ['$avgRumination', 0] },
          avgActivity:   { $round: ['$avgActivity', 0] },
          totalSteps:    1,
          estrusSeen:    1,
          calvingSeen:   1,
          count:         1,
        },
      },
    ];

    const trends = await SensorReading.aggregate(pipeline);
    res.json({ success: true, interval, count: trends.length, trends });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/cows/:cowId/alerts
// ─────────────────────────────────────────────────────────────
router.get('/:cowId/alerts', async (req, res, next) => {
  try {
    const { resolved, limit = 50, page = 1 } = req.query;
    const filter = { cowId: req.params.cowId };
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const alerts = await Alert.find(filter)
      .sort({ triggeredAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/cows/:cowId/repro
//  Manually log a reproduction event
// ─────────────────────────────────────────────────────────────
router.post('/:cowId/repro', async (req, res, next) => {
  try {
    const { event, date, notes } = req.body;
    const cow = await Cow.findOneAndUpdate(
      { cowId: req.params.cowId, farm: req.farmId },
      {
        $push: {
          reproHistory: { event, date: date || new Date(), notes, detectedBy: 'manual' },
        },
      },
      { new: true }
    );
    if (!cow) return res.status(404).json({ success: false, message: 'Cow not found.' });
    res.json({ success: true, cow });
  } catch (err) { next(err); }
});

module.exports = router;
