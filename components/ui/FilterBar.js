export function FilterPill({ active, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150
        ${active
          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
          : 'text-gray-400 border border-white/[0.06] hover:border-white/[0.12] hover:text-gray-200'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export function FilterBar({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 mb-4 ${className}`}>
      {children}
    </div>
  );
}
