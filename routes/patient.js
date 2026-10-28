const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const AdherenceLog = require('../models/AdherenceLog');
const MedicineReminder = require('../models/MedicineReminder');
const Prescription = require('../models/Prescription');

const { patientRequired } = require('../middleware/auth');
const { sendAppointmentBookingEmail } = require('../services/emailService');

// Multer storage for patient profile uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../static/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `patient_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

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

// Helper to calculate distance in km using Haversine formula
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ==================== PATIENT DASHBOARD ====================
router.get('/dashboard', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const upcoming = await Appointment.find({
      patient_id: pid,
      appt_date: { $gte: todayStr },
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('doctor_id')
      .sort({ appt_date: 1, time_slot: 1 })
      .limit(5);

    const past = await Appointment.find({
      patient_id: pid,
      $or: [
        { status: { $in: ['completed', 'cancelled', 'rejected'] } },
        { appt_date: { $lt: todayStr } }
      ]
    })
      .populate('doctor_id')
      .sort({ appt_date: -1 })
      .limit(10);

    const stats = {
      total: await Appointment.countDocuments({ patient_id: pid }),
      confirmed: await Appointment.countDocuments({ patient_id: pid, status: 'confirmed' }),
      pending: await Appointment.countDocuments({ patient_id: pid, status: 'pending' })
    };

    const reviews = await Review.find({ patient_id: pid });
    const reviewed_appt_ids = reviews.map(r => r.appointment_id.toString());

    const patient = await Patient.findById(pid);

    // Mini checklist care plan widget
    const activePlans = await CarePlan.find({
      patient_id: pid,
      is_active: true,
      end_date: { $gte: todayStr }
    });
    const planIds = activePlans.map(cp => cp._id);

    let checklist_items = [];
    const checklist_done = {};

    if (planIds.length > 0) {
      checklist_items = await CarePlanItem.find({
        care_plan_id: { $in: planIds },
        item_type: { $ne: 'followup' }
      }).limit(4);

      // Sort by time of day manually
      const todWeights = { morning: 1, afternoon: 2, evening: 3, night: 4 };
      checklist_items.sort((a, b) => {
        const wA = todWeights[a.time_of_day] || 5;
        const wB = todWeights[b.time_of_day] || 5;
        return wA - wB;
      });

      if (checklist_items.length > 0) {
        const itemIds = checklist_items.map(it => it._id);
        const logs = await AdherenceLog.find({
          care_plan_item_id: { $in: itemIds },
          log_date: todayStr
        });
        logs.forEach(log => {
          checklist_done[log.care_plan_item_id.toString()] = log.is_done;
        });
      }
    }

    const prescriptionsDocs = await Prescription.find({ patient_id: pid })
      .populate('doctor_id')
      .sort({ created_at: -1 })
      .limit(6);

    const prescriptions = prescriptionsDocs.map(rx => ({
      ...rx.toObject(),
      id: rx._id,
      dname: rx.doctor_id ? rx.doctor_id.full_name : 'Doctor',
      profile_image: rx.doctor_id ? rx.doctor_id.profile_image : '/static/images/default_doctor.svg'
    }));

    const medicine_reminders = await MedicineReminder.find({ patient_id: pid })
      .sort({ is_active: -1, next_trigger_at: 1 })
      .limit(6);

    stats.prescriptions = await Prescription.countDocuments({ patient_id: pid });

    res.json({
      ok: true,
      upcoming,
      past,
      stats,
      patient,
      reviewed_appt_ids,
      checklist_items,
      checklist_done,
      today_str: todayStr,
      prescriptions,
      medicine_reminders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading dashboard.' });
  }
});

// GET & POST /profile
router.get('/profile', patientRequired, async (req, res) => {
  try {
    const patient = await Patient.findById(req.session.patient_id);
    res.json({ ok: true, patient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading profile.' });
  }
});

router.post('/profile', patientRequired, upload.single('profile_image'), async (req, res) => {
  const pid = req.session.patient_id;
  const { full_name, phone, dob, gender, blood_group, address, emergency_contact } = req.body;

  try {
    const updateData = {
      full_name: full_name.trim(),
      phone: (phone || '').trim(),
      dob,
      gender,
      blood_group,
      address,
      emergency_contact
    };

    if (req.file) {
      updateData.profile_image = `/static/uploads/${req.file.filename}`;
    }

    const updatedPatient = await Patient.findByIdAndUpdate(pid, updateData, { new: true });
    req.session.patient_name = full_name.trim();

    res.json({ ok: true, message: 'Profile updated!', patient: updatedPatient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error updating profile.' });
  }
});

// GET /appointments
router.get('/appointments', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const tab = req.query.tab || 'upcoming';
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    let appointments = [];
    if (tab === 'past') {
      appointments = await Appointment.find({
        patient_id: pid,
        $or: [
          { status: { $in: ['completed', 'cancelled', 'rejected'] } },
          { appt_date: { $lt: todayStr } }
        ]
      })
        .populate('doctor_id')
        .sort({ appt_date: -1 });
    } else {
      appointments = await Appointment.find({
        patient_id: pid,
        appt_date: { $gte: todayStr },
        status: { $in: ['pending', 'confirmed'] }
      })
        .populate('doctor_id')
        .sort({ appt_date: 1, time_slot: 1 });
    }

    const reviews = await Review.find({ patient_id: pid });
    const reviewed = reviews.map(r => r.appointment_id.toString());

    res.json({
      ok: true,
      appointments,
      tab,
      reviewed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading appointments.' });
  }
});

// ==================== DOCTOR SEARCH & LISTING ====================
router.get('/doctors', async (req, res) => {
  const spec = req.query.spec || '';
  const q = req.query.q || '';
  const min_exp = parseInt(req.query.min_exp) || 0;
  const max_fee = parseInt(req.query.max_fee) || 0;
  const min_rating = parseFloat(req.query.min_rating) || 0.0;
  const available_only = req.query.available === '1';
  const home_visit_only = req.query.home_visit === '1';

  const user_lat = req.query.user_lat ? parseFloat(req.query.user_lat) : null;
  const user_lng = req.query.user_lng ? parseFloat(req.query.user_lng) : null;
  const radius = req.query.radius ? parseFloat(req.query.radius) : 10;

  try {
    const filter = { is_approved: true };
    if (spec) {
      filter.specialization = spec;
    }
    if (q) {
      const qRegex = new RegExp(q, 'i');
      filter.$or = [
        { full_name: qRegex },
        { specialization: qRegex },
        { hospital_name: qRegex },
        { city: qRegex }
      ];
    }
    if (min_exp) {
      filter.experience_years = { $gte: min_exp };
    }
    if (max_fee) {
      filter.consultation_fee = { $lte: max_fee };
    }
    if (min_rating) {
      filter.rating_avg = { $gte: min_rating };
    }
    if (available_only) {
      filter.is_available = true;
    }
    if (home_visit_only) {
      filter.home_visit_available = true;
    }

    let doctors = await Doctor.find(filter).sort({ rating_avg: -1, rating_count: -1 });

    let has_location = false;
    let filtered_docs = [];

    if (user_lat !== null && user_lng !== null && !isNaN(user_lat) && !isNaN(user_lng)) {
      has_location = true;
      doctors.forEach(d => {
        if (d.latitude !== undefined && d.longitude !== undefined && d.latitude !== null && d.longitude !== null) {
          const dist = getDistance(user_lat, user_lng, d.latitude, d.longitude);
          if (dist <= radius) {
            const docObj = d.toObject();
            docObj.distance = Math.round(dist * 100) / 100;
            filtered_docs.push(docObj);
          }
        } else {
          // Keep doctor if coordinates missing but listed (default range matches)
          filtered_docs.push(d.toObject());
        }
      });
      // Sort by distance
      filtered_docs.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
    } else {
      filtered_docs = doctors.map(d => d.toObject());
    }

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
      if (doc.home_visit_available) {
        badges.push({ label: 'Home Visits', icon: '🏠', color: 'emerald' });
      }
      return badges;
    };

    const doctors_data = filtered_docs.map(doc => ({
      doc,
      badges: getDoctorBadges(doc)
    }));

    const specs = await Doctor.distinct('specialization', { is_approved: true });
    specs.sort();

    const SPECIALIZATIONS = [
      'Cardiologist', 'Neurologist', 'General Physician', 'Dermatologist', 'Dentist',
      'Orthopedic Surgeon', 'Ophthalmologist', 'ENT Specialist', 'Pediatrician',
      'Gynecologist', 'Psychiatrist', 'Gastroenterologist', 'Pulmonologist',
      'Endocrinologist', 'Urologist', 'Nephrologist', 'Oncologist', 'General Surgeon',
      'Rheumatologist'
    ];

    res.json({
      ok: true,
      doctors_data,
      specs,
      selected_spec: spec,
      search: q,
      specializations: SPECIALIZATIONS,
      user_lat,
      user_lng,
      radius,
      has_location
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error finding doctors.' });
  }
});

// GET /doctor/:did
router.get('/doctor/:did', async (req, res) => {
  const { did } = req.params;

  try {
    if (!did.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    const doctor = await Doctor.findOne({ _id: did, is_approved: true });
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    const reviews = await Review.find({ doctor_id: did })
      .populate('patient_id')
      .sort({ created_at: -1 })
      .limit(10);

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

    const badges = getDoctorBadges(doctor);

    res.json({
      ok: true,
      doctor,
      reviews,
      badges
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading doctor details.' });
  }
});

// GET & POST /book/:did
router.get('/book/:did', patientRequired, async (req, res) => {
  const { did } = req.params;

  try {
    if (!did.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    const doctor = await Doctor.findOne({ _id: did, is_approved: true });
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    res.json({ ok: true, doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading doctor booking info.' });
  }
});

router.post('/book/:did', patientRequired, async (req, res) => {
  const { did } = req.params;
  const { appt_date, time_slot, reason, appt_type } = req.body;

  try {
    const doctor = await Doctor.findOne({ _id: did, is_approved: true });
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    if (!appt_date || !time_slot) {
      return res.json({ ok: false, error: 'Please select date and time.' });
    }

    const clash = await Appointment.findOne({
      doctor_id: did,
      appt_date,
      time_slot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (clash) {
      return res.json({ ok: false, error: 'Slot already booked. Choose another.' });
    }

    if (appt_type === 'home_visit' && !doctor.home_visit_available) {
      return res.json({ ok: false, error: 'This doctor does not offer home visits.' });
    }

    const homeFee = appt_type === 'home_visit'
      ? ((typeof doctor.home_visit_fee === 'number' && doctor.home_visit_fee > 0)
          ? doctor.home_visit_fee
          : doctor.consultation_fee + 300)
      : doctor.consultation_fee;

    const appt = new Appointment({
      patient_id: req.session.patient_id,
      doctor_id: did,
      appt_date,
      time_slot,
      appt_type: appt_type || 'normal',
      home_address: req.body.home_address || '',
      reason: reason || '',
      fee: homeFee,
      status: 'pending'
    });
    await appt.save();

    const pname = req.session.patient_name || 'A patient';
    const newNotif = new Notification({
      user_id: did,
      user_type: 'doctor',
      title: `${appt_type === 'emergency' ? '🚨 Emergency' : '📅 New'} Appointment Request`,
      message: `${pname} requested an appointment on ${appt_date} at ${time_slot}.`,
      link: '/doctor/appointments'
    });
    await newNotif.save();

    await checkAndAutoDisableDoctorAvailability(did, appt_date);

    const patient = await Patient.findById(req.session.patient_id);
    if (patient && patient.email) {
      await sendAppointmentBookingEmail(patient.email, doctor.full_name, appt_date, time_slot);
    }

    res.json({ ok: true, message: 'Appointment booked! Waiting for doctor confirmation.', appointment_id: appt._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error booking appointment.' });
  }
});

// GET /appointment/confirmation/:aid
router.get('/appointment/confirmation/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;

  try {
    if (!aid.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const appt = await Appointment.findOne({ _id: aid, patient_id: pid }).populate('doctor_id');
    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const apptData = {
      ...appt.toObject(),
      id: appt._id,
      dname: appt.doctor_id ? appt.doctor_id.full_name : 'Unknown Doctor',
      specialization: appt.doctor_id ? appt.doctor_id.specialization : '',
      profile_image: appt.doctor_id ? appt.doctor_id.profile_image : '/static/images/default_doctor.svg',
      hospital_name: appt.doctor_id ? appt.doctor_id.hospital_name : '',
      clinic_address: appt.doctor_id ? appt.doctor_id.clinic_address : ''
    };

    res.json({ ok: true, appt: apptData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading confirmation page.' });
  }
});

// GET /booked-slots
router.get('/booked-slots', async (req, res) => {
  const { doctor_id, date } = req.query;
  if (!doctor_id || !date) {
    return res.json([]);
  }

  try {
    const appointments = await Appointment.find({
      doctor_id,
      appt_date: date,
      status: { $in: ['pending', 'confirmed'] }
    });
    res.json(appointments.map(a => a.time_slot));
  } catch (error) {
    console.error(error);
    res.json([]);
  }
});

// GET /doctor-info/:did
router.get('/doctor-info/:did', async (req, res) => {
  const { did } = req.params;

  try {
    if (!did.match(/^[0-9a-fA-F]{24}$/)) {
      return res.json({});
    }

    const d = await Doctor.findById(did);
    if (!d) return res.json({});

    const slots = generateSlots(d.slot_start, d.slot_end, d.slot_duration, d.break_start, d.break_end);
    res.json({
      slots: slots.join(','),
      available_days: d.available_days,
      fee: d.consultation_fee,
      name: d.full_name,
      slot_start: d.slot_start,
      slot_end: d.slot_end,
      slot_duration: d.slot_duration,
      break_start: d.break_start,
      break_end: d.break_end
    });
  } catch (error) {
    console.error(error);
    res.json({});
  }
});

// GET & POST /review/:aid
router.get('/review/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;

  try {
    const appt = await Appointment.findOne({ _id: aid, patient_id: pid, status: 'completed' }).populate('doctor_id');
    if (!appt) {
      return res.status(400).json({ ok: false, error: 'Cannot review this appointment.' });
    }

    const existing = await Review.findOne({ appointment_id: aid });
    if (existing) {
      return res.json({ ok: false, error: 'Already reviewed.' });
    }

    res.json({
      ok: true,
      appt: {
        ...appt.toObject(),
        id: appt._id,
        dname: appt.doctor_id ? appt.doctor_id.full_name : 'Doctor',
        specialization: appt.doctor_id ? appt.doctor_id.specialization : '',
        profile_image: appt.doctor_id ? appt.doctor_id.profile_image : '/static/images/default_doctor.svg'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading review page.' });
  }
});

router.post('/review/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;
  const { rating, comment } = req.body;

  try {
    const appt = await Appointment.findOne({ _id: aid, patient_id: pid, status: 'completed' });
    if (!appt) {
      return res.status(400).json({ ok: false, error: 'Cannot review this appointment.' });
    }

    const existing = await Review.findOne({ appointment_id: aid });
    if (existing) {
      return res.json({ ok: false, error: 'Already reviewed.' });
    }

    const newReview = new Review({
      patient_id: pid,
      doctor_id: appt.doctor_id,
      appointment_id: aid,
      rating: parseInt(rating) || 5,
      comment: comment || ''
    });
    await newReview.save();

    // Update doctor averages
    const reviews = await Review.find({ doctor_id: appt.doctor_id });
    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
    await Doctor.findByIdAndUpdate(appt.doctor_id, { rating_avg: avg, rating_count: count });

    const newNotif = new Notification({
      user_id: appt.doctor_id,
      user_type: 'doctor',
      title: '✔ New Review',
      message: `A patient rated you ${rating}/5.`,
      link: '/doctor/dashboard'
    });
    await newNotif.save();

    res.json({ ok: true, message: 'Review submitted! Thank you.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error submitting review.' });
  }
});

// ==================== MEDICINE REMINDERS & NOTIFICATION APIS ====================
router.post('/reminder/toggle', patientRequired, async (req, res) => {
  const { reminder_id } = req.body;
  const pid = req.session.patient_id;

  try {
    const reminder = await MedicineReminder.findOne({ _id: reminder_id, patient_id: pid });
    if (!reminder) {
      return res.json({ ok: false, error: 'Reminder not found' });
    }

    reminder.is_active = !reminder.is_active;
    await reminder.save();

    res.json({ ok: true, is_active: reminder.is_active ? 1 : 0 });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.post('/reminder/delete/:rid', patientRequired, async (req, res) => {
  const { rid } = req.params;
  const pid = req.session.patient_id;

  try {
    await MedicineReminder.findOneAndDelete({ _id: rid, patient_id: pid });
    res.json({ ok: true });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.post('/reminder/add', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { medicine_name, remind_time, frequency } = req.body;

  if (!medicine_name) {
    return res.json({ ok: false, error: 'Medicine name is required.' });
  }

  try {
    const freq = (frequency || 'DAILY').toUpperCase();
    const timeVal = remind_time || '09:00';
    const now = new Date();
    const parts = timeVal.split(':');
    const hours = parseInt(parts[0]) || 9;
    const minutes = parseInt(parts[1]) || 0;

    const nextTrigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    if (nextTrigger <= now) {
      nextTrigger.setDate(nextTrigger.getDate() + 1);
    }

    const newReminder = new MedicineReminder({
      prescription_db_id: null,
      prescription_id: 'CUSTOM',
      patient_id: pid,
      medicine_name: medicine_name.trim(),
      remind_time: timeVal,
      frequency: freq,
      next_trigger_at: nextTrigger.toISOString(),
      is_active: true
    });
    await newReminder.save();

    res.json({ ok: true });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.get('/search-suggestions', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json([]);
  }

  try {
    const qRegex = new RegExp(q, 'i');
    const doctors = await Doctor.find({
      is_approved: true,
      $or: [{ full_name: qRegex }, { specialization: qRegex }]
    }).limit(8);

    const suggestions = doctors.map(d => ({
      id: d._id,
      full_name: d.full_name,
      specialization: d.specialization,
      hospital_name: d.hospital_name || ''
    }));

    res.json(suggestions);
  } catch (error) {
    console.error(error);
    res.json([]);
  }
});

// Notifications
router.get('/notifications', async (req, res) => {
  let uid, utype;
  if (req.session.doctor_id) {
    uid = req.session.doctor_id;
    utype = 'doctor';
  } else if (req.session.patient_id) {
    uid = req.session.patient_id;
    utype = 'patient';
  } else {
    return res.json({ notifications: [], unread_count: 0 });
  }

  try {
    const notifications = await Notification.find({ user_id: uid, user_type: utype })
      .sort({ created_at: -1 })
      .limit(20);
    const unread = await Notification.countDocuments({ user_id: uid, user_type: utype, is_read: false });

    res.json({
      notifications: notifications.map(n => ({
        id: n._id,
        title: n.title,
        message: n.message,
        link: n.link,
        is_read: n.is_read ? 1 : 0,
        created_at: n.created_at
      })),
      unread_count: unread
    });
  } catch (error) {
    console.error(error);
    res.json({ notifications: [], unread_count: 0 });
  }
});

router.post('/notification/:nid/read', async (req, res) => {
  const { nid } = req.params;

  try {
    await Notification.findByIdAndUpdate(nid, { is_read: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/notifications/read-all', async (req, res) => {
  let uid, utype;
  if (req.session.doctor_id) {
    uid = req.session.doctor_id;
    utype = 'doctor';
  } else if (req.session.patient_id) {
    uid = req.session.patient_id;
    utype = 'patient';
  } else {
    return res.json({ ok: false });
  }

  try {
    await Notification.updateMany({ user_id: uid, user_type: utype }, { is_read: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/notification/:nid', async (req, res) => {
  const { nid } = req.params;

  try {
    await Notification.findByIdAndDelete(nid);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/notifications/clear-all', async (req, res) => {
  let uid, utype;
  if (req.session.doctor_id) {
    uid = req.session.doctor_id;
    utype = 'doctor';
  } else if (req.session.patient_id) {
    uid = req.session.patient_id;
    utype = 'patient';
  } else {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    await Notification.deleteMany({ user_id: uid, user_type: utype });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
