import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  archived: 'bg-gray-500/20 text-gray-500',
};

const NODE_COLORS = {
  green: 'border-green-500 bg-green-500/10',
  blue: 'border-blue-500 bg-blue-500/10',
  yellow: 'border-yellow-500 bg-yellow-500/10',
  red: 'border-red-500 bg-red-500/10',
  purple: 'border-purple-500 bg-purple-500/10',
  gray: 'border-gray-500 bg-gray-500/10',
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
    }
    load();
  }, []);

  async function addProject() {
    if (!newName.trim()) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName('');
    setAdding(false);
    // Reload
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data) setProjects(data);
  }

  async function updateProject(id, updates) {
    await fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  async function deleteProject(id) {
    await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setProjects(prev => prev.filter(p => p.id !== id));
    if (expanded === id) setExpanded(null);
  }

  function renderNodes(nodes) {
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return <div className="text-gray-500 text-sm py-4 text-center">No nodes yet.</div>;
    }

    // Build tree from flat list
    const rootNodes = nodes.filter(n => !n.parent_id);
    const childMap = {};
    nodes.forEach(n => {
      if (n.parent_id) {
        if (!childMap[n.parent_id]) childMap[n.parent_id] = [];
        childMap[n.parent_id].push(n);
      }
    });

    function renderNode(node, depth = 0) {
      const children = childMap[node.id] || [];
      const colorClass = NODE_COLORS[node.color] || NODE_COLORS.gray;
      return (
        <div key={node.id} style={{ marginLeft: depth * 24 }} className="mb-1">
          <div className={`border-l-2 rounded-r px-3 py-1.5 ${colorClass}`}>
            <div className="text-sm text-white font-medium">{node.label}</div>
            {node.status && <span className="text-xs text-gray-400">{node.status}</span>}
            {node.notes && <div className="text-xs text-gray-500 mt-0.5">{node.notes}</div>}
          </div>
          {children.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return <div className="space-y-1">{rootNodes.map(n => renderNode(n))}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          + New Project
        </button>
      </div>

      {adding && (
        <div className="bg-dark-700 border border-teal-500/30 rounded-lg p-3 mb-4 flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addProject(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Project name..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
          />
          <button onClick={addProject} className="text-teal-400 text-sm hover:text-teal-300 font-medium">Create</button>
          <button onClick={() => setAdding(false)} className="text-gray-500 text-sm hover:text-gray-400">Cancel</button>
        </div>
      )}

      {projects.length === 0 && !adding && (
        <div className="text-center text-gray-500 py-16">
          No projects yet. Click "+ New Project" to create one.
        </div>
      )}

      <div className="space-y-2">
        {projects.map(project => (
          <div key={project.id} className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
            <div
              onClick={() => setExpanded(expanded === project.id ? null : project.id)}
              className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded === project.id ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{project.name}</div>
                {project.description && (
                  <div className="text-xs text-gray-400 truncate mt-0.5">{project.description}</div>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_COLORS[project.status] || STATUS_COLORS.active}`}>
                {project.status}
              </span>
              {project.tags && project.tags.length > 0 && (
                <div className="hidden md:flex gap-1">
                  {project.tags.map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-dark-600 rounded text-xs text-gray-400">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {expanded === project.id && (
              <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <select
                    value={project.status}
                    onChange={(e) => updateProject(project.id, { status: e.target.value })}
                    className="bg-dark-700 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="ml-auto text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Delete Project
                  </button>
                </div>
                {renderNodes(project.nodes_json)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
