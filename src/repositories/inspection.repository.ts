import { prisma } from "../lib/db/prisma";
import { Inspection, InspectionNumber, InspectionResult } from "@prisma/client";

export class InspectionRepository {
  static async create(data: {
    applicationId: string;
    inspectorId: string;
    number: InspectionNumber;
    scheduledAt: Date;
  }): Promise<Inspection> {
    return prisma.inspection.create({
      data: {
        applicationId: data.applicationId,
        inspectorId: data.inspectorId,
        number: data.number,
        scheduledAt: data.scheduledAt,
        status: "SCHEDULED",
      },
    });
  }

  static async findById(id: string) {
    return prisma.inspection.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            business: true,
            applicant: { select: { id: true, fullName: true, email: true, phone: true } },
            documents: { select: { id: true, type: true, name: true, fileName: true, mimeType: true, size: true, createdAt: true } },
            payments: true,
            license: true,
          },
        },
        inspector: { select: { id: true, fullName: true } },
      },
    });
  }

  static async findByInspectorId(inspectorId: string) {
    return prisma.inspection.findMany({
      where: { inspectorId, status: "SCHEDULED" },
      include: {
        application: { include: { business: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  static async findScheduledSlots(inspectorId: string): Promise<Date[]> {
    const scheduled = await prisma.inspection.findMany({
      where: { inspectorId, status: "SCHEDULED" },
      select: { scheduledAt: true },
    });
    return scheduled.map((s) => s.scheduledAt);
  }

  static async complete(
    id: string,
    result: InspectionResult,
    observations?: string
  ): Promise<Inspection> {
    return prisma.inspection.update({
      where: { id },
      data: {
        status: "COMPLETED",
        result,
        observations: observations ?? null,
        resultAt: new Date(),
      },
    });
  }

  static async findByApplicationId(applicationId: string) {
    return prisma.inspection.findMany({
      where: { applicationId },
      include: { inspector: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
