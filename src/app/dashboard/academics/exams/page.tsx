import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getExams } from "@/services/exam.service";
import { withRls } from "@/lib/prisma/rls-middleware";
import { ExamsClient } from "./ExamsClient";

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ sectionId?: string }> }) {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const { sectionId } = await searchParams;
  const rc = toRequestContext(authCtx);
  const section = sectionId
    ? await withRls(rc, (tx) => tx.section.findFirst({
        where: { id: sectionId, schoolId: authCtx.schoolId },
        select: { id: true, name: true, class: { select: { name: true } } },
      }))
    : null;
  const exams = await getExams(authCtx.schoolId, section ? { sectionId: section.id } : {}, rc);
  return <ExamsClient exams={exams} section={section ? { name: section.name, className: section.class.name } : null} />;
}
