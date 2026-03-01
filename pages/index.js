import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load recent messages on mount
  useEffect(() => {
    if (!supabase) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        setMessages(data.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        })));
      }
    };
    loadMessages();
  }, []);

  // Subscribe to Supabase realtime for Answer's responses
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('chat-responses')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: 'role=eq.assistant',
      }, (payload) => {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: payload.new.content,
          timestamp: new Date(payload.new.created_at),
        }]);
        setSending(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    inputRef.current?.focus();

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Connection error. Try again in a moment.',
        timestamp: new Date(),
      }]);
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { icon: '📧', label: 'Run email triage', action: 'Run email triage now' },
    { icon: '📊', label: 'Daily review', action: 'Generate daily review' },
    { icon: '📋', label: 'Check tasks', action: 'Show my open tasks' },
    { icon: '🔍', label: 'Account status', action: 'Show target account status' },
    { icon: '📦', label: 'Supply check', action: 'Check supply status' },
    { icon: '📞', label: 'Outreach due', action: 'Who needs outreach this week?' },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-blue flex items-center justify-center text-white font-bold text-base">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Answer</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Control Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Tab Navigation */}
            <nav className="flex gap-1 bg-dark-800 rounded-lg p-1">
              {[
                { id: 'chat', label: '💬 Chat' },
                { id: 'overview', label: '📊 Overview' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-dark-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'chat' ? (
        <>
          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">⚡</div>
                  <h2 className="text-xl font-bold text-white mb-2">Answer Control Dashboard</h2>
                  <p className="text-gray-400 text-sm mb-8">Your AI work automation command center</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                    {quickActions.map((qa) => (
                      <button
                        key={qa.label}
                        onClick={() => { setInput(qa.action); inputRef.current?.focus(); }}
                        className="px-3 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors text-left"
                      >
                        <span className="mr-1">{qa.icon}</span> {qa.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-accent-blue text-white rounded-br-md'
                      : 'bg-dark-700 text-gray-200 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-50">
                      {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-dark-700 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input */}
          <footer className="border-t border-dark-600 px-4 py-3">
            <div className="max-w-4xl mx-auto flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Answer..."
                className="flex-1 bg-dark-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent-blue/50 transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="bg-accent-blue hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-accent-blue text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </footer>
        </>
      ) : (
        /* Overview Tab */
        <main className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Email Triage Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">📧 Email Triage</h3>
                  <span className="text-[10px] text-gray-500 uppercase">Today</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Action Items</span>
                    <span className="text-xs font-bold text-accent-green">--</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">FYI</span>
                    <span className="text-xs font-bold text-accent-blue">--</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Spam</span>
                    <span className="text-xs font-bold text-gray-500">--</span>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveTab('chat'); setInput('Run email triage now'); }}
                  className="mt-3 w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  Run Triage Now
                </button>
              </div>

              {/* Tasks Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">📋 Tasks</h3>
                  <span className="text-[10px] text-gray-500 uppercase">Open</span>
                </div>
                <p className="text-xs text-gray-400">Connect to view your tasks</p>
                <button
                  onClick={() => { setActiveTab('chat'); setInput('Show my open tasks'); }}
                  className="mt-3 w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  View Tasks
                </button>
              </div>

              {/* Revenue Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">💰 Revenue</h3>
                  <span className="text-[10px] text-gray-500 uppercase">This Month</span>
                </div>
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-xs text-gray-500 mt-1">Target: $2.5M</p>
                <div className="mt-3 w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green rounded-full" style={{width: '0%'}}></div>
                </div>
              </div>

              {/* Outreach Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">📞 Outreach</h3>
                  <span className="text-[10px] text-gray-500 uppercase">Due</span>
                </div>
                <p className="text-xs text-gray-400">Accounts needing contact</p>
                <button
                  onClick={() => { setActiveTab('chat'); setInput('Who needs outreach this week?'); }}
                  className="mt-3 w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  Check Outreach
                </button>
              </div>

              {/* Supply Status Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">📦 Supply</h3>
                  <span className="text-[10px] text-gray-500 uppercase">Alerts</span>
                </div>
                <p className="text-xs text-gray-400">No active supply alerts</p>
                <button
                  onClick={() => { setActiveTab('chat'); setInput('Check supply status'); }}
                  className="mt-3 w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  Check Supply
                </button>
              </div>

              {/* Quick Actions Widget */}
              <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">⚡ Quick Actions</h3>
                </div>
                <div className="space-y-2">
                  {quickActions.slice(0, 4).map(qa => (
                    <button
                      key={qa.label}
                      onClick={() => { setActiveTab('chat'); setInput(qa.action); }}
                      className="w-full text-left px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs text-gray-300 transition-colors"
                    >
                      {qa.icon} {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
