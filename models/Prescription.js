const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, default: '' },
  timing: { type: String, default: '' },
  frequency: { type: String, default: '' },
  duration: { type: String, default: '' },
  route: { type: String, default: 'Oral' },
  instructions: { type: String, default: '' }
}, { _id: false });

const PrescriptionSchema = new mongoose.Schema({
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  prescription_id: { type: String, required: true, unique: true }, // Format RX-YYYYMMDD-XXXX
  medicines: [MedicineSchema],
  advice: { type: String, default: '' },
  diagnosis_notes: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  doctor_notes: { type: String, default: '' },
  follow_up_date: { type: String }, // Format: YYYY-MM-DD
  doctor_signature: { type: String, default: '' },
  pdf_path: { type: String, default: '' },
  original_upload_url: { type: String, default: '' },
  original_upload_public_id: { type: String, default: '' },
  generated_pdf_url: { type: String, default: '' },
  generated_pdf_public_id: { type: String, default: '' },
  ocr_raw_text: { type: String, default: '' },
  email_sent: { type: Boolean, default: false },
  public_token: { type: String, unique: true, sparse: true },
  is_verified: { type: Boolean, default: true },
  ai_explanation: { type: String, default: '' },
  ai_explanation_raw: { type: String, default: '' },
  ai_status: { type: String, default: 'success' },
  ai_language: { type: String, default: 'English' },
  cds_warnings: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
