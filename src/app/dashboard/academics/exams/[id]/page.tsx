import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getExamResults } from "@/services/exam.service";
import { ExamDetailClient } from "./ExamDetailClient";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const { id } = await params;
  const rc = toRequestContext(authCtx);
  const results = await getExamResults(id, rc);
  return <ExamDetailClient examId={id} results={results} />;
}
