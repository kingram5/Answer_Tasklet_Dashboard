import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const TYPE_CONFIG = {
  email_triage: { color: 'bg-blue-400', label: 'Email triaged' },
  task_created: { color: 'bg-green-400', label: 'Task created' },
  bridge_msg: { color: 'bg-teal-400', label: 'Bridge message' },
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [emails, tasks, bridge] = await Promise.all([
          supabase.from('emails').select('id, subject, classification, received_at')
            .order('received_at', { ascending: false }).limit(8),
          supabase.from('tasks').select('id, title, source, created_at')
            .order('created_at', { ascending: false }).limit(8),
          supabase.from('bridge_messages').select('id, message, from_agent, created_at')
            .order('created_at', { ascending: false }).limit(5),
        ]);

        const merged = [
          ...(emails.data || []).map(e => ({
            type: 'email_triage',
            text: `"${(e.subject || '').slice(0, 50)}" → ${e.classification}`,
            time: e.received_at,
          })),
          ...(tasks.data || []).filter(t => t.source && t.source !== 'manual').map(t => ({
            type: 'task_created',
            text: (t.title || '').slice(0, 60),
            time: t.created_at,
          })),
          ...(bridge.data || []).map(b => ({
            type: 'bridge_msg',
            text: `${b.from_agent}: ${(b.message || '').slice(0, 60)}`,
            time: b.created_at,
          })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12);

        setActivities(merged);
      } catch (err) {
        console.error('ActivityFeed load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="skeleton w-32 h-3 mb-3" />
        <div className="glass rounded-xl p-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton w-full h-4" />)}
        </div>
      </div>
    );
  }

  if (activities.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h2>
      <div className="glass rounded-xl p-4">
        <div className="space-y-0">
          {activities.map((activity, i) => {
            const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.task_created;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${config.color}`} />
                  {i < activities.length - 1 && <div className="w-px h-full min-h-[24px] bg-white/[0.06] mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-sm text-gray-300 truncate">{activity.text}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(activity.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
