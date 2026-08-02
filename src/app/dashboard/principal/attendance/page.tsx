import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { listClasses } from '@/services/academic/academic-service';
import { withRls } from '@/lib/prisma/rls-middleware';
import { PrincipalAttendanceClient } from './PrincipalAttendanceClient';

export default async function PrincipalAttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');

  const allowed = [
    'PRINCIPAL',
    'VICE_PRINCIPAL',
    'SCHOOL_ADMIN',
    'SUPER_ADMIN',
  ];
  if (!allowed.includes(authCtx.role)) redirect('/login');

  const ctx = toRequestContext(authCtx);
  const classes = await listClasses(authCtx.schoolId, ctx);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Batch month summary in constant query count (previously one round trip per
  // student — 1440+ queries on a remote DB).
  const { classMids, monthCounts } = await withRls(ctx, async (tx) => {
    const enrollments = await tx.enrollment.findMany({
      where: { schoolId: authCtx.schoolId, status: 'ACTIVE' },
      select: {
        classId: true,
        student: {
          select: {
            user: {
              select: {
                memberships: {
                  where: { schoolId: authCtx.schoolId, role: 'STUDENT', status: 'ACTIVE' },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    const classMids = new Map<string, string[]>();
    for (const e of enrollments) {
      const mid = e.student.user?.memberships?.[0]?.id;
      if (mid) {
        const arr = classMids.get(e.classId);
        if (arr) arr.push(mid);
        else classMids.set(e.classId, [mid]);
      }
    }

    const records = await tx.attendanceRecord.findMany({
      where: {
        schoolId: authCtx.schoolId,
        date: { gte: monthStart, lte: today },
        isDeleted: false,
      },
      select: { studentMembershipId: true, status: true },
    });
    const monthCounts = new Map<
      string,
      { present: number; late: number; absent: number; excused: number }
    >();
    for (const r of records) {
      const c = monthCounts.get(r.studentMembershipId) ?? {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
      if (r.status === 'PRESENT') c.present++;
      else if (r.status === 'LATE') c.late++;
      else if (r.status === 'ABSENT') c.absent++;
      else if (r.status === 'EXCUSED') c.excused++;
      monthCounts.set(r.studentMembershipId, c);
    }

    return { classMids, monthCounts };
  });

  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalExcused = 0;

  const classSummaries: Array<{
    name: string;
    percentage: number;
    total: number;
  }> = [];

  for (const cls of classes) {
    const mids = classMids.get(cls.id) ?? [];
    if (mids.length === 0) continue;
    let cPresent = 0,
      cLate = 0,
      cAbsent = 0,
      cExcused = 0;
    for (const mid of mids) {
      const c = monthCounts.get(mid) ?? {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
      cPresent += c.present;
      cLate += c.late;
      cAbsent += c.absent;
      cExcused += c.excused;
    }
    totalPresent += cPresent;
    totalLate += cLate;
    totalAbsent += cAbsent;
    totalExcused += cExcused;
    const denominator = cPresent + cLate + cAbsent;
    classSummaries.push({
      name: cls.name,
      percentage:
        denominator > 0
          ? Math.round(((cPresent + cLate) / denominator) * 100)
          : 0,
      total: mids.length,
    });
  }

  const numerator = totalPresent + totalLate;
  const denominator = totalPresent + totalLate + totalAbsent;
  const schoolPercentage =
    denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

  return (
    <PrincipalAttendanceClient
      schoolPercentage={schoolPercentage}
      todayPresent={totalPresent}
      todayAbsent={totalAbsent}
      todayLate={totalLate}
      todayExcused={totalExcused}
      totalStudents={classes.reduce(
        (sum, c) => sum + (c._count?.enrollmentRecords ?? 0),
        0
      )}
      classSummaries={classSummaries}
    />
  );
}
