import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationService } from "@/services/application.service";
import { BusinessSchema } from "@/lib/validation/business";
import { RucService } from "@/services/ruc.service";
import { belongsToDistrictTrujillo } from "@/lib/territory";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Debes iniciar sesión para registrar el trámite." },
        { status: 401 }
      );
    }

    if (user.role !== "APPLICANT") {
      return NextResponse.json(
        { error: "Acceso restringido. Solo los solicitantes pueden iniciar trámites." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const parsed = BusinessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos para el registro del negocio.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rucData = await RucService.getBusinessData(parsed.data.ruc);

    if (!belongsToDistrictTrujillo(rucData)) {
      return NextResponse.json(
        {
          error:
            "No se puede iniciar el trámite. Este sistema solo atiende establecimientos con domicilio fiscal en el distrito de Trujillo, provincia de Trujillo, departamento de La Libertad.",
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
      await ApplicationService.startNewApplication({
        applicantId: user.id,
        ruc: rucData.ruc,
        legalName: rucData.legalName,
        fiscalAddress: rucData.fiscalAddress,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Trámite iniciado correctamente.",
        application,
        business,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error al iniciar trámite:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Error interno al registrar el negocio e iniciar el trámite.",
      },
      { status: 400 }
    );
  }
}