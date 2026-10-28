const mongoose = require('mongoose');

const AdherenceLogSchema = new mongoose.Schema({
  care_plan_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlanItem', required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  log_date: { type: String, required: true }, // Format: YYYY-MM-DD
  is_done: { type: Boolean, default: false },
  done_at: { type: Date }
});

// Compound unique index matching the SQLite constraint
AdherenceLogSchema.index({ care_plan_item_id: 1, log_date: 1 }, { unique: true });

module.exports = mongoose.model('AdherenceLog', AdherenceLogSchema);
