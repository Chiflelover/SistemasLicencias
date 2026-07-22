import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { InspectorService } from "@/services/inspector.service";
import { InspectorActionSchema } from "@/lib/validation/inspector";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parseResult = InspectorActionSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { action, observations, paymentInvalid, fineGravedad } = parseResult.data;

  try {
    const inspection = await InspectorService.getInspectionDetails(params.id);

    if (!inspection || inspection.inspectorId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updatedInspection = await InspectorService.reviewInspection(
      params.id,
      action,
      observations,
      paymentInvalid,
      fineGravedad
    );
    return NextResponse.json({ inspection: updatedInspection });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Error al procesar la inspección" },
      { status: 500 }
    );
  }
}
