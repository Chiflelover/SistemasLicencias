import { NextResponse } from "next/server";
import { RucService } from "@/services/ruc.service";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { ruc: string } }
) {
  try {
    // Protección: Solo usuarios autenticados
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ruc = params.ruc;
    const data = await RucService.getBusinessData(ruc);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("RUC API Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Error al consultar el RUC" },
      { status: 400 }
    );
  }
}