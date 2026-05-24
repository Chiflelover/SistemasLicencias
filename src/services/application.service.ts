import { ApplicationRepository } from "@/repositories/application.repository";
import { BusinessService } from "@/services/business.service";
import { Application } from "@prisma/client";

export class ApplicationService {
  static async startNewApplication(params: {
    applicantId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<{ application: Application; business: { id: string } }> {
    const business = await BusinessService.registerBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
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
