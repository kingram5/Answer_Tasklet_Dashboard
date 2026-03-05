export default function GlassCard({ children, className = '', ...props }) {
  return (
    <div className={`glass rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
}
