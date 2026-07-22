import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

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
  /** Nombre relevado en ventanilla. El flujo público no lo pide. */
  representativeName?: string;
  /** Declarado por el ciudadano; el nombre se resuelve aparte, contra el padrón. */
  representativeDni?: string;
}

/** Texto de relleno que guardan los flujos que no relevan al representante. */
const SIN_DATO = "No registrado";

// ── DATO FIJO DE LA DEMOSTRACIÓN ────────────────────────────────────────────
// Cambiar el número y listo:
//
//   const AREA_ESTABLECIMIENTO = "85.00 m²";
//
// El área del local es un dato con peso real —según el TUO de la Ley 28976
// decide si el establecimiento es "módulo" (hasta 100 m²) o "puesto" (hasta
// 35 m², sin ITSE previa)— pero **el sistema no lo releva en ningún punto de
// alta**: no está en el formulario público, ni en el registro presencial, ni
// en `Business`. Pedirlo de verdad sería una migración más dos formularios.
//
// Va fijo por decisión del usuario, con el mismo criterio que el profesor
// aceptó para los documentos ("suban una foto cualquiera, es para la
// demostración"). Consecuencia a tener presente: **todas las licencias salen
// con el mismo número**, así que dos licencias puestas lado a lado lo muestran.
const AREA_ESTABLECIMIENTO = "120.00 m²";

// ── DATO FIJO DE LA DEMOSTRACIÓN ────────────────────────────────────────────
// En la realidad el nivel de riesgo sale de la matriz del Reglamento de
// Inspecciones Técnicas de Seguridad y depende del área, el aforo y la
// actividad. Con el área fija daría siempre lo mismo, así que se deja escrito.
const NIVEL_DE_RIESGO = "Bajo";

/**
 * Zonificaciones y las palabras que las delatan en el giro declarado.
 *
 * **Es una aproximación para la demostración, no la regla real.** La
 * zonificación es un dato del *terreno* y sale del plano de zonificación
 * municipal; la compatibilidad con el giro la evalúa la municipalidad contra
 * su Índice de Usos (TUO de la Ley 28976, arts. 2 y 6). No existe fuente
 * pública consultable, así que acá se infiere del rubro para que la licencia
 * se lea coherente: una bodega sale comercio vecinal y una universidad sale
 * educación, en vez de repetir siempre el mismo valor.
 *
 * El orden importa: se recorre de la familia más específica a la más general,
 * porque "panificadora industrial" tiene que caer en industria y no en
 * panadería.
 *
 * **Solo van palabras inequívocas.** Ante una que pueda ir en dos familias
 * —"laboratorio" es clínico o químico según el caso— se prefiere no ponerla y
 * dejar que caiga en el texto de abajo. Es lo mismo que decidió el usuario para
 * el caso sin coincidencia: mejor decir de dónde sale el dato que inventarlo.
 */
const ZONIFICACIONES: Array<{ codigo: string; nombre: string; claves: string[] }> = [
  {
    codigo: "E",
    nombre: "Educación",
    claves: ["educa", "universi", "colegio", "nido", "instituto", "academia", "escuela"],
  },
  {
    codigo: "H",
    nombre: "Salud",
    claves: ["hospital", "clinic", "salud", "consultorio", "posta medica"],
  },
  {
    codigo: "I2",
    nombre: "Industria Liviana",
    claves: [
      "taller", "fabrica", "industri", "planta", "almacen", "deposito",
      "metal", "carpinter", "fundic", "manufactur",
    ],
  },
  {
    codigo: "CM",
    nombre: "Comercio Metropolitano",
    claves: ["discoteca", "hotel", "cine", "centro comercial", "casino"],
  },
  {
    codigo: "CZ",
    nombre: "Comercio Zonal",
    claves: ["restauran", "banco", "gimnasio", "minimarket", "supermercado", "oficina", "agencia"],
  },
  {
    codigo: "CV",
    nombre: "Comercio Vecinal",
    claves: ["bodega", "abarrote", "peluquer", "panader", "farmacia", "botica", "bazar", "librer", "ferreter"],
  },
];

/**
 * Zonificación deducida del giro, o de dónde sale si no se puede deducir.
 *
 * **Sin coincidencia devuelve "Según plano municipal"**, y es deliberado: el
 * plano que se sube en la demostración es una foto cualquiera, así que afirmar
 * una zonificación concreta sacada de la nada sería decir de más. Decir de
 * dónde sale el dato es más defendible que inventarlo, y nunca deja la licencia
 * con un campo vacío.
 */
function deducirZonificacion(giro: string): string {
  const limpio = (giro || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  for (const zona of ZONIFICACIONES) {
    if (zona.claves.some((clave) => limpio.includes(clave))) {
      return `${zona.nombre} (${zona.codigo})`;
    }
  }

  return "Según plano municipal";
}

/**
 * Arma la línea del representante con lo que haya.
 *
 * El flujo público crea un usuario sintético ("Solicitante RUC 2021…"), que no
 * identifica a nadie: por eso se prefiere el nombre relevado y, si no lo hay,
 * se imprime solo el DNI que declaró el ciudadano.
 */
function formatRepresentative(data: LicenseData): string {
  const nombreRelevado = data.representativeName?.trim();
  const nombre =
    nombreRelevado && nombreRelevado !== SIN_DATO
      ? nombreRelevado
      : data.applicantName?.startsWith("Solicitante RUC")
        ? ""
        : data.applicantName?.trim() || "";

  const dni = data.representativeDni?.trim();
  const partes = [nombre, dni ? `DNI ${dni}` : ""].filter(Boolean);

  return partes.length > 0 ? partes.join(" · ") : SIN_DATO;
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
    ["Área del Establecimiento:", AREA_ESTABLECIMIENTO],
    ["Giro o Actividad Comercial:", data.activityType],
    ["Zonificación:", deducirZonificacion(data.activityType)],
    ["Nivel de Riesgo:", NIVEL_DE_RIESGO],
    ["Titular / Representante Legal:", formatRepresentative(data)],
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

/**
 * Estampa una marca de agua diagonal sobre un PDF ya emitido.
 *
 * Trabaja sobre una copia en memoria y devuelve bytes nuevos: el PDF guardado
 * en la base no se toca. Así una licencia que vuelve a estar vigente tras una
 * renovación no queda marcada, y las licencias vigentes nunca se modifican.
 *
 * El texto es parámetro porque hay dos casos: "VENCIDA" y "DADA DE BAJA". El
 * tamaño se calcula contra el ancho de la hoja, así que el segundo —bastante
 * más largo— entra igual sin desbordar.
 */
export async function addExpiredWatermark(
  originalPdf: Uint8Array | Buffer,
  texto = "VENCIDA"
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdf);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const rojo = rgb(0.75, 0.1, 0.12);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();

    // Tamaño proporcional al ancho de la hoja, para que cruce la página
    // completa sin desbordarla.
    let size = 110;
    while (font.widthOfTextAtSize(texto, size) > width * 1.15 && size > 20) {
      size -= 2;
    }

    const textWidth = font.widthOfTextAtSize(texto, size);

    // Con la rotación de 45°, el texto avanza en diagonal desde (x, y).
    // Se resta medio ancho proyectado sobre cada eje para centrar el trazo.
    const radianes = Math.PI / 4;
    const x = width / 2 - (textWidth / 2) * Math.cos(radianes);
    const y = height / 2 - (textWidth / 2) * Math.sin(radianes);

    page.drawText(texto, {
      x,
      y,
      size,
      font,
      color: rojo,
      opacity: 0.28,
      rotate: degrees(45),
    });
  }

  return pdfDoc.save();
}
