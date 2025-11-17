const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connects to MongoDB database with local-ready configuration
 * Updated for MongoDB driver v4+ compatibility
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,                    // Maximum number of sockets in connection pool
      minPoolSize: 5,                     // Minimum number of sockets
      socketTimeoutMS: 45000,             // How long a socket can stay idle
      serverSelectionTimeoutMS: 30000,    // Keep trying to send operations for 30 seconds
      heartbeatFrequencyMS: 10000,        // How often to check connection status
      retryWrites: true,                  // Retry write operations on network errors
      retryReads: true,                   // Retry read operations on network errors
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Configure mongoose for better performance (without deprecated options)
    mongoose.set('bufferCommands', false); // Disable command buffering
    mongoose.set('strictQuery', true);     // Strict query mode

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;