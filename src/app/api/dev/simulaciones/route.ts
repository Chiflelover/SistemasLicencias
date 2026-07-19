import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SimulationService } from "@/services/simulation.service";

export const dynamic = "force-dynamic";

/** Historial de simulaciones y la corrida en curso, si la hay. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "DEVELOPER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [historial, enCurso] = await Promise.all([
    SimulationService.listHistory(),
    SimulationService.getRunningSimulation(),
  ]);

  return NextResponse.json({ historial, enCurso });
}
