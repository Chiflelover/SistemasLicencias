import { InspectionRepository } from "@/repositories/inspection.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseService } from "@/services/license.service";
import { ApplicationStatus, InspectionResult } from "@prisma/client";

export class InspectorService {
  static async getAssignedInspections(inspectorId: string) {
    return InspectionRepository.findByInspectorId(inspectorId);
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
      throw new Error("Inspección no encontrada");
    }

    const result = action === "approve" ? InspectionResult.APPROVED : InspectionResult.REJECTED;
    const updatedInspection = await InspectionRepository.complete(inspectionId, result, observations || "");

    if (!updatedInspection) {
      throw new Error("No se pudo guardar la revisión de la inspección");
    }

    const applicationStatus = action === "approve"
      ? ApplicationStatus.LICENSE_ISSUED
      : inspection.number === "FIRST"
      ? ApplicationStatus.FIRST_INSPECTION_REJECTED
      : ApplicationStatus.DEFINITIVELY_REJECTED;

    await ApplicationRepository.updateStatus(inspection.applicationId, applicationStatus);

    if (action === "approve") {
      await LicenseService.createLicenseForApplication(inspection.applicationId);
    }

    return updatedInspection;
  }
}
