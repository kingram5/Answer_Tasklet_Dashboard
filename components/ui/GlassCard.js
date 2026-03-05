export default function GlassCard({ children, className = '', variant = 'teal', animated = false, ...props }) {
  return (
    <div
      className={`
        glass rounded-xl relative glass-noise
        ${animated ? 'animated-border animated-border-always' : 'border border-white/[0.06]'}
        transition-all duration-300
        hover:scale-[1.01] hover:-translate-y-0.5
        ${variant === 'purple' ? 'hover:glow-border-purple' : 'hover:glow-border-teal'}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
