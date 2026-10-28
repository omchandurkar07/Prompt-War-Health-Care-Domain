const twilio = require('twilio');

const sendWhatsappMessage = async (toPhone, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsapp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    console.warn('[TWILIO-WARN] Twilio Account SID or Auth Token missing from environment variables. WhatsApp message skipped.');
    return false;
  }

  try {
    // 1. Clean the recipient phone number (keep only digits and +)
    let phoneCleaned = String(toPhone).replace(/[^\d+]/g, '');

    // 2. Add country code if not present (assuming Indian numbers +91 by default if 10 digits)
    if (!phoneCleaned.startsWith('+')) {
      if (phoneCleaned.length === 10) {
        phoneCleaned = '+91' + phoneCleaned;
      } else {
        phoneCleaned = '+' + phoneCleaned;
      }
    }

    // 3. Format as 'whatsapp:+number'
    const toFormatted = phoneCleaned.startsWith('whatsapp:') ? phoneCleaned : `whatsapp:${phoneCleaned}`;
    const fromFormatted = fromWhatsapp.startsWith('whatsapp:') ? fromWhatsapp : `whatsapp:${fromWhatsapp}`;

    console.log(`[TWILIO-SEND] Attempting to send WhatsApp message to ${toFormatted} from ${fromFormatted}...`);

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from: fromFormatted,
      body: body,
      to: toFormatted
    });

    console.log(`[TWILIO-SUCCESS] Message successfully queued! SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`[TWILIO-FAILURE] Failed to send WhatsApp message to ${toPhone}: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendWhatsappMessage
};
