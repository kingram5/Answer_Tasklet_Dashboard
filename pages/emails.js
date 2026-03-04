import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CLASS_COLORS = {
  action: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Action' },
  fyi: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'FYI' },
  spam: { bg: 'bg-gray-500/20', text: 'text-gray-500', label: 'Spam' },
};

export default function Emails() {
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(200);
      if (data) setEmails(data);
    }
    load();

    const channel = supabase
      .channel('emails-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEmails(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setEmails(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
          setSelected(prev => prev?.id === payload.new.id ? payload.new : prev);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function correctClassification(emailId, newClass) {
    await fetch('/api/emails/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: emailId, corrected_class: newClass }),
    });
  }

  const effectiveClass = (email) => email.corrected_classification || email.classification;

  const filtered = emails.filter(e => {
    if (filter !== 'all' && effectiveClass(e) !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (e.subject?.toLowerCase().includes(q) || e.sender?.toLowerCase().includes(q));
    }
    return true;
  });

  // Sort: action first, then fyi, then spam
  const classOrder = { action: 0, fyi: 1, spam: 2 };
  const sorted = filter === 'all'
    ? [...filtered].sort((a, b) => (classOrder[effectiveClass(a)] ?? 1) - (classOrder[effectiveClass(b)] ?? 1))
    : filtered;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Email Feed</h1>

      {/* Search and filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject or sender..."
          className="flex-1 min-w-[200px] bg-dark-700 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
        />
        {['all', 'action', 'fyi', 'spam'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'All' : CLASS_COLORS[f]?.label || f}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Email list */}
        <div className="flex-1 space-y-1 min-w-0">
          {sorted.length === 0 && (
            <div className="text-center text-gray-500 py-16">No emails found.</div>
          )}
          {sorted.map(email => {
            const cls = effectiveClass(email);
            const colors = CLASS_COLORS[cls] || CLASS_COLORS.action;
            const isSelected = selected?.id === email.id;
            return (
              <div
                key={email.id}
                onClick={() => setSelected(email)}
                className={`bg-dark-800 border rounded-lg p-3 cursor-pointer transition-colors ${
                  isSelected ? 'border-teal-500/50' : 'border-white/10 hover:border-white/20'
                } ${!email.is_read ? 'border-l-2 border-l-teal-400' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {colors.label}
                  </span>
                  {email.is_starred && <span className="text-yellow-400 text-xs">★</span>}
                  <span className="text-xs text-gray-500 ml-auto shrink-0">
                    {email.received_at && new Date(email.received_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm text-white truncate">{email.subject}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{email.sender}</div>

                {/* Inline correction */}
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={cls}
                    onChange={(e) => { e.stopPropagation(); correctClassification(email.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-dark-700 border border-white/10 rounded px-1.5 py-0.5 text-xs text-gray-400 focus:outline-none"
                  >
                    <option value="action">Action</option>
                    <option value="fyi">FYI</option>
                    <option value="spam">Spam</option>
                  </select>
                  {email.corrected_classification && (
                    <span className="text-xs text-amber-400">Corrected</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Preview pane (desktop) */}
        {selected && (
          <div className="hidden md:block w-96 shrink-0 bg-dark-800 border border-white/10 rounded-lg p-4 sticky top-4 self-start max-h-[80vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setSelected(null)}
              className="text-gray-500 hover:text-white text-sm float-right"
            >
              &times;
            </button>
            <h2 className="text-lg text-white font-medium mb-2 pr-6">{selected.subject}</h2>
            <div className="text-sm text-gray-400 mb-0.5">From: {selected.sender}</div>
            {selected.sender_email && (
              <div className="text-xs text-gray-500 mb-1">{selected.sender_email}</div>
            )}
            <div className="text-xs text-gray-500 mb-4">
              {selected.received_at && new Date(selected.received_at).toLocaleString()}
            </div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {selected.body_preview || selected.snippet || 'No preview available.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
