import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to_agent, message, category } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const { data, error } = await supabaseAdmin
    .from('bridge_messages')
    .insert({
      from_agent: 'answer',
      to_agent: to_agent || 'reggie',
      message,
      category: category || 'general',
      is_read: false,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
}
