import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { EMISOR, importeEnLetras } from "./invoice";

/**
 * Recibo de caja por el pago de una tasa municipal.
 *
 * **No es un comprobante de pago, y por eso no vive en `invoice.ts`.** El
 * derecho de trámite es una *tasa* (Ley 28976, art. 15; Norma II del Título
 * Preliminar del Código Tributario), y el Reglamento de Comprobantes de Pago
 * (R.S. 007-99/SUNAT, art. 6, num. 1.2) excluye de su definición de servicio a
 * los prestados por entidades del Sector Público Nacional que generan tasas:
 * la municipalidad no está obligada a emitir comprobante por ese cobro. La
 * propia orientación de SUNAT dice que "bastará contar con el respectivo
 * recibo de caja emitido por la Municipalidad".
 *
 * Tenerlo en su propio archivo es deliberado: mezclarlo con la factura
 * invitaría a copiarle la lógica de SUNAT que justamente no le corresponde.
 * Las cinco diferencias que lo definen:
 *
 *   - Numeración municipal propia (RC-año-correlativo), no la serie F001.
 *   - Dice CONTRIBUYENTE, no SEÑOR(ES): el adquirente es figura del reglamento
 *     de comprobantes, y acá no hay comprobante.
 *   - **Sin línea de IGV.** La factura la lleva en cero porque es una
 *     operación inafecta; un recibo de tasa ni siquiera entra en el ámbito.
 *   - Sin QR ni código hash: los dos pertenecen al sistema de comprobantes de
 *     pago electrónicos.
 *   - Leyenda que dice lo que es, que es lo que llevan los recibos reales.
 */

export interface ReceiptData {
  correlativo: number;
  operationNumber: string;
  paidAt: Date;
  total: number;
  formasPago: Array<{ method: string; amount: number; operacion?: string | null }>;
  receivedAmount: number | null;
  changeGiven: number | null;
  applicationNumber: string;
  contribuyente: {
    razonSocial: string;
    ruc: string;
  };
}

/** Numeración propia de la municipalidad: sin serie SUNAT. */
export function numeroRecibo(correlativo: number, paidAt: Date): string {
  return `RC-${paidAt.getFullYear()}-${String(correlativo).padStart(5, "0")}`;
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.05, 0.11, 0.24);
  const gris = rgb(0.35, 0.4, 0.5);
  const negro = rgb(0.1, 0.1, 0.12);

  const numero = numeroRecibo(data.correlativo, data.paidAt);

  const texto = (
    contenido: string,
    x: number,
    y: number,
    size = 9,
    font = regular,
    color = negro
  ) => page.drawText(contenido, { x, y, size, font, color });

  // ── Emisor ────────────────────────────────────────────────────────────────
  texto(EMISOR.razonSocial, 40, height - 55, 13, bold, navy);
  texto(EMISOR.direccion, 40, height - 72, 8, regular, gris);
  texto(`RUC: ${EMISOR.ruc}`, 40, height - 86, 9, bold, negro);

  // ── Recuadro del recibo ───────────────────────────────────────────────────
  const cajaX = width - 220;
  page.drawRectangle({
    x: cajaX,
    y: height - 105,
    width: 180,
    height: 60,
    borderColor: navy,
    borderWidth: 1.5,
  });

  const titulo = "RECIBO DE CAJA";
  const anchoTitulo = bold.widthOfTextAtSize(titulo, 11);
  texto(titulo, cajaX + (180 - anchoTitulo) / 2, height - 68, 11, bold, navy);

  const anchoNumero = bold.widthOfTextAtSize(numero, 11);
  texto(numero, cajaX + (180 - anchoNumero) / 2, height - 92, 11, bold, negro);

  // ── Contribuyente ─────────────────────────────────────────────────────────
  // "Contribuyente" y no "adquirente": el adquirente es figura del Reglamento
  // de Comprobantes de Pago, y este documento no es un comprobante.
  let y = height - 145;

  page.drawRectangle({
    x: 40,
    y: y - 46,
    width: width - 80,
    height: 58,
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 1,
  });

  texto("CONTRIBUYENTE:", 50, y, 8, bold, gris);
  texto(data.contribuyente.razonSocial, 140, y, 9, bold);

  texto("RUC:", 50, y - 16, 8, bold, gris);
  texto(data.contribuyente.ruc, 140, y - 16);

  texto("FECHA:", 50, y - 32, 8, bold, gris);
  texto(data.paidAt.toLocaleString("es-PE"), 140, y - 32, 8);

  // ── Concepto ──────────────────────────────────────────────────────────────
  y -= 80;

  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: width - 80,
    height: 20,
    color: navy,
  });

  texto("CONCEPTO", 50, y + 2, 8, bold, rgb(1, 1, 1));
  texto("IMPORTE", width - 95, y + 2, 8, bold, rgb(1, 1, 1));

  y -= 26;
  texto("Derecho de trámite - Licencia de funcionamiento", 50, y, 9);
  texto(`S/ ${data.total.toFixed(2)}`, width - 95, y, 9, bold);

  y -= 14;
  texto(
    "Tasa por servicios administrativos · Ley 28976, art. 15",
    50,
    y,
    7,
    regular,
    gris
  );
  texto(`Expediente ${data.applicationNumber}`, 50, y - 11, 7, regular, gris);

  // ── Total ─────────────────────────────────────────────────────────────────
  // Sin desglose ni línea de impuesto: el pago de un tributo no se descompone.
  y -= 45;

  page.drawLine({
    start: { x: width - 240, y: y + 14 },
    end: { x: width - 40, y: y + 14 },
    thickness: 1,
    color: navy,
  });

  texto("IMPORTE PAGADO", width - 235, y, 10, bold, navy);
  texto(`S/ ${data.total.toFixed(2)}`, width - 105, y, 10, bold, navy);

  y -= 24;
  texto(importeEnLetras(data.total), 40, y, 9, bold, navy);

  // ── Medio de pago ─────────────────────────────────────────────────────────
  // Acá no hace falta el "Contado/Crédito" que exige SUNAT en la factura: ese
  // campo pertenece al comprobante de pago. Lo útil para la caja es con qué se
  // pagó y, si fue Yape, con qué código de operación.
  y -= 30;
  texto("MEDIO DE PAGO:", 40, y, 8, bold, gris);

  if (data.formasPago.length <= 1) {
    const forma = data.formasPago[0];
    texto(forma?.method ?? "No especificado", 140, y, 8);

    if (forma?.operacion) {
      y -= 13;
      texto(`  Op. ${forma.operacion}`, 40, y, 7, regular, gris);
    }
  } else {
    const mismoMedio = data.formasPago.every(
      (forma) => forma.method === data.formasPago[0].method
    );

    texto(mismoMedio ? data.formasPago[0].method : "Pago mixto", 140, y, 8);

    for (const forma of data.formasPago) {
      y -= 13;
      texto(`  ${forma.method}`, 40, y, 8, regular, gris);
      texto(`S/ ${forma.amount.toFixed(2)}`, 140, y, 8);

      if (forma.operacion) {
        texto(`Op. ${forma.operacion}`, 210, y, 7, regular, gris);
      }
    }
  }

  if (data.receivedAmount !== null) {
    y -= 14;
    texto("PAGÓ CON:", 40, y, 8, bold, gris);
    texto(`S/ ${data.receivedAmount.toFixed(2)}`, 140, y, 8);

    y -= 14;
    texto("VUELTO:", 40, y, 8, bold, gris);
    texto(`S/ ${(data.changeGiven ?? 0).toFixed(2)}`, 140, y, 8);
  }

  y -= 14;
  texto("N° DE OPERACIÓN:", 40, y, 8, bold, gris);
  texto(data.operationNumber, 140, y, 8);

  // ── Pie ───────────────────────────────────────────────────────────────────
  // La leyenda que llevan los recibos municipales reales. Sin ella el documento
  // se puede confundir con un comprobante de pago, que es justo lo que no es.
  texto(
    "El presente documento acredita el pago de una tasa municipal y no constituye comprobante de pago.",
    40,
    82,
    7,
    bold,
    gris
  );

  texto(
    "Documento generado por el sistema de licencias de funcionamiento de la MPT.",
    40,
    70,
    7,
    regular,
    gris
  );

  return pdf.save();
}
