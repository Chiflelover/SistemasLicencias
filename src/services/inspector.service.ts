import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { InspectionService } from "@/services/inspection.service";
import { getCurrentSystemDate } from "@/lib/date";
import { AuditService } from "@/services/audit.service";
import { NotificationService } from "@/services/notification.service";
import { MailService } from "@/services/mail.service";
import {
  ApplicationStatus,
  InspectionNumber,
  InspectionResult,
  InspectionStatus,
} from "@prisma/client";

export class InspectorService {
  static async getAssignedInspections(inspectorId: string) {
    return InspectionRepository.findByInspectorId(inspectorId);
  }

  /**
   * Agenda del día para el inspector: lo que le queda por hacer y lo que ya
   * resolvió. No incluye inspecciones de otras fechas.
   *
   * Usa la fecha del sistema (simulada en desarrollo) y no la real, para que
   * el DevPanel siga sirviendo para demostrar el flujo.
   */
  static async getTodayAgenda(inspectorId: string) {
    const systemDate = await getCurrentSystemDate();

    const from = new Date(systemDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(systemDate);
    to.setHours(23, 59, 59, 999);

    const [pending, completed] = await Promise.all([
      InspectionRepository.findPendingForDay(inspectorId, from, to),
      InspectionRepository.findCompletedForDay(inspectorId, from, to),
    ]);

    return {
      date: systemDate,
      pending,
      completed,
      pendingCount: pending.length,
      completedCount: completed.length,
    };
  }

  static async getInspectionDetails(inspectionId: string) {
    return InspectionRepository.findById(inspectionId);
  }

  static async reviewInspection(
    inspectionId: string,
    action: "approve" | "reject",
    observations?: string,
    paymentInvalid = false
  ) {
    const inspection = await InspectionRepository.findById(inspectionId);

    if (!inspection) {
      throw new Error("Inspección no encontrada.");
    }

    if (inspection.status === InspectionStatus.COMPLETED) {
      throw new Error("Esta inspección ya fue revisada y no puede modificarse.");
    }

    if (action === "reject" && !observations?.trim()) {
      throw new Error(
        "Debe registrar observaciones para rechazar la inspección."
      );
    }

    const result =
      action === "approve"
        ? InspectionResult.APPROVED
        : InspectionResult.REJECTED;

    const updatedInspection = await InspectionRepository.complete(
      inspectionId,
      result,
      observations?.trim() || ""
    );

    if (!updatedInspection) {
      throw new Error("No se pudo guardar la revisión de la inspección.");
    }

    if (action === "approve") {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.LICENSE_ISSUED
      );

      await LicenseService.createLicenseForApplication(inspection.applicationId);

      return updatedInspection;
    }

    // Comprobante de pago inválido: no hay segunda oportunidad. Subsanar sirve
    // para corregir documentos, pero un pago que nunca se hizo no se corrige
    // subiendo otro papel. El trámite se cierra en firme y el RUC queda libre
    // —DEFINITIVELY_REJECTED no bloquea— para iniciar uno nuevo desde cero.
    if (action === "reject" && paymentInvalid) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.DEFINITIVELY_REJECTED
      );

      await AuditService.log({
        action: "TRAMITE_RECHAZADO_POR_PAGO_INVALIDO",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: inspection.number,
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.DEFINITIVELY_REJECTED,
          motivo: "El comprobante de pago no es válido.",
        },
      });

      // Sin aviso, el administrado no se entera de que tiene que empezar de
      // nuevo: no puede iniciar sesión y el rechazo definitivo no tiene
      // pantalla propia.
      if (inspection.application.contactEmail) {
        await MailService.notifyPaymentRejected(
          inspection.application.contactEmail,
          observations?.trim() || ""
        );
      }

      return updatedInspection;
    }

    // Primera observación: el trámite queda observado y se reabre la carga de
    // documentos para que el administrado subsane antes de la segunda visita.
    if (action === "reject" && inspection.number === InspectionNumber.FIRST) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.FIRST_INSPECTION_REJECTED
      );

      // Agenda la segunda exactamente 30 días hábiles después del resultado.
      const secondInspection = await InspectionService.scheduleInspection(
        inspection.applicationId
      );

      await AuditService.log({
        action: "INSPECCION_OBSERVADA",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: "PRIMERA",
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
          cargaDeDocumentos: "reabierta para subsanación",
          segundaInspeccion: secondInspection?.scheduledAt ?? null,
        },
      });

      // Avisos al administrado: qué corregir y cuándo es la nueva visita.
      const applicantId = inspection.application.applicant.id;
      const applicationNumber = inspection.application.number;

      await NotificationService.notifyDocumentsToFix({
        applicantId,
        applicationId: inspection.applicationId,
        applicationNumber,
        observations: observations?.trim() || "",
      });

      if (secondInspection?.scheduledAt) {
        await NotificationService.notifyRescheduled({
          applicantId,
          applicationId: inspection.applicationId,
          applicationNumber,
          scheduledAt: secondInspection.scheduledAt,
        });

        // Correo con la observación y la fecha de la nueva visita. El correo
        // de contacto lo declaró el ciudadano al iniciar el trámite; el
        // usuario del flujo público no puede leer los avisos internos.
        if (inspection.application.contactEmail) {
          await MailService.notifyInspectionRejected(
            inspection.application.contactEmail,
            observations?.trim() || "",
            secondInspection.scheduledAt
          );
        }
      }

      return updatedInspection;
    }

    // Segunda observación: no hay tercera oportunidad.
    if (action === "reject" && inspection.number === InspectionNumber.SECOND) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.DEFINITIVELY_REJECTED
      );

      await AuditService.log({
        action: "TRAMITE_RECHAZADO_DEFINITIVO",
        entityType: "Inspection",
        entityId: inspection.id,
        userId: inspection.inspectorId,
        details: {
          applicationId: inspection.applicationId,
          numero: "SEGUNDA",
          observaciones: observations?.trim() || "",
          nuevoEstado: ApplicationStatus.DEFINITIVELY_REJECTED,
          motivo: "Segunda inspección observada: no corresponde una tercera.",
        },
      });

      return updatedInspection;
    }

    return updatedInspection;
  }
}