'use client';

import { useState, useOptimistic, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, X, Minus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  markAttendanceAction,
  bulkMarkAttendanceAction,
  updateAttendanceAction,
} from '@/actions/attendance';
import type { AttendanceStatus } from '@/generated/prisma/client';
import { cn } from '@/lib/utils';

interface ClassInfo {
  id: string;
  name: string;
  sectionName: string;
  gradeLevel: string;
  enrollmentCount: number;
}

interface EnrollmentInfo {
  id: string;
  studentMembershipId: string;
  studentName: string;
}

interface AttendanceEntry {
  id: string;
  status: string;
}

interface InitialData {
  classes: ClassInfo[];
  enrollments: EnrollmentInfo[];
  attendanceMap: Record<string, AttendanceEntry>;
}

type OptimisticRecord = {
  membershipId: string;
  status: string;
  pending: boolean;
  rollbackStatus: string | null;
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'PRESENT':
      return <Check className="h-4 w-4" />;
    case 'LATE':
      return <Clock className="h-4 w-4" />;
    case 'ABSENT':
      return <X className="h-4 w-4" />;
    case 'EXCUSED':
      return <Minus className="h-4 w-4" />;
    default:
      return null;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'PRESENT':
      return 'bg-cli-emerald/10 text-foreground dark:text-cli-emerald border-cli-emerald/30';
    case 'LATE':
      return 'bg-muted/40 text-muted-foreground border-border';
    case 'ABSENT':
      return 'bg-muted/40 text-foreground border-border';
    case 'EXCUSED':
      return 'bg-muted/40 text-muted-foreground border-border';
    default:
      return '';
  }
}

const STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function getDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function TeacherAttendanceClient({
  schoolId,
  initialClassId,
  initialDate,
  initialData,
}: {
  schoolId: string;
  initialClassId: string | null;
  initialDate?: string;
  initialData: InitialData;
}) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialClassId
  );
  const [selectedDate, setSelectedDate] = useState(initialDate ?? getDateStr());
  const [saving, setSaving] = useState(false);

  const [optimisticRecords, addOptimistic] = useOptimistic<OptimisticRecord[]>(
    []
  );

  const selectedClass = initialData.classes.find(
    (c) => c.id === selectedClassId
  );

  const handleStatusToggle = (
    studentMembershipId: string,
    currentStatus: string | undefined
  ) => {
    const currentIdx = currentStatus
      ? STATUSES.indexOf(currentStatus as AttendanceStatus)
      : -1;
    const nextStatus = STATUSES[(currentIdx + 1) % STATUSES.length];
    const rollbackStatus = currentStatus || null;

    addOptimistic((prev) => [
      ...prev.filter((r) => r.membershipId !== studentMembershipId),
      {
        membershipId: studentMembershipId,
        status: nextStatus,
        pending: true,
        rollbackStatus,
      },
    ]);

    startTransition(async () => {
      try {
        const existing = initialData.attendanceMap[studentMembershipId];
        if (existing) {
          await updateAttendanceAction({
            recordId: existing.id,
            status: nextStatus,
          });
        } else {
          await markAttendanceAction({
            schoolId,
            classId: selectedClassId!,
            studentMembershipId,
            date: new Date(selectedDate),
            status: nextStatus,
          });
        }
        router.refresh();
      } catch (e: unknown) {
        toast.error((e as Error).message || 'Failed to update attendance');
        addOptimistic((prev) => [
          ...prev.filter((r) => r.membershipId !== studentMembershipId),
          {
            membershipId: studentMembershipId,
            status: rollbackStatus ?? '',
            pending: false,
            rollbackStatus: null,
          },
        ]);
      }
    });
  };

  const handleBulk = (status: AttendanceStatus) => {
    if (!selectedClassId) return;
    setSaving(true);

    const newRecords = initialData.enrollments
      .filter((e) => !initialData.attendanceMap[e.studentMembershipId])
      .map((e) => ({ studentMembershipId: e.studentMembershipId, status }));

    if (newRecords.length === 0) {
      toast.info(
        'All students already have attendance recorded for this date.'
      );
      setSaving(false);
      return;
    }

    addOptimistic((prev) => [
      ...prev,
      {
        membershipId: `bulk-${Date.now()}`,
        status,
        pending: true,
        rollbackStatus: null,
      },
    ]);

    startTransition(async () => {
      try {
        await bulkMarkAttendanceAction({
          schoolId,
          classId: selectedClassId,
          date: new Date(selectedDate),
          records: newRecords,
        });
        router.refresh();
        toast.success(
          `Marked ${newRecords.length} students as ${status.toLowerCase()}.`
        );
      } catch (e: unknown) {
        toast.error((e as Error).message || 'Bulk operation failed');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    startTransition(() => {
      router.push(
        `/dashboard/teacher/attendance?classId=${classId}&date=${selectedDate}`
      );
      router.refresh();
    });
  };

  const getOptimisticStatus = (studentMembershipId: string): string | null => {
    const opt = optimisticRecords.filter(
      (r) => r.membershipId === studentMembershipId
    );
    if (opt.length > 0) {
      const latest = opt[opt.length - 1];
      if (latest.status === '') return null;
      return latest.status;
    }
    return null;
  };

  const effectiveStatus = (studentMembershipId: string): string => {
    const opt = getOptimisticStatus(studentMembershipId);
    if (opt !== null) return opt;
    const existing = initialData.attendanceMap[studentMembershipId];
    if (existing) return existing.status;
    return '';
  };

  const stats = {
    total: initialData.enrollments.length,
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    unmarked: 0,
  };

  initialData.enrollments.forEach((e) => {
    const s = effectiveStatus(e.studentMembershipId);
    if (!s) stats.unmarked++;
    else if (s === 'PRESENT') stats.present++;
    else if (s === 'LATE') stats.late++;
    else if (s === 'ABSENT') stats.absent++;
    else if (s === 'EXCUSED') stats.excused++;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          mark &bull; today &bull; {selectedClass?.name ?? 'Select Class'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative">
          <select
            value={selectedClassId ?? ''}
            onChange={(e) => handleClassChange(e.target.value)}
            className="appearance-none h-10 pl-4 pr-10 rounded-lg border border-border bg-card text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-cli-emerald/50"
            aria-label="Select class"
          >
            <option value="" disabled>
              Select Class
            </option>
            {initialData.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.sectionName ? `(${c.sectionName})` : ''} —{' '}
                {c.enrollmentCount} students
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
        </div>

        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 px-4 rounded-lg border border-border bg-card text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-cli-emerald/50"
            aria-label="Attendance date"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Present', count: stats.present, color: 'text-cli-emerald' },
          { label: 'Late', count: stats.late, color: 'text-muted-foreground' },
          { label: 'Absent', count: stats.absent, color: 'text-foreground' },
          { label: 'Excused', count: stats.excused, color: 'text-muted-foreground' },
          {
            label: 'Unmarked',
            count: stats.unmarked,
            color: 'text-muted-foreground',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground font-mono uppercase">
              {s.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {selectedClassId && stats.unmarked > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={() => handleBulk('PRESENT')}
            disabled={saving}
            aria-label="Mark all remaining as present"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Bulk Present ({stats.unmarked})
          </Button>
          <Button
            size="sm"
            className="bg-muted-foreground hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={() => handleBulk('LATE')}
            disabled={saving}
            aria-label="Mark all remaining as late"
          >
            Bulk Late
          </Button>
          <Button
            size="sm"
            className="bg-foreground hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={() => handleBulk('ABSENT')}
            disabled={saving}
            aria-label="Mark all remaining as absent"
          >
            Bulk Absent
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulk('EXCUSED')}
            disabled={saving}
            aria-label="Mark all remaining as excused"
          >
            Bulk Excused
          </Button>
        </div>
      )}

      <div
        className="rounded-xl border border-border bg-card overflow-hidden"
        role="grid"
        aria-label="Student attendance grid"
      >
        <div
          className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs font-mono text-muted-foreground uppercase"
          role="row"
        >
          <div className="col-span-1" role="columnheader">
            #
          </div>
          <div className="col-span-5" role="columnheader">
            Student
          </div>
          <div className="col-span-4" role="columnheader">
            Status
          </div>
          <div className="col-span-2 text-right" role="columnheader">
            Action
          </div>
        </div>

        {initialData.enrollments.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground font-mono">
            No students enrolled in this class.
          </div>
        ) : (
          initialData.enrollments.map((student, idx) => {
            const status = effectiveStatus(student.studentMembershipId);
            const optRec = optimisticRecords
              .filter((r) => r.membershipId === student.studentMembershipId)
              .pop();
            return (
              <div
                key={student.studentMembershipId}
                className={cn(
                  'grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-border last:border-0 transition-colors',
                  optRec?.pending ? 'opacity-60' : '',
                  status
                    ? 'bg-transparent'
                    : 'bg-muted/30'
                )}
                role="row"
              >
                <div
                  className="col-span-1 text-sm text-muted-foreground font-mono"
                  role="cell"
                >
                  {idx + 1}
                </div>
                <div
                  className="col-span-5 text-sm font-medium text-foreground truncate"
                  role="cell"
                >
                  {student.studentName}
                </div>
                <div className="col-span-4" role="cell">
                  {status ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border',
                        getStatusColor(status)
                      )}
                    >
                      {getStatusIcon(status)}
                      {status}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">
                      Unmarked
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-right" role="cell">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs font-mono focus-visible:ring-2 focus-visible:ring-cli-emerald"
                    onClick={() =>
                      handleStatusToggle(
                        student.studentMembershipId,
                        status || undefined
                      )
                    }
                    aria-label={`Toggle attendance for ${student.studentName}, currently ${status || 'unmarked'}`}
                  >
                    {status ? 'Change' : 'Mark'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
