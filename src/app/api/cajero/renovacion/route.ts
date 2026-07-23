import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { LicenseService } from "@/services/license.service";
import { isUnderRenewal } from "@/lib/documents";

export const dynamic = "force-dynamic";

const SELECCION = {
  id: true,
  number: true,
  status: true,
  // El local de cada trámite: un RUC puede tener varias licencias, una por
  // local, y hay que distinguirlas para elegir cuál renovar.
  establishmentAddress: true,
  business: { select: { ruc: true, legalName: true } },
  documents: { select: { id: true, type: true, name: true } },
  license: {
    select: { licenseNumber: true, issuedAt: true, expiresAt: true, status: true },
  },
} as const;

/**
 * Lista por RUC las licencias del negocio, para renovar en ventanilla.
 *
 * Un RUC puede tener varias, una por local. Se devuelven todas con su local y
 * si son renovables (`renovable`): la renovación se habilita recién cuando la
 * licencia venció, así que una vigente o por vencer se lista pero no se renueva
 * todavía. El cajero elige cuál.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ruc = (new URL(request.url).searchParams.get("ruc") || "").trim();

  if (!/^\d{11}$/.test(ruc)) {
    return NextResponse.json(
      { error: "El RUC debe tener 11 dígitos." },
      { status: 400 }
    );
  }

  try {
    const conLicencia = await prisma.application.findMany({
      where: { business: { ruc }, license: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    // El vencimiento se procesa al consultar: sin esto, una licencia cuya
    // fecha ya pasó seguiría figurando vigente hasta que alguien la mire por
    // otro lado.
    for (const app of conLicencia) {
      await LicenseService.ensureRenewalState(app.id);
    }

    const actualizadas = await prisma.application.findMany({
      where: { business: { ruc }, license: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: SELECCION,
    });

    const tramites = actualizadas.map((app) => ({
      ...app,
      renovable: isUnderRenewal(app.status),
    }));

    return NextResponse.json({ tramites });
  } catch (error: any) {
    console.error("Error consultando la renovación:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al consultar el RUC." },
      { status: 500 }
    );
  }
}
