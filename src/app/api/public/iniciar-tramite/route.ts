import { NextResponse } from "next/server";
import { ApplicationService } from "@/services/application.service";
import { RucService } from "@/services/ruc.service";
import { belongsToDistrictTrujillo } from "@/lib/territory";
import { checkRucEligibility } from "@/lib/ruc-eligibility";

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


    // El RUC debe estar activo ante SUNAT: uno dado de baja, suspendido o
    // inhabilitado no puede obtener licencia de funcionamiento.
    const elegibilidad = checkRucEligibility(rucData);

    if (!elegibilidad.elegible) {
      return NextResponse.json(
        {
          error: elegibilidad.motivo,
          estadoTributario: rucData.estado,
          condicion: rucData.condicion,
        },
        { status: 400 }
      );
    }

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

    // No se permite abrir un segundo trámite para el mismo RUC mientras haya
    // uno en curso o una licencia vigente. Se valida acá y no solo en la
    // pantalla, para que no dependa del navegador.
    const tramiteExistente =
      await ApplicationService.findBlockingApplicationByRuc(rucData.ruc);

    if (tramiteExistente) {
      return NextResponse.json(
        {
          error:
            tramiteExistente.motivo === "EN_PROCESO"
              ? `El RUC ${rucData.ruc} ya tiene el trámite ${tramiteExistente.number} en proceso. No podés iniciar otro hasta que finalice.`
              : `El RUC ${rucData.ruc} ya cuenta con una licencia vigente (trámite ${tramiteExistente.number}). No corresponde iniciar un trámite nuevo.`,
          tramiteExistente,
        },
        { status: 409 }
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