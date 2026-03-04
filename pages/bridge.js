import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORY_COLORS = {
  general: 'bg-gray-500/20 text-gray-400',
  reminder: 'bg-blue-500/20 text-blue-400',
  task: 'bg-green-500/20 text-green-400',
  wedding: 'bg-pink-500/20 text-pink-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export default function Bridge() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bridge_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    }
    load();

    const channel = supabase
      .channel('bridge-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bridge_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_agent: 'reggie',
          message: input.trim(),
          category,
        }),
      });
      setInput('');
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  }

  function groupByDate(msgs) {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }

  const grouped = groupByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold text-white mb-4 shrink-0">Bridge Messages</h1>

      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No bridge messages yet. Send one to Reggie.
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin min-h-0">
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="text-center text-xs text-gray-500 my-3">
                <span className="bg-dark-700 px-2 py-0.5 rounded">{date}</span>
              </div>
              <div className="space-y-2">
                {msgs.map(msg => {
                  const isAnswer = msg.from_agent === 'answer';
                  const catColors = CATEGORY_COLORS[msg.category] || CATEGORY_COLORS.general;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAnswer ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${isAnswer ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-500">
                            {isAnswer ? 'Answer' : 'Reggie'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColors}`}>
                            {msg.category}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`
                            px-3 py-2 rounded-lg text-sm
                            ${isAnswer
                              ? 'bg-teal-600/20 text-teal-100 rounded-br-sm'
                              : 'bg-dark-600 text-gray-200 rounded-bl-sm'
                            }
                          `}
                        >
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Send form */}
      <form onSubmit={sendMessage} className="mt-4 flex gap-2 shrink-0">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-dark-700 border border-white/10 rounded-lg px-2 py-2 text-xs text-gray-300 focus:outline-none shrink-0"
        >
          <option value="general">General</option>
          <option value="reminder">Reminder</option>
          <option value="task">Task</option>
          <option value="wedding">Wedding</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Reggie..."
          className="flex-1 bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 rounded-lg text-sm text-white font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
