// Local-only admin endpoint to re-fetch and re-classify emails for a specific date.
// Only works in development mode.
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { getGoogleAccessToken } from '../../../lib/google-auth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Only available in development' });
  }

  // Default to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = req.query.date || yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

  // Convert to Gmail date format YYYY/MM/DD
  const [year, month, day] = dateStr.split('-');
  const nextDay = new Date(dateStr);
  nextDay.setDate(nextDay.getDate() + 1);
  const [ny, nm, nd] = nextDay.toISOString().split('T')[0].split('-');
  const gmailAfter = `${year}/${month}/${day}`;
  const gmailBefore = `${ny}/${nm}/${nd}`;

  try {
    const accessToken = await getGoogleAccessToken();

    // 1. Fetch all emails for the date range (read + unread)
    const query = encodeURIComponent(`after:${gmailAfter} before:${gmailBefore}`);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      return res.status(500).json({ error: 'Gmail API failed', details: err });
    }

    const listData = await listRes.json();
    const messageIds = (listData.messages || []).map(m => m.id);

    if (messageIds.length === 0) {
      return res.status(200).json({ message: `No emails found for ${dateStr}`, processed: 0 });
    }

    // 2. Delete existing email records for this date range
    const startOfDay = new Date(dateStr).toISOString();
    const endOfDay = new Date(`${ny}-${nm}-${nd}`).toISOString();
    const { error: deleteError } = await supabaseAdmin
      .from('emails')
      .delete()
      .gte('received_at', startOfDay)
      .lt('received_at', endOfDay);

    if (deleteError) {
      console.error('Delete failed:', deleteError);
      return res.status(500).json({ error: 'Failed to clear existing emails', details: deleteError });
    }

    // 3. Fetch full message details
    const emails = await Promise.all(messageIds.map(id => fetchGmailMessage(accessToken, id)));
    const validEmails = emails.filter(Boolean);

    if (validEmails.length === 0) {
      return res.status(200).json({ message: 'No valid emails to process', processed: 0 });
    }

    // 4. Fetch correction history
    const { data: corrections } = await supabaseAdmin
      .from('classifier_corrections')
      .select('original_class, corrected_class, subject_snapshot, sender_snapshot')
      .order('corrected_at', { ascending: false })
      .limit(20);

    const correctionHistory = (corrections || [])
      .map(c => `- Email from "${c.sender_snapshot}" with subject "${c.subject_snapshot}" was classified as ${c.original_class} but should have been ${c.corrected_class}.`)
      .join('\n');

    // 5. Classify
    let classifications;
    try {
      classifications = await classifyEmails(validEmails, correctionHistory);
    } catch (err) {
      console.error('Classification failed, defaulting to fyi:', err);
      classifications = validEmails.map(e => ({ gmail_id: e.gmail_id, classification: 'fyi', confidence: 0.0 }));
    }

    const classMap = new Map(classifications.map(c => [c.gmail_id, c]));

    // 6. Insert
    const emailRows = validEmails.map(e => {
      const cls = classMap.get(e.gmail_id) || { classification: 'fyi', confidence: 0.0 };
      return {
        gmail_id: e.gmail_id,
        thread_id: e.thread_id,
        subject: e.subject,
        sender: e.sender,
        sender_email: e.sender_email,
        snippet: e.snippet,
        body_preview: e.body_preview,
        classification: cls.classification,
        confidence: cls.confidence,
        is_read: true,
        is_starred: false,
        received_at: e.received_at,
        classified_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabaseAdmin.from('emails').insert(emailRows);
    if (insertError) {
      console.error('Insert failed:', insertError);
      return res.status(500).json({ error: 'Database insert failed', details: insertError });
    }

    const counts = emailRows.reduce((acc, e) => {
      acc[e.classification] = (acc[e.classification] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      message: `Retriaged ${validEmails.length} emails for ${dateStr}`,
      processed: validEmails.length,
      ...counts,
    });
  } catch (err) {
    console.error('Retriage error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function fetchGmailMessage(accessToken, messageId) {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;

    const msg = await res.json();
    const headers = msg.payload?.headers || [];
    const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const fromRaw = getHeader('From');
    const date = getHeader('Date');

    const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
    const sender = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromRaw;
    const sender_email = fromMatch ? fromMatch[2] : fromRaw;

    const body_preview = extractTextBody(msg.payload).slice(0, 500);

    return {
      gmail_id: msg.id,
      thread_id: msg.threadId,
      subject,
      sender,
      sender_email,
      snippet: msg.snippet || '',
      body_preview,
      received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch message ${messageId}:`, err);
    return null;
  }
}

function extractTextBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

async function classifyEmails(emails, correctionHistory) {
  const emailList = emails.map(e =>
    `gmail_id: ${e.gmail_id}\nFrom: ${e.sender} <${e.sender_email}>\nSubject: ${e.subject}\nPreview: ${e.body_preview?.slice(0, 300) || e.snippet}`
  ).join('\n---\n');

  const prompt = `You are an email classifier for Kyle Ingram, an Account Manager at Greentech Renewables selling solar equipment.

Classify each email as exactly one of:
- "action" — Requires Kyle's direct response or decision. Customer requests, manager asks from Paul Goerlich, time-sensitive logistics, discount approvals, credit issues, anything with Kyle's name specifically called out.
- "fyi" — Informational only. Team updates, newsletters, CC'd threads, status reports, shipping confirmations that don't need a response.
- "spam" — Marketing, vendor solicitations, irrelevant automated notifications, promotional emails.

IMPORTANT RULES:
- Bias toward "action" when uncertain. Missing a real action item is far worse than over-classifying.
- Emails from these known accounts are more likely action items: Mayer Solar, NXT Level, Synaptic, Kpost Roofing, Tarrant Roofing, Trojan Solar, Gamma Strategies, Just In Case, AguaSol, SolarTime, THS, Harvest, Sandhu Solar, Solar Scouts, Vantage Point.
- Emails from Paul Goerlich (paul.goerlich@greentechrenewables.com) are almost always action items.
- Kyle's work email (kyle.ingram@greentechrenewables.com) is auto-forwarded to Gmail. The original sender is in the email body — always check for it.

CORRECTION HISTORY (learn from these):
${correctionHistory || 'No corrections yet.'}

Emails to classify:
${emailList}

Respond with JSON array only, no other text:
[{"gmail_id": "...", "classification": "action|fyi|spam", "confidence": 0.0-1.0}]`;

  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in classification response');
  return JSON.parse(jsonMatch[0]);
}
