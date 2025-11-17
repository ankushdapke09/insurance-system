const mongoose = require('mongoose');

/**
 * Policy Info schema representing insurance policies
 * Main entity linking users, categories, and carriers
 */
const policyInfoSchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: [true, 'Policy number is required'],
    unique: true,
    index: true
  },
  policyStartDate: {
    type: Date,
    required: [true, 'Policy start date is required']
  },
  policyEndDate: {
    type: Date,
    required: [true, 'Policy end date is required'],
    validate: {
      validator: function(v) {
        return v > this.policyStartDate;
      },
      message: 'End date must be after start date'
    }
  },
  policyCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyCategory',
    required: [true, 'Policy category ID is required']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyCarrier',
    required: [true, 'Company ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  premiumAmountWritten: {
    type: Number,
    default: 0,
    min: 0
  },
  premiumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  policyType: {
    type: String,
    required: [true, 'Policy type is required']
  },
  policyMode: {
    type: String
  },
  hasActiveClientPolicy: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

policyInfoSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

policyInfoSchema.virtual('category', {
  ref: 'PolicyCategory',
  localField: 'policyCategoryId',
  foreignField: '_id',
  justOne: true
});

policyInfoSchema.virtual('carrier', {
  ref: 'PolicyCarrier',
  localField: 'companyId',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
policyInfoSchema.index({ userId: 1 });
policyInfoSchema.index({ policyCategoryId: 1 });
policyInfoSchema.index({ companyId: 1 });
policyInfoSchema.index({ policyStartDate: 1 });
policyInfoSchema.index({ policyEndDate: 1 });
policyInfoSchema.index({ status: 1 });
policyInfoSchema.index({ userId: 1, status: 1 });

/**
 * Middleware to automatically update policy status based on dates
 * Runs before saving documents
 */
policyInfoSchema.pre('save', function(next) {
  const now = new Date();
  if (this.policyEndDate < now) {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('PolicyInfo', policyInfoSchema);