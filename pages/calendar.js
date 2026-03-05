import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/ui/PageHeader';
import { FilterPill } from '../components/ui/FilterBar';

function getWeekDates(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('calendar_cache')
        .select('*')
        .order('start_time', { ascending: true });
      if (data) setEvents(data);
    }
    load();
  }, []);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const today = new Date().toDateString();

  function prevWeek() {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function prevDay() {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }
  function nextDay() {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  }

  function getEventsForDate(date) {
    const dateStr = date.toDateString();
    return events.filter(e => new Date(e.start_time).toDateString() === dateStr);
  }

  return (
    <div>
      <PageHeader title="Calendar">
        <FilterPill active={view === 'day'} onClick={() => setView('day')}>Day</FilterPill>
        <FilterPill active={view === 'week'} onClick={() => setView('week')}>Week</FilterPill>
      </PageHeader>

      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={view === 'week' ? prevWeek : prevDay}
          className="text-gray-400 hover:text-white text-lg transition-colors"
        >
          ←
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1 bg-dark-700 border border-white/[0.06] rounded text-sm text-gray-300 hover:text-white hover:border-white/[0.12] transition-all"
        >
          Today
        </button>
        <span className="text-sm text-gray-300 font-medium">
          {view === 'week'
            ? `${weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
            : currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          }
        </span>
        <button
          onClick={view === 'week' ? nextWeek : nextDay}
          className="text-gray-400 hover:text-white text-lg transition-colors"
        >
          →
        </button>
      </div>

      {events.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          No calendar events synced yet. Events will appear once the calendar sync is configured.
        </div>
      )}

      {events.length > 0 && view === 'week' && (
        <div className="hidden md:block overflow-x-auto">
          <div className="grid grid-cols-8 border-b border-white/[0.06]">
            <div className="w-16"></div>
            {weekDates.map((d, i) => (
              <div
                key={i}
                className={`text-center py-2 text-sm ${
                  d.toDateString() === today ? 'text-teal-400 font-semibold' : 'text-gray-400'
                }`}
              >
                <div className="text-xs">{d.toLocaleDateString([], { weekday: 'short' })}</div>
                <div>{d.getDate()}</div>
              </div>
            ))}
          </div>

          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-white/[0.04] min-h-[3rem]">
              <div className="w-16 text-xs text-gray-500 py-1 px-2 text-right">
                {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
              </div>
              {weekDates.map((d, i) => {
                const dayEvents = getEventsForDate(d).filter(e => {
                  const h = new Date(e.start_time).getHours();
                  return h === hour;
                });
                return (
                  <div key={i} className="border-l border-white/[0.04] px-1 py-0.5">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="bg-teal-600/20 border-l-2 border-teal-400 rounded px-1.5 py-0.5 text-xs mb-0.5 hover:bg-teal-600/30 transition-colors"
                        title={ev.description || ev.title}
                      >
                        <div className="text-teal-300 font-medium truncate">{ev.title}</div>
                        <div className="text-gray-400">{formatTime(ev.start_time)}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Day view */}
      {events.length > 0 && (view === 'day' || true) && (
        <div className={view === 'week' ? 'md:hidden' : ''}>
          <div className="space-y-1">
            {HOURS.map(hour => {
              const dayEvents = getEventsForDate(currentDate).filter(e => {
                const h = new Date(e.start_time).getHours();
                return h === hour;
              });
              return (
                <div key={hour} className="flex gap-3 min-h-[2.5rem]">
                  <div className="w-14 text-xs text-gray-500 py-1 text-right shrink-0">
                    {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                  </div>
                  <div className="flex-1 border-t border-white/[0.04] py-0.5">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="bg-teal-600/20 border-l-2 border-teal-400 rounded-r px-3 py-1.5 mb-1 hover:bg-teal-600/30 transition-colors"
                      >
                        <div className="text-sm text-teal-300 font-medium">{ev.title}</div>
                        <div className="text-xs text-gray-400">
                          {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                        </div>
                        {ev.location && (
                          <div className="text-xs text-gray-500 mt-0.5">{ev.location}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
