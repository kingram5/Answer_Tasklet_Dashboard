import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TOPIC_ICONS = {
  solar: '☀️',
  geopolitics: '🌍',
  ai: '🤖',
  claude: '🧠',
};

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('generated_at', { ascending: false });
      if (data) setReports(data);
    }
    load();
  }, []);

  const filtered = filter === 'all'
    ? reports
    : reports.filter(r => r.topic === filter);

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1"
        >
          ← Back to Reports
        </button>
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{TOPIC_ICONS[selected.topic] || '📄'}</span>
            <span className="text-xs px-2 py-0.5 bg-dark-600 rounded text-gray-400 uppercase">{selected.topic}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{selected.title}</h1>
          <div className="text-xs text-gray-500 mb-6">
            {selected.generated_at && new Date(selected.generated_at).toLocaleString()}
          </div>
          {selected.summary && (
            <div className="bg-dark-700 border border-white/10 rounded-lg p-4 mb-6 text-sm text-gray-300 italic">
              {selected.summary}
            </div>
          )}
          <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
            {selected.content_md || 'No content available.'}
          </div>
          {selected.pdf_url && (
            <a
              href={selected.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-sm text-teal-400 hover:text-teal-300 hover:border-teal-500/30 transition-colors"
            >
              📥 Download PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Reports</h1>

      {/* Topic filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'solar', 'geopolitics', 'ai', 'claude'].map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {t === 'all' ? 'All' : (
              <span className="flex items-center gap-1.5">
                <span>{TOPIC_ICONS[t]}</span>
                <span className="capitalize">{t}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-16">No reports found.</div>
      )}

      {/* Report grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(report => (
          <div
            key={report.id}
            onClick={() => setSelected(report)}
            className="bg-dark-800 border border-white/10 rounded-lg p-4 cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{TOPIC_ICONS[report.topic] || '📄'}</span>
              <span className="text-xs px-1.5 py-0.5 bg-dark-600 rounded text-gray-400 uppercase">{report.topic}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {report.generated_at && new Date(report.generated_at).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-sm text-white font-medium mb-1 line-clamp-2">{report.title}</h3>
            {report.summary && (
              <p className="text-xs text-gray-400 line-clamp-3">{report.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
