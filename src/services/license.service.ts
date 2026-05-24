import { ApplicationRepository } from "@/repositories/application.repository";
import { LicenseRepository } from "@/repositories/license.repository";
import { generateLicensePdf } from "@/lib/pdf";
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
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

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
    const now = new Date();
    const expirationTime = license.expiresAt.getTime();
    const daysUntilExpiration = (expirationTime - now.getTime()) / (1000 * 60 * 60 * 24);

    if (expirationTime <= now.getTime()) {
      if (license.status !== LicenseStatus.EXPIRED) {
        await LicenseRepository.updateStatus(license.id, LicenseStatus.EXPIRED);
      }
      if (application.status !== ApplicationStatus.EXPIRED) {
        await ApplicationRepository.updateStatus(application.id, ApplicationStatus.EXPIRED);
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
    if (application.status === ApplicationStatus.RENEWAL_AVAILABLE) {
      await ApplicationRepository.updateStatus(application.id, ApplicationStatus.LICENSE_ISSUED);
    }
  }

  static async renewLicense(applicationId: string) {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application || !application.license) {
      throw new Error("Licencia no encontrada para este trámite.");
    }

    const license = application.license;
    if (license.status !== LicenseStatus.RENEWAL_AVAILABLE) {
      throw new Error("La renovación solo está habilitada cuando falta hasta 30 días para el vencimiento.");
    }

    const newIssuedAt = new Date();
    const newExpiresAt = new Date(license.expiresAt);
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);

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
}
