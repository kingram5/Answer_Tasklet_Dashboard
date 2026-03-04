import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const CLASS_COLORS = {
  action: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Action' },
  fyi: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'FYI' },
  spam: { bg: 'bg-gray-500/20', text: 'text-gray-500', label: 'Spam' },
};

export default function Classifier() {
  const [emails, setEmails] = useState([]);
  const [allEmails, setAllEmails] = useState([]);
  const [corrections, setCorrections] = useState([]);

  useEffect(() => {
    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Today's emails
      const { data: todayEmails } = await supabase
        .from('emails')
        .select('*')
        .gte('received_at', today.toISOString())
        .order('received_at', { ascending: false });
      if (todayEmails) setEmails(todayEmails);

      // All emails for accuracy calc
      const { data: all } = await supabase
        .from('emails')
        .select('id, classification, corrected_classification');
      if (all) setAllEmails(all);

      // Corrections
      const { data: corr } = await supabase
        .from('classifier_corrections')
        .select('*')
        .order('corrected_at', { ascending: false })
        .limit(50);
      if (corr) setCorrections(corr);
    }
    load();
  }, []);

  const accuracy = useMemo(() => {
    if (allEmails.length === 0) return null;
    const correct = allEmails.filter(e => !e.corrected_classification).length;
    return Math.round((correct / allEmails.length) * 100);
  }, [allEmails]);

  async function correctClassification(emailId, newClass) {
    await fetch('/api/emails/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: emailId, corrected_class: newClass }),
    });
    // Update local state
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, corrected_classification: newClass } : e
    ));
    setAllEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, corrected_classification: newClass } : e
    ));
  }

  const effectiveClass = (email) => email.corrected_classification || email.classification;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Classifier Review</h1>
        {accuracy !== null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Accuracy:</span>
            <span className={`text-lg font-bold ${
              accuracy >= 90 ? 'text-green-400' :
              accuracy >= 75 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {accuracy}%
            </span>
            <span className="text-xs text-gray-500">({allEmails.length} emails)</span>
          </div>
        )}
      </div>

      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Today's Emails ({emails.length})
      </h2>

      {emails.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          No emails received today.
        </div>
      )}

      <div className="space-y-1 mb-8">
        {emails.map(email => {
          const cls = effectiveClass(email);
          const colors = CLASS_COLORS[cls] || CLASS_COLORS.action;
          return (
            <div
              key={email.id}
              className={`bg-dark-800 border border-white/10 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:border-white/20 transition-colors`}
            >
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {colors.label}
                </span>
                {email.confidence && (
                  <span className="text-[10px] text-gray-500">{Math.round(email.confidence * 100)}%</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{email.subject}</div>
                <div className="text-xs text-gray-400 truncate">{email.sender}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={cls}
                  onChange={(e) => correctClassification(email.id, e.target.value)}
                  className="bg-dark-700 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="action">Action</option>
                  <option value="fyi">FYI</option>
                  <option value="spam">Spam</option>
                </select>
                {email.corrected_classification && (
                  <span className="text-xs text-amber-400 shrink-0">Corrected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent corrections log */}
      {corrections.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Recent Corrections
          </h2>
          <div className="space-y-1">
            {corrections.map(c => (
              <div key={c.id} className="bg-dark-800 border border-white/10 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 truncate">{c.subject_snapshot}</div>
                  <div className="text-xs text-gray-500">{c.sender_snapshot}</div>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="text-gray-500">{c.original_class}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-teal-400 font-medium">{c.corrected_class}</span>
                  <span className="text-gray-600">
                    {c.corrected_at && new Date(c.corrected_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
