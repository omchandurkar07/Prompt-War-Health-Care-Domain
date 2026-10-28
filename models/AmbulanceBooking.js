const mongoose = require('mongoose');

const AmbulanceBookingSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  pickup_location: { type: String, required: true },
  severity: { type: String, required: true },
  status: { type: String, default: 'dispatched' }, // dispatched, enroute, arrived, completed, cancelled
  driver_name: { type: String },
  driver_phone: { type: String },
  vehicle_number: { type: String },
  eta_minutes: { type: Number, default: 15 },
  pickup_lat: { type: Number },
  pickup_lng: { type: Number },
  driver_lat: { type: Number },
  driver_lng: { type: Number },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AmbulanceBooking', AmbulanceBookingSchema);
