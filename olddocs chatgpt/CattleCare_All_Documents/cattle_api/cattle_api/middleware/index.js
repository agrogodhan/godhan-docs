// ============================================================
//  middleware/index.js  —  Auth, Validation, Error Handler
// ============================================================

const jwt     = require('jsonwebtoken');
const Joi     = require('joi');
const { User } = require('../models');

// ─────────────────────────────────────────────────────────────
//  protect()  —  JWT authentication middleware
// ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  authorize(...roles)  —  Role-based access
// ─────────────────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not allowed here.`,
    });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
//  farmScope  —  Ensures requested resource belongs to user's farm
// ─────────────────────────────────────────────────────────────
const farmScope = (req, res, next) => {
  req.farmId = req.user.farm.toString();
  next();
};

// ─────────────────────────────────────────────────────────────
//  validate(schema)  —  Joi request body validation
// ─────────────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ success: false, errors: messages });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
//  errorHandler  —  Global error handler (last middleware)
// ─────────────────────────────────────────────────────────────
const errorHandler = (err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, errors: messages });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ID format.` });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
};

// ─────────────────────────────────────────────────────────────
//  notFound  —  404 handler
// ─────────────────────────────────────────────────────────────
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
};

// ─────────────────────────────────────────────────────────────
//  JOI Validation Schemas
// ─────────────────────────────────────────────────────────────
const schemas = {
  register: Joi.object({
    name:     Joi.string().min(2).max(60).required(),
    phone:    Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
      'string.pattern.base': 'Enter a valid 10-digit Indian mobile number.',
    }),
    email:    Joi.string().email().optional(),
    password: Joi.string().min(6).required(),
    farmName: Joi.string().min(2).required(),
    location: Joi.object({
      city:   Joi.string(),
      state:  Joi.string(),
    }).optional(),
  }),

  login: Joi.object({
    phone:    Joi.string().required(),
    password: Joi.string().required(),
  }),

  addCow: Joi.object({
    cowId:     Joi.string().required(),
    name:      Joi.string().optional(),
    tagNumber: Joi.string().optional(),
    breed:     Joi.string().optional(),
    dob:       Joi.date().optional(),
    notes:     Joi.string().optional(),
  }),

  assignDevice: Joi.object({
    deviceId: Joi.string().required(),
    cowId:    Joi.string().required(),
  }),

  resolveAlert: Joi.object({
    resolution: Joi.string().min(3).required(),
  }),

  dateRange: Joi.object({
    from: Joi.date().required(),
    to:   Joi.date().min(Joi.ref('from')).required(),
  }),
};

module.exports = { protect, authorize, farmScope, validate, errorHandler, notFound, schemas };
