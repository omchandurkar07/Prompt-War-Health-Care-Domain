const mongoose = require('mongoose');

const DrugAllergyOverrideSchema = new mongoose.Schema({
  prescription_id: { type: String, required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  drug_name: { type: String, required: true },
  alert_type: { type: String, default: 'allergy' },
  alert_detail: { type: String, default: '' },
  override_reason: { type: String, default: '' },
  override_note: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DrugAllergyOverride', DrugAllergyOverrideSchema);
