const express = require('express');
const router = express.Router();

const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const QueueEntry = require('../models/QueueEntry');
const Notification = require('../models/Notification');
const { doctorRequired, patientRequired } = require('../middleware/auth');

// GET /doctor/queue
router.get('/doctor/queue', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Auto-populate queue from confirmed appointments for today
    const confirmed = await Appointment.find({
      doctor_id: did,
      appt_date: today,
      status: 'confirmed'
    }).populate('patient_id').populate('family_member_id').sort({ time_slot: 1 });

    // Check which are already in the queue
    const existingEntries = await QueueEntry.find({
      doctor_id: did,
      queue_date: today,
      appointment_id: { $ne: null }
    });
    const existingIds = existingEntries.map(e => e.appointment_id.toString());

    // Get current max queue position
    const maxPosEntry = await QueueEntry.findOne({ doctor_id: did, queue_date: today }).sort({ queue_position: -1 });
    let pos = maxPosEntry ? maxPosEntry.queue_position : 0;

    // Add missing appointments to the queue
    for (const appt of confirmed) {
      if (!existingIds.includes(appt._id.toString())) {
        pos += 1;
        const name = appt.family_member_id ? appt.family_member_id.name : (appt.patient_id ? appt.patient_id.full_name : 'Unknown');
        const newEntry = new QueueEntry({
          doctor_id: did,
          appointment_id: appt._id,
          patient_name: name,
          reason: appt.reason || '',
          queue_date: today,
          queue_position: pos,
          is_walkin: false
        });
        await newEntry.save();
      }
    }

    // Get the full sorted queue
    const queueDocs = await QueueEntry.find({
      doctor_id: did,
      queue_date: today
    }).populate('appointment_id').sort({ queue_position: 1 });

    const queue = queueDocs.map(qe => {
      return {
        ...qe.toObject(),
        id: qe._id,
        pid: qe.appointment_id ? qe.appointment_id.patient_id : null,
        time_slot: qe.appointment_id ? qe.appointment_id.time_slot : ''
      };
    });

    res.json({ ok: true, queue, today });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading queue manager.' });
  }
});

// POST /doctor/queue/add-walkin
router.post('/doctor/queue/add-walkin', doctorRequired, async (req, res) => {
  const did = req.session.doctor_id;
  const today = new Date().toISOString().split('T')[0];
  const name = (req.body.name || '').trim();
  const reason = req.body.reason || '';

  if (!name) {
    return res.status(400).json({ ok: false, error: 'Patient name is required.' });
  }

  try {
    const maxPosEntry = await QueueEntry.findOne({ doctor_id: did, queue_date: today }).sort({ queue_position: -1 });
    const pos = (maxPosEntry ? maxPosEntry.queue_position : 0) + 1;

    const newEntry = new QueueEntry({
      doctor_id: did,
      patient_name: name,
      reason,
      queue_date: today,
      queue_position: pos,
      is_walkin: true
    });
    await newEntry.save();

    res.json({ ok: true, message: `${name} added to queue as walk-in.`, entry: newEntry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error adding walk-in.' });
  }
});

// POST /doctor/queue/update
router.post('/doctor/queue/update', doctorRequired, async (req, res) => {
  const { entry_id, status: new_status } = req.body;
  const did = req.session.doctor_id;

  try {
    const entry = await QueueEntry.findOne({ _id: entry_id, doctor_id: did });
    if (!entry) {
      return res.json({ ok: false, error: 'Entry not found' });
    }

    const now = new Date().toISOString();

    if (new_status === 'now_serving') {
      // Set previous 'now_serving' back to waiting
      await QueueEntry.updateMany(
        { doctor_id: did, queue_date: entry.queue_date, queue_status: 'now_serving' },
        { queue_status: 'waiting', called_at: null }
      );
      entry.queue_status = 'now_serving';
      entry.called_at = now;
      await entry.save();

      // Notify patient
      if (entry.appointment_id) {
        const appt = await Appointment.findById(entry.appointment_id);
        if (appt) {
          const newNotif = new Notification({
            user_id: appt.patient_id,
            user_type: 'patient',
            title: '🔔 Your Turn!',
            message: 'You are being called in now. Please proceed to the consultation room.',
            link: `/queue/status/${entry.appointment_id}`
          });
          await newNotif.save();
        }
      }
    } else if (new_status === 'done') {
      entry.queue_status = 'done';
      entry.done_at = now;
      await entry.save();

      // If next patient is waiting, notify them they are next
      const nextEntry = await QueueEntry.findOne({
        doctor_id: did,
        queue_date: entry.queue_date,
        queue_status: 'waiting'
      }).sort({ queue_position: 1 }).populate('appointment_id');

      if (nextEntry && nextEntry.appointment_id) {
        const nextNotif = new Notification({
          user_id: nextEntry.appointment_id.patient_id,
          user_type: 'patient',
          title: "⏰ You're Next!",
          message: "You are now #1 in the queue. Get ready!",
          link: `/queue/status/${nextEntry.appointment_id._id}`
        });
        await nextNotif.save();
      }
    } else {
      entry.queue_status = new_status;
      await entry.save();
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.json({ ok: false, error: error.message });
  }
});

// GET /queue/status/:aid
router.get('/queue/status/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;

  try {
    const appt = await Appointment.findOne({ _id: aid, patient_id: pid }).populate('doctor_id');
    if (!appt) {
      return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    }

    const my_entry = await QueueEntry.findOne({ appointment_id: aid, queue_date: appt.appt_date });

    let position = null;
    let est_wait = null;

    if (my_entry) {
      if (my_entry.queue_status === 'done' || my_entry.queue_status === 'now_serving') {
        position = 0;
      } else {
        const ahead = await QueueEntry.countDocuments({
          doctor_id: appt.doctor_id._id,
          queue_date: appt.appt_date,
          queue_status: { $in: ['waiting', 'now_serving'] },
          queue_position: { $lt: my_entry.queue_position }
        });
        position = ahead + 1;

        // Estimate wait time from avg of last 3 done patients
        const lastDone = await QueueEntry.find({
          doctor_id: appt.doctor_id._id,
          queue_date: appt.appt_date,
          queue_status: 'done',
          called_at: { $ne: null },
          done_at: { $ne: null }
        }).sort({ done_at: -1 }).limit(3);

        let avg_mins = 15;
        if (lastDone.length > 0) {
          let totalMins = 0;
          lastDone.forEach(ld => {
            const diffMs = new Date(ld.done_at) - new Date(ld.called_at);
            totalMins += diffMs / (1000 * 60);
          });
          avg_mins = totalMins / lastDone.length;
        }

        est_wait = Math.round(avg_mins * ahead);
      }
    }

    res.json({
      ok: true,
      appt,
      entry: my_entry,
      position,
      est_wait
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading queue status.' });
  }
});

// GET /api/queue-status/:aid
router.get('/api/queue-status/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const pid = req.session.patient_id;

  try {
    const appt = await Appointment.findOne({ _id: aid, patient_id: pid });
    if (!appt) {
      return res.json({ ok: false });
    }

    const my_entry = await QueueEntry.findOne({ appointment_id: aid, queue_date: appt.appt_date });
    if (!my_entry) {
      return res.json({ ok: true, in_queue: false });
    }

    if (my_entry.queue_status === 'done' || my_entry.queue_status === 'now_serving') {
      return res.json({ ok: true, in_queue: true, status: my_entry.queue_status, position: 0, est_wait: 0 });
    }

    const ahead = await QueueEntry.countDocuments({
      doctor_id: appt.doctor_id,
      queue_date: appt.appt_date,
      queue_status: { $in: ['waiting', 'now_serving'] },
      queue_position: { $lt: my_entry.queue_position }
    });

    const lastDone = await QueueEntry.find({
      doctor_id: appt.doctor_id,
      queue_date: appt.appt_date,
      queue_status: 'done',
      called_at: { $ne: null },
      done_at: { $ne: null }
    }).sort({ done_at: -1 }).limit(3);

    let avg_mins = 15;
    if (lastDone.length > 0) {
      let totalMins = 0;
      lastDone.forEach(ld => {
        const diffMs = new Date(ld.done_at) - new Date(ld.called_at);
        totalMins += diffMs / (1000 * 60);
      });
      avg_mins = totalMins / lastDone.length;
    }

    res.json({
      ok: true,
      in_queue: true,
      status: my_entry.queue_status,
      position: ahead + 1,
      est_wait: Math.round(avg_mins * ahead)
    });
  } catch (error) {
    console.error(error);
    res.json({ ok: false, error: error.message });
  }
});

// GET /queue/public/:doctor_id/:queue_date
router.get('/queue/public/:doctor_id/:queue_date', async (req, res) => {
  const { doctor_id, queue_date } = req.params;

  try {
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found.' });
    }

    const entries = await QueueEntry.find({
      doctor_id,
      queue_date
    }).sort({ queue_position: 1 });

    res.json({
      ok: true,
      doctor,
      entries,
      queue_date
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error loading public queue.' });
  }
});

module.exports = router;
