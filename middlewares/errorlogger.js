const mainDb = require('../models/mainDb');

async function logError(level, message, stack, additionalInfo) {
  console.error('Error:', level, message, stack, additionalInfo);
  try {
    await mainDb('error_logs').insert({
      level,
      message,
      stack,
      additional_info: additionalInfo,
      created_at: new Date(), // Assuming you have a `created_at` column
    });
    console.log('Error logged successfully');
  } catch (error) {
    console.error('Failed to log error:', error);
  }
}

module.exports = logError;