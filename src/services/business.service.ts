import { BusinessRepository } from "@/repositories/business.repository";
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