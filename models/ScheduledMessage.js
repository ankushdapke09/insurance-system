const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending'
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true
});

scheduledMessageSchema.index({ scheduledDate: 1 });
scheduledMessageSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);