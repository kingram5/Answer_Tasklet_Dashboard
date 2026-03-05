import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import SystemHealth from '../components/SystemHealth';
import ActivityFeed from '../components/ActivityFeed';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import { FilterBar, FilterPill } from '../components/ui/FilterBar';
import { SkeletonList } from '../components/ui/Skeleton';

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_BADGE = {
  urgent: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'gray',
};

const STATUS_BADGE = {
  todo: 'gray',
  in_progress: 'blue',
  done: 'green',
  blocked: 'red',
  cancelled: 'gray',
};

const SOURCE_ICONS = {
  manual: '✏️', email: '📧', bridge: '🔄', cowork: '🤝', vapi: '📞', briefing: '📝',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState({ status: 'all', priority: 'all' });
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setTasks(data);
      setLoaded(true);
    }
    load();

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [payload.new, ...prev.filter(t => t.id !== payload.new.id)]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cycleStatus = useCallback(async (task) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: task.id,
        status: next,
        completed_at: next === 'done' ? new Date().toISOString() : null,
      }),
    });
  }, []);

  const cyclePriority = useCallback(async (task) => {
    const idx = PRIORITY_ORDER.indexOf(task.priority);
    const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, priority: next }),
    });
  }, []);

  const saveTitle = useCallback(async (id) => {
    if (!editValue.trim()) { setEditingId(null); return; }
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editValue.trim() }),
    });
    setEditingId(null);
  }, [editValue]);

  const addTask = useCallback(async () => {
    if (!newTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), priority: 'medium', status: 'todo', source: 'manual' }),
    });
    setNewTitle('');
    setAdding(false);
  }, [newTitle]);

  const deleteTask = useCallback(async (id) => {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }, []);

  const filtered = tasks.filter(t => {
    if (filter.status !== 'all' && t.status !== filter.status) return false;
    if (filter.priority !== 'all' && t.priority !== filter.priority) return false;
    return true;
  });

  return (
    <div>
      {/* System Health Cards */}
      <SystemHealth />

      {/* Activity Feed */}
      <ActivityFeed />

      <PageHeader title="Tasks">
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 hover:shadow-glow-teal-sm rounded-lg text-sm text-white font-medium transition-all"
        >
          + Add Task
        </button>
      </PageHeader>

      {/* Filters */}
      <FilterBar>
        <FilterPill active={filter.status === 'all'} onClick={() => setFilter(f => ({ ...f, status: 'all' }))}>
          All Status
        </FilterPill>
        {STATUS_ORDER.map(s => (
          <FilterPill key={s} active={filter.status === s} onClick={() => setFilter(f => ({ ...f, status: s }))}>
            {s.replace('_', ' ')}
          </FilterPill>
        ))}
        <div className="w-px h-6 bg-white/[0.06] mx-1" />
        <FilterPill active={filter.priority === 'all'} onClick={() => setFilter(f => ({ ...f, priority: 'all' }))}>
          All Priority
        </FilterPill>
        {PRIORITY_ORDER.map(p => (
          <FilterPill key={p} active={filter.priority === p} onClick={() => setFilter(f => ({ ...f, priority: p }))}>
            {p}
          </FilterPill>
        ))}
      </FilterBar>

      {/* Add task form */}
      {adding && (
        <Card className="p-3 mb-4 border-teal-500/30">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Task title..."
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
            />
            <button onClick={addTask} className="text-teal-400 text-sm hover:text-teal-300 font-medium">Save</button>
            <button onClick={() => setAdding(false)} className="text-gray-500 text-sm hover:text-gray-400">Cancel</button>
          </div>
        </Card>
      )}

      {/* Task list */}
      {!loaded ? (
        <SkeletonList count={8} />
      ) : (
        <div className="space-y-1 card-stagger">
          {filtered.length === 0 && (
            <div className="text-center text-gray-500 py-16">
              {tasks.length === 0
                ? 'No tasks yet. Click "+ Add Task" to create one.'
                : 'No tasks match your filters.'}
            </div>
          )}

          {filtered.map(task => (
            <Card
              key={task.id}
              className="p-3 flex items-center gap-3 group"
            >
              {/* Status */}
              <button
                onClick={() => cycleStatus(task)}
                title="Click to cycle status"
              >
                <Badge variant={STATUS_BADGE[task.status] || 'gray'}>
                  {(task.status || 'todo').replace('_', ' ')}
                </Badge>
              </button>

              {/* Title */}
              <div className="flex-1 min-w-0">
                {editingId === task.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle(task.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => saveTitle(task.id)}
                    className="w-full bg-transparent text-white text-sm focus:outline-none border-b border-teal-500/50"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingId(task.id); setEditValue(task.title || ''); }}
                    className={`text-sm cursor-pointer block truncate ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200 hover:text-white'}`}
                  >
                    {task.title}
                  </span>
                )}
                {task.due_date && (
                  <span className={`text-xs ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-gray-500'}`}>
                    Due {new Date(task.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Source */}
              {task.source && (
                <span className="text-xs shrink-0" title={task.source}>
                  {SOURCE_ICONS[task.source] || '📌'}
                </span>
              )}

              {/* Priority */}
              <button
                onClick={() => cyclePriority(task)}
                title="Click to cycle priority"
              >
                <Badge variant={PRIORITY_BADGE[task.priority] || 'gray'}>
                  {task.priority || 'medium'}
                </Badge>
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-lg leading-none"
                title="Delete"
              >
                &times;
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
