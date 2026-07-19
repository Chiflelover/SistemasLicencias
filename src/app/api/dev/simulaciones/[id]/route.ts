import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SimulationService } from "@/services/simulation.service";

export const dynamic = "force-dynamic";

/** Detalle de los cambios anotados en una corrida. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "DEVELOPER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const detalle = await SimulationService.getRunChanges(params.id);

  if (!detalle) {
    return NextResponse.json(
      { error: "No se encontró la simulación." },
      { status: 404 }
    );
  }

  return NextResponse.json(detalle);
}
