const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

/**
 * Cluster Manager for Node.js Application
 * Creates multiple worker processes to utilize all CPU cores
 * Provides load balancing and fault tolerance
 */
class ClusterManager {
  constructor() {
    this.workers = new Map();
    this.cpuCount = os.cpus().length;
    this.workerRestartDelay = 1000; // 1 second delay between worker restarts
  }

  /**
   * Starts the cluster manager
   * Creates worker processes for each CPU core
   */
  start() {
    if (cluster.isPrimary) {
      this.startPrimaryProcess();
    } else {
      this.startWorkerProcess();
    }
  }

  /**
   * Primary process management
   * Handles worker creation, monitoring, and load distribution
   */
  startPrimaryProcess() {
    logger.info(`Primary process started (PID: ${process.pid})`);
    logger.info(`Server environment: ${process.env.NODE_ENV}`);
    logger.info(`Launching ${this.cpuCount} worker processes...`);

    // Create worker processes
    for (let i = 0; i < this.cpuCount; i++) {
      this.createWorker();
    }

    // Handle worker process events
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died with code: ${code}, signal: ${signal}`);
      this.workers.delete(worker.id);
      
      // Restart worker after delay (avoid rapid restart loops)
      setTimeout(() => {
        logger.info('Restarting dead worker...');
        this.createWorker();
      }, this.workerRestartDelay);
    });

    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online and ready`);
    });

    cluster.on('listening', (worker, address) => {
      logger.info(`Worker ${worker.process.pid} is listening on port ${address.port}`);
    });

    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }

  /**
   * Creates a new worker process
   */
  createWorker() {
    const worker = cluster.fork();
    this.workers.set(worker.id, worker);
    
    worker.on('message', (message) => {
      // Handle inter-process communication
      if (message.type === 'health') {
        logger.debug(`Worker ${worker.process.pid} health: ${message.status}`);
      }
    });

    return worker;
  }

  /**
   * Worker process initialization
   * Each worker runs its own instance of the Express app
   */
  startWorkerProcess() {
    logger.info(`Worker process started (PID: ${process.pid})`);
    
    // Import and start the main application
    require('./index');
    
    // Send health status to primary process
    setInterval(() => {
      process.send?.({ 
        type: 'health', 
        status: 'healthy',
        pid: process.pid,
        memory: process.memoryUsage()
      });
    }, 30000); // Report health every 30 seconds
  }

  /**
   * Sets up graceful shutdown for the entire cluster
   */
  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Close all workers gracefully
      const workerShutdowns = Array.from(this.workers.values()).map(worker => {
        return new Promise((resolve) => {
          worker.on('disconnect', resolve);
          worker.disconnect();
          
          // Force kill if worker doesn't disconnect in time
          setTimeout(() => {
            worker.kill();
            resolve();
          }, 5000);
        });
      });

      Promise.all(workerShutdowns).then(() => {
        logger.info('All workers shut down gracefully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Gets cluster status and statistics
   */
  getClusterStatus() {
    return {
      primaryPid: process.pid,
      totalWorkers: this.workers.size,
      cpuCount: this.cpuCount,
      workers: Array.from(this.workers.values()).map(worker => ({
        id: worker.id,
        pid: worker.process.pid,
        connected: worker.isConnected()
      }))
    };
  }
}

// Start the cluster manager
if (require.main === module) {
  const clusterManager = new ClusterManager();
  clusterManager.start();
}

module.exports = ClusterManager;