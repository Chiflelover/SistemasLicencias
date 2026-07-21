import { NextResponse } from "next/server";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { prisma } from "@/lib/db/prisma";

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
    // Motivo del cierre en firme. Se busca en la auditoría, que es donde ya
    // queda registrado el rechazo por pago inválido: así se distingue de un
    // rechazo por segunda observación sin agregar un campo al trámite.
    const idsDeInspeccion = results
      .filter((app) => app.status === "DEFINITIVELY_REJECTED")
      .flatMap((app) => app.inspections.map((i) => i.id));

    const rechazosPorPago = idsDeInspeccion.length
      ? await prisma.auditLog.findMany({
          where: {
            action: "TRAMITE_RECHAZADO_POR_PAGO_INVALIDO",
            entityId: { in: idsDeInspeccion },
          },
          select: { entityId: true },
        })
      : [];

    const conPagoInvalido = new Set(rechazosPorPago.map((r) => r.entityId));

    const conSubsanacion = results.map((app) => {
      const subsanado = app.documents.some((doc) =>
        /subsanad/i.test(doc.name)
      );

      const motivoRechazo =
        app.status === "DEFINITIVELY_REJECTED" &&
        app.inspections.some((i) => conPagoInvalido.has(i.id))
          ? "Pago incorrecto"
          : null;

      // Ni los documentos ni las inspecciones se exponen en la consulta.
      const { documents, inspections, ...resto } = app;
      void documents;
      void inspections;

      return { ...resto, subsanado, motivoRechazo };
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