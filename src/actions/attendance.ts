'use server';

import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission } from '@/lib/permissions/guards';
import {
  markAttendance,
  bulkMarkAttendance,
  updateAttendanceRecord,
  getClassAttendance,
  getStudentAttendance,
  getAttendanceSummary,
} from '@/services/attendance/attendance-service';
import { revalidatePath } from 'next/cache';
import type { AttendanceStatus } from '@/generated/prisma/client';

async function getCtx() {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Not authenticated');
  return ctx;
}

export async function markAttendanceAction(data: {
  schoolId: string;
  classId: string;
  studentMembershipId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
}) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'create');
  const ctx = toRequestContext(authCtx);
  const result = await markAttendance(data, authCtx, ctx);
  revalidatePath('/dashboard/teacher/attendance');
  return result;
}

export async function bulkMarkAttendanceAction(data: {
  schoolId: string;
  classId: string;
  date: Date;
  records: Array<{
    studentMembershipId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
}) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'create');
  const ctx = toRequestContext(authCtx);
  await bulkMarkAttendance(data, authCtx, ctx);
  revalidatePath('/dashboard/teacher/attendance');
}

export async function updateAttendanceAction(data: {
  recordId: string;
  status: AttendanceStatus;
  notes?: string;
}) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'update');
  const ctx = toRequestContext(authCtx);
  const result = await updateAttendanceRecord(
    data.recordId,
    { status: data.status, notes: data.notes },
    authCtx,
    ctx
  );
  revalidatePath('/dashboard/teacher/attendance');
  return result;
}

export async function getTeacherClassAttendance(classId: string, date: Date) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'read');
  const ctx = toRequestContext(authCtx);
  return getClassAttendance(classId, date, ctx);
}

export async function getStudentOwnAttendance(fromDate?: Date, toDate?: Date) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'read');
  const ctx = toRequestContext(authCtx);
  return getStudentAttendance(authCtx.membershipId, ctx, fromDate, toDate);
}

export async function getStudentSummary(fromDate: Date, toDate: Date) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'read');
  const ctx = toRequestContext(authCtx);
  return getAttendanceSummary(authCtx.membershipId, fromDate, toDate, ctx);
}
