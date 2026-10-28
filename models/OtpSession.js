const mongoose = require('mongoose');

const OtpSessionSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp_code: { type: String, required: true },
  purpose: { type: String, default: 'registration' },
  attempts: { type: Number, default: 0 },
  is_verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true }
});

// TTL index to automatically delete expired OTP sessions
OtpSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpSession', OtpSessionSchema);
