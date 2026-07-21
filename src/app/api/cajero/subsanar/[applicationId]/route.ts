import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isUnderObservation } from "@/lib/documents";
import { AuditService } from "@/services/audit.service";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── CAMBIAR EL TAMAÑO MÁXIMO DE ARCHIVO ─────────────────────────────────────
// Poner los MB que pidan en lugar del 5:
//
//   const MAX_FILE_SIZE = 3 * 1024 * 1024;
//
// OJO: el límite está repetido y hay que cambiarlo en los 5 archivos del
// servidor, en la validación del navegador y en los 3 textos que dicen "5MB"
// (incluido el mensaje de error de más abajo). Si se cambia solo acá, la
// pantalla sigue rechazando con el límite viejo y el usuario ve un error que
// no coincide con lo que acepta el servidor.
//
//   src/app/api/cajero/registro-presencial/route.ts
//   src/app/api/cajero/subsanar/[applicationId]/route.ts
//   src/app/api/public/tramite/[applicationId]/documentos/route.ts
//   src/app/api/public/tramite/[applicationId]/pago/manual/route.ts
//   src/app/api/public/tramite/[applicationId]/subsanar/route.ts
//   src/components/ManualPaymentForm.tsx                     (validación y texto)
//   src/components/PublicDocumentUploadForm.tsx              (texto)
//   src/app/cajero/registro-presencial/page.tsx              (texto)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/**
 * Subsanación de documentos hecha en ventanilla.
 *
 * Es el equivalente presencial de `/api/public/tramite/[id]/subsanar`, con dos
 * diferencias: la llave de acceso es la sesión del cajero y no el correo del
 * trámite —el contribuyente está presente en el mostrador—, y el cajero puede
 * atender cualquier trámite observado, incluso uno que entró por la web.
 *
 * No mueve plata: la subsanación es gratuita siempre. No se crea ningún
 * `Payment` ni se toca el estado, porque el trámite ya pagó y tiene su segunda
 * inspección agendada.
 */
export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

    if (!isUnderObservation(application.status)) {
      return NextResponse.json(
        { error: "Este trámite no está observado; no corresponde subsanar." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const plano = formData.get("plano");
    const fichaRuc = formData.get("fichaRuc");

    const archivos: Array<{ file: File; type: DocumentType; nombre: string }> = [];

    // El nombre lleva "subsanado" a propósito: la consulta pública y el panel
    // del inspector los distinguen de los originales con /subsanad/i, no por
    // fecha (los documentos usan hora real y las inspecciones la simulada).
    if (plano instanceof File && plano.size > 0) {
      archivos.push({
        file: plano,
        type: DocumentType.FLOOR_PLAN,
        nombre: "Plano (subsanado en ventanilla)",
      });
    }

    if (fichaRuc instanceof File && fichaRuc.size > 0) {
      archivos.push({
        file: fichaRuc,
        type: DocumentType.RUC_RECORD,
        nombre: "Ficha RUC (subsanada en ventanilla)",
      });
    }

    if (archivos.length === 0) {
      return NextResponse.json(
        { error: "Adjunta al menos un documento corregido." },
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
      const buffer = Buffer.from(await file.arrayBuffer());

      await prisma.document.create({
        data: {
          applicationId: application.id,
          type,
          name: nombre,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          content: buffer,
        },
      });
    }

    // Queda constancia de qué cajero subsanó el trámite de quién.
    await AuditService.log({
      action: "SUBSANACION_EN_VENTANILLA",
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
        "Documentos subsanados. El inspector los revisará en la segunda inspección. La subsanación no tiene costo.",
      subidos: archivos.length,
    });
  } catch (error: any) {
    console.error("Error en subsanación de ventanilla:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al subsanar." },
      { status: 500 }
    );
  }
}
