import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "read");
    const rc = toRequestContext(authCtx);
    const type = req.nextUrl.searchParams.get("type") || "books";
    if (type === "borrowings") {
      return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.bookBorrowing.findMany({ where: { schoolId: authCtx.schoolId }, include: { book: { select: { title: true } }, student: { select: { firstName: true, lastName: true } } }, orderBy: { borrowedAt: "desc" }, take: 50 })) });
    }
    return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.book.findMany({ where: { schoolId: authCtx.schoolId }, orderBy: { title: "asc" } })) });
  } catch (e) { return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "create");
    const body = await req.json();
    const action = req.nextUrl.searchParams.get("action") || "book";
    const rc = toRequestContext(authCtx);
    if (action === "borrow") {
      return NextResponse.json({ success: true, data: await withRls(rc, async (tx) => {
        const book = await tx.book.findFirst({ where: { id: body.bookId, schoolId: authCtx.schoolId }, select: { id: true, available: true } });
        if (!book) throw new AuthorizationError("Book not found in this school");
        const student = await tx.student.findFirst({ where: { id: body.studentId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!student) throw new AuthorizationError("Student not found in this school");
        if (book.available < 1) throw new AuthorizationError("No copies available");
        const b = await tx.bookBorrowing.create({ data: { schoolId: authCtx.schoolId, bookId: body.bookId, studentId: body.studentId, dueDate: new Date(body.dueDate) } });
        await tx.book.update({ where: { id: body.bookId }, data: { available: { decrement: 1 } } });
        return b;
      }) }, { status: 201 });
    }
    if (action === "return") {
      return NextResponse.json({ success: true, data: await withRls(rc, async (tx) => {
        const borrowing = await tx.bookBorrowing.findFirst({ where: { id: body.borrowingId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!borrowing) throw new AuthorizationError("Borrowing not found in this school");
        const b = await tx.bookBorrowing.update({ where: { id: body.borrowingId }, data: { returnedAt: new Date(), status: "RETURNED" } });
        await tx.book.update({ where: { id: b.bookId }, data: { available: { increment: 1 } } });
        return b;
      }) });
    }
    return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.book.create({ data: { schoolId: authCtx.schoolId, title: body.title, author: body.author, isbn: body.isbn, category: body.category, quantity: body.quantity ?? 1, available: body.quantity ?? 1 } })) }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
