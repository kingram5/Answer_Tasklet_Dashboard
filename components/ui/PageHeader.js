export default function PageHeader({ title, gradient = true, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1
        className={`text-2xl font-bold ${gradient ? 'text-gradient-teal-purple' : 'text-white'}`}
      >
        {title}
      </h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
