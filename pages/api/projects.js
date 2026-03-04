import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, description, status, nodes_json, tags } = req.body;
    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        name: name || 'Untitled Project',
        description: description || null,
        status: status || 'active',
        nodes_json: nodes_json || [],
        tags: tags || [],
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Project id is required' });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Project id is required' });

    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
