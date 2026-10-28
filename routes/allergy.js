const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const PatientAllergy = require('../models/PatientAllergy');
const FamilyMember = require('../models/FamilyMember');
const DrugAllergyOverride = require('../models/DrugAllergyOverride');
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const { checkAllergyMatch, checkDrugInteractions } = require('../services/cdsService');
const { patientRequired, doctorRequired } = require('../middleware/auth');

// Load drug list for autocomplete
const drugListPath = path.join(__dirname, '../static/drug_list.json');
let drugList = [];
try {
  if (fs.existsSync(drugListPath)) {
    drugList = JSON.parse(fs.readFileSync(drugListPath, 'utf8'));
  }
} catch (err) {
  console.error('Failed to load drug list autocomplete', err);
}

// ═══════════ ALLERGY MANAGEMENT ═══════════

// GET /my-allergies
router.get('/my-allergies', patientRequired, async (req, res) => {
  try {
    const pid = req.session.patient_id;
    const allergies = await PatientAllergy.find({ patient_id: pid, family_member_id: null }).sort({ created_at: -1 });
    const family = await FamilyMember.find({ patient_id: pid });
    
    const family_allergies = {};
    for (const fm of family) {
      const fa = await PatientAllergy.find({ family_member_id: fm._id }).sort({ created_at: -1 });
      family_allergies[fm._id] = fa;
    }

    res.json({
      ok: true,
      allergies,
      family,
      family_allergies,
      drug_list: drugList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading allergy manager.' });
  }
});

// POST /my-allergies/add
router.post('/my-allergies/add', patientRequired, async (req, res) => {
  try {
    const { allergy_name, family_member_id, allergy_type, severity, notes } = req.body;
    const name = (allergy_name || '').trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Allergy name is required.' });
    }

    const fmid = family_member_id || null;
    const allergy = new PatientAllergy({
      patient_id: req.session.patient_id,
      family_member_id: fmid,
      allergy_name: name,
      allergy_type: allergy_type || 'drug',
      severity: severity || 'moderate',
      notes: notes || ''
    });

    await allergy.save();
    res.json({ ok: true, message: `Allergy "${name}" added.`, allergy });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error adding allergy.' });
  }
});

// POST /my-allergies/delete/:aid
router.post('/my-allergies/delete/:aid', patientRequired, async (req, res) => {
  try {
    const { aid } = req.params;
    await PatientAllergy.findOneAndDelete({ _id: aid, patient_id: req.session.patient_id });
    res.json({ ok: true, message: 'Allergy removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error deleting allergy.' });
  }
});

// POST /api/check-allergy-interaction
router.post('/api/check-allergy-interaction', doctorRequired, async (req, res) => {
  try {
    const { drug, patient_id, family_member_id } = req.body;
    if (!drug || !patient_id) {
      return res.json({ allergy_warnings: [], interaction_warnings: [] });
    }

    let allergies = [];
    if (family_member_id) {
      allergies = await PatientAllergy.find({ family_member_id });
    } else {
      allergies = await PatientAllergy.find({ patient_id, family_member_id: null });
    }

    const allergy_list = allergies.map(a => a.allergy_name);
    const allergy_warnings = checkAllergyMatch(drug, allergy_list);

    // Get active medications from care plans (from ALL doctors)
    const todayStr = new Date().toISOString().split('T')[0];
    const activePlans = await CarePlan.find({
      patient_id,
      is_active: true,
      end_date: { $gte: todayStr }
    }).populate('doctor_id');

    const planIds = activePlans.map(p => p._id);
    const existingMeds = await CarePlanItem.find({
      care_plan_id: { $in: planIds },
      item_type: 'medicine'
    });

    const existingNames = existingMeds.map(m => m.title);
    const raw_interactions = checkDrugInteractions(drug, existingNames);

    // Enrich interaction warnings with doctor info
    const interaction_warnings = [];
    for (const w of raw_interactions) {
      let matched = false;
      for (const m of existingMeds) {
        if (m.title.toLowerCase() && w.toLowerCase().includes(m.title.toLowerCase())) {
          const cp = activePlans.find(p => p._id.toString() === m.care_plan_id.toString());
          const docName = cp && cp.doctor_id ? cp.doctor_id.full_name : 'Unknown Doctor';
          const planDate = cp && cp.created_at ? cp.created_at.toISOString().split('T')[0] : 'Unknown Date';
          interaction_warnings.push(`${w} (prescribed by Dr. ${docName} on ${planDate})`);
          matched = true;
          break;
        }
      }
      if (!matched) {
        interaction_warnings.push(w);
      }
    }

    res.json({ allergy_warnings, interaction_warnings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error check-allergy-interaction' });
  }
});

// POST /api/log-override
router.post('/api/log-override', doctorRequired, async (req, res) => {
  try {
    const { prescription_id, drug_name, alert_type, alert_detail, override_reason, override_note } = req.body;
    
    const log = new DrugAllergyOverride({
      prescription_id: prescription_id || 'DRAFT',
      doctor_id: req.session.doctor_id,
      drug_name: drug_name || '',
      alert_type: alert_type || 'allergy',
      alert_detail: alert_detail || '',
      override_reason: override_reason || '',
      override_note: override_note || ''
    });

    await log.save();
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.json({ ok: false, error: error.message });
  }
});

module.exports = router;
