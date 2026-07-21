import { NextResponse } from "next/server";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() || "";

    // La consulta pública es solo por RUC de 11 dígitos.
    if (!/^\d{11}$/.test(query)) {
      return NextResponse.json(
        { error: "Ingresa un RUC válido de 11 dígitos." },
        { status: 400 }
      );
    }

    // Sin tareas programadas, el vencimiento se procesa al consultar: así la
    // búsqueda pública nunca muestra como vigente una licencia ya vencida.
    await LicenseService.syncExpiredLicenses();

    const results = await ApplicationRepository.searchPublic(query);

    // "Subsanado" = ya se subieron los documentos corregidos. El endpoint de
    // subsanación los nombra con "(subsanado)"; se detecta por el nombre y no
    // por fecha, porque los documentos usan la hora real y las inspecciones la
    // simulada, y compararlas daría un resultado incorrecto en las demos.
    const conSubsanacion = results.map((app) => {
      const subsanado = app.documents.some((doc) =>
        /subsanad/i.test(doc.name)
      );

      // Los documentos no se exponen en la consulta pública.
      const { documents, ...resto } = app;
      void documents;

      return { ...resto, subsanado };
    });

    return NextResponse.json({
      success: true,
      results: conSubsanacion,
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