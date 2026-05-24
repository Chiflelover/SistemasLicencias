import { prisma } from "../lib/db/prisma";
import { Document, DocumentType } from "@prisma/client";

export class DocumentRepository {
  static async create(data: {
    applicationId: string;
    type: DocumentType;
    name: string;
    fileName: string;
    mimeType: string;
    size: number;
    content: Buffer;
    additionalDocumentName?: string;
  }): Promise<Document> {
    return prisma.document.create({ data });
  }

  static async findById(id: string): Promise<Document | null> {
    return prisma.document.findUnique({ where: { id } });
  }

  static async findByApplicationId(applicationId: string): Promise<Document[]> {
    return prisma.document.findMany({
      where: { applicationId },
      select: {
        id: true,
        applicationId: true,
        type: true,
        name: true,
        fileName: true,
        mimeType: true,
        size: true,
        content: false, // No cargar el binario en listas
        additionalDocumentName: true,
        createdAt: true,
      },
    }) as any;
  }

  static async findByIdWithContent(id: string): Promise<Document | null> {
    return prisma.document.findUnique({ where: { id } });
  }

  static async countByApplicationId(applicationId: string): Promise<number> {
    return prisma.document.count({ where: { applicationId } });
  }
}
