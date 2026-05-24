import { prisma } from "../lib/db/prisma";
import { License, LicenseStatus } from "@prisma/client";

interface LicenseWithApplication extends License {
  application: {
    id: string;
    number: string;
    business: {
      legalName: string;
      ruc: string;
    };
  };
}

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
    const year = new Date().getFullYear();
    return `LIC-MPT-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  static async updateStatus(id: string, status: LicenseStatus): Promise<License> {
    return prisma.license.update({ where: { id }, data: { status, updatedAt: new Date() } });
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
        updatedAt: new Date(),
      },
    });
  }

  static async findAllActive(): Promise<LicenseWithApplication[]> {
    return prisma.license.findMany({
      where: { status: { in: ["ACTIVE", "RENEWAL_AVAILABLE"] } },
      include: {
        application: {
          include: {
            business: true,
          },
        },
      },
    });
  }
}
