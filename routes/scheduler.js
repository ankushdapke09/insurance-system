const express = require('express');
const { 
  scheduleMessage, 
  getPendingMessages, 
  cancelMessage 
} = require('../controllers/schedulerController');

const router = express.Router();

router.post('/schedule-message', scheduleMessage);
router.get('/schedule-messages', getPendingMessages);
router.delete('/schedule-message/:id', cancelMessage);

module.exports = router;