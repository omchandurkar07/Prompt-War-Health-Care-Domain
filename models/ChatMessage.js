const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  sender_type: { type: String, required: true, enum: ['patient', 'doctor'] },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
