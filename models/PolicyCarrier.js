const mongoose = require('mongoose');

/**
 * Policy Carrier schema representing insurance companies
 * Stores carrier/company information
 */
const policyCarrierSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

/* Index for fast company lookups */
policyCarrierSchema.index({ companyName: 1 });

module.exports = mongoose.model('PolicyCarrier', policyCarrierSchema);