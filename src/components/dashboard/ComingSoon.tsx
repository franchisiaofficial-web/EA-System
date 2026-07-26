'use client';

interface ComingSoonProps {
  pageTitle: string;
  description: string;
}

export function ComingSoon({ pageTitle, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          module &bull; coming soon
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto leading-relaxed">
          {description}
        </p>
        <p className="text-sm text-muted-foreground font-mono mt-3">
          Available in a future update.
        </p>
      </div>
    </div>
  );
}
