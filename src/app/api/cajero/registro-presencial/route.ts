import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ApplicationService } from "@/services/application.service";
import { ApplicationRepository } from "@/repositories/application.repository";
import { DocumentRepository } from "@/repositories/document.repository";
import { RucService } from "@/services/ruc.service";
import {
  belongsToDistrictTrujillo,
  OUT_OF_DISTRICT_MESSAGE,
} from "@/lib/territory";
import { checkRucEligibility } from "@/lib/ruc-eligibility";
import { isAssemblingExpedient } from "@/lib/documents";
import { resolverEstablecimiento } from "@/lib/establecimiento";
import {
  CAJA_CERRADA_MENSAJE,
  CashSessionService,
} from "@/services/cash-session.service";
import { ApplicationStatus, DocumentType } from "@prisma/client";

export const dynamic = "force-dynamic";

// ── CAMBIAR EL TAMAÑO MÁXIMO DE ARCHIVO ─────────────────────────────────────
// Poner los MB que pidan en lugar del 5:
//
//   const MAX_FILE_SIZE = 3 * 1024 * 1024;
//
// OJO: el límite está repetido y hay que cambiarlo en los 5 archivos del
// servidor, en la validación del navegador y en los 3 textos que dicen "5MB"
// (incluido el mensaje de error de unas líneas más abajo). Si se cambia solo
// acá, la pantalla sigue rechazando con el límite viejo y el usuario ve un
// error que no coincide con lo que acepta el servidor.
//
//   src/app/api/cajero/registro-presencial/route.ts          (este archivo)
//   src/app/api/cajero/subsanar/[applicationId]/route.ts
//   src/app/api/public/tramite/[applicationId]/documentos/route.ts
//   src/app/api/public/tramite/[applicationId]/pago/manual/route.ts
//   src/app/api/public/tramite/[applicationId]/subsanar/route.ts
//   src/components/ManualPaymentForm.tsx                     (validación y texto)
//   src/components/PublicDocumentUploadForm.tsx              (texto)
//   src/app/cajero/registro-presencial/page.tsx              (texto)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

function validateFile(file: unknown, label: string): File {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error(`Adjunta el archivo de ${label}.`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`El archivo de ${label} no debe superar los 5MB.`);
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new Error(`El archivo de ${label} debe ser PDF, JPG o PNG.`);
  }

  return file;
}

/** Registro presencial completo: datos del negocio, contacto y documentos. */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Con la caja cerrada la ventanilla no atiende. Se comprueba antes de leer el
  // formulario: el alta consulta SUNAT y guarda dos archivos, y el trámite que
  // quedaría a medias **toma el RUC** hasta que se cobre.
  const turno = await CashSessionService.getOpenSession(user.id);

  if (!turno) {
    return NextResponse.json({ error: CAJA_CERRADA_MENSAJE }, { status: 409 });
  }

  try {
    const formData = await request.formData();

    const read = (key: string) => String(formData.get(key) || "").trim();

    const ruc = read("ruc");
    const legalName = read("legalName");
    const fiscalAddress = read("fiscalAddress");
    const representativeName = read("representativeName");
    const representativeDni = read("representativeDni");
    const representativeRole = read("representativeRole");
    const activityType = read("activityType");
    const email = read("email").toLowerCase();

    if (!/^\d{11}$/.test(ruc)) {
      return NextResponse.json(
        { error: "El RUC debe tener 11 dígitos." },
        { status: 400 }
      );
    }

    if (legalName.length < 3) {
      return NextResponse.json(
        { error: "La razón social es obligatoria." },
        { status: 400 }
      );
    }

    if (fiscalAddress.length < 5) {
      return NextResponse.json(
        { error: "El domicilio fiscal es obligatorio." },
        { status: 400 }
      );
    }

    if (representativeName.length < 3) {
      return NextResponse.json(
        { error: "El nombre del representante legal es obligatorio." },
        { status: 400 }
      );
    }

    // SUNAT no informa el giro: lo declara el contribuyente en ventanilla.
    if (activityType.length < 3) {
      return NextResponse.json(
        { error: "El rubro o giro del negocio es obligatorio." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(representativeDni)) {
      return NextResponse.json(
        { error: "El DNI del representante legal debe tener 8 dígitos." },
        { status: 400 }
      );
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "Ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    // El teléfono ya no se pide: el sistema no envía nada por ahí. Al
    // administrado se le avisa por correo (`contactEmail`) y el WhatsApp está
    // reservado a la agenda del inspector, que va a un número fijo.

    // Regla territorial: el cajero no puede saltearse el filtro de distrito.
    // Sale del caché de RUC, así que normalmente no gasta cuota de APIPERU.
    const rucData = await RucService.getBusinessData(ruc);


    // El RUC debe estar activo ante SUNAT: uno dado de baja, suspendido o
    // inhabilitado no puede obtener licencia de funcionamiento.
    const elegibilidad = checkRucEligibility(rucData);

    if (!elegibilidad.elegible) {
      return NextResponse.json(
        {
          error: elegibilidad.motivo,
          estadoTributario: rucData.estado,
          condicion: rucData.condicion,
        },
        { status: 400 }
      );
    }

    // Local elegido en la tarjeta de anexos. Se resuelve acá porque también
    // **decide la jurisdicción**: un local del distrito de Trujillo habilita el
    // trámite aunque el domicilio fiscal esté fuera (la licencia de ese local la
    // emite la MPT). Sale del caché, no gasta cuota.
    //
    // `null` cuando no vino el campo, y ahí es distinto de "el domicilio
    // fiscal": significa **no tocar el que ya estaba**. Si mandara el fiscal,
    // retomar un trámite sin abrir la tarjeta devolvería la licencia al
    // domicilio fiscal sin que nadie lo hubiera pedido. Para volver al fiscal,
    // la pantalla lo manda explícito.
    const elegido = read("commercialAddress");
    const establecimiento = elegido
      ? await resolverEstablecimiento({ ruc, fiscalAddress, elegido })
      : null;

    const commercialAddress = establecimiento?.direccion;

    // Llave del local: el anexo elegido, o el domicilio fiscal si no se eligió.
    // Siempre concreta. Distingue un local de otro para el bloqueo y el reuso.
    const establishmentAddress = establecimiento?.direccion ?? fiscalAddress;

    // Jurisdicción: la del domicilio fiscal, o la del establecimiento elegido si
    // está en Trujillo. Si ni una ni otra, el trámite es de otro municipio.
    if (
      !belongsToDistrictTrujillo(rucData) &&
      !establecimiento?.esAnexoTrujillo
    ) {
      return NextResponse.json(
        {
          error: OUT_OF_DISTRICT_MESSAGE,
          details: {
            distrito: rucData.distrito || "No registrado",
            provincia: rucData.provincia || "No registrado",
            departamento: rucData.departamento || "No registrado",
          },
        },
        { status: 400 }
      );
    }

    // El bloqueo es por (RUC + local): otro local del mismo RUC sí puede
    // tramitar. Se valida acá y no solo en la pantalla.
    const tramiteExistente = await ApplicationService.findBlockingApplication(
      ruc,
      establishmentAddress
    );

    // Un trámite que todavía se está armando no bloquea: la ventanilla lo
    // **retoma**. Es el caso del que empezó por la web y se quedó sin conexión:
    // el cajero revisa con él lo que declaró, corrige lo que haga falta y sigue
    // sobre el mismo expediente. Los estados que sí frenan son los de un
    // trámite ya pagado, observado o con licencia.
    if (tramiteExistente && !isAssemblingExpedient(tramiteExistente.status)) {
      return NextResponse.json(
        {
          error:
            tramiteExistente.motivo === "EN_PROCESO"
              ? `Este local del RUC ${ruc} ya tiene el trámite ${tramiteExistente.number} en proceso. No corresponde registrar otro para el mismo local hasta que finalice.`
              : tramiteExistente.motivo === "LICENCIA_VENCIDA"
                ? `La licencia de este local (RUC ${ruc}, trámite ${tramiteExistente.number}) venció. Usa "Renovación de licencia" para cobrarle la renovación.`
                : `Este local del RUC ${ruc} ya cuenta con una licencia vigente (trámite ${tramiteExistente.number}).`,
          tramiteExistente,
        },
        { status: 409 }
      );
    }

    // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────────────────
    // Acá el registro presencial exige los dos archivos. Para aceptarlo sin
    // ellos hace falta algo más que borrar una línea, porque más abajo se leen
    // y se escriben. El reemplazo completo, listo para pegar:
    //
    //   const planoFile = formData.get("plano") instanceof File
    //     ? validateFile(formData.get("plano"), "el plano del local")
    //     : null;
    //   const certificadoFile = formData.get("certificados") instanceof File
    //     ? validateFile(formData.get("certificados"), "los certificados")
    //     : null;
    //
    // ...y en el paso 2 de más abajo, envolver cada DocumentRepository.create
    // en su `if (planoFile)` / `if (certificadoFile)`, y dejar de promover a
    // PENDING_PAYMENT si no hay ninguno. Ver también el `documentsComplete` de
    // src/app/api/public/tramite/[applicationId]/documentos/route.ts, que lista
    // los demás puntos donde se exigen documentos.
    // Los archivos dejaron de ser obligatorios en la petición: si se está
    // retomando un trámite que ya los tiene subidos por la web, no hay que
    // volver a pedirlos. Lo que se exige, más abajo, es que el trámite termine
    // con los dos —vengan de donde vengan—.
    let planoFile: File | null = null;
    let certificadoFile: File | null = null;

    try {
      if (formData.get("plano") instanceof File) {
        planoFile = validateFile(formData.get("plano"), "el plano del local");
      }

      if (formData.get("certificados") instanceof File) {
        certificadoFile = validateFile(
          formData.get("certificados"),
          "los certificados"
        );
      }
    } catch (fileError: any) {
      return NextResponse.json({ error: fileError.message }, { status: 400 });
    }

    // 1. Alta del negocio, el solicitante y el trámite. Si el RUC ya tenía uno
    //    a medio armar —típicamente empezado por la web— lo adopta en vez de
    //    crear otro, y le sobrescribe rubro, DNI y correo con lo que el cajero
    //    acaba de relevar.
    const { application, business } =
      await ApplicationService.registerInPersonApplication({
        cashierId: user.id,
        legalName,
        ruc,
        fiscalAddress,
        commercialAddress,
        establishmentAddress,
        representativeName,
        representativeDni,
        representativeRole,
        activityType,
        email,
      });

    const documentosPrevios = await prisma.document.findMany({
      where: { applicationId: application.id },
      select: { type: true },
    });

    const tienePlano =
      Boolean(planoFile) ||
      documentosPrevios.some((d) => d.type === DocumentType.FLOOR_PLAN);
    const tieneCertificados =
      Boolean(certificadoFile) ||
      documentosPrevios.some((d) => d.type === DocumentType.RUC_RECORD);

    // ── PARA HACER LOS DOCUMENTOS OPCIONALES ────────────────────────────────
    // Este es el bloque que los exige. Para no pedir ninguno, borrarlo entero;
    // para exigir uno solo, quitar la mitad de la condición. Ver también el
    // `documentsComplete` de
    // src/app/api/public/tramite/[applicationId]/documentos/route.ts.
    if (!tienePlano || !tieneCertificados) {
      return NextResponse.json(
        {
          error: !tienePlano && !tieneCertificados
            ? "Adjunta el plano del local y los certificados."
            : !tienePlano
              ? "Falta el plano del local."
              : "Faltan los certificados.",
        },
        { status: 400 }
      );
    }

    // 2. Documentos. Se escriben directo con el repositorio, sin pasar por
    //    DocumentService.uploadDocument: ese hace un findById pesado (negocio,
    //    pagos, inspecciones, licencia) por cada archivo. Buffers y escrituras
    //    van en paralelo.
    //
    //    Un archivo subido acá sobre un trámite que ya lo tenía es un
    //    reemplazo: se agrega y el viejo queda archivado, igual que en la web.
    const escrituras: Array<Promise<unknown>> = [];

    if (planoFile) {
      const nombre = documentosPrevios.some(
        (d) => d.type === DocumentType.FLOOR_PLAN
      )
        ? "Plano (reemplazado en ventanilla)"
        : "Plano del local";

      escrituras.push(
        planoFile.arrayBuffer().then((buffer) =>
          DocumentRepository.create({
            applicationId: application.id,
            type: DocumentType.FLOOR_PLAN,
            name: nombre,
            fileName: planoFile!.name,
            mimeType: planoFile!.type,
            size: planoFile!.size,
            content: Buffer.from(buffer),
          })
        )
      );
    }

    if (certificadoFile) {
      const nombre = documentosPrevios.some(
        (d) => d.type === DocumentType.RUC_RECORD
      )
        ? "Ficha RUC (reemplazada en ventanilla)"
        : "Certificados";

      escrituras.push(
        certificadoFile.arrayBuffer().then((buffer) =>
          DocumentRepository.create({
            applicationId: application.id,
            type: DocumentType.RUC_RECORD,
            name: nombre,
            fileName: certificadoFile!.name,
            mimeType: certificadoFile!.type,
            size: certificadoFile!.size,
            content: Buffer.from(buffer),
          })
        )
      );
    }

    await Promise.all(escrituras);

    // El trámite tiene los dos documentos obligatorios: queda listo para el
    // cobro. Es la transición que DocumentService haría sola en el flujo normal.
    await ApplicationRepository.updateStatus(
      application.id,
      ApplicationStatus.PENDING_PAYMENT
    );

    const updated = await ApplicationRepository.findById(application.id);

    return NextResponse.json(
      {
        success: true,
        message:
          "Solicitud presencial registrada. Queda pendiente el cobro para agendar la inspección.",
        application: {
          id: application.id,
          number: application.number,
          status: updated?.status ?? application.status,
          createdAt: application.createdAt,
        },
        business: { legalName: business.legalName, ruc: business.ruc },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error en registro presencial:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al registrar la solicitud." },
      { status: 400 }
    );
  }
}
