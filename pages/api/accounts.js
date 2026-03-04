import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, ...updates } = req.body;
  if (!id) return res.status(400).json({ error: 'Account id is required' });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}
