import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { InspectorService } from "@/services/inspector.service";

export const dynamic = "force-dynamic";

/**
 * Agenda del día del inspector.
 *
 * Devuelve solo las inspecciones pendientes de la fecha actual del sistema,
 * ordenadas por hora. No incluye las ya resueltas —que salen de su vista al
 * terminarlas— ni las de otros días.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const agenda = await InspectorService.getTodayAgenda(user.id);

  return NextResponse.json({
    date: agenda.date,
    inspections: agenda.pending,
    pendingCount: agenda.pendingCount,
  });
}
