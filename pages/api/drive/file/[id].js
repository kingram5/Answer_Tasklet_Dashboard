import { getGoogleAccessToken } from '../../../../lib/google-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'File ID is required' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,modifiedTime,webViewLink,webContentLink,iconLink,size,owners`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      const err = await driveRes.text();
      console.error('Drive file fetch failed:', err);
      return res.status(driveRes.status === 404 ? 404 : 500).json({ error: 'File not found or inaccessible' });
    }

    const file = await driveRes.json();

    // Google Workspace files use webViewLink, others use webContentLink
    const isGoogleWorkspace = file.mimeType?.startsWith('application/vnd.google-apps.');

    return res.status(200).json({
      ...file,
      link: isGoogleWorkspace ? file.webViewLink : (file.webContentLink || file.webViewLink),
    });
  } catch (err) {
    console.error('Drive file error:', err);
    return res.status(500).json({ error: err.message });
  }
}
