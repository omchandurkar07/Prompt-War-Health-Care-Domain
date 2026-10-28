const express = require('express');
const router = express.Router();
const AmbulanceBooking = require('../models/AmbulanceBooking');
const { patientRequired } = require('../middleware/auth');

const DRIVERS = [
  { name: 'Ramesh Shinde', phone: '+91 98230 12345', vehicle: 'MH-12-EM-4521' },
  { name: 'Amit Kadam', phone: '+91 99750 67890', vehicle: 'MH-12-EM-8902' },
  { name: 'Sunil More', phone: '+91 91580 43210', vehicle: 'MH-12-EM-3045' },
  { name: 'Vijay Patil', phone: '+91 94220 98765', vehicle: 'MH-12-EM-7711' }
];

router.get('/ambulance-emergency', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const bookingId = req.query.booking_id;
  let activeBooking = null;

  try {
    if (bookingId && bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      activeBooking = await AmbulanceBooking.findOne({ _id: bookingId, patient_id: pid });
    }
    
    if (!activeBooking) {
      // Find any active booking in dispatched, enroute, arrived
      activeBooking = await AmbulanceBooking.findOne({
        patient_id: pid,
        status: { $in: ['dispatched', 'enroute', 'arrived'] }
      }).sort({ created_at: -1 });
    }

    res.json({ ok: true, active_booking: activeBooking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading ambulance status' });
  }
});

router.post('/ambulance-emergency', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { pickup_location, severity } = req.body;

  if (!pickup_location) {
    return res.status(400).json({ ok: false, error: 'Pickup location is required.' });
  }

  try {
    const driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    const eta = severity === 'critical' ? 10 : 18;

    const puneLat = 18.5204;
    const puneLng = 73.8567;
    const pickupLat = puneLat + (Math.random() * 0.024 - 0.012);
    const pickupLng = puneLng + (Math.random() * 0.024 - 0.012);

    const driverLat = pickupLat + (Math.random() > 0.5 ? 0.018 : -0.018) + (Math.random() * 0.008 - 0.004);
    const driverLng = pickupLng + (Math.random() > 0.5 ? 0.018 : -0.018) + (Math.random() * 0.008 - 0.004);

    const booking = new AmbulanceBooking({
      patient_id: pid,
      pickup_location,
      severity: severity || 'critical',
      status: 'dispatched',
      driver_name: driver.name,
      driver_phone: driver.phone,
      vehicle_number: driver.vehicle,
      eta_minutes: eta,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      driver_lat: driverLat,
      driver_lng: driverLng
    });

    await booking.save();
    res.json({ ok: true, message: '🚨 Ambulance emergency dispatched successfully!', booking });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/api/ambulance/status/:booking_id', async (req, res) => {
  if (!req.session.patient_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pid = req.session.patient_id;
  const bookingId = req.params.booking_id;

  try {
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const booking = await AmbulanceBooking.findOne({ _id: bookingId, patient_id: pid });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.json({
        status: booking.status,
        driver_lat: booking.pickup_lat,
        driver_lng: booking.pickup_lng,
        pickup_lat: booking.pickup_lat,
        pickup_lng: booking.pickup_lng,
        eta_minutes: 0,
        progress: 1.0,
        driver_name: booking.driver_name,
        driver_phone: booking.driver_phone,
        vehicle_number: booking.vehicle_number
      });
    }

    // Trip duration: 2 mins (120 secs)
    const elapsed = (Date.now() - new Date(booking.created_at).getTime()) / 1000;
    const totalTripSeconds = 120.0;
    const progress = Math.min(1.0, Math.max(0.0, elapsed / totalTripSeconds));

    // Interpolate driver coordinates
    const currLat = booking.driver_lat + (booking.pickup_lat - booking.driver_lat) * progress;
    const currLng = booking.driver_lng + (booking.pickup_lng - booking.driver_lng) * progress;

    const etaMinutes = Math.max(0, Math.round((1.0 - progress) * booking.eta_minutes));

    let newStatus = 'dispatched';
    if (progress >= 1.0) {
      newStatus = 'arrived';
    } else if (progress >= 0.5) {
      newStatus = 'enroute';
    }

    if (newStatus !== booking.status) {
      booking.status = newStatus;
      await booking.save();
    }

    res.json({
      status: newStatus,
      driver_lat: currLat,
      driver_lng: currLng,
      pickup_lat: booking.pickup_lat,
      pickup_lng: booking.pickup_lng,
      eta_minutes: etaMinutes,
      progress,
      driver_name: booking.driver_name,
      driver_phone: booking.driver_phone,
      vehicle_number: booking.vehicle_number
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/ambulance/cancel/:booking_id', async (req, res) => {
  if (!req.session.patient_id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pid = req.session.patient_id;
  const bookingId = req.params.booking_id;

  try {
    if (!bookingId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const booking = await AmbulanceBooking.findOne({ _id: bookingId, patient_id: pid });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot cancel completed or already cancelled booking.' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
