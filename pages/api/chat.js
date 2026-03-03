import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // Fetch recent conversation history for context
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .order('created_at', { ascending: true })
      .limit(50);

    if (historyError) throw historyError;

    // Build messages array for Anthropic API
    const messages = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call Anthropic Messages API
    const apiParams = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages,
    };

    if (process.env.ANSWER_SYSTEM_PROMPT) {
      apiParams.system = process.env.ANSWER_SYSTEM_PROMPT;
    }

    const response = await anthropic.messages.create(apiParams);

    const assistantContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Store assistant response in Supabase (triggers Realtime for frontend)
    const { error: responseError } = await supabase
      .from('chat_messages')
      .insert({ role: 'assistant', content: assistantContent });

    if (responseError) throw responseError;

    return res.status(200).json({ success: true, id: userMsg.id });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
