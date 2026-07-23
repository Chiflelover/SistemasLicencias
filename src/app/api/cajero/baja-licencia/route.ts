import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { LicenseService } from "@/services/license.service";
import {
  CAJA_CERRADA_MENSAJE,
  CashSessionService,
} from "@/services/cash-session.service";
import { LicenseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Estados de licencia sobre los que se puede pedir la baja.
 *
 * Los tres en los que la licencia existe. Se incluye `EXPIRED` a propósito: si
 * no, el negocio que se mudó y además dejó vencer su licencia quedaría obligado
 * a renovarla —y pagarla— para un local donde ya no está, solo para poder darla
 * de baja después.
 */
const DABLES_DE_BAJA: LicenseStatus[] = [
  LicenseStatus.ACTIVE,
  LicenseStatus.RENEWAL_AVAILABLE,
  LicenseStatus.EXPIRED,
];

const SELECCION = {
  id: true,
  number: true,
  status: true,
  // El local de cada trámite: un RUC puede tener varias licencias, una por
  // local, y hay que distinguirlas para elegir cuál dar de baja.
  establishmentAddress: true,
  business: { select: { ruc: true, legalName: true, commercialAddress: true } },
  license: {
    select: {
      licenseNumber: true,
      issuedAt: true,
      expiresAt: true,
      status: true,
    },
  },
} as const;

/**
 * Lista por RUC las licencias que se pueden dar de baja.
 *
 * Devuelve **todas** las del RUC —un RUC puede tener varias, una por local—,
 * cada una con su local y si se puede dar de baja. El cajero elige cuál. Una ya
 * dada de baja se lista igual, marcada, para que se vea que ya está.
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
    // Solo los trámites con licencia emitida: es lo único que se da de baja.
    const conLicencia = await prisma.application.findMany({
      where: { business: { ruc }, license: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    // El vencimiento se procesa al consultar, igual que en la renovación: sin
    // esto una licencia cuya fecha ya pasó seguiría figurando vigente.
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
      puedeDarseDeBaja: Boolean(
        app.license && DABLES_DE_BAJA.includes(app.license.status)
      ),
    }));

    return NextResponse.json({ tramites });
  } catch (error: any) {
    console.error("Error consultando la baja de licencia:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al consultar el RUC." },
      { status: 500 }
    );
  }
}

/**
 * Da de baja la licencia. Gratis y en un solo paso.
 *
 * No mueve dinero —el cese no se cobra— pero sí exige caja abierta, con el
 * mismo criterio que el resto de la ventanilla: se atiende o no se atiende.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const turno = await CashSessionService.getOpenSession(user.id);

  if (!turno) {
    return NextResponse.json({ error: CAJA_CERRADA_MENSAJE }, { status: 409 });
  }

  try {
    const body = await request.json();
    const applicationId = String(body.applicationId || "").trim();
    const motivo = String(body.motivo || "");
    const dni = String(body.dni || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Falta indicar el trámite." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(dni)) {
      return NextResponse.json(
        { error: "Ingresa el DNI del representante legal (8 dígitos)." },
        { status: 400 }
      );
    }

    const resultado = await LicenseService.cancelLicense({
      applicationId,
      cashierId: user.id,
      motivo,
      dni,
    });

    return NextResponse.json({
      success: true,
      message:
        `Licencia ${resultado.licenseNumber} dada de baja. El RUC ${resultado.ruc} ` +
        "quedó libre para iniciar un trámite nuevo.",
      ...resultado,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo dar de baja la licencia." },
      { status: 400 }
    );
  }
}
