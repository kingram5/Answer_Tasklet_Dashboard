import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../../../lib/supabase';
import { validateTwilioRequest, sendSMS } from '../../../lib/twilio';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const KYLE_NUMBER = '+17144698951';

const SMS_BASE_PROMPT = `You are Answer — Kyle's AI agent, responding via text message.

Voice: Same as always. Casual, direct, no filler. Extra brief — this is SMS, not a chat window. Keep responses under 300 characters when possible. Go longer only when the content requires it.

Kyle is an Account Manager at Greentech Renewables managing ~15 solar equipment accounts.

You can execute these actions when Kyle asks:
- CREATE_TASK: {"title": "...", "description": "...", "priority": "urgent|high|medium|low", "due_date": "ISO or null", "account_name": "optional"}
- UPDATE_TASK: {"task_title_search": "...", "updates": {"status": "...", "priority": "...", "due_date": "..."}}
- UPDATE_ACCOUNT: {"account_name": "...", "updates": {"last_contact": "now", "next_action": "...", "health": "...", "notes": "..."}}
- SEND_BRIDGE: {"to_agent": "reggie", "message": "...", "category": "general|reminder|task|wedding|urgent"}
- CREATE_BRIEFING: Writes to the "briefings" table (type='daily'). You have FULL access — just use the action. Schema:
  {"title": "Morning Briefing — Mar 4", "content_json": {"meetings": [{"title": "...", "time": "...", "description": "..."}], "tasks": [{"title": "...", "description": "...", "status": "..."}], "accounts": [{"name": "...", "status": "...", "description": "..."}], "bridge": [{"message": "..."}], "flags": [{"subject": "...", "sender": "...", "description": "..."}]}, "content_text": "optional plain text summary"}
  Build the briefing from the OPEN TASKS, ACCOUNTS, RECENT EMAILS, and BRIDGE MESSAGES data provided below. Only include sections that have content. Don't ask for the schema — you already have it. Just create the briefing.

When you detect an action intent, include it in your response as a JSON block after your reply text, wrapped in <action> tags:

Example:
"Added it. Trojan Solar follow-up, high priority, due Thursday.
<action>{"type": "CREATE_TASK", "data": {"title": "Follow up with Trojan Solar on Q2 pricing", "priority": "high", "due_date": "2026-03-06T00:00:00Z", "account_name": "Trojan Solar"}}</action>"

If no action is needed, just reply normally with no <action> tags.`;

// Load live dashboard state from Supabase to give Answer full visibility
async function loadDashboardContext() {
  const [tasksRes, accountsRes, emailsRes, bridgeRes] = await Promise.all([
    // Open tasks (not done/cancelled)
    supabaseAdmin
      .from('tasks')
      .select('title, status, priority, due_date, source')
      .not('status', 'in', '("done","cancelled")')
      .order('priority', { ascending: true })
      .limit(30),
    // All accounts with health and last contact
    supabaseAdmin
      .from('accounts')
      .select('name, health, last_contact, next_action, notes')
      .order('name'),
    // Recent emails (last 3 days)
    supabaseAdmin
      .from('emails')
      .select('subject, original_sender, classification, ai_summary, received_at')
      .gte('received_at', new Date(Date.now() - 3 * 86400000).toISOString())
      .order('received_at', { ascending: false })
      .limit(15),
    // Recent bridge messages (last 7 days)
    supabaseAdmin
      .from('bridge_messages')
      .select('from_agent, to_agent, message, category, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const tasks = tasksRes.data || [];
  const accounts = accountsRes.data || [];
  const emails = emailsRes.data || [];
  const bridge = bridgeRes.data || [];

  let context = `\n\nCurrent date: ${new Date().toISOString().split('T')[0]}`;

  // Tasks
  if (tasks.length > 0) {
    context += `\n\n== OPEN TASKS (${tasks.length}) ==`;
    for (const t of tasks) {
      const due = t.due_date ? ` | due ${t.due_date.split('T')[0]}` : '';
      context += `\n- [${t.priority}/${t.status}] ${t.title}${due}`;
    }
  } else {
    context += '\n\n== OPEN TASKS: None ==';
  }

  // Accounts
  if (accounts.length > 0) {
    context += `\n\n== ACCOUNTS (${accounts.length}) ==`;
    for (const a of accounts) {
      const lastContact = a.last_contact ? new Date(a.last_contact).toISOString().split('T')[0] : 'never';
      const health = a.health || 'unknown';
      const next = a.next_action ? ` | next: ${a.next_action}` : '';
      context += `\n- ${a.name} [${health}] last contact: ${lastContact}${next}`;
    }
  }

  // Recent emails
  if (emails.length > 0) {
    context += `\n\n== RECENT EMAILS (${emails.length}) ==`;
    for (const e of emails) {
      const sender = e.original_sender || 'unknown';
      const cls = e.classification || '';
      const summary = e.ai_summary ? ` — ${e.ai_summary}` : '';
      context += `\n- [${cls}] "${e.subject}" from ${sender}${summary}`;
    }
  }

  // Bridge messages
  if (bridge.length > 0) {
    context += `\n\n== RECENT BRIDGE MESSAGES ==`;
    for (const b of bridge) {
      context += `\n- ${b.from_agent}→${b.to_agent} [${b.category}]: ${b.message}`;
    }
  }

  return context;
}

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

    // 2. Load live dashboard context from Supabase
    const dashboardContext = await loadDashboardContext();
    const systemPrompt = SMS_BASE_PROMPT + dashboardContext;

    // 3. Choose model based on message complexity
    const isSimple = message.trim().length < 50 || /^(yes|no|ok|done|thanks|got it|mark|log|add task)/i.test(message.trim());
    const model = isSimple ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-5-20250929';

    // 4. Call Anthropic
    const aiResponse = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory,
    });

    const fullResponse = aiResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // 5. Parse response: extract reply text and actions
    const { replyText, actions } = parseResponse(fullResponse);

    // 6. Execute actions
    const actionErrors = [];
    for (const action of actions) {
      try {
        await executeAction(action);
      } catch (err) {
        console.error(`Action ${action.type} failed:`, err);
        actionErrors.push(action.type);
      }
    }

    // 7. Build final reply
    let finalReply = replyText;
    if (actionErrors.length > 0) {
      finalReply += `\n(Couldn't save: ${actionErrors.join(', ')} — I'll retry next message)`;
    }

    // 8. Store conversation in chat_history (explicit timestamps to guarantee ordering)
    const now = new Date();
    await supabaseAdmin.from('chat_history').insert([
      {
        session_id: 'sms',
        role: 'user',
        content: message.trim(),
        model_used: model,
        created_at: new Date(now.getTime()).toISOString(),
      },
      {
        session_id: 'sms',
        role: 'assistant',
        content: fullResponse,
        model_used: model,
        tokens_in: aiResponse.usage?.input_tokens || 0,
        tokens_out: aiResponse.usage?.output_tokens || 0,
        created_at: new Date(now.getTime() + 1).toISOString(),
      },
    ]);

    // 9. Send SMS reply via Twilio
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

    case 'CREATE_BRIEFING': {
      const { title, content_json, content_text } = action.data;

      const { error } = await supabaseAdmin.from('briefings').insert({
        type: 'daily',
        title: title || 'Daily Briefing',
        content_json: content_json || {},
        content_text: content_text || '',
      });
      if (error) throw error;
      break;
    }

    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}
