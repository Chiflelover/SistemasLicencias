import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isUnderObservation } from "@/lib/documents";
import { DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/**
 * Subsanación de documentos desde la consulta pública.
 *
 * A diferencia de la carga normal, exige el correo con el que se registró el
 * trámite: es la llave para que solo el titular reemplace los documentos de un
 * RUC observado. Y no cambia el estado —el trámite ya pagó y tiene su segunda
 * inspección agendada—, solo agrega los archivos corregidos.
 */
export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
      select: { id: true, status: true, contactEmail: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    // Solo se subsana un trámite observado.
    if (!isUnderObservation(application.status)) {
      return NextResponse.json(
        { error: "Este trámite no está observado; no corresponde subsanar." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const email = String(formData.get("email") || "").trim().toLowerCase();

    // La llave de seguridad: sin el correo registrado no se puede subir nada.
    if (!application.contactEmail) {
      return NextResponse.json(
        {
          error:
            "Este trámite no tiene un correo registrado. Acércate a la municipalidad para subsanar.",
        },
        { status: 403 }
      );
    }

    if (email !== application.contactEmail.trim().toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "El correo no coincide con el registrado en este trámite. No se puede subir la documentación.",
        },
        { status: 403 }
      );
    }

    const plano = formData.get("plano");
    const fichaRuc = formData.get("fichaRuc");

    const archivos: Array<{ file: File; type: DocumentType; nombre: string }> = [];

    if (plano instanceof File && plano.size > 0) {
      archivos.push({ file: plano, type: DocumentType.FLOOR_PLAN, nombre: "Plano (subsanado)" });
    }
    if (fichaRuc instanceof File && fichaRuc.size > 0) {
      archivos.push({ file: fichaRuc, type: DocumentType.RUC_RECORD, nombre: "Ficha RUC (subsanada)" });
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

    // El estado no se toca: la segunda inspección ya está agendada y el
    // inspector verá los documentos nuevos en su próxima visita.
    return NextResponse.json({
      success: true,
      message:
        "Documentos subsanados. El inspector los revisará en la próxima inspección.",
      subidos: archivos.length,
    });
  } catch (error: any) {
    console.error("Error en subsanación pública:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al subsanar." },
      { status: 500 }
    );
  }
}
