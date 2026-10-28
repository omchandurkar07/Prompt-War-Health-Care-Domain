const mongoose = require('mongoose');

const HealthRecordSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  doc_type: { type: String, default: 'Other' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  file_path: { type: String },
  doctor_name: { type: String, default: '' },
  tags: { type: String, default: '' },
  record_date: { type: String }, // Format: YYYY-MM-DD
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthRecord', HealthRecordSchema);
