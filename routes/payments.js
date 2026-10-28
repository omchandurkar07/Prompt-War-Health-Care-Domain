const express = require('express');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { patientRequired, adminRequired } = require('../middleware/auth');
const {
  getPaymentMode,
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature
} = require('../services/paymentService');

const router = express.Router();
const isObjectId = value => mongoose.Types.ObjectId.isValid(value);

const applyCapturedPayment = async (payment, gatewayPayment) => {
  if (
    gatewayPayment.order_id !== payment.razorpay_order_id ||
    gatewayPayment.amount !== payment.amount_paise ||
    gatewayPayment.currency !== payment.currency ||
    gatewayPayment.status !== 'captured'
  ) {
    return false;
  }

  const appointment = await Appointment.findById(payment.appointment_id);
  if (!appointment) return false;

  payment.razorpay_payment_id = gatewayPayment.id;
  payment.status = 'paid';
  payment.paid_at = payment.paid_at || new Date();
  payment.updated_at = new Date();

  if (appointment.status === 'confirmed') {
    appointment.payment_status = 'completed';
  } else if (payment.refund_status === 'none') {
    payment.refund_status = 'requested';
    payment.refund_requested_at = new Date();
    payment.refund_note = 'Payment arrived after the appointment was no longer confirmed. Administrator review is required.';
    appointment.payment_status = 'refund_requested';
  }

  await Promise.all([payment.save(), appointment.save()]);
  return true;
};

const handleAppointmentCancellation = async (req, res) => {
  const { aid } = req.params;
  if (!isObjectId(aid)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });

  try {
    const appointment = await Appointment.findOne({ _id: aid, patient_id: req.session.patient_id });
    if (!appointment) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return res.status(409).json({ ok: false, error: 'This appointment can no longer be cancelled.' });
    }

    const payment = await Payment.findOne({ appointment_id: appointment._id, patient_id: req.session.patient_id });
    const wasPaid = payment?.status === 'paid';
    if (payment?.status === 'paid') {
      if (payment.payment_mode === 'simulation') {
        payment.status = 'refunded';
        payment.refund_status = 'processed';
        payment.refund_note = 'Demo payment voided; no money was charged.';
        payment.updated_at = new Date();
        await payment.save();
        appointment.payment_status = 'refunded';
      } else {
        if (payment.refund_status !== 'none') {
          return res.status(409).json({ ok: false, error: 'A refund request already exists for this appointment.' });
        }
        payment.refund_status = 'requested';
        payment.refund_requested_at = new Date();
        payment.refund_note = 'Patient requested cancellation and refund.';
        payment.updated_at = new Date();
        await payment.save();
        appointment.payment_status = 'refund_requested';
      }
    } else if (payment && ['created', 'creating'].includes(payment.status)) {
      payment.status = 'failed';
      payment.updated_at = new Date();
      await payment.save();
    }

    appointment.status = 'cancelled';
    appointment.updated_at = new Date();
    await appointment.save();

    await Notification.create({
      user_id: appointment.doctor_id,
      user_type: 'doctor',
      title: 'Appointment Cancelled',
      message: 'A patient cancelled their appointment.',
      link: '/doctor/appointments'
    });

    res.json({
      ok: true,
      message: wasPaid
        ? payment.payment_mode === 'simulation'
          ? 'Appointment cancelled. The demo payment was voided; no money was charged.'
          : 'Appointment cancelled. Your refund request is waiting for administrator review.'
        : 'Appointment cancelled.'
    });
  } catch (error) {
    console.error('[PAYMENT] Cancellation/refund request failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Unable to cancel this appointment.' });
  }
};

router.post('/appointment/cancel/:aid', patientRequired, handleAppointmentCancellation);
router.post('/payments/refund-request/:aid', patientRequired, handleAppointmentCancellation);

router.get('/payments/config', patientRequired, (req, res) => {
  try {
    const mode = getPaymentMode();
    return res.json({
      ok: true,
      payment_mode: mode,
      currency: 'INR',
      ...(mode === 'razorpay' ? { key_id: process.env.RAZORPAY_KEY_ID } : {})
    });
  } catch (error) {
    return res.status(error.status || 503).json({ ok: false, error: error.message });
  }
});

router.get('/payments/history', patientRequired, async (req, res) => {
  try {
    const payments = await Payment.find({ patient_id: req.session.patient_id })
      .populate('appointment_id', 'appt_date time_slot status fee')
      .populate('doctor_id', 'full_name specialization')
      .sort({ created_at: -1 })
      .limit(50);
    res.json({ ok: true, payments });
  } catch (error) {
    console.error('[PAYMENT] History lookup failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Unable to load payment history.' });
  }
});

router.post('/payments/order/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  if (!isObjectId(aid)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });

  try {
    const appointment = await Appointment.findOne({ _id: aid, patient_id: req.session.patient_id });
    if (!appointment) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    if (appointment.status !== 'confirmed') {
      return res.status(409).json({ ok: false, error: 'Payment is available after the doctor confirms the appointment.' });
    }
    if (appointment.payment_status === 'completed') {
      return res.status(409).json({ ok: false, error: 'This appointment is already paid.' });
    }

    const amountPaise = Math.round(Number(appointment.fee) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ ok: false, error: 'This appointment does not have a payable fee.' });
    }

    const paymentMode = getPaymentMode();
    let payment = await Payment.findOne({ appointment_id: appointment._id });
    if (payment?.status === 'paid') {
      return res.status(409).json({ ok: false, error: 'This appointment is already paid.' });
    }
    if (payment?.refund_status === 'requested' || payment?.refund_status === 'processing') {
      return res.status(409).json({ ok: false, error: 'A refund request is already being reviewed.' });
    }

    if (paymentMode === 'simulation') {
      if (payment?.status === 'created' && payment.payment_mode === 'simulation') {
        return res.json({
          ok: true,
          payment_mode: 'simulation',
          amount: payment.amount_paise,
          currency: payment.currency
        });
      }
      if (payment?.status === 'created') {
        return res.status(409).json({ ok: false, error: 'A payment using a different method is already in progress.' });
      }
      if (payment) {
        const locked = await Payment.findOneAndUpdate(
          { _id: payment._id, status: { $in: ['pending', 'failed'] } },
          { $set: { status: 'creating', payment_mode: 'simulation', amount_paise: amountPaise, updated_at: new Date() } },
          { new: true }
        );
        if (!locked) return res.status(409).json({ ok: false, error: 'Payment setup is already in progress. Try again shortly.' });
        payment = locked;
      } else {
        try {
          payment = await Payment.create({
            appointment_id: appointment._id,
            patient_id: appointment.patient_id,
            doctor_id: appointment.doctor_id,
            amount_paise: amountPaise,
            payment_mode: 'simulation',
            status: 'creating'
          });
        } catch (error) {
          if (error.code === 11000) {
            return res.status(409).json({ ok: false, error: 'Payment setup is already in progress. Try again shortly.' });
          }
          throw error;
        }
      }

      payment.status = 'created';
      payment.amount_paise = amountPaise;
      payment.payment_mode = 'simulation';
      payment.updated_at = new Date();
      await payment.save();
      return res.json({
        ok: true,
        payment_mode: 'simulation',
        amount: amountPaise,
        currency: payment.currency,
        message: 'Demo payment only. No money will be charged.'
      });
    }

    if (payment?.status === 'created' && payment.razorpay_order_id) {
      return res.json({
        ok: true,
        payment_mode: 'razorpay',
        key_id: process.env.RAZORPAY_KEY_ID,
        order_id: payment.razorpay_order_id,
        amount: payment.amount_paise,
        currency: payment.currency
      });
    }
    const razorpay = getRazorpayClient();

    if (payment) {
      const locked = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          $or: [
            { status: { $in: ['pending', 'failed'] } },
            { status: 'created', payment_mode: 'simulation' }
          ]
        },
        { $set: { status: 'creating', payment_mode: 'razorpay', amount_paise: amountPaise, updated_at: new Date() } },
        { new: true }
      );
      if (!locked) return res.status(409).json({ ok: false, error: 'Payment setup is already in progress. Try again shortly.' });
      payment = locked;
    } else {
      try {
        payment = await Payment.create({
          appointment_id: appointment._id,
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          amount_paise: amountPaise,
          payment_mode: 'razorpay',
          status: 'creating'
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ ok: false, error: 'Payment setup is already in progress. Try again shortly.' });
        }
        throw error;
      }
    }

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `appt_${appointment._id}`,
        notes: {
          appointment_id: String(appointment._id),
          patient_id: String(appointment.patient_id)
        }
      });
      payment.razorpay_order_id = order.id;
      payment.status = 'created';
      payment.updated_at = new Date();
      await payment.save();

      res.json({
        ok: true,
        payment_mode: 'razorpay',
        key_id: process.env.RAZORPAY_KEY_ID,
        order_id: order.id,
        amount: amountPaise,
        currency: 'INR'
      });
    } catch (error) {
      payment.status = 'failed';
      payment.updated_at = new Date();
      await payment.save();
      throw error;
    }
  } catch (error) {
    console.error('[PAYMENT] Order creation failed:', error.message || error);
    res.status(error.status || 502).json({ ok: false, error: error.status ? error.message : 'Unable to start checkout. Please try again.' });
  }
});

router.post('/payments/simulate/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  if (!isObjectId(aid)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });

  try {
    if (getPaymentMode() !== 'simulation') {
      return res.status(409).json({ ok: false, error: 'Simulation payments are only available when Razorpay is not configured.' });
    }

    const appointment = await Appointment.findOne({
      _id: aid,
      patient_id: req.session.patient_id,
      status: 'confirmed'
    });
    if (!appointment) {
      return res.status(404).json({ ok: false, error: 'Confirmed appointment not found.' });
    }
    if (appointment.payment_status === 'completed') {
      return res.status(409).json({ ok: false, error: 'This appointment is already paid.' });
    }

    const amountPaise = Math.round(Number(appointment.fee) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ ok: false, error: 'This appointment does not have a payable fee.' });
    }

    const payment = await Payment.findOneAndUpdate(
      {
        appointment_id: appointment._id,
        patient_id: req.session.patient_id,
        payment_mode: 'simulation',
        status: 'created',
        amount_paise: amountPaise
      },
      { $set: { status: 'paid', paid_at: new Date(), updated_at: new Date() } },
      { new: true }
    );
    if (!payment) {
      return res.status(409).json({ ok: false, error: 'Demo payment session expired. Start the payment again.' });
    }

    appointment.payment_status = 'completed';
    appointment.updated_at = new Date();
    await appointment.save();

    return res.json({
      ok: true,
      status: 'paid',
      payment_mode: 'simulation',
      message: 'Demo payment recorded. No money was charged.'
    });
  } catch (error) {
    console.error('[PAYMENT] Simulation failed:', error.message || error);
    res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Unable to complete demo payment.' });
  }
});

router.post('/payments/verify/:aid', patientRequired, async (req, res) => {
  const { aid } = req.params;
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!isObjectId(aid) || !verifyPaymentSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ ok: false, error: 'Payment verification failed.' });
  }

  try {
    if (getPaymentMode() !== 'razorpay') {
      return res.status(409).json({ ok: false, error: 'Razorpay verification is unavailable in simulation mode.' });
    }
    const payment = await Payment.findOne({
      appointment_id: aid,
      patient_id: req.session.patient_id,
      razorpay_order_id: orderId
    });
    if (!payment) return res.status(404).json({ ok: false, error: 'Payment order not found.' });
    if (payment.status === 'paid' && payment.razorpay_payment_id === paymentId) {
      return res.json({ ok: true, status: payment.refund_status === 'none' ? 'paid' : payment.refund_status });
    }

    const gatewayPayment = await getRazorpayClient().payments.fetch(paymentId);
    if (gatewayPayment.order_id !== orderId || gatewayPayment.amount !== payment.amount_paise) {
      return res.status(400).json({ ok: false, error: 'Payment details do not match this appointment.' });
    }
    if (gatewayPayment.status === 'authorized') {
      await getRazorpayClient().payments.capture(paymentId, payment.amount_paise, payment.currency);
      gatewayPayment.status = 'captured';
    }
    const verified = await applyCapturedPayment(payment, gatewayPayment);
    if (!verified) return res.status(409).json({ ok: false, error: 'Payment is not captured or appointment state changed.' });

    res.json({ ok: true, status: payment.refund_status === 'none' ? 'paid' : payment.refund_status });
  } catch (error) {
    console.error('[PAYMENT] Verification failed:', error.message || error);
    res.status(502).json({ ok: false, error: 'Payment could not be verified yet. Refresh your payment history before retrying.' });
  }
});

router.get('/admin/payment-refunds', adminRequired, async (req, res) => {
  try {
    const requests = await Payment.find({ refund_status: { $in: ['requested', 'processing', 'failed'] } })
      .populate('patient_id', 'full_name email')
      .populate('doctor_id', 'full_name')
      .populate('appointment_id', 'appt_date time_slot status')
      .sort({ refund_requested_at: 1 });
    res.json({ ok: true, requests });
  } catch (error) {
    console.error('[PAYMENT] Refund queue lookup failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Unable to load refund requests.' });
  }
});

router.post('/admin/payment-refunds/:paymentId/decision', adminRequired, async (req, res) => {
  const { paymentId } = req.params;
  const { decision, note = '' } = req.body;
  if (!isObjectId(paymentId) || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ ok: false, error: 'Invalid refund decision.' });
  }

  try {
    if (decision === 'reject') {
      const payment = await Payment.findOneAndUpdate(
        { _id: paymentId, refund_status: 'requested' },
        {
          $set: {
            refund_status: 'rejected',
            refund_decided_at: new Date(),
            refund_decided_by: req.session.admin_id,
            refund_note: String(note).slice(0, 500),
            updated_at: new Date()
          }
        },
        { new: true }
      );
      if (!payment) return res.status(409).json({ ok: false, error: 'This refund request is no longer pending.' });
      await Appointment.updateOne({ _id: payment.appointment_id }, { $set: { payment_status: 'completed' } });
      return res.json({ ok: true, status: 'rejected' });
    }

    const simulatedPayment = await Payment.findOne({
      _id: paymentId,
      payment_mode: 'simulation',
      status: 'paid',
      refund_status: { $in: ['requested', 'failed'] }
    });
    if (simulatedPayment) {
      simulatedPayment.status = 'refunded';
      simulatedPayment.refund_status = 'processed';
      simulatedPayment.refund_decided_at = new Date();
      simulatedPayment.refund_decided_by = req.session.admin_id;
      simulatedPayment.refund_note = String(note || 'Demo payment voided; no money was charged.').slice(0, 500);
      simulatedPayment.updated_at = new Date();
      await simulatedPayment.save();
      await Appointment.updateOne({ _id: simulatedPayment.appointment_id }, { $set: { payment_status: 'refunded' } });
      return res.json({ ok: true, status: 'processed', payment_mode: 'simulation' });
    }

    let razorpay;
    try {
      razorpay = getRazorpayClient();
    } catch (error) {
      return res.status(error.status || 503).json({ ok: false, error: error.message });
    }

    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: 'paid', refund_status: { $in: ['requested', 'failed'] } },
      {
        $set: {
          refund_status: 'processing',
          refund_decided_at: new Date(),
          refund_decided_by: req.session.admin_id,
          refund_note: String(note).slice(0, 500),
          updated_at: new Date()
        }
      },
      { new: true }
    );
    if (!payment) return res.status(409).json({ ok: false, error: 'This refund request cannot be approved.' });

    try {
      const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: payment.amount_paise,
        notes: { appointment_id: String(payment.appointment_id), admin_id: String(req.session.admin_id) }
      });
      payment.refund_id = refund.id || '';
      payment.refund_status = refund.status === 'processed' ? 'processed' : 'processing';
      if (payment.refund_status === 'processed') payment.status = 'refunded';
      payment.updated_at = new Date();
      await payment.save();
      if (payment.refund_status === 'processed') {
        await Appointment.updateOne({ _id: payment.appointment_id }, { $set: { payment_status: 'refunded' } });
      }
      return res.json({ ok: true, status: payment.refund_status });
    } catch (error) {
      payment.refund_note = 'Provider response is uncertain. Check the Razorpay dashboard and wait for webhook reconciliation before retrying.';
      payment.updated_at = new Date();
      await payment.save();
      console.error('[PAYMENT] Gateway refund failed:', error.message || error);
      return res.status(502).json({ ok: false, error: 'Refund status is uncertain. Check payment history and the provider dashboard before retrying.' });
    }
  } catch (error) {
    console.error('[PAYMENT] Refund decision failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Unable to update refund request.' });
  }
});

router.post('/payments/webhook', async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(400).json({ ok: false, error: 'Invalid webhook signature.' });
  }

  try {
    const event = req.body?.event;
    if (event === 'payment.captured') {
      const gatewayPayment = req.body.payload?.payment?.entity;
      if (gatewayPayment?.order_id) {
        const payment = await Payment.findOne({ razorpay_order_id: gatewayPayment.order_id });
        if (payment && payment.status !== 'paid') await applyCapturedPayment(payment, gatewayPayment);
      }
    } else if (event === 'refund.processed' || event === 'refund.failed') {
      const refund = req.body.payload?.refund?.entity;
      if (refund?.payment_id) {
        const payment = await Payment.findOne({ razorpay_payment_id: refund.payment_id });
        if (payment) {
          payment.refund_id = refund.id || payment.refund_id;
          payment.refund_status = event === 'refund.processed' ? 'processed' : 'failed';
          if (event === 'refund.processed') payment.status = 'refunded';
          payment.updated_at = new Date();
          await payment.save();
          if (event === 'refund.processed') {
            await Appointment.updateOne({ _id: payment.appointment_id }, { $set: { payment_status: 'refunded' } });
          }
        }
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('[PAYMENT] Webhook processing failed:', error.message || error);
    res.status(500).json({ ok: false, error: 'Webhook processing failed.' });
  }
});

module.exports = router;
