import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import {
  requirePermission,
  AuthorizationError,
} from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 401 }
      );
    await requirePermission(authCtx, 'students', 'read');
    const rc = toRequestContext(authCtx);
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') || '';
    const batch = sp.get('batch') || undefined;

    const result = await withRls(rc, async (tx) => {
      if (batch) {
        // Single batch detail: list students
        const records = await tx.passedOutRecord.findMany({
          where: {
            schoolId: authCtx.schoolId,
            batch,
            ...(search
              ? {
                  student: {
                    OR: [
                      {
                        firstName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        lastName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        admissionNumber: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                }
              : {}),
          },
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                admissionNumber: true,
                gender: true,
                status: true,
              },
            },
            finalAcademicYear: { select: { name: true } },
            finalClass: { select: { name: true } },
            finalSection: { select: { name: true } },
          },
          orderBy: { student: { admissionNumber: 'asc' } },
        });
        return { batch, students: records };
      }

      // Batch grouping: aggregate by batch
      const records = await tx.passedOutRecord.findMany({
        where: { schoolId: authCtx.schoolId },
        select: { batch: true, id: true },
        orderBy: { passedOutDate: 'desc' },
      });

      const batchMap = new Map<
        string,
        {
          batch: string;
          count: number;
          completed: number;
          academicYearName: string;
        }
      >();
      for (const r of records) {
        const existing = batchMap.get(r.batch);
        if (existing) {
          existing.count++;
          existing.completed++;
        } else {
          // Fetch academic year name for this batch
          const sample = await tx.passedOutRecord.findFirst({
            where: { schoolId: authCtx.schoolId, batch: r.batch },
            include: { finalAcademicYear: { select: { name: true } } },
          });
          batchMap.set(r.batch, {
            batch: r.batch,
            count: 1,
            completed: 1,
            academicYearName: sample?.finalAcademicYear?.name || r.batch,
          });
        }
      }

      return { batches: Array.from(batchMap.values()) };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 403 }
      );
    console.error('GET /api/passed-out error:', e);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL' } },
      { status: 500 }
    );
  }
}
