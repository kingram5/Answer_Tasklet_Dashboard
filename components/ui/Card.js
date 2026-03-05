const GLOW_VARIANTS = {
  teal: 'hover:glow-border-teal',
  purple: 'hover:glow-border-purple',
  none: '',
};

export default function Card({ children, className = '', glow = 'teal', hover = true, ...props }) {
  const glowClass = hover ? (GLOW_VARIANTS[glow] || '') : '';
  return (
    <div
      className={`
        bg-dark-800 border border-white/[0.06] rounded-lg
        transition-all duration-200
        ${hover ? 'hover:border-white/[0.12]' : ''}
        ${glowClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
