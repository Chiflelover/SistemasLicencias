import { BusinessRepository } from "@/repositories/business.repository";
import { prisma } from "@/lib/db/prisma";
import { Business } from "@prisma/client";

export class BusinessService {
  static async registerBusiness(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<Business> {
    const existingBusiness = await BusinessRepository.findByRuc(data.ruc);

    if (existingBusiness) {
      throw new Error("Ya existe un negocio registrado con ese RUC.");
    }

    return BusinessRepository.create({
      legalName: data.legalName,
      ruc: data.ruc,
      fiscalAddress: data.fiscalAddress,
      commercialAddress: data.fiscalAddress,
      activityType: "No registrado",
      representativeName: "No registrado",
      representativeDni: "",
      representativeRole: "Representante Legal",
      representativePhone: "",
    });
  }

  /**
   * Alta o actualización del negocio con los datos completos que releva el
   * cajero en ventanilla, incluido el representante legal.
   */
  static async upsertBusinessDetails(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    commercialAddress?: string;
    activityType?: string;
    representativeName?: string;
    representativeDni?: string;
    representativeRole?: string;
    representativePhone?: string;
  }): Promise<Business> {
    const details = {
      legalName: data.legalName,
      fiscalAddress: data.fiscalAddress,
      commercialAddress: data.commercialAddress || data.fiscalAddress,
      activityType: data.activityType || "No registrado",
      representativeName: data.representativeName || "No registrado",
      representativeDni: data.representativeDni || "",
      representativeRole: data.representativeRole || "Representante Legal",
      representativePhone: data.representativePhone || "",
    };

    return prisma.business.upsert({
      where: { ruc: data.ruc },
      update: details,
      create: { ruc: data.ruc, ...details },
    });
  }

  static async findOrCreateBusiness(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<Business> {
    const existingBusiness = await BusinessRepository.findByRuc(data.ruc);

    if (existingBusiness) {
      return existingBusiness;
    }

    return BusinessRepository.create({
      legalName: data.legalName,
      ruc: data.ruc,
      fiscalAddress: data.fiscalAddress,
      commercialAddress: data.fiscalAddress,
      activityType: "No registrado",
      representativeName: "No registrado",
      representativeDni: "",
      representativeRole: "Representante Legal",
      representativePhone: "",
    });
  }
}