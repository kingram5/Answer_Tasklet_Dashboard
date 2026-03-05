import { useState, useEffect } from 'react';
import { animate } from 'framer-motion';
import { supabase } from '../lib/supabase';
import GlassCard from './ui/GlassCard';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function AnimatedNumber({ value }) {
  const num = parseInt(value, 10);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isNaN(num)) return;
    const controls = animate(0, num, {
      duration: 1.2,
      ease: [0.34, 1.56, 0.64, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [num]);

  if (isNaN(num)) return <span>{value}</span>;
  return <span>{display}</span>;
}

const DOT_COLORS = {
  green: 'bg-green-400 shadow-glow-green-sm',
  red: 'bg-red-400 shadow-glow-red-sm',
  amber: 'bg-amber-400 shadow-glow-amber-sm',
  gray: 'bg-gray-500',
};

const TEXT_COLORS = {
  green: 'text-green-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  gray: 'text-gray-500',
};

function HealthCard({ label, value, status, index }) {
  const variant = index % 2 === 0 ? 'teal' : 'purple';
  return (
    <GlassCard animated variant={variant} className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[status]} animate-pulse-subtle`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold ${TEXT_COLORS[status]}`}>
        <AnimatedNumber value={value} />
      </div>
    </GlassCard>
  );
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const { error } = await supabase.from('tasks').select('id').limit(1);
        const supabaseOk = !error;

        const { data: lastTask } = await supabase
          .from('tasks')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);

        const { count: emailCount } = await supabase
          .from('emails')
          .select('*', { count: 'exact', head: true })
          .gte('received_at', new Date(Date.now() - 86400000).toISOString());

        setHealth({
          api: true,
          supabase: supabaseOk,
          lastSync: lastTask?.[0]?.updated_at,
          emailsToday: emailCount || 0,
        });
      } catch {
        setHealth({ api: true, supabase: false, lastSync: null, emailsToday: 0 });
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!health) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="glass rounded-xl p-3">
            <div className="skeleton w-16 h-3 mb-2" />
            <div className="skeleton w-12 h-5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 card-stagger">
      <HealthCard
        label="API"
        value={health.api ? 'Online' : 'Offline'}
        status={health.api ? 'green' : 'red'}
        index={0}
      />
      <HealthCard
        label="Database"
        value={health.supabase ? 'Connected' : 'Error'}
        status={health.supabase ? 'green' : 'red'}
        index={1}
      />
      <HealthCard
        label="Last Sync"
        value={timeAgo(health.lastSync)}
        status={health.lastSync ? 'green' : 'amber'}
        index={2}
      />
      <HealthCard
        label="Emails Today"
        value={health.emailsToday.toString()}
        status={health.emailsToday > 0 ? 'green' : 'gray'}
        index={3}
      />
    </div>
  );
}
