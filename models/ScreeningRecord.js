const mongoose = require('mongoose');

const ScreeningRecordSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  screening_name: { type: String, required: true },
  reason: { type: String, default: '' },
  status: { type: String, default: 'due' }, // due, completed, snoozed
  completed_date: { type: String }, // Format: YYYY-MM-DD
  health_record_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthRecord', default: null },
  snooze_until: { type: String }, // Format: YYYY-MM-DD
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScreeningRecord', ScreeningRecordSchema);
