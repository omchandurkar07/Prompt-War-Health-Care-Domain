const mongoose = require('mongoose');

const VaccinationLogSchema = new mongoose.Schema({
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true },
  vaccine_name: { type: String, required: true },
  scheduled_age: { type: String }, // e.g. "6 weeks", "At birth"
  status: { type: String, default: 'due' }, // due, completed, overdue
  completed_date: { type: String }, // Format: YYYY-MM-DD
  notes: { type: String, default: '' }
});

module.exports = mongoose.model('VaccinationLog', VaccinationLogSchema);
