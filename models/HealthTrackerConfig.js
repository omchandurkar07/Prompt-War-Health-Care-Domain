const mongoose = require('mongoose');

const HealthTrackerConfigSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  condition: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  reminder_time: { type: String, default: '08:00' }, // Format: HH:MM
  share_with_doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
  targets: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { systolic_max: 130, blood_sugar_max: 140 }
  created_at: { type: Date, default: Date.now }
});

// Compound unique index matching the SQLite constraint
HealthTrackerConfigSchema.index({ patient_id: 1, condition: 1 }, { unique: true });

module.exports = mongoose.model('HealthTrackerConfig', HealthTrackerConfigSchema);
