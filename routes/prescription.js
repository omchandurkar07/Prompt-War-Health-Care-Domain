const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');

const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const MedicineReminder = require('../models/MedicineReminder');
const HealthRecord = require('../models/HealthRecord');
const CarePlanItem = require('../models/CarePlanItem');

const { doctorRequired, patientRequired } = require('../middleware/auth');
const {
  explainPrescriptionWithAi,
  generateDigitalPrescriptionExplanation,
  createFallbackRecoveryPlan
} = require('../services/prescriptionAi');
const { uploadFile } = require('../services/cloudinaryService');
const { generatePrescriptionPdf } = require('../services/prescriptionPdf');
const { generateCdsWarnings } = require('../services/cdsService');
const { finalizePrescription } = require('../services/prescriptionFinalize');
const { normalizeExtractedMedicines } = require('../services/prescriptionExtraction');

const tempUpload = multer({ dest: 'static/uploads/temp' });

const generatePrescriptionId = () => {
  const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RX-${datePart}-${randPart}`;
};

const getPrescriptionQuery = (rx_id, extraQuery = {}) => {
  if (rx_id.startsWith('rx_')) {
    const appt_id = rx_id.replace('rx_', '');
    if (!appt_id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return Prescription.findOne({ appointment_id: appt_id, ...extraQuery });
  } else {
    if (!rx_id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return Prescription.findOne({ _id: rx_id, ...extraQuery });
  }
};

const getPrescriptionDetails = async (rx, isDoctor) => {
  const reminders = await MedicineReminder.find({ prescription_db_id: rx._id, is_active: true });
  const rxData = {
    ...rx.toObject(),
    id: rx._id,
    dname: rx.doctor_id?.full_name || 'Doctor',
    specialization: rx.doctor_id?.specialization || '',
    pname: rx.patient_id?.full_name || 'Patient',
    pemail: rx.patient_id?.email || '',
    recovery_plan: Object.keys(rx.recovery_plan || {}).length
      ? rx.recovery_plan
      : createFallbackRecoveryPlan(
        rx.medicines,
        rx.diagnosis || rx.diagnosis_notes,
        rx.doctor_notes || rx.advice,
        rx.follow_up_date
      )
  };

  return {
    ok: true,
    rx: rxData,
    medicines: rx.medicines,
    reminders,
    is_doctor_view: isDoctor
  };
};

const toArray = (val) => {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

const getFormArray = (body, names) => {
  for (const name of names) {
    if (body[name] !== undefined) return toArray(body[name]);
    const indexedFields = Object.keys(body)
      .map(key => {
        const match = key.match(/^(.+)\[(\d+)\]$/);
        return match && match[1] === name ? { index: Number(match[2]), value: body[key] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    if (indexedFields.length) return indexedFields.map(field => field.value);
    if (body[`${name}[]`] !== undefined) return toArray(body[`${name}[]`]);
  }
  return [];
};

const parseMedicinesFromForm = (body) => {
  const names = getFormArray(body, ['medicine_name', 'med_name']);
  const dosages = getFormArray(body, ['medicine_dosage', 'med_dosage']);
  const unitsPerDose = getFormArray(body, ['medicine_units_per_dose', 'med_units_per_dose']);
  const timings = getFormArray(body, ['medicine_timing', 'med_frequency']);
  const durations = getFormArray(body, ['medicine_duration', 'med_duration']);
  const routes = getFormArray(body, ['med_route']);
  const instructions = getFormArray(body, ['medicine_instructions', 'med_instructions']);
  const quantities = getFormArray(body, ['medicine_quantity', 'med_quantity']);
  const quantitySources = getFormArray(body, ['medicine_quantity_source', 'med_quantity_source']);

  const medicines = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || '').trim();
    if (!name) continue;
    medicines.push({
      name,
      dosage: (dosages[i] || '').trim(),
      units_per_dose: (unitsPerDose[i] || '').trim(),
      timing: (timings[i] || '').trim(),
      frequency: (timings[i] || '').trim(),
      duration: (durations[i] || '').trim(),
      quantity: (quantities[i] || '').trim(),
      quantity_source: (quantitySources[i] || '').trim(),
      route: (routes[i] || 'Oral').trim(),
      instructions: (instructions[i] || '').trim()
    });
  }
  return normalizeExtractedMedicines(medicines);
};

router.get(['/doctor/prescription/:aid', '/doctor/prescription/create/:aid'], doctorRequired, async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;

  try {
    const doctor = await Doctor.findById(did);
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did })
      .populate('patient_id')
      .populate('family_member_id');

    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    if (appt.status !== 'completed') {
      appt.status = 'completed';
      appt.session_end_time = new Date().toISOString();
      await appt.save();
    }

    const existing_rx = await Prescription.findOne({ appointment_id: aid });

    // Load drug list
    const drugListPath = path.join(__dirname, '../static/drug_list.json');
    let drug_list = [];
    if (fs.existsSync(drugListPath)) {
      drug_list = JSON.parse(fs.readFileSync(drugListPath, 'utf8'));
    }

    const apptData = {
      id: appt._id,
      patient_id: appt.patient_id._id,
      pname: appt.patient_id.full_name,
      pemail: appt.patient_id.email,
      pdob: appt.patient_id.dob,
      preferred_language: appt.patient_id.preferred_language || 'English',
      fm_name: appt.family_member_id ? appt.family_member_id.name : null,
      fm_dob: appt.family_member_id ? appt.family_member_id.dob : null,
      status: appt.status
    };

    const medicines = existing_rx ? existing_rx.medicines : [];

    res.json({
      ok: true,
      appt: apptData,
      doctor,
      drug_list,
      existing_rx,
      medicines
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading prescription form.' });
  }
});

router.post(['/doctor/prescription/:aid', '/doctor/prescription/create/:aid'], doctorRequired, tempUpload.single('prescription_file'), async (req, res) => {
  const { aid } = req.params;
  const did = req.session.doctor_id;
  const f = req.body;

  try {
    const doctor = await Doctor.findById(did);
    const appt = await Appointment.findOne({ _id: aid, doctor_id: did }).populate('patient_id');
    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const existing_rx = await Prescription.findOne({ appointment_id: aid });
    let diagnosis = (f.diagnosis || f.diagnosis_notes || '').trim();
    let doctor_notes = (f.doctor_notes || f.advice || '').trim();
    let followUp = f.follow_up_date || null;
    let medicines = parseMedicinesFromForm(f);
    const doctorReviewedMedicines = medicines;
    const preferredLanguage = f.preferred_language || appt.patient_id?.preferred_language || 'English';
    if (!['English', 'Hindi', 'Marathi'].includes(preferredLanguage)) {
      return res.status(400).json({ ok: false, error: 'Choose a supported prescription summary language.' });
    }

    const hasFile = req.file;

    if (!hasFile && !diagnosis) {
      return res.status(400).json({ ok: false, error: 'Diagnosis is required if no prescription file is uploaded.' });
    }
    if (!hasFile && medicines.length === 0) {
      return res.status(400).json({ ok: false, error: 'Add at least one medicine if no prescription file is uploaded.' });
    }

    let rxId = existing_rx ? existing_rx.prescription_id : generatePrescriptionId();
    let publicToken = existing_rx?.public_token || crypto.randomBytes(16).toString('hex');
    let originalUrl = existing_rx?.original_upload_url || '';
    let originalPid = existing_rx?.original_upload_public_id || '';
    let ocrText = existing_rx?.ocr_raw_text || '';
    let aiExplanation = '';
    let aiRaw = '';
    let aiStatus = 'success';
    let aiLang = preferredLanguage;
    let recoveryPlan = createFallbackRecoveryPlan(medicines, diagnosis, doctor_notes, followUp);

    if (hasFile) {
      // Upload file to Cloudinary
      const up = await uploadFile(req.file, 'prescriptions/originals');
      if (up) {
        originalUrl = up.url;
        originalPid = up.public_id;
      }

      // Re-read file path if saved locally by Multer temp for Tesseract OCR / AI
      const filePath = req.file.path;
      const aiRes = doctorReviewedMedicines.length > 0
        ? await generateDigitalPrescriptionExplanation(
          doctorReviewedMedicines,
          diagnosis,
          doctor_notes,
          preferredLanguage,
          followUp
        )
        : await explainPrescriptionWithAi(filePath, req.file.mimetype, doctor_notes, preferredLanguage);

      if (aiRes.success || aiRes.status === 'success') {
        medicines = doctorReviewedMedicines.length > 0
          ? doctorReviewedMedicines
          : (aiRes.medicines.length > 0 ? aiRes.medicines : medicines);
        diagnosis = diagnosis || aiRes.diagnosis || '';
        const extractedNotes = aiRes.doctor_notes || '';
        if (doctor_notes && extractedNotes) {
          doctor_notes = `${doctor_notes}\n\nNotes from prescription file:\n${extractedNotes}`;
        } else {
          doctor_notes = doctor_notes || extractedNotes;
        }
        followUp = followUp || aiRes.follow_up_date || null;
        aiExplanation = aiRes.explanation || '';
        recoveryPlan = aiRes.recovery_plan || recoveryPlan;
        aiRaw = aiRes.raw_response || '';
        aiStatus = 'success';
        aiLang = aiRes.language || 'English';
        ocrText = aiRes.raw_text || '';
      } else {
        ocrText = aiRes.raw_text || '';
        const fallbackMeds = aiRes.medicines || [];
        if (fallbackMeds.length > 0 && medicines.length === 0) {
          medicines = fallbackMeds;
        }
        if (medicines.length === 0) {
          medicines = [{
            name: 'Prescribed Medications (See uploaded scan)',
            dosage: '',
            timing: '',
            duration: '',
            route: 'Oral',
            instructions: ''
          }];
        }
        diagnosis = diagnosis || 'Prescription Scan';
        aiExplanation = aiRes.explanation || '';
        recoveryPlan = aiRes.recovery_plan || recoveryPlan;
        aiRaw = aiRes.raw_response || '';
        aiStatus = 'fallback';
      }
    } else {
      // Digital prescription explanation
      const aiRes = await generateDigitalPrescriptionExplanation(medicines, diagnosis, doctor_notes, preferredLanguage, followUp);
      aiExplanation = aiRes.explanation || '';
      aiRaw = aiRes.raw_response || '';
      aiStatus = aiRes.status || 'success';
      aiLang = aiRes.language || 'English';
    }

    // CDS warnings
    const warnings = [];
    const patientDob = appt.patient_id.dob;
    const patientChronic = appt.patient_id.chronic_conditions || '';
    const patientAllergies = appt.patient_id.allergies || '';

    // Load active care plan medicine titles
    const existingMedsDocs = await CarePlanItem.find({
      item_type: 'medicine'
    }).populate({
      path: 'care_plan_id',
      match: { patient_id: appt.patient_id._id, is_active: true }
    });
    
    // Filter active items
    const existingTitles = existingMedsDocs
      .filter(item => item.care_plan_id !== null)
      .map(item => item.title);

    const cdsWarningsList = generateCdsWarnings(patientDob, patientChronic, patientAllergies, medicines, existingTitles);
    warnings.push(...cdsWarningsList);
    const cdsText = cdsWarningsList.join('\n');

    let rx;
    if (existing_rx) {
      rx = await Prescription.findByIdAndUpdate(existing_rx._id, {
        medicines,
        diagnosis,
        doctor_notes,
        diagnosis_notes: diagnosis,
        advice: doctor_notes,
        follow_up_date: followUp,
        original_upload_url: originalUrl,
        original_upload_public_id: originalPid,
        ocr_raw_text: ocrText,
        doctor_signature: doctor.digital_signature || '',
        public_token: publicToken,
        ai_explanation: aiExplanation,
        ai_explanation_raw: aiRaw,
        ai_status: aiStatus,
        ai_language: aiLang,
        recovery_plan: recoveryPlan,
        cds_warnings: cdsText
      }, { new: true });
    } else {
      rx = new Prescription({
        appointment_id: aid,
        doctor_id: did,
        patient_id: appt.patient_id._id,
        family_member_id: appt.family_member_id,
        prescription_id: rxId,
        medicines,
        advice: doctor_notes,
        diagnosis_notes: diagnosis,
        diagnosis,
        doctor_notes,
        follow_up_date: followUp,
        doctor_signature: doctor.digital_signature || '',
        original_upload_url: originalUrl,
        original_upload_public_id: originalPid,
        ocr_raw_text: ocrText,
        public_token: publicToken,
        cds_warnings: cdsText,
        is_verified: true,
        ai_explanation: aiExplanation,
        ai_explanation_raw: aiRaw,
        ai_status: aiStatus,
        ai_language: aiLang,
        recovery_plan: recoveryPlan
      });
      await rx.save();
    }

    // Save to health locker timeline
    const healthLockerRecord = new HealthRecord({
      patient_id: appt.patient_id._id,
      family_member_id: appt.family_member_id,
      appointment_id: aid,
      doc_type: 'Prescription',
      title: `Prescription ${rx.prescription_id}`,
      description: `${medicines.length} medicines. ${diagnosis.slice(0, 80)}`,
      file_path: originalUrl || '',
      doctor_name: doctor.full_name,
      tags: doctor.specialization,
      record_date: new Date().toISOString().split('T')[0]
    });
    await healthLockerRecord.save();

    // Finalize generating PDF, uploading, emailing, reminders, n8n
    const patientData = {
      full_name: appt.patient_id.full_name,
      email: appt.patient_id.email
    };
    await finalizePrescription(rx._id, doctor.toObject(), patientData, appt.toObject());

    res.json({
      ok: true,
      message: `Prescription ${rx.prescription_id} saved and is available in the patient's dashboard.`,
      prescription: rx,
      warnings
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: `Error saving prescription: ${error.message}` });
  }
});

// Autocomplete API for medicine search
router.get('/api/drug-list', (req, res) => {
  const drugListPath = path.join(__dirname, '../static/drug_list.json');
  if (fs.existsSync(drugListPath)) {
    const list = JSON.parse(fs.readFileSync(drugListPath, 'utf8'));
    res.json(list);
  } else {
    res.json([]);
  }
});

// Drug Interactions Check API
router.post('/api/check-interactions', doctorRequired, async (req, res) => {
  const { drug, patient_id } = req.body;
  if (!drug || !patient_id) {
    return res.json({ warnings: [] });
  }

  try {
    const existingMedsDocs = await CarePlanItem.find({
      item_type: 'medicine'
    }).populate({
      path: 'care_plan_id',
      match: { patient_id, is_active: true }
    });

    const existingTitles = existingMedsDocs
      .filter(item => item.care_plan_id !== null)
      .map(item => item.title);

    const { checkDrugInteractions } = require('../services/cdsService');
    const warnings = checkDrugInteractions(drug, existingTitles);

    res.json({ warnings });
  } catch (error) {
    res.json({ warnings: [] });
  }
});

// Prescription details (accessible by doctor and patient)
router.get('/prescriptions/:rx_id/', async (req, res) => {
  const { rx_id } = req.params;

  try {
    const rxQuery = getPrescriptionQuery(rx_id);
    if (!rxQuery) {
      return res.status(400).json({ ok: false, error: 'Invalid prescription ID format.' });
    }

    const rx = await rxQuery
      .populate('doctor_id')
      .populate('patient_id');

    if (!rx) {
      return res.status(404).json({ ok: false, error: 'Prescription not found.' });
    }

    const isDoctor = req.session.doctor_id && String(req.session.doctor_id) === String(rx.doctor_id?._id || rx.doctor_id);
    const isPatient = req.session.patient_id && String(req.session.patient_id) === String(rx.patient_id?._id || rx.patient_id);

    if (!isDoctor && !isPatient) {
      return res.status(403).json({ ok: false, error: 'Access denied.' });
    }

    res.json(await getPrescriptionDetails(rx, Boolean(isDoctor)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading prescription details.' });
  }
});

router.get('/doctor/prescription/view/:rx_id/', doctorRequired, async (req, res) => {
  res.json({ ok: true, redirect: `/prescriptions/${req.params.rx_id}/` });
});

router.post('/doctor/prescription/regenerate/:rx_id', doctorRequired, async (req, res) => {
  const { rx_id } = req.params;
  const did = req.session.doctor_id;
  const preferredLanguage = req.body.preferred_language || 'English';
  if (!['English', 'Hindi', 'Marathi'].includes(preferredLanguage)) {
    return res.status(400).json({ ok: false, error: 'Choose a supported prescription summary language.' });
  }

  try {
    const rxQuery = getPrescriptionQuery(rx_id, { doctor_id: did });
    if (!rxQuery) {
      return res.status(404).json({ ok: false, error: 'Prescription not found' });
    }
    const rx = await rxQuery;
    if (!rx) {
      return res.status(404).json({ ok: false, error: 'Prescription not found' });
    }

    const doctor = await Doctor.findById(did);
    const patient = await Patient.findById(rx.patient_id);
    const appt = await Appointment.findById(rx.appointment_id);

    const aiRes = await generateDigitalPrescriptionExplanation(
      rx.medicines,
      rx.diagnosis || rx.diagnosis_notes || '',
      rx.doctor_notes || rx.advice || '',
      preferredLanguage,
      rx.follow_up_date || ''
    );

    rx.ai_explanation = aiRes.explanation || '';
    rx.ai_explanation_raw = aiRes.raw_response || '';
    rx.ai_status = aiRes.status || 'success';
    rx.ai_language = aiRes.language || 'English';
    rx.recovery_plan = aiRes.recovery_plan || createFallbackRecoveryPlan(
      rx.medicines,
      rx.diagnosis || rx.diagnosis_notes,
      rx.doctor_notes || rx.advice,
      rx.follow_up_date
    );
    await rx.save();

    // Re-generate PDF with the new AI translation
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const pdfBytes = await generatePrescriptionPdf(rx, doctor, patient, appt, rx.medicines, siteUrl);

    const mockFile = {
      buffer: pdfBytes,
      originalname: `prescription_${rx.prescription_id}.pdf`
    };
    const uploadResult = await uploadFile(mockFile, 'prescriptions/generated');

    if (uploadResult) {
      rx.generated_pdf_url = uploadResult.url;
      rx.generated_pdf_public_id = uploadResult.public_id;
      rx.pdf_path = uploadResult.url;
      await rx.save();
    }

    res.json({
      ok: true,
      explanation: rx.ai_explanation,
      status: rx.ai_status,
      language: rx.ai_language,
      recovery_plan: rx.recovery_plan
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Doctor prescriptions history list
router.get('/doctor/prescriptions', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  try {
    const rxDocs = await Prescription.find({ doctor_id: did })
      .populate('patient_id')
      .sort({ created_at: -1 });

    const prescriptions = rxDocs.map(rx => ({
      ...rx.toObject(),
      id: rx._id,
      pname: rx.patient_id?.full_name || 'Unknown'
    }));

    res.json({ ok: true, prescriptions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading prescriptions.' });
  }
});

router.get('/patient/prescriptions', patientRequired, async (req, res) => {
  const pid = req.session.patient_id;

  try {
    const prescriptions = await Prescription.find({ patient_id: pid })
      .populate('doctor_id', 'full_name specialization profile_image')
      .populate('appointment_id', 'appt_date time_slot appt_type')
      .populate('family_member_id', 'name')
      .sort({ created_at: -1 })
      .lean();

    res.json({
      ok: true,
      prescriptions: prescriptions.map(rx => ({
        ...rx,
        dname: rx.doctor_id?.full_name || 'Doctor',
        specialization: rx.doctor_id?.specialization || '',
        profile_image: rx.doctor_id?.profile_image || '/static/images/default_doctor.svg',
        family_member_name: rx.family_member_id?.name || ''
      }))
    });
  } catch (error) {
    console.error('[Patient prescriptions] Failed to load history:', error);
    res.status(500).json({ ok: false, error: 'Unable to load prescription history.' });
  }
});

router.get('/patient/prescriptions/:rx_id/details', patientRequired, async (req, res) => {
  try {
    const rxQuery = getPrescriptionQuery(req.params.rx_id, { patient_id: req.session.patient_id });
    if (!rxQuery) {
      return res.status(400).json({ ok: false, error: 'Invalid prescription ID format.' });
    }

    const rx = await rxQuery.populate('doctor_id', 'full_name specialization').populate('patient_id', 'full_name email');
    if (!rx) {
      return res.status(404).json({ ok: false, error: 'This prescription is not available in your patient account.' });
    }

    res.json(await getPrescriptionDetails(rx, false));
  } catch (error) {
    console.error('[Patient prescription details] Failed to load:', error);
    res.status(500).json({ ok: false, error: 'Unable to load prescription details.' });
  }
});

// PDF Prescription download route
router.get('/prescriptions/:rx_id/download/', async (req, res) => {
  const { rx_id } = req.params;

  try {
    const rxQuery = getPrescriptionQuery(rx_id);
    if (!rxQuery) {
      return res.status(400).json({ ok: false, error: 'Invalid ID.' });
    }

    const rx = await rxQuery;
    if (!rx) {
      return res.status(404).json({ ok: false, error: 'Not found.' });
    }

    const isDoctor = req.session.doctor_id && String(req.session.doctor_id) === String(rx.doctor_id);
    const isPatient = req.session.patient_id && String(req.session.patient_id) === String(rx.patient_id);

    if (!isDoctor && !isPatient) {
      return res.status(403).json({ ok: false, error: 'Access denied.' });
    }

    const pdfUrl = rx.generated_pdf_url || rx.pdf_path;

    if (pdfUrl && pdfUrl.startsWith('http')) {
      try {
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=prescription_${rx.prescription_id}.pdf`);
        return res.send(Buffer.from(response.data));
      } catch (e) {
        console.warn(`[PDF Download] Remote fetch failed, generating on-the-fly: ${e.message}`);
      }
    }

    if (pdfUrl && pdfUrl.startsWith('/static/')) {
      const local = path.join(__dirname, '../static', pdfUrl.replace('/static/', ''));
      if (fs.existsSync(local)) {
        return res.download(local, `prescription_${rx.prescription_id}.pdf`);
      }
    }

    // Generate on-the-fly if files missing
    const doctor = await Doctor.findById(rx.doctor_id);
    const patient = await Patient.findById(rx.patient_id);
    const appt = await Appointment.findById(rx.appointment_id);
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

    const pdfBytes = await generatePrescriptionPdf(rx, doctor, patient, appt, rx.medicines, siteUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prescription_${rx.prescription_id}.pdf`);
    res.send(pdfBytes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error generating prescription file.' });
  }
});

// Verification views (token or ID based)
router.get(['/verify/:token', '/prescriptions/verify/:token'], async (req, res) => {
  const { token } = req.params;

  try {
    const rxQuery = {};
    if (token.match(/^[0-9a-fA-F]{24}$/)) {
      rxQuery.$or = [{ public_token: token }, { prescription_id: token }, { _id: token }];
    } else {
      rxQuery.$or = [{ public_token: token }, { prescription_id: token }];
    }

    const rx = await Prescription.findOne(rxQuery)
      .populate('doctor_id')
      .populate('patient_id')
      .populate('family_member_id');

    if (!rx) {
      return res.json({ ok: true, verified: false, rx: null, medicines: [] });
    }

    const rxData = {
      ...rx.toObject(),
      id: rx._id,
      dname: rx.doctor_id.full_name,
      specialization: rx.doctor_id.specialization,
      qualification: rx.doctor_id.qualification || '',
      hospital_name: rx.doctor_id.hospital_name || '',
      registration_number: rx.doctor_id.registration_number || '',
      pname: rx.patient_id.full_name,
      fm_name: rx.family_member_id ? rx.family_member_id.name : null
    };

    res.json({ ok: true, verified: true, rx: rxData, medicines: rx.medicines });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Save Doctor's digital signature
router.post('/doctor/signature', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const { signature } = req.body;

  try {
    await Doctor.findByIdAndUpdate(did, { digital_signature: signature });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /prescription/ocr (Advanced AI & fallback basic OCR for form writing helper)
router.post('/prescription/ocr', doctorRequired, tempUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No prescription file uploaded.' });
  }

  try {
    const preferredLanguage = req.body.preferred_language || 'English';
    const doctor_notes = req.body.doctor_notes || '';
    
    const aiRes = await explainPrescriptionWithAi(req.file.path, req.file.mimetype, doctor_notes, preferredLanguage);
    return res.json({
      ok: true,
      medicines: aiRes.medicines,
      diagnosis: aiRes.diagnosis,
      doctor_notes: aiRes.doctor_notes,
      follow_up_date: aiRes.follow_up_date,
      explanation: aiRes.explanation,
      recovery_plan: aiRes.recovery_plan,
      raw_text: aiRes.raw_text || '',
      extraction_status: aiRes.status
    });
  } catch (error) {
    console.error('[OCR ERROR]', error);
    res.status(500).json({ ok: false, error: `OCR process failed: ${error.message}` });
  } finally {
    try {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('[OCR] Failed to clean up temporary upload:', cleanupError.message);
    }
  }
});

// POST /patient/prescription/translate/:rx_id
router.post('/patient/prescription/translate/:rx_id', patientRequired, async (req, res) => {
  const { rx_id } = req.params;
  const pid = req.session.patient_id;
  const preferredLanguage = req.body.preferred_language || 'English';

  try {
    const rxQuery = getPrescriptionQuery(rx_id, { patient_id: pid });
    if (!rxQuery) {
      return res.status(404).json({ ok: false, error: 'Prescription not found' });
    }
    const rx = await rxQuery;
    if (!rx) {
      return res.status(404).json({ ok: false, error: 'Prescription not found' });
    }

    const doctor = await Doctor.findById(rx.doctor_id);
    const patient = await Patient.findById(pid);
    const appt = await Appointment.findById(rx.appointment_id);

    const aiRes = await generateDigitalPrescriptionExplanation(
      rx.medicines,
      rx.diagnosis || rx.diagnosis_notes || '',
      rx.doctor_notes || rx.advice || '',
      preferredLanguage,
      rx.follow_up_date || ''
    );

    rx.ai_explanation = aiRes.explanation || '';
    rx.ai_explanation_raw = aiRes.raw_response || '';
    rx.ai_status = aiRes.status || 'success';
    rx.ai_language = aiRes.language || 'English';
    rx.recovery_plan = aiRes.recovery_plan || createFallbackRecoveryPlan(
      rx.medicines,
      rx.diagnosis || rx.diagnosis_notes,
      rx.doctor_notes || rx.advice,
      rx.follow_up_date
    );
    await rx.save();

    // Re-generate PDF with the new AI translation
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const pdfBytes = await generatePrescriptionPdf(rx, doctor, patient, appt, rx.medicines, siteUrl);

    const mockFile = {
      buffer: pdfBytes,
      originalname: `prescription_${rx.prescription_id}.pdf`
    };
    const uploadResult = await uploadFile(mockFile, 'prescriptions/generated');

    if (uploadResult) {
      rx.generated_pdf_url = uploadResult.url;
      rx.generated_pdf_public_id = uploadResult.public_id;
      await rx.save();
    }

    res.json({
      ok: true,
      explanation: rx.ai_explanation,
      status: rx.ai_status,
      language: rx.ai_language,
      recovery_plan: rx.recovery_plan
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error translating prescription summary.' });
  }
});

module.exports = router;
