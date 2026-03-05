import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { getGoogleAccessToken } from '../../../lib/google-auth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  // Verify cron request is from Vercel
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    // 1. Fetch unread messages from Gmail
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      console.error('Gmail list failed:', err);
      return res.status(500).json({ error: 'Gmail API failed', details: err });
    }

    const listData = await listRes.json();
    const messageIds = (listData.messages || []).map(m => m.id);

    if (messageIds.length === 0) {
      return res.status(200).json({ message: 'No unread emails', processed: 0 });
    }

    // 2. Check which gmail_ids already exist in Supabase
    const { data: existing } = await supabaseAdmin
      .from('emails')
      .select('gmail_id')
      .in('gmail_id', messageIds);

    const existingIds = new Set((existing || []).map(e => e.gmail_id));
    const newMessageIds = messageIds.filter(id => !existingIds.has(id));

    if (newMessageIds.length === 0) {
      return res.status(200).json({ message: 'All emails already processed', processed: 0 });
    }

    // 3. Fetch full message details for new emails
    const emails = await Promise.all(
      newMessageIds.map(id => fetchGmailMessage(accessToken, id))
    );

    const validEmails = emails.filter(Boolean);
    if (validEmails.length === 0) {
      return res.status(200).json({ message: 'No valid emails to process', processed: 0 });
    }

    // 4. Fetch correction history for few-shot learning
    const { data: corrections } = await supabaseAdmin
      .from('classifier_corrections')
      .select('original_class, corrected_class, subject_snapshot, sender_snapshot')
      .order('corrected_at', { ascending: false })
      .limit(20);

    const correctionHistory = (corrections || [])
      .map(c => `- Email from "${c.sender_snapshot}" with subject "${c.subject_snapshot}" was classified as ${c.original_class} but should have been ${c.corrected_class}.`)
      .join('\n');

    // 5. Classify + Summarize emails (single Haiku call)
    let classifications;
    try {
      classifications = await classifyAndSummarize(validEmails, correctionHistory);
    } catch (classifyErr) {
      console.error('Classification failed, defaulting to fyi:', classifyErr);
      classifications = validEmails.map(e => ({
        gmail_id: e.gmail_id,
        classification: 'fyi',
        confidence: 0.0,
        summary: '',
      }));
    }

    // Build lookup map
    const classMap = new Map(classifications.map(c => [c.gmail_id, c]));

    // 6. Write classified emails to Supabase
    const emailRows = validEmails.map(e => {
      const cls = classMap.get(e.gmail_id) || { classification: 'fyi', confidence: 0.0, summary: '' };
      return {
        gmail_id: e.gmail_id,
        thread_id: e.thread_id,
        subject: e.subject,
        sender: e.sender,
        sender_email: e.sender_email,
        snippet: e.snippet,
        body_preview: e.body_preview,
        body_full: e.body_full,
        classification: cls.classification,
        confidence: cls.confidence,
        ai_summary: cls.summary || '',
        attachments: e.attachments,
        original_sender: e.original_sender,
        original_sender_email: e.original_sender_email,
        is_read: false,
        is_starred: false,
        received_at: e.received_at,
        classified_at: new Date().toISOString(),
      };
    });

    const { data: insertedEmails, error: insertError } = await supabaseAdmin
      .from('emails')
      .insert(emailRows)
      .select();

    if (insertError) {
      console.error('Supabase insert failed:', insertError);
      console.error('Email data that failed:', JSON.stringify(emailRows));
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // 7. Generate thread briefings (non-fatal, runs after insert)
    try {
      await generateThreadBriefings(insertedEmails || [], accessToken);
    } catch (briefErr) {
      console.error('Thread briefing generation failed (non-fatal):', briefErr);
    }

    // 8. Auto-create tasks for action items
    const actionEmails = (insertedEmails || []).filter(e => e.classification === 'action');
    let tasksCreated = 0;

    if (actionEmails.length > 0) {
      try {
        tasksCreated = await createTasksFromActions(actionEmails);
      } catch (taskErr) {
        console.error('Task auto-creation failed:', taskErr);
      }
    }

    // 9. Mark classified emails as read in Gmail
    const markReadPromises = newMessageIds.map(id =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }).catch(err => console.error(`Failed to mark ${id} as read:`, err))
    );

    await Promise.all(markReadPromises);

    return res.status(200).json({
      message: 'Email triage complete',
      processed: validEmails.length,
      action: actionEmails.length,
      tasksCreated,
    });
  } catch (err) {
    console.error('Email triage cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Fetch a single Gmail message and extract fields (enhanced with full body, attachments, original sender)
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

    // Parse sender name and email
    const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
    const sender = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromRaw;
    const sender_email = fromMatch ? fromMatch[2] : fromRaw;

    // Extract full body text
    const bodyText = extractTextBody(msg.payload);
    const body_full = bodyText.slice(0, 10000); // Cap at 10K chars for DB
    const body_preview = bodyText.slice(0, 500);

    // Extract attachments metadata
    const attachments = extractAttachments(msg.payload);

    // Parse original sender from forwarded email body
    const { original_sender, original_sender_email } = parseOriginalSender(bodyText, sender, sender_email);

    return {
      gmail_id: msg.id,
      thread_id: msg.threadId,
      subject,
      sender,
      sender_email,
      snippet: msg.snippet || '',
      body_preview,
      body_full,
      attachments,
      original_sender,
      original_sender_email,
      received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to fetch message ${messageId}:`, err);
    return null;
  }
}

// Parse original sender from forwarded email body (Outlook format)
function parseOriginalSender(bodyText, fallbackSender, fallbackEmail) {
  if (!bodyText) return { original_sender: fallbackSender, original_sender_email: fallbackEmail };

  // Look for From: line after Outlook separator (________) or dashes
  const afterSep = bodyText.match(/(?:_{4,}|[-]{4,}[^-]*[-]{4,})\s*[\r\n]+From:\s*(.+?)(?:\r?\n|$)/i);
  const fromLine = afterSep ? afterSep[1].trim() : null;

  if (!fromLine) {
    // Fall back to first From: line in the body (skip the Gmail header From)
    const match = bodyText.match(/From:\s*(.+?)(?:\r?\n|$)/);
    if (!match) return { original_sender: fallbackSender, original_sender_email: fallbackEmail };
    return parseFromLine(match[1].trim(), fallbackSender, fallbackEmail);
  }

  return parseFromLine(fromLine, fallbackSender, fallbackEmail);
}

function parseFromLine(fromLine, fallbackSender, fallbackEmail) {
  // Try "Name <email>" format
  const emailMatch = fromLine.match(/^(.+?)\s*<(.+?)>$/);
  if (emailMatch) {
    return {
      original_sender: emailMatch[1].replace(/"/g, '').trim(),
      original_sender_email: emailMatch[2].trim(),
    };
  }
  // Try "Name [mailto:email]" format (Outlook)
  const mailtoMatch = fromLine.match(/^(.+?)\s*\[mailto:(.+?)\]/);
  if (mailtoMatch) {
    return {
      original_sender: mailtoMatch[1].replace(/"/g, '').trim(),
      original_sender_email: mailtoMatch[2].trim(),
    };
  }
  // If it looks like just an email
  if (fromLine.includes('@')) {
    return { original_sender: fromLine, original_sender_email: fromLine };
  }
  return { original_sender: fallbackSender, original_sender_email: fallbackEmail };
}

// Extract attachment metadata from Gmail payload
function extractAttachments(payload) {
  const attachments = [];
  collectAttachments(payload, attachments);
  return attachments;
}

function collectAttachments(part, attachments) {
  if (!part) return;
  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
    // Skip inline images (email signatures, footer logos)
    const headers = part.headers || [];
    const disposition = headers.find(h => h.name?.toLowerCase() === 'content-disposition')?.value || '';
    if (disposition.toLowerCase().startsWith('inline')) return;
    // Skip generic image filenames (Outlook signature pattern like image001.png)
    if (part.mimeType?.startsWith('image/') && /^image\d*\.(png|jpe?g|gif|bmp)$/i.test(part.filename)) return;

    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
    });
  }
  if (part.parts) {
    for (const child of part.parts) {
      collectAttachments(child, attachments);
    }
  }
}

// Recursively extract text/plain body from Gmail message payload
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

  // Fallback to HTML if no plain text
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return '';
}

// Combined classification + summary in a single Haiku call
async function classifyAndSummarize(emails, correctionHistory) {
  const emailList = emails.map(e =>
    `gmail_id: ${e.gmail_id}\nFrom: ${e.original_sender || e.sender} <${e.original_sender_email || e.sender_email}>\nSubject: ${e.subject}\nPreview: ${(e.body_full || e.body_preview || e.snippet).slice(0, 2000)}`
  ).join('\n---\n');

  const prompt = `You are an email classifier and summarizer for Kyle Ingram, an Account Manager at Greentech Renewables selling solar equipment.

For each email, classify it AND write a 1-2 sentence summary.

Classification categories:
- "action" — Requires Kyle's direct response or decision. Customer requests, manager asks from Paul Goerlich, time-sensitive logistics, discount approvals, credit issues, anything with Kyle's name specifically called out.
- "fyi" — Informational only. Team updates, newsletters, CC'd threads, status reports, shipping confirmations that don't need a response.
- "spam" — Marketing, vendor solicitations, irrelevant automated notifications, promotional emails.

IMPORTANT RULES:
- Bias toward "action" when uncertain. Missing a real action item is far worse than over-classifying.
- Emails from these known accounts are more likely action items: Mayer Solar, NXT Level, Synaptic, Kpost Roofing, Tarrant Roofing, Trojan Solar, Gamma Strategies, Just In Case, AguaSol, SolarTime, THS, Harvest, Sandhu Solar, Solar Scouts, Vantage Point.
- Emails from Paul Goerlich (paul.goerlich@greentechrenewables.com) are almost always action items.
- Kyle's work email (kyle.ingram@greentechrenewables.com) is auto-forwarded to Gmail. The original sender is in the email body — always check for it.

Summary guidelines:
- 1-2 sentences max. Be specific about what's needed or what happened.
- For action items, lead with what Kyle needs to do.
- For FYI, summarize the key information.
- For spam, keep it very brief.

CORRECTION HISTORY (learn from these):
${correctionHistory || 'No corrections yet.'}

Emails to classify and summarize:
${emailList}

Respond with JSON array only, no other text:
[{"gmail_id": "...", "classification": "action|fyi|spam", "confidence": 0.0-1.0, "summary": "1-2 sentence summary"}]`;

  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in classification response');

  return JSON.parse(jsonMatch[0]);
}

// Generate thread briefings for emails that belong to multi-email threads
async function generateThreadBriefings(insertedEmails, accessToken) {
  // Get unique thread IDs from newly inserted emails
  const threadIds = [...new Set(insertedEmails.map(e => e.thread_id).filter(Boolean))];
  if (threadIds.length === 0) return;

  for (const threadId of threadIds) {
    try {
      // Fetch all emails in this thread from Supabase
      const { data: threadEmails } = await supabaseAdmin
        .from('emails')
        .select('gmail_id, subject, sender, sender_email, original_sender, original_sender_email, body_preview, received_at')
        .eq('thread_id', threadId)
        .order('received_at', { ascending: true });

      // Only generate briefings for threads with 2+ emails
      if (!threadEmails || threadEmails.length < 2) continue;

      const threadContext = threadEmails.map((e, i) => {
        const senderName = e.original_sender || e.sender;
        return `Message ${i + 1} (${new Date(e.received_at).toLocaleDateString()}) from ${senderName}:\n${(e.body_preview || '').slice(0, 300)}`;
      }).join('\n---\n');

      const prompt = `Summarize this email thread chronologically. Write one short bullet point per message. Use first names only. Mark the last message.

Thread subject: ${threadEmails[0]?.subject || 'Unknown'}

${threadContext}

Respond with JSON array only:
[{"sender": "FirstName", "action": "short description of what they did/said", "is_last": false}]
The last entry should have "is_last": true.`;

      const response = await anthropic.messages.create({
        model: CLASSIFIER_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const briefing = JSON.parse(jsonMatch[0]);

      // Update ALL emails in this thread with the briefing
      await supabaseAdmin
        .from('emails')
        .update({ thread_briefing: briefing })
        .eq('thread_id', threadId);
    } catch (err) {
      console.error(`Thread briefing failed for thread ${threadId}:`, err);
      // Non-fatal, continue to next thread
    }
  }
}

// Auto-create tasks for action item emails
async function createTasksFromActions(actionEmails) {
  const emailDescriptions = actionEmails.map(e =>
    `gmail_id: ${e.gmail_id}\nEmail from: ${e.original_sender || e.sender} <${e.original_sender_email || e.sender_email}>\nSubject: ${e.subject}\nPreview: ${e.body_preview?.slice(0, 300) || e.snippet}`
  ).join('\n---\n');

  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are generating tasks for Kyle Ingram, an Account Manager at Greentech Renewables.

For each email below, create a concise task. Respond with a JSON array only.

Today's date: ${today}

${emailDescriptions}

For each email, respond with:
{"gmail_id": "...", "title": "Short verb-first task title, max 80 chars", "description": "1-2 sentence summary of what needs to happen.", "priority": "urgent|high|medium|low", "due_date": "ISO date string or null"}

Priority guidelines:
- "urgent" — needs response today. Manager requests, customer escalations, deadlines within 24 hours.
- "high" — needs response within 2-3 days. Customer quotes, credit issues, supply coordination.
- "medium" — needs response this week. General customer requests, follow-ups.
- "low" — no real deadline. FYI-adjacent items that still need a response.

Due date guidelines:
- If urgent, set due_date to today (${today}).
- If high, set due_date to 2 days from now.
- If medium or low, set due_date to null.
- If the email mentions a specific deadline, use it.

Respond with JSON array only:
[{"gmail_id": "...", "title": "...", "description": "...", "priority": "...", "due_date": "..."}]`;

  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in task generation response');

  const tasks = JSON.parse(jsonMatch[0]);

  // Try to match sender emails to accounts
  const senderEmails = actionEmails.map(e => e.original_sender_email || e.sender_email).filter(Boolean);
  let accountMap = new Map();

  if (senderEmails.length > 0) {
    const { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('id, contact_email, contact2_email')
      .or(
        senderEmails.map(e => `contact_email.eq.${e},contact2_email.eq.${e}`).join(',')
      );

    if (accounts) {
      for (const acct of accounts) {
        if (acct.contact_email) accountMap.set(acct.contact_email.toLowerCase(), acct.id);
        if (acct.contact2_email) accountMap.set(acct.contact2_email.toLowerCase(), acct.id);
      }
    }
  }

  // Build email lookup for sender_email by gmail_id
  const emailLookup = new Map(actionEmails.map(e => [e.gmail_id, e]));

  // Insert tasks
  const taskRows = tasks.map(t => {
    const email = emailLookup.get(t.gmail_id);
    const senderEmail = (email?.original_sender_email || email?.sender_email)?.toLowerCase();
    const accountId = senderEmail ? accountMap.get(senderEmail) : null;

    return {
      title: t.title,
      description: t.description || null,
      priority: t.priority || 'medium',
      due_date: t.due_date || null,
      source: 'email',
      source_ref: t.gmail_id,
      status: 'todo',
      account_id: accountId || null,
    };
  });

  const { error } = await supabaseAdmin.from('tasks').insert(taskRows);
  if (error) {
    console.error('Task insert failed:', error);
    console.error('Task data:', JSON.stringify(taskRows));
    throw error;
  }

  return taskRows.length;
}
