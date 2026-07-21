import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { assertDocumentUploadAllowed, isUnderObservation } from "@/lib/documents";
import { ApplicationStatus, DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isValidDocumentType(value: string): value is DocumentType {
  return (
    value === DocumentType.FLOOR_PLAN ||
    value === DocumentType.RUC_RECORD ||
    value === DocumentType.ADDITIONAL
  );
}

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
      include: { documents: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró el trámite." },
        { status: 404 }
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") || "").trim();
    const type = String(formData.get("type") || "").trim();
    const file = formData.get("file");

    if (!name) {
      return NextResponse.json(
        { error: "Ingresa el nombre del documento." },
        { status: 400 }
      );
    }

    if (!isValidDocumentType(type)) {
      return NextResponse.json(
        { error: "Tipo de documento inválido." },
        { status: 400 }
      );
    }

    // Misma política que el resto del sistema: la carga solo está abierta
    // mientras se arma el expediente o durante una subsanación.
    try {
      assertDocumentUploadAllowed(application.status, type);
    } catch (policyError: any) {
      return NextResponse.json(
        { error: policyError.message },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecciona un archivo." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "El archivo está vacío." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no debe superar los 5MB." },
        { status: 400 }
      );
    }

    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF, JPG o PNG." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const document = await prisma.document.create({
      data: {
        applicationId: application.id,
        type,
        name,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        content: buffer,
      },
    });

    const documents = await prisma.document.findMany({
      where: { applicationId: application.id },
      select: { type: true },
    });

    const hasFloorPlan = documents.some(
      (document) => document.type === DocumentType.FLOOR_PLAN
    );

    const hasRucRecord = documents.some(
      (document) => document.type === DocumentType.RUC_RECORD
    );

    const documentsComplete = hasFloorPlan && hasRucRecord;

    // En una subsanación el trámite ya pagó y tiene su segunda inspección
    // agendada: reemplazar un documento NO debe devolverlo a PENDING_PAYMENT
    // ni cobrar de nuevo. El paso a pago solo aplica al armado inicial.
    const enSubsanacion = isUnderObservation(application.status);

    const updatedApplication =
      documentsComplete && !enSubsanacion
        ? await prisma.application.update({
            where: { id: application.id },
            data: { status: ApplicationStatus.PENDING_PAYMENT },
          })
        : application;

    return NextResponse.json({
      success: true,
      document,
      application: updatedApplication,
      documentsComplete,
      message: documentsComplete
        ? "Documentos completos. Ya puedes continuar al pago."
        : "Documento subido correctamente. Aún faltan documentos.",
    });
  } catch (error: any) {
    console.error("Error subiendo documento público:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Error interno al subir el documento.",
      },
      { status: 500 }
    );
  }
}