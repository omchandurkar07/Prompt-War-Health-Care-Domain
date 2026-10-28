const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');

const { patientRequired, doctorRequired } = require('../middleware/auth');
const { sendEmergencyConsultationJoinEmail } = require('../services/emailService');

// Helper to generate doctor slots
const generateSlots = (start, end, duration, breakStart, breakEnd) => {
  const slots = [];
  try {
    let current = new Date(`2000-01-01T${start}:00`);
    const endTime = new Date(`2000-01-01T${end}:00`);
    const bStart = new Date(`2000-01-01T${breakStart}:00`);
    const bEnd = new Date(`2000-01-01T${breakEnd}:00`);

    while (current < endTime) {
      const next = new Date(current.getTime() + duration * 60 * 1000);
      if (!(current >= bStart && current < bEnd)) {
        const hh = String(current.getHours()).padStart(2, '0');
        const mm = String(current.getMinutes()).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
      current = next;
    }
  } catch (err) {
    console.error('Error generating slots', err);
  }
  return slots;
};

// Helper to check and auto disable availability when fully booked
const checkAndAutoDisableDoctorAvailability = async (doctorId, dateStr) => {
  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.is_available) return;

    const allSlots = generateSlots(
      doctor.slot_start,
      doctor.slot_end,
      doctor.slot_duration,
      doctor.break_start,
      doctor.break_end
    );
    if (allSlots.length === 0) return;

    const booked = await Appointment.find({
      doctor_id: doctorId,
      appt_date: dateStr,
      status: { $in: ['pending', 'confirmed'] }
    });
    const bookedSlots = booked.map(b => b.time_slot);

    const allBooked = allSlots.every(slot => bookedSlots.includes(slot));
    if (allBooked) {
      doctor.is_available = false;
      doctor.last_active = new Date();
      await doctor.save();

      const notif = new Notification({
        user_id: doctorId,
        user_type: 'doctor',
        title: 'Availability Status Auto-Updated',
        message: `All slots for ${dateStr} are fully booked. Your status has been set to Busy automatically.`,
        link: '/doctor/dashboard'
      });
      await notif.save();
    }
  } catch (err) {
    console.error('Error auto disabling doctor availability:', err);
  }
};

// Check if user is patient or doctor of the appointment
const getAppointmentForUser = async (req, aid) => {
  const appt = await Appointment.findById(aid).populate('doctor_id');
  if (!appt) return null;

  const role = req.session.role;
  if (role === 'patient' && appt.patient_id.toString() === req.session.patient_id) {
    return appt;
  }
  if (role === 'doctor' && appt.doctor_id._id.toString() === req.session.doctor_id) {
    return appt;
  }
  return null;
};

const notifyDoctorEmergencyJoin = async (req, appt, sessionType) => {
  if (req.session.role === 'patient' && appt.appt_type === 'emergency') {
    const sessionKey = `notified_emerg_${appt._id}`;
    if (!req.session[sessionKey]) {
      const doc = await Doctor.findById(appt.doctor_id);
      const patient = await Patient.findById(appt.patient_id);
      if (doc && patient) {
        await sendEmergencyConsultationJoinEmail(doc.email, doc.full_name, patient.full_name, sessionType);
        req.session[sessionKey] = true;
      }
    }
  }
};

// POST /consultation/start/:did/:session_type
router.post('/consultation/start/:did/:session_type', patientRequired, async (req, res) => {
  const { did, session_type } = req.params;
  const pid = req.session.patient_id;

  if (session_type !== 'video' && session_type !== 'chat') {
    return res.status(400).json({ ok: false, error: 'Invalid consultation type.' });
  }

  try {
    const doctor = await Doctor.findOne({ _id: did, is_approved: true });
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    if (!doctor.is_available) {
      return res.status(400).json({ ok: false, error: 'Doctor is currently unavailable for emergency consultation.' });
    }

    // Rate Limiting: Max 2 emergency consultations per day, 1 request every 30 minutes
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const recentEmergencyCount = await Appointment.countDocuments({
      patient_id: pid,
      appt_type: 'emergency',
      created_at: { $gte: thirtyMinsAgo }
    });

    if (recentEmergencyCount > 0) {
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded: You can only request one emergency consultation every 30 minutes.' });
    }

    const dailyEmergencyCount = await Appointment.countDocuments({
      patient_id: pid,
      appt_type: 'emergency',
      created_at: { $gte: todayStart }
    });

    if (dailyEmergencyCount >= 2) {
      return res.status(429).json({ ok: false, error: 'Daily limit reached: You can have a maximum of 2 emergency consultations per day.' });
    }

    const emergency_type = req.body.emergency_type || 'Other';
    const emergency_description = (req.body.emergency_description || '').trim();
    const reason = emergency_description
      ? `Emergency (${emergency_type}): ${emergency_description.slice(0, 60)}`
      : `Emergency (${emergency_type})`;

    const emergency_fee = Math.round(doctor.consultation_fee * 1.5);
    const appt_date = now.toISOString().split('T')[0];
    const time_slot = now.toTimeString().slice(0, 5);

    const appt = new Appointment({
      patient_id: pid,
      doctor_id: did,
      appt_date,
      time_slot,
      appt_type: 'emergency',
      reason,
      fee: emergency_fee,
      status: 'confirmed',
      emergency_type,
      emergency_description,
      payment_status: 'completed'
    });
    await appt.save();

    const pname = req.session.patient_name || 'A patient';
    const notif = new Notification({
      user_id: did,
      user_type: 'doctor',
      title: '🚨 Emergency Appointment Request',
      message: `${pname} requested an emergency consultation.`,
      link: '/doctor/appointments'
    });
    await notif.save();

    await checkAndAutoDisableDoctorAvailability(did, appt_date);

    res.json({
      ok: true,
      message: 'Join your online emergency consultation below.',
      appointment_id: appt._id,
      session_type
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error starting emergency consultation.' });
  }
});

// GET /consultation/video/:aid
router.get('/consultation/video/:aid', async (req, res) => {
  const { aid } = req.params;
  if (!req.session.patient_id && !req.session.doctor_id) {
    return res.status(401).json({ ok: false, error: 'Please log in to join the consultation.' });
  }

  try {
    const appt = await getAppointmentForUser(req, aid);
    if (!appt) {
      return res.status(403).json({ ok: false, error: 'You are not authorized to join this consultation.' });
    }

    if (appt.appt_type !== 'emergency') {
      return res.status(400).json({ ok: false, error: 'This service is only available for emergency appointments.' });
    }

    if (!['pending', 'confirmed', 'completed'].includes(appt.status)) {
      return res.status(400).json({ ok: false, error: 'This consultation is not available.' });
    }

    if (!appt.session_start_time) {
      appt.session_start_time = new Date().toISOString();
      await appt.save();
    }

    await notifyDoctorEmergencyJoin(req, appt, 'video');

    if (!appt.room_id) {
      appt.room_id = crypto.randomUUID();
      await appt.save();
    }

    const displayName = req.session.patient_name || req.session.doctor_name || 'Guest';

    res.json({
      ok: true,
      appt,
      room_id: appt.room_id,
      doctor_name: appt.doctor_id ? appt.doctor_id.full_name : 'Doctor',
      display_name: displayName
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading video session.' });
  }
});

// GET /consultation/chat/:aid
router.get('/consultation/chat/:aid', async (req, res) => {
  const { aid } = req.params;
  if (!req.session.patient_id && !req.session.doctor_id) {
    return res.status(401).json({ ok: false, error: 'Please log in to join the consultation.' });
  }

  try {
    const appt = await getAppointmentForUser(req, aid);
    if (!appt) {
      return res.status(403).json({ ok: false, error: 'You are not authorized to join this chat.' });
    }

    if (appt.appt_type !== 'emergency') {
      return res.status(400).json({ ok: false, error: 'This service is only available for emergency appointments.' });
    }

    if (!['pending', 'confirmed', 'completed'].includes(appt.status)) {
      return res.status(400).json({ ok: false, error: 'This consultation is not available.' });
    }

    if (!appt.session_start_time) {
      appt.session_start_time = new Date().toISOString();
      await appt.save();
    }

    await notifyDoctorEmergencyJoin(req, appt, 'chat');

    if (!appt.room_id) {
      appt.room_id = crypto.randomUUID();
      await appt.save();
    }

    let senderId, senderType;
    if (req.session.role === 'patient') {
      senderId = req.session.patient_id;
      senderType = 'patient';
    } else {
      senderId = req.session.doctor_id;
      senderType = 'doctor';
    }

    res.json({
      ok: true,
      appt,
      doctor_name: appt.doctor_id ? appt.doctor_id.full_name : 'Doctor',
      sender_id: senderId,
      sender_type: senderType
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading chat session.' });
  }
});

// GET /consultation/complete/:aid
router.get('/consultation/complete/:aid', async (req, res) => {
  const { aid } = req.params;
  if (!req.session.patient_id && !req.session.doctor_id) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const appt = await getAppointmentForUser(req, aid);
    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    }

    if (appt.appt_type !== 'emergency' && Number(appt.fee) > 0 && appt.payment_status !== 'completed') {
      return res.status(409).json({ ok: false, error: 'The patient must complete payment before this consultation can be finalized.' });
    }

    appt.status = 'completed';
    appt.updated_at = new Date();
    await appt.save();

    const dname = appt.doctor_id ? appt.doctor_id.full_name : 'Doctor';
    const cleanDname = dname.startsWith('Dr. ') ? dname : `Dr. ${dname}`;

    const reviewNotif = new Notification({
      user_id: appt.patient_id,
      user_type: 'patient',
      title: '⭐ Rate your consultation',
      message: `Your emergency consultation with ${cleanDname} has ended. Please rate your experience!`,
      link: `/review/${aid}`
    });
    await reviewNotif.save();

    res.json({
      ok: true,
      message: 'Consultation session ended.',
      appointment_id: aid,
      doctor_name: cleanDname,
      role: req.session.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/chat/history/:aid
router.get('/api/chat/history/:aid', async (req, res) => {
  const { aid } = req.params;
  if (!req.session.patient_id && !req.session.doctor_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const appt = await getAppointmentForUser(req, aid);
    if (!appt) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const rows = await ChatMessage.find({ appointment_id: aid })
      .sort({ created_at: -1 })
      .limit(50);

    const messages = [];
    // Process in reverse (oldest first)
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      let senderName = 'User';

      if (row.sender_type === 'patient') {
        const p = await Patient.findById(row.sender_id);
        senderName = p ? p.full_name : 'Patient';
      } else {
        const d = await Doctor.findById(row.sender_id);
        senderName = d ? d.full_name : 'Doctor';
      }

      let tsDisplay = '';
      try {
        tsDisplay = new Date(row.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch (err) {}

      messages.push({
        id: row._id,
        sender_id: row.sender_id,
        sender_type: row.sender_type,
        sender_name: senderName,
        message: row.message,
        timestamp: tsDisplay
      });
    }

    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/chat/send/:aid
router.post('/api/chat/send/:aid', async (req, res) => {
  const { aid } = req.params;
  const messageText = (req.body.message || '').trim();

  if (!req.session.patient_id && !req.session.doctor_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!messageText) {
    return res.status(400).json({ error: 'Empty message' });
  }

  try {
    const appt = await getAppointmentForUser(req, aid);
    if (!appt) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let senderId, senderType;
    if (req.session.role === 'patient') {
      senderId = req.session.patient_id;
      senderType = 'patient';
    } else {
      senderId = req.session.doctor_id;
      senderType = 'doctor';
    }

    const newMessage = new ChatMessage({
      appointment_id: aid,
      sender_id: senderId,
      sender_type: senderType,
      message: messageText
    });
    await newMessage.save();

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
