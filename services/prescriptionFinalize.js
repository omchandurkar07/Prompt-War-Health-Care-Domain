const Prescription = require('../models/Prescription');
const MedicineReminder = require('../models/MedicineReminder');
const Notification = require('../models/Notification');
const { generatePrescriptionPdf } = require('./prescriptionPdf');
const { uploadFile } = require('./cloudinaryService');
const { sendPrescriptionEmail } = require('./emailService');
const axios = require('axios');

const createMedicineReminders = async (rxDbId, prescriptionId, patientId, medicines) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Trigger at 9 AM tomorrow

  const reminders = medicines.map(med => ({
    prescription_db_id: rxDbId,
    prescription_id: prescriptionId,
    patient_id: patientId,
    medicine_name: med.name,
    remind_time: '09:00',
    frequency: 'DAILY',
    next_trigger_at: tomorrow.toISOString(),
    is_active: true
  }));

  if (reminders.length > 0) {
    await MedicineReminder.insertMany(reminders);
  }
};

const triggerPrescriptionCreated = async (rx, patient, doctor, medicines) => {
  const url = process.env.N8N_WEBHOOK_PRESCRIPTION;
  if (!url) return;

  const payload = {
    event: 'prescription_created',
    prescription_id: rx.prescription_id,
    patient_email: patient.email,
    patient_name: patient.full_name,
    doctor_name: doctor.full_name,
    diagnosis: rx.diagnosis || rx.diagnosis_notes,
    follow_up_date: rx.follow_up_date,
    pdf_url: rx.generated_pdf_url || rx.pdf_path,
    medicines
  };

  try {
    await axios.post(url, payload, { timeout: 10000 });
  } catch (error) {
    console.error(`[n8n-webhook] Failed: ${error.message}`);
  }
};

const finalizePrescription = async (rxDbId, doctor, patient, appt) => {
  try {
    const rx = await Prescription.findById(rxDbId);
    if (!rx) return;

    const medicines = rx.medicines || [];
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

    // 1. Generate PDF
    const pdfBytes = await generatePrescriptionPdf(rx, doctor, patient, appt, medicines, siteUrl);

    // 2. Upload PDF
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

    // 3. Create reminders
    await createMedicineReminders(rx._id, rx.prescription_id, rx.patient_id, medicines);

    // 4. Email to patient
    const emailSent = await sendPrescriptionEmail(rx, doctor, patient, medicines);
    rx.email_sent = emailSent;
    await rx.save();

    // 5. Patient Notification
    const newNotif = new Notification({
      user_id: rx.patient_id,
      user_type: 'patient',
      title: '💊 New Prescription',
      message: `Dr. ${doctor.full_name} issued prescription ${rx.prescription_id}. View in your dashboard.`,
      link: `/prescriptions/${rx._id}/`
    });
    await newNotif.save();

    if (rx.follow_up_date) {
      const followupNotif = new Notification({
        user_id: rx.patient_id,
        user_type: 'patient',
        title: '📅 Follow-up scheduled',
        message: `Follow-up on ${rx.follow_up_date} with Dr. ${doctor.full_name}.`,
        link: `/prescriptions/${rx._id}/`
      });
      await followupNotif.save();
    }

    // 6. n8n webhook
    await triggerPrescriptionCreated(rx, patient, doctor, medicines);
  } catch (error) {
    console.error(`[Prescription Finalize] Error: ${error.message}`);
  }
};

module.exports = {
  finalizePrescription
};
