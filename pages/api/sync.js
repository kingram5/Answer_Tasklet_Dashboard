import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  const expectedToken = `Bearer ${process.env.SYNC_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { action, data } = req.body;

    switch (action) {
      case 'upsert': {
        const { key, category, content, source, metadata, session_log_id } = data;
        if (!key || !category || !content || !source) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        const { data: result, error } = await supabaseAdmin
          .from('memory_docs')
          .upsert({ key, category, content, source, metadata, session_log_id }, { onConflict: 'key,category' })
          .select();
        if (error) throw error;
        return res.status(200).json({ success: true, data: result });
      }

      case 'batch_upsert': {
        const { items } = data;
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Missing or empty items array' });
        }
        const { data: result, error } = await supabaseAdmin
          .from('memory_docs')
          .upsert(items, { onConflict: 'key,category' })
          .select();
        if (error) throw error;
        return res.status(200).json({ success: true, count: result.length, data: result });
      }

      case 'sync_session': {
        const { session, memory_items } = data;
        let session_log_id = null;
        if (session) {
          const { data: logResult, error: logError } = await supabaseAdmin
            .from('session_logs').insert(session).select().single();
          if (logError) throw logError;
          session_log_id = logResult.id;
        }
        if (memory_items && memory_items.length > 0) {
          const itemsWithRef = memory_items.map(item => ({
            ...item, session_log_id: session_log_id || item.session_log_id
          }));
          const { error: memError } = await supabaseAdmin
            .from('memory_docs').upsert(itemsWithRef, { onConflict: 'key,category' });
          if (memError) throw memError;
        }
        return res.status(200).json({ success: true, session_log_id, memory_items_synced: memory_items?.length || 0 });
      }

      case 'deactivate': {
        const { key, category } = data;
        const { error } = await supabaseAdmin
          .from('memory_docs').update({ is_active: false }).match({ key, category });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'read': {
        const { category, source, limit = 100 } = data || {};
        let query = supabaseAdmin.from('memory_docs').select('*')
          .eq('is_active', true).order('updated_at', { ascending: false }).limit(limit);
        if (category) query = query.eq('category', category);
        if (source) query = query.eq('source', source);
        const { data: result, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: result });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Sync webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
