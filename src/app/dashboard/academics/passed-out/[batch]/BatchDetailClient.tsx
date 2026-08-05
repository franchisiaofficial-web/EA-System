'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Search,
  FileText,
  Download,
  Award,
  FileCheck,
  Archive,
  Loader2,
  Eye,
} from 'lucide-react';
import { PageHeader, PageCard } from '@/components/ui/ea/layout';
import { EAButton } from '@/components/ui/ea';

interface PassedOutStudent {
  id: string;
  studentId: string;
  batch: string;
  passedOutDate: string;
  graduationReason: string | null;
  finalRollNumber: string | null;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    gender: string | null;
    status: string;
  };
  finalAcademicYear: { name: string } | null;
  finalClass: { name: string } | null;
  finalSection: { name: string } | null;
}

export function BatchDetailClient({ batch }: { batch: string }) {
  const [students, setStudents] = useState<PassedOutStudent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams({ batch, search });
    fetch(`/api/passed-out?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.students) setStudents(d.data.students);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batch, search]);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title={`Batch ${decodeURIComponent(batch)}`}
        subtitle="Passed-out student records — read-only archive."
        back
      />

      <PageCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or admission..."
              className="h-10 w-full rounded-lg bg-card border border-border pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-cli-emerald focus:ring-4 focus:ring-cli-emerald/10"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <EAButton variant="secondary" size="sm">
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </EAButton>
            <EAButton variant="secondary" size="sm">
              <Award className="h-4 w-4 mr-1.5" />
              Certificates
            </EAButton>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono py-8 text-center">
            No passed-out records found.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-4 py-2.5">Admission No</th>
                  <th className="px-4 py-2.5">Roll No</th>
                  <th className="px-4 py-2.5">Student Name</th>
                  <th className="px-4 py-2.5">Gender</th>
                  <th className="px-4 py-2.5">Last Class</th>
                  <th className="px-4 py-2.5">Last Section</th>
                  <th className="px-4 py-2.5">Completed Year</th>
                  <th className="px-4 py-2.5">Passed Out Date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-10">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-border hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {s.student.admissionNumber}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {s.finalRollNumber || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {s.student.firstName} {s.student.lastName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.student.gender || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.finalClass?.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.finalSection?.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.finalAcademicYear?.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {fmtDate(s.passedOutDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center text-[10px] font-mono text-cli-emerald bg-cli-emerald/10 px-2 py-0.5 rounded-md">
                        {s.student.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/academics/students/${s.studentId}`}
                          title="View Profile"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          title="Transfer Certificate"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Conduct Certificate"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Award className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Academic Record"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Archive"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}
