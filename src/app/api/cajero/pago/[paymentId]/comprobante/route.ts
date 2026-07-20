import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { generateInvoicePdf, numeroComprobante } from "@/lib/invoice";
import { PAYMENT_METHOD_LABELS } from "@/services/cash.service";
import { ReceiptType } from "@prisma/client";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Descarga la factura de un cobro de ventanilla. */
export async function GET(
  _request: Request,
  { params }: { params: { paymentId: string } }
) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return json({ error: "No autorizado" }, 401);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: {
      application: {
        select: {
          number: true,
          business: {
            select: {
              legalName: true,
              ruc: true,
              fiscalAddress: true,
              representativeName: true,
              representativeDni: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return json({ error: "No se encontró el pago." }, 404);
  }

  if (payment.registeredById !== user.id) {
    return json({ error: "No autorizado" }, 403);
  }

  const tipo = payment.receiptType ?? ReceiptType.FACTURA;

  // Cada serie lleva su propio correlativo, así que se cuentan solo los
  // comprobantes del mismo tipo emitidos antes. No se guarda en la tabla para
  // no sumar otra columna: como los pagos no se borran, la numeración es
  // estable.
  const anteriores = await prisma.payment.count({
    where: {
      registeredById: { not: null },
      receiptType: tipo,
      createdAt: { lt: payment.createdAt },
    },
  });

  const correlativo = anteriores + 1;

  const pdfBytes = await generateInvoicePdf({
    tipo,
    correlativo,
    operationNumber: payment.operationNumber,
    paidAt: payment.paidAt,
    total: Number(payment.amount),
    method: payment.method
      ? PAYMENT_METHOD_LABELS[payment.method]
      : "No especificado",
    receivedAmount:
      payment.receivedAmount === null ? null : Number(payment.receivedAmount),
    changeGiven:
      payment.changeGiven === null ? null : Number(payment.changeGiven),
    applicationNumber: payment.application.number,
    cliente: {
      razonSocial: payment.application.business.legalName,
      ruc: payment.application.business.ruc,
      direccion: payment.application.business.fiscalAddress,
      representanteNombre: payment.application.business.representativeName,
      representanteDni: payment.application.business.representativeDni,
    },
  });

  // Buffer y no el Uint8Array crudo: el tipo que devuelve pdf-lib no encaja
  // en BodyInit con los tipos de Node actuales.
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${numeroComprobante(
        tipo,
        correlativo
      )}.pdf"`,
    },
  });
}
