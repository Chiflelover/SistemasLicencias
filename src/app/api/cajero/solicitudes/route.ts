import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Lista únicamente los trámites que registró este cajero.
 *
 * El alta se hace en /api/cajero/registro-presencial, que releva todos los
 * datos del contribuyente y adjunta la documentación.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const applications = await prisma.application.findMany({
    where: { registeredById: user.id },
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
