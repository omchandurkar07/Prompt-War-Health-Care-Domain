const express = require('express');
const router = express.Router();

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const HealthLog = require('../models/HealthLog');
const HealthTrackerConfig = require('../models/HealthTrackerConfig');
const CarePlan = require('../models/CarePlan');
const CarePlanItem = require('../models/CarePlanItem');
const AdherenceLog = require('../models/AdherenceLog');
const { generateHealthReportPdf } = require('../services/healthReportPdf');
const { patientRequired, doctorRequired } = require('../middleware/auth');

const TRACKABLE_CONDITIONS = {
  blood_sugar: {
    label: 'Blood Sugar',
    icon: '🩸',
    unit: 'mg/dL',
    metrics: [
      { key: 'fasting', label: 'Fasting', unit: 'mg/dL' },
      { key: 'post_meal', label: 'Post-meal', unit: 'mg/dL' },
      { key: 'random', label: 'Random', unit: 'mg/dL' }
    ]
  },
  blood_pressure: {
    label: 'Blood Pressure',
    icon: '💓',
    unit: 'mmHg',
    metrics: [
      { key: 'systolic', label: 'Systolic', unit: 'mmHg' },
      { key: 'diastolic', label: 'Diastolic', unit: 'mmHg' },
      { key: 'pulse', label: 'Pulse', unit: 'bpm' }
    ]
  },
  weight: {
    label: 'Weight',
    icon: '⚖️',
    unit: 'kg',
    metrics: [{ key: 'weight', label: 'Weight', unit: 'kg' }]
  },
  temperature: {
    label: 'Body Temperature',
    icon: '🌡️',
    unit: '°F',
    metrics: [{ key: 'temp', label: 'Temperature', unit: '°F' }]
  },
  spo2: {
    label: 'SpO2',
    icon: '🫁',
    unit: '%',
    metrics: [{ key: 'spo2', label: 'SpO2', unit: '%' }]
  }
};

// GET /health-tracker
router.get('/health-tracker', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  try {
    const configs = await HealthTrackerConfig.find({ patient_id: pid, is_active: true });
    const active_conditions = configs.map(c => c.condition);

    const recent = {};
    for (const cond of active_conditions) {
      const logs = await HealthLog.find({ patient_id: pid, condition: cond })
        .sort({ log_date: -1, log_time: -1 })
        .limit(10);

      recent[cond] = logs.map(l => {
        const item = l.toObject();
        item.metrics = typeof item.metrics === 'string' ? JSON.parse(item.metrics || '{}') : item.metrics || {};
        return item;
      });
    }

    res.json({
      ok: true,
      conditions: TRACKABLE_CONDITIONS,
      active: active_conditions,
      recent,
      configs,
      today,
      now_time: nowTime
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading health tracker.' });
  }
});

// POST /health-tracker/start
router.post('/health-tracker/start', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { condition } = req.body;

  if (!TRACKABLE_CONDITIONS[condition]) {
    return res.status(400).json({ ok: false, error: 'Invalid condition.' });
  }

  try {
    const config = await HealthTrackerConfig.findOneAndUpdate(
      { patient_id: pid, condition },
      { is_active: true },
      { upsert: true, new: true }
    );
    res.json({ ok: true, message: `Started tracking ${TRACKABLE_CONDITIONS[condition].label}!`, config });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error starting health tracker.' });
  }
});

// POST /health-tracker/stop
router.post('/health-tracker/stop', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { condition } = req.body;

  try {
    const config = await HealthTrackerConfig.findOneAndUpdate(
      { patient_id: pid, condition },
      { is_active: false },
      { new: true }
    );
    res.json({ ok: true, message: 'Stopped tracking.', config });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error stopping health tracker.' });
  }
});

// POST /health-tracker/log
router.post('/health-tracker/log', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const data = req.body;
  const cond = data.condition || '';
  const log_date = data.log_date || new Date().toISOString().split('T')[0];
  const log_time = data.log_time || new Date().toTimeString().slice(0, 5);
  const note = data.note || '';

  const metrics = {};
  if (TRACKABLE_CONDITIONS[cond]) {
    TRACKABLE_CONDITIONS[cond].metrics.forEach(m => {
      const val = data[m.key];
      if (val !== undefined && val !== '') {
        const parsed = parseFloat(val);
        metrics[m.key] = isNaN(parsed) ? val : parsed;
      }
    });
  }

  try {
    const newLog = new HealthLog({
      patient_id: pid,
      condition: cond,
      log_date,
      log_time,
      metrics,
      note
    });
    await newLog.save();

    res.json({ ok: true, message: 'Reading logged!', log: newLog });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error logging reading.' });
  }
});

// GET /tracker-data/:condition
router.get('/tracker-data/:condition', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { condition } = req.params;
  const days = parseInt(req.query.days) || 30;

  const startDateDt = new Date();
  startDateDt.setDate(startDateDt.getDate() - days);
  const start_date = startDateDt.toISOString().split('T')[0];

  try {
    const config = await HealthTrackerConfig.findOne({ patient_id: pid, condition });
    const targets = config && config.targets
      ? (typeof config.targets === 'string' ? JSON.parse(config.targets) : config.targets)
      : {};

    const logs = await HealthLog.find({
      patient_id: pid,
      condition,
      log_date: { $gte: start_date }
    }).sort({ log_date: 1, log_time: 1 });

    const data = logs.map(l => {
      const m = typeof l.metrics === 'string' ? JSON.parse(l.metrics || '{}') : l.metrics || {};
      return {
        date: l.log_date,
        time: l.log_time || '',
        metrics: m,
        note: l.note
      };
    });

    res.json({ ok: true, data, condition, targets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /health-tracker/share
router.post('/health-tracker/share', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { condition, doctor_id } = req.body;

  try {
    const config = await HealthTrackerConfig.findOneAndUpdate(
      { patient_id: pid, condition },
      { share_with_doctor_id: doctor_id || null },
      { new: true }
    );
    res.json({ ok: true, config });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /patient-tracker-data/:patient_id/:condition
router.get('/patient-tracker-data/:patient_id/:condition', doctorRequired, async (req, res) => {
  const { patient_id, condition } = req.params;
  const did = req.session.doctor_id;

  try {
    // Check if patient shared this condition with this doctor
    const config = await HealthTrackerConfig.findOne({
      patient_id,
      condition,
      share_with_doctor_id: did
    });

    if (!config) {
      return res.json({ ok: false, error: 'Not shared' });
    }

    const startDateDt = new Date();
    startDateDt.setDate(startDateDt.getDate() - 30);
    const start_date = startDateDt.toISOString().split('T')[0];

    const logs = await HealthLog.find({
      patient_id,
      condition,
      log_date: { $gte: start_date }
    }).sort({ log_date: 1, log_time: 1 });

    const result = logs.map(l => {
      const m = typeof l.metrics === 'string' ? JSON.parse(l.metrics || '{}') : l.metrics || {};
      return {
        date: l.log_date,
        time: l.log_time,
        metrics: m,
        note: l.note
      };
    });

    res.json({ ok: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/health-tracker/aura-insights
router.get('/api/health-tracker/aura-insights', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const startStr = start.toISOString().split('T')[0];

    // Find active plans in the last 14 days
    const plans = await CarePlan.find({
      patient_id: pid,
      is_active: true,
      start_date: { $lte: todayStr },
      end_date: { $gte: startStr }
    }).populate('doctor_id');

    const planIds = plans.map(p => p._id);
    const doctorNames = {};
    plans.forEach(p => {
      if (p.doctor_id) {
        doctorNames[p.doctor_id._id.toString()] = p.doctor_id.full_name;
      }
    });

    const adherence_by_date = {};
    let items = [];

    if (planIds.length > 0) {
      items = await CarePlanItem.find({
        care_plan_id: { $in: planIds },
        item_type: { $ne: 'followup' }
      });

      const itemIds = items.map(it => it._id);

      if (itemIds.length > 0) {
        // Generate list of date strings for past 15 days
        const dateList = [];
        for (let i = 0; i <= 14; i++) {
          const checkDt = new Date(start);
          checkDt.setDate(checkDt.getDate() + i);
          dateList.push(checkDt.toISOString().split('T')[0]);
        }

        dateList.forEach(d => {
          adherence_by_date[d] = { done: 0, total: items.length };
        });

        const logs = await AdherenceLog.find({
          patient_id: pid,
          care_plan_item_id: { $in: itemIds },
          log_date: { $gte: startStr }
        });

        logs.forEach(l => {
          const ldate = l.log_date;
          if (adherence_by_date[ldate] && l.is_done) {
            adherence_by_date[ldate].done += 1;
          }
        });

        for (const d in adherence_by_date) {
          const tot = adherence_by_date[d].total;
          const done = adherence_by_date[d].done;
          adherence_by_date[d].pct = tot > 0 ? (done / tot) * 100 : 0.0;
        }
      }
    }

    // Get health logs for past 14 days
    const healthLogs = await HealthLog.find({
      patient_id: pid,
      log_date: { $gte: startStr }
    });

    // Correlate metrics with adherence
    const correlations = {};
    healthLogs.forEach(log => {
      const cond = log.condition;
      const ldate = log.log_date;
      const metrics = typeof log.metrics === 'string' ? JSON.parse(log.metrics || '{}') : log.metrics || {};

      const adherencePct = (adherence_by_date[ldate] && adherence_by_date[ldate].pct) || 0.0;
      const isAdherent = adherencePct >= 50.0;

      if (!correlations[cond]) {
        correlations[cond] = {};
      }

      for (const [k, v] of Object.entries(metrics)) {
        const numVal = parseFloat(v);
        if (!isNaN(numVal)) {
          if (!correlations[cond][k]) {
            correlations[cond][k] = { adherent: [], non_adherent: [] };
          }
          if (isAdherent) {
            correlations[cond][k].adherent.push(numVal);
          } else {
            correlations[cond][k].non_adherent.push(numVal);
          }
        }
      }
    });

    const insights = [];

    const configs = await HealthTrackerConfig.find({ patient_id: pid, is_active: true });
    const configDict = {};
    configs.forEach(c => {
      configDict[c.condition] = c;
    });

    for (const [cond, metricsDict] of Object.entries(correlations)) {
      const condConfig = configDict[cond];
      let docName = "your doctor";
      let targets = {};

      if (condConfig) {
        targets = typeof condConfig.targets === 'string' ? JSON.parse(condConfig.targets || '{}') : condConfig.targets || {};
        const docId = condConfig.share_with_doctor_id;
        if (docId && doctorNames[docId.toString()]) {
          const parts = doctorNames[docId.toString()].split(' ');
          docName = `Dr. ${parts[parts.length - 1]}`;
        }
      }

      for (const [key, vals] of Object.entries(metricsDict)) {
        const adhList = vals.adherent;
        const nonAdhList = vals.non_adherent;

        if (adhList.length >= 1 && nonAdhList.length >= 1) {
          const avgAdh = adhList.reduce((sum, v) => sum + v, 0) / adhList.length;
          const avgNon = nonAdhList.reduce((sum, v) => sum + v, 0) / nonAdhList.length;
          const diff = avgNon - avgAdh;

          if (cond === 'blood_sugar') {
            if (diff > 5) {
              const pctImpr = (diff / avgNon) * 100;
              insights.push({
                title: '🩸 Healing Plan Adherence Pays Off!',
                type: 'positive',
                description: `AURA noticed your average <strong>${key.replace('_', ' ').toUpperCase()}</strong> sugar is <strong>${pctImpr.toFixed(1)}% lower</strong> (${avgAdh.toFixed(1)} mg/dL) on days you completed your daily Care Plan, compared to ${avgNon.toFixed(1)} mg/dL on non-adherent days.`,
                recommendation: "Keep up the excellent adherence to your Care Plan medications and lifestyle checks to maintain stable glucose levels."
              });
            } else if (diff < -5) {
              insights.push({
                title: '🩸 Blood Sugar Variance Alert',
                type: 'warning',
                description: `Your <strong>${key.replace('_', ' ').toUpperCase()}</strong> blood sugar averaged higher (${avgAdh.toFixed(1)} mg/dL) even on compliant days. This could be due to food intake or stress.`,
                recommendation: `Log notes with your meals in the Health Tracker, and consider scheduling a follow-up with ${docName} to adjust dosage ranges.`
              });
            }
          } else if (cond === 'blood_pressure' && (key === 'systolic' || key === 'diastolic')) {
            if (diff > 3) {
              insights.push({
                title: '💓 Blood Pressure Control',
                type: 'positive',
                description: `Your average <strong>${key.toUpperCase()} BP</strong> is <strong>${diff.toFixed(1)} mmHg lower</strong> (${avgAdh.toFixed(1)} mmHg) on days you logged 50%+ checklist compliance. On non-adherent days, it rose to ${avgNon.toFixed(1)} mmHg.`,
                recommendation: "Completing your lifestyle tasks and medicines acts as a natural buffer for your heart. Continue staying on track!"
              });
            }
          }
        } else {
          const allVals = [...adhList, ...nonAdhList];
          if (allVals.length >= 1) {
            const targetRange = targets[key] || {};
            const tMin = targetRange.min;
            const tMax = targetRange.max;

            if (tMin !== undefined || tMax !== undefined) {
              let inTarget = 0;
              allVals.forEach(v => {
                let isOk = true;
                if (tMin !== undefined && v < tMin) isOk = false;
                if (tMax !== undefined && v > tMax) isOk = false;
                if (isOk) inTarget++;
              });

              const successPct = (inTarget / allVals.length) * 100;
              const metricLabel = key.replace('_', ' ').toUpperCase();

              if (successPct >= 80) {
                insights.push({
                  title: `🎯 Excellent ${metricLabel} Target Adherence!`,
                  type: 'positive',
                  description: `You were within ${docName}'s target zone for <strong>${successPct.toFixed(0)}% of your readings</strong> (${allVals.length} logs total).`,
                  recommendation: "Keep logging your readings regularly. You are doing a fantastic job maintaining target ranges!"
                });
              } else if (successPct < 60) {
                insights.push({
                  title: `⚠️ ${metricLabel} Target Variance Detected`,
                  type: 'warning',
                  description: `Only <strong>${successPct.toFixed(0)}%</strong> of your recent readings fall within ${docName}'s target range.`,
                  recommendation: `Be extra diligent with your Care Plan checklist this week. If readings continue to sit outside targets, message ${docName}.`
                });
              }
            }
          }
        }
      }
    }

    if (insights.length === 0) {
      insights.push({
        title: '✨ Welcome to AURA AI Coach!',
        type: 'info',
        description: "I am scan-ready to correlate your daily Care Plan adherence with your health logs. Once you log <strong>at least 1 day</strong> of health readings and checklist tasks, I'll calculate clinical correlations for you.",
        recommendation: "Click the floating 'Log Reading' button at the bottom of the page and start checking off items in your Healing Plan to train your AI Coach."
      });
      insights.push({
        title: '💡 Quick Pro-Tip',
        type: 'info',
        description: "Fasting Blood Sugar is best measured immediately upon waking, before breakfast. Check your checklist morning section for associated medicines.",
        recommendation: "Make logging a routine by enabling daily reminder notifications."
      });
    }

    res.json({ ok: true, insights });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /health-tracker/download-report
router.get('/health-tracker/download-report', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;

  try {
    const patient = await Patient.findById(pid);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const configs = await HealthTrackerConfig.find({ patient_id: pid, is_active: true });
    const logs = await HealthLog.find({ patient_id: pid }).sort({ condition: 1, log_date: -1, log_time: -1 });

    const pdfBytes = await generateHealthReportPdf(patient, configs, logs);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Health_Tracker_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(pdfBytes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate health report PDF.' });
  }
});

module.exports = router;
