const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const Patient = require('../models/Patient');
const ScreeningRecord = require('../models/ScreeningRecord');
const HealthRecord = require('../models/HealthRecord');
const { patientRequired } = require('../middleware/auth');

// Multer storage configuration for preventive care report uploads
const recordStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const pid = req.session.patient_id;
    const uploadDir = path.join(__dirname, `../static/uploads/records/${pid}`);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    cb(null, `${timestamp}_preventive${ext}`);
  }
});
const upload = multer({ storage: recordStorage });

// Helper to load screening rules from static config
const loadRules = () => {
  const rulesPath = path.join(__dirname, '../static/screening_rules.json');
  try {
    if (fs.existsSync(rulesPath)) {
      return JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load screening rules', err);
  }
  return [];
};

// Helper to calculate age based on DOB string (YYYY-MM-DD)
const calcAge = (dobStr) => {
  if (!dobStr) return 30;
  try {
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return 30;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  } catch (err) {
    return 30;
  }
};

// Compute recommended screenings based on patient guidelines
const computeScreenings = (patient) => {
  const rules = loadRules();
  const age = calcAge(patient.dob);
  const gender = (patient.gender || '').toLowerCase();
  const conditions = (patient.chronic_conditions || '').toLowerCase();

  const recommended = [];
  for (const rule of rules) {
    // Age check
    if (age < (rule.min_age || 0)) {
      continue;
    }
    // Gender check
    const ruleGender = (rule.gender || 'all').toLowerCase();
    if (ruleGender !== 'all' && !gender.includes(ruleGender)) {
      continue;
    }
    // Condition check
    const ruleCondition = (rule.condition || 'all').toLowerCase();
    if (ruleCondition !== 'all') {
      const condList = ruleCondition.split(',').map(c => c.trim());
      if (!condList.some(c => conditions.includes(c))) {
        continue;
      }
    }

    const reasonParts = [];
    if (ruleCondition !== 'all') {
      reasonParts.push(`Condition: ${ruleCondition}`);
    }
    if ((rule.min_age || 0) > 0) {
      reasonParts.push(`Age ≥ ${rule.min_age}`);
    }
    if (ruleGender !== 'all') {
      reasonParts.push(`Gender: ${ruleGender}`);
    }

    recommended.push({
      name: rule.name,
      frequency: rule.frequency || '',
      specialization: rule.specialization || '',
      description: rule.description || '',
      reason: reasonParts.length ? reasonParts.join(' · ') : 'General recommendation'
    });
  }
  return recommended;
};

// GET /preventive-care
router.get('/preventive-care', patientRequired, async (req, res) => {
  try {
    const pid = req.session.patient_id;
    const patient = await Patient.findById(pid);
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Patient not found.' });
    }

    const recommended = computeScreenings(patient);

    // Retrieve screening records for checking completion/snooze statuses
    const screeningRecs = await ScreeningRecord.find({ patient_id: pid, family_member_id: null });
    const srMap = {};
    screeningRecs.forEach(sr => {
      srMap[sr.screening_name] = sr;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Check completion status from health records and screening_records
    for (const screen of recommended) {
      const sr = srMap[screen.name];
      if (sr) {
        screen.status = sr.status || 'due';
        screen.completed_date = sr.completed_date || null;
        screen.snooze_until = sr.snooze_until || null;
        screen.record_id = sr._id;
      } else {
        // Fallback: Check health locker for matching records
        const matching = await HealthRecord.findOne({
          patient_id: pid,
          family_member_id: null,
          $or: [
            { title: new RegExp(screen.name, 'i') },
            { tags: new RegExp(screen.name, 'i') }
          ]
        }).sort({ record_date: -1 });

        if (matching) {
          screen.status = 'completed';
          screen.completed_date = matching.record_date;
        } else {
          screen.status = 'due';
          screen.completed_date = null;
        }
        screen.snooze_until = null;
        screen.record_id = null;
      }

      // Check if snoozed status is active
      if (screen.snooze_until && screen.snooze_until > todayStr) {
        screen.status = 'snoozed';
      }
    }

    res.json({
      ok: true,
      screenings: recommended,
      patient
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading preventive care panel.' });
  }
});

// POST /preventive-care/mark-done
router.post('/preventive-care/mark-done', patientRequired, upload.single('file'), async (req, res) => {
  try {
    const pid = req.session.patient_id;
    const { screening_name, completed_date } = req.body;
    const finalCompletedDate = completed_date || new Date().toISOString().split('T')[0];

    const existing = await ScreeningRecord.findOne({
      patient_id: pid,
      screening_name,
      family_member_id: null
    });

    if (existing) {
      existing.status = 'completed';
      existing.completed_date = finalCompletedDate;
      await existing.save();
    } else {
      const newSr = new ScreeningRecord({
        patient_id: pid,
        screening_name,
        status: 'completed',
        completed_date: finalCompletedDate
      });
      await newSr.save();
    }

    // Create a matching health record if file is uploaded
    let filePath = '';
    if (req.file) {
      filePath = `/static/uploads/records/${pid}/${req.file.filename}`;
    }

    const hr = new HealthRecord({
      patient_id: pid,
      doc_type: 'Lab Report',
      title: `${screening_name} - Report`,
      file_path: filePath,
      record_date: finalCompletedDate,
      tags: 'Preventive Screening'
    });
    await hr.save();

    res.json({ ok: true, message: `${screening_name} marked as completed!`, record: hr });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error updating screening status.' });
  }
});

// POST /preventive-care/snooze
router.post('/preventive-care/snooze', patientRequired, async (req, res) => {
  try {
    const pid = req.session.patient_id;
    const { screening_name, days } = req.body;
    const snoozeDays = parseInt(days) || 30;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + snoozeDays);
    const snooze_until = targetDate.toISOString().split('T')[0];

    const existing = await ScreeningRecord.findOne({
      patient_id: pid,
      screening_name,
      family_member_id: null
    });

    if (existing) {
      existing.snooze_until = snooze_until;
      existing.status = 'snoozed';
      await existing.save();
    } else {
      const newSr = new ScreeningRecord({
        patient_id: pid,
        screening_name,
        status: 'snoozed',
        snooze_until
      });
      await newSr.save();
    }

    res.json({ ok: true, snooze_until });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
