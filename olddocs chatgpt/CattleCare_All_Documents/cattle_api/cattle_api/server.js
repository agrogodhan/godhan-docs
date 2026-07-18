// ============================================================
//  server.js  —  API Server Entry Point
//
//  Base URL  : http://localhost:3000/api
//
//  Routes:
//    POST /api/auth/register        → create farm + user
//    POST /api/auth/login           → get JWT token
//    GET  /api/auth/me              → current user
//    PUT  /api/auth/me              → update profile
//
//    GET  /api/dashboard            → farm overview
//
//    GET  /api/cows                 → list all cows
//    POST /api/cows                 → add cow
//    GET  /api/cows/:id             → cow profile
//    PUT  /api/cows/:id             → update cow
//    GET  /api/cows/:id/readings    → time-series data
//    GET  /api/cows/:id/trends      → aggregated trends
//    GET  /api/cows/:id/alerts      → cow alerts
//    POST /api/cows/:id/repro       → log repro event
//
//    GET  /api/devices              → list collars
//    PUT  /api/devices/assign       → assign collar → cow
//    PUT  /api/devices/unassign/:id → remove assignment
//
//    GET  /api/alerts               → all alerts
//    GET  /api/alerts/active        → unresolved alerts
//    PUT  /api/alerts/:id/resolve   → resolve alert
// ============================================================

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const connectDB   = require('./config/db');

const authRoutes   = require('./routes/auth');
const cowRoutes    = require('./routes/cows');
const deviceRoutes = require('./routes/devices');
const { alertRouter, dashRouter } = require('./routes/devices');
const { errorHandler, notFound }  = require('./middleware');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Connect MongoDB ───────────────────────────────────────────
connectDB();

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.NODE_ENV === 'production'
               ? ['https://your-farmer-app.com']
               : '*',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      300,              // 300 requests per window
  message:  { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api/', limiter);

// ── Strict limiter for auth ───────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many login attempts.' },
});
app.use('/api/auth/', authLimiter);

// ── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Request logging ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health check (no auth) ────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Cattle Collar API',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashRouter);
app.use('/api/cows',      cowRoutes);
app.use('/api/devices',   deviceRoutes);
app.use('/api/alerts',    alertRouter);

// ── API docs stub ─────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    service: 'Cattle Smart Collar API',
    version: '1.0.0',
    endpoints: {
      auth:      '/api/auth',
      dashboard: '/api/dashboard',
      cows:      '/api/cows',
      devices:   '/api/devices',
      alerts:    '/api/alerts',
    },
  });
});

// ── 404 & Error Handlers ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   CATTLE COLLAR API — v1.0.0         ║`);
  console.log(`║   Running on port ${PORT}               ║`);
  console.log(`║   ENV: ${(process.env.NODE_ENV || 'development').padEnd(28)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});

module.exports = app;
