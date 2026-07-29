import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";

export async function GET(req: NextRequest) {
  const authCtx = await getAuthContext();
  if (!authCtx)
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });

  const mode = req.nextUrl.searchParams.get("mode") || "";
  if (mode === "500") throw new Error("Simulated 500 for testing");

  return NextResponse.json({ success: true, mode: "ok" });
}
