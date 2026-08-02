import { withRls, type RequestContext } from "@/lib/prisma/rls-middleware";

export async function getExams(schoolId: string, opts: { classId?: string; sectionId?: string; status?: string }, rc: RequestContext) {
  return withRls(rc, (tx) => tx.exam.findMany({
    where: { schoolId, ...(opts.classId ? { classId: opts.classId } : {}), ...(opts.sectionId ? { sectionId: opts.sectionId } : {}), ...(opts.status ? { status: opts.status } : {}) },
    include: { subject: { select: { name: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: { examDate: "asc" },
  }));
}

// Phase 1.5 tenant isolation: examId/studentId are client-supplied identifiers.
// They MUST be validated against the authenticated school before any query runs.
async function assertExamInSchool(tx: { exam: { findFirst: (args: any) => Promise<unknown> } }, examId: string, schoolId: string | undefined) {
  const exam = await tx.exam.findFirst({ where: { id: examId, schoolId } });
  if (!exam) throw new Error("Exam not found");
}

async function assertStudentInSchool(tx: { student: { findFirst: (args: any) => Promise<unknown> } }, studentId: string, schoolId: string | undefined) {
  const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw new Error("Student not found");
}

export async function getExamResults(examId: string, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    await assertExamInSchool(tx, examId, rc.schoolId);
    return tx.examResult.findMany({
      where: { examId },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { student: { firstName: "asc" } },
    });
  });
}

export async function getStudentResults(studentId: string, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    await assertStudentInSchool(tx, studentId, rc.schoolId);
    return tx.examResult.findMany({
      where: { studentId },
      include: { exam: { include: { subject: { select: { name: true } } } } },
      orderBy: { exam: { examDate: "desc" } },
    });
  });
}

export async function upsertResult(schoolId: string, data: { examId: string; studentId: string; marksObtained: number; grade?: string; remarks?: string }, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    await assertExamInSchool(tx, data.examId, schoolId);
    await assertStudentInSchool(tx, data.studentId, schoolId);
    return tx.examResult.upsert({
      where: { examId_studentId: { examId: data.examId, studentId: data.studentId } },
      create: { schoolId, ...data },
      update: { marksObtained: data.marksObtained, grade: data.grade, remarks: data.remarks },
    });
  });
}

export async function bulkUpsertResults(schoolId: string, examId: string, results: { studentId: string; marksObtained: number; grade?: string; remarks?: string }[], rc: RequestContext) {
  return withRls(rc, async (tx) => {
    await assertExamInSchool(tx, examId, schoolId);
    for (const r of results) {
      await assertStudentInSchool(tx, r.studentId, schoolId);
      await tx.examResult.upsert({
        where: { examId_studentId: { examId, studentId: r.studentId } },
        create: { schoolId, examId, studentId: r.studentId, marksObtained: r.marksObtained, grade: r.grade, remarks: r.remarks },
        update: { marksObtained: r.marksObtained, grade: r.grade, remarks: r.remarks },
      });
    }
    return { count: results.length };
  });
}
