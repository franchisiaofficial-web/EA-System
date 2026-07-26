export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-60 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-44 rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-16 rounded-md bg-muted" />
            <div className="mt-2 h-7 w-12 rounded-md bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="h-3.5 w-28 rounded-md bg-muted" />
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-3/4 rounded-md bg-muted" />
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-2/3 rounded-md bg-muted" />
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-4/5 rounded-md bg-muted" />
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-1/2 rounded-md bg-muted" />
        </div>
        <div className="px-4 py-3">
          <div className="h-4 w-3/5 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
