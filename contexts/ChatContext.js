import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('answer_chat_session');
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('answer_chat_session', id);
      }
      return id;
    }
    return 'server';
  });

  useEffect(() => {
    async function loadHistory() {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase
          .from('chat_history')
          .select('role, content')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data && data.length > 0) {
          setMessages(data.reverse().map(m => ({ role: m.role, content: m.content })));
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }
    loadHistory();
  }, []);

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return;
    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId]);

  const toggleDrawer = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, isExpanded, setIsExpanded, isLoading, sendMessage, toggleDrawer }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
