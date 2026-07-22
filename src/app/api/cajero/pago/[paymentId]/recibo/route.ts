import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { generateReceiptPdf, numeroRecibo } from "@/lib/receipt";
import { PAYMENT_METHOD_LABELS } from "@/services/cash.service";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Descarga el recibo de caja de un cobro de ventanilla.
 *
 * Es el documento que en la realidad entrega una municipalidad por una tasa:
 * el derecho de trámite no obliga a emitir comprobante de pago (ver
 * `src/lib/receipt.ts` para la cadena normativa). Convive con la factura, que
 * se emite por requerimiento del curso.
 *
 * Misma forma que la ruta del comprobante, incluido el correlativo: es la
 * misma operación de caja, solo cambia el documento que la representa.
 */
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
          business: { select: { legalName: true, ruc: true } },
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

  // Mismo criterio que la factura: se cuentan operaciones y no filas, porque un
  // pago mixto son dos filas Payment de la misma operación. Así el recibo y la
  // factura de un mismo cobro llevan el mismo número, con distinto prefijo.
  const anteriores = await prisma.payment.groupBy({
    by: ["applicationId", "paidAt"],
    where: {
      registeredById: { not: null },
      createdAt: { lt: payment.createdAt },
      NOT: { applicationId: payment.applicationId, paidAt: payment.paidAt },
    },
  });

  const correlativo = anteriores.length + 1;

  const grupo = await prisma.payment.findMany({
    where: { applicationId: payment.applicationId, paidAt: payment.paidAt },
    orderBy: { createdAt: "asc" },
  });

  const total = grupo.reduce((suma, p) => suma + Number(p.amount), 0);

  const formasPago = grupo.map((p) => ({
    method: p.method ? PAYMENT_METHOD_LABELS[p.method] : "No especificado",
    amount: Number(p.amount),
    operacion: p.externalReference,
  }));

  const filaEfectivo = grupo.find((p) => p.method === "EFECTIVO");

  const pdfBytes = await generateReceiptPdf({
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
      filaEfectivo?.changeGiven == null ? null : Number(filaEfectivo.changeGiven),
    applicationNumber: payment.application.number,
    contribuyente: {
      razonSocial: payment.application.business.legalName,
      ruc: payment.application.business.ruc,
    },
  });

  // Buffer y no el Uint8Array crudo: el tipo que devuelve pdf-lib no encaja en
  // BodyInit con los tipos de Node actuales.
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo-${numeroRecibo(
        correlativo,
        payment.paidAt
      )}.pdf"`,
    },
  });
}
