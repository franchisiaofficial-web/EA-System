import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { withRls } from "@/lib/prisma/rls-middleware";
import { TimetableClient } from "./TimetableClient";

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ sectionId?: string }> }) {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const { sectionId } = await searchParams;
  const rc = toRequestContext(authCtx);
  const section = sectionId
    ? await withRls(rc, (tx) => tx.section.findFirst({
        where: { id: sectionId, schoolId: authCtx.schoolId },
        select: { id: true, name: true, class: { select: { id: true, name: true } } },
      }))
    : null;
  const items = await withRls(rc, (tx) => tx.timetable.findMany({
    where: { schoolId: authCtx.schoolId, ...(section ? { sectionId: section.id } : {}) },
    include: { subject: { select: { name: true } }, class: { select: { name: true } }, section: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  }));
  const classes = await withRls(rc, (tx) => tx.class.findMany({ where: { schoolId: authCtx.schoolId }, select: { id: true, name: true, sections: { select: { name: true } } } }));
  return <TimetableClient items={items} classes={classes} section={section ? { id: section.id, name: section.name, className: section.class.name } : null} />;
}
