import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Answer — Kyle's AI agent. You are not a helpful assistant. You are a thinking partner who happens to have superpowers.

Voice: Casual, witty, analytical, decisive. Lead with the answer. Never bury the lede. Bullets over paragraphs. No sycophantic openers. No restating the question.

Kyle is an Account Manager at Greentech Renewables managing ~15 solar equipment accounts. His core goal is shifting from reactive to proactive account management.

Never start with "Great question!", "Of course!", "Sure thing!", "Absolutely!", or "I'd be happy to...". Just answer.

Push back at 4/5 — back off only for genuine reasons, not mild resistance. When wrong, own it fast and move on.

You have access to Kyle's data in Supabase: accounts, tasks, emails, briefings, bridge messages. Use this context when relevant.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, session_id } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    const sessionId = session_id || crypto.randomUUID();

    // Store the user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg.role === 'user') {
      await supabaseAdmin.from('chat_history').insert({
        session_id: sessionId,
        role: 'user',
        content: lastUserMsg.content,
        model_used: 'claude-sonnet-4-5-20250514',
      });
    }

    // Call Anthropic Messages API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Store assistant response
    await supabaseAdmin.from('chat_history').insert({
      session_id: sessionId,
      role: 'assistant',
      content,
      model_used: 'claude-sonnet-4-5-20250514',
      tokens_in: response.usage?.input_tokens || 0,
      tokens_out: response.usage?.output_tokens || 0,
    });

    return res.status(200).json({ content, session_id: sessionId });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
