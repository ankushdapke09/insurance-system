const os = require('os');
const { exec } = require('child_process');
const cluster = require('cluster');
const logger = require('../utils/logger');

/**
 * ADVANCED CPU MONITORING SERVICE
 * Tracks real-time CPU utilization with multiple monitoring strategies
 * Automatic restart on high usage with intelligent cooldown periods
 */
class CPUMonitor {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 70,           // CPU usage threshold percentage
      checkInterval: options.checkInterval || 5000, // Check every 5 seconds
      cooldownPeriod: options.cooldownPeriod || 60000, // 1 minute cooldown after restart
      maxRestarts: options.maxRestarts || 3,        // Maximum restarts per hour
      enabled: options.enabled !== false,           // Enable/disable monitoring
      ...options
    };

    this.isMonitoring = false;
    this.checkInterval = null;
    this.restartCount = 0;
    this.lastRestartTime = 0;
    this.cpuHistory = [];
    this.maxHistorySize = 60; // Keep 5 minutes of history (5s intervals)

    // Performance metrics
    this.metrics = {
      currentUsage: 0,
      averageUsage: 0,
      peakUsage: 0,
      startTime: Date.now(),
      checksPerformed: 0
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring with safety checks
   */
  initializeMonitoring() {
    if (!this.options.enabled) {
      logger.info('CPU monitoring is disabled');
      return;
    }

    if (cluster.isWorker) {
      logger.info(`CPU monitoring initialized for worker ${process.pid}`);
    } else {
      logger.info('CPU monitoring initialized for primary process');
    }

    logger.info(`CPU monitoring configuration:`, {
      threshold: `${this.options.threshold}%`,
      checkInterval: `${this.options.checkInterval}ms`,
      cooldownPeriod: `${this.options.cooldownPeriod}ms`,
      maxRestarts: this.options.maxRestarts
    });
  }

  /**
   * Start the CPU monitoring service
   */
  startMonitoring() {
    if (!this.options.enabled) {
      logger.warn('CPU monitoring is disabled, not starting');
      return;
    }

    if (this.isMonitoring) {
      logger.warn('CPU monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info(`Starting CPU monitoring with ${this.options.threshold}% threshold`);

    // Initial CPU baseline
    this.calculateCPUBaseline().then(() => {
      this.performCheck();
    });

    logger.info('CPU monitoring started successfully');
  }

  /**
   * Stop the CPU monitoring service
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('CPU monitoring stopped');
  }

  /**
   * Calculate initial CPU baseline
   */
  async calculateCPUBaseline() {
    try {
      // Take 3 samples over 3 seconds to establish baseline
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const usage = await this.getCPUUsage();
        samples.push(usage);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const baseline = samples.reduce((a, b) => a + b, 0) / samples.length;
      logger.info(`CPU baseline established: ${baseline.toFixed(2)}%`);
      
      return baseline;
    } catch (error) {
      logger.error('Error calculating CPU baseline:', error);
      return 0;
    }
  }

  /**
   * Perform CPU check with advanced analytics
   */
  async performCheck() {
    if (!this.isMonitoring) return;

    try {
      this.metrics.checksPerformed++;
      
      const usage = await this.getCPUUsage();
      this.updateMetrics(usage);

      // Log detailed metrics every 10 checks (50 seconds)
      if (this.metrics.checksPerformed % 10 === 0) {
        this.logDetailedMetrics();
      }

      // Check if threshold is exceeded
      if (usage > this.options.threshold) {
        await this.handleHighCPUUsage(usage);
      } else {
        // Reset restart count if usage is normal for extended period
        if (usage < this.options.threshold * 0.5) { // Below 50% of threshold
          const timeSinceLastRestart = Date.now() - this.lastRestartTime;
          if (timeSinceLastRestart > 3600000) { // 1 hour
            this.restartCount = 0;
          }
        }
      }

    } catch (error) {
      logger.error('CPU check error:', error);
    } finally {
      // Schedule next check
      if (this.isMonitoring) {
        this.checkInterval = setTimeout(() => this.performCheck(), this.options.checkInterval);
      }
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(currentUsage) {
    this.metrics.currentUsage = currentUsage;
    
    // Update history
    this.cpuHistory.push({
      timestamp: Date.now(),
      usage: currentUsage
    });

    // Maintain history size
    if (this.cpuHistory.length > this.maxHistorySize) {
      this.cpuHistory.shift();
    }

    // Calculate average
    const recentHistory = this.cpuHistory.slice(-12); // Last minute
    this.metrics.averageUsage = recentHistory.reduce((sum, point) => sum + point.usage, 0) / recentHistory.length;

    // Update peak
    if (currentUsage > this.metrics.peakUsage) {
      this.metrics.peakUsage = currentUsage;
    }
  }

  /**
   * Handle high CPU usage scenario
   */
  async handleHighCPUUsage(usage) {
    const now = Date.now();
    const timeSinceLastRestart = now - this.lastRestartTime;

    // Check cooldown period
    if (timeSinceLastRestart < this.options.cooldownPeriod) {
      logger.warn(`High CPU usage (${usage.toFixed(2)}%) detected but in cooldown period`);
      return;
    }

    // Check restart limit
    if (this.restartCount >= this.options.maxRestarts) {
      logger.error(`High CPU usage (${usage.toFixed(2)}%) but restart limit reached (${this.restartCount}/${this.options.maxRestarts})`);
      return;
    }

    logger.warn(`High CPU usage detected: ${usage.toFixed(2)}% (threshold: ${this.options.threshold}%)`);

    // Check if this is a sustained high usage (3 consecutive high readings)
    const recentHighReadings = this.cpuHistory
      .slice(-3)
      .filter(point => point.usage > this.options.threshold)
      .length;

    if (recentHighReadings >= 2) { // At least 2 of last 3 readings are high
      await this.restartServer(usage);
    } else {
      logger.warn(`High CPU usage may be temporary, monitoring...`);
    }
  }

  /**
   * Get accurate CPU usage percentage
   */
  getCPUUsage() {
    return new Promise((resolve) => {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      // Calculate initial CPU times
      cpus.forEach(cpu => {
        for (let type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      const startIdle = totalIdle;
      const startTotal = totalTick;

      // Measure over 1 second interval
      setTimeout(() => {
        const endIdle = os.cpus().reduce((acc, cpu) => acc + cpu.times.idle, 0);
        const endTotal = os.cpus().reduce((acc, cpu) => {
          return acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
        }, 0);

        const idle = endIdle - startIdle;
        const total = endTotal - startTotal;
        const usage = 100 - (100 * idle / total);

        resolve(Math.min(100, Math.max(0, usage))); // Clamp between 0-100
      }, 1000);
    });
  }

  /**
   * Restart server with safety checks
   */
  async restartServer(currentUsage) {
    this.restartCount++;
    this.lastRestartTime = Date.now();

    logger.error(`Initiating server restart due to high CPU usage: ${currentUsage.toFixed(2)}%`);
    logger.error(`Restart count: ${this.restartCount}/${this.options.maxRestarts}`);

    // Log final metrics before restart
    this.logDetailedMetrics();

    try {
      if (cluster.isWorker) {
        // Worker process - exit gracefully
        logger.info(`Worker ${process.pid} exiting due to high CPU usage`);
        process.exit(1);
      } else {
        // Primary process or standalone
        if (process.env.NODE_ENV === 'production') {
          await this.restartWithPM2();
        } else {
          await this.restartWithNPM();
        }
      }
    } catch (error) {
      logger.error('Error during server restart:', error);
      // Force exit if restart fails
      process.exit(1);
    }
  }

  /**
   * Restart using PM2 (local)
   */
  async restartWithPM2() {
    return new Promise((resolve, reject) => {
      logger.info('Restarting with PM2...');
      
      exec('pm2 restart all', (error, stdout, stderr) => {
        if (error) {
          logger.error('PM2 restart failed:', error);
          reject(error);
        } else {
          logger.info('PM2 restart initiated successfully');
          logger.info('PM2 output:', stdout);
          resolve();
        }
      });
    });
  }

  /**
   * Restart using NPM (development)
   */
  async restartWithNPM() {
    return new Promise((resolve, reject) => {
      logger.info('Restarting with NPM...');
      
      // In development, we exit and let nodemon restart
      setTimeout(() => {
        process.exit(1);
      }, 1000);
      
      resolve();
    });
  }

  /**
   * Log detailed performance metrics
   */
  logDetailedMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);

    logger.info('CPU Monitoring Metrics:', {
      currentUsage: `${this.metrics.currentUsage.toFixed(2)}%`,
      averageUsage: `${this.metrics.averageUsage.toFixed(2)}%`,
      peakUsage: `${this.metrics.peakUsage.toFixed(2)}%`,
      checksPerformed: this.metrics.checksPerformed,
      restartCount: this.restartCount,
      uptime: `${hours}h ${minutes}m`,
      historySize: this.cpuHistory.length
    });
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      metrics: this.metrics,
      options: this.options,
      restartCount: this.restartCount,
      lastRestartTime: this.lastRestartTime,
      cpuHistory: this.cpuHistory.slice(-10) // Last 10 readings
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions };
    logger.info('CPU monitoring configuration updated:', this.options);
    
    // Restart monitoring if configuration changed
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

module.exports = CPUMonitor;