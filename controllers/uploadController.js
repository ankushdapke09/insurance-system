const uploadService = require('../services/uploadService');
const logger = require('../utils/logger');

/**
 * Handles file upload and initiates background processing
 * Uses worker threads to prevent blocking the main event loop
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }

    logger.info(`Starting file processing: ${req.file.originalname}`);

    // Process file using service
    const result = await uploadService.processUploadedFile(req.file);

    logger.info(`File processing completed in ${result.processingTime}s`);

    res.json({
      success: true,
      message: 'File processed successfully',
      processingTime: result.processingTime,
      summary: result.summary,
      errors: result.errors
    });

  } catch (error) {
    logger.error('Upload controller error:', error);
    
    // Clean up file on controller error
    if (req.file && req.file.path) {
      try {
        await uploadService.cleanupFile(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message
    });
  }
};

module.exports = { uploadFile };