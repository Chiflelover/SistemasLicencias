import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { InspectorService } from "@/services/inspector.service";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const inspection = await InspectorService.getInspectionDetails(params.id);

  if (!inspection || inspection.inspectorId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json({ inspection });
}
