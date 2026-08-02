'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, ChevronRight, UserCircle2, CalendarClock, FileText, Table2, Percent } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/ea/layout';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { EAButton } from '@/components/ui/ea';
import { CardGridSkeleton } from '@/components/ui/skeleton';

interface SectionCard {
  id: string;
  name: string;
  status: string;
  enrollmentRecords: { id: string }[];
  studentEnrollments: { id: string }[];
}

interface ClassWithSections {
  id: string;
  name: string;
  status: string;
  academicYear: { name: string } | null;
  sections: SectionCard[];
  assignments: { id: string; role: string; teacherMembership: { user: { name: string } } }[];
}

interface SectionAttendance { present: number; late: number; absent: number; excused: number; total: number }

export function ClassList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<ClassWithSections[]>([]);
  const [sectionAttendance, setSectionAttendance] = useState<Record<string, SectionAttendance>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (s: string) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (s) params.set('search', s);
    try {
      const res = await fetch(`/api/classes?${params}`);
      const data = await res.json();
      if (data.success) { if (reqId.current === id) { setItems(data.data.items); setSectionAttendance(data.data.sectionAttendance || {}); } }
      else if (reqId.current === id) toast.error('Failed to load');
    } catch { if (reqId.current === id) toast.error('Failed to load'); }
    finally { if (reqId.current === id) setLoading(false); }
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(search); } }, [search, load]);

  useEffect(() => {
    if (!didLoad.current) return;
    const tid = setTimeout(() => void load(search), 300);
    return () => clearTimeout(tid);
  }, [search, load]);

  const sectionCount = (s: SectionCard) => s.enrollmentRecords.length || s.studentEnrollments.length;

  return (
    <>
      <PageHeader title="Classes & Sections" subtitle="Sections grouped by class for the current academic year." />
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <EntityActionBar
            entityLabel="Class"
            createHref={canCreate ? '/dashboard/academics/classes/create' : undefined}
            onRefresh={() => void load(search)}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by class, section, teacher, year..."
            className="h-10 w-full max-w-xs rounded-xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all"
          />
        </div>
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground font-mono">No classes found</p>
            {canCreate && (
              <EAButton className="mt-4" onClick={() => router.push('/dashboard/academics/classes/create')}>
                <Plus className="h-4 w-4 mr-1.5" />Create Class
              </EAButton>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {items.map(cls => {
              const teacher = cls.assignments[0]?.teacherMembership?.user?.name;
              return (
                <div key={cls.id}>
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/dashboard/academics/classes/${cls.id}`} className="group flex items-center gap-1.5">
                      <span className="text-lg font-bold text-foreground group-hover:text-cli-emerald transition-colors">{cls.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-cli-emerald transition-colors" />
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">{cls.academicYear?.name}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${cls.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald' : 'bg-muted/50 text-muted-foreground/70'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cls.status === 'ACTIVE' ? 'bg-cli-emerald' : 'bg-muted-foreground/30'}`} />{cls.status}
                      </span>
                    </div>
                  </div>
                  {cls.sections.length === 0 ? (
                    <Link href={`/dashboard/academics/classes/${cls.id}`}>
                      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center hover:border-cli-emerald/40 transition-colors">
                        <p className="text-sm text-muted-foreground font-mono">No sections — add one from the class page</p>
                      </div>
                    </Link>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {cls.sections.map(s => (
                        <div key={s.id} className="rounded-2xl border border-border bg-card p-5 hover:border-border hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all h-full flex flex-col">
                          <Link href={`/dashboard/academics/sections/${s.id}`} className="flex-1">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-base font-bold text-foreground">{s.name}</p>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${s.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald' : 'bg-muted/50 text-muted-foreground/70'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-cli-emerald' : 'bg-muted-foreground/30'}`} />{s.status}
                              </span>
                            </div>
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-purple/10 flex items-center justify-center"><Users className="h-4 w-4 text-cli-purple" /></div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{sectionCount(s)}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Students</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-emerald/10 flex items-center justify-center"><UserCircle2 className="h-4 w-4 text-cli-emerald" /></div>
                                <div className="min-w-0">
                                  <p className="text-sm text-foreground truncate">{teacher || '—'}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Class Teacher</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-emerald/10 flex items-center justify-center"><Percent className="h-4 w-4 text-cli-emerald" /></div>
                                <div className="min-w-0">
                                  <p className="text-sm text-foreground truncate">{sectionAttendance[s.id] && sectionAttendance[s.id].total > 0 ? `${Math.round(((sectionAttendance[s.id].present + sectionAttendance[s.id].late) / sectionAttendance[s.id].total) * 100)}%` : '—'}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Attendance</p>
                                </div>
                              </div>
                            </div>
                          </Link>
                          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/60">
                            <Link href={`/dashboard/academics/timetable?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Table2 className="h-3 w-3" />Timetable</Link>
                            <Link href={`/dashboard/academics/exams?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><CalendarClock className="h-3 w-3" />Exam Schedule</Link>
                            <Link href={`/dashboard/academics/exams?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><FileText className="h-3 w-3" />Exam Reports</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
