import { supabaseAdmin } from '../../../lib/supabase';
import { getGoogleAccessToken } from '../../../lib/google-auth';

export default async function handler(req, res) {
  const { gmail_id, attachment_id, filename } = req.query;

  if (!gmail_id || !attachment_id) {
    return res.status(400).json({ error: 'gmail_id and attachment_id are required' });
  }

  // Verify email exists in our DB
  const { data: email } = await supabaseAdmin
    .from('emails')
    .select('gmail_id')
    .eq('gmail_id', gmail_id)
    .single();

  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_id}/attachments/${attachment_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!gmailRes.ok) {
      const err = await gmailRes.text();
      return res.status(502).json({ error: 'Gmail attachment fetch failed', details: err });
    }

    const { data } = await gmailRes.json();
    const buffer = Buffer.from(data, 'base64url');

    const safeName = (filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Attachment download error:', err);
    return res.status(500).json({ error: err.message });
  }
}
