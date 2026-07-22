import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isUnderRenewal } from "@/lib/documents";
import { AuditService } from "@/services/audit.service";
import {
  CAJA_CERRADA_MENSAJE,
  CashSessionService,
} from "@/services/cash-session.service";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── CAMBIAR EL TAMAÑO MÁXIMO DE ARCHIVO ─────────────────────────────────────
// Poner los MB que pidan en lugar del 5. Está repetido en las demás rutas del
// servidor y en los textos de pantalla; la lista completa está en
// src/app/api/cajero/registro-presencial/route.ts.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/**
 * Documentos actualizados de una renovación.
 *
 * **Son opcionales**: si el local no cambió, los del trámite original siguen
 * sirviendo y el cajero pasa directo al cobro. Esta ruta existe para el caso
 * contrario, cuando algo cambió y hay que dejar la versión nueva.
 *
 * No toca el estado del trámite ni cobra nada: la licencia vencida se queda
 * vencida hasta que se paga la renovación.
 */
export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // La renovación termina en un cobro por esta misma ventanilla: sin caja
  // abierta no tiene sentido empezar a cargar los documentos actualizados.
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
        business: { select: { ruc: true } },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    if (!isUnderRenewal(application.status)) {
      return NextResponse.json(
        {
          error:
            "Este trámite no está en renovación: la licencia todavía no venció.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const plano = formData.get("plano");
    const fichaRuc = formData.get("fichaRuc");

    const archivos: Array<{ file: File; type: DocumentType; nombre: string }> = [];

    // El nombre lleva "renovación" para distinguirlos de los del trámite
    // original: el inspector de la inopinada tiene que saber cuál es el plano
    // vigente.
    if (plano instanceof File && plano.size > 0) {
      archivos.push({
        file: plano,
        type: DocumentType.FLOOR_PLAN,
        nombre: "Plano (actualizado en la renovación)",
      });
    }

    if (fichaRuc instanceof File && fichaRuc.size > 0) {
      archivos.push({
        file: fichaRuc,
        type: DocumentType.RUC_RECORD,
        nombre: "Ficha RUC (actualizada en la renovación)",
      });
    }

    if (archivos.length === 0) {
      return NextResponse.json(
        {
          error:
            "No adjuntaste ningún documento. Si no cambió nada, pasa directo al cobro.",
        },
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

    await AuditService.log({
      action: "RENOVACION_DOCUMENTOS_ACTUALIZADOS",
      entityType: "Application",
      entityId: application.id,
      userId: user.id,
      details: {
        applicationNumber: application.number,
        ruc: application.business.ruc,
        documentos: archivos.map((archivo) => archivo.nombre),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se registraron ${archivos.length} documento(s) actualizado(s). Ya puedes cobrar la renovación.`,
      subidos: archivos.length,
    });
  } catch (error: any) {
    console.error("Error subiendo documentos de renovación:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al subir los documentos." },
      { status: 500 }
    );
  }
}
