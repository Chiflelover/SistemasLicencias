import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { FineService } from "@/services/fine.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fines = await FineService.getFinesForInspector(user.id);
  return NextResponse.json({ fines });
}
