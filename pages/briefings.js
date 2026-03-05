import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

const SECTION_ICONS = {
  meetings: '📅', tasks: '📋', accounts: '📊', bridge: '🔄', flags: '🚩',
};
const SECTION_LABELS = {
  meetings: 'Meetings', tasks: 'Priority Tasks', accounts: 'Account Alerts',
  bridge: 'Bridge Messages', flags: 'Flagged Emails',
};

export default function Briefings() {
  const [briefings, setBriefings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('briefings')
        .select('*')
        .eq('type', 'daily')
        .order('generated_at', { ascending: false })
        .limit(30);
      if (data && data.length > 0) {
        setBriefings(data);
        setSelected(data[0]);
      }
    }
    load();

    const channel = supabase
      .channel('briefings-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'briefings' }, (payload) => {
        if (payload.new.type === 'daily') {
          setBriefings(prev => [payload.new, ...prev]);
          setSelected(payload.new);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function toggleSection(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function renderSection(key, items) {
    if (!items || items.length === 0) return null;
    const isCollapsed = collapsed[key];

    return (
      <div key={key} className="mb-4">
        <button
          onClick={() => toggleSection(key)}
          className="flex items-center gap-2 w-full text-left py-2 hover:bg-white/[0.04] rounded px-2 -mx-2 transition-colors"
        >
          <span>{SECTION_ICONS[key] || '📌'}</span>
          <span className="text-sm font-semibold text-white">{SECTION_LABELS[key] || key}</span>
          <Badge variant="gray" className="ml-1">{items.length}</Badge>
          <svg
            className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-1 mt-1">
                {items.map((item, i) => (
                  <Card key={i} hover={false} className="p-2.5 text-sm text-gray-300">
                    {typeof item === 'string' ? item : (
                      <>
                        {item.title && <div className="text-white font-medium">{item.title}</div>}
                        {item.time && <div className="text-xs text-gray-500">{item.time}</div>}
                        {item.description && <div className="text-gray-400 text-xs mt-1">{item.description}</div>}
                        {item.name && <div className="text-white">{item.name}</div>}
                        {item.status && <Badge variant="amber" className="mt-1">{item.status}</Badge>}
                        {item.message && <div className="text-gray-400">{item.message}</div>}
                        {item.subject && <div className="text-gray-300">{item.subject}</div>}
                        {item.sender && <div className="text-xs text-gray-500">From: {item.sender}</div>}
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const content = selected?.content_json;

  return (
    <div>
      <PageHeader title="Morning Briefing">
        {briefings.length > 1 && (
          <select
            value={selected?.id || ''}
            onChange={(e) => {
              const b = briefings.find(b => b.id === e.target.value);
              if (b) setSelected(b);
            }}
            className="bg-dark-700 border border-white/[0.06] rounded-md px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none"
          >
            {briefings.map(b => (
              <option key={b.id} value={b.id}>
                {b.generated_at ? new Date(b.generated_at).toLocaleDateString() : 'Unknown date'}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      {!selected && (
        <div className="text-center text-gray-500 py-16">
          No briefings generated yet. Your first morning briefing will appear here.
        </div>
      )}

      {selected && (
        <div className="max-w-3xl">
          <div className="mb-4 pb-4 border-b border-white/[0.06]">
            <h2 className="text-lg text-white font-medium">{selected.title || 'Daily Briefing'}</h2>
            <div className="text-xs text-gray-500 mt-1">
              {selected.generated_at && new Date(selected.generated_at).toLocaleString()}
              {selected.sms_sent && <Badge variant="green" className="ml-2">SMS sent</Badge>}
            </div>
          </div>

          {content && typeof content === 'object' && (
            <div>
              {renderSection('meetings', content.meetings)}
              {renderSection('tasks', content.tasks)}
              {renderSection('accounts', content.accounts)}
              {renderSection('bridge', content.bridge)}
              {renderSection('flags', content.flags)}
            </div>
          )}

          {(!content || typeof content !== 'object') && selected.content_text && (
            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {selected.content_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
