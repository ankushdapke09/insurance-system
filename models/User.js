const mongoose = require('mongoose');

/**
 * User schema representing insurance policy holders
 * Contains personal information and relationships
 */
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    index: true  // Index for search optimization
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  address: {
    type: String,
    required: [true, 'Address is required']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        return /\d{10}/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    uppercase: true
  },
  zipCode: {
    type: String,
    required: [true, 'Zip code is required'],
    validate: {
      validator: function(v) {
        return /^\d{5}(-\d{4})?$/.test(v);
      },
      message: 'Zip code must be valid US format'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: [true, 'Gender is required']
  },
  userType: {
    type: String,
    required: [true, 'User type is required']
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: [true, 'Agent ID is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  applicantId: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual for user's accounts
 */
userSchema.virtual('accounts', {
  ref: 'Account',
  localField: '_id',
  foreignField: 'userId'
});

/**
 * Virtual for user's policies
 */
userSchema.virtual('policies', {
  ref: 'PolicyInfo',
  localField: '_id',
  foreignField: 'userId'
});

/* Compound indexes for optimized query performance */
userSchema.index({ firstName: 1, email: 1 }); // For combined searches
userSchema.index({ firstName: 1, email: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ agentId: 1 });
userSchema.index({ state: 1, city: 1 });

module.exports = mongoose.model('User', userSchema);