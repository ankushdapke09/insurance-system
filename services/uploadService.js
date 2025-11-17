const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Service layer for file upload processing
 * Handles background processing via worker threads
 */
class UploadService {
  /**
   * Process uploaded file using worker thread
   * @param {Object} file - Multer file object
   * @returns {Promise<Object>} Processing results
   */
  async processUploadedFile(file) {
    const filePath = file.path;
    const fileType = this.validateFileType(file.originalname);

    if (!fileType) {
      this.cleanupFileSync(filePath);
      throw new Error('Only XLSX and CSV files are supported');
    }

    const workerPath = path.resolve(__dirname, '../workers/uploadWorker.js');

    return new Promise((resolve, reject) => {
      let responseSent = false;
      const startTime = Date.now();

      /* Create worker thread for background processing */
      const worker = new Worker(workerPath, {
        workerData: { filePath, fileType }
      });

      /* Worker message handlers */
      worker.on('message', (message) => {
        switch (message.type) {
          case 'progress':
            logger.info(`Progress: ${message.processed}/${message.total}`);
            break;

          case 'complete':
            if (!responseSent) {
              responseSent = true;
              const processingTime = `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`;

              resolve({
                processingTime,
                summary: {
                  totalRecords: message.total,
                  successfullyProcessed: message.successful,
                  failedRecords: message.errors.length,
                  successRate: message.summary?.successRate || '0%'
                },
                errors: message.errors.slice(0, 10) // Limit errors in response
              });
            }
            break;

          case 'error':
            if (!responseSent) {
              responseSent = true;
              logger.error('Worker error:', message.error);
              this.cleanupFileSync(filePath);
              reject(new Error(`Processing failed: ${message.error}`));
            }
            break;
        }
      });

      /* Worker error handlers */
      worker.on('error', (error) => {
        logger.error('Worker thread error:', error);
        if (!responseSent) {
          responseSent = true;
          this.cleanupFileSync(filePath);
          reject(new Error(`Worker thread error: ${error.message}`));
        }
      });

      worker.on('exit', (code) => {
        logger.info(`Worker exited with code: ${code}`);
        if (!responseSent && code !== 0) {
          responseSent = true;
          this.cleanupFileSync(filePath);
          reject(new Error(`Worker exited with code: ${code}`));
        }
      });

      // Set timeout for worker processing
      this.setWorkerTimeout(worker, filePath, reject);
    });
  }

  /**
   * Validate file type based on extension
   * @param {string} originalname - Original file name
   * @returns {string|null} File type or null if invalid
   */
  validateFileType(originalname) {
    const fileExtension = path.extname(originalname).toLowerCase();
    
    if (fileExtension === '.xlsx') return 'xlsx';
    if (fileExtension === '.csv') return 'csv';
    
    return null;
  }

  /**
   * Set timeout for worker processing
   * @param {Worker} worker - Worker instance
   * @param {string} filePath - Path to uploaded file
   * @param {Function} reject - Promise reject function
   */
  setWorkerTimeout(worker, filePath, reject) {
    const timeout = setTimeout(() => {
      logger.error('Worker processing timeout');
      worker.terminate();
      this.cleanupFileSync(filePath);
      reject(new Error('File processing timeout - operation took too long'));
    }, 300000); // 5 minutes timeout

    // Clear timeout when worker completes
    worker.on('exit', () => clearTimeout(timeout));
    worker.on('message', (message) => {
      if (message.type === 'complete' || message.type === 'error') {
        clearTimeout(timeout);
      }
    });
  }

  /**
   * Synchronously cleanup file
   * @param {string} filePath - Path to file to delete
   */
  cleanupFileSync(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up file: ${filePath}`);
      }
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }
  }

  /**
   * Asynchronously cleanup file
   * @param {string} filePath - Path to file to delete
   * @returns {Promise<void>}
   */
  async cleanupFile(filePath) {
    return new Promise((resolve) => {
      fs.unlink(filePath, (error) => {
        if (error) {
          logger.error('Error cleaning up file:', error);
        } else {
          logger.info(`Cleaned up file: ${filePath}`);
        }
        resolve();
      });
    });
  }

  /**
   * Get supported file types
   * @returns {Object} Supported file types information
   */
  getSupportedFileTypes() {
    return {
      xlsx: {
        description: 'Excel Spreadsheet',
        maxSize: '10MB',
        extensions: ['.xlsx']
      },
      csv: {
        description: 'Comma Separated Values',
        maxSize: '10MB',
        extensions: ['.csv']
      }
    };
  }

  /**
   * Validate file size
   * @param {Object} file - Multer file object
   * @param {number} maxSize - Maximum size in bytes
   * @returns {boolean} True if file size is valid
   */
  validateFileSize(file, maxSize = 10 * 1024 * 1024) { // 10MB default
    return file.size <= maxSize;
  }
}

module.exports = new UploadService();