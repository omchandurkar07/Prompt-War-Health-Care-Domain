const express = require('express');
const router = express.Router();

const Appointment = require('../models/Appointment');
const MedicineReminder = require('../models/MedicineReminder');
const { sendWhatsappMessage } = require('../services/whatsappService');
const { createEmailTransporter } = require('../services/emailService');

// GET & POST /api/cron/send-reminders
router.all('/api/cron/send-reminders', async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrow_str = tomorrow.toISOString().split('T')[0];

  try {
    const appts = await Appointment.find({
      appt_date: tomorrow_str,
      status: 'confirmed'
    }).populate('patient_id').populate('doctor_id');

    let count = 0;
    let errors = 0;
    const transporter = createEmailTransporter();

    for (const appt of appts) {
      if (appt.patient_id && appt.patient_id.email) {
        try {
          // Format time slot (12-hour AM/PM)
          let time_str = appt.time_slot;
          try {
            const parts = appt.time_slot.split(':');
            const hrs = parseInt(parts[0]);
            const mins = parts[1];
            const ampm = hrs >= 12 ? 'PM' : 'AM';
            const displayHrs = hrs % 12 || 12;
            time_str = `${displayHrs}:${mins} ${ampm}`;
          } catch (e) {}

          const dname = appt.doctor_id ? appt.doctor_id.full_name : 'Doctor';
          const cleanDname = dname.startsWith('Dr. ') ? dname : `Dr. ${dname}`;
          const senderEmail = process.env.MAIL_USERNAME || 'ultracare02@gmail.com';

          const mailOptions = {
            from: senderEmail,
            to: appt.patient_id.email,
            subject: `Reminder: Tomorrow is your appointment with ${cleanDname}`,
            text: `Hello ${appt.patient_id.full_name},\n\nThis is a reminder that you have a confirmed appointment scheduled for tomorrow:\n\nDoctor: ${cleanDname}\nDate: ${appt.appt_date} (Tomorrow)\nTime: ${time_str}\n\nPlease be ready and join via your dashboard on time.\n\nThank you,\nThe UltraCare Team`
          };

          await transporter.sendMail(mailOptions);
          console.log(`[REMINDER-EMAIL] Sent to ${appt.patient_id.email}`);

          // Also send WhatsApp reminder if patient phone is available
          if (appt.patient_id.phone) {
            try {
              const waBody = `Your appointment is coming up on ${appt.appt_date} at ${time_str}. If you need to change it, please reply back and let us know.`;
              await sendWhatsappMessage(appt.patient_id.phone, waBody);
            } catch (waErr) {
              console.warn(`[REMINDER-WARNING] Failed to send WhatsApp reminder to ${appt.patient_id.phone}: ${waErr.message}`);
            }
          }

          count++;
        } catch (mailErr) {
          console.error(`[REMINDER-ERROR] Failed to send email to ${appt.patient_id.email}: ${mailErr.message}`);
          errors++;
        }
      }
    }

    res.json({
      ok: true,
      message: 'Reminders processing completed.',
      reminders_sent: count,
      errors_encountered: errors,
      date_processed: tomorrow_str
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET & POST /api/cron/send-medicine-reminders
router.all('/api/cron/send-medicine-reminders', async (req, res) => {
  const nowStr = new Date().toISOString();

  try {
    const due_reminders = await MedicineReminder.find({
      is_active: true,
      next_trigger_at: { $lte: nowStr }
    }).populate('patient_id');

    let sent_count = 0;
    let errors = 0;

    for (const mr of due_reminders) {
      if (!mr.patient_id) continue;

      const pname = mr.patient_id.full_name;
      const pphone = mr.patient_id.phone;
      const med_name = mr.medicine_name;
      const remind_time = mr.remind_time;
      const freq = (mr.frequency || 'DAILY').toUpperCase();
      const rx_id = mr.prescription_id || 'CUSTOM';

      let whatsapp_sent = false;
      if (pphone) {
        try {
          const waBody = `Hello ${pname},\n\nThis is a reminder from UltraCare to take your medicine:\n💊 *${med_name}* (${freq.toLowerCase()})\n\n⏰ Scheduled Time: ${remind_time}\n📄 Prescription: ${rx_id}\n\nStay healthy! ❤️\n— The UltraCare Team`;
          whatsapp_sent = await sendWhatsappMessage(pphone, waBody);
        } catch (err) {
          console.error(`[MED-REMINDER-ERROR] Failed sending WhatsApp to ${pphone}: ${err.message}`);
          errors++;
        }
      }

      // Update next trigger time
      try {
        let currentTrigger = new Date(mr.next_trigger_at);
        if (isNaN(currentTrigger.getTime())) {
          currentTrigger = new Date();
        }

        const nextTrigger = new Date(currentTrigger.getTime());
        if (freq === 'WEEKLY') {
          nextTrigger.setDate(nextTrigger.getDate() + 7);
        } else { // DAILY
          nextTrigger.setDate(nextTrigger.getDate() + 1);
        }

        // Guarantee next trigger is in the future
        while (nextTrigger <= new Date()) {
          nextTrigger.setDate(nextTrigger.getDate() + 1);
        }

        mr.next_trigger_at = nextTrigger.toISOString();
        await mr.save();

        if (whatsapp_sent) {
          sent_count++;
        }
      } catch (saveErr) {
        console.error(`[MED-REMINDER-SAVE-ERROR] Failed to save reminder trigger roll: ${saveErr.message}`);
        errors++;
      }
    }

    res.json({
      ok: true,
      message: 'Medicine reminders processed.',
      reminders_processed: due_reminders.length,
      reminders_sent_via_whatsapp: sent_count,
      errors_encountered: errors
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
