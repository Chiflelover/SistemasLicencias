import { NextResponse } from "next/server";
import { ApplicationService } from "@/services/application.service";
import { RucService } from "@/services/ruc.service";
import { belongsToDistrictTrujillo } from "@/lib/territory";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
      await ApplicationService.startPublicApplication({
        ruc: rucData.ruc,
        legalName: rucData.legalName,
        fiscalAddress: rucData.fiscalAddress,
      });

    return NextResponse.json(
      {
        success: true,
        message: "Trámite público iniciado correctamente.",
        application,
        business,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en trámite público:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Error interno al iniciar el trámite público.",
      },
      { status: 400 }
    );
  }
}