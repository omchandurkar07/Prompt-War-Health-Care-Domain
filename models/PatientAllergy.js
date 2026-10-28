const mongoose = require('mongoose');

const PatientAllergySchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  allergy_name: { type: String, required: true },
  allergy_type: { type: String, default: 'drug' }, // drug, food, env, other
  severity: { type: String, default: 'moderate' }, // mild, moderate, severe
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PatientAllergy', PatientAllergySchema);
