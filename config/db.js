const mongoose = require('mongoose');
const dns = require('dns');

const MONGO_URI = process.env.MONGO_URI?.trim() || 'mongodb://localhost:27017/ultracare';

dns.setDefaultResultOrder('ipv4first');

const setDnsFallback = () => {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('[Database] Using Google DNS as fallback for SRV resolution');
  } catch (err) {
    console.warn('[Database] Failed to set DNS fallback servers:', err.message);
  }
};

const connectDB = async () => {
  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
  };

  if (MONGO_URI.startsWith('mongodb+srv://')) {
    console.log('[Database] Connecting to MongoDB Atlas using SRV URI');
    setDnsFallback();
  } else {
    console.log('[Database] Connecting to MongoDB using standard URI');
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, options);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (error) {
    console.error('[Database] Connection Error:', error.name || 'Error', error.message || error);
    if (error.stack) console.error(error.stack);
    throw error;
  }
};

module.exports = connectDB;
