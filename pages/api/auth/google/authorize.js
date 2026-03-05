// GET /api/auth/google/authorize
// Redirects to Google OAuth consent screen for Gmail + Calendar + Drive

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  }

  // CSRF state token
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/google/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
