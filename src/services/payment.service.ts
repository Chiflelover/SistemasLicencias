import { PaymentRepository } from "@/repositories/payment.repository";
import { ApplicationRepository } from "@/repositories/application.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { Payment, PaymentType, ApplicationStatus } from "@prisma/client";

export class PaymentService {
  static async simulatePayment(applicationId: string): Promise<Payment> {
    const application = await ApplicationRepository.findById(applicationId);
    if (!application) {
      throw new Error("Trámite no encontrado.");
    }

    await LicenseService.ensureRenewalState(applicationId);
    const currentApplication = await ApplicationRepository.findById(applicationId);
    if (!currentApplication) {
      throw new Error("Trámite no encontrado.");
    }

    const operationNumber = await PaymentRepository.generateOperationNumber();
    const paymentType =
      currentApplication.status === ApplicationStatus.RENEWAL_AVAILABLE
        ? PaymentType.RENEWAL
        : PaymentType.INITIAL_APPLICATION;

    if (paymentType === PaymentType.INITIAL_APPLICATION) {
      if (currentApplication.status !== ApplicationStatus.PENDING_PAYMENT) {
        throw new Error("El trámite no está listo para el pago inicial.");
      }
    } else {
      if (currentApplication.status !== ApplicationStatus.RENEWAL_AVAILABLE) {
        throw new Error("La renovación no está disponible actualmente.");
      }
    }

    const payment = await PaymentRepository.create({
      applicationId,
      type: paymentType,
      amount: 2.0,
      operationNumber,
      paidAt: new Date(),
    });

    if (paymentType === PaymentType.INITIAL_APPLICATION) {
      await ApplicationRepository.updateStatus(applicationId, ApplicationStatus.PAYMENT_COMPLETED);
      await InspectionService.scheduleInspection(applicationId);
    } else {
      await LicenseService.renewLicense(applicationId);
    }

    return payment;
  }
}
