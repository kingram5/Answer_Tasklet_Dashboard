import { getGoogleAccessToken } from '../../../lib/google-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    const params = new URLSearchParams({
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)',
      pageSize: '20',
    });

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      const err = await driveRes.text();
      console.error('Drive recent failed:', err);
      return res.status(500).json({ error: 'Drive API failed' });
    }

    const data = await driveRes.json();
    return res.status(200).json({ files: data.files || [] });
  } catch (err) {
    console.error('Drive recent error:', err);
    return res.status(500).json({ error: err.message });
  }
}
