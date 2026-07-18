// ============================================================
//  routes/auth.js  —  Authentication Routes
//  POST /api/auth/register
//  POST /api/auth/login
//  GET  /api/auth/me
//  PUT  /api/auth/me
// ============================================================

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Farm, User }         = require('../models');
const { protect, validate, schemas } = require('../middleware');

// ── Sign JWT helper ───────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
//  Creates farm + owner user in one step
// ─────────────────────────────────────────────────────────────
router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const { name, phone, email, password, farmName, location } = req.body;

    // Check phone not already used
    if (await User.findOne({ phone })) {
      return res.status(409).json({ success: false, message: 'Phone already registered.' });
    }

    // Create farm
    const farm = await Farm.create({
      name:     farmName,
      location: location || {},
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name, phone, email, passwordHash,
      role: 'owner',
      farm: farm._id,
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Farm and account created.',
      token,
      user: {
        id:    user._id,
        name:  user.name,
        phone: user.phone,
        role:  user.role,
        farm:  { id: farm._id, name: farm.name },
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone })
                           .select('+passwordHash')
                           .populate('farm', 'name');

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Invalid phone or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id:    user._id,
        name:  user.name,
        phone: user.phone,
        role:  user.role,
        farm:  { id: user.farm._id, name: user.farm.name },
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/me
// ─────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).populate('farm', 'name location');
  res.json({ success: true, user });
});

// ─────────────────────────────────────────────────────────────
//  PUT /api/auth/me  —  Update push token or alert prefs
// ─────────────────────────────────────────────────────────────
router.put('/me', protect, async (req, res, next) => {
  try {
    const allowed = ['pushToken', 'alertPrefs', 'name', 'email'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

module.exports = router;
