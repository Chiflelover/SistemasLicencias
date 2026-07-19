import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { ApplicationService } from "@/services/application.service";

/**
 * Datos del RUC en SUNAT, más el trámite que ya exista para ese RUC.
 *
 * Así la pantalla puede avisar antes de que el ciudadano intente iniciar un
 * trámite duplicado.
 */
export async function GET(
  request: Request,
  { params }: { params: { ruc: string } }
) {
  try {
    const ruc = params.ruc?.trim();

    if (!ruc || !/^\d{11}$/.test(ruc)) {
      return NextResponse.json(
        { error: "El RUC debe tener 11 dígitos." },
        { status: 400 }
      );
    }

    const [data, tramiteExistente] = await Promise.all([
      RucService.getBusinessData(ruc),
      ApplicationService.findBlockingApplicationByRuc(ruc),
    ]);

    return NextResponse.json(
      { ...data, tramiteExistente },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error en /api/ruc/[ruc]:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "No se pudo consultar el RUC en APIPERU. Intenta nuevamente.",
      },
      { status: 400 }
    );
  }
}