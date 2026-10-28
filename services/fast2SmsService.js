const axios = require('axios');

const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/otp';

const getFast2SmsConfig = () => {
  const apiKey = process.env.FAST2SMS_KEY || process.env.FAST2SMS_API_KEY;
  const otpId = process.env.FAST2SMS_OTP_ID;

  if (!apiKey) {
    throw new Error('Fast2SMS is not configured. Set FAST2SMS_KEY in .env.');
  }
  if (!otpId) {
    throw new Error('Fast2SMS OTP template is not configured. Set FAST2SMS_OTP_ID in .env.');
  }

  return { apiKey, otpId };
};

const normalizePhone = (phone) => {
  const normalized = String(phone || '').replace(/\D/g, '');
  const nationalNumber = normalized.startsWith('91') && normalized.length === 12
    ? normalized.slice(2)
    : normalized;

  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error('A valid 10-digit Indian mobile number is required for SMS OTP.');
  }

  return nationalNumber;
};

const providerMessage = (data, fallback) => (
  typeof data?.message === 'string' && data.message.trim()
    ? data.message.trim()
    : fallback
);

const sendFast2SmsOtp = async (phone, otp) => {
  const { apiKey, otpId } = getFast2SmsConfig();
  const mobile = normalizePhone(phone);
  const response = await axios.post(
    `${FAST2SMS_BASE_URL}/send`,
    {
      mobile,
      otp_id: otpId,
      otp_expiry: 5,
      otp_length: 6,
      otp: String(otp),
    },
    {
      headers: { Authorization: apiKey },
      timeout: 15000,
    }
  );

  if (response.data?.return !== true) {
    throw new Error(providerMessage(response.data, 'Fast2SMS did not accept the OTP request.'));
  }

  return true;
};

const verifyFast2SmsOtp = async (phone, otp) => {
  const { apiKey } = getFast2SmsConfig();
  const mobile = normalizePhone(phone);
  let response;
  try {
    response = await axios.post(
      `${FAST2SMS_BASE_URL}/verify`,
      { mobile, otp: String(otp) },
      {
        headers: { Authorization: apiKey },
        timeout: 15000,
      }
    );
  } catch (error) {
    if ([400, 404].includes(error.response?.status)) return false;
    throw new Error('Fast2SMS verification is unavailable. Please try again.');
  }

  return response.data?.return === true;
};

module.exports = {
  sendFast2SmsOtp,
  verifyFast2SmsOtp,
};
