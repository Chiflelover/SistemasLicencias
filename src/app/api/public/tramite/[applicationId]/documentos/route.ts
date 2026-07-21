import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  assertDocumentUploadAllowed,
  isUnderObservation,
  isUnderRenewal,
} from "@/lib/documents";
import { ApplicationStatus, DocumentType } from "@prisma/client";

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

    // La renovación se atiende solo en ventanilla, así que por la web no se
    // suben documentos aunque la política general lo permita en ese estado.
    if (isUnderRenewal(application.status)) {
      return NextResponse.json(
        {
          error:
            "Tu licencia venció. La renovación se hace en ventanilla: si cambió algo del local, lleva los documentos actualizados.",
        },
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

    // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────────────────
    // Esta línea decide cuándo el trámite pasa a PENDING_PAYMENT. Según lo que
    // pidan:
    //
    //   const documentsComplete = hasFloorPlan;              // solo el plano
    //   const documentsComplete = hasRucRecord;              // solo la ficha
    //   const documentsComplete = hasFloorPlan || hasRucRecord;  // cualquiera
    //   const documentsComplete = true;                      // ninguno
    //
    // Con esto alcanza para que el ciudadano avance, pero el pago se valida
    // aparte y hay que aflojarlo en los mismos términos, o el trámite queda en
    // PENDING_PAYMENT sin poder pagar:
    //
    //   src/app/api/public/tramite/[applicationId]/pago/manual/route.ts
    //   src/services/cash.service.ts                (cobro en ventanilla)
    //   src/app/cajero/pago/page.tsx                (habilita el botón)
    //   src/app/api/cajero/registro-presencial/route.ts (exige los 2 archivos)
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
      // En subsanación no corresponde invitar a pagar: el trámite ya pagó.
      message: enSubsanacion
        ? "Documento corregido subido. El inspector lo revisará en la segunda inspección; subsanar no tiene costo."
        : documentsComplete
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