const mongoose = require('mongoose');

const HealthLogSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  condition: { type: String, required: true }, // e.g., "Diabetes", "Hypertension"
  log_date: { type: String, required: true }, // Format: YYYY-MM-DD
  log_time: { type: String, default: '' }, // Format: HH:MM
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { blood_sugar: 120 } or { systolic: 120, diastolic: 80 }
  note: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HealthLog', HealthLogSchema);
