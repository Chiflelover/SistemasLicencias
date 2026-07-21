import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Trámites que puede cobrar este cajero.
 *
 * Los que registró él —el alta se hace en /api/cajero/registro-presencial, que
 * releva todos los datos y adjunta la documentación— y **todas las licencias
 * vencidas**, sin importar quién las tramitó: la renovación es de mostrador y
 * el contribuyente llega a la ventanilla que esté libre. Una licencia que salió
 * del flujo web no tiene cajero asociado, así que sin esto no la podría cobrar
 * nadie.
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
      documents: { select: { id: true, type: true } },
      payments: {
        select: { id: true, amount: true, operationNumber: true, paidAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}
