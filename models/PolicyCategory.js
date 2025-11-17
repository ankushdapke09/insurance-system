const mongoose = require('mongoose');

/**
 * Policy Category schema (Line of Business)
 * Represents different types of insurance policies
 */
const policyCategorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

/* Index for fast category lookups */
policyCategorySchema.index({ categoryName: 1 });

module.exports = mongoose.model('PolicyCategory', policyCategorySchema);