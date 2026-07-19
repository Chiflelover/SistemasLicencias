import { NextResponse } from "next/server";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";

    if (query.length < 3) {
      return NextResponse.json(
        { error: "Ingresa al menos 3 caracteres para buscar." },
        { status: 400 }
      );
    }

    // Sin tareas programadas, el vencimiento se procesa al consultar: así la
    // búsqueda pública nunca muestra como vigente una licencia ya vencida.
    await LicenseService.syncExpiredLicenses();

    const results = await ApplicationRepository.searchPublic(query);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("Error en consulta pública:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error interno en la consulta pública.",
      },
      { status: 500 }
    );
  }
}