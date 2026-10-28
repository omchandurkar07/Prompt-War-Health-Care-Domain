const crypto = require('crypto');
const Razorpay = require('razorpay');

const isConfiguredValue = value => Boolean(
  value && !/^(?:replace_me|rzp_test_replace_me|paste_your|your_)/i.test(value.trim())
);

const getPaymentMode = () => {
  const hasKeyId = isConfiguredValue(process.env.RAZORPAY_KEY_ID);
  const hasKeySecret = isConfiguredValue(process.env.RAZORPAY_KEY_SECRET);
  if (hasKeyId !== hasKeySecret) {
    const error = new Error('Razorpay requires both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    error.status = 503;
    throw error;
  }
  return hasKeyId ? 'razorpay' : 'simulation';
};

const getRazorpayClient = () => {
  if (getPaymentMode() !== 'razorpay') {
    const error = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    error.status = 503;
    throw error;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string') {
    return false;
  }
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false;
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

module.exports = {
  getPaymentMode,
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature
};
