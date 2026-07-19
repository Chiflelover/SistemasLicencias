import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { InspectionService } from "@/services/inspection.service";
import { getCurrentSystemDate } from "@/lib/date";
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
    observations?: string
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

    if (action === "reject" && inspection.number === InspectionNumber.FIRST) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.FIRST_INSPECTION_REJECTED
      );

      await InspectionService.scheduleInspection(inspection.applicationId);

      return updatedInspection;
    }

    if (action === "reject" && inspection.number === InspectionNumber.SECOND) {
      await ApplicationRepository.updateStatus(
        inspection.applicationId,
        ApplicationStatus.DEFINITIVELY_REJECTED
      );

      return updatedInspection;
    }

    return updatedInspection;
  }
}