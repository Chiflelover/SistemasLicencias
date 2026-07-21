import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseRepository } from "@/repositories/license.repository";
import { generateLicensePdf } from "@/lib/pdf";
import { addYears, getCurrentSystemDate } from "@/lib/date";
import { NotificationService } from "@/services/notification.service";
import { AuditService } from "@/services/audit.service";
import { MailService } from "@/services/mail.service";
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
      representativeName: application.business.representativeName,
      representativeDni: application.business.representativeDni,
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

    // findById adelanta el vencimiento sobre el objeto que devuelve, sin
    // escribirlo (ver ApplicationRepository.syncStatusWithSimulatedDate).
    // Comparar contra ese objeto hacía creer que la transición ya estaba
    // hecha: no se persistía nunca y el aviso no salía. Los estados se leen
    // crudos de la base.
    const persistido = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true, license: { select: { status: true } } },
    });

    if (!persistido?.license) {
      return;
    }

    const estadoTramite = persistido.status;
    const estadoLicencia = persistido.license.status;

    const now = await getCurrentSystemDate();
    const expirationTime = license.expiresAt.getTime();
    const daysUntilExpiration = (expirationTime - now.getTime()) / (1000 * 60 * 60 * 24);

    if (expirationTime <= now.getTime()) {
      // Flip atómico: solo la llamada que efectivamente cambia el estado a
      // EXPIRED sigue con los avisos. Dos llamadas casi simultáneas —la
      // campana sondea y la consulta sincroniza a la vez— leían la licencia
      // como no vencida y ambas mandaban el correo. El update condicional lo
      // serializa en la base: solo una afecta la fila.
      const flip = await prisma.license.updateMany({
        where: { id: license.id, status: { not: LicenseStatus.EXPIRED } },
        data: { status: LicenseStatus.EXPIRED },
      });
      const recienVencida = flip.count > 0;

      if (estadoTramite !== ApplicationStatus.EXPIRED) {
        await ApplicationRepository.updateStatus(application.id, ApplicationStatus.EXPIRED);
      }

      // Solo en la transición real a vencida: nunca se repite el aviso.
      if (recienVencida) {
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

        // El aviso al administrado va por correo. WhatsApp quedó reservado
        // para el inspector, porque el bot gratuito entrega a un único número.
        if (application.contactEmail) {
          await MailService.notifyLicenseExpired(
            application.contactEmail,
            license.licenseNumber
          );
        }
      }

      return;
    }

    if (daysUntilExpiration <= 30) {
      if (estadoLicencia !== LicenseStatus.RENEWAL_AVAILABLE) {
        await LicenseRepository.updateStatus(license.id, LicenseStatus.RENEWAL_AVAILABLE);
      }
      if (estadoTramite !== ApplicationStatus.RENEWAL_AVAILABLE) {
        await ApplicationRepository.updateStatus(application.id, ApplicationStatus.RENEWAL_AVAILABLE);
      }
      return;
    }

    if (estadoLicencia !== LicenseStatus.ACTIVE) {
      await LicenseRepository.updateStatus(license.id, LicenseStatus.ACTIVE);
    }

    // Se revierten tanto RENEWAL_AVAILABLE como EXPIRED: si el reloj vuelve
    // atrás (al cerrar una demostración), el trámite tiene que recuperar su
    // estado real y no quedar vencido para siempre.
    if (
      estadoTramite === ApplicationStatus.RENEWAL_AVAILABLE ||
      estadoTramite === ApplicationStatus.EXPIRED
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
          "Debes iniciar un nuevo trámite de licencia de funcionamiento."
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
      representativeName: application.business.representativeName,
      representativeDni: application.business.representativeDni,
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

    // En paralelo: cada licencia es una fila distinta y la transición a
    // vencida es atómica, así que no compiten. Secuencial, con la latencia de
    // Neon por consulta, era el grueso de la demora al restablecer el reloj.
    await Promise.all(
      licencias.map((licencia) => this.ensureRenewalState(licencia.applicationId))
    );

    return licencias.length;
  }
}
