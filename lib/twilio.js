import twilio from 'twilio';

// Twilio client for sending SMS
export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Validate inbound Twilio webhook signature
// Use TWILIO_WEBHOOK_URL env var on Vercel to avoid host header mismatch behind proxy
export function validateTwilioRequest(req) {
  const signature = req.headers['x-twilio-signature'];
  const url = process.env.TWILIO_WEBHOOK_URL || `https://${req.headers.host}${req.url}`;
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );
}

// Send SMS via Twilio
export async function sendSMS(to, body) {
  const client = getTwilioClient();
  const truncated = body.length > 1600 ? body.slice(0, 1597) + '...' : body;
  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
    body: truncated,
  });
}
