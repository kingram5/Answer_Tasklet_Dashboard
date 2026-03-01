import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TASKLET_WEBHOOK_URL = process.env.TASKLET_WEBHOOK_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Store user message in Supabase
    const { data: userMsg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({ role: 'user', content: message })
      .select()
      .single();

    if (insertError) throw insertError;

    // Forward to Tasklet webhook
    if (TASKLET_WEBHOOK_URL) {
      await fetch(TASKLET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          message_id: userMsg.id,
          timestamp: userMsg.created_at,
        }),
      });
    }

    return res.status(200).json({ success: true, id: userMsg.id });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
