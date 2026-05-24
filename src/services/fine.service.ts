import { FineRepository } from "@/repositories/fine.repository";
import { LicenseRepository } from "@/repositories/license.repository";
import { getCurrentSystemDate } from "@/lib/date";
import { FineStatus } from "@prisma/client";

export class FineService {
  static async createFine(
    inspectorId: string,
    licenseId: string,
    amount: number,
    description: string,
    observations?: string
  ) {
    const license = await LicenseRepository.findById(licenseId);
    if (!license) {
      throw new Error("Licencia no encontrada para registrar la multa.");
    }

    return FineRepository.create({
      licenseId,
      inspectorId,
      amount,
      description,
      observations: observations || undefined,
      issuedAt: await getCurrentSystemDate(),
    });
  }

  static async getFinesForInspector(inspectorId: string) {
    return FineRepository.findByInspectorId(inspectorId);
  }
}
