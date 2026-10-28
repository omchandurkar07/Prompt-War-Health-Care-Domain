const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  phone: { type: String, trim: true },
  dob: { type: String },
  gender: { type: String },
  blood_group: { type: String },
  address: { type: String },
  emergency_contact: { type: String },
  profile_image: { type: String },
  chronic_conditions: { type: String, default: '' },
  is_verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', PatientSchema);
