// ============================================================
//  config/db.js  —  MongoDB Connection
// ============================================================
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
    });

    console.log(`[DB]  MongoDB connected: ${conn.connection.host}`);

    // Connection events
    mongoose.connection.on('disconnected', () =>
      console.warn('[DB]  MongoDB disconnected. Retrying...')
    );
    mongoose.connection.on('reconnected', () =>
      console.log('[DB]  MongoDB reconnected.')
    );
    mongoose.connection.on('error', (err) =>
      console.error('[DB]  MongoDB error:', err)
    );

  } catch (err) {
    console.error('[DB]  Connection FAILED:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
