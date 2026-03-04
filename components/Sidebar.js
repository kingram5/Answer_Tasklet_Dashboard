import { useRouter } from 'next/router';
import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Tasks', icon: '📋' },
  { href: '/emails', label: 'Email Feed', icon: '📧' },
  { href: '/accounts', label: 'Accounts', icon: '📊' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/briefings', label: 'Morning Briefing', icon: '📝' },
  { href: '/projects', label: 'Projects', icon: '📁' },
  { href: '/reports', label: 'Reports', icon: '📄' },
  { href: '/bridge', label: 'Bridge Messages', icon: '🔄' },
  { href: '/classifier', label: 'Classifier Review', icon: '🎯' },
];

export default function Sidebar({ isOpen, onClose }) {
  const router = useRouter();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-60 bg-dark-800 border-r border-white/10
          z-50 transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-5 border-b border-white/10">
          <h1 className="text-base font-semibold text-white tracking-wide">
            ANSWER DASHBOARD
          </h1>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
