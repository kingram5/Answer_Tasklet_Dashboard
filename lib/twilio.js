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
// Uses Messaging Service SID when available (required after A2P 10DLC registration),
// falls back to direct phone number for backwards compat.
export async function sendSMS(to, body) {
  const client = getTwilioClient();
  const truncated = body.length > 1600 ? body.slice(0, 1597) + '...' : body;
  const params = { to, body: truncated };

  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  } else {
    params.from = process.env.TWILIO_PHONE_NUMBER;
  }

  return client.messages.create(params);
}

// Escape XML special characters for TwiML responses
export function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
