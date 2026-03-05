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
        bg-dark-800 rounded-lg
        transition-all duration-300
        ${hover ? 'animated-border hover:scale-[1.01] hover:-translate-y-0.5' : 'border border-white/[0.06]'}
        ${glowClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
