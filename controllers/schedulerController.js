const SchedulerService = require('../services/schedulerService');

const schedulerService = new SchedulerService();

const scheduleMessage = async (req, res) => {
  try {
    const { message, day, time, createdBy } = req.body;

    if (!message || day === undefined || !time) {
      return res.status(400).json({ 
        error: 'Message, day, and time are required' 
      });
    }

    const dayNumber = parseInt(day);
    if (dayNumber < 0 || dayNumber > 6) {
      return res.status(400).json({ 
        error: 'Day must be between 0 (Sunday) and 6 (Saturday)' 
      });
    }

    const scheduledMessage = await schedulerService.scheduleMessage(
      message, 
      dayNumber, 
      time,
      createdBy || 'api-user'
    );

    res.json({
      success: true,
      message: 'Message scheduled successfully',
      data: {
        id: scheduledMessage._id,
        scheduledDate: scheduledMessage.scheduledDate,
        status: scheduledMessage.status
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPendingMessages = async (req, res) => {
  try {
    const messages = await schedulerService.getPendingMessages();
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cancelMessage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cancelled = await schedulerService.cancelMessage(id);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Message cancelled successfully'
      });
    } else {
      res.status(404).json({
        error: 'Message not found or cannot be cancelled'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { scheduleMessage, getPendingMessages, cancelMessage };