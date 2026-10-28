const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  family_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  appt_date: { type: String, required: true }, // Format: YYYY-MM-DD
  time_slot: { type: String, required: true }, // Format: HH:MM
  appt_type: { type: String, default: 'normal' }, // normal, emergency, home_visit
  home_address: { type: String, default: '' },
  status: { type: String, default: 'pending' }, // pending, confirmed, completed, cancelled, rejected
  reason: { type: String },
  fee: { type: Number, default: 0 },
  doctor_notes: { type: String },
  prescription: { type: String }, // Digital text or quick details
  room_id: { type: String }, // Jitsi/video room ID
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  responded_at: { type: Date },
  emergency_type: { type: String, default: '' },
  emergency_description: { type: String, default: '' },
  session_start_time: { type: String },
  session_end_time: { type: String },
  consultation_duration: { type: Number, default: 0 },
  payment_status: { type: String, default: 'pending' },
  reschedule_request: {
    appt_date: { type: String },
    time_slot: { type: String },
    requested_at: { type: Date }
  },
  appointment_reminder_sent_at: { type: Date },
  doctor_reschedule_message: { type: String, default: '' }
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
