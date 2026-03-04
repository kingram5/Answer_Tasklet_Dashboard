import { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';

export default function ChatDrawer() {
  const { messages, isExpanded, toggleDrawer, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isExpanded]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  }

  const lastMsg = messages[messages.length - 1];

  return (
    <div
      className={`
        fixed bottom-0 left-0 lg:left-60 right-0 z-30
        bg-dark-800 border-t border-white/10
        transition-all duration-300 ease-in-out flex flex-col
        ${isExpanded ? 'h-[80vh] md:h-[40vh]' : 'h-12'}
      `}
    >
      {/* Toggle bar */}
      <button
        onClick={toggleDrawer}
        className="w-full h-12 shrink-0 flex items-center px-4 gap-3 hover:bg-white/5 transition-colors relative"
      >
        <div className="w-8 h-1 bg-gray-600 rounded-full absolute left-1/2 -translate-x-1/2 top-1.5" />
        <span className="text-teal-400 font-medium text-sm">Answer</span>
        {!isExpanded && lastMsg && (
          <span className="text-gray-500 text-xs truncate max-w-[50%]">
            {lastMsg.content?.slice(0, 80)}
          </span>
        )}
        {!isExpanded && !lastMsg && (
          <span className="text-gray-600 text-xs">Ask Answer...</span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Chat content */}
      {isExpanded && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-8">
                Start a conversation with Answer
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-teal-600/20 text-teal-100'
                      : 'bg-dark-600 text-gray-200'
                    }
                  `}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-dark-600 text-gray-400 px-3 py-2 rounded-lg text-sm">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Answer anything..."
              className="flex-1 bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 rounded-lg text-sm text-white font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
