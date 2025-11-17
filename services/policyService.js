const PolicyInfo = require('../models/PolicyInfo');
const User = require('../models/User');

/**
 * Service layer for policy data aggregation and business logic
 * Uses MongoDB aggregation pipeline for efficient data processing
 */
class PolicyService {
  /**
   * Get aggregated policy data by user
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @returns {Promise<Object>} Aggregated policy data with pagination info
   */
  async getAggregatedPoliciesByUser({ page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;

    /* MongoDB aggregation pipeline for user policy aggregation */
    const aggregatedPolicies = await PolicyInfo.aggregate([
      {
        $group: {
          _id: '$userId', // Group by user ID
          totalPolicies: { $sum: 1 }, // Count policies per user
          totalPremium: { $sum: '$premiumAmount' }, // Sum premiums
          activePolicies: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0] // Count active policies
            }
          },
          policies: {
            $push: { // Collect policy details
              policyNumber: '$policyNumber',
              startDate: '$policyStartDate',
              endDate: '$policyEndDate',
              premium: '$premiumAmount',
              status: '$status',
              policyId: '$_id'
            }
          }
        }
      },
      {
        $lookup: { // Join with users collection
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo' // Convert array to object
      },
      {
        $project: { // Shape the output
          userId: '$_id',
          userName: '$userInfo.firstName',
          userEmail: '$userInfo.email',
          userPhone: '$userInfo.phoneNumber',
          totalPolicies: 1,
          totalPremium: 1,
          activePolicies: 1,
          policies: { $slice: ['$policies', 5] } // Limit to 5 recent policies
        }
      },
      { $skip: skip }, // Pagination skip
      { $limit: limit } // Pagination limit
    ]);

    // Get total user count for pagination
    const totalUsers = await User.countDocuments();

    return {
      data: aggregatedPolicies,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    };
  }
}

module.exports = new PolicyService();