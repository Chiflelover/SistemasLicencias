import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { generateInvoicePdf, numeroComprobante } from "@/lib/invoice";
import { PAYMENT_METHOD_LABELS } from "@/services/cash.service";

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

  // Correlativo de la serie F001. No se guarda en la tabla para no sumar otra
  // columna: como los pagos no se borran, la numeración es estable.
  //
  // Se cuentan operaciones y no filas: un pago mixto son dos filas Payment de
  // la misma operación, así que contar filas salteaba un número por cada pago
  // mixto y daba un correlativo distinto según cuál de las dos filas se usara
  // para descargar. Se excluye la operación propia por lo mismo.
  const anteriores = await prisma.payment.groupBy({
    by: ["applicationId", "paidAt"],
    where: {
      registeredById: { not: null },
      createdAt: { lt: payment.createdAt },
      NOT: { applicationId: payment.applicationId, paidAt: payment.paidAt },
    },
  });

  const correlativo = anteriores.length + 1;

  // El pago pudo ser mixto: se agrupan las formas de la misma operación (mismo
  // trámite y mismo instante). El comprobante es uno solo, con el total y las
  // formas de pago listadas.
  const grupo = await prisma.payment.findMany({
    where: { applicationId: payment.applicationId, paidAt: payment.paidAt },
    orderBy: { createdAt: "asc" },
  });

  const total = grupo.reduce((suma, p) => suma + Number(p.amount), 0);

  const formasPago = grupo.map((p) => ({
    method: p.method ? PAYMENT_METHOD_LABELS[p.method] : "No especificado",
    amount: Number(p.amount),
  }));

  // El vuelto vive en la fila de efectivo del grupo, si la hay.
  const filaEfectivo = grupo.find((p) => p.method === "EFECTIVO");

  const pdfBytes = await generateInvoicePdf({
    correlativo,
    operationNumber: payment.operationNumber,
    paidAt: payment.paidAt,
    total,
    formasPago,
    receivedAmount:
      filaEfectivo?.receivedAmount == null
        ? null
        : Number(filaEfectivo.receivedAmount),
    changeGiven:
      filaEfectivo?.changeGiven == null
        ? null
        : Number(filaEfectivo.changeGiven),
    applicationNumber: payment.application.number,
    cliente: {
      razonSocial: payment.application.business.legalName,
      ruc: payment.application.business.ruc,
      direccion: payment.application.business.fiscalAddress,
    },
  });

  // Buffer y no el Uint8Array crudo: el tipo que devuelve pdf-lib no encaja
  // en BodyInit con los tipos de Node actuales.
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${numeroComprobante(
        correlativo
      )}.pdf"`,
    },
  });
}
