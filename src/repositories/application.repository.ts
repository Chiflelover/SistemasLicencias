import { prisma } from "../lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { Application, ApplicationStatus } from "@prisma/client";

export class ApplicationRepository {
  static async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: {
        business: true,
        applicant: { select: { id: true, fullName: true, email: true, dni: true, phone: true, role: true } },
        documents: true,
        payments: true,
        inspections: { include: { inspector: { select: { id: true, fullName: true } } } },
        license: true,
      },
    });
  }

  static async findByApplicantId(applicantId: string) {
    return prisma.application.findFirst({
      where: { applicantId },
      orderBy: { createdAt: "desc" },
      include: {
        business: true,
        documents: true,
        payments: true,
        inspections: { orderBy: { createdAt: "asc" } },
        license: true,
      },
    });
  }

  static async findAllForInspector() {
    return prisma.application.findMany({
      where: {
        status: {
          in: [
            ApplicationStatus.INSPECTION_SCHEDULED,
            ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
          ],
        },
      },
      include: {
        business: true,
        applicant: { select: { id: true, fullName: true, email: true } },
        inspections: {
          where: { status: "SCHEDULED" },
          include: { inspector: { select: { id: true, fullName: true } } },
          orderBy: { scheduledAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  static async generateNumber(): Promise<string> {
    const count = await prisma.application.count();
    const year = (await getCurrentSystemDate()).getFullYear();
    return `MPT-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  static async create(data: {
    number: string;
    applicantId: string;
    businessId: string;
  }): Promise<Application> {
    return prisma.application.create({ data });
  }

  static async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    return prisma.application.update({ where: { id }, data: { status, updatedAt: await getCurrentSystemDate() } });
  }

  static async lockData(id: string): Promise<Application> {
    return prisma.application.update({ where: { id }, data: { dataLocked: true } });
  }

  static async searchPublic(query: string) {
    return prisma.application.findMany({
      where: {
        status: ApplicationStatus.LICENSE_ISSUED,
        business: {
          OR: [
            { ruc: { contains: query, mode: "insensitive" } },
            { legalName: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      include: {
        business: true,
        license: { select: { licenseNumber: true, status: true, issuedAt: true, expiresAt: true } },
      },
      take: 20,
    });
  }

  static async findAllActive() {
    return prisma.application.findMany({
      where: {
        status: { in: [ApplicationStatus.LICENSE_ISSUED, ApplicationStatus.RENEWAL_AVAILABLE] },
      },
      include: { license: true },
    });
  }
}
