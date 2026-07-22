import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { LicenseRepository } from "@/repositories/license.repository";
import { FineService } from "@/services/fine.service";
import { FineRegistrationSchema } from "@/lib/validation/fine";
import { GRAVEDADES, montoDeMulta } from "@/lib/uit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const licenses = await LicenseRepository.findAllActive();
  const payload = licenses.map((license) => ({
    id: license.id,
    licenseNumber: license.licenseNumber,
    status: license.status,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
    application: {
      id: license.applicationId,
      number: license.application.number,
      business: {
        legalName: license.application.business.legalName,
        ruc: license.application.business.ruc,
      },
    },
  }));

  return NextResponse.json({ licenses: payload });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parseResult = FineRegistrationSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { licenseId, gravedad, description, observations } = parseResult.data;

  try {
    // El monto sale de la UIT vigente; la pantalla solo lo muestra. Se guarda
    // en soles, así que una multa vieja conserva su importe si la UIT sube.
    const monto = await montoDeMulta(gravedad);
    const escala = GRAVEDADES.find((g) => g.clave === gravedad);

    const fine = await FineService.createFine(
      user.id,
      licenseId,
      monto,
      `${description} · ${escala?.nombre} (${escala?.porcentaje}% UIT)`,
      observations
    );
    return NextResponse.json({ fine });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
