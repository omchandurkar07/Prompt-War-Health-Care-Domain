const mongoose = require('mongoose');

const ShareLinkSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  token: { type: String, required: true, unique: true },
  record_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HealthRecord' }],
  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShareLink', ShareLinkSchema);
