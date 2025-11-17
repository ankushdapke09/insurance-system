const mongoose = require('mongoose');

/**
 * Account schema representing user accounts
 * Links users to their account information
 */
const accountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to User model
    required: [true, 'User ID is required']
  },
  accountType: {
    type: String,
    required: [true, 'Account type is required']
  },
  // Customer Service Representative
  csr: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

/**
 * Compound index to ensure unique account names per user
 * Prevents duplicate accounts for same user
 */
accountSchema.index({ accountName: 1, userId: 1 }, { unique: true });
accountSchema.index({ userId: 1 });

module.exports = mongoose.model('Account', accountSchema);