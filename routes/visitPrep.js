const express = require('express');
const router = express.Router();

const Appointment = require('../models/Appointment');
const VisitPrepSheet = require('../models/VisitPrepSheet');
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const HealthRecord = require('../models/HealthRecord');
const Notification = require('../models/Notification');
const PatientAllergy = require('../models/PatientAllergy');
const { patientRequired, doctorRequired } = require('../middleware/auth');

// Helper to normalize input arrays from form-urlencoded data
const toArray = (val) => {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

// GET & POST /visit-prep/:aid
router.get('/visit-prep/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const appt = await Appointment.findOne({
      _id: aid,
      patient_id: pid,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('doctor_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found or already completed.' });
    }

    const existing = await VisitPrepSheet.findOne({ appointment_id: aid });

    // Auto-pull medications from active care plans
    const activePlans = await CarePlan.find({
      patient_id: pid,
      is_active: true,
      end_date: { $gte: today }
    });
    const planIds = activePlans.map(cp => cp._id);
    const activeMeds = await CarePlanItem.find({
      care_plan_id: { $in: planIds },
      item_type: 'medicine'
    });

    const auto_meds = activeMeds.map(m => ({
      name: m.title,
      details: m.details
    }));

    const existing_meds = existing && existing.current_medications
      ? (typeof existing.current_medications === 'string'
        ? JSON.parse(existing.current_medications)
        : existing.current_medications)
      : [];

    res.json({
      ok: true,
      appt: {
        ...appt.toObject(),
        id: appt._id,
        dname: appt.doctor_id ? appt.doctor_id.full_name : 'Unknown Doctor',
        specialization: appt.doctor_id ? appt.doctor_id.specialization : ''
      },
      existing,
      auto_meds,
      existing_meds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading visit prep form.' });
  }
});

router.post('/visit-prep/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;
  const f = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const appt = await Appointment.findOne({
      _id: aid,
      patient_id: pid,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('doctor_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const chief = (f.chief_complaint || '').trim();
    const duration = f.duration || '';
    const severity = parseInt(f.severity) || 0;
    const better_worse = f.better_worse || '';
    const medsRaw = toArray(f.med_name || f['med_name[]']);
    const meds = medsRaw.map(m => m.trim()).filter(Boolean);
    const temp = f.temperature || '';
    const bp_sys = f.bp_systolic || '';
    const bp_dia = f.bp_diastolic || '';
    const sugar = f.blood_sugar || '';
    const notes = f.additional_notes || '';

    let sheet = await VisitPrepSheet.findOne({ appointment_id: aid });

    if (sheet) {
      sheet.chief_complaint = chief;
      sheet.duration = duration;
      sheet.severity = severity;
      sheet.better_worse = better_worse;
      sheet.current_medications = meds;
      sheet.temperature = temp;
      sheet.bp_systolic = bp_sys;
      sheet.bp_diastolic = bp_dia;
      sheet.blood_sugar = sugar;
      sheet.additional_notes = notes;
      await sheet.save();
    } else {
      sheet = new VisitPrepSheet({
        appointment_id: aid,
        patient_id: pid,
        chief_complaint: chief,
        duration,
        severity,
        better_worse,
        current_medications: meds,
        temperature: temp,
        bp_systolic: bp_sys,
        bp_diastolic: bp_dia,
        blood_sugar: sugar,
        additional_notes: notes
      });
      await sheet.save();
    }

    // Save as health record
    const existingHr = await HealthRecord.findOne({
      patient_id: pid,
      appointment_id: aid,
      doc_type: 'Doctor Notes'
    });

    const docName = appt.doctor_id ? appt.doctor_id.full_name : 'Doctor';
    const spec = appt.doctor_id ? appt.doctor_id.specialization : '';

    if (!existingHr) {
      const hr = new HealthRecord({
        patient_id: pid,
        appointment_id: aid,
        doc_type: 'Doctor Notes',
        title: `Visit Prep - ${docName}`,
        description: `Chief Complaint: ${chief.slice(0, 100)}`,
        doctor_name: docName,
        tags: spec,
        record_date: today
      });
      await hr.save();
    }

    // Notify doctor
    if (appt.doctor_id) {
      const newNotif = new Notification({
        user_id: appt.doctor_id._id,
        user_type: 'doctor',
        title: '📝 Visit Prep Submitted',
        message: `Patient has submitted a prep sheet for appointment on ${appt.appt_date}.`,
        link: `/doctor/prep-sheet/${aid}`
      });
      await newNotif.save();
    }

    res.json({ ok: true, message: 'Visit Prep Sheet submitted! Your doctor will review it before the consultation.', prep: sheet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error submitting visit prep sheet.' });
  }
});

// GET /doctor/prep-sheet/:aid
router.get('/doctor/prep-sheet/:aid', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;

  try {
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did })
      .populate('patient_id')
      .populate('family_member_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const prep = await VisitPrepSheet.findOne({ appointment_id: aid });

    // Get patient allergies
    const allergies = await PatientAllergy.find({ patient_id: appt.patient_id._id });

    const meds = prep && prep.current_medications
      ? (typeof prep.current_medications === 'string'
        ? JSON.parse(prep.current_medications)
        : prep.current_medications)
      : [];

    const apptData = {
      ...appt.toObject(),
      id: appt._id,
      pname: appt.patient_id ? appt.patient_id.full_name : 'Unknown',
      dob: appt.patient_id ? appt.patient_id.dob : '',
      gender: appt.patient_id ? appt.patient_id.gender : '',
      blood_group: appt.patient_id ? appt.patient_id.blood_group : '',
      chronic_conditions: appt.patient_id ? appt.patient_id.chronic_conditions : '',
      allergies: appt.patient_id ? appt.patient_id.allergies : '',
      pphone: appt.patient_id ? appt.patient_id.phone : '',
      fm_name: appt.family_member_id ? appt.family_member_id.name : null
    };

    res.json({
      ok: true,
      appt: apptData,
      prep,
      meds,
      allergies
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading prep sheet view.' });
  }
});

module.exports = router;
