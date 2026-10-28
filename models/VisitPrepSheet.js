const mongoose = require('mongoose');

const VisitPrepSheetSchema = new mongoose.Schema({
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  chief_complaint: { type: String, default: '' },
  duration: { type: String, default: '' },
  severity: { type: Number, default: 0 },
  better_worse: { type: String, default: '' },
  current_medications: { type: mongoose.Schema.Types.Mixed, default: [] }, // Can be Array of objects or a serialized JSON string
  temperature: { type: String, default: '' },
  bp_systolic: { type: String, default: '' },
  bp_diastolic: { type: String, default: '' },
  blood_sugar: { type: String, default: '' },
  additional_notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VisitPrepSheet', VisitPrepSheetSchema);
