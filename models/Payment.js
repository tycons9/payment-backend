const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    index: true
  },
  message_id: {
    type: String,
    required: true,
    unique: true
  },
  bank: {
    type: String,
    required: true,
    enum: ['Telebirr', 'CBE', 'Dashen', 'Awash', 'Unknown', 'Hibret', 'Abyssinia']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  sender: {
    type: String, // Bank SMS number
    required: true
  },
  from: {
    type: String, // Sender phone number
    required: true
  },
  raw_text: {
    type: String,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  processed: {
    type: Boolean,
    default: false
  },
  processed_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
paymentSchema.index({ device_id: 1, timestamp: -1 });
paymentSchema.index({ bank: 1, processed: 1 });
paymentSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Payment', paymentSchema);