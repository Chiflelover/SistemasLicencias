import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Trámites que puede cobrar este cajero.
 *
 * Dos grupos:
 *
 * 1. Los que tiene asignados —el alta se hace en /api/cajero/registro-presencial,
 *    que releva todos los datos y adjunta la documentación—.
 * 2. **Todas las licencias vencidas**, sin importar quién las tramitó: la
 *    renovación es de mostrador y el contribuyente llega a la ventanilla que
 *    esté libre. Una licencia que salió del flujo web no tiene cajero asociado,
 *    así que sin esto no la podría cobrar nadie. Ahí no hay nada que revisar:
 *    los datos y los documentos son los del trámite original.
 *
 * **El trámite iniciado por la web no entra acá a propósito.** Llega por
 * "Registrar solicitud presencial": el cajero consulta el RUC, ve lo que el
 * contribuyente declaró, lo revisa con él y recién ahí el trámite pasa a ser de
 * su caja y aparece en esta lista. Si se listara solo, se podría cobrar sin
 * haber mirado de quién es ni qué archivos trae, que es justo donde se cometen
 * los errores en una ventanilla.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const applications = await prisma.application.findMany({
    where: {
      OR: [
        { registeredById: user.id },
        { status: ApplicationStatus.EXPIRED },
      ],
    },
    include: {
      business: true,
      // El nombre lo usa la pantalla para marcar los que se reemplazaron, y el
      // orden importa: se muestra el último de cada tipo.
      documents: {
        select: { id: true, type: true, name: true },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        select: { id: true, amount: true, operationNumber: true, paidAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}
