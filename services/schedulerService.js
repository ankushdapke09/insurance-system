const cron = require('node-cron');
const ScheduledMessage = require('../models/ScheduledMessage');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.startScheduler();
  }

  startScheduler() {
    // Check every minute for pending messages
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const messages = await ScheduledMessage.find({
          scheduledDate: { $lte: now },
          status: 'pending',
          retryCount: { $lt: 3 }
        });

        logger.info(`Found ${messages.length} scheduled messages to process`);

        for (const message of messages) {
          await this.processMessage(message);
        }
      } catch (error) {
        logger.error('Scheduler error:', error);
      }
    });

    logger.info('Scheduler service started');
  }

  async scheduleMessage(message, day, time, createdBy = 'system') {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time format. Use HH:MM');
      }

      if (day < 0 || day > 6) {
        throw new Error('Day must be between 0 (Sunday) and 6 (Saturday)');
      }

      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);
      
      // Calculate days to add
      let daysToAdd = (day - scheduledDate.getDay() + 7) % 7;
      if (daysToAdd === 0 && scheduledDate <= new Date()) {
        daysToAdd = 7; // Schedule for next week
      }
      
      scheduledDate.setDate(scheduledDate.getDate() + daysToAdd);

      const scheduledMessage = new ScheduledMessage({
        message,
        scheduledDate,
        createdBy
      });

      await scheduledMessage.save();
      
      logger.info(`Message scheduled for ${scheduledDate} by ${createdBy}`);
      
      return scheduledMessage;
    } catch (error) {
      logger.error('Error scheduling message:', error);
      throw error;
    }
  }

  async processMessage(scheduledMessage) {
    try {
      logger.info(`Processing scheduled message: ${scheduledMessage.message}`);
      
      // Simulate message processing (replace with actual logic)
      const success = await this.sendMessage(scheduledMessage.message);
      
      if (success) {
        scheduledMessage.status = 'sent';
        await scheduledMessage.save();
        logger.info(`Message sent successfully: ${scheduledMessage._id}`);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      logger.error(`Failed to process message ${scheduledMessage._id}:`, error);
      
      scheduledMessage.retryCount += 1;
      
      if (scheduledMessage.retryCount >= scheduledMessage.maxRetries) {
        scheduledMessage.status = 'failed';
      }
      
      await scheduledMessage.save();
    }
  }

  async sendMessage(message) {
    // Replace with actual message sending logic
    // This could be email, SMS, push notification, etc.
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`SENDING MESSAGE: ${message}`);
        resolve(true); // Simulate success
      }, 1000);
    });
  }

  async getPendingMessages() {
    return await ScheduledMessage.find({
      status: 'pending',
      scheduledDate: { $gte: new Date() }
    }).sort({ scheduledDate: 1 });
  }

  async cancelMessage(messageId) {
    const message = await ScheduledMessage.findById(messageId);
    if (message && message.status === 'pending') {
      message.status = 'cancelled';
      await message.save();
      logger.info(`Message cancelled: ${messageId}`);
      return true;
    }
    return false;
  }
}

module.exports = SchedulerService;