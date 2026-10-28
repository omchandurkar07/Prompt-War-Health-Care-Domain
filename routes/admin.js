const express = require('express');
const router = express.Router();

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const { adminRequired } = require('../middleware/auth');

// GET /admin or GET /admin/dashboard
router.get(['/admin', '/admin/dashboard'], adminRequired, async (req, res) => {
  try {
    const stats = {
      total_patients: await Patient.countDocuments(),
      total_doctors: await Doctor.countDocuments({ is_approved: true }),
      pending_doctors: await Doctor.countDocuments({ is_approved: false }),
      total_appts: await Appointment.countDocuments(),
      pending_appts: await Appointment.countDocuments({ status: 'pending' })
    };

    const pending_docs = await Doctor.find({ is_approved: false }).sort({ created_at: -1 });

    const recentDocs = await Appointment.find()
      .populate('patient_id')
      .populate('doctor_id')
      .sort({ created_at: -1 })
      .limit(10);

    const recent = recentDocs.map(a => ({
      ...a.toObject(),
      id: a._id,
      pname: a.patient_id ? a.patient_id.full_name : 'Unknown',
      dname: a.doctor_id ? a.doctor_id.full_name : 'Unknown'
    }));

    res.json({
      ok: true,
      stats,
      pending_docs,
      recent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading admin dashboard.' });
  }
});

// POST /admin/doctor/approve/:did
router.post('/admin/doctor/approve/:did', adminRequired, async (req, res) => {
  const { did } = req.params;

  try {
    const doctor = await Doctor.findByIdAndUpdate(did, { is_approved: true });
    if (doctor) {
      const newNotif = new Notification({
        user_id: did,
        user_type: 'doctor',
        title: '✅ Account Approved',
        message: 'Your doctor account has been approved! You can now log in.',
        link: '/doctor/login'
      });
      await newNotif.save();
      res.json({ ok: true, message: 'Doctor approved!' });
    } else {
      res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error approving doctor.' });
  }
});

// POST /admin/doctor/reject/:did
router.post('/admin/doctor/reject/:did', adminRequired, async (req, res) => {
  const { did } = req.params;

  try {
    const doc = await Doctor.findOneAndDelete({ _id: did, is_approved: false });
    if (doc) {
      res.json({ ok: true, message: 'Doctor registration rejected.' });
    } else {
      res.status(404).json({ ok: false, error: 'Doctor not found or already approved.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error rejecting doctor.' });
  }
});

// GET /admin/doctors
router.get('/admin/doctors', adminRequired, async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ is_approved: 1, created_at: -1 });
    res.json({ ok: true, doctors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading doctors list.' });
  }
});

// POST /admin/doctor/remove/:did
router.post('/admin/doctor/remove/:did', adminRequired, async (req, res) => {
  const { did } = req.params;

  try {
    const doc = await Doctor.findByIdAndDelete(did);
    if (doc) {
      res.json({ ok: true, message: 'Doctor removed.' });
    } else {
      res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error removing doctor.' });
  }
});

// GET /admin/patients
router.get('/admin/patients', adminRequired, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ created_at: -1 });
    const patientsWithCounts = await Promise.all(
      patients.map(async p => {
        const count = await Appointment.countDocuments({ patient_id: p._id });
        return {
          ...p.toObject(),
          id: p._id,
          appt_count: count
        };
      })
    );

    res.json({ ok: true, patients: patientsWithCounts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading patients list.' });
  }
});

// GET /admin/appointments
router.get('/admin/appointments', adminRequired, async (req, res) => {
  try {
    const appts = await Appointment.find()
      .populate('patient_id')
      .populate('doctor_id')
      .sort({ created_at: -1 });

    const appointments = appts.map(a => ({
      ...a.toObject(),
      id: a._id,
      pname: a.patient_id ? a.patient_id.full_name : 'Unknown',
      dname: a.doctor_id ? a.doctor_id.full_name : 'Unknown',
      specialization: a.doctor_id ? a.doctor_id.specialization : ''
    }));

    res.json({ ok: true, appointments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading appointments list.' });
  }
});

module.exports = router;
