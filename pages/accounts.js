import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { SkeletonList } from '../components/ui/Skeleton';

const HEALTH_DOT = { green: '🟢', amber: '🟡', red: '🔴' };
const STATUS_COLORS = {
  active: 'text-green-400',
  at_risk: 'text-amber-400',
  dormant: 'text-gray-500',
  new: 'text-blue-400',
};

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('accounts').select('*').order('name');
      if (data) setAccounts(data);
      setLoaded(true);
    }
    load();
  }, []);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  async function saveField(id, field, value) {
    await fetch('/api/accounts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value, updated_at: new Date().toISOString() } : a));
    setEditing(null);
  }

  const sorted = [...accounts].sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : (aVal > bVal ? 1 : -1);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function EditableCell({ account, field }) {
    const key = `${account.id}-${field}`;
    if (editing === key) {
      return (
        <input
          autoFocus
          defaultValue={account[field] || ''}
          onBlur={(e) => saveField(account.id, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveField(account.id, field, e.target.value);
            if (e.key === 'Escape') setEditing(null);
          }}
          className="bg-dark-700 border border-teal-500/50 rounded px-1.5 py-0.5 text-sm w-full focus:outline-none text-white"
        />
      );
    }
    return (
      <span
        onClick={() => setEditing(key)}
        className="cursor-pointer hover:text-teal-300 transition-colors text-sm text-gray-300"
      >
        {account[field] || '—'}
      </span>
    );
  }

  function SortHeader({ field, label }) {
    return (
      <th
        onClick={() => toggleSort(field)}
        className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
      >
        {label} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
      </th>
    );
  }

  return (
    <div>
      <PageHeader title="Accounts" />

      {!loaded ? (
        <SkeletonList count={6} />
      ) : accounts.length === 0 ? (
        <div className="text-center text-gray-500 py-16">No accounts found.</div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-2 card-stagger">
            {sorted.map(acc => (
              <Card
                key={acc.id}
                onClick={() => setExpanded(expanded === acc.id ? null : acc.id)}
                className="p-3 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{HEALTH_DOT[acc.health] || '⬜'}</span>
                  <span className="text-sm font-medium text-white">{acc.name}</span>
                  <span className={`text-xs ml-auto ${STATUS_COLORS[acc.status] || ''}`}>
                    {acc.status?.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-400">{acc.contact_name}</div>
                <div className="text-xs text-gray-500 mt-1">{acc.next_action || 'No next action set'}</div>
                {expanded === acc.id && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 text-xs">
                    <div><span className="text-gray-500">Email:</span> <span className="text-gray-300">{acc.contact_email || '—'}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="text-gray-300">{acc.contact_phone || '—'}</span></div>
                    <div><span className="text-gray-500">Last Contact:</span> <span className="text-gray-300">{acc.last_contact ? `${daysSince(acc.last_contact)}d ago` : '—'}</span></div>
                    <div><span className="text-gray-500">Notes:</span> <span className="text-gray-300">{acc.notes || '—'}</span></div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <th className="w-8 px-3 py-2.5"></th>
                  <SortHeader field="name" label="Account" />
                  <SortHeader field="status" label="Status" />
                  <SortHeader field="contact_name" label="Contact" />
                  <SortHeader field="last_contact" label="Last Contact" />
                  <SortHeader field="outreach_due" label="Outreach Due" />
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(acc => {
                  const overdue = acc.outreach_due && new Date(acc.outreach_due) < new Date();
                  const isExp = expanded === acc.id;
                  return (
                    <Fragment key={acc.id}>
                      <tr
                        onClick={() => setExpanded(isExp ? null : acc.id)}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">{HEALTH_DOT[acc.health] || '⬜'}</td>
                        <td className="px-3 py-2.5 text-sm text-white font-medium">{acc.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium ${STATUS_COLORS[acc.status] || ''}`}>
                            {acc.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-300">{acc.contact_name || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-400">
                          {acc.last_contact ? `${daysSince(acc.last_contact)}d ago` : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-sm ${overdue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                          {acc.outreach_due ? new Date(acc.outreach_due).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <EditableCell account={acc} field="next_action" />
                        </td>
                      </tr>

                      {isExp && (
                        <tr className="bg-dark-750/50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Primary Contact</div>
                                <div className="text-gray-300">{acc.contact_name || '—'}</div>
                                <div className="text-gray-400 text-xs">{acc.contact_email}</div>
                                <div className="text-gray-400 text-xs">{acc.contact_phone}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Secondary Contact</div>
                                <div className="text-gray-300">{acc.contact2_name || '—'}</div>
                                <div className="text-gray-400 text-xs">{acc.contact2_email}</div>
                                <div className="text-gray-400 text-xs">{acc.contact2_phone}</div>
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-500 mb-1">Open Items</div>
                                <EditableCell account={acc} field="open_items" />
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-500 mb-1">Wallet Share Notes</div>
                                <EditableCell account={acc} field="wallet_share_notes" />
                              </div>
                              <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-500 mb-1">Notes</div>
                                <EditableCell account={acc} field="notes" />
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-500 mb-1">Health</div>
                                <div className="flex gap-2 mt-1">
                                  {['green', 'amber', 'red'].map(h => (
                                    <button
                                      key={h}
                                      onClick={() => saveField(acc.id, 'health', h)}
                                      className={`text-lg transition-opacity ${acc.health === h ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
                                    >
                                      {HEALTH_DOT[h]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <div className="text-xs text-gray-500 mb-1">Status</div>
                                <select
                                  value={acc.status || 'active'}
                                  onChange={(e) => saveField(acc.id, 'status', e.target.value)}
                                  className="bg-dark-700 border border-white/[0.06] rounded px-2 py-1 text-sm text-gray-300 focus:outline-none mt-1"
                                >
                                  <option value="active">Active</option>
                                  <option value="at_risk">At Risk</option>
                                  <option value="dormant">Dormant</option>
                                  <option value="new">New</option>
                                </select>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
