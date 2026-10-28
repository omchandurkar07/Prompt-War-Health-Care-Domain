const express = require('express');
const router = express.Router();
const FamilyMember = require('../models/FamilyMember');
const Appointment = require('../models/Appointment');
const VaccinationLog = require('../models/VaccinationLog');
const { patientRequired } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Static vaccination schedule from models.py
const VACCINATION_SCHEDULE = [
  { vaccine: 'BCG', age: 'At birth', age_months: 0 },
  { vaccine: 'OPV-0', age: 'At birth', age_months: 0 },
  { vaccine: 'Hepatitis B-1', age: 'At birth', age_months: 0 },
  { vaccine: 'OPV-1 + DPT-1', age: '6 weeks', age_months: 1.5 },
  { vaccine: 'Hepatitis B-2', age: '6 weeks', age_months: 1.5 },
  { vaccine: 'Rotavirus-1', age: '6 weeks', age_months: 1.5 },
  { vaccine: 'OPV-2 + DPT-2', age: '10 weeks', age_months: 2.5 },
  { vaccine: 'Rotavirus-2', age: '10 weeks', age_months: 2.5 },
  { vaccine: 'OPV-3 + DPT-3', age: '14 weeks', age_months: 3.5 },
  { vaccine: 'Rotavirus-3', age: '14 weeks', age_months: 3.5 },
  { vaccine: 'Hepatitis B-3', age: '14 weeks', age_months: 3.5 },
  { vaccine: 'IPV', age: '14 weeks', age_months: 3.5 },
  { vaccine: 'Measles-1 / MMR-1', age: '9 months', age_months: 9 },
  { vaccine: 'Vitamin A (1st dose)', age: '9 months', age_months: 9 },
  { vaccine: 'DPT Booster-1', age: '16-18 months', age_months: 16 },
  { vaccine: 'MMR-2', age: '16-18 months', age_months: 16 },
  { vaccine: 'OPV Booster', age: '16-18 months', age_months: 16 },
  { vaccine: 'DPT Booster-2', age: '5-6 years', age_months: 60 },
  { vaccine: 'Td (Tetanus)', age: '10 years', age_months: 120 },
  { vaccine: 'HPV (Girls)', age: '9-14 years', age_months: 108 },
];

const familyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../static/uploads/family');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const pid = req.session.patient_id;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${pid}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage: familyStorage });

const calcAgeMonths = (dobStr) => {
  try {
    if (!dobStr) return 0;
    const dob = new Date(dobStr);
    const today = new Date();
    const months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
    return Math.max(0, months);
  } catch (e) {
    return 0;
  }
};

const calcAgeYears = (dobStr) => {
  try {
    if (!dobStr) return 0;
    const dob = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return Math.max(0, age);
  } catch (e) {
    return 0;
  }
};

router.get('/family', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const members = await FamilyMember.find({ patient_id: pid }).sort({ created_at: 1 });
    
    // Fetch upcoming appointments per family member
    const enriched = await Promise.all(
      members.map(async (m) => {
        const apptsDocs = await Appointment.find({
          patient_id: pid,
          family_member_id: m._id,
          appt_date: { $gte: today },
          status: { $in: ['pending', 'confirmed'] }
        }).populate('doctor_id').sort({ appt_date: 1 }).limit(3);

        const appts = apptsDocs.map(appt => ({
          ...appt.toObject(),
          id: appt._id,
          dname: appt.doctor_id?.full_name || 'Unknown',
          specialization: appt.doctor_id?.specialization || ''
        }));

        const age = m.dob ? calcAgeYears(m.dob) : null;
        return {
          member: {
            ...m.toObject(),
            id: m._id
          },
          age,
          appts
        };
      })
    );

    // Fetch patient self appointments
    const selfApptsDocs = await Appointment.find({
      patient_id: pid,
      family_member_id: null,
      appt_date: { $gte: today },
      status: { $in: ['pending', 'confirmed'] }
    }).populate('doctor_id').sort({ appt_date: 1 }).limit(3);

    const selfAppts = selfApptsDocs.map(appt => ({
      ...appt.toObject(),
      id: appt._id,
      dname: appt.doctor_id?.full_name || 'Unknown',
      specialization: appt.doctor_id?.specialization || ''
    }));

    res.json({ ok: true, members: enriched, self_appts: selfAppts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading family list' });
  }
});

router.post('/family/add', patientRequired, upload.single('profile_image'), async (req, res) => {
  const pid = req.session.patient_id;
  const { name, dob, relation, gender, blood_group, allergies, chronic_conditions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Name is required.' });
  }

  try {
    const count = await FamilyMember.countDocuments({ patient_id: pid });
    if (count >= 10) {
      return res.status(400).json({ ok: false, error: 'Maximum 10 family members allowed.' });
    }

    let imgPath = '';
    if (req.file) {
      imgPath = `/static/uploads/family/${req.file.filename}`;
    }

    const member = new FamilyMember({
      patient_id: pid,
      name: name.trim(),
      dob: dob || '',
      relation: relation || '',
      gender: gender || '',
      blood_group: blood_group || '',
      allergies: allergies || '',
      chronic_conditions: chronic_conditions || '',
      profile_image: imgPath
    });

    await member.save();
    res.json({ ok: true, message: `${name} added to your family!`, member });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/family/edit/:mid', patientRequired, async (req, res) => {
  const { mid } = req.params;
  const pid = req.session.patient_id;
  const f = req.body;

  try {
    const updatedMember = await FamilyMember.findOneAndUpdate(
      { _id: mid, patient_id: pid },
      {
        name: f.name,
        dob: f.dob,
        relation: f.relation,
        gender: f.gender,
        blood_group: f.blood_group,
        allergies: f.allergies,
        chronic_conditions: f.chronic_conditions
      },
      { new: true }
    );
    res.json({ ok: true, message: 'Member updated.', member: updatedMember });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/family/delete/:mid', patientRequired, async (req, res) => {
  const { mid } = req.params;
  const pid = req.session.patient_id;

  try {
    const member = await FamilyMember.findOneAndDelete({ _id: mid, patient_id: pid });
    if (member && member.profile_image) {
      const fullPath = path.join(__dirname, '..', member.profile_image);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    // Delete vaccination logs for this member
    await VaccinationLog.deleteMany({ family_member_id: mid });
    
    res.json({ ok: true, message: 'Family member removed.' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/family/:mid/vaccines', patientRequired, async (req, res) => {
  const { mid } = req.params;
  const pid = req.session.patient_id;

  try {
    const member = await FamilyMember.findOne({ _id: mid, patient_id: pid });
    if (!member) {
      return res.status(404).json({ ok: false, error: 'Member not found.' });
    }

    const ageMonths = member.dob ? calcAgeMonths(member.dob) : 0;
    
    const logsDocs = await VaccinationLog.find({ family_member_id: mid });
    const completedVaccines = {};
    logsDocs.forEach(log => {
      completedVaccines[log.vaccine_name] = log.toObject();
    });

    const schedule = VACCINATION_SCHEDULE.map(v => {
      let status = 'upcoming';
      if (completedVaccines[v.vaccine]) {
        status = 'completed';
      } else if (v.age_months <= ageMonths) {
        status = 'due';
      }
      
      const log = completedVaccines[v.vaccine];
      return {
        vaccine: v.vaccine,
        age: v.age,
        age_months: v.age_months,
        status,
        completed_date: log ? log.completed_date : null
      };
    });

    res.json({
      ok: true,
      member: {
        ...member.toObject(),
        id: member._id
      },
      schedule,
      age_months: ageMonths
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading vaccination schedule' });
  }
});

router.post('/family/:mid/vaccine/mark', patientRequired, async (req, res) => {
  const { mid } = req.params;
  const { vaccine_name, completed_date } = req.body;
  const targetDate = completed_date || new Date().toISOString().split('T')[0];

  try {
    const log = await VaccinationLog.findOneAndUpdate(
      { family_member_id: mid, vaccine_name },
      { status: 'completed', completed_date: targetDate },
      { upsert: true, new: true }
    );
    res.json({ ok: true, message: `${vaccine_name} marked as completed!`, log });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// JSON API family members dropdown selection
router.get('/api/family-members', async (req, res) => {
  if (!req.session.patient_id) {
    return res.json([]);
  }
  try {
    const membersDocs = await FamilyMember.find({ patient_id: req.session.patient_id });
    const members = membersDocs.map(m => ({
      id: m._id,
      name: m.name,
      relation: m.relation,
      dob: m.dob
    }));
    res.json(members);
  } catch (error) {
    res.json([]);
  }
});

module.exports = router;
