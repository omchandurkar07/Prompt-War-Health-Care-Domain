const mongoose = require('mongoose');

const HealthPassportSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  passport_token: { type: String, required: true, unique: true },
  pin_hash: { type: String, required: true },
  sections: [{ type: String }], // Array of sections to include, e.g. ['conditions', 'medications']
  date_range: { type: String, default: 'all' },
  pdf_path: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthPassport', HealthPassportSchema);
