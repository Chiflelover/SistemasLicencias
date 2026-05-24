import { DocumentRepository } from "@/repositories/document.repository";
import { Document, DocumentType } from "@prisma/client";

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
    return DocumentRepository.create({
      applicationId: data.applicationId,
      type: data.type,
      name: data.name,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: data.size,
      content: data.content,
    });
  }
}
