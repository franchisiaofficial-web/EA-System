import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import {
  listClasses,
  getEnrollments,
} from '@/services/academic/academic-service';
import { getAttendanceSummary } from '@/services/attendance/attendance-service';
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
    const enrollments = await getEnrollments(cls.id, ctx);
    for (const enr of enrollments) {
      const summary = await getAttendanceSummary(
        enr.studentMembershipId,
        monthStart,
        today,
        ctx
      );
      totalPresent += summary.present;
      totalLate += summary.late;
      totalAbsent += summary.absent;
      totalExcused += summary.excused;
    }
    if (enrollments.length > 0) {
      let cPresent = 0,
        cLate = 0,
        cAbsent = 0;
      for (const enr of enrollments) {
        const s = await getAttendanceSummary(
          enr.studentMembershipId,
          monthStart,
          today,
          ctx
        );
        cPresent += s.present;
        cLate += s.late;
        cAbsent += s.absent;
      }
      const denominator = cPresent + cLate + cAbsent;
      classSummaries.push({
        name: cls.name,
        percentage:
          denominator > 0
            ? Math.round(((cPresent + cLate) / denominator) * 100)
            : 0,
        total: enrollments.length,
      });
    }
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
        (sum, c) => sum + (c._count?.enrollments ?? 0),
        0
      )}
      classSummaries={classSummaries}
    />
  );
}
