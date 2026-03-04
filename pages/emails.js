import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function cleanSubject(subject) {
  if (!subject) return subject;
  return subject.replace(/^((fw|fwd|re):\s*)+/gi, '').trim();
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

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
      return (e.subject?.toLowerCase().includes(q) || e.sender?.toLowerCase().includes(q) || e.original_sender?.toLowerCase().includes(q));
    }
    return true;
  });

  const classOrder = { action: 0, fyi: 1, spam: 2 };
  const sorted = filter === 'all'
    ? [...filtered].sort((a, b) => (classOrder[effectiveClass(a)] ?? 1) - (classOrder[effectiveClass(b)] ?? 1))
    : filtered;

  const getSender = (email) => email.original_sender || email.sender;
  const getSenderEmail = (email) => email.original_sender_email || email.sender_email;
  const getAttachments = (email) => {
    let list = [];
    if (!email.attachments) return list;
    if (Array.isArray(email.attachments)) list = email.attachments;
    else { try { list = JSON.parse(email.attachments); } catch { return []; } }
    // Filter out inline/footer images (signature logos, Outlook image placeholders)
    return list.filter(att => {
      if (att.mimeType?.startsWith('image/') && /^image\d*\.(png|jpe?g|gif|bmp)$/i.test(att.filename)) return false;
      return true;
    });
  };
  const getBriefing = (email) => {
    if (!email.thread_briefing) return [];
    if (Array.isArray(email.thread_briefing)) return email.thread_briefing;
    try { return JSON.parse(email.thread_briefing); } catch { return []; }
  };

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
        <div className="flex-1 space-y-2 min-w-0">
          {sorted.length === 0 && (
            <div className="text-center text-gray-500 py-16">No emails found.</div>
          )}
          {sorted.map(email => {
            const cls = effectiveClass(email);
            const colors = CLASS_COLORS[cls] || CLASS_COLORS.action;
            const isSelected = selected?.id === email.id;
            const attachments = getAttachments(email);
            const briefing = getBriefing(email);
            const visibleBriefing = briefing.slice(-3);
            const hiddenCount = briefing.length - 3;
            const receivedDate = email.received_at ? new Date(email.received_at) : null;

            return (
              <div
                key={email.id}
                onClick={() => setSelected(email)}
                className={`bg-dark-800 border rounded-lg p-4 cursor-pointer transition-colors ${
                  isSelected ? 'border-teal-500/50' : 'border-white/10 hover:border-white/20'
                } ${!email.is_read ? 'border-l-2 border-l-teal-400' : ''}`}
              >
                {/* Row 1: Badge + Subject + Date */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${colors.bg} ${colors.text}`}>
                    {colors.label}
                  </span>
                  {email.is_starred && <span className="text-yellow-400 text-xs">★</span>}
                  <span className="text-sm text-white font-medium truncate flex-1">{cleanSubject(email.subject)}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {receivedDate && receivedDate.toLocaleDateString()}
                  </span>
                </div>

                {/* Row 2: From + Time */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400 truncate">
                    From: {getSender(email)} {getSenderEmail(email) && <span className="text-gray-600">&lt;{getSenderEmail(email)}&gt;</span>}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0 ml-auto">
                    {receivedDate && receivedDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* AI Summary */}
                {email.ai_summary && (
                  <p className="text-sm text-gray-300 leading-relaxed mb-2">
                    {email.ai_summary}
                  </p>
                )}

                {/* Thread Briefing */}
                {briefing.length > 0 && (
                  <div className="mb-2 text-xs space-y-0.5">
                    {hiddenCount > 0 && (
                      <div className="text-gray-600 italic">+{hiddenCount} earlier message{hiddenCount > 1 ? 's' : ''}</div>
                    )}
                    {visibleBriefing.map((b, i) => (
                      <div key={i} className={`flex gap-1.5 ${b.is_last ? 'text-teal-400' : 'text-gray-500'}`}>
                        <span className="shrink-0">•</span>
                        <span><span className="font-medium">{b.sender}</span> {b.action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachments.map((att, i) => (
                      <a
                        key={i}
                        href={`/api/emails/attachment?gmail_id=${email.gmail_id}&attachment_id=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-dark-700 border border-white/10 rounded text-xs text-gray-400 hover:text-teal-400 hover:border-teal-500/30 transition-colors"
                        title={att.filename}
                      >
                        <span>📎</span>
                        <span className="truncate max-w-[120px]">{att.filename}</span>
                        {att.size > 0 && <span className="text-gray-600">({formatFileSize(att.size)})</span>}
                      </a>
                    ))}
                  </div>
                )}

                {/* Correction dropdown */}
                <div className="flex items-center gap-2">
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
            <h2 className="text-lg text-white font-medium mb-2 pr-6">{cleanSubject(selected.subject)}</h2>
            <div className="text-sm text-gray-400 mb-1">
              From: {getSender(selected)} {getSenderEmail(selected) && <span className="text-gray-600">&lt;{getSenderEmail(selected)}&gt;</span>}
            </div>
            <div className="text-xs text-gray-500 mb-3">
              {selected.received_at && new Date(selected.received_at).toLocaleString('en-US', { hour12: false })}
            </div>

            {/* AI Summary in preview */}
            {selected.ai_summary && (
              <div className="bg-dark-700 border border-white/10 rounded-md p-3 mb-3">
                <div className="text-xs text-teal-400 font-medium mb-1">AI Summary</div>
                <p className="text-sm text-gray-300 leading-relaxed">{selected.ai_summary}</p>
              </div>
            )}

            {/* Full thread briefing in preview */}
            {getBriefing(selected).length > 0 && (
              <div className="bg-dark-700 border border-white/10 rounded-md p-3 mb-3">
                <div className="text-xs text-teal-400 font-medium mb-1">Thread</div>
                <div className="space-y-1">
                  {getBriefing(selected).map((b, i) => (
                    <div key={i} className={`flex gap-1.5 text-xs ${b.is_last ? 'text-teal-400' : 'text-gray-500'}`}>
                      <span className="shrink-0">•</span>
                      <span><span className="font-medium">{b.sender}</span> {b.action} {b.is_last && <span className="text-teal-500 text-[10px]">[LATEST]</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments in preview */}
            {getAttachments(selected).length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Attachments</div>
                <div className="flex flex-wrap gap-1.5">
                  {getAttachments(selected).map((att, i) => (
                    <a
                      key={i}
                      href={`/api/emails/attachment?gmail_id=${selected.gmail_id}&attachment_id=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-dark-700 border border-white/10 rounded text-xs text-gray-400 hover:text-teal-400 hover:border-teal-500/30 transition-colors"
                    >
                      <span>📎</span>
                      <span>{att.filename}</span>
                      {att.size > 0 && <span className="text-gray-600">({formatFileSize(att.size)})</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {selected.body_preview || selected.snippet || 'No preview available.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
