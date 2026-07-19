import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { InspectorService } from "@/services/inspector.service";

export const dynamic = "force-dynamic";

/**
 * Agenda del día del inspector.
 *
 * Devuelve solo las inspecciones de la fecha actual del sistema: las
 * pendientes (ordenadas por hora) y las ya resueltas hoy. No incluye
 * inspecciones futuras ni de días anteriores.
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
    completed: agenda.completed,
    pendingCount: agenda.pendingCount,
    completedCount: agenda.completedCount,
  });
}
