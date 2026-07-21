import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { LicenseService } from "@/services/license.service";
import { isUnderRenewal } from "@/lib/documents";

export const dynamic = "force-dynamic";

/**
 * Busca por RUC el trámite que corresponde renovar en ventanilla.
 *
 * La renovación se habilita recién cuando la licencia venció, así que la
 * respuesta dice explícitamente si toca renovar o todavía no, y por qué.
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
    const application = await prisma.application.findFirst({
      where: { business: { ruc } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        business: { select: { ruc: true, legalName: true } },
        documents: { select: { id: true, type: true, name: true } },
        license: {
          select: { licenseNumber: true, issuedAt: true, expiresAt: true, status: true },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ tramite: null });
    }

    // El vencimiento se procesa al consultar: sin esto, una licencia cuya
    // fecha ya pasó seguiría figurando vigente hasta que alguien la mire por
    // otro lado.
    await LicenseService.ensureRenewalState(application.id);

    const actualizado = await prisma.application.findUnique({
      where: { id: application.id },
      select: {
        id: true,
        number: true,
        status: true,
        business: { select: { ruc: true, legalName: true } },
        documents: { select: { id: true, type: true, name: true } },
        license: {
          select: { licenseNumber: true, issuedAt: true, expiresAt: true, status: true },
        },
      },
    });

    return NextResponse.json({
      tramite: actualizado,
      renovable: actualizado ? isUnderRenewal(actualizado.status) : false,
    });
  } catch (error: any) {
    console.error("Error consultando la renovación:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al consultar el RUC." },
      { status: 500 }
    );
  }
}
