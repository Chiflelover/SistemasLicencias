import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { createHash } from "crypto";

/**
 * Comprobante de pago del derecho de trámite.
 *
 * Genera el PDF con la estructura que exige SUNAT para una factura. No es
 * emisión electrónica: eso necesita certificado digital y un OSE autorizado,
 * ambos de pago. El documento sirve para entregar en ventanilla y para la
 * demostración, no está declarado ante SUNAT.
 */

/**
 * Datos del emisor, tomados del registro de SUNAT.
 *
 * El RUC anterior era un relleno que ni siquiera pasaba el dígito de control.
 */
export const EMISOR = {
  razonSocial: "MUNICIPALIDAD PROVINCIAL DE TRUJILLO",
  ruc: "20175639391",
  direccion: "JR. ALMAGRO NRO. 525, LA LIBERTAD - TRUJILLO - TRUJILLO",
};

/**
 * Serie y códigos SUNAT del único comprobante que emite la municipalidad.
 *
 * La boleta de venta se eliminó: el derecho de trámite se cobra siempre a la
 * empresa titular del RUC, así que el adquirente es la persona jurídica
 * (documento tipo 6) y no hay caso de persona natural que justifique la serie
 * B001.
 */
export const COMPROBANTE = {
  serie: "F001",
  codigo: "01",
  titulo: "FACTURA ELECTRÓNICA",
  docCode: "6",
};

// IGV_RATE y desglosarIgv se eliminaron: el derecho de trámite es una tasa
// municipal y no está gravado con IGV, así que no hay nada que desglosar. El
// comprobante lo declara como operación inafecta por el importe completo.

/**
 * Resumen (código hash) del comprobante.
 *
 * En una emisión real es el digest del XML **firmado**, y por eso acredita que
 * el documento no se alteró. Acá no hay firma —eso exige certificado digital y
 * un OSE, los dos de pago—, así que se calcula sobre la cadena que identifica
 * al comprobante.
 *
 * Lo importante es que **no sea aleatorio**: un hash es el mismo mientras el
 * contenido no cambie. Descargar dos veces la misma factura y obtener códigos
 * distintos delataría enseguida que es de adorno. Así, en cambio, se comporta
 * como lo que dice ser: estable por comprobante y distinto en cuanto cambia un
 * dato.
 */
function calcularResumen(contenido: string): string {
  return createHash("sha256")
    .update(contenido, "utf8")
    .digest("base64")
    // Los resúmenes reales rondan esta longitud; el base64 completo se iría
    // del ancho de la hoja.
    .slice(0, 28);
}

export interface InvoiceData {
  correlativo: number;
  operationNumber: string;
  paidAt: Date;
  total: number;
  // Una o dos formas de pago (pago mixto, o dos operaciones de Yape). Cada una
  // con su etiqueta, su monto y —si fue Yape— el código de la operación.
  formasPago: Array<{ method: string; amount: number; operacion?: string | null }>;
  receivedAmount: number | null;
  changeGiven: number | null;
  applicationNumber: string;
  cliente: {
    razonSocial: string;
    ruc: string;
    direccion: string;
  };
}

const UNIDADES = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS",
  "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
];

const DECENAS = [
  "", "", "VEINTI", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
  "OCHENTA", "NOVENTA",
];

const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

/** Convierte la parte entera a letras. SUNAT exige el importe en texto. */
function enteroALetras(numero: number): string {
  if (numero === 0) return "CERO";
  if (numero === 100) return "CIEN";

  if (numero <= 20) return UNIDADES[numero];

  if (numero < 100) {
    const decena = Math.floor(numero / 10);
    const unidad = numero % 10;

    if (decena === 2) {
      return unidad === 0 ? "VEINTE" : `VEINTI${UNIDADES[unidad]}`;
    }

    return unidad === 0
      ? DECENAS[decena]
      : `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
  }

  if (numero < 1000) {
    const centena = Math.floor(numero / 100);
    const resto = numero % 100;

    return resto === 0
      ? CENTENAS[centena]
      : `${CENTENAS[centena]} ${enteroALetras(resto)}`;
  }

  const miles = Math.floor(numero / 1000);
  const resto = numero % 1000;
  const prefijo = miles === 1 ? "MIL" : `${enteroALetras(miles)} MIL`;

  return resto === 0 ? prefijo : `${prefijo} ${enteroALetras(resto)}`;
}

export function importeEnLetras(monto: number): string {
  const entero = Math.floor(monto);
  const centimos = Math.round((monto - entero) * 100);

  return `SON: ${enteroALetras(entero)} CON ${String(centimos).padStart(
    2,
    "0"
  )}/100 SOLES`;
}

export function numeroComprobante(correlativo: number): string {
  return `${COMPROBANTE.serie}-${String(correlativo).padStart(8, "0")}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.05, 0.11, 0.24);
  const gris = rgb(0.35, 0.4, 0.5);
  const negro = rgb(0.1, 0.1, 0.12);

  const comprobante = COMPROBANTE;
  const numero = numeroComprobante(data.correlativo);
  // El derecho de trámite es una TASA municipal, o sea un tributo: no está
  // gravado con IGV. Por eso el importe va entero como operación inafecta y el
  // impuesto queda en cero, en lugar de partirse en base + 18 %.
  const total = data.total;
  const igv = 0;

  // El adquirente es siempre la empresa titular del RUC: el derecho de trámite
  // lo paga el negocio, no el representante.
  const adquirente = {
    etiquetaNombre: "SEÑOR(ES):",
    nombre: data.cliente.razonSocial,
    etiquetaDoc: "RUC:",
    doc: data.cliente.ruc,
  };

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

  // ── Recuadro del comprobante ──────────────────────────────────────────────
  const cajaX = width - 220;
  page.drawRectangle({
    x: cajaX,
    y: height - 110,
    width: 180,
    height: 70,
    borderColor: navy,
    borderWidth: 1.5,
  });

  texto(`RUC ${EMISOR.ruc}`, cajaX + 42, height - 60, 10, bold, navy);

  // El título de la boleta es más largo, así que se centra según su ancho.
  const anchoTitulo = bold.widthOfTextAtSize(comprobante.titulo, 9);
  texto(
    comprobante.titulo,
    cajaX + (180 - anchoTitulo) / 2,
    height - 78,
    9,
    bold,
    navy
  );

  texto(numero, cajaX + 58, height - 98, 11, bold, negro);

  // ── Adquirente ────────────────────────────────────────────────────────────
  let y = height - 145;

  page.drawRectangle({
    x: 40,
    y: y - 62,
    width: width - 80,
    height: 74,
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 1,
  });

  texto(adquirente.etiquetaNombre, 50, y, 8, bold, gris);
  texto(adquirente.nombre, 130, y, 9, bold);

  texto(adquirente.etiquetaDoc, 50, y - 16, 8, bold, gris);
  texto(adquirente.doc, 130, y - 16);

  texto("DIRECCIÓN:", 50, y - 32, 8, bold, gris);
  texto(data.cliente.direccion.slice(0, 70), 130, y - 32, 8);

  texto("FECHA DE EMISIÓN:", 50, y - 48, 8, bold, gris);
  texto(data.paidAt.toLocaleString("es-PE"), 130, y - 48, 8);

  // ── Detalle ───────────────────────────────────────────────────────────────
  y -= 95;

  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: width - 80,
    height: 20,
    color: navy,
  });

  texto("CANT.", 50, y + 2, 8, bold, rgb(1, 1, 1));
  texto("DESCRIPCIÓN", 100, y + 2, 8, bold, rgb(1, 1, 1));
  texto("V. UNIT.", width - 160, y + 2, 8, bold, rgb(1, 1, 1));
  texto("IMPORTE", width - 95, y + 2, 8, bold, rgb(1, 1, 1));

  y -= 26;
  texto("1", 55, y);
  texto("Derecho de trámite - Licencia de funcionamiento", 100, y, 8);
  // Sin desglose: en una operación inafecta el importe es el total, no una
  // base a la que después se le suma el impuesto.
  texto(total.toFixed(2), width - 160, y);
  texto(total.toFixed(2), width - 95, y);

  y -= 14;
  texto(`Expediente ${data.applicationNumber}`, 100, y, 7, regular, gris);
  texto("Tasa TUPA - Ley 28976", 100, y - 11, 7, regular, gris);

  // ── Totales ───────────────────────────────────────────────────────────────
  y -= 50;

  const totales: Array<[string, string, boolean]> = [
    ["Operaciones inafectas", `S/ ${total.toFixed(2)}`, false],
    ["IGV", `S/ ${igv.toFixed(2)}`, false],
    ["IMPORTE TOTAL", `S/ ${total.toFixed(2)}`, true],
  ];

  for (const [etiqueta, monto, destacado] of totales) {
    if (destacado) {
      page.drawLine({
        start: { x: width - 220, y: y + 14 },
        end: { x: width - 40, y: y + 14 },
        thickness: 1,
        color: navy,
      });
    }

    texto(
      etiqueta,
      width - 215,
      y,
      destacado ? 10 : 9,
      destacado ? bold : regular,
      destacado ? navy : negro
    );

    texto(
      monto,
      width - 105,
      y,
      destacado ? 10 : 9,
      destacado ? bold : regular,
      destacado ? navy : negro
    );

    y -= 17;
  }

  // ── Importe en letras ─────────────────────────────────────────────────────
  y -= 10;
  texto(importeEnLetras(total), 40, y, 9, bold, navy);

  // Motivo de la inafectación, dicho en el documento: sin esto, un comprobante
  // con IGV en cero parece un error de cálculo y no una regla tributaria.
  y -= 14;
  texto(
    "Operación inafecta al IGV: el derecho de trámite es una tasa municipal.",
    40,
    y,
    7,
    regular,
    gris
  );

  // ── Forma de pago ─────────────────────────────────────────────────────────
  // "Forma de pago" en SUNAT significa **Contado o Crédito**, y es obligatoria
  // desde la RS 193-2020 (vigente 1/9/2021). Acá siempre es contado: el cajero
  // cobra y emite en el mismo acto. Antes esta etiqueta llevaba el medio de
  // pago, que es otra cosa y va debajo.
  y -= 28;
  texto("FORMA DE PAGO:", 40, y, 8, bold, gris);
  texto("Contado", 130, y, 8);

  // El medio no es un requisito del comprobante —la bancarización recién se
  // exige desde S/ 3,500—, pero se informa igual: al cajero le sirve para
  // conciliar, y con dos operaciones de Yape es lo único que las distingue.
  y -= 14;
  texto("MEDIO DE PAGO:", 40, y, 8, bold, gris);

  if (data.formasPago.length <= 1) {
    const forma = data.formasPago[0];
    texto(forma?.method ?? "No especificado", 130, y, 8);

    if (forma?.operacion) {
      y -= 13;
      texto(`  Op. ${forma.operacion}`, 40, y, 7, regular, gris);
    }
  } else {
    // Dos tramos del mismo medio (dos Yapes) o de medios distintos: en los dos
    // casos se listan uno por línea con su monto y su código.
    const mismoMedio = data.formasPago.every(
      (forma) => forma.method === data.formasPago[0].method
    );

    texto(mismoMedio ? data.formasPago[0].method : "Pago mixto", 130, y, 8);

    for (const forma of data.formasPago) {
      y -= 13;
      texto(`  ${forma.method}`, 40, y, 8, regular, gris);
      texto(`S/ ${forma.amount.toFixed(2)}`, 130, y, 8);

      if (forma.operacion) {
        texto(`Op. ${forma.operacion}`, 200, y, 7, regular, gris);
      }
    }
  }

  if (data.receivedAmount !== null) {
    y -= 14;
    texto("PAGÓ CON:", 40, y, 8, bold, gris);
    texto(`S/ ${data.receivedAmount.toFixed(2)}`, 130, y, 8);

    y -= 14;
    texto("VUELTO:", 40, y, 8, bold, gris);
    texto(`S/ ${(data.changeGiven ?? 0).toFixed(2)}`, 130, y, 8);
  }

  y -= 14;
  texto("N° DE OPERACIÓN:", 40, y, 8, bold, gris);
  texto(data.operationNumber, 130, y, 8);

  // ── Código QR ─────────────────────────────────────────────────────────────
  // Formato SUNAT: RUC | tipo | serie | correlativo | IGV | total | fecha |
  // tipo doc adquirente | doc adquirente
  const contenidoQr = [
    EMISOR.ruc,
    comprobante.codigo,
    comprobante.serie,
    String(data.correlativo).padStart(8, "0"),
    igv.toFixed(2),
    total.toFixed(2),
    data.paidAt.toISOString().slice(0, 10),
    comprobante.docCode,
    adquirente.doc,
  ].join("|");

  // El resumen se calcula sobre esa misma cadena, que es lo que identifica al
  // comprobante. Ver `calcularResumen` para por qué no es aleatorio.
  const resumen = calcularResumen(contenidoQr);

  const qrDataUrl = await QRCode.toDataURL(contenidoQr, { margin: 1, width: 220 });
  const qrImage = await pdf.embedPng(qrDataUrl);

  page.drawImage(qrImage, { x: width - 140, y: 90, width: 100, height: 100 });

  // ── Pie ───────────────────────────────────────────────────────────────────
  // El resumen va impreso y **no** dentro del QR: las fuentes no coinciden en
  // si el décimo campo corresponde, y un campo de más se ve al escanear
  // mientras que uno de menos no lo nota nadie. En el pie es correcto según
  // cualquier lectura de la norma.
  texto("Resumen (código hash):", 40, 84, 7, bold, gris);
  texto(resumen, 130, 84, 7, regular, negro);

  texto(
    "Representación impresa de la factura electrónica.",
    40,
    72,
    7,
    regular,
    gris
  );

  texto(
    "Documento generado por el sistema de licencias de funcionamiento de la MPT.",
    40,
    62,
    7,
    regular,
    gris
  );

  return pdf.save();
}
