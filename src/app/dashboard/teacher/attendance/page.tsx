import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import {
  listClasses,
  getEnrollments,
} from '@/services/academic/academic-service';
import { getClassAttendance } from '@/services/attendance/attendance-service';
import { TeacherAttendanceClient } from './TeacherAttendanceClient';

export default async function TeacherAttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');

  const allowed = [
    'TEACHER',
    'CLASS_TEACHER',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'VICE_PRINCIPAL',
    'SUPER_ADMIN',
  ];
  if (!allowed.includes(authCtx.role)) redirect('/login');

  const ctx = toRequestContext(authCtx);
  const classes = await listClasses(authCtx.schoolId, ctx);

  const initialClassId = classes[0]?.id ?? null;
  let initialEnrollments: Awaited<ReturnType<typeof getEnrollments>> = [];
  let initialAttendance: Awaited<ReturnType<typeof getClassAttendance>> = [];

  if (initialClassId) {
    initialEnrollments = await getEnrollments(initialClassId, ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    initialAttendance = await getClassAttendance(initialClassId, today, ctx);
  }

  const initialData = {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      sectionName: c.section?.name ?? '',
      gradeLevel: c.gradeLevel ?? '',
      enrollmentCount: c._count?.enrollments ?? 0,
    })),
    enrollments: initialEnrollments.map((e) => ({
      id: e.id,
      studentMembershipId: e.studentMembershipId,
      studentName: e.studentMembership?.user?.name ?? 'Unknown',
    })),
    attendanceMap: Object.fromEntries(
      initialAttendance.map((a) => [
        a.studentMembershipId,
        { id: a.id, status: a.status },
      ])
    ),
  };

  return (
    <TeacherAttendanceClient
      schoolId={authCtx.schoolId}
      initialClassId={initialClassId}
      initialData={initialData}
    />
  );
}
