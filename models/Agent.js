const mongoose = require('mongoose');

/**
 * Agent schema representing insurance agents
 * Stores agent information and relationships
 */
const agentSchema = new mongoose.Schema({
  agentName: {
    type: String,
    required: [true, 'Agent name is required'], // Validation with custom error message
    trim: true,                                 // Remove whitespace
    index: true                                 // Create index for faster queries
  },
  producer: {
    type: String,
    trim: true
  },
  agencyId: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual population for users associated with this agent
 * This doesn't persist in database but allows population
 */
agentSchema.virtual('users', {
  ref: 'User',                    // Reference to User model
  localField: '_id',              // Field in Agent model
  foreignField: 'agentId'         // Field in User model
});

/* Create unique index on agentName to prevent duplicates */
agentSchema.index({ agentName: 1 }, { unique: true });

module.exports = mongoose.model('Agent', agentSchema);