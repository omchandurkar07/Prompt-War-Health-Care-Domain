const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Prescription = require('../models/Prescription');
const HealthRecord = require('../models/HealthRecord');
const FamilyMember = require('../models/FamilyMember');
const PatientAllergy = require('../models/PatientAllergy');
const CarePlanItem = require('../models/CarePlanItem');

const { doctorRequired } = require('../middleware/auth');
const { explainPrescriptionWithAi } = require('../services/prescriptionAi');
const { uploadFile } = require('../services/cloudinaryService');
const { generateCdsWarnings } = require('../services/cdsService');
const { finalizePrescription } = require('../services/prescriptionFinalize');

const tempUpload = multer({ dest: 'static/uploads/temp' });

// Multer storage configuration for patient records uploaded by doctor
const recordStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { pid } = req.params;
    const uploadDir = path.join(__dirname, `../static/uploads/records/${pid}`);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const docType = req.body.doc_type || 'Other';
    const cleanDocType = docType.replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    cb(null, `${timestamp}_${cleanDocType}${ext}`);
  }
});
const recordUpload = multer({ storage: recordStorage });

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../static/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doctor_${Date.now()}${ext}`);
  }
});
const profileUpload = multer({ storage: profileStorage });

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

// Helper to update average response time of a doctor
const updateDoctorResponseTime = async (doctorId) => {
  try {
    const appts = await Appointment.find({
      doctor_id: doctorId,
      responded_at: { $ne: null }
    });
    if (appts.length === 0) return;

    let totalMins = 0;
    appts.forEach(appt => {
      const diffMs = new Date(appt.responded_at) - new Date(appt.created_at);
      totalMins += diffMs / (1000 * 60);
    });

    const avg = Math.round(totalMins / appts.length);
    await Doctor.findByIdAndUpdate(doctorId, { response_time_avg: avg });
  } catch (err) {
    console.error('Error updating doctor response time:', err);
  }
};

const generatePrescriptionId = () => {
  const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RX-${datePart}-${randPart}`;
};

// Helper functions for doctor badges
const getDoctorBadges = (doc) => {
  const badges = [];
  if (doc.rating_avg >= 4.5 && doc.rating_count >= 3) {
    badges.push({ label: 'Top Doctor', icon: '⭐', color: 'gold' });
  }
  if (doc.response_time_avg > 0 && doc.response_time_avg < 60) {
    badges.push({ label: 'Fast Response', icon: '⚡', color: 'blue' });
  }
  if (doc.rating_avg >= 4.0) {
    badges.push({ label: 'Highly Rated', icon: '🏆', color: 'green' });
  }
  if (doc.is_available) {
    badges.push({ label: 'Available Now', icon: '🟢', color: 'emerald' });
  }
  return badges;
};

// ==================== DOCTOR DASHBOARD ====================
router.get('/doctor/dashboard', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const doctor = await Doctor.findById(did);
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    const pending = await Appointment.find({ doctor_id: did, status: 'pending' })
      .populate('patient_id')
      .sort({ appt_type: -1, created_at: 1 }); // Emergency first

    const todayConfirmedCount = await Appointment.countDocuments({
      doctor_id: did,
      appt_date: todayStr,
      status: 'confirmed'
    });

    const completedCount = await Appointment.countDocuments({ doctor_id: did, status: 'completed' });
    const totalApptsCount = await Appointment.countDocuments({ doctor_id: did });

    // Distinct patients
    const distinctPatients = await Appointment.distinct('patient_id', {
      doctor_id: did,
      status: { $in: ['completed', 'confirmed'] }
    });

    const rxCount = await Prescription.countDocuments({ doctor_id: did });

    const stats = {
      today: todayConfirmedCount,
      total_patients: distinctPatients.length,
      total_appts: totalApptsCount,
      completed: completedCount,
      pending: pending.length,
      rating: doctor.rating_avg,
      rating_count: doctor.rating_count,
      prescriptions: rxCount
    };

    const recentDocs = await Appointment.find({ doctor_id: did })
      .populate('patient_id')
      .sort({ created_at: -1 })
      .limit(10);
    const recent = recentDocs.map(a => ({
      ...a.toObject(),
      pname: a.patient_id ? a.patient_id.full_name : 'Unknown'
    }));

    const completedDocs = await Appointment.find({ doctor_id: did, status: 'completed' })
      .populate('patient_id')
      .sort({ appt_date: -1 })
      .limit(10);
    const completed_sessions = completedDocs.map(a => ({
      ...a.toObject(),
      pname: a.patient_id ? a.patient_id.full_name : 'Unknown'
    }));

    const rxDocs = await Prescription.find({ doctor_id: did })
      .populate('patient_id')
      .sort({ created_at: -1 })
      .limit(6);
    const recent_prescriptions = rxDocs.map(rx => ({
      ...rx.toObject(),
      pname: rx.patient_id ? rx.patient_id.full_name : 'Unknown'
    }));

    res.json({
      ok: true,
      doctor,
      pending,
      stats,
      recent,
      completed_sessions,
      recent_prescriptions,
      badges: getDoctorBadges(doctor)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading doctor dashboard.' });
  }
});

// GET & POST /doctor/profile
router.get('/doctor/profile', doctorRequired, async (req, res) => {
  const SPECIALIZATIONS = [
    'Cardiologist', 'Neurologist', 'General Physician', 'Dermatologist', 'Dentist',
    'Orthopedic Surgeon', 'Ophthalmologist', 'ENT Specialist', 'Pediatrician',
    'Gynecologist', 'Psychiatrist', 'Gastroenterologist', 'Pulmonologist',
    'Endocrinologist', 'Urologist', 'Nephrologist', 'Oncologist', 'General Surgeon',
    'Rheumatologist'
  ];

  try {
    const doctor = await Doctor.findById(req.session.doctor_id);
    res.json({ ok: true, doctor, specializations: SPECIALIZATIONS });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading profile.' });
  }
});

router.post('/doctor/profile', doctorRequired, profileUpload.single('profile_image'), async (req, res) => {
  const did = req.session.doctor_id;
  const f = req.body;

  try {
    const updateData = {
      full_name: (f.full_name || '').trim(),
      phone: (f.phone || '').trim(),
      specialization: f.specialization,
      qualification: f.qualification || '',
      experience_years: parseInt(f.experience_years) || 0,
      bio: f.bio || '',
      hospital_name: f.hospital_name || '',
      clinic_address: f.clinic_address || '',
      city: f.city || '',
      state: f.state || '',
      pincode: f.pincode || '',
      consultation_fee: parseInt(f.consultation_fee) || 500,
      home_visit_available: f.home_visit_available === 'on' || f.home_visit_available === true || f.home_visit_available === 'true',
      home_visit_fee: parseInt(f.home_visit_fee) || 0,
      available_days: f.available_days || 'Mon,Tue,Wed,Thu,Fri',
      slot_start: f.slot_start || '09:00',
      slot_end: f.slot_end || '17:00',
      slot_duration: parseInt(f.slot_duration) || 30,
      break_start: f.break_start || '13:00',
      break_end: f.break_end || '14:00'
    };

    if (req.file) {
      updateData.profile_image = `/static/uploads/${req.file.filename}`;
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(did, updateData, { new: true });
    req.session.doctor_name = f.full_name.trim();

    res.json({ ok: true, message: 'Profile updated!', doctor: updatedDoctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error updating profile.' });
  }
});

// GET /doctor/appointments
router.get('/doctor/appointments', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const filter = req.query.filter || 'all';
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const doctor = await Doctor.findById(did);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const totalPatients = await Appointment.distinct('patient_id', {
      doctor_id: did,
      status: { $in: ['completed', 'confirmed'] }
    });

    const activePatientsWeek = await Appointment.distinct('patient_id', {
      doctor_id: did,
      appt_date: { $gte: sevenDaysAgoStr, $lte: todayStr }
    });

    const completed = await Appointment.find({ doctor_id: did, status: 'completed' });
    const revenue = completed.reduce((sum, a) => sum + (a.fee || 0), 0);

    const stats = {
      total_appts: await Appointment.countDocuments({ doctor_id: did }),
      patients_week: activePatientsWeek.length,
      pending_reqs: await Appointment.countDocuments({ doctor_id: did, status: 'pending' }),
      completed: completed.length,
      today_count: await Appointment.countDocuments({
        doctor_id: did,
        appt_date: todayStr,
        status: { $in: ['pending', 'confirmed'] }
      }),
      revenue
    };

    const query = { doctor_id: did };
    let sort = { appt_date: -1, time_slot: -1 };

    if (filter === 'pending') {
      query.status = 'pending';
      sort = { appt_type: -1, created_at: -1 }; // Emergency first
    } else if (filter === 'today') {
      query.appt_date = todayStr;
      sort = { time_slot: 1 };
    } else if (filter === 'upcoming') {
      query.appt_date = { $gte: todayStr };
      query.status = { $in: ['pending', 'confirmed'] };
      sort = { appt_date: 1, time_slot: 1 };
    } else if (filter === 'completed') {
      query.status = 'completed';
    } else if (filter === 'cancelled') {
      query.status = { $in: ['cancelled', 'rejected'] };
    }

    const apptDocs = await Appointment.find(query).populate('patient_id').sort(sort);
    const appointments = apptDocs.map(a => ({
      ...a.toObject(),
      pname: a.patient_id ? a.patient_id.full_name : 'Unknown',
      pphone: a.patient_id ? a.patient_id.phone : '',
      pemail: a.patient_id ? a.patient_id.email : ''
    }));

    res.json({
      ok: true,
      appointments,
      stats,
      doctor,
      current_filter: filter
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading appointments.' });
  }
});

// POST /doctor/appointment/:aid/accept
router.post('/doctor/appointment/:aid/accept', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;
  const now = new Date();

  try {
    const appt = await Appointment.findOneAndUpdate(
      { _id: aid, doctor_id: did },
      { status: 'confirmed', responded_at: now, updated_at: now },
      { new: true }
    );

    if (appt) {
      const newNotif = new Notification({
        user_id: appt.patient_id,
        user_type: 'patient',
        title: '✔ Appointment Confirmed',
        message: `Your appointment on ${appt.appt_date} at ${appt.time_slot} has been confirmed!`,
        link: '/appointments'
      });
      await newNotif.save();
    }

    await updateDoctorResponseTime(did);

    res.json({ ok: true, message: 'Appointment accepted!', appointment: appt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error accepting appointment.' });
  }
});

// POST /doctor/appointment/:aid/reject
router.post('/doctor/appointment/:aid/reject', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;
  const now = new Date();

  try {
    const appt = await Appointment.findOneAndUpdate(
      { _id: aid, doctor_id: did },
      { status: 'rejected', responded_at: now, updated_at: now },
      { new: true }
    );

    if (appt) {
      const newNotif = new Notification({
        user_id: appt.patient_id,
        user_type: 'patient',
        title: '✖ Appointment Declined',
        message: `Your appointment on ${appt.appt_date} at ${appt.time_slot} was declined.`,
        link: '/appointments'
      });
      await newNotif.save();
    }

    await updateDoctorResponseTime(did);

    res.json({ ok: true, message: 'Appointment rejected.', appointment: appt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error rejecting appointment.' });
  }
});

router.post('/doctor/appointment/:aid/reschedule/:decision', doctorRequired, async (req, res) => {
  const { aid, decision } = req.params;
  const doctorId = req.session.doctor_id;
  if (!['accept', 'decline'].includes(decision)) {
    return res.status(400).json({ ok: false, error: 'Invalid reschedule decision.' });
  }

  try {
    const appointment = await Appointment.findOne({
      _id: aid,
      doctor_id: doctorId,
      status: 'confirmed',
      'reschedule_request.requested_at': { $exists: true }
    });
    if (!appointment) {
      return res.status(404).json({ ok: false, error: 'Pending reschedule request not found.' });
    }

    if (decision === 'accept') {
      const request = appointment.reschedule_request;
      const doctor = await Doctor.findById(doctorId);
      const requestedDate = new Date(`${request.appt_date}T00:00:00.000Z`);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const requestedDay = requestedDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const availableDays = (doctor?.available_days || '').split(',').map(day => day.trim());
      const availableSlots = doctor
        ? generateSlots(doctor.slot_start, doctor.slot_end, doctor.slot_duration, doctor.break_start, doctor.break_end)
        : [];
      if (!doctor || Number.isNaN(requestedDate.getTime()) ||
          requestedDate.toISOString().slice(0, 10) !== request.appt_date || requestedDate <= today ||
          !availableDays.includes(requestedDay) || !availableSlots.includes(request.time_slot)) {
        return res.status(409).json({ ok: false, error: 'The requested date or time is no longer available.' });
      }
      const conflict = await Appointment.exists({
        doctor_id: doctorId,
        appt_date: request.appt_date,
        time_slot: request.time_slot,
        status: { $in: ['pending', 'confirmed'] },
        _id: { $ne: appointment._id }
      });
      if (conflict) {
        return res.status(409).json({ ok: false, error: 'That slot has since been booked. Ask the patient to choose another.' });
      }
      appointment.appt_date = request.appt_date;
      appointment.time_slot = request.time_slot;
      appointment.appointment_reminder_sent_at = undefined;
    }

    appointment.reschedule_request = undefined;
    appointment.updated_at = new Date();
    await appointment.save();
    await new Notification({
      user_id: appointment.patient_id,
      user_type: 'patient',
      title: decision === 'accept' ? 'Reschedule approved' : 'Reschedule declined',
      message: decision === 'accept'
        ? `Your appointment is now scheduled for ${appointment.appt_date} at ${appointment.time_slot}.`
        : 'Your doctor declined the reschedule request. Your original appointment remains unchanged.',
      link: '/dashboard#appointments'
    }).save();
    res.json({ ok: true, message: decision === 'accept' ? 'Appointment rescheduled.' : 'Reschedule request declined.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Unable to process reschedule request.' });
  }
});

router.post('/doctor/appointment/:aid/payment-reschedule', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const { appt_date: apptDate, time_slot: timeSlot, message } = req.body;
  const doctorId = req.session.doctor_id;

  if (!mongoose.Types.ObjectId.isValid(aid) ||
      typeof apptDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(apptDate) ||
      typeof timeSlot !== 'string' || !/^\d{2}:\d{2}$/.test(timeSlot) ||
      typeof message !== 'string' || !message.trim() || message.trim().length > 500) {
    return res.status(400).json({ ok: false, error: 'Choose a valid date, time, and patient message (up to 500 characters).' });
  }

  try {
    const appointment = await Appointment.findOne({
      _id: aid,
      doctor_id: doctorId,
      status: 'confirmed',
      payment_status: 'failed'
    });
    if (!appointment) {
      return res.status(404).json({ ok: false, error: 'A confirmed appointment with failed payment was not found.' });
    }

    const doctor = await Doctor.findById(doctorId);
    const requestedDate = new Date(`${apptDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const requestedDay = requestedDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const availableDays = (doctor?.available_days || '').split(',').map(day => day.trim());
    const availableSlots = doctor
      ? generateSlots(doctor.slot_start, doctor.slot_end, doctor.slot_duration, doctor.break_start, doctor.break_end)
      : [];
    if (!doctor || Number.isNaN(requestedDate.getTime()) ||
        requestedDate.toISOString().slice(0, 10) !== apptDate || requestedDate <= today ||
        !availableDays.includes(requestedDay) || !availableSlots.includes(timeSlot)) {
      return res.status(409).json({ ok: false, error: 'The selected date or time is outside your available schedule.' });
    }

    const conflict = await Appointment.exists({
      doctor_id: doctorId,
      appt_date: apptDate,
      time_slot: timeSlot,
      status: { $in: ['pending', 'confirmed'] },
      _id: { $ne: appointment._id }
    });
    if (conflict) {
      return res.status(409).json({ ok: false, error: 'That slot has already been booked. Choose another time.' });
    }

    appointment.appt_date = apptDate;
    appointment.time_slot = timeSlot;
    appointment.payment_status = 'pending';
    appointment.doctor_reschedule_message = message.trim();
    appointment.appointment_reminder_sent_at = undefined;
    appointment.reschedule_request = undefined;
    appointment.updated_at = new Date();
    await appointment.save();

    await Notification.create({
      user_id: appointment.patient_id,
      user_type: 'patient',
      title: 'Your doctor rescheduled the appointment',
      message: `Your appointment has been rescheduled to ${apptDate} at ${timeSlot}. Doctor's message: ${message.trim()}`,
      link: '/dashboard#appointments'
    });

    res.json({
      ok: true,
      message: 'Appointment rescheduled and the patient has been notified. They can now retry payment.'
    });
  } catch (error) {
    console.error('[APPOINTMENT] Doctor reschedule after payment failure failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Unable to reschedule this appointment.' });
  }
});

// POST /doctor/appointment/:aid/complete
router.post('/doctor/appointment/:aid/complete', doctorRequired, tempUpload.single('prescription_file'), async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;
  const notes = req.body.doctor_notes || '';

  try {
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did })
      .populate('patient_id')
      .populate('family_member_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    if (appt.appt_type !== 'emergency' && Number(appt.fee) > 0 && appt.payment_status !== 'completed') {
      return res.status(409).json({ ok: false, error: 'The patient must complete payment before this consultation can be finalized.' });
    }

    const session_end = new Date();
    let duration = 1;
    const session_start_str = appt.session_start_time;
    if (session_start_str) {
      const start_dt = new Date(session_start_str);
      duration = Math.max(1, Math.round((session_end - start_dt) / (1000 * 60)));
    } else {
      const update_dt = new Date(appt.updated_at);
      duration = Math.max(1, Math.round((session_end - update_dt) / (1000 * 60)));
    }

    appt.status = 'completed';
    appt.doctor_notes = notes;
    appt.prescription = req.file ? 'Prescription PDF Uploaded' : 'None';
    appt.session_end_time = session_end.toISOString();
    appt.consultation_duration = duration;
    appt.updated_at = session_end;
    await appt.save();

    const docName = req.session.doctor_name || 'your doctor';
    const cleanDocName = docName.startsWith('Dr. ') ? docName : `Dr. ${docName}`;

    const ratingNotif = new Notification({
      user_id: appt.patient_id._id,
      user_type: 'patient',
      title: '⭐ Rate your consultation',
      message: `Your consultation with ${cleanDocName} has been completed. Please rate your experience!`,
      link: `/review/${aid}`
    });
    await ratingNotif.save();

    let rx = null;

    // Check if optional prescription file uploaded
    if (req.file) {
      const preferredLanguage = req.body.preferred_language || 'English';

      // 1. Upload to Cloudinary
      const up = await uploadFile(req.file, 'prescriptions/originals');
      const originalUrl = up ? up.url : '';
      const originalPid = up ? up.public_id : '';

      // 2. Perform AI parsing
      const aiRes = await explainPrescriptionWithAi(req.file.path, req.file.mimetype, notes, preferredLanguage);
      let medicines = aiRes.medicines || [];
      let diagnosis = aiRes.diagnosis || 'Prescription Analysis';
      const extractedNotes = aiRes.doctor_notes || '';
      const notesMerged = notes && extractedNotes ? `${notes}\n\nNotes from prescription file:\n${extractedNotes}` : (notes || extractedNotes);
      const followUp = aiRes.follow_up_date || null;
      const aiExplanation = aiRes.explanation || '';
      const aiRaw = aiRes.raw_response || '';
      const aiStatus = aiRes.success ? 'success' : 'fallback';
      const ocrText = aiRes.raw_text || '';

      if (medicines.length === 0) {
        medicines = [{
          name: 'Prescribed Medications (See uploaded scan)',
          dosage: '',
          timing: '',
          duration: '',
          route: 'Oral',
          instructions: ''
        }];
      }

      // 3. Generate warnings
      const patientDob = appt.patient_id.dob;
      const patientChronic = appt.patient_id.chronic_conditions || '';
      const patientAllergies = appt.patient_id.allergies || '';

      const existingMedsDocs = await CarePlanItem.find({ item_type: 'medicine' })
        .populate({
          path: 'care_plan_id',
          match: { patient_id: appt.patient_id._id, is_active: true }
        });
      const existingTitles = existingMedsDocs
        .filter(item => item.care_plan_id !== null)
        .map(item => item.title);

      const cdsWarningsList = generateCdsWarnings(patientDob, patientChronic, patientAllergies, medicines, existingTitles);
      const cdsText = cdsWarningsList.join('\n');

      const rxId = generatePrescriptionId();
      const publicToken = crypto.randomBytes(16).toString('hex');
      const doctor = await Doctor.findById(did);

      // 4. Create Prescription Record
      rx = new Prescription({
        appointment_id: aid,
        doctor_id: did,
        patient_id: appt.patient_id._id,
        family_member_id: appt.family_member_id ? appt.family_member_id._id : null,
        prescription_id: rxId,
        medicines,
        advice: notesMerged,
        diagnosis_notes: diagnosis,
        diagnosis,
        doctor_notes: notesMerged,
        follow_up_date: followUp,
        doctor_signature: doctor.digital_signature || '',
        original_upload_url: originalUrl,
        original_upload_public_id: originalPid,
        ocr_raw_text: ocrText,
        public_token: publicToken,
        cds_warnings: cdsText,
        is_verified: true,
        ai_explanation: aiExplanation,
        ai_explanation_raw: aiRaw,
        ai_status: aiStatus,
        ai_language: preferredLanguage
      });
      await rx.save();

      // 5. Add to health locker
      const hlRecord = new HealthRecord({
        patient_id: appt.patient_id._id,
        family_member_id: appt.family_member_id ? appt.family_member_id._id : null,
        appointment_id: aid,
        doc_type: 'Prescription',
        title: `Prescription ${rx.prescription_id}`,
        description: `${medicines.length} medicines. (AI analyzed upload)`,
        file_path: originalUrl || '',
        doctor_name: doctor.full_name,
        tags: doctor.specialization,
        record_date: new Date().toISOString().split('T')[0]
      });
      await hlRecord.save();

      // 6. Finalize
      const patientData = {
        full_name: appt.patient_id.full_name,
        email: appt.patient_id.email
      };
      await finalizePrescription(rx._id, doctor.toObject(), patientData, appt.toObject());
    }

    // Update total patients count
    const distinctPatients = await Appointment.distinct('patient_id', { doctor_id: did, status: 'completed' });
    await Doctor.findByIdAndUpdate(did, { total_patients: distinctPatients.length });

    res.json({
      ok: true,
      message: rx ? `Appointment completed! Prescription ${rx.prescription_id} created.` : 'Appointment completed successfully.',
      appointment: appt,
      prescription: rx
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: `Error completing appointment: ${error.message}` });
  }
});

// POST /doctor/toggle-availability
router.post('/doctor/toggle-availability', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;

  try {
    const doctor = await Doctor.findById(did);
    if (doctor) {
      doctor.is_available = !doctor.is_available;
      doctor.last_active = new Date();
      await doctor.save();
      res.json({ ok: true, is_available: doctor.is_available, message: `Status set to: ${doctor.is_available ? 'Available' : 'Busy'}` });
    } else {
      res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error updating availability.' });
  }
});

// GET /doctor/analytics
router.get('/doctor/analytics', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;

  try {
    const doctor = await Doctor.findById(did);

    const monthlyRaw = await Appointment.aggregate([
      { $match: { doctor_id: new mongoose.Types.ObjectId(did) } },
      {
        $group: {
          _id: { $substr: ['$appt_date', 0, 7] }, // YYYY-MM
          cnt: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 12 }
    ]);
    const monthly = monthlyRaw.map(m => ({
      month: m._id,
      cnt: m.cnt,
      completed: m.completed
    }));

    const ratingRaw = await Review.aggregate([
      { $match: { doctor_id: new mongoose.Types.ObjectId(did) } },
      { $group: { _id: '$rating', cnt: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const rating_dist = ratingRaw.map(r => ({
      rating: r._id,
      cnt: r.cnt
    }));

    const completed = await Appointment.find({ doctor_id: did, status: 'completed' });
    const total_revenue = completed.reduce((sum, a) => sum + (a.fee || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const [cancelled_appointments, pending_reschedules, scheduled_followups] = await Promise.all([
      Appointment.countDocuments({ doctor_id: did, status: { $in: ['cancelled', 'rejected'] } }),
      Appointment.countDocuments({ doctor_id: did, 'reschedule_request.requested_at': { $exists: true } }),
      Prescription.countDocuments({
        doctor_id: did,
        follow_up_date: { $gte: today, $lte: nextMonth.toISOString().slice(0, 10) }
      })
    ]);

    res.json({
      ok: true,
      doctor,
      monthly,
      rating_dist,
      total_revenue,
      cancelled_appointments,
      pending_reschedules,
      scheduled_followups
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading analytics.' });
  }
});

// GET /doctor/patients
router.get('/doctor/patients', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const q = (req.query.q || '').trim();

  try {
    const doctor = await Doctor.findById(did);

    // Get list of distinct patient IDs
    const patientIds = await Appointment.distinct('patient_id', { doctor_id: did });

    const query = { _id: { $in: patientIds } };
    if (q) {
      const qRegex = new RegExp(q, 'i');
      query.$or = [
        { full_name: qRegex },
        { email: qRegex },
        { phone: qRegex }
      ];
    }

    const patients = await Patient.find(query).sort({ full_name: 1 });

    res.json({
      ok: true,
      doctor,
      patients,
      search: q
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading patients list.' });
  }
});

// GET & POST /doctor/patient/:pid/records
router.get('/doctor/patient/:pid/records', doctorRequired, async (req, res) => {
  const { pid } = req.params;
  const did = req.session.doctor_id;

  try {
    const doctor = await Doctor.findById(did);
    const patient = await Patient.findById(pid);

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Patient not found.' });
    }

    // Security check: verify doctor has consulted this patient
    const relationCount = await Appointment.countDocuments({ doctor_id: did, patient_id: pid });
    if (relationCount === 0) {
      return res.status(403).json({ ok: false, error: 'Access denied. You can only view records of patients who have consulted with you.' });
    }

    const records = await HealthRecord.find({ patient_id: pid }).sort({ record_date: -1, created_at: -1 });
    const family = await FamilyMember.find({ patient_id: pid });

    const DOC_TYPES = [
      'Prescription', 'Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound',
      'Discharge Summary', 'Vaccination Record', 'Lab Report', 'Doctor Notes', 'Other'
    ];

    res.json({
      ok: true,
      doctor,
      patient,
      records,
      family,
      doc_types: DOC_TYPES
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading patient records.' });
  }
});

router.post('/doctor/patient/:pid/records', doctorRequired, recordUpload.single('file'), async (req, res) => {
  const { pid } = req.params;
  const did = req.session.doctor_id;
  const f = req.body;

  try {
    const doctor = await Doctor.findById(did);
    const patient = await Patient.findById(pid);

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Patient not found.' });
    }

    const relationCount = await Appointment.countDocuments({ doctor_id: did, patient_id: pid });
    if (relationCount === 0) {
      return res.status(403).json({ ok: false, error: 'Access denied.' });
    }

    const title = (f.title || '').trim();
    const doc_type = f.doc_type || 'Other';
    const record_date = f.record_date || new Date().toISOString().split('T')[0];
    const description = f.description || '';
    const family_member_id = (f.family_member_id && f.family_member_id.match(/^[0-9a-fA-F]{24}$/)) ? f.family_member_id : null;
    const tags = f.tags || '';
    const doctor_name = (f.doctor_name || '').trim() || doctor.full_name;

    if (!title) {
      return res.status(400).json({ ok: false, error: 'Title is required.' });
    }

    let filePath = '';
    if (req.file) {
      filePath = `/static/uploads/records/${pid}/${req.file.filename}`;
    }

    const hr = new HealthRecord({
      patient_id: pid,
      family_member_id,
      doc_type,
      title,
      description,
      file_path: filePath,
      doctor_name,
      tags,
      record_date
    });
    await hr.save();

    // Notify patient
    const newNotif = new Notification({
      user_id: pid,
      user_type: 'patient',
      title: 'New Medical Record Stored',
      message: `Dr. ${doctor_name} has stored a new medical record: "${title}" in your Smart Health Locker.`,
      link: '/health-locker'
    });
    await newNotif.save();

    res.json({ ok: true, message: 'Medical record uploaded and stored successfully!', record: hr });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error uploading medical record.' });
  }
});

// POST /doctor/patient/:pid/records/delete/:rid
router.post('/doctor/patient/:pid/records/delete/:rid', doctorRequired, async (req, res) => {
  const { pid, rid } = req.params;
  const did = req.session.doctor_id;

  try {
    const relationCount = await Appointment.countDocuments({ doctor_id: did, patient_id: pid });
    if (relationCount === 0) {
      return res.status(403).json({ ok: false, error: 'Access denied.' });
    }

    const record = await HealthRecord.findOneAndDelete({ _id: rid, patient_id: pid });
    if (record && record.file_path) {
      const fullPath = path.join(__dirname, '..', record.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({ ok: true, message: 'Medical record deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error deleting record.' });
  }
});

module.exports = router;
