import { withRls, type RequestContext } from "@/lib/prisma/rls-middleware";

export async function getFeeCategories(schoolId: string, rc: RequestContext) {
  return withRls(rc, (tx) => tx.feeCategory.findMany({ where: { schoolId, isActive: true }, orderBy: { name: "asc" } }));
}

export async function createFeeCategory(schoolId: string, name: string, rc: RequestContext) {
  return withRls(rc, (tx) => tx.feeCategory.create({ data: { schoolId, name } }));
}

export async function getFeeStructures(schoolId: string, rc: RequestContext) {
  return withRls(rc, (tx) => tx.feeStructure.findMany({
    where: { schoolId, isActive: true },
    include: { category: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: { category: { name: "asc" } },
  }));
}

// Phase 1.5 tenant isolation: categoryId/classId are client-supplied; both must
// belong to the authenticated school before a structure row is created.
export async function createFeeStructure(schoolId: string, data: { categoryId: string; classId?: string; amount: number; frequency?: string }, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    const category = await tx.feeCategory.findFirst({ where: { id: data.categoryId, schoolId } });
    if (!category) throw new Error("Fee category not found");
    if (data.classId) {
      const cls = await tx.class.findFirst({ where: { id: data.classId, schoolId } });
      if (!cls) throw new Error("Class not found");
    }
    return tx.feeStructure.create({ data: { schoolId, ...data } });
  });
}

export async function getInvoices(schoolId: string, opts: { studentId?: string; status?: string; page?: number; pageSize?: number }, rc: RequestContext) {
  const page = opts.page ?? 1; const pageSize = opts.pageSize ?? 20;
  return withRls(rc, async (tx) => {
    const where: any = { schoolId };
    if (opts.studentId) where.studentId = opts.studentId;
    if (opts.status) where.status = opts.status;
    const [items, total] = await Promise.all([
      tx.feeInvoice.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, payments: { select: { amount: true, method: true, paidAt: true } } } }),
      tx.feeInvoice.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });
}

// Phase 1.5 tenant isolation: studentId is client-supplied; must belong to the
// authenticated school before an invoice is created.
export async function createInvoice(schoolId: string, data: { studentId: string; totalAmount: number; dueDate: string; month?: string; notes?: string }, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    const student = await tx.student.findFirst({ where: { id: data.studentId, schoolId } });
    if (!student) throw new Error("Student not found");
    const count = await tx.feeInvoice.count({ where: { schoolId } });
    const invoiceNo = `INV-${String(count + 1).padStart(5, "0")}`;
    return tx.feeInvoice.create({ data: { schoolId, invoiceNo, totalAmount: data.totalAmount, dueDate: new Date(data.dueDate), month: data.month, notes: data.notes, studentId: data.studentId } });
  });
}

// Phase 1.5 tenant isolation: invoiceId is client-supplied; it must belong to
// the authenticated school BEFORE the payment is created and the invoice
// updated — otherwise a foreign invoice's paidAmount/status is modified.
export async function recordPayment(schoolId: string, data: { invoiceId: string; amount: number; method?: string; reference?: string; receivedBy?: string; notes?: string }, rc: RequestContext) {
  return withRls(rc, async (tx) => {
    const invoice = await tx.feeInvoice.findFirst({ where: { id: data.invoiceId, schoolId } });
    if (!invoice) throw new Error("Invoice not found");
    const payment = await tx.feePayment.create({ data: { schoolId, invoiceId: data.invoiceId, amount: data.amount, method: (data.method as any) || "CASH", reference: data.reference, receivedBy: data.receivedBy, notes: data.notes } });
    const newPaid = invoice.paidAmount + data.amount;
    await tx.feeInvoice.update({ where: { id: data.invoiceId }, data: { paidAmount: newPaid, status: newPaid >= invoice.totalAmount ? "PAID" : "PARTIAL" } });
    return payment;
  });
}
