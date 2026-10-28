const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  user_type: { type: String, required: true, enum: ['patient', 'doctor', 'admin'] },
  title: { type: String, required: true },
  message: { type: String },
  link: { type: String },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
