import { DocumentRepository } from "@/repositories/document.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { Document, DocumentType, ApplicationStatus } from "@prisma/client";

export class DocumentService {
  static async uploadDocument(data: {
    applicationId: string;
    type: DocumentType;
    name: string;
    fileName: string;
    mimeType: string;
    size: number;
    content: Buffer;
  }): Promise<Document> {
    const application = await ApplicationRepository.findById(data.applicationId);
    if (!application) {
      throw new Error("Trámite no encontrado para el documento.");
    }

    const createdDocument = await DocumentRepository.create({
      applicationId: data.applicationId,
      type: data.type,
      name: data.name,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: data.size,
      content: data.content,
    });

    if (application.status === ApplicationStatus.DRAFT || application.status === ApplicationStatus.DOCUMENTS_COMPLETE) {
      const uploadedTypes = new Set(application.documents.map((document: any) => document.type));
      uploadedTypes.add(data.type);

      if (uploadedTypes.has(DocumentType.FLOOR_PLAN) && uploadedTypes.has(DocumentType.RUC_RECORD)) {
        await ApplicationRepository.updateStatus(data.applicationId, ApplicationStatus.PENDING_PAYMENT);
      }
    }

    return createdDocument;
  }
}
