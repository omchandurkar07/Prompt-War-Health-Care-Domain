const express = require('express');
const router = Router = express.Router();
const HealthRecord = require('../models/HealthRecord');
const ShareLink = require('../models/ShareLink');
const FamilyMember = require('../models/FamilyMember');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const { patientRequired } = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const DOC_TYPES = [
  'Prescription', 'Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound',
  'Discharge Summary', 'Vaccination Record', 'Lab Report', 'Doctor Notes', 'Other'
];

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// Multer disk storage for locker records
const recordStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const pid = req.session.patient_id;
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
const upload = multer({ storage: recordStorage });

router.get('/health-locker', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { member, type: docType } = req.query;
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';

  if (search.length > 100) {
    return res.status(400).json({ ok: false, error: 'Search must be 100 characters or fewer.' });
  }
  if ((from && !isValidDate(from)) || (to && !isValidDate(to)) || (from && to && from > to)) {
    return res.status(400).json({ ok: false, error: 'Provide a valid date range.' });
  }

  try {
    const family = await FamilyMember.find({ patient_id: pid });

    const query = { patient_id: pid };
    if (member && member.match(/^[0-9a-fA-F]{24}$/)) {
      query.family_member_id = member;
    }
    if (docType) {
      query.doc_type = docType;
    }
    if (from || to) {
      query.record_date = {};
      if (from) query.record_date.$gte = from;
      if (to) query.record_date.$lte = to;
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [
        { title: searchRegex },
        { doctor_name: searchRegex },
        { tags: searchRegex },
        { description: searchRegex }
      ];
    }

    const healthRecords = await HealthRecord.find(query).sort({ record_date: -1, created_at: -1 });

    // Join with prescriptions to check for database links
    const records = await Promise.all(
      healthRecords.map(async (rec) => {
        let rxDbId = null;
        if (rec.doc_type === 'Prescription' && rec.appointment_id) {
          const rx = await Prescription.findOne({ appointment_id: rec.appointment_id });
          if (rx) rxDbId = rx._id;
        }
        return {
          ...rec.toObject(),
          id: rec._id,
          rx_db_id: rxDbId
        };
      })
    );

    const appointmentsDocs = await Appointment.find({
      patient_id: pid,
      status: { $in: ['completed', 'confirmed'] }
    }).populate('doctor_id').sort({ appt_date: -1 });

    const appointments = appointmentsDocs.map(appt => ({
      id: appt._id,
      appt_date: appt.appt_date,
      time_slot: appt.time_slot,
      dname: appt.doctor_id?.full_name || 'Unknown',
      specialization: appt.doctor_id?.specialization || ''
    }));

    res.json({
      ok: true,
      records,
      family,
      appointments,
      doc_types: DOC_TYPES,
      selected_member: member || '',
      search: search || '',
      selected_type: docType || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading health locker' });
  }
});

router.post('/health-locker/upload', patientRequired, upload.single('file'), async (req, res) => {
  const pid = req.session.patient_id;
  let { title, doc_type, record_date, description, appointment_id, family_member_id, doctor_name, tags } = req.body;

  if (!title) {
    return res.status(400).json({ ok: false, error: 'Title is required.' });
  }

  try {
    if (appointment_id && appointment_id.match(/^[0-9a-fA-F]{24}$/)) {
      const appt = await Appointment.findById(appointment_id).populate('doctor_id');
      if (appt && appt.doctor_id) {
        doctor_name = appt.doctor_id.full_name;
        if (!tags) tags = appt.doctor_id.specialization;
      }
    }

    let filePath = '';
    if (req.file) {
      filePath = `/static/uploads/records/${pid}/${req.file.filename}`;
    }

    const newRecord = new HealthRecord({
      patient_id: pid,
      family_member_id: (family_member_id && family_member_id.match(/^[0-9a-fA-F]{24}$/)) ? family_member_id : null,
      appointment_id: (appointment_id && appointment_id.match(/^[0-9a-fA-F]{24}$/)) ? appointment_id : null,
      doc_type: doc_type || 'Other',
      title: title.trim(),
      description: description || '',
      file_path: filePath,
      doctor_name: doctor_name || '',
      tags: tags || '',
      record_date: record_date || new Date().toISOString().split('T')[0]
    });

    await newRecord.save();
    res.json({ ok: true, message: 'Record added to Health Locker!', record: newRecord });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/health-locker/delete/:rid', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { rid } = req.params;

  try {
    const record = await HealthRecord.findOneAndDelete({ _id: rid, patient_id: pid });
    if (record && record.file_path) {
      const fullPath = path.join(__dirname, '..', record.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    res.json({ ok: true, message: 'Record deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/health-locker/share', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;
  const { record_ids, expiry_type, custom_expiry } = req.body;

  if (!record_ids || record_ids.length === 0) {
    return res.json({ ok: false, error: 'Select at least one record' });
  }

  try {
    let expiresDt;
    if (expiry_type === 'custom') {
      if (!custom_expiry) {
        return res.json({ ok: false, error: 'Custom expiration time is required' });
      }
      expiresDt = new Date(custom_expiry);
      if (expiresDt <= new Date()) {
        return res.json({ ok: false, error: 'Expiration date must be in the future' });
      }
    } else {
      const hours = parseInt(expiry_type) || 24;
      expiresDt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const token = crypto.randomBytes(24).toString('hex');

    const share = new ShareLink({
      patient_id: pid,
      token,
      record_ids,
      expires_at: expiresDt
    });
    await share.save();

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const link = `${hostUrl}/shared/${token}`;
    
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    const expiresStr = expiresDt.toLocaleDateString('en-GB', options).replace(',', '');

    res.json({ ok: true, link, expires: expiresStr });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.get('/health-locker/export', patientRequired, async (req, res) => {
  const patientId = req.session.patient_id;
  try {
    const [patient, records, prescriptions] = await Promise.all([
      Patient.findById(patientId).select('full_name email'),
      HealthRecord.find({ patient_id: patientId }).sort({ record_date: -1, created_at: -1 }),
      Prescription.find({ patient_id: patientId }).sort({ created_at: -1 })
    ]);

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Patient account not found.' });
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      patient: { full_name: patient.full_name, email: patient.email },
      records: records.map(record => ({
        title: record.title,
        doc_type: record.doc_type,
        description: record.description,
        doctor_name: record.doctor_name,
        tags: record.tags,
        record_date: record.record_date,
        family_member_id: record.family_member_id,
        appointment_id: record.appointment_id
      })),
      prescriptions: prescriptions.map(prescription => ({
        prescription_id: prescription.prescription_id,
        diagnosis: prescription.diagnosis,
        doctor_notes: prescription.doctor_notes,
        advice: prescription.advice,
        follow_up_date: prescription.follow_up_date,
        medicines: prescription.medicines,
        created_at: prescription.created_at
      }))
    };

    const safeName = (patient.full_name || 'patient').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patient';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-health-records.json"`);
    res.json(exportData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Unable to export health records.' });
  }
});

router.get('/shared/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const share = await ShareLink.findOne({ token });
    if (!share) {
      return res.json({ ok: true, expired: true, records: [] });
    }

    if (new Date() > new Date(share.expires_at)) {
      return res.json({ ok: true, expired: true, records: [] });
    }

    const healthRecords = await HealthRecord.find({ _id: { $in: share.record_ids } });
    
    const records = await Promise.all(
      healthRecords.map(async (rec) => {
        let rxDbId = null;
        if (rec.doc_type === 'Prescription' && rec.appointment_id) {
          const rx = await Prescription.findOne({ appointment_id: rec.appointment_id });
          if (rx) rxDbId = rx._id;
        }
        return {
          ...rec.toObject(),
          id: rec._id,
          rx_db_id: rxDbId
        };
      })
    );

    const patient = await Patient.findById(share.patient_id);
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    const expiresStr = new Date(share.expires_at).toLocaleDateString('en-GB', options).replace(',', '');

    res.json({
      ok: true,
      expired: false,
      records,
      patient_name: patient ? patient.full_name : 'Patient',
      expires_at: expiresStr
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
