const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const createEmailTransporter = () => {
  const host = process.env.MAIL_SERVER || 'smtp.gmail.com';
  const port = Number.parseInt(process.env.MAIL_PORT || '587', 10);
  const password = process.env.MAIL_PASSWORD || '';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.MAIL_USERNAME || '',
      pass: host.toLowerCase() === 'smtp.gmail.com' ? password.replace(/\s/g, '') : password,
    },
  });
};

const sendOtpEmail = async (email, otpCode) => {
  console.log(`\n[OTP-DEV] Verification code for ${email}: ${otpCode}\n`);
  try {
    const transporter = createEmailTransporter();
    const mailOptions = {
      from: process.env.MAIL_USERNAME || 'ultracare02@gmail.com',
      to: email,
      subject: 'UltraCare Account Verification Code',
      text: `Hello,\n\nYour 6-digit OTP for account registration on UltraCare is ${otpCode}.\n\nThis code will expire in 5 minutes.\n\nBest regards,\nThe UltraCare Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log(`[OTP-EMAIL] Sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`[OTP-EMAIL] Failed to send to ${email}: ${error.message}`);
    // Return true for fallback matching Python logic
    return true;
  }
};

const sendAppointmentBookingEmail = async (email, doctorName, apptDate, apptTime, paymentRequired = true) => {
  try {
    const transporter = createEmailTransporter();
    const nameStr = doctorName.startsWith('Dr. ') ? doctorName : `Dr. ${doctorName}`;
    const mailOptions = {
      from: process.env.MAIL_USERNAME || 'ultracare02@gmail.com',
      to: email,
      subject: 'Your UltraCare Appointment Is Booked',
      text: `Hello,\n\nYour appointment is booked on UltraCare:\n\nDoctor: ${nameStr}\nDate: ${apptDate}\nTime: ${apptTime}\n\nThe doctor has been notified.${paymentRequired ? ' Please complete payment from your dashboard to finalize the booking.' : ''}\n\nThank you for choosing UltraCare!\n\nBest regards,\nThe UltraCare Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log(`[APPT-EMAIL] Booking notification sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`[APPT-EMAIL] Failed to send booking notification: ${error.message}`);
    return false;
  }
};

const sendEmergencyConsultationJoinEmail = async (doctorEmail, doctorName, patientName, sessionType) => {
  try {
    const transporter = createEmailTransporter();
    const mailOptions = {
      from: process.env.MAIL_USERNAME || 'ultracare02@gmail.com',
      to: doctorEmail,
      subject: `🚨 EMERGENCY: Patient ${patientName} has joined the ${sessionType} call`,
      text: `Hello Dr. ${doctorName},\n\nYour patient, ${patientName}, has just joined the emergency ${sessionType} consultation call.\n\nPlease join the session immediately to assist them.\n\nThank you,\nThe UltraCare Team`,
    };
    await transporter.sendMail(mailOptions);
    console.log(`[EMERGENCY-EMAIL] Sent to doctor ${doctorEmail}`);
    return true;
  } catch (error) {
    console.error(`[EMERGENCY-EMAIL] Failed to send to doctor ${doctorEmail}: ${error.message}`);
    return false;
  }
};

const sendPrescriptionEmail = async (rx, doctor, patient, medicines) => {
  if (!patient || !patient.email) {
    console.warn('[EMAIL] Patient has no email');
    return false;
  }
  try {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const transporter = createEmailTransporter();

    let medsListText = '';
    medicines.forEach((m, idx) => {
      medsListText += `${idx + 1}. ${m.name} - ${m.dosage || 'As directed'} (${m.timing || m.frequency || 'As directed'})\n`;
    });

    const body = `Hello ${patient.full_name},\n\nPlease find your prescription details from Dr. ${doctor.full_name} below:\n\nPrescription ID: ${rx.prescription_id}\nDiagnosis: ${rx.diagnosis || rx.diagnosis_notes || 'N/A'}\n\nPrescribed Medicines:\n${medsListText}\nAdvice/Notes: ${rx.doctor_notes || rx.advice || 'N/A'}\n\nView details online: ${siteUrl}/prescriptions/verify/${rx.public_token || rx.prescription_id}\n\nThank you,\nThe UltraCare Team`;

    const mailOptions = {
      from: process.env.MAIL_USERNAME || 'ultracare02@gmail.com',
      to: patient.email,
      subject: `Your prescription from Dr. ${doctor.full_name} — UltraCare`,
      text: body,
      attachments: [],
    };

    const pdfUrl = rx.generated_pdf_url || rx.pdf_path;
    if (pdfUrl) {
      try {
        if (pdfUrl.startsWith('http')) {
          const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
          mailOptions.attachments.push({
            filename: `prescription_${rx.prescription_id}.pdf`,
            content: Buffer.from(response.data),
          });
        } else if (pdfUrl.startsWith('/static/')) {
          const relativePath = pdfUrl.replace('/static/', '');
          const localPath = path.join(__dirname, '../static', relativePath);
          if (fs.existsSync(localPath)) {
            mailOptions.attachments.push({
              filename: `prescription_${rx.prescription_id}.pdf`,
              path: localPath,
            });
          }
        }
      } catch (attachErr) {
        console.error(`[EMAIL] PDF attach failed: ${attachErr.message}`);
      }
    }

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent prescription email to ${patient.email}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Prescription email failed: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendAppointmentBookingEmail,
  sendEmergencyConsultationJoinEmail,
  sendPrescriptionEmail,
  createEmailTransporter,
};
