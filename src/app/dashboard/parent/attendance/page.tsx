import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { getLinkedStudents } from '@/services/parents/parent-service';
import {
  getStudentAttendance,
  getAttendanceSummary,
} from '@/services/attendance/attendance-service';
import { ParentAttendanceClient } from './ParentAttendanceClient';

export default async function ParentAttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (authCtx.role !== 'PARENT') redirect('/login');

  const ctx = toRequestContext(authCtx);
  const links = await getLinkedStudents(authCtx.membershipId, ctx);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const children = await Promise.all(
    links.map(async (link) => {
      const records = await getStudentAttendance(
        link.studentMembershipId,
        ctx,
        monthStart,
        today
      );
      const summary = await getAttendanceSummary(
        link.studentMembershipId,
        monthStart,
        today,
        ctx
      );
      return {
        membershipId: link.studentMembershipId,
        name: link.studentMembership?.user?.name ?? 'Unknown',
        records: records.map((r) => ({
          id: r.id,
          date: new Date(r.date).toISOString().split('T')[0],
          status: r.status,
          className: r.class?.name ?? '',
        })),
        summary: {
          percentage: summary.percentage,
          present: summary.present,
          late: summary.late,
          absent: summary.absent,
          excused: summary.excused,
          total: summary.total,
        },
      };
    })
  );

  return <ParentAttendanceClient linkedChildren={children} />;
}
