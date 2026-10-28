const mongoose = require('mongoose');

const MedicineReminderSchema = new mongoose.Schema({
  prescription_db_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  prescription_id: { type: String, required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  medicine_name: { type: String, required: true },
  remind_time: { type: String, default: '09:00' }, // Format: HH:MM
  frequency: { type: String, default: 'DAILY' },
  next_trigger_at: { type: String, required: true }, // Format: ISO date string or standard date
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MedicineReminder', MedicineReminderSchema);
