export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return <div className={`skeleton ${width} ${height} ${className}`} />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`bg-dark-800 border border-white/[0.06] rounded-lg p-4 space-y-3 ${className}`}>
      <SkeletonLine width="w-1/3" height="h-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? 'w-2/3' : 'w-full'} height="h-3" />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-dark-800 border border-white/[0.06] rounded-lg p-3 flex items-center gap-3">
          <SkeletonLine width="w-16" height="h-5" />
          <SkeletonLine width="w-full" height="h-4" />
          <SkeletonLine width="w-12" height="h-5" />
        </div>
      ))}
    </div>
  );
}
