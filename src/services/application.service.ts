import { ApplicationRepository } from "@/repositories/application.repository";
import { BusinessService } from "@/services/business.service";
import { getCurrentSystemDate } from "@/lib/date";
import { prisma } from "@/lib/db/prisma";
import { Application, ApplicationStatus, Business, Role } from "@prisma/client";

/** Estados en los que un trámite sigue vigente y no corresponde crear otro. */
export const OPEN_APPLICATION_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.DOCUMENTS_COMPLETE,
  ApplicationStatus.PENDING_PAYMENT,
  ApplicationStatus.PAYMENT_COMPLETED,
  ApplicationStatus.INSPECTION_SCHEDULED,
  ApplicationStatus.FIRST_INSPECTION_REJECTED,
  ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
];

/**
 * Estados en los que el negocio ya cuenta con licencia y tampoco corresponde
 * iniciar un trámite nuevo. Una licencia vencida o un rechazo definitivo sí
 * habilitan empezar de cero.
 */
const LICENSED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.LICENSE_ISSUED,
  ApplicationStatus.RENEWAL_AVAILABLE,
];

export class ApplicationService {
  /**
   * Busca por RUC un trámite que impida iniciar uno nuevo.
   *
   * Devuelve null si el negocio no existe, si nunca tramitó, o si su último
   * trámite terminó vencido o rechazado en forma definitiva.
   */
  static async findBlockingApplicationByRuc(ruc: string) {
    const application = await prisma.application.findFirst({
      where: {
        business: { ruc },
        status: { in: [...OPEN_APPLICATION_STATUSES, ...LICENSED_STATUSES] },
      },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        business: { select: { legalName: true, ruc: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return null;
    }

    return {
      ...application,
      motivo: LICENSED_STATUSES.includes(application.status)
        ? ("YA_TIENE_LICENCIA" as const)
        : ("EN_PROCESO" as const),
    };
  }

  /** Devuelve el trámite vigente de ese solicitante y negocio, si lo hay. */
  private static async findOpenApplication(
    applicantId: string,
    businessId: string
  ) {
    return prisma.application.findFirst({
      where: {
        applicantId,
        businessId,
        status: { in: OPEN_APPLICATION_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
  }

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
    activityType?: string;
    contactEmail?: string;
    representativeDni?: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    const business = await BusinessService.findOrCreateBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
      activityType: params.activityType,
      representativeDni: params.representativeDni,
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

    const existingApplication = await ApplicationService.findOpenApplication(
      applicant.id,
      business.id
    );

    if (existingApplication) {
      // Si retoma un trámite y cambió el correo, se actualiza: es el dato con
      // el que se le va a avisar.
      if (params.contactEmail) {
        await prisma.application.update({
          where: { id: existingApplication.id },
          data: { contactEmail: params.contactEmail },
        });
      }

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
        contactEmail: params.contactEmail ?? null,
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

  /**
   * Registro presencial completo en ventanilla.
   *
   * A diferencia del flujo público, acá el cajero releva todos los datos del
   * contribuyente (representante legal y contacto real), así que el solicitante
   * se crea con su correo verdadero en lugar de uno sintético.
   *
   * Deja el trámite en DRAFT; al subir el plano y los certificados,
   * DocumentService lo pasa solo a PENDING_PAYMENT.
   */
  static async registerInPersonApplication(params: {
    cashierId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    representativeName: string;
    representativeDni?: string;
    representativeRole?: string;
    activityType?: string;
    email: string;
    phone: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    const business = await BusinessService.upsertBusinessDetails({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
      activityType: params.activityType,
      representativeName: params.representativeName,
      representativeDni: params.representativeDni,
      representativeRole: params.representativeRole,
      representativePhone: params.phone,
    });

    const applicant = await prisma.user.upsert({
      where: { email: params.email },
      update: {
        fullName: params.representativeName,
        phone: params.phone,
        active: true,
      },
      create: {
        email: params.email,
        // Alta presencial: el contribuyente no elige contraseña en ventanilla.
        passwordHash: `presencial-sin-acceso-${params.ruc}`,
        fullName: params.representativeName,
        dni: params.representativeDni || "00000000",
        phone: params.phone,
        role: Role.APPLICANT,
        active: true,
      },
    });

    const existingApplication = await ApplicationService.findOpenApplication(
      applicant.id,
      business.id
    );

    if (existingApplication) {
      const tracked = await prisma.application.update({
        where: { id: existingApplication.id },
        data: {
          registeredById: params.cashierId,
          contactEmail: params.email,
        },
      });

      return { application: tracked, business };
    }

    const applicationNumber = await ApplicationRepository.generateNumber();

    const application = await prisma.application.create({
      data: {
        number: applicationNumber,
        applicantId: applicant.id,
        businessId: business.id,
        registeredById: params.cashierId,
        // El mismo correo que se guarda en el usuario va también al trámite:
        // MailService y la subsanación pública leen contactEmail, no
        // User.email. Sin esto el administrado atendido en ventanilla no
        // recibía ningún aviso pese a haber dejado su correo.
        contactEmail: params.email,
        createdAt: now,
        updatedAt: now,
      },
    });

    return { application, business };
  }
}