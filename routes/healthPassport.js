const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');

const Patient = require('../models/Patient');
const FamilyMember = require('../models/FamilyMember');
const HealthPassport = require('../models/HealthPassport');
const HealthRecord = require('../models/HealthRecord');
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const PatientAllergy = require('../models/PatientAllergy');
const VaccinationLog = require('../models/VaccinationLog');
const { patientRequired } = require('../middleware/auth');

// GET /health-passport
router.get('/health-passport', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;

  try {
    const patient = await Patient.findById(pid);
    const family = await FamilyMember.find({ patient_id: pid });
    const passports = await HealthPassport.find({ patient_id: pid }).sort({ created_at: -1 });

    res.json({
      ok: true,
      patient,
      family,
      passports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading health passport summary.' });
  }
});

// POST /health-passport/generate
router.post('/health-passport/generate', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { family_member_id, date_range, pin, pin_confirm } = req.body;
  let sections = req.body.sections || [];

  if (!Array.isArray(sections)) {
    sections = [sections];
  }

  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ ok: false, error: 'PIN must be exactly 4 digits.' });
  }

  if (pin !== pin_confirm) {
    return res.status(400).json({ ok: false, error: 'PINs do not match.' });
  }

  if (sections.length === 0) {
    sections = ['conditions', 'medications', 'allergies', 'lab_results', 'vaccinations', 'blood_group'];
  }

  try {
    const token = crypto.randomBytes(16).toString('hex');
    const pin_hash = crypto.createHash('sha256').update(pin).digest('hex');

    let personName = '';
    const fmid = family_member_id || null;

    if (fmid) {
      const person = await FamilyMember.findOne({ _id: fmid, patient_id: pid });
      personName = person ? person.name : 'Unknown';
    } else {
      const person = await Patient.findById(pid);
      personName = person ? person.full_name : 'Patient';
    }

    const passport = new HealthPassport({
      patient_id: pid,
      family_member_id: fmid,
      passport_token: token,
      pin_hash,
      sections,
      date_range: date_range || 'all'
    });
    await passport.save();

    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-save to Health Locker
    const hr = new HealthRecord({
      patient_id: pid,
      family_member_id: fmid,
      doc_type: 'Health Passport',
      title: `Health Passport — ${todayStr}`,
      description: `Generated for ${personName}. Sections: ${sections.join(', ')}.`,
      file_path: `/verify-passport/${token}`,
      tags: 'passport,summary',
      record_date: todayStr
    });
    await hr.save();

    res.json({ ok: true, message: `Health Passport generated!`, token, passport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error generating health passport.' });
  }
});

// GET & POST /verify-passport/:token
router.get('/verify-passport/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const passport = await HealthPassport.findOne({ passport_token: token });
    if (!passport) {
      return res.status(404).json({ ok: false, error: 'Passport not found.' });
    }

    res.json({
      ok: true,
      passport_token: token,
      needs_pin: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

router.post('/verify-passport/:token', async (req, res) => {
  const { token } = req.params;
  const { pin } = req.body;

  try {
    const passport = await HealthPassport.findOne({ passport_token: token });
    if (!passport) {
      return res.status(404).json({ ok: false, error: 'Passport not found.' });
    }

    const pin_hash = crypto.createHash('sha256').update(pin || '').digest('hex');
    if (pin_hash !== passport.pin_hash) {
      return res.status(401).json({
        ok: false,
        error: 'Incorrect PIN. Please try again.',
        needs_pin: true
      });
    }

    // PIN correct — gather passport details
    const pid = passport.patient_id;
    const fmid = passport.family_member_id;
    const sections = passport.sections || [];
    const date_range = passport.date_range;

    const data = {};

    let person = null;
    if (fmid) {
      person = await FamilyMember.findById(fmid);
      data.name = person ? person.name : 'Unknown';
      data.dob = person ? person.dob : '';
      data.gender = person ? person.gender : '';
      data.blood_group = person ? person.blood_group : '';
    } else {
      person = await Patient.findById(pid);
      data.name = person ? person.full_name : 'Patient';
      data.dob = person ? person.dob : '';
      data.gender = person ? person.gender : '';
      data.blood_group = person ? person.blood_group : '';
      data.emergency_contact = person ? person.emergency_contact : '';
    }

    if (sections.includes('conditions')) {
      data.conditions = person ? person.chronic_conditions : '';
    }

    if (sections.includes('medications')) {
      const todayStr = new Date().toISOString().split('T')[0];
      const activePlans = await CarePlan.find({
        patient_id: pid,
        is_active: true,
        end_date: { $gte: todayStr }
      }).populate('doctor_id');

      const planIds = activePlans.map(cp => cp._id);
      const meds = await CarePlanItem.find({
        care_plan_id: { $in: planIds },
        item_type: 'medicine'
      });

      data.medications = meds.map(m => {
        const cp = activePlans.find(p => p._id.toString() === m.care_plan_id.toString());
        const docName = cp && cp.doctor_id ? cp.doctor_id.full_name : 'Unknown Doctor';
        return {
          name: m.title,
          doctor: docName
        };
      });
    }

    if (sections.includes('allergies')) {
      let allergies = [];
      if (fmid) {
        allergies = await PatientAllergy.find({ family_member_id: fmid });
      } else {
        allergies = await PatientAllergy.find({ patient_id: pid, family_member_id: null });
      }
      data.allergies = allergies.map(a => ({
        name: a.allergy_name,
        severity: a.severity
      }));
    }

    if (sections.includes('lab_results')) {
      const labQuery = {
        patient_id: pid,
        doc_type: { $in: ['Lab Report', 'Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'Lab Result', 'Test Report'] }
      };

      if (fmid) {
        labQuery.family_member_id = fmid;
      } else {
        labQuery.family_member_id = null;
      }

      if (date_range && date_range !== 'all') {
        const months = parseInt(date_range);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - months * 30);
        labQuery.record_date = { $gte: cutoff.toISOString().split('T')[0] };
      }

      const labs = await HealthRecord.find(labQuery).sort({ record_date: -1 }).limit(5);
      data.lab_results = labs.map(l => ({
        title: l.title,
        description: l.description,
        record_date: l.record_date,
        doctor_name: l.doctor_name
      }));
    }

    if (sections.includes('vaccinations') && fmid) {
      const vacc = await VaccinationLog.find({ family_member_id: fmid, status: 'completed' });
      data.vaccinations = vacc.map(v => ({
        vaccine_name: v.vaccine_name,
        status: v.status,
        completed_date: v.completed_date
      }));
    }

    res.json({
      ok: true,
      passport,
      data,
      token,
      verified: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

// GET /health-passport/qr/:token
router.get('/health-passport/qr/:token', async (req, res) => {
  const { token } = req.params;
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify-passport/${token}`;

  try {
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 250, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'QR generation error.' });
  }
});

module.exports = router;
