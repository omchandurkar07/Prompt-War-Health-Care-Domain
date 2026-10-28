const mongoose = require('mongoose');

const QueueEntrySchema = new mongoose.Schema({
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  patient_name: { type: String, required: true },
  reason: { type: String, default: '' },
  queue_date: { type: String, required: true }, // Format: YYYY-MM-DD
  queue_position: { type: Number, required: true },
  queue_status: { type: String, default: 'waiting' }, // waiting, calling, completed, skipped
  is_walkin: { type: Boolean, default: false },
  called_at: { type: String }, // ISO string or standard time
  done_at: { type: String }, // ISO string or standard time
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QueueEntry', QueueEntrySchema);
