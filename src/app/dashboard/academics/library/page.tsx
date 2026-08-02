import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { withRls } from "@/lib/prisma/rls-middleware";

export default async function LibraryPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const rc = toRequestContext(authCtx);
  const books = await withRls(rc, (tx) => tx.book.findMany({ where: { schoolId: authCtx.schoolId }, orderBy: { title: "asc" } }));
  const borrowings = await withRls(rc, (tx) => tx.bookBorrowing.findMany({ where: { schoolId: authCtx.schoolId }, include: { book: { select: { title: true } }, student: { select: { firstName: true, lastName: true } } }, orderBy: { borrowedAt: "desc" }, take: 30 }));

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto">
      <div><h1 className="text-xl font-bold text-foreground">Library</h1><p className="text-xs text-muted-foreground">Manage books and borrowing</p></div>
      <div className="rounded-xl border border-border bg-card p-5"><h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Books ({books.length})</h2>{books.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No books.</p> : <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Title</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Author</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">ISBN</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Available</th></tr></thead><tbody>{books.map((b: any) => (<tr key={b.id} className="border-b border-border/30"><td className="py-2 font-medium text-foreground">{b.title}</td><td className="py-2 text-muted-foreground">{b.author}</td><td className="py-2 text-muted-foreground text-xs font-mono">{b.isbn || "—"}</td><td className="py-2 font-mono">{b.available}/{b.quantity}</td></tr>))}</tbody></table>}</div>
      <div className="rounded-xl border border-border bg-card p-5"><h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Recent Borrowings</h2>{borrowings.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No borrowings.</p> : <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Book</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Student</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Borrowed</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Status</th></tr></thead><tbody>{borrowings.map((b: any) => (<tr key={b.id} className="border-b border-border/30"><td className="py-2 text-foreground">{b.book?.title}</td><td className="py-2 text-muted-foreground">{b.student?.firstName} {b.student?.lastName}</td><td className="py-2 text-xs text-muted-foreground">{new Date(b.borrowedAt).toLocaleDateString()}</td><td className="py-2"><span className={`px-2 py-0.5 rounded-md text-xs font-mono ${b.status === "RETURNED" ? "bg-cli-emerald/10 text-cli-emerald" : "bg-muted/60 text-muted-foreground"}`}>{b.status}</span></td></tr>))}</tbody></table>}</div>
    </div>
  );
}
