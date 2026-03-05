import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TasksIcon, MailIcon, CalendarIcon,
  UsersIcon, SunriseIcon, FileTextIcon,
  FolderIcon, MessageIcon, TargetIcon
} from './icons/NavIcons';

const NAV_GROUPS = [
  {
    label: 'CORE',
    items: [
      { href: '/', label: 'Tasks', icon: TasksIcon },
      { href: '/emails', label: 'Email Feed', icon: MailIcon },
      { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { href: '/accounts', label: 'Accounts', icon: UsersIcon },
      { href: '/briefings', label: 'Morning Briefing', icon: SunriseIcon },
      { href: '/reports', label: 'Reports', icon: FileTextIcon },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderIcon },
      { href: '/bridge', label: 'Bridge Messages', icon: MessageIcon },
      { href: '/classifier', label: 'Classifier Review', icon: TargetIcon },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState({});

  function toggleGroup(label) {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-dark-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-60 glass-dense
          z-50 transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Branding */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-glow-teal-sm">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-wide">ANSWER</h1>
              <p className="text-[10px] text-gray-500 tracking-widest">DASHBOARD</p>
            </div>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          {NAV_GROUPS.map(group => {
            const isCollapsed = collapsedGroups[group.label];
            return (
              <div key={group.label} className="mb-4">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-[0.15em] hover:text-gray-400 transition-colors"
                >
                  <span>{group.label}</span>
                  <svg
                    className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 mt-1">
                        {group.items.map(item => {
                          const isActive = router.pathname === item.href;
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onClose}
                              className={`
                                flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm
                                transition-all duration-150
                                ${isActive
                                  ? 'bg-teal-500/10 text-teal-300 shadow-glow-teal-sm'
                                  : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                                }
                              `}
                            >
                              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : ''}`} />
                              <span>{item.label}</span>
                              {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 shadow-glow-teal-sm" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Version */}
        <div className="p-3 border-t border-white/[0.06] text-[10px] text-gray-600">
          Answer v1.0
        </div>
      </aside>
    </>
  );
}
