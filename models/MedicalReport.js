const mongoose = require('mongoose');

const MedicalReportSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  title: { type: String, required: true },
  report_type: { type: String, default: 'OTHER' },
  file_url: { type: String, required: true },
  file_public_id: { type: String, default: '' },
  storage: { type: String, default: '' },
  uploaded_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MedicalReport', MedicalReportSchema);
