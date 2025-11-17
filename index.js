require('dotenv').config();
require('./models/Agent');
require('./models/User');
require('./models/Account');
require('./models/PolicyCategory');
require('./models/PolicyCarrier');
require('./models/PolicyInfo');
require('./models/ScheduledMessage');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cluster = require('cluster');
const os = require('os');
const connectDB = require('./config/database');
const CPUMonitor = require('./services/cpuMonitor');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Connect to MongoDB
connectDB();

/* Security Middleware */
app.use(helmet()); // Security headers
app.use(cors());   // Cross-Origin Resource Sharing
app.use(compression()); // Response compression

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * CPU Monitoring Initialization
 */
const cpuMonitor = new CPUMonitor({
  threshold: process.env.CPU_THRESHOLD || 70,
  checkInterval: 5000,
  cooldownPeriod: 60000,
  maxRestarts: 3,
  enabled: process.env.NODE_ENV === 'production'
});

// Enhanced Health Check with CPU info
app.get('/health', async (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV
    },
    system: {
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    },
    cluster: cluster.isPrimary ? 'primary' : 'worker',
    workerId: cluster.worker?.id || 'standalone',
    cpuMonitoring: {
      enabled: cpuMonitor.options.enabled,
      isMonitoring: cpuMonitor.isMonitoring,
      currentUsage: cpuMonitor.metrics.currentUsage,
      threshold: cpuMonitor.options.threshold
    }
  };
  
  res.json(healthInfo);
});

// API Routes
app.use('/api/v1', require('./routes/upload'));
app.use('/api/v1', require('./routes/search'));
app.use('/api/v1', require('./routes/policies'));
app.use('/api/v1', require('./routes/scheduler'));
app.use('/api/v1', require('./routes/monitoring')); // CPU monitoring routes

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    worker: cluster.worker?.id || 'standalone'
  });
});

// Server configuration
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server ${cluster.worker?.id || 'standalone'} (PID: ${process.pid}) listening on port ${PORT}`);
  
  // Start CPU monitoring after server is running
  if (process.env.NODE_ENV === 'production') {
    // Small delay to ensure server is fully started
    setTimeout(() => {
      cpuMonitor.startMonitoring();
    }, 5000);
  }
});

/**
 * Graceful Shutdown Handling with CPU Monitoring
 */
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop CPU monitoring first
  cpuMonitor.stopMonitoring();
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections if any
    if (cluster.isWorker) {
      process.exit(0);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  cpuMonitor.stopMonitoring();
  process.exit(1);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cpuMonitor.stopMonitoring();
  process.exit(1);
});

module.exports = app;