import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { InspectorService } from "@/services/inspector.service";

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const inspections = await InspectorService.getAssignedInspections(user.id);

  return NextResponse.json({ inspections });
}
