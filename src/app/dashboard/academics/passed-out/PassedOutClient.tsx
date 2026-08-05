'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, Users, ChevronRight, Loader2 } from 'lucide-react';
import { PageHeader, PageCard } from '@/components/ui/ea/layout';
import { EAButton } from '@/components/ui/ea';

interface BatchCard {
  batch: string;
  count: number;
  completed: number;
  academicYearName: string;
}

export function PassedOutClient() {
  const [batches, setBatches] = useState<BatchCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/passed-out')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBatches(d.data.batches);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Passed Out Students"
        subtitle="Students who have completed their schooling — batch-wise archive."
        back
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : batches.length === 0 ? (
        <PageCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-mono">
              No passed-out student records yet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Students graduate when promoted from the highest grade.
            </p>
          </div>
        </PageCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Link
              key={b.batch}
              href={`/dashboard/academics/passed-out/${encodeURIComponent(b.batch)}`}
              className="group rounded-xl border border-border bg-card hover:border-cli-emerald/40 hover:shadow-md transition-all duration-200"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-cli-emerald/10 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-cli-emerald" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-cli-emerald transition-colors" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Batch {b.batch}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Academic Year: {b.academicYearName}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {b.count}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Students
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cli-emerald bg-cli-emerald/10 px-2 py-0.5 rounded-md">
                    Completed
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
