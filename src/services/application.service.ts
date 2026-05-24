import { ApplicationRepository } from "@/repositories/application.repository";
import { BusinessService } from "@/services/business.service";
import { Application } from "@prisma/client";

export class ApplicationService {
  static async startNewApplication(params: {
    applicantId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    commercialAddress: string;
    activityType: string;
    representativeName: string;
  }): Promise<{ application: Application; business: { id: string } }> {
    const business = await BusinessService.registerBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
      commercialAddress: params.commercialAddress,
      activityType: params.activityType,
      representativeName: params.representativeName,
    });

    const applicationNumber = await ApplicationRepository.generateNumber();
    const application = await ApplicationRepository.create({
      number: applicationNumber,
      applicantId: params.applicantId,
      businessId: business.id,
    });

    return { application, business };
  }
}
