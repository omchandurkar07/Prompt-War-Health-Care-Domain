const mongoose = require('mongoose');

const FamilyMemberSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  name: { type: String, required: true },
  dob: { type: String }, // Format: YYYY-MM-DD
  relation: { type: String, default: '' },
  gender: { type: String, default: '' },
  blood_group: { type: String, default: '' },
  allergies: { type: String, default: '' },
  chronic_conditions: { type: String, default: '' },
  profile_image: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FamilyMember', FamilyMemberSchema);
