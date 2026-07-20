import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseRepository } from "@/repositories/license.repository";
import { generateLicensePdf } from "@/lib/pdf";
import { addYears, getCurrentSystemDate } from "@/lib/date";
import { NotificationService } from "@/services/notification.service";
import { AuditService } from "@/services/audit.service";
import { WhatsAppService } from "@/services/whatsapp.service";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus, LicenseStatus } from "@prisma/client";

export class LicenseService {
  static async createLicenseForApplication(applicationId: string) {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error("Trámite no encontrado.");
    }

    if (application.status !== ApplicationStatus.LICENSE_ISSUED) {
      throw new Error("La licencia solo puede generarse cuando el trámite está emitido.");
    }

    if (application.license) {
      return application.license;
    }

    const licenseNumber = await LicenseRepository.generateNumber();
    const issuedAt = await getCurrentSystemDate();
    const expiresAt = addYears(issuedAt, 1);

    const pdfBytes = await generateLicensePdf({
      licenseNumber,
      legalName: application.business.legalName,
      ruc: application.business.ruc,
      fiscalAddress: application.business.fiscalAddress,
      commercialAddress: application.business.commercialAddress,
      activityType: application.business.activityType,
      issuedAt,
      expiresAt,
      applicantName: application.applicant.fullName,
    });

    return LicenseRepository.create({
      applicationId: application.id,
      licenseNumber,
      issuedAt,
      expiresAt,
      pdfContent: Buffer.from(pdfBytes),
      pdfFileName: `licencia-${licenseNumber}.pdf`,
    });
  }

  static async ensureRenewalState(applicationId: string) {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application || !application.license) {
      return;
    }

    const license = application.license;
    const now = await getCurrentSystemDate();
    const expirationTime = license.expiresAt.getTime();
    const daysUntilExpiration = (expirationTime - now.getTime()) / (1000 * 60 * 60 * 24);

    if (expirationTime <= now.getTime()) {
      const yaEstabaVencida =
        license.status === LicenseStatus.EXPIRED &&
        application.status === ApplicationStatus.EXPIRED;

      if (license.status !== LicenseStatus.EXPIRED) {
        await LicenseRepository.updateStatus(license.id, LicenseStatus.EXPIRED);
      }
      if (application.status !== ApplicationStatus.EXPIRED) {
        await ApplicationRepository.updateStatus(application.id, ApplicationStatus.EXPIRED);
      }

      // Se avisa una sola vez por día gracias a la clave de deduplicación.
      if (!yaEstabaVencida) {
        await NotificationService.notifyLicenseExpired({
          applicantId: application.applicantId,
          applicationId: application.id,
          licenseNumber: license.licenseNumber,
        });

        await AuditService.log({
          action: "LICENCIA_VENCIDA",
          entityType: "License",
          entityId: license.id,
          details: {
            applicationId: application.id,
            licenseNumber: license.licenseNumber,
            expiresAt: license.expiresAt.toISOString(),
          },
        });

        // Va dentro de esta guarda para que salga una sola vez, en la
        // transición a vencida, y no en cada consulta posterior.
        await WhatsAppService.notifyLicenseExpired();
      }

      return;
    }

    if (daysUntilExpiration <= 30) {
      if (license.status !== LicenseStatus.RENEWAL_AVAILABLE) {
        await LicenseRepository.updateStatus(license.id, LicenseStatus.RENEWAL_AVAILABLE);
      }
      if (application.status !== ApplicationStatus.RENEWAL_AVAILABLE) {
        await ApplicationRepository.updateStatus(application.id, ApplicationStatus.RENEWAL_AVAILABLE);
      }
      return;
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      await LicenseRepository.updateStatus(license.id, LicenseStatus.ACTIVE);
    }

    // Se revierten tanto RENEWAL_AVAILABLE como EXPIRED: si el reloj vuelve
    // atrás (al cerrar una demostración), el trámite tiene que recuperar su
    // estado real y no quedar vencido para siempre.
    if (
      application.status === ApplicationStatus.RENEWAL_AVAILABLE ||
      application.status === ApplicationStatus.EXPIRED
    ) {
      await ApplicationRepository.updateStatus(application.id, ApplicationStatus.LICENSE_ISSUED);
    }
  }

  static async renewLicense(applicationId: string) {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application || !application.license) {
      throw new Error("Licencia no encontrada para este trámite.");
    }

    const license = application.license;

    // Una licencia vencida ya no se renueva: corresponde un trámite nuevo.
    if (license.status === LicenseStatus.EXPIRED) {
      throw new Error(
        `La licencia ${license.licenseNumber} está vencida y no puede renovarse. ` +
          "Debés iniciar un nuevo trámite de licencia de funcionamiento."
      );
    }

    if (license.status !== LicenseStatus.RENEWAL_AVAILABLE) {
      throw new Error("La renovación solo está habilitada cuando falta hasta 30 días para el vencimiento.");
    }

    const newIssuedAt = await getCurrentSystemDate();
    const newExpiresAt = addYears(newIssuedAt, 1);

    const pdfBytes = await generateLicensePdf({
      licenseNumber: license.licenseNumber,
      legalName: application.business.legalName,
      ruc: application.business.ruc,
      fiscalAddress: application.business.fiscalAddress,
      commercialAddress: application.business.commercialAddress,
      activityType: application.business.activityType,
      issuedAt: newIssuedAt,
      expiresAt: newExpiresAt,
      applicantName: application.applicant.fullName,
    });

    const renewed = await LicenseRepository.renew(
      license.id,
      newIssuedAt,
      newExpiresAt,
      Buffer.from(pdfBytes),
      `licencia-${license.licenseNumber}.pdf`
    );

    if (application.status !== ApplicationStatus.LICENSE_ISSUED) {
      await ApplicationRepository.updateStatus(application.id, ApplicationStatus.LICENSE_ISSUED);
    }

    return renewed;
  }

  static async getLicenseByApplication(applicationId: string) {
    return LicenseRepository.findByApplicationId(applicationId);
  }

  /**
   * Vence todas las licencias cuya fecha ya pasó.
   *
   * El sistema no tiene tareas programadas, así que el vencimiento se procesa
   * al consultar: esta función se llama desde la búsqueda pública, la campana
   * de notificaciones y la descarga de licencias. Con eso, cualquier acceso al
   * sistema mantiene los estados al día.
   */
  static async syncExpiredLicenses() {
    const now = await getCurrentSystemDate();

    const vencidas = await prisma.license.findMany({
      where: {
        expiresAt: { lte: now },
        status: { not: LicenseStatus.EXPIRED },
      },
      select: { id: true, applicationId: true },
    });

    for (const licencia of vencidas) {
      // ensureRenewalState centraliza la transición, la notificación y la
      // auditoría, así que se reutiliza en lugar de duplicar la lógica.
      await this.ensureRenewalState(licencia.applicationId);
    }

    return vencidas.length;
  }

  /**
   * Recalcula el estado de todas las licencias contra la fecha actual.
   *
   * A diferencia de syncExpiredLicenses, que solo procesa las ya vencidas,
   * esta recorre todas: sirve para restablecer el sistema cuando el reloj
   * vuelve al presente después de una simulación.
   */
  static async resyncAllLicenseStates() {
    const licencias = await prisma.license.findMany({
      select: { applicationId: true },
    });

    for (const licencia of licencias) {
      await this.ensureRenewalState(licencia.applicationId);
    }

    return licencias.length;
  }
}
