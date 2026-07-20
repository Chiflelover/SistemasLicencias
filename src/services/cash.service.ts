import { prisma } from "@/lib/db/prisma";
import { PaymentRepository } from "@/repositories/payment.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { AuditService } from "@/services/audit.service";
import { CashSessionService } from "@/services/cash-session.service";
import { getCurrentSystemDate } from "@/lib/date";
import {
  ApplicationStatus,
  PaymentMethod,
  PaymentType,
  ReceiptType,
} from "@prisma/client";

/** Tarifa TUPA del derecho de trámite. */
export const TUPA_AMOUNT = 180.0;

/**
 * Billete de mayor denominación en circulación en Perú.
 *
 * Acota cuánto puede entregar el contribuyente: por encima de esto no hay
 * billete que lo justifique, y sirve para atajar un tipeo de más.
 */
export const MAX_BILL = 200.0;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  YAPE: "Yape",
  PLIN: "Plin",
};

export function isPaymentMethod(value: string): value is PaymentMethod {
  return Object.keys(PAYMENT_METHOD_LABELS).includes(value);
}

export class CashService {
  /**
   * Registra un cobro recibido en ventanilla.
   *
   * No interviene ninguna pasarela ni servicio externo: el cajero declara que
   * el dinero entró por caja y el sistema lo asienta.
   */
  static async registerCounterPayment(params: {
    cashierId: string;
    applicationId: string;
    method: PaymentMethod;
    receivedAmount?: number;
    receiptType?: ReceiptType;
  }) {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
      include: { documents: { select: { type: true } } },
    });

    if (!application) {
      throw new Error("No se encontró el trámite.");
    }

    // Sin turno abierto no hay dónde asentar el dinero: el cobro quedaría
    // fuera de todo arqueo y el cierre no cuadraría nunca.
    const turno = await CashSessionService.getOpenSession(params.cashierId);

    if (!turno) {
      throw new Error(
        "Tenés que abrir la caja antes de registrar un cobro."
      );
    }

    if (application.registeredById !== params.cashierId) {
      throw new Error("Solo puedes cobrar trámites que registraste vos.");
    }

    const hasFloorPlan = application.documents.some((d) => d.type === "FLOOR_PLAN");
    const hasRucRecord = application.documents.some((d) => d.type === "RUC_RECORD");

    if (!hasFloorPlan || !hasRucRecord) {
      throw new Error(
        "Faltan documentos obligatorios: el plano del local y los certificados."
      );
    }

    const isRenewal = application.status === ApplicationStatus.RENEWAL_AVAILABLE;

    if (application.status !== ApplicationStatus.PENDING_PAYMENT && !isRenewal) {
      throw new Error(
        `El trámite no está pendiente de pago. Estado actual: ${application.status}`
      );
    }

    // El vuelto solo tiene sentido en efectivo: los medios digitales cobran
    // el importe exacto. El neto de la caja no cambia —lo recibido menos el
    // vuelto es siempre TUPA_AMOUNT—, pero queda la traza de la operación.
    let receivedAmount: number | null = null;
    let changeGiven: number | null = null;

    if (params.method === PaymentMethod.EFECTIVO) {
      const recibido = params.receivedAmount ?? TUPA_AMOUNT;

      if (!Number.isFinite(recibido) || recibido < TUPA_AMOUNT) {
        throw new Error(
          `El monto recibido no alcanza: la tasa es S/ ${TUPA_AMOUNT.toFixed(2)}.`
        );
      }

      if (recibido > MAX_BILL) {
        throw new Error(
          `El monto recibido no puede superar los S/ ${MAX_BILL.toFixed(
            2
          )}, que es el billete de mayor denominación.`
        );
      }

      receivedAmount = recibido;
      changeGiven = Math.round((recibido - TUPA_AMOUNT) * 100) / 100;
    }

    const paidAt = await getCurrentSystemDate();
    const operationNumber = await PaymentRepository.generateOperationNumber();

    const payment = await prisma.payment.create({
      data: {
        applicationId: application.id,
        type: isRenewal ? PaymentType.RENEWAL : PaymentType.INITIAL_APPLICATION,
        amount: TUPA_AMOUNT,
        operationNumber,
        paidAt,
        method: params.method,
        registeredById: params.cashierId,
        receivedAmount,
        changeGiven,
        // Por defecto factura: el trámite siempre tiene RUC, que es el caso
        // que corresponde salvo que el contribuyente pida boleta.
        receiptType: params.receiptType ?? ReceiptType.FACTURA,
      },
    });

    if (isRenewal) {
      await LicenseService.renewLicense(application.id);
    } else {
      // PAYMENT_COMPLETED es el estado "pagado" del sistema; desde acá el
      // trámite queda habilitado para la programación de la inspección.
      await prisma.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.PAYMENT_COMPLETED, updatedAt: paidAt },
      });

      await InspectionService.scheduleInspection(application.id);
    }

    await AuditService.log({
      action: "PAGO_PRESENCIAL_REGISTRADO",
      entityType: "Payment",
      entityId: payment.id,
      userId: params.cashierId,
      details: {
        applicationId: application.id,
        applicationNumber: application.number,
        operationNumber,
        amount: TUPA_AMOUNT,
        method: params.method,
        receivedAmount,
        changeGiven,
        paidAt: paidAt.toISOString(),
        previousStatus: application.status,
        newStatus: isRenewal
          ? ApplicationStatus.LICENSE_ISSUED
          : ApplicationStatus.PAYMENT_COMPLETED,
      },
    });

    return { payment, operationNumber, paidAt };
  }

  /**
   * Arqueo de caja: totales de lo cobrado por un cajero en un rango de fechas,
   * desglosado por medio de pago.
   */
  static async getCashReconciliation(params: {
    cashierId: string;
    from: Date;
    to: Date;
  }) {
    const payments = await prisma.payment.findMany({
      where: {
        registeredById: params.cashierId,
        paidAt: { gte: params.from, lte: params.to },
      },
      include: {
        application: {
          select: {
            number: true,
            business: { select: { legalName: true, ruc: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    const byMethod: Record<string, { count: number; total: number }> = {};

    for (const method of Object.keys(PAYMENT_METHOD_LABELS)) {
      byMethod[method] = { count: 0, total: 0 };
    }

    let total = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);
      total += amount;

      const key = payment.method ?? "EFECTIVO";
      if (!byMethod[key]) {
        byMethod[key] = { count: 0, total: 0 };
      }

      byMethod[key].count += 1;
      byMethod[key].total += amount;
    }

    // El efectivo es lo único que termina en el cajón; el resto entra por
    // canales digitales. Se informan por separado porque el cierre de caja
    // solo cuenta el efectivo.
    const totalEfectivo = byMethod.EFECTIVO?.total ?? 0;

    return {
      from: params.from,
      to: params.to,
      totalOperations: payments.length,
      total,
      totalEfectivo,
      totalDigital: total - totalEfectivo,
      byMethod,
      payments: payments.map((payment) => ({
        id: payment.id,
        operationNumber: payment.operationNumber,
        amount: Number(payment.amount),
        method: payment.method,
        paidAt: payment.paidAt,
        applicationNumber: payment.application.number,
        legalName: payment.application.business.legalName,
        ruc: payment.application.business.ruc,
      })),
    };
  }
}
