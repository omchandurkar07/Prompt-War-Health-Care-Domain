const express = require('express');
const router = express.Router();
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const AdherenceLog = require('../models/AdherenceLog');
const Appointment = require('../models/Appointment');
const HealthTrackerConfig = require('../models/HealthTrackerConfig');
const Notification = require('../models/Notification');
const { doctorRequired, patientRequired } = require('../middleware/auth');

// Helper to normalize input arrays from form-urlencoded or JSON data
const toArray = (val) => {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

router.get('/doctor/care-plan/:aid', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;

  try {
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did })
      .populate('patient_id')
      .populate('family_member_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    // Map to fields expected by frontend
    const apptData = {
      id: appt._id,
      patient_id: appt.patient_id._id,
      pname: appt.patient_id.full_name,
      family_member_id: appt.family_member_id ? appt.family_member_id._id : null,
      fm_name: appt.family_member_id ? appt.family_member_id.name : null
    };

    res.json({ ok: true, appt: apptData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading care plan form.' });
  }
});

router.post('/doctor/care-plan/:aid', doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;
  const f = req.body;

  try {
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did });
    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const startDate = f.start_date || new Date().toISOString().split('T')[0];
    const durationDays = parseInt(f.duration_days || 7);
    const startDt = new Date(startDate);
    const endDt = new Date(startDt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const endDate = endDt.toISOString().split('T')[0];

    const plan = new CarePlan({
      appointment_id: aid,
      doctor_id: did,
      patient_id: appt.patient_id,
      family_member_id: appt.family_member_id,
      start_date: startDate,
      end_date: endDate
    });
    await plan.save();

    // Parse medicines
    const medNames = toArray(f.med_name || f['med_name[]']);
    const medDosages = toArray(f.med_dosage || f['med_dosage[]']);
    const medFreqs = toArray(f.med_frequency || f['med_frequency[]']);
    const medRoutes = toArray(f.med_route || f['med_route[]']);
    const medInstructions = toArray(f.med_instructions || f['med_instructions[]']);

    for (let i = 0; i < medNames.length; i++) {
      const name = medNames[i];
      if (!name || !name.trim()) continue;

      const details = {
        dosage: medDosages[i] || '',
        frequency: medFreqs[i] || '',
        route: medRoutes[i] || 'Oral',
        instructions: medInstructions[i] || ''
      };

      const freq = details.frequency.toLowerCase();
      let tod = 'morning';
      if (freq.includes('morning') || freq.includes('breakfast')) {
        tod = 'morning';
      } else if (freq.includes('night') || freq.includes('dinner') || freq.includes('evening')) {
        tod = 'evening';
      } else if (freq.includes('afternoon') || freq.includes('lunch')) {
        tod = 'afternoon';
      }

      const item = new CarePlanItem({
        care_plan_id: plan._id,
        item_type: 'medicine',
        title: name.trim(),
        details,
        time_of_day: tod
      });
      await item.save();

      // If twice a day, create evening slot as well
      if (freq.includes('twice') || (freq.includes('morning') && freq.includes('evening'))) {
        const itemEvening = new CarePlanItem({
          care_plan_id: plan._id,
          item_type: 'medicine',
          title: name.trim(),
          details,
          time_of_day: 'evening'
        });
        await itemEvening.save();
      }
    }

    // Parse lifestyle items
    const lifestyleTexts = toArray(f.lifestyle_text || f['lifestyle_text[]']);
    const lifestyleTimes = toArray(f.lifestyle_time || f['lifestyle_time[]']);
    for (let i = 0; i < lifestyleTexts.length; i++) {
      const text = lifestyleTexts[i];
      if (!text || !text.trim()) continue;

      const tod = lifestyleTimes[i] || 'any';
      const item = new CarePlanItem({
        care_plan_id: plan._id,
        item_type: 'lifestyle',
        title: text.trim(),
        details: {},
        time_of_day: tod
      });
      await item.save();
    }

    // Parse lab tests
    const labNames = toArray(f.lab_name || f['lab_name[]']);
    const labInstructions = toArray(f.lab_instructions || f['lab_instructions[]']);
    for (let i = 0; i < labNames.length; i++) {
      const name = labNames[i];
      if (!name || !name.trim()) continue;

      const item = new CarePlanItem({
        care_plan_id: plan._id,
        item_type: 'lab_test',
        title: name.trim(),
        details: { instructions: labInstructions[i] || '' },
        time_of_day: 'any'
      });
      await item.save();
    }

    // Parse follow-up
    const followupDate = f.followup_date;
    if (followupDate) {
      const item = new CarePlanItem({
        care_plan_id: plan._id,
        item_type: 'followup',
        title: `Follow-up on ${followupDate}`,
        details: { date: followupDate },
        time_of_day: 'any'
      });
      await item.save();
    }

    // Parse and set targets
    const targetSugarFastingMin = parseFloat(f.target_sugar_fasting_min);
    const targetSugarFastingMax = parseFloat(f.target_sugar_fasting_max);
    const targetSugarPostMealMin = parseFloat(f.target_sugar_post_meal_min);
    const targetSugarPostMealMax = parseFloat(f.target_sugar_post_meal_max);
    const targetBpSystolicMin = parseFloat(f.target_bp_systolic_min);
    const targetBpSystolicMax = parseFloat(f.target_bp_systolic_max);
    const targetBpDiastolicMin = parseFloat(f.target_bp_diastolic_min);
    const targetBpDiastolicMax = parseFloat(f.target_bp_diastolic_max);
    const targetSpo2Min = parseFloat(f.target_spo2_min);
    const targetTempMin = parseFloat(f.target_temp_min);
    const targetTempMax = parseFloat(f.target_temp_max);
    const targetWeightMin = parseFloat(f.target_weight_min);
    const targetWeightMax = parseFloat(f.target_weight_max);

    const conditionsConfig = [
      {
        cond: 'blood_sugar',
        targets: {
          fasting: { min: targetSugarFastingMin, max: targetSugarFastingMax },
          post_meal: { min: targetSugarPostMealMin, max: targetSugarPostMealMax }
        }
      },
      {
        cond: 'blood_pressure',
        targets: {
          systolic: { min: targetBpSystolicMin, max: targetBpSystolicMax },
          diastolic: { min: targetBpDiastolicMin, max: targetBpDiastolicMax }
        }
      },
      {
        cond: 'spo2',
        targets: {
          spo2: { min: targetSpo2Min, max: 100 }
        }
      },
      {
        cond: 'temperature',
        targets: {
          temp: { min: targetTempMin, max: targetTempMax }
        }
      },
      {
        cond: 'weight',
        targets: {
          weight: { min: targetWeightMin, max: targetWeightMax }
        }
      }
    ];

    for (const config of conditionsConfig) {
      const cleanedTargets = {};
      for (const [metric, bounds] of Object.entries(config.targets)) {
        const cleanedBounds = {};
        if (!isNaN(bounds.min)) cleanedBounds.min = bounds.min;
        if (!isNaN(bounds.max)) cleanedBounds.max = bounds.max;
        if (Object.keys(cleanedBounds).length > 0) {
          cleanedTargets[metric] = cleanedBounds;
        }
      }

      if (Object.keys(cleanedTargets).length > 0) {
        await HealthTrackerConfig.findOneAndUpdate(
          { patient_id: appt.patient_id, condition: config.cond },
          { targets: cleanedTargets, share_with_doctor_id: did, is_active: true },
          { upsert: true, new: true }
        );
      }
    }

    // Create Notification
    const newNotif = new Notification({
      user_id: appt.patient_id,
      user_type: 'patient',
      title: '💊 New Care Plan',
      message: `Dr. ${req.session.doctor_name || 'Your Doctor'} has created a healing plan for you.`,
      link: '/healing-plan'
    });
    await newNotif.save();

    res.json({ ok: true, message: 'Care plan created successfully!', plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Patient Healing Plan page
router.get('/healing-plan', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Active plans
    const plansDocs = await CarePlan.find({
      patient_id: pid,
      is_active: true,
      end_date: { $gte: today }
    }).populate('doctor_id').sort({ start_date: -1 });

    const plans = plansDocs.map(cp => ({
      ...cp.toObject(),
      id: cp._id,
      doctor_name: cp.doctor_id?.full_name || 'Unknown',
      specialization: cp.doctor_id?.specialization || ''
    }));

    const planIds = plans.map(p => p._id);
    let items = [];
    const logs = {};

    if (planIds.length > 0) {
      const itemsDocs = await CarePlanItem.find({ care_plan_id: { $in: planIds } });
      
      // Sort logic matching CASE WHEN
      const todWeights = { morning: 1, afternoon: 2, evening: 3, night: 4 };
      itemsDocs.sort((a, b) => {
        const wA = todWeights[a.time_of_day] || 5;
        const wB = todWeights[b.time_of_day] || 5;
        return wA - wB;
      });

      items = itemsDocs.map(it => it.toObject());

      const itemIds = items.map(it => it._id);
      if (itemIds.length > 0) {
        const logsDocs = await AdherenceLog.find({
          care_plan_item_id: { $in: itemIds },
          log_date: today
        });
        logsDocs.forEach(log => {
          logs[log.care_plan_item_id] = log.toObject();
        });
      }
    }

    // Weekly stats
    const weekStats = [];
    const itemsForStats = items.filter(it => ['medicine', 'lifestyle'].includes(it.item_type));
    const itemIdsForStats = itemsForStats.map(it => it._id);
    
    for (let i = 6; i >= 0; i--) {
      const checkDt = new Date();
      checkDt.setDate(checkDt.getDate() - i);
      const d = checkDt.toISOString().split('T')[0];
      
      let total = itemsForStats.length;
      let done = 0;

      if (planIds.length > 0 && itemIdsForStats.length > 0) {
        done = await AdherenceLog.countDocuments({
          patient_id: pid,
          log_date: d,
          is_done: true,
          care_plan_item_id: { $in: itemIdsForStats }
        });
      } else {
        total = 0;
      }

      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      weekStats.push({
        date: d,
        day: checkDt.toLocaleDateString('en-US', { weekday: 'short' }),
        pct,
        done,
        total
      });
    }

    // Streak calculation (days with >=75% adherence)
    let streak = 0;
    if (planIds.length > 0 && itemsForStats.length > 0) {
      const getDayPct = async (checkDate) => {
        const dayTotal = itemsForStats.length;
        if (dayTotal === 0) return 0;
        const dayDone = await AdherenceLog.countDocuments({
          patient_id: pid,
          log_date: checkDate,
          is_done: true,
          care_plan_item_id: { $in: itemIdsForStats }
        });
        return Math.round((dayDone / dayTotal) * 100);
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const todayPct = await getDayPct(today);
      const yesterdayAdherent = (await getDayPct(yesterdayStr)) >= 75;

      if (todayPct >= 75) {
        streak = 1;
        const checkDt = new Date();
        checkDt.setDate(checkDt.getDate() - 1);
        while (true) {
          const pct = await getDayPct(checkDt.toISOString().split('T')[0]);
          if (pct >= 75) {
            streak += 1;
            checkDt.setDate(checkDt.getDate() - 1);
          } else {
            break;
          }
        }
      } else if (yesterdayAdherent) {
        streak = 0;
        const checkDt = new Date();
        checkDt.setDate(checkDt.getDate() - 1);
        while (true) {
          const pct = await getDayPct(checkDt.toISOString().split('T')[0]);
          if (pct >= 75) {
            streak += 1;
            checkDt.setDate(checkDt.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    res.json({
      ok: true,
      plans,
      items,
      logs,
      today,
      week_stats: weekStats,
      streak
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading healing plan' });
  }
});

// Toggle Adherence check API
router.post('/api/adherence/toggle', patientRequired, async (req, res) => {
  const { item_id, date: logDate } = req.body;
  const targetDate = logDate || new Date().toISOString().split('T')[0];
  const pid = req.session.patient_id;

  try {
    const existing = await AdherenceLog.findOne({
      care_plan_item_id: item_id,
      log_date: targetDate
    });

    if (existing) {
      existing.is_done = !existing.is_done;
      existing.done_at = existing.is_done ? new Date() : null;
      await existing.save();
    } else {
      const newLog = new AdherenceLog({
        care_plan_item_id: item_id,
        patient_id: pid,
        log_date: targetDate,
        is_done: true,
        done_at: new Date()
      });
      await newLog.save();
    }

    // Recalculate compliance percentage
    const activePlans = await CarePlan.find({ patient_id: pid, is_active: true });
    const planIds = activePlans.map(cp => cp._id);

    const planItems = await CarePlanItem.find({
      care_plan_id: { $in: planIds },
      item_type: { $in: ['medicine', 'lifestyle'] }
    });

    const total = planItems.length;
    const done = await AdherenceLog.countDocuments({
      patient_id: pid,
      log_date: targetDate,
      is_done: true,
      care_plan_item_id: { $in: planItems.map(it => it._id) }
    });

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    res.json({ ok: true, adherence_pct: pct });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
