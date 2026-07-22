import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseRepository } from "@/repositories/license.repository";
import { generateLicensePdf } from "@/lib/pdf";
import { addYears, getCurrentSystemDate } from "@/lib/date";
import { NotificationService } from "@/services/notification.service";
import { InspectionService } from "@/services/inspection.service";
import { AuditService } from "@/services/audit.service";
import { MailService } from "@/services/mail.service";
import { prisma } from "@/lib/db/prisma";
import { ApplicationStatus, LicenseStatus } from "@prisma/client";

/**
 * Mínimo del motivo de una baja.
 *
 * Mismo criterio que el motivo de un movimiento de efectivo: una licencia que
 * termina antes de tiempo sin razón anotada es lo primero que se pincha en una
 * revisión.
 */
const MIN_MOTIVO_BAJA = 10;

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

    // Una baja es definitiva y no depende de fechas. Sin este corte, la sola
    // consulta la resucitaba: más abajo el estado se recalcula contra
    // `expiresAt` y una licencia dada de baja con fecha futura volvía a ACTIVE
    // sola, con el RUC bloqueado otra vez. Y esta función la llaman la búsqueda
    // pública, la campana y la descarga del PDF, así que pasaba enseguida.
    if (estadoLicencia === LicenseStatus.CANCELLED) {
      return;
    }

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

    // La renovación es POSTERIOR al vencimiento: mientras la licencia siga
    // vigente no hay nada que renovar. El aviso de "por vencer" que aparece 30
    // días antes es solo eso, un aviso.
    if (license.status !== LicenseStatus.EXPIRED) {
      throw new Error(
        `La licencia ${license.licenseNumber} todavía está vigente. La renovación ` +
          "se habilita recién cuando vence."
      );
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

    // Visita de control en una fecha al azar del año que acaba de empezar. Va
    // en try/catch como el resto de los efectos auxiliares: si el agendado
    // falla, la renovación ya está hecha y no se deshace por eso.
    try {
      await InspectionService.scheduleUnannouncedInspection({
        applicationId: application.id,
        desde: newIssuedAt,
        hasta: newExpiresAt,
      });
    } catch (error) {
      console.error("No se pudo agendar la inspección inopinada:", error);
    }

    return renewed;
  }

  /**
   * Baja de la licencia a pedido del titular, en ventanilla.
   *
   * El caso típico es la mudanza: la licencia vale para el establecimiento y no
   * para la empresa (Ley 28976), así que cambiar de local obliga a terminar la
   * que existe y tramitar otra. **No cuesta nada** — el cese es gratuito, y
   * además nadie ganaría plata usándolo para esquivar la renovación: el trámite
   * nuevo cobra la misma tarifa y encima pasa por inspección.
   *
   * Vale sobre los tres estados en los que la licencia existe: vigente, por
   * vencer y vencida. Bloquearla en las vencidas dejaría al negocio que se mudó
   * obligado a renovar —y pagar— una licencia de un local donde ya no está,
   * para recién después poder darla de baja.
   *
   * El efecto que importa: `CANCELLED` no figura en `OPEN_APPLICATION_STATUSES`
   * ni en `LICENSED_STATUSES`, así que **el RUC queda libre solo**, sin tocar
   * `findBlockingApplicationByRuc`.
   */
  static async cancelLicense(params: {
    applicationId: string;
    cashierId: string;
    motivo: string;
  }) {
    const motivo = params.motivo.trim();

    if (motivo.length < MIN_MOTIVO_BAJA) {
      throw new Error(
        `Explica el motivo de la baja con al menos ${MIN_MOTIVO_BAJA} caracteres. Queda registrado en la auditoría.`
      );
    }

    const application = await ApplicationRepository.findById(params.applicationId);

    if (!application?.license) {
      throw new Error("Este trámite no tiene una licencia que dar de baja.");
    }

    const license = application.license;

    if (license.status === LicenseStatus.CANCELLED) {
      throw new Error(
        `La licencia ${license.licenseNumber} ya fue dada de baja.`
      );
    }

    const ahora = await getCurrentSystemDate();

    // Las dos filas en una transacción: si el trámite quedara licenciado con la
    // licencia ya de baja, el RUC seguiría bloqueado y no habría forma de
    // arreglarlo desde ninguna pantalla.
    await prisma.$transaction([
      prisma.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.CANCELLED },
      }),
      prisma.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.CANCELLED },
      }),
    ]);

    // Una inopinada agendada sobre una licencia que ya no existe mandaría al
    // inspector a un local sin licencia. Se cancela junto con la baja.
    const inopinadasCanceladas = await prisma.inspection.deleteMany({
      where: { applicationId: application.id, status: "SCHEDULED" },
    });

    await AuditService.log({
      action: "LICENCIA_DADA_DE_BAJA",
      entityType: "License",
      entityId: license.id,
      userId: params.cashierId,
      details: {
        licenseNumber: license.licenseNumber,
        applicationNumber: application.number,
        ruc: application.business.ruc,
        estadoPrevio: license.status,
        motivo,
        inspeccionesCanceladas: inopinadasCanceladas.count,
        fecha: ahora.toISOString(),
      },
    });

    // Auxiliar, como el resto de los avisos: la baja ya está hecha y un fallo
    // del correo no puede deshacerla.
    try {
      if (application.contactEmail) {
        await MailService.notifyLicenseCancelled(
          application.contactEmail,
          license.licenseNumber,
          motivo
        );
      }
    } catch (error) {
      console.error("No se pudo avisar la baja al administrado:", error);
    }

    return {
      licenseNumber: license.licenseNumber,
      applicationNumber: application.number,
      ruc: application.business.ruc,
      inspeccionesCanceladas: inopinadasCanceladas.count,
    };
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
        // Las dadas de baja quedan afuera junto con las ya vencidas: no hay
        // que vencer algo que ya terminó, y recorrerlas en cada consulta sería
        // trabajo al pedo.
        status: { notIn: [LicenseStatus.EXPIRED, LicenseStatus.CANCELLED] },
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

  // resyncAllLicenseStates se eliminó con la reversión del simulador: era su
  // único llamador. El restablecer ahora borra las licencias en vez de
  // recalcularlas, y el vencimiento de cada una se sincroniza al consultarla
  // (syncExpiredLicenses / ensureRenewalState).
}
