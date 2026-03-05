import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import { FilterBar, FilterPill } from '../components/ui/FilterBar';
import { SkeletonCard } from '../components/ui/Skeleton';

const TOPIC_ICONS = { solar: '☀️', geopolitics: '🌍', ai: '🤖', claude: '🧠' };

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('generated_at', { ascending: false });
      if (data) setReports(data);
      setLoaded(true);
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
          className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors"
        >
          ← Back to Reports
        </button>
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{TOPIC_ICONS[selected.topic] || '📄'}</span>
            <Badge variant="gray" className="uppercase">{selected.topic}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{selected.title}</h1>
          <div className="text-xs text-gray-500 mb-6">
            {selected.generated_at && new Date(selected.generated_at).toLocaleString()}
          </div>
          {selected.summary && (
            <div className="glass rounded-lg p-4 mb-6 text-sm text-gray-300 italic">
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
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-dark-700 border border-white/[0.06] rounded-lg text-sm text-teal-400 hover:text-teal-300 hover:border-teal-500/30 hover:shadow-glow-teal-sm transition-all"
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
      <PageHeader title="Reports" />

      <FilterBar>
        {['all', 'solar', 'geopolitics', 'ai', 'claude'].map(t => (
          <FilterPill key={t} active={filter === t} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : (
              <span className="flex items-center gap-1.5">
                <span>{TOPIC_ICONS[t]}</span>
                <span className="capitalize">{t}</span>
              </span>
            )}
          </FilterPill>
        ))}
      </FilterBar>

      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">No reports found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 card-stagger">
          {filtered.map(report => (
            <Card
              key={report.id}
              onClick={() => setSelected(report)}
              className="p-4 cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{TOPIC_ICONS[report.topic] || '📄'}</span>
                <Badge variant="gray" className="uppercase">{report.topic}</Badge>
                <span className="text-xs text-gray-500 ml-auto">
                  {report.generated_at && new Date(report.generated_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-sm text-white font-medium mb-1 line-clamp-2">{report.title}</h3>
              {report.summary && (
                <p className="text-xs text-gray-400 line-clamp-3">{report.summary}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
