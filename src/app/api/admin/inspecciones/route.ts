import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { InspectionRepository } from "@/repositories/inspection.repository";
import { getCurrentSystemDate } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Todas las inspecciones, para el administrador.
 *
 * El inspector solo ve lo que tiene pendiente hoy, así que este es el único
 * lugar donde queda el historial: lo ya realizado, lo de hoy y lo que viene.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const estadoCrudo = searchParams.get("estado");
    const estado =
      estadoCrudo === "SCHEDULED" || estadoCrudo === "COMPLETED"
        ? estadoCrudo
        : undefined;

    const inspectorId = searchParams.get("inspector") || undefined;
    const desdeCrudo = searchParams.get("desde");
    const hastaCrudo = searchParams.get("hasta");

    const desde = desdeCrudo ? new Date(`${desdeCrudo}T00:00:00`) : undefined;
    const hasta = hastaCrudo ? new Date(`${hastaCrudo}T23:59:59.999`) : undefined;

    const [inspecciones, inspectores, ahora] = await Promise.all([
      InspectionRepository.findAllForAdmin({ estado, inspectorId, desde, hasta }),
      prisma.user.findMany({
        where: { role: "INSPECTOR" },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      getCurrentSystemDate(),
    ]);

    // El corte de "hoy" se calcula con la fecha del sistema, no la real: con el
    // simulador encendido, si no, pasado y futuro saldrían mal clasificados.
    const inicioDeHoy = new Date(ahora);
    inicioDeHoy.setHours(0, 0, 0, 0);

    const finDeHoy = new Date(ahora);
    finDeHoy.setHours(23, 59, 59, 999);

    const cuando = (fecha: Date) => {
      if (fecha < inicioDeHoy) return "PASADA";
      if (fecha > finDeHoy) return "FUTURA";
      return "HOY";
    };

    return NextResponse.json({
      hoy: ahora,
      inspectores,
      inspecciones: inspecciones.map((i) => ({
        id: i.id,
        numero: i.number,
        estado: i.status,
        resultado: i.result,
        observaciones: i.observations,
        scheduledAt: i.scheduledAt,
        resultAt: i.resultAt,
        cuando: cuando(i.scheduledAt),
        inspector: i.inspector.fullName,
        tramite: i.application.number,
        estadoTramite: i.application.status,
        ruc: i.application.business.ruc,
        negocio: i.application.business.legalName,
      })),
    });
  } catch (error: any) {
    console.error("Error listando inspecciones:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al listar las inspecciones." },
      { status: 500 }
    );
  }
}
