import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { withRls } from '@/lib/prisma/rls-middleware';
import { TeacherAttendanceClient } from './TeacherAttendanceClient';

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
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

  const sp = await searchParams;
  const ctx = toRequestContext(authCtx);

  const pageData = await withRls(ctx, async (tx) => {
    const classes = await tx.class.findMany({
      where: { schoolId: authCtx.schoolId, isDeleted: false },
      include: { sections: { take: 1 } },
      orderBy: { name: 'asc' },
    });

    const counts = await tx.enrollment.groupBy({
      by: ['classId'],
      where: { schoolId: authCtx.schoolId, status: 'ACTIVE' },
      _count: { _all: true },
    });
    const countByClass = new Map(counts.map((c) => [c.classId, c._count._all]));

    const selectedClass =
      classes.find((c) => c.id === sp.classId) ?? classes[0] ?? null;

    const selectedDate =
      sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
        ? new Date(`${sp.date}T00:00:00`)
        : new Date();
    selectedDate.setHours(0, 0, 0, 0);

    let enrollments: Array<{
      id: string;
      studentMembershipId: string;
      studentMembership: { user: { name: string } };
    }> = [];
    let attendance: Array<{
      id: string;
      studentMembershipId: string;
      status: string;
    }> = [];

    if (selectedClass) {
      const rows = await tx.enrollment.findMany({
        where: { classId: selectedClass.id, status: 'ACTIVE' },
        select: {
          id: true,
          student: {
            select: {
              user: {
                select: {
                  name: true,
                  memberships: {
                    where: {
                      schoolId: authCtx.schoolId,
                      role: 'STUDENT',
                      status: 'ACTIVE',
                    },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      enrollments = rows.map((e) => ({
        id: e.id,
        studentMembershipId: e.student.user?.memberships?.[0]?.id ?? '',
        studentMembership: {
          user: { name: e.student.user?.name ?? 'Unknown' },
        },
      }));

      const records = await tx.attendanceRecord.findMany({
        where: { classId: selectedClass.id, date: selectedDate, isDeleted: false },
        select: { id: true, studentMembershipId: true, status: true },
        orderBy: { createdAt: 'asc' },
      });
      attendance = records;
    }

    return { classes, countByClass, selectedClass, selectedDate, enrollments, attendance };
  });

  const initialData = {
    classes: pageData.classes.map((c) => ({
      id: c.id,
      name: c.name,
      sectionName: c.sections?.[0]?.name ?? '',
      gradeLevel: c.gradeLevel ?? '',
      enrollmentCount: pageData.countByClass.get(c.id) ?? 0,
    })),
    enrollments: pageData.enrollments.map((e) => ({
      id: e.id,
      studentMembershipId: e.studentMembershipId,
      studentName: e.studentMembership?.user?.name ?? 'Unknown',
    })),
    attendanceMap: Object.fromEntries(
      pageData.attendance.map((a) => [
        a.studentMembershipId,
        { id: a.id, status: a.status },
      ])
    ),
  };

  return (
    <TeacherAttendanceClient
      schoolId={authCtx.schoolId}
      initialClassId={pageData.selectedClass?.id ?? null}
      initialDate={pageData.selectedDate.toISOString().split('T')[0]}
      initialData={initialData}
    />
  );
}
