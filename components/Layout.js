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
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="manifest" href="/manifest.json" />
        <title>Answer Dashboard</title>
      </Head>

      <div className="min-h-screen bg-dark-900 text-gray-200">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Mobile header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-dark-800 border-b border-white/10 flex items-center px-4 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-semibold text-white tracking-wide">ANSWER DASHBOARD</span>
        </header>

        {/* Main content */}
        <main
          className={`
            lg:ml-60 pt-14 lg:pt-0
            transition-all duration-300
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
