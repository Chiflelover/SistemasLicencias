import { ApplicationRepository } from "@/repositories/application.repository";
import { BusinessService } from "@/services/business.service";
import { getCurrentSystemDate } from "@/lib/date";
import { prisma } from "@/lib/db/prisma";
import { Application, ApplicationStatus, Business, Role } from "@prisma/client";

export class ApplicationService {
  static async startNewApplication(params: {
    applicantId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    const business = await BusinessService.registerBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
    });

    const applicationNumber = await ApplicationRepository.generateNumber();

    const application = await prisma.application.create({
      data: {
        number: applicationNumber,
        applicantId: params.applicantId,
        businessId: business.id,
        createdAt: now,
      },
    });

    return { application, business };
  }

  static async startPublicApplication(params: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    const business = await BusinessService.findOrCreateBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
    });

    const applicant = await prisma.user.upsert({
      where: {
        email: `tramite-${params.ruc}@municipalidad.local`,
      },
      update: {
        fullName: `Solicitante RUC ${params.ruc}`,
        active: true,
      },
      create: {
        email: `tramite-${params.ruc}@municipalidad.local`,
        passwordHash: `public-flow-disabled-${params.ruc}`,
        fullName: `Solicitante RUC ${params.ruc}`,
        dni: "00000000",
        phone: "000000000",
        role: Role.APPLICANT,
        active: true,
      },
    });

    const existingApplication = await prisma.application.findFirst({
      where: {
        applicantId: applicant.id,
        businessId: business.id,
        status: {
          in: [
            ApplicationStatus.DRAFT,
            ApplicationStatus.DOCUMENTS_COMPLETE,
            ApplicationStatus.PENDING_PAYMENT,
            ApplicationStatus.PAYMENT_COMPLETED,
            ApplicationStatus.INSPECTION_SCHEDULED,
            ApplicationStatus.FIRST_INSPECTION_REJECTED,
            ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingApplication) {
      return {
        application: existingApplication,
        business,
      };
    }

    const applicationNumber = await ApplicationRepository.generateNumber();

    const application = await prisma.application.create({
      data: {
        number: applicationNumber,
        applicantId: applicant.id,
        businessId: business.id,
        createdAt: now,
      },
    });

    return { application, business };
  }

  /**
   * Registro presencial hecho por un cajero en ventanilla.
   *
   * Reutiliza el flujo público (el ciudadano no tiene cuenta) y solo agrega la
   * trazabilidad de qué cajero atendió el trámite.
   */
  static async startCashierApplication(params: {
    cashierId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
  }): Promise<{ application: Application; business: Business }> {
    const { application, business } = await this.startPublicApplication({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
    });

    const trackedApplication = await prisma.application.update({
      where: { id: application.id },
      data: { registeredById: params.cashierId },
    });

    return { application: trackedApplication, business };
  }
}