import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/services/application.service";
import { RucService } from "@/services/ruc.service";

export const dynamic = "force-dynamic";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

function belongsToDistrictTrujillo(data: {
  distrito?: string;
  provincia?: string;
  departamento?: string;
}) {
  return (
    normalizeText(data.distrito || "") === "TRUJILLO" &&
    normalizeText(data.provincia || "") === "TRUJILLO" &&
    normalizeText(data.departamento || "") === "LA LIBERTAD"
  );
}

/** Lista únicamente los trámites que registró este cajero. */
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
      payments: { select: { id: true, amount: true, operationNumber: true, paidAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}

/** Registra una solicitud presencial atendida en ventanilla. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ruc = String(body.ruc || "").trim();

    if (!/^\d{11}$/.test(ruc)) {
      return NextResponse.json(
        { error: "El RUC debe tener 11 dígitos." },
        { status: 400 }
      );
    }

    const rucData = await RucService.getBusinessData(ruc);

    if (!belongsToDistrictTrujillo(rucData)) {
      return NextResponse.json(
        {
          error:
            "Solo se atienden establecimientos del distrito de Trujillo, provincia de Trujillo, La Libertad.",
          details: {
            distrito: rucData.distrito || "No registrado",
            provincia: rucData.provincia || "No registrado",
            departamento: rucData.departamento || "No registrado",
          },
        },
        { status: 400 }
      );
    }

    const { application, business } =
      await ApplicationService.startCashierApplication({
        cashierId: user.id,
        ruc: rucData.ruc,
        legalName: rucData.legalName,
        fiscalAddress: rucData.fiscalAddress,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Solicitud presencial registrada correctamente.",
        application,
        business,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error registrando solicitud presencial:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al registrar la solicitud." },
      { status: 400 }
    );
  }
}
