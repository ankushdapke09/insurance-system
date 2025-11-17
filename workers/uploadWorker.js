const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Import models
require('../models/Agent');
require('../models/User');
require('../models/Account');
require('../models/PolicyCategory');
require('../models/PolicyCarrier');
require('../models/PolicyInfo');

const Agent = mongoose.model('Agent');
const User = mongoose.model('User');
const Account = mongoose.model('Account');
const PolicyCategory = mongoose.model('PolicyCategory');
const PolicyCarrier = mongoose.model('PolicyCarrier');
const PolicyInfo = mongoose.model('PolicyInfo');

/**
 * Establishes MongoDB connection for worker thread
 * Uses separate connection pool from main thread
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 15,                    // Reduced for worker thread
      minPoolSize: 2,
      socketTimeoutMS: 60000,             // Increased timeout for bulk operations
      serverSelectionTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });
    
    // Set mongoose options without deprecated bufferMaxEntries
    mongoose.set('bufferCommands', false);
    
    console.log('Worker connected to MongoDB');
    return true;
  } catch (error) {
    console.error('Worker MongoDB connection error:', error);
    throw error;
  }
};

/**
 * Parses date strings from various formats to Date objects
 * Handles MM/DD/YYYY format commonly found in CSV files
 */
const parseDate = (dateString) => {
  if (!dateString) return new Date();
  
  if (typeof dateString === 'string') {
    const mmddyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      return new Date(`${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, '0')}-${mmddyyyy[2].padStart(2, '0')}`);
    }
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  
  return new Date();
};

/**
 * Cleans and formats phone numbers
 * Removes non-numeric characters and ensures 10-digit format
 */
const cleanPhone = (phone) => {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, '').slice(-10);
};

/**
 * Cleans and validates record data from CSV/Excel
 * Provides default values for missing required fields
 */
const cleanData = (record, index) => {
    return {
    agent: record.agent?.trim() || 'Unknown Agent',
    userType: record.userType?.trim() || 'Customer',
    policy_mode: record.policy_mode?.trim() || '',
    producer: record.producer?.trim() || '',
    policy_number: record.policy_number?.trim() || `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    premium_amount_written: parseFloat(record.premium_amount_written) || 0,
    premium_amount: parseFloat(record.premium_amount) || 0,
    policy_type: record.policy_type?.trim() || 'General',
    company_name: record.company_name?.trim() || 'Unknown Company',
    category_name: record.category_name?.trim() || 'General',
    policy_start_date: parseDate(record.policy_start_date),
    policy_end_date: parseDate(record.policy_end_date),
    csr: record.csr?.trim() || '',
    account_name: record.account_name?.trim() || `Account_${Date.now()}`,
    email: record.email?.trim().toLowerCase() || `user_${Date.now()}@example.com`,
    gender: record.gender?.trim() || 'Other',
    firstname: record.firstname?.trim() || 'Unknown',
    city: record.city?.trim() || 'Unknown',
    account_type: record.account_type?.trim() || 'General',
    phone: cleanPhone(record.phone),
    address: record.address?.trim() || 'Unknown Address',
    state: record.state?.trim() || 'XX',
    zip: record.zip?.trim() || '00000',
    dob: parseDate(record.dob),
    applicantId: record['Applicant ID']?.trim() || '',
    agency_id: record.agency_id?.trim() || '',
    hasActive: record['hasActive ClientPolicy']?.trim() || 'false'
  };
};

// Rest of the worker implementation...
async function bulkFindOrCreate(model, items, keyField) {
  if (items.length === 0) return new Map();
  
  const values = items.map(item => item[keyField]);
  
  const existingItems = await model.find({
    [keyField]: { $in: values }
  }).lean();
  
  const existingMap = new Map(existingItems.map(item => [item[keyField], item]));
  
  const newItems = items.filter(item => !existingMap.has(item[keyField]));
  
  if (newItems.length > 0) {
    try {
      const result = await model.insertMany(newItems, { 
        ordered: false, // Continue on error
        lean: true 
      });
      
      result.forEach(item => existingMap.set(item[keyField], item));
    } catch (error) {
      console.warn('Bulk insert partial error:', error.writeErrors?.length || 'unknown');
      
      for (const item of newItems) {
        if (!existingMap.has(item[keyField])) {
          try {
            const newItem = new model(item);
            await newItem.save();
            existingMap.set(item[keyField], newItem);
          } catch (individualError) {
            console.error('Failed to create item:', item[keyField], individualError.message);
          }
        }
      }
    }
  }
  
  return existingMap;
}

/**
 * Main file processing function
 * Handles both CSV and Excel files with batch processing
 */
async function processFile() {
  let mongooseConnection;
  const startTime = Date.now();
  
  try {
    const { filePath, fileType } = workerData;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await connectDB();
    mongooseConnection = mongoose.connection;

    let records = [];
    
    console.time('File parsing');
    if (fileType === 'xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (fileType === 'csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => records.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    }
    console.timeEnd('File parsing');

    console.log(`Found ${records.length} records to process`);

    let processed = 0;
    let successful = 0;
    let errors = [];

    // Prepare data
    const cleanRecords = records.map((record, index) => cleanData(record, index));
    
    // Extract unique values
    const uniqueAgents = [...new Set(cleanRecords.map(r => r.agent).filter(Boolean))];
    const uniqueCategories = [...new Set(cleanRecords.map(r => r.category_name).filter(Boolean))];
    const uniqueCarriers = [...new Set(cleanRecords.map(r => r.company_name).filter(Boolean))];

    // Bulk create reference data
    console.time('Reference data setup');
    const agentBulkData = uniqueAgents.map(name => ({ agentName: name }));
    const categoryBulkData = uniqueCategories.map(name => ({ categoryName: name }));
    const carrierBulkData = uniqueCarriers.map(name => ({ companyName: name }));
    
    const [agentsMap, categoriesMap, carriersMap] = await Promise.all([
      bulkFindOrCreate(Agent, agentBulkData, 'agentName'),
      bulkFindOrCreate(PolicyCategory, categoryBulkData, 'categoryName'),
      bulkFindOrCreate(PolicyCarrier, carrierBulkData, 'companyName')
    ]);
    console.timeEnd('Reference data setup');

    // Process records in batches
    const batchSize = 200; // Conservative batch size
    const totalBatches = Math.ceil(cleanRecords.length / batchSize);
    
    console.log(`Processing ${totalBatches} batches of ${batchSize} records each`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, cleanRecords.length);
      const batch = cleanRecords.slice(batchStart, batchEnd);
      
      console.time(`Batch ${batchIndex + 1}`);
      
      const batchPromises = batch.map(async (cleanRecord, recordIndex) => {
        const globalIndex = batchStart + recordIndex;
        
        try {
          const agent = agentsMap.get(cleanRecord.agent);
          const policyCategory = categoriesMap.get(cleanRecord.category_name);
          const policyCarrier = carriersMap.get(cleanRecord.company_name);
          
          if (!agent || !policyCategory || !policyCarrier) {
            throw new Error('Missing reference data');
          }

          // Find or create user
          let user = await User.findOne({
            $or: [
              { email: cleanRecord.email },
              { 
                firstName: cleanRecord.firstname, 
                dob: cleanRecord.dob
              }
            ]
          });
          
          if (!user) {
            user = new User({
              firstName: cleanRecord.firstname,
              dob: cleanRecord.dob,
              address: cleanRecord.address,
              phoneNumber: cleanRecord.phone,
              state: cleanRecord.state,
              zipCode: cleanRecord.zip,
              email: cleanRecord.email,
              gender: cleanRecord.gender,
              userType: cleanRecord.userType,
              agentId: agent._id,
              city: cleanRecord.city
            });
            await user.save();
          }

          // Find or create account
          let account = await Account.findOne({
            accountName: cleanRecord.account_name,
            userId: user._id
          });
          
          if (!account) {
            account = new Account({
              accountName: cleanRecord.account_name,
              userId: user._id,
              accountType: cleanRecord.account_type
            });
            await account.save();
          }

          // Upsert policy
          await PolicyInfo.findOneAndUpdate(
            { policyNumber: cleanRecord.policy_number },
            {
              policyNumber: cleanRecord.policy_number,
              policyStartDate: cleanRecord.policy_start_date,
              policyEndDate: cleanRecord.policy_end_date,
              policyCategoryId: policyCategory._id,
              companyId: policyCarrier._id,
              userId: user._id,
              premiumAmount: cleanRecord.premium_amount,
              policyType: cleanRecord.policy_type || 'General',
              status: 'active'
            },
            { 
              upsert: true, 
              new: true
            }
          );

          successful++;
          processed = globalIndex + 1;

        } catch (error) {
          errors.push({
            recordNumber: globalIndex + 1,
            error: error.message,
            policyNumber: cleanRecord.policy_number
          });
        }
      });

      // Process batch with limited concurrency
      await Promise.allSettled(batchPromises);
      
      console.timeEnd(`Batch ${batchIndex + 1}`);
      
      // Progress update
      parentPort.postMessage({ 
        type: 'progress', 
        processed, 
        successful,
        total: cleanRecords.length,
        errors: errors.length,
        batch: `${batchIndex + 1}/${totalBatches}`
      });

      // Small delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const processingTime = (Date.now() - startTime) / 1000 / 60;
    
    parentPort.postMessage({
      type: 'complete',
      processed,
      successful,
      total: cleanRecords.length,
      errors,
      summary: {
        successRate: ((successful / processed) * 100).toFixed(2) + '%',
        processingTime: `${processingTime.toFixed(2)} minutes`,
        recordsPerMinute: ((successful / processingTime) || 0).toFixed(0)
      }
    });

  } catch (error) {
    console.error('Worker processing error:', error);
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  } finally {
    if (mongooseConnection) {
      await mongooseConnection.close();
    }
    
    try {
      if (fs.existsSync(workerData.filePath)) {
        fs.unlinkSync(workerData.filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
  }
}

// Start processing
processFile().catch(error => {
  parentPort.postMessage({
    type: 'error',
    error: `Unhandled worker error: ${error.message}`
  });
});
