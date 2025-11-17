const policyService = require('./../services/policyService');
const logger = require('../utils/logger');

/**
 * Controller for handling policy aggregation requests
 */
const getAggregatedPoliciesByUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const result = await policyService.getAggregatedPoliciesByUser({
      page: pageNum,
      limit: limitNum
    });

    logger.info(`Aggregated policies fetched for ${result.data.length} users`);

    res.json({
      success: true,
      count: result.data.length,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Policy aggregation controller error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

module.exports = { getAggregatedPoliciesByUser };