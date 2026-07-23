import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { ApplicationService } from "@/services/application.service";

/**
 * Datos del RUC en SUNAT, más los **locales tomados** de ese RUC.
 *
 * El bloqueo es por (RUC + local): un mismo RUC puede tener varias licencias,
 * una por local. La pantalla usa `localesTomados` para avisar, al elegir un
 * local, si ese ya tiene trámite —antes de enviar—. El bloqueo real lo hace el
 * servidor al iniciar el trámite.
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

    const [data, localesTomados] = await Promise.all([
      RucService.getBusinessData(ruc),
      ApplicationService.listBlockingByRuc(ruc),
    ]);

    return NextResponse.json(
      { ...data, localesTomados },
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