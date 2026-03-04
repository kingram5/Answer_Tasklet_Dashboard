import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { validateTwilioRequest, sendSMS } from '../../../lib/twilio';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const KYLE_NUMBER = '+17144698951';

const SMS_SYSTEM_PROMPT = `You are Answer — Kyle's AI agent, responding via text message.

Voice: Same as always. Casual, direct, no filler. Extra brief — this is SMS, not a chat window. Keep responses under 300 characters when possible. Go longer only when the content requires it.

Kyle is an Account Manager at Greentech Renewables managing ~15 solar equipment accounts.

You can execute these actions when Kyle asks:
- CREATE_TASK: {"title": "...", "description": "...", "priority": "urgent|high|medium|low", "due_date": "ISO or null", "account_name": "optional"}
- UPDATE_TASK: {"task_title_search": "...", "updates": {"status": "...", "priority": "...", "due_date": "..."}}
- UPDATE_ACCOUNT: {"account_name": "...", "updates": {"last_contact": "now", "next_action": "...", "health": "...", "notes": "..."}}
- SEND_BRIDGE: {"to_agent": "reggie", "message": "...", "category": "general|reminder|task|wedding|urgent"}

When you detect an action intent, include it in your response as a JSON block after your reply text, wrapped in <action> tags:

Example:
"Added it. Trojan Solar follow-up, high priority, due Thursday.
<action>{"type": "CREATE_TASK", "data": {"title": "Follow up with Trojan Solar on Q2 pricing", "priority": "high", "due_date": "2026-03-06T00:00:00Z", "account_name": "Trojan Solar"}}</action>"

If no action is needed, just reply normally with no <action> tags.

Current date: ${new Date().toISOString().split('T')[0]}

Current accounts: Mayer Solar, NXT Level, Synaptic, Kpost Roofing, Tarrant Roofing, Trojan Solar, Gamma Strategies, Just In Case, AguaSol, SolarTime, THS, Harvest, Sandhu Solar, Solar Scouts, Vantage Point.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Validate Twilio signature
  if (!validateTwilioRequest(req)) {
    console.warn('Invalid Twilio signature — request rejected');
    return res.status(403).end();
  }

  const { Body: message, From: fromNumber } = req.body;

  // Only process messages from Kyle
  if (fromNumber !== KYLE_NUMBER) {
    console.warn(`Rejected SMS from unknown number: ${fromNumber}`);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }

  try {
    // 1. Load recent conversation history
    const { data: history } = await supabaseAdmin
      .from('chat_history')
      .select('role, content')
      .eq('session_id', 'sms')
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (history || [])
      .reverse()
      .map(h => ({ role: h.role, content: h.content }));

    // Add current message
    conversationHistory.push({ role: 'user', content: message.trim() });

    // 2. Choose model based on message complexity
    const isSimple = message.trim().length < 50 || /^(yes|no|ok|done|thanks|got it|mark|log|add task)/i.test(message.trim());
    const model = isSimple ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-5-20250929';

    // 3. Call Anthropic
    const aiResponse = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: SMS_SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const fullResponse = aiResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // 4. Parse response: extract reply text and actions
    const { replyText, actions } = parseResponse(fullResponse);

    // 5. Execute actions
    const actionErrors = [];
    for (const action of actions) {
      try {
        await executeAction(action);
      } catch (err) {
        console.error(`Action ${action.type} failed:`, err);
        actionErrors.push(action.type);
      }
    }

    // 6. Build final reply
    let finalReply = replyText;
    if (actionErrors.length > 0) {
      finalReply += `\n(Couldn't save: ${actionErrors.join(', ')} — I'll retry next message)`;
    }

    // 7. Store conversation in chat_history
    await supabaseAdmin.from('chat_history').insert([
      {
        session_id: 'sms',
        role: 'user',
        content: message.trim(),
        model_used: model,
      },
      {
        session_id: 'sms',
        role: 'assistant',
        content: fullResponse,
        model_used: model,
        tokens_in: aiResponse.usage?.input_tokens || 0,
        tokens_out: aiResponse.usage?.output_tokens || 0,
      },
    ]);

    // 8. Send SMS reply via Twilio
    await sendSMS(KYLE_NUMBER, finalReply);

    // Return TwiML empty response (we send reply via API, not TwiML)
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  } catch (err) {
    console.error('SMS pipeline error:', err);

    // Try to notify Kyle of the failure
    try {
      await sendSMS(KYLE_NUMBER, "Hit a snag — try again in a minute.");
    } catch (smsErr) {
      console.error('Failed to send error SMS:', smsErr);
    }

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }
}

// Parse AI response into reply text and action objects
function parseResponse(response) {
  const actions = [];
  let replyText = response;

  const actionRegex = /<action>([\s\S]*?)<\/action>/g;
  let match;

  while ((match = actionRegex.exec(response)) !== null) {
    try {
      actions.push(JSON.parse(match[1]));
    } catch (err) {
      console.error('Failed to parse action JSON:', match[1]);
    }
    replyText = replyText.replace(match[0], '');
  }

  return { replyText: replyText.trim(), actions };
}

// Execute a parsed action against Supabase
async function executeAction(action) {
  switch (action.type) {
    case 'CREATE_TASK': {
      const { title, description, priority, due_date, account_name } = action.data;

      let account_id = null;
      if (account_name) {
        const { data: account } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .ilike('name', `%${account_name}%`)
          .limit(1)
          .single();
        if (account) account_id = account.id;
      }

      const { error } = await supabaseAdmin.from('tasks').insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        due_date: due_date || null,
        status: 'todo',
        source: 'manual',
        account_id,
      });
      if (error) throw error;
      break;
    }

    case 'UPDATE_TASK': {
      const { task_title_search, updates } = action.data;

      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .ilike('title', `%${task_title_search}%`)
        .eq('status', 'todo')
        .limit(1)
        .single();

      if (!task) {
        // Try broader search including in_progress
        const { data: task2 } = await supabaseAdmin
          .from('tasks')
          .select('id')
          .ilike('title', `%${task_title_search}%`)
          .limit(1)
          .single();
        if (!task2) throw new Error(`Task not found: ${task_title_search}`);
        updates.updated_at = new Date().toISOString();
        const { error } = await supabaseAdmin.from('tasks').update(updates).eq('id', task2.id);
        if (error) throw error;
      } else {
        updates.updated_at = new Date().toISOString();
        const { error } = await supabaseAdmin.from('tasks').update(updates).eq('id', task.id);
        if (error) throw error;
      }
      break;
    }

    case 'UPDATE_ACCOUNT': {
      const { account_name, updates } = action.data;

      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .ilike('name', `%${account_name}%`)
        .limit(1)
        .single();

      if (!account) throw new Error(`Account not found: ${account_name}`);

      if (updates.last_contact === 'now') {
        updates.last_contact = new Date().toISOString();
      }

      const { error } = await supabaseAdmin
        .from('accounts')
        .update(updates)
        .eq('id', account.id);
      if (error) throw error;
      break;
    }

    case 'SEND_BRIDGE': {
      const { to_agent, message, category } = action.data;

      const { error } = await supabaseAdmin.from('bridge_messages').insert({
        from_agent: 'answer',
        to_agent: to_agent || 'reggie',
        message,
        category: category || 'general',
      });
      if (error) throw error;
      break;
    }

    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}
