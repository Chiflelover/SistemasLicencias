import { BusinessRepository } from "@/repositories/business.repository";
import { Business } from "@prisma/client";

export class BusinessService {
  static async registerBusiness(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    commercialAddress: string;
    activityType: string;
    representativeName: string;
  }): Promise<Business> {
    const existingBusiness = await BusinessRepository.findByRuc(data.ruc);
    if (existingBusiness) {
      throw new Error("Ya existe un negocio registrado con ese RUC.");
    }

    return BusinessRepository.create({
      legalName: data.legalName,
      ruc: data.ruc,
      fiscalAddress: data.fiscalAddress,
      commercialAddress: data.commercialAddress,
      activityType: data.activityType,
      representativeName: data.representativeName,
      representativeDni: "",
      representativeRole: "Representante Legal",
      representativePhone: "",
    });
  }
}
