const PolicyInfo = require('../models/PolicyInfo');
const User = require('../models/User');

/**
 * Service layer for policy search business logic
 * Handles user search, policy retrieval, and data aggregation
 */
class PolicySearchService {
  /**
   * Search policies by username with pagination
   * @param {string} username - Username to search for
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Search results with pagination info
   */
  async searchPolicyByUsername(username, page = 1, limit = 10) {
    if (!username || username.trim() === '') {
      throw new Error('Username is required');
    }

    // Validate pagination parameters
    if (page < 1) throw new Error('Page must be greater than 0');
    if (limit < 1) throw new Error('Limit must be greater than 0');
    if (limit > 100) throw new Error('Limit cannot exceed 100');

    const skip = (page - 1) * limit;

    /* Search users by first name (case-insensitive partial match) */
    const users = await this.findUsersByName(username);

    // Handle no users found
    if (users.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      };
    }

    // Extract user IDs for policy query
    const userIds = users.map(user => user._id);

    /* Get policies for found users with pagination and population */
    const policies = await this.findPoliciesByUserIds(userIds, skip, limit);

    // Get total count for pagination
    const total = await this.countPoliciesByUserIds(userIds);

    return {
      data: policies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find users by name (case-insensitive partial match)
   * @param {string} username - Username to search for
   * @returns {Promise<Array>} Array of user objects
   */
  async findUsersByName(username) {
    return await User.find({ 
      firstName: { $regex: username, $options: 'i' } 
    }).select('_id firstName email');
  }

  /**
   * Find policies by user IDs with pagination and population
   * @param {Array} userIds - Array of user IDs
   * @param {number} skip - Number of documents to skip
   * @param {number} limit - Number of documents to return
   * @returns {Promise<Array>} Array of policy documents
   */
  async findPoliciesByUserIds(userIds, skip, limit) {
    return await PolicyInfo.find({ userId: { $in: userIds } })
      .populate('userId', 'firstName email phoneNumber')
      .populate('policyCategoryId', 'categoryName')
      .populate('companyId', 'companyName')
      .sort({ policyStartDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /**
   * Count total policies for given user IDs
   * @param {Array} userIds - Array of user IDs
   * @returns {Promise<number>} Total count of policies
   */
  async countPoliciesByUserIds(userIds) {
    return await PolicyInfo.countDocuments({ userId: { $in: userIds } });
  }

  /**
   * Search policies with advanced filtering options
   * @param {Object} filters - Search filters
   * @param {string} filters.username - Username to search
   * @param {string} filters.status - Policy status filter
   * @param {string} filters.category - Policy category filter
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Filtered search results
   */
  async searchPoliciesAdvanced(filters, page = 1, limit = 10) {
    const { username, status, category } = filters;
    
    if (!username) {
      throw new Error('Username is required for search');
    }

    const skip = (page - 1) * limit;
    const users = await this.findUsersByName(username);
    
    if (users.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, pages: 0 }
      };
    }

    const userIds = users.map(user => user._id);
    
    // Build query with optional filters
    const query = { userId: { $in: userIds } };
    if (status) query.status = status;
    if (category) query.policyCategory = category;

    const policies = await PolicyInfo.find(query)
      .populate('userId', 'firstName email phoneNumber')
      .populate('policyCategoryId', 'categoryName')
      .populate('companyId', 'companyName')
      .sort({ policyStartDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await PolicyInfo.countDocuments(query);

    return {
      data: policies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new PolicySearchService();