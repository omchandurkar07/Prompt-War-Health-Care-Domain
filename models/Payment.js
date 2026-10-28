const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true
  },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  amount_paise: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR', enum: ['INR'] },
  status: {
    type: String,
    enum: ['pending', 'creating', 'created', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  razorpay_order_id: { type: String, default: '' },
  razorpay_payment_id: { type: String, default: '' },
  razorpay_signature: { type: String, default: '' },
  refund_status: {
    type: String,
    enum: ['none', 'requested', 'processing', 'processed', 'rejected', 'failed'],
    default: 'none'
  },
  refund_id: { type: String, default: '' },
  refund_requested_at: { type: Date },
  refund_decided_at: { type: Date },
  refund_decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  refund_note: { type: String, default: '' },
  paid_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

PaymentSchema.index({ patient_id: 1, created_at: -1 });
PaymentSchema.index({ refund_status: 1, updated_at: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
