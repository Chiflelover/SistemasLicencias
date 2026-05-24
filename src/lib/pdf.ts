import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface LicenseData {
  licenseNumber: string;
  legalName: string;
  ruc: string;
  fiscalAddress: string;
  commercialAddress: string;
  activityType: string;
  issuedAt: Date;
  expiresAt: Date;
  applicantName: string;
}

export async function generateLicensePdf(data: LicenseData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colores corporativos Trujillo
  const gold = rgb(0.8, 0.6, 0.1);
  const navy = rgb(0.05, 0.1, 0.3);
  const lightGray = rgb(0.95, 0.95, 0.97);
  const darkGray = rgb(0.2, 0.2, 0.25);
  const white = rgb(1, 1, 1);

  // --- Fondo superior azul marino ---
  page.drawRectangle({ x: 0, y: height - 160, width, height: 160, color: navy });

  // --- Borde dorado superior ---
  page.drawRectangle({ x: 0, y: height - 163, width, height: 4, color: gold });

  // --- Escudo/Logo simplificado (círculo dorado) ---
  page.drawCircle({ x: 72, y: height - 80, size: 38, color: gold });
  page.drawCircle({ x: 72, y: height - 80, size: 32, color: navy });
  page.drawText("MPT", { x: 56, y: height - 87, size: 12, font: fontBold, color: gold });

  // --- Título principal ---
  page.drawText("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", {
    x: 125, y: height - 55, size: 13, font: fontBold, color: white,
  });
  page.drawText("Subgerencia de Licencias y Comercialización", {
    x: 125, y: height - 73, size: 9, font, color: rgb(0.7, 0.7, 0.8),
  });
  page.drawText("LICENCIA DE FUNCIONAMIENTO COMERCIAL", {
    x: 125, y: height - 100, size: 16, font: fontBold, color: gold,
  });
  page.drawText("Ciudad de la Eterna Primavera - La Libertad, Perú", {
    x: 125, y: height - 118, size: 8, font, color: rgb(0.6, 0.65, 0.75),
  });

  // --- Número de Licencia destacado ---
  page.drawRectangle({ x: 40, y: height - 205, width: width - 80, height: 36, color: lightGray });
  page.drawRectangle({ x: 40, y: height - 205, width: 4, height: 36, color: gold });
  page.drawText("Nº DE LICENCIA:", {
    x: 56, y: height - 183, size: 8, font: fontBold, color: darkGray,
  });
  page.drawText(data.licenseNumber, {
    x: 160, y: height - 183, size: 14, font: fontBold, color: navy,
  });

  // --- Tabla de datos del negocio ---
  const tableY = height - 250;
  const rows: [string, string][] = [
    ["Razón Social / Nombre Comercial:", data.legalName],
    ["RUC:", data.ruc],
    ["Domicilio Fiscal:", data.fiscalAddress],
    ["Dirección del Establecimiento:", data.commercialAddress],
    ["Giro o Actividad Comercial:", data.activityType],
    ["Titular / Representante Legal:", data.applicantName],
    ["Fecha de Emisión:", formatDate(data.issuedAt)],
    ["Fecha de Vencimiento:", formatDate(data.expiresAt)],
  ];

  rows.forEach(([label, value], i) => {
    const y = tableY - i * 32;
    const bg = i % 2 === 0 ? lightGray : white;
    page.drawRectangle({ x: 40, y: y - 12, width: width - 80, height: 28, color: bg });
    page.drawText(label, { x: 50, y: y + 4, size: 8, font: fontBold, color: darkGray });
    page.drawText(value, { x: 230, y: y + 4, size: 9, font, color: navy });
  });

  // --- Línea separadora dorada ---
  const sepY = tableY - rows.length * 32 - 20;
  page.drawRectangle({ x: 40, y: sepY, width: width - 80, height: 2, color: gold });

  // --- Sello Municipal (área de sellado) ---
  page.drawCircle({ x: 120, y: sepY - 55, size: 44, color: lightGray });
  page.drawCircle({ x: 120, y: sepY - 55, size: 44, borderColor: gold, borderWidth: 2 });
  page.drawCircle({ x: 120, y: sepY - 55, size: 36, borderColor: navy, borderWidth: 1 });
  page.drawText("SELLO", { x: 103, y: sepY - 51, size: 7, font: fontBold, color: navy });
  page.drawText("OFICIAL", { x: 103, y: sepY - 62, size: 7, font: fontBold, color: navy });
  page.drawText("MPT", { x: 109, y: sepY - 73, size: 7, font: fontBold, color: gold });

  // --- Línea de firma ---
  page.drawLine({
    start: { x: 340, y: sepY - 35 }, end: { x: 520, y: sepY - 35 },
    thickness: 1, color: darkGray,
  });
  page.drawText("Subgerente de Licencias y Comercialización", {
    x: 340, y: sepY - 48, size: 7, font, color: darkGray,
  });
  page.drawText("Municipalidad Provincial de Trujillo", {
    x: 362, y: sepY - 59, size: 7, font, color: darkGray,
  });

  // --- Nota legal al pie ---
  const footerY = 60;
  page.drawRectangle({ x: 0, y: 0, width, height: 50, color: navy });
  page.drawRectangle({ x: 0, y: 50, width, height: 2, color: gold });
  page.drawText(
    "Este documento tiene validez legal de conformidad con la Ley N° 28976 - Ley Marco de Licencia de Funcionamiento.",
    { x: 40, y: 30, size: 7, font, color: white }
  );
  page.drawText(
    `Código de verificación: ${data.licenseNumber}-${data.ruc.slice(-4)}-MPT | Verificable en: tramites.trujillo.gob.pe`,
    { x: 40, y: 15, size: 6.5, font, color: rgb(0.6, 0.65, 0.75) }
  );

  return pdfDoc.save();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
