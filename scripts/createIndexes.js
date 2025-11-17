require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for index creation');

    // Get all models
    const Agent = require('../models/Agent');
    const User = require('../models/User');
    const Account = require('../models/Account');
    const PolicyCategory = require('../models/PolicyCategory');
    const PolicyCarrier = require('../models/PolicyCarrier');
    const PolicyInfo = require('../models/PolicyInfo');

    // Create indexes
    await Agent.createIndexes();
    await User.createIndexes();
    await Account.createIndexes();
    await PolicyCategory.createIndexes();
    await PolicyCarrier.createIndexes();
    await PolicyInfo.createIndexes();

    logger.info('All indexes created successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();