import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";

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

    const data = await RucService.getBusinessData(ruc);

    return NextResponse.json(data, { status: 200 });
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