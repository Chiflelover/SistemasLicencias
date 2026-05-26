import { NextResponse } from "next/server";
import { DocumentService } from "@/services/document.service";
import { ApplicationRepository } from "@/repositories/application.repository";
import { DocumentUploadSchema } from "@/lib/validation/document";
import { DocumentType } from "@prisma/client";

const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type UploadedDocumentForCheck = {
  type: DocumentType | string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const rawApplicationId = formData.get("applicationId");
    const rawDocumentName = formData.get("documentName");
    const rawDocumentType = formData.get("documentType");
    const rawFile = formData.get("file");

    const parsed = DocumentUploadSchema.safeParse({
      applicationId: rawApplicationId,
      documentName: rawDocumentName,
      documentType: rawDocumentType,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos para la subida del documento.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (!(rawFile instanceof File)) {
      return NextResponse.json(
        { error: "No se envió un archivo válido." },
        { status: 400 }
      );
    }

    if (!ACCEPTED_MIME_TYPES.includes(rawFile.type)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF, JPG o PNG." },
        { status: 400 }
      );
    }

    if (rawFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no puede ser mayor a 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer());

    const createdDocument = await DocumentService.uploadDocument({
      applicationId: parsed.data.applicationId,
      type: parsed.data.documentType as DocumentType,
      name: parsed.data.documentName,
      fileName: rawFile.name,
      mimeType: rawFile.type,
      size: rawFile.size,
      content: buffer,
    });

    const application = await ApplicationRepository.findById(
      parsed.data.applicationId
    );

    const documents = (application?.documents ?? []) as UploadedDocumentForCheck[];

    const hasFloorPlan = documents.some(
      (document: UploadedDocumentForCheck) =>
        String(document.type) === DocumentType.FLOOR_PLAN
    );

    const hasRucRecord = documents.some(
      (document: UploadedDocumentForCheck) =>
        String(document.type) === DocumentType.RUC_RECORD
    );

    const { content, ...documentWithoutContent } = createdDocument as any;

    return NextResponse.json({
      success: true,
      document: documentWithoutContent,
      applicationStatus: application?.status ?? null,
      hasFloorPlan,
      hasRucRecord,
      message:
        hasFloorPlan && hasRucRecord
          ? "Documentos completos. El trámite ya está listo para pago."
          : "Documento subido correctamente. Aún faltan documentos.",
    });
  } catch (error: any) {
    console.error("Error al subir documento:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error interno al subir el documento.",
      },
      { status: 500 }
    );
  }
}