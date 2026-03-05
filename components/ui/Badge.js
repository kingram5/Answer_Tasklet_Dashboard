const VARIANTS = {
  green: 'bg-green-500/15 text-green-400',
  blue: 'bg-blue-500/15 text-blue-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  gray: 'bg-gray-500/15 text-gray-400',
  teal: 'bg-teal-500/15 text-teal-400',
  pink: 'bg-pink-500/15 text-pink-400',
  orange: 'bg-orange-500/15 text-orange-400',
  purple: 'bg-indigo-500/15 text-indigo-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
};

export default function Badge({ variant = 'gray', children, className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${VARIANTS[variant] || VARIANTS.gray} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
