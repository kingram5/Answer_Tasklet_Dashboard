import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_COLORS = {
  urgent: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-gray-500/20 text-gray-400',
};

const STATUS_COLORS = {
  todo: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  done: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-600/20 text-gray-500',
};

const SOURCE_ICONS = {
  manual: '✏️', email: '📧', bridge: '🔄', cowork: '🤝', vapi: '📞', briefing: '📝',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          + Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
          className="bg-dark-700 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-teal-500/50"
        >
          <option value="all">All Status</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={filter.priority}
          onChange={(e) => setFilter(f => ({ ...f, priority: e.target.value }))}
          className="bg-dark-700 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-teal-500/50"
        >
          <option value="all">All Priority</option>
          {PRIORITY_ORDER.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Add task form */}
      {adding && (
        <div className="bg-dark-700 border border-teal-500/30 rounded-lg p-3 mb-4 flex gap-2">
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
      )}

      {/* Task list */}
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            {tasks.length === 0
              ? 'No tasks yet. Click "+ Add Task" to create one.'
              : 'No tasks match your filters.'}
          </div>
        )}

        {filtered.map(task => (
          <div
            key={task.id}
            className="bg-dark-800 border border-white/10 rounded-lg p-3 flex items-center gap-3 group hover:border-white/20 transition-colors"
          >
            {/* Status */}
            <button
              onClick={() => cycleStatus(task)}
              className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}
              title="Click to cycle status"
            >
              {(task.status || 'todo').replace('_', ' ')}
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
              className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}
              title="Click to cycle priority"
            >
              {task.priority || 'medium'}
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteTask(task.id)}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-lg leading-none"
              title="Delete"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
