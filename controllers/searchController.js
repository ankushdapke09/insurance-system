const policySearchService = require('../services/searchService');
const logger = require('../utils/logger');

/**
 * Search policies by username with pagination
 * Supports partial name matching and returns populated policy data
 */
const searchPolicyByUsername = async (req, res) => {
  try {
    const { username, page = 1, limit = 10 } = req.query;

    if (!username) {
      return res.status(400).json({ 
        success: false,
        error: 'Username is required' 
      });
    }

    // Parse and validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const result = await policySearchService.searchPolicyByUsername(
      username, 
      pageNum, 
      limitNum
    );

    logger.info(`Search completed for username: ${username}, found ${result.data.length} policies`);

    // Return successful response with pagination metadata
    res.json({
      success: true,
      count: result.data.length,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Search controller error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

module.exports = { searchPolicyByUsername };