import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getStudentAttendance } from "@/services/attendance/attendance-service";
import { StudentAttendanceClient } from "./StudentAttendanceClient";

export default async function StudentAttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");

  const rc = toRequestContext(authCtx);
  const stats = await getStudentAttendance(authCtx.membershipId, rc);

  const data = {
    totalDays: (stats as any)?.totalDays ?? 0,
    present: (stats as any)?.present ?? 0,
    absent: (stats as any)?.absent ?? 0,
    late: (stats as any)?.late ?? 0,
    excused: (stats as any)?.excused ?? 0,
    percentage: (stats as any)?.percentage ?? 0,
    records: ((stats as any)?.records ?? []).map((r: any) => ({
      date: r.date?.toISOString?.()?.slice(0, 10) ?? r.date ?? "",
      status: r.status ?? "UNKNOWN",
      notes: r.notes ?? null,
    })),
  };

  return <StudentAttendanceClient data={data} />;
}
