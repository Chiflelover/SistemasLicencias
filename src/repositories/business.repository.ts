import { prisma } from "../lib/db/prisma";
import { Business } from "@prisma/client";

export class BusinessRepository {
  static async findById(id: string): Promise<Business | null> {
    return prisma.business.findUnique({ where: { id } });
  }

  static async findByRuc(ruc: string): Promise<Business | null> {
    return prisma.business.findUnique({ where: { ruc } });
  }

  static async create(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    commercialAddress: string;
    activityType: string;
    representativeName: string;
    representativeDni: string;
    representativeRole: string;
    representativePhone: string;
  }): Promise<Business> {
    return prisma.business.create({ data });
  }
}
