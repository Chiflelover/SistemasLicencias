import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { ruc: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión para consultar el RUC." },
        { status: 401 }
      );
    }

    const data = await RucService.getBusinessData(params.ruc);

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error en /api/ruc/[ruc]:", error);

    return NextResponse.json(
      {
        error:
          error.message ||
          "No se pudo consultar el RUC en APIPERU. Intenta nuevamente.",
      },
      { status: 400 }
    );
  }
}