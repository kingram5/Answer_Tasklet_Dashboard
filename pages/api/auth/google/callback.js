// GET /api/auth/google/callback
// Receives authorization code, exchanges for tokens, displays refresh token

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error: authError } = req.query;

  if (authError) {
    return res.status(400).send(`
      <html><body style="font-family:system-ui;padding:40px;background:#0a0a0f;color:#e5e7eb">
        <h1 style="color:#ef4444">Authorization Failed</h1>
        <p>Error: ${authError}</p>
        <p>Close this tab and try again.</p>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      return res.status(200).send(`
        <html><body style="font-family:system-ui;padding:40px;background:#0a0a0f;color:#e5e7eb">
          <h1 style="color:#f59e0b">Warning: No Refresh Token</h1>
          <p>Google didn't return a refresh token. This usually means you've already authorized this app.</p>
          <p>To fix: Go to <a href="https://myaccount.google.com/permissions" style="color:#60a5fa">Google Account Permissions</a>,
          remove "Answer Dashboard", then try <a href="/api/auth/google/authorize" style="color:#60a5fa">authorizing again</a>.</p>
        </body></html>
      `);
    }

    // Display the refresh token for Kyle to add to Vercel env vars
    return res.status(200).send(`
      <html><body style="font-family:system-ui;padding:40px;background:#0a0a0f;color:#e5e7eb;max-width:700px">
        <h1 style="color:#10b981">Google Connected</h1>
        <p>Gmail, Calendar, and Drive are now authorized.</p>
        <h2 style="color:#e5e7eb;margin-top:24px">Add this to Vercel Environment Variables:</h2>
        <p style="color:#9ca3af">Variable name: <code style="color:#60a5fa">GOOGLE_REFRESH_TOKEN</code></p>
        <div style="background:#1a1a2e;padding:16px;border-radius:8px;word-break:break-all;margin:12px 0">
          <code style="color:#10b981;font-size:14px">${tokens.refresh_token}</code>
        </div>
        <p style="color:#9ca3af;font-size:14px">After adding the env var to Vercel, redeploy. Then you can close this tab.</p>
      </body></html>
    `);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.status(500).send(`
      <html><body style="font-family:system-ui;padding:40px;background:#0a0a0f;color:#e5e7eb">
        <h1 style="color:#ef4444">Authorization Error</h1>
        <p>${err.message}</p>
      </body></html>
    `);
  }
}
