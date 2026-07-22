import { prisma } from "@/lib/db/prisma";
import { PaymentRepository } from "@/repositories/payment.repository";
import { InspectionService } from "@/services/inspection.service";
import { LicenseService } from "@/services/license.service";
import { AuditService } from "@/services/audit.service";
import { CashSessionService } from "@/services/cash-session.service";
import { getCurrentSystemDate } from "@/lib/date";
import { getTupaAmount } from "@/lib/tarifa";
import {
  ApplicationStatus,
  PaymentMethod,
  PaymentType,
  ReceiptType,
} from "@prisma/client";

// La tarifa dejó de ser una constante: la fija el administrador y se lee en
// cada cobro con getTupaAmount().

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
    // Una o dos formas de pago (pago mixto). Sus montos deben sumar la tasa.
    // `operacion` es el código que muestra la app al yapear: obligatorio en
    // cada tramo por Yape, ignorado en efectivo.
    formasPago: Array<{
      method: PaymentMethod;
      amount: number;
      operacion?: string;
    }>;
    receivedAmount?: number;
  }) {
    const application = await prisma.application.findUnique({
      where: { id: params.applicationId },
      include: { documents: { select: { type: true } } },
    });

    if (!application) {
      throw new Error("No se encontró el trámite.");
    }

    // Sin turno abierto no hay dónde asentar el dinero: el cobro quedaría
    // fuera de todo arqueo y el cierre no cuadraría nunca. Una apertura
    // solicitada todavía no está OPEN, así que tampoco habilita el cobro.
    const turno = await CashSessionService.requireOpenSession(params.cashierId);

    const isRenewal = application.status === ApplicationStatus.EXPIRED;

    // El candado es contra el trámite que armó OTRA caja: ese expediente es
    // suyo y es la que responde por él. Un trámite **sin** cajero
    // —`registeredById` en null— nació en la web, no tiene dueño y lo cobra el
    // que esté libre: es el mismo criterio que la renovación. Sin esto, quien
    // empezó por internet y no pudo pagar quedaba trabado por las dos puntas.
    if (
      !isRenewal &&
      application.registeredById !== null &&
      application.registeredById !== params.cashierId
    ) {
      throw new Error(
        "Este trámite lo registró otra caja. Solo puede cobrarlo la que lo dio de alta."
      );
    }

    const hasFloorPlan = application.documents.some((d) => d.type === "FLOOR_PLAN");
    const hasRucRecord = application.documents.some((d) => d.type === "RUC_RECORD");

    // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────────────────
    // Para cobrar sin exigir documentos, borrar este bloque entero. Para
    // exigir uno solo, cambiar la condición:
    //
    //   if (!hasFloorPlan) {                    // solo el plano
    //   if (!hasFloorPlan && !hasRucRecord) {   // al menos uno de los dos
    //
    // La pantalla del cajero tiene su propia comprobación y también deshabilita
    // el botón (src/app/cajero/pago/page.tsx). El punto de partida de todo esto
    // es el `documentsComplete` de
    // src/app/api/public/tramite/[applicationId]/documentos/route.ts.
    if (!hasFloorPlan || !hasRucRecord) {
      throw new Error(
        "Faltan documentos obligatorios: el plano del local y los certificados."
      );
    }

    // La renovación se cobra recién cuando la licencia venció: mientras siga
    // vigente no hay nada que renovar.
    if (application.status !== ApplicationStatus.PENDING_PAYMENT && !isRenewal) {
      throw new Error(
        `El trámite no está pendiente de pago. Estado actual: ${application.status}`
      );
    }

    // ── Validación de las formas de pago ──────────────────────────────────
    const formas = params.formasPago ?? [];

    if (formas.length < 1 || formas.length > 2) {
      throw new Error("El pago admite uno o dos métodos (pago mixto).");
    }

    for (const forma of formas) {
      if (!Number.isFinite(forma.amount) || forma.amount <= 0) {
        throw new Error("Cada monto del pago debe ser mayor a cero.");
      }
    }

    // Repetir el método solo tiene sentido con Yape: son dos transferencias
    // distintas, cada una con su código de operación. Dos tramos en efectivo
    // serían un único pago en efectivo partido al pedo.
    if (
      formas.length === 2 &&
      formas[0].method === formas[1].method &&
      formas[0].method !== PaymentMethod.YAPE
    ) {
      throw new Error(
        "En un pago mixto los dos métodos deben ser distintos. Solo Yape admite dos operaciones."
      );
    }

    // El código de operación es lo único que permite conciliar un Yape contra
    // la cuenta de la municipalidad: sin él, el cobro queda sin respaldo.
    for (const forma of formas) {
      if (forma.method !== PaymentMethod.YAPE) continue;

      const operacion = String(forma.operacion || "").trim();

      if (!operacion) {
        throw new Error(
          "Falta el número de operación del Yape. Es el código que aparece en la app del contribuyente."
        );
      }

      // Yape no publica el formato de ese número, así que esto es una
      // comprobación de sensatez y no la regla oficial: ataja letras y largos
      // absurdos sin arriesgarse a rechazar un código legítimo. Exigir un
      // largo exacto sería peor: dejaría a la ventanilla sin poder registrar
      // un Yape real. La conciliación de verdad la hace el banco.
      if (!/^\d{6,12}$/.test(operacion)) {
        throw new Error(
          "El número de operación del Yape debe tener entre 6 y 12 dígitos, sin letras ni espacios."
        );
      }
    }

    // La tarifa se lee al cobrar, no al iniciar el trámite: rige la vigente
    // hoy. Lo que se cobró de verdad queda en Payment.amount.
    const tarifa = await getTupaAmount();

    // La suma debe ser exactamente la tasa. Se compara en céntimos para no
    // arrastrar el error de coma flotante.
    const totalCentimos = Math.round(
      formas.reduce((suma, forma) => suma + forma.amount, 0) * 100
    );

    if (totalCentimos !== Math.round(tarifa * 100)) {
      // El monto va interpolado y no escrito a mano: la tarifa la cambia el
      // administrador, así que un "S/ 180.00" fijo mentiría en cuanto la toque.
      throw new Error(
        `Monto insuficiente o excedido. El total debe ser S/ ${tarifa.toFixed(2)}.`
      );
    }

    // El vuelto solo aplica cuando es un único pago en efectivo. En un pago
    // mixto los montos son exactos y no hay vuelto.
    const esUnicoEfectivo =
      formas.length === 1 && formas[0].method === PaymentMethod.EFECTIVO;

    let receivedAmount: number | null = null;
    let changeGiven: number | null = null;

    if (esUnicoEfectivo) {
      const recibido = params.receivedAmount ?? tarifa;

      if (!Number.isFinite(recibido) || recibido < tarifa) {
        throw new Error(
          `El monto recibido no alcanza: la tasa es S/ ${tarifa.toFixed(2)}.`
        );
      }

      // No hay tope superior: el contribuyente puede entregar varios billetes
      // y el vuelto es la diferencia exacta. Con una tarifa de S/ 500 y tres
      // billetes de 200, el vuelto es 100.
      receivedAmount = recibido;
      changeGiven = Math.round((recibido - tarifa) * 100) / 100;

      // El vuelto sale del cajón, así que no puede pasarse de lo que hay
      // dentro. Se mira el estado de la caja ANTES de asentar este pago: es
      // con ese efectivo con el que el cajero va a devolver el cambio. Lo
      // cobrado por Yape no cuenta, porque nunca pasó por el cajón.
      if (changeGiven > 0) {
        const enCaja = await CashSessionService.getSessionTotals(turno.id);

        if (
          Math.round(changeGiven * 100) >
          Math.round(enCaja.esperadoEnCaja * 100)
        ) {
          throw new Error(
            `No hay efectivo para el vuelto: harían falta S/ ${changeGiven.toFixed(
              2
            )} y en la caja hay S/ ${enCaja.esperadoEnCaja.toFixed(2)}. ` +
              "Pide el importe justo o solicita al administrador que entregue efectivo."
          );
        }
      }
    }

    const paidAt = await getCurrentSystemDate();

    // ── Reclamo del trámite, antes de escribir un solo peso ────────────────
    // Todo lo de arriba es "leer y comprobar", y entre esa lectura y la
    // escritura hay una ventana: dos cobros simultáneos —la web y la
    // ventanilla, o dos cajas— leían los dos "pago pendiente" y los dos
    // seguían. Pasó de verdad: un trámite terminó con dos pagos de la tasa
    // completa y dos primeras inspecciones agendadas.
    //
    // El update condicional lo decide la base y no la aplicación: el que gana
    // se lleva `count: 1`, el que pierde recibe 0 y corta acá. Mismo truco que
    // usa `ensureRenewalState` para no mandar dos veces el correo de
    // vencimiento.
    //
    // La renovación se reclama igual, sobre `EXPIRED`: ahí el estado final lo
    // pone `renewLicense`, así que solo se marca que este cobro es el que va.
    const reclamado = await prisma.application.updateMany({
      where: {
        id: application.id,
        status: isRenewal
          ? ApplicationStatus.EXPIRED
          : ApplicationStatus.PENDING_PAYMENT,
      },
      data: isRenewal
        ? { updatedAt: paidAt }
        : { status: ApplicationStatus.PAYMENT_COMPLETED, updatedAt: paidAt },
    });

    if (reclamado.count === 0) {
      throw new Error(
        "Este trámite ya fue cobrado. Actualiza la lista antes de volver a intentarlo."
      );
    }

    // Único comprobante que se emite. El campo se conserva para dejar asentado
    // que el cobro generó comprobante; los pagos anteriores a la factura lo
    // tienen en null.
    const receiptType = ReceiptType.FACTURA;
    const type = isRenewal
      ? PaymentType.RENEWAL
      : PaymentType.INITIAL_APPLICATION;

    // ── Asiento: una fila Payment por forma de pago ───────────────────────
    // Comparten paidAt y receiptType: así el comprobante las agrupa como una
    // sola operación, y el arqueo cuenta cada monto bajo su método.
    const pagos = [];

    for (const forma of formas) {
      const operationNumber = await PaymentRepository.generateOperationNumber();

      const pago = await prisma.payment.create({
        data: {
          applicationId: application.id,
          type,
          amount: forma.amount,
          operationNumber,
          // El código que el contribuyente ve en su app. Solo en Yape.
          externalReference:
            forma.method === PaymentMethod.YAPE
              ? String(forma.operacion || "").trim()
              : null,
          paidAt,
          method: forma.method,
          registeredById: params.cashierId,
          // El vuelto se anota solo en la fila de efectivo del pago único.
          receivedAmount:
            forma.method === PaymentMethod.EFECTIVO ? receivedAmount : null,
          changeGiven:
            forma.method === PaymentMethod.EFECTIVO ? changeGiven : null,
          receiptType,
        },
      });

      pagos.push(pago);
    }

    if (isRenewal) {
      await LicenseService.renewLicense(application.id);
    } else {
      // El estado ya quedó en PAYMENT_COMPLETED con el reclamo de más arriba;
      // acá solo falta la inspección, que es lo que ese estado habilita.
      await InspectionService.scheduleInspection(application.id);
    }

    await AuditService.log({
      action: "PAGO_PRESENCIAL_REGISTRADO",
      entityType: "Payment",
      entityId: pagos[0].id,
      userId: params.cashierId,
      details: {
        applicationId: application.id,
        applicationNumber: application.number,
        total: tarifa,
        formasPago: formas.map((f) => ({ method: f.method, amount: f.amount })),
        receivedAmount,
        changeGiven,
        paidAt: paidAt.toISOString(),
        previousStatus: application.status,
        newStatus: isRenewal
          ? ApplicationStatus.LICENSE_ISSUED
          : ApplicationStatus.PAYMENT_COMPLETED,
      },
    });

    return { payment: pagos[0], pagos, operationNumber: pagos[0].operationNumber, paidAt };
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
