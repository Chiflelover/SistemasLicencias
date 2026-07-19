import { prisma } from "../lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { License, LicenseStatus } from "@prisma/client";

export class LicenseRepository {
  static async create(data: {
    applicationId: string;
    licenseNumber: string;
    issuedAt: Date;
    expiresAt: Date;
    pdfContent: Buffer;
    pdfFileName: string;
  }): Promise<License> {
    return prisma.license.create({ data });
  }

  static async findById(id: string): Promise<License | null> {
    return prisma.license.findUnique({ where: { id } });
  }

  static async findByApplicationId(applicationId: string): Promise<License | null> {
    return prisma.license.findUnique({ where: { applicationId } });
  }

  static async generateNumber(): Promise<string> {
    const count = await prisma.license.count();
    const year = (await getCurrentSystemDate()).getFullYear();
    return `LIC-MPT-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  static async updateStatus(id: string, status: LicenseStatus): Promise<License> {
    return prisma.license.update({ where: { id }, data: { status, updatedAt: await getCurrentSystemDate() } });
  }

  static async renew(
    id: string,
    issuedAt: Date,
    newExpiresAt: Date,
    pdfContent: Buffer,
    pdfFileName: string
  ): Promise<License> {
    return prisma.license.update({
      where: { id },
      data: {
        issuedAt,
        expiresAt: newExpiresAt,
        status: "ACTIVE",
        pdfContent,
        pdfFileName,
        updatedAt: await getCurrentSystemDate(),
      },
    });
  }

  /**
   * Licencias vigentes para el listado del inspector.
   *
   * Se seleccionan campos explícitos: sin `select`, Prisma traía además el
   * `pdfContent` de cada licencia, que este listado nunca usa.
   */
  static async findAllActive() {
    return prisma.license.findMany({
      where: { status: { in: ["ACTIVE", "RENEWAL_AVAILABLE"] } },
      select: {
        id: true,
        applicationId: true,
        licenseNumber: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        application: {
          select: {
            id: true,
            number: true,
            business: { select: { legalName: true, ruc: true } },
          },
        },
      },
    });
  }
}
