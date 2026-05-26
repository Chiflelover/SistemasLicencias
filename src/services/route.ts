import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { ruc: string } }
) {
  try {
    // 1. Validar sesión
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ruc = params.ruc;

    // 2. Consultar servicio
    const data = await RucService.getBusinessData(ruc);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("RUC API Route Error:", error.message);
    
    return NextResponse.json(
      { error: error.message || "Error al consultar el RUC" },
      { status: error.message?.includes("11 dígitos") ? 400 : 500 }
    );
  }
}