import { prisma } from "../lib/db/prisma";
import { Fine, FineStatus } from "@prisma/client";

export class FineRepository {
  static async create(data: {
    licenseId: string;
    inspectorId: string;
    amount: number;
    description: string;
    observations?: string;
    issuedAt: Date;
  }): Promise<Fine> {
    return prisma.fine.create({ data });
  }

  static async findByInspectorId(inspectorId: string) {
    return prisma.fine.findMany({
      where: { inspectorId },
      include: {
        license: {
          include: {
            application: { include: { business: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
  }

  static async findByLicenseId(licenseId: string) {
    return prisma.fine.findMany({
      where: { licenseId },
      orderBy: { issuedAt: "desc" },
    });
  }

  static async updateStatus(id: string, status: FineStatus): Promise<Fine> {
    return prisma.fine.update({ where: { id }, data: { status } });
  }
}
