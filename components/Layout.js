import { useState } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import ChatDrawer from './ChatDrawer';
import { useChat } from '../contexts/ChatContext';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isExpanded } = useChat();

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#08080c" />
        <title>Answer Dashboard</title>
      </Head>

      <div className="min-h-screen bg-dark-900 text-gray-300">
        {/* Cosmic star background */}
        <div className="stars-bg" />

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Mobile header - glassmorphic */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-14 glass-dense z-30 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-glow-teal-sm">
              <span className="text-white text-[8px] font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-white tracking-wide">ANSWER</span>
          </div>
        </header>

        {/* Main content */}
        <main
          className={`
            lg:ml-60 pt-14 lg:pt-0
            transition-all duration-300
            relative z-10
            ${isExpanded ? 'pb-[80vh] md:pb-[40vh]' : 'pb-14'}
          `}
        >
          <div className="p-4 md:p-6 max-w-7xl">
            {children}
          </div>
        </main>

        <ChatDrawer />
      </div>
    </>
  );
}
