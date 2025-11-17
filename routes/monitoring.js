const express = require('express');
const CPUMonitor = require('../services/cpuMonitor');
const logger = require('../utils/logger');

const router = express.Router();

// Singleton CPU monitor instance
const cpuMonitor = new CPUMonitor({
  threshold: process.env.CPU_THRESHOLD || 70,
  checkInterval: 5000,
  cooldownPeriod: 60000,
  maxRestarts: 3,
  enabled: process.env.NODE_ENV === 'production'
});

/**
 * CPU Monitoring API Routes
 * Provides real-time monitoring and control endpoints
 */

// Start CPU monitoring
router.post('/monitoring/cpu/start', (req, res) => {
  try {
    cpuMonitor.startMonitoring();
    res.json({
      success: true,
      message: 'CPU monitoring started',
      status: cpuMonitor.getStatus()
    });
  } catch (error) {
    logger.error('Error starting CPU monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop CPU monitoring
router.post('/monitoring/cpu/stop', (req, res) => {
  try {
    cpuMonitor.stopMonitoring();
    res.json({
      success: true,
      message: 'CPU monitoring stopped',
      status: cpuMonitor.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping CPU monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get CPU monitoring status
router.get('/monitoring/cpu/status', (req, res) => {
  try {
    const status = cpuMonitor.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting CPU monitoring status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update CPU monitoring configuration
router.put('/monitoring/cpu/config', (req, res) => {
  try {
    const { threshold, checkInterval, cooldownPeriod, maxRestarts, enabled } = req.body;
    
    const newConfig = {};
    if (threshold !== undefined) newConfig.threshold = threshold;
    if (checkInterval !== undefined) newConfig.checkInterval = checkInterval;
    if (cooldownPeriod !== undefined) newConfig.cooldownPeriod = cooldownPeriod;
    if (maxRestarts !== undefined) newConfig.maxRestarts = maxRestarts;
    if (enabled !== undefined) newConfig.enabled = enabled;

    cpuMonitor.updateConfig(newConfig);

    res.json({
      success: true,
      message: 'CPU monitoring configuration updated',
      config: cpuMonitor.options
    });
  } catch (error) {
    logger.error('Error updating CPU monitoring config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get real-time CPU usage (single measurement)
router.get('/monitoring/cpu/current', async (req, res) => {
  try {
    const usage = await cpuMonitor.getCPUUsage();
    res.json({
      success: true,
      cpuUsage: usage,
      timestamp: new Date().toISOString(),
      cores: os.cpus().length
    });
  } catch (error) {
    logger.error('Error getting current CPU usage:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get system information
router.get('/monitoring/system', (req, res) => {
  try {
    const systemInfo = {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    };

    res.json({
      success: true,
      systemInfo
    });
  } catch (error) {
    logger.error('Error getting system info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual server restart endpoint
router.post('/monitoring/restart', (req, res) => {
  try {
    logger.warn('Manual server restart initiated via API');
    
    // Send immediate response
    res.json({
      success: true,
      message: 'Server restart initiated',
      timestamp: new Date().toISOString()
    });

    // Restart after short delay
    setTimeout(() => {
      process.exit(1);
    }, 1000);

  } catch (error) {
    logger.error('Error during manual restart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;