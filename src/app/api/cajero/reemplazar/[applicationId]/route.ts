import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isAssemblingExpedient } from "@/lib/documents";
import { AuditService } from "@/services/audit.service";
import { DocumentService } from "@/services/document.service";
import {
  CAJA_CERRADA_MENSAJE,
  CashSessionService,
} from "@/services/cash-session.service";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── CAMBIAR EL TAMAÑO MÁXIMO DE ARCHIVO ─────────────────────────────────────
// Poner los MB que pidan en lugar del 5. La lista completa de archivos a tocar
// está en src/app/api/cajero/registro-presencial/route.ts.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/**
 * Reemplazo de un documento equivocado, hecho en la ventanilla.
 *
 * El caso: el ciudadano subió los archivos por la web, viene a pagar, el cajero
 * se los muestra en pantalla y resulta que subió el plano de otro local o una
 * ficha ilegible. Por la web podía volver a subirlos; en el mostrador no había
 * forma, y el cajero solo podía cobrar un expediente que ya sabía mal.
 *
 * **No es una subsanación** y por eso vive aparte de `/api/cajero/subsanar`:
 * aquella responde a una observación del inspector y marca los archivos con
 * "subsanado", que es lo que la consulta pública y el panel del inspector usan
 * para reconocerla. Un archivo reemplazado antes de pagar no fue observado por
 * nadie; llamarlo igual haría figurar como subsanado un trámite que nunca se
 * inspeccionó.
 *
 * Igual que en la web, **se agrega, no se pisa**: el archivo viejo queda para
 * que el inspector vea con qué se lo reemplazó.
 */
export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // La ventanilla está abierta o no lo está, aunque esto no cobre nada.
  const turno = await CashSessionService.getOpenSession(user.id);

  if (!turno) {
    return NextResponse.json({ error: CAJA_CERRADA_MENSAJE }, { status: 409 });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
      select: {
        id: true,
        number: true,
        status: true,
        business: { select: { ruc: true, legalName: true } },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    // Solo mientras el expediente se arma. Un trámite observado se corrige por
    // "Subsanar Documentos", que deja la marca que el inspector espera.
    if (!isAssemblingExpedient(application.status)) {
      return NextResponse.json(
        {
          error:
            "Este trámite ya no admite reemplazar documentos. Si fue observado, usa Subsanar Documentos.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const plano = formData.get("plano");
    const fichaRuc = formData.get("fichaRuc");

    const archivos: Array<{ file: File; type: DocumentType; nombre: string }> = [];

    // El nombre NO puede decir "subsanado": ver el comentario de arriba.
    if (plano instanceof File && plano.size > 0) {
      archivos.push({
        file: plano,
        type: DocumentType.FLOOR_PLAN,
        nombre: "Plano (reemplazado en ventanilla)",
      });
    }

    if (fichaRuc instanceof File && fichaRuc.size > 0) {
      archivos.push({
        file: fichaRuc,
        type: DocumentType.RUC_RECORD,
        nombre: "Ficha RUC (reemplazada en ventanilla)",
      });
    }

    if (archivos.length === 0) {
      return NextResponse.json(
        { error: "Adjunta al menos un documento para reemplazar." },
        { status: 400 }
      );
    }

    for (const { file } of archivos) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Cada archivo no debe superar los 5MB." },
          { status: 400 }
        );
      }

      if (!MIME_PERMITIDOS.includes(file.type)) {
        return NextResponse.json(
          { error: "Solo se permiten archivos PDF, JPG o PNG." },
          { status: 400 }
        );
      }
    }

    for (const { file, type, nombre } of archivos) {
      // Se pasa por el servicio y no por el repositorio: es el que vuelve a
      // validar el estado y el que promueve el trámite a PENDING_PAYMENT si
      // con esto quedan los dos documentos. Son dos archivos como mucho, así
      // que su findById de más no pesa.
      await DocumentService.uploadDocument({
        applicationId: application.id,
        type,
        name: nombre,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        content: Buffer.from(await file.arrayBuffer()),
      });
    }

    await AuditService.log({
      action: "DOCUMENTOS_REEMPLAZADOS_EN_VENTANILLA",
      entityType: "Application",
      entityId: application.id,
      userId: user.id,
      details: {
        applicationNumber: application.number,
        ruc: application.business.ruc,
        documentos: archivos.map((archivo) => archivo.nombre),
        estado: application.status,
        costo: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        archivos.length === 1
          ? "Documento reemplazado. El anterior queda archivado."
          : "Documentos reemplazados. Los anteriores quedan archivados.",
      subidos: archivos.length,
    });
  } catch (error: any) {
    console.error("Error reemplazando documentos en ventanilla:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al reemplazar los documentos." },
      { status: 500 }
    );
  }
}
