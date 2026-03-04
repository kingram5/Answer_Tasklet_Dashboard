import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { title, description, priority, status, due_date, source, source_ref, account_id } = req.body;
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        status: status || 'todo',
        due_date: due_date || null,
        source: source || 'manual',
        source_ref: source_ref || null,
        account_id: account_id || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Task id is required' });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Task id is required' });

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
